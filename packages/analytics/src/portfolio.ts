/**
 * Runs every AIP engine over one storage-neutral dataset and returns, per model, its metrics and its outputs in
 * one shape (subject, measure, value or q10/q50/q90). Hosts persist the result as aip.model_run / aip.model_output
 * (Supabase) or sus_modelrun / sus_modeloutput (Dataverse); agents and screens read it from there.
 */
import { cusum, detectInverterAnomalies, type InverterReading } from "./anomaly/detect.ts";
import { forecastBess, type BessInput } from "./bess/degradation.ts";
import { revenueAtRisk, scaleProbability } from "./commercial/revenue-at-risk.ts";
import { energySummary, fitGeneration, predictGeneration, type GenerationInput, type GenerationObservation } from "./forecast/generation.ts";
import { round } from "./math/stats.ts";
import { estimateRul, fitClassModels, maintainability, type AssetState } from "./reliability/rul.ts";
import type { LifeSample } from "./reliability/lifetime.ts";
import { scoreRisk, type RiskInput } from "./risk/composite.ts";
import { fitDemand, stockPolicy } from "./spares/demand.ts";

export interface AnalyticsDataset {
  asOf: string;
  currency: string;
  sites: Array<{ code: string; capacityMw: number; tariffPerMwh: number | null; capacityFactor: number | null }>;
  assets: Array<{ code: string; site: string; assetClass: string; ratedMw: number | null; ageHours: number; health: number | null }>;
  generationHistory: GenerationObservation[];
  generationForward: GenerationInput[];
  /** Workbook hybrid forecast on the history intervals, keyed plant|at, for benchmarking only. */
  generationBenchmark?: Map<string, number>;
  inverterReadings: InverterReading[];
  plantPerformance: Array<{ plant: string; at: string; actualMw: number; expectedMw: number }>;
  lifeHistory: Array<LifeSample & { assetClass: string }>;
  repairs: Array<{ assetClass: string; hours: number }>;
  repairCostByClass: Record<string, number>;
  partLeadDaysByClass: Record<string, number>;
  safetySeverityByClass: Record<string, number>;
  bess: BessInput[];
  /** Daily demand per part and site (the site where the consuming intervention ran). */
  partDemand: Array<{ part: string; site: string; daily: number[] }>;
  stock: Array<{ part: string; site: string; position: number; leadTimeDays: number; criticality: string | null }>;
  /** An existing expert or legacy risk ranking, for validation only (optional). */
  expertRisk?: Array<{ asset: string; score: number }>;
}

export interface ModelOutput {
  subjectType: "site" | "asset" | "asset_class" | "part" | "part_stock" | "bess" | "portfolio";
  subject: string;
  measure: string;
  at?: string;
  horizonHours?: number;
  value?: number | null;
  q10?: number;
  q50?: number;
  q90?: number;
  unit: string;
  detail?: Record<string, unknown>;
}

export interface ModelRun {
  model: string;
  status: "succeeded" | "skipped" | "failed";
  message?: string;
  metrics: Record<string, unknown>;
  outputs: ModelOutput[];
}

export interface PortfolioOptions {
  horizonDays: number;
  gamma: number;
  riskBandScale?: number;
  monteCarloSimulations: number;
  seed: number;
}

export const PORTFOLIO_DEFAULTS: PortfolioOptions = { horizonDays: 90, gamma: 2, monteCarloSimulations: 2000, seed: 4242 };

function attempt(model: string, f: () => Omit<ModelRun, "model" | "status">): ModelRun {
  try {
    return { model, status: "succeeded", ...f() };
  } catch (e) {
    return { model, status: "failed", message: e instanceof Error ? e.message : String(e), metrics: {}, outputs: [] };
  }
}

export function runPortfolio(d: AnalyticsDataset, options: Partial<PortfolioOptions> = {}): ModelRun[] {
  const o = { ...PORTFOLIO_DEFAULTS, ...options };
  const runs: ModelRun[] = [];
  const horizonH = o.horizonDays * 24;

  // 1 · Probabilistic generation forecast.
  let forward: ReturnType<typeof predictGeneration> = [];
  runs.push(
    attempt("AIP-GEN-HYBRID-1", () => {
      const fit = fitGeneration(d.generationHistory, {}, d.generationBenchmark);
      forward = predictGeneration(fit.model, d.generationForward);
      const outputs: ModelOutput[] = forward.filter((q) => q.q90 > 0).map((q) => ({ subjectType: "site", subject: q.plant, measure: "ac_power", at: q.at, horizonHours: q.leadHours, q10: round(q.q10, 4), q50: round(q.q50, 4), q90: round(q.q90, 4), value: round(q.physicsMw, 4), unit: "MW" }));
      for (const e of energySummary(forward)) outputs.push({ subjectType: "site", subject: e.plant, measure: "energy_horizon", q10: e.q10Mwh, q50: e.q50Mwh, q90: e.q90Mwh, value: e.physicsMwh, unit: "MWh", detail: { intervals: e.intervals } });
      return { metrics: { ...fit.metrics, conformal: round(fit.model.conformal, 6), trainedOn: fit.model.trainedOn, importance: fit.model.importance }, outputs };
    }),
  );

  // 2 · Inverter anomalies and plant drift.
  runs.push(
    attempt("AIP-ANOM-INV-1", () => {
      const scored = detectInverterAnomalies(d.inverterReadings, { seed: o.seed });
      const flagged = scored.filter((s) => s.anomalous);
      return {
        metrics: { inverters: scored.length, anomalous: flagged.length, lostEnergyMwh: round(flagged.reduce((a, s) => a + s.lostEnergyMwh, 0), 3) },
        outputs: scored.map((s) => ({ subjectType: "asset", subject: s.asset, measure: "anomaly_score", value: s.score, unit: "score", detail: { plant: s.plant, rank: s.rank, anomalous: s.anomalous, drivers: s.drivers, lostEnergyMwh: s.lostEnergyMwh } })),
      };
    }),
  );
  runs.push(
    attempt("AIP-DRIFT-CUSUM-1", () => {
      const byPlant = new Map<string, Array<{ at: string; residual: number }>>();
      for (const p of d.plantPerformance) {
        const site = d.sites.find((s) => s.code === p.plant);
        if (!site || p.expectedMw < 0.05 * site.capacityMw) continue;
        (byPlant.get(p.plant) ?? byPlant.set(p.plant, []).get(p.plant)!).push({ at: p.at, residual: p.actualMw / p.expectedMw - 1 });
      }
      const alarms = [...byPlant].flatMap(([plant, series]) => cusum(plant, series));
      return {
        metrics: { plants: byPlant.size, alarms: alarms.length },
        outputs: alarms.map((a) => ({ subjectType: "site", subject: a.plant, measure: "performance_drift", at: a.alarmAt, value: a.shift, unit: "ratio", detail: { direction: a.direction, onset: a.onset, level: a.level } })),
      };
    }),
  );

  // 3 · Life models, RUL, maintainability, risk.
  const classModels = (() => {
    try {
      return fitClassModels(d.lifeHistory);
    } catch {
      return [];
    }
  })();
  runs.push(
    attempt("AIP-LIFE-1", () => ({
      metrics: { classes: classModels.length, samples: d.lifeHistory.length, failures: d.lifeHistory.filter((h) => h.failed).length },
      outputs: classModels.map((m) => ({ subjectType: "asset_class", subject: m.assetClass, measure: "life_model", value: round(m.fit.aicc, 3), unit: "AICc", detail: { distribution: m.fit.distribution, params: Object.fromEntries(Object.entries(m.fit.params).map(([k, v]) => [k, round(v, 6)])), samples: m.samples, failures: m.failures, alternatives: m.alternatives } })),
    })),
  );
  let rul: ReturnType<typeof estimateRul> = [];
  runs.push(
    attempt("AIP-RUL-1", () => {
      const states: AssetState[] = d.assets.map((a) => ({ asset: a.code, assetClass: a.assetClass, ageHours: a.ageHours, health: a.health }));
      rul = estimateRul(classModels, states, d.lifeHistory, { horizonDays: o.horizonDays, gamma: o.gamma });
      return {
        metrics: { assets: rul.length, horizonDays: o.horizonDays, gamma: o.gamma, expectedFailures: round(rul.reduce((a, r) => a + r.pFail, 0), 2) },
        outputs: rul.flatMap((r) => [
          { subjectType: "asset", subject: r.asset, measure: "failure_probability", horizonHours: horizonH, value: r.pFail, q10: r.pFailLow, q90: r.pFailHigh, unit: "probability", detail: { assetClass: r.assetClass, hazardMultiplier: r.hazardMultiplier, distribution: r.distribution } },
          { subjectType: "asset", subject: r.asset, measure: "remaining_useful_life", value: r.rulDays, q10: r.rulDaysP10, q50: r.rulDays, q90: r.rulDaysP90, unit: "days", detail: { ageHours: r.ageHours } },
        ] as ModelOutput[]),
      };
    }),
  );
  const maint = maintainability(d.lifeHistory, d.repairs);
  runs.push(
    attempt("AIP-MAINT-1", () => ({
      metrics: { classes: maint.length },
      outputs: maint.flatMap((m) => [
        { subjectType: "asset_class", subject: m.assetClass, measure: "mtbf", value: Number.isFinite(m.mtbfHours) ? m.mtbfHours : null, unit: "h", detail: { failures: m.failures, exposureHours: m.exposureHours } },
        { subjectType: "asset_class", subject: m.assetClass, measure: "mttr", value: Number.isFinite(m.mttrHours) ? m.mttrHours : null, unit: "h", detail: { repairs: m.repairs } },
        { subjectType: "asset_class", subject: m.assetClass, measure: "inherent_availability", value: Number.isFinite(m.availabilityPct) ? m.availabilityPct : null, unit: "%" },
      ] as ModelOutput[]),
    })),
  );
  let risk: ReturnType<typeof scoreRisk> = [];
  runs.push(
    attempt("AIP-RISK-1", () => {
      const mttr = new Map(maint.map((m) => [m.assetClass, Number.isFinite(m.mttrHours) ? m.mttrHours : 24]));
      const byAsset = new Map(d.assets.map((a) => [a.code, a]));
      const inputs: RiskInput[] = rul.map((r) => {
        const a = byAsset.get(r.asset)!;
        const site = d.sites.find((s) => s.code === a.site);
        return {
          asset: r.asset, plant: a.site, assetClass: r.assetClass, ratedMw: a.ratedMw ?? 0, pFail: r.pFail,
          outageHours: (mttr.get(r.assetClass) ?? 24) + 24 * (d.partLeadDaysByClass[r.assetClass] ?? 7),
          capacityFactor: site?.capacityFactor ?? 0.2, tariffPerMwh: site?.tariffPerMwh ?? 0, repairCost: d.repairCostByClass[r.assetClass] ?? 0,
          currency: d.currency, safetySeverity: d.safetySeverityByClass[r.assetClass] ?? 1,
        };
      });
      risk = scoreRisk(inputs, { scale: o.riskBandScale });
      const bands = risk.reduce<Record<string, number>>((a, r) => ((a[r.band] = (a[r.band] ?? 0) + 1), a), {});
      return {
        metrics: { assets: risk.length, bands, expectedLoss: round(risk.reduce((a, r) => a + r.expectedLoss, 0), 2), currency: d.currency },
        outputs: risk.map((r) => ({ subjectType: "asset", subject: r.asset, measure: "risk", value: r.score, unit: "score", detail: { band: r.band, rank: r.rank, expectedLoss: r.expectedLoss, consequence: r.consequence, energyAtRiskMwh: r.energyAtRiskMwh, pFail: r.pFail, currency: r.currency, plant: r.plant } })),
      };
    }),
  );

  // 4 · BESS state of health.
  runs.push(
    attempt("AIP-BESS-SOH-1", () => {
      const f = forecastBess(d.bess, { asOf: d.asOf });
      return {
        metrics: { systems: f.length, belowGuarantee: f.filter((x) => (x.marginYear10Pct ?? 0) < 0).length },
        outputs: f.flatMap((x) => [
          { subjectType: "bess", subject: x.bess, measure: "soh_now", value: x.sohNowPct, unit: "%", detail: { fadeRatio: x.fadeRatio, tests: x.tests } },
          { subjectType: "bess", subject: x.bess, measure: "soh_year10", value: x.sohYear10Pct, unit: "%", detail: { plan: x.planYear10Pct, guaranteed: x.guaranteedYear10Pct, margin: x.marginYear10Pct, endOfLifeYear: x.endOfLifeYear, trajectory: x.trajectory } },
          { subjectType: "bess", subject: x.bess, measure: "cycles_at_warranty_end", value: x.projectedCyclesAtWarrantyEnd, unit: "cycles", detail: { efcPerDay: x.efcPerDay, cycleLimit: x.cycleLimit } },
        ] as ModelOutput[]),
      };
    }),
  );

  // 5 · Revenue at risk over the forecast horizon.
  runs.push(
    attempt("AIP-RAR-MC-1", () => {
      if (!forward.length) throw new Error("no generation forecast to simulate");
      const days = new Set(forward.map((q) => q.at.slice(0, 10))).size;
      const outputs: ModelOutput[] = [];
      const totals = { expectedRevenue: 0, revenueAtRisk95: 0 };
      for (const site of d.sites) {
        const intervals = forward.filter((q) => q.plant === site.code).map((q) => ({ at: q.at, q10: q.q10, q50: q.q50, q90: q.q90, capacityMw: site.capacityMw }));
        if (!intervals.length || !site.tariffPerMwh) continue;
        const outages = risk.filter((r) => r.plant === site.code && r.pFail > 0).map((r) => ({ asset: r.asset, ratedMw: d.assets.find((a) => a.code === r.asset)?.ratedMw ?? 0, pFail: scaleProbability(r.pFail, o.horizonDays, days), outageHours: r.energyAtRiskMwh > 0 ? 48 : 0 }));
        const rar = revenueAtRisk({ plant: site.code, intervals, intervalMinutes: 15, tariffPerMwh: site.tariffPerMwh, currency: d.currency, outages }, { simulations: o.monteCarloSimulations, seed: o.seed });
        totals.expectedRevenue += rar.expectedRevenue;
        totals.revenueAtRisk95 += rar.revenueAtRisk95;
        outputs.push({ subjectType: "site", subject: site.code, measure: "revenue_horizon", value: rar.expectedRevenue, q10: rar.revenueP90, q50: rar.revenueP50, unit: d.currency, detail: { ...rar, days } });
      }
      return { metrics: { sites: outputs.length, expectedRevenue: round(totals.expectedRevenue, 2), revenueAtRisk95: round(totals.revenueAtRisk95, 2), currency: d.currency, note: "Portfolio VaR is the sum of site VaRs (no diversification credit)" }, outputs };
    }),
  );

  // 6 · Spares.
  runs.push(
    attempt("AIP-SPARES-1", () => {
      const models = new Map(d.partDemand.filter((p) => p.daily.length >= 14).map((p) => [`${p.part}@${p.site}`, fitDemand(p.part, p.daily)]));
      // Portfolio demand per part (all sites), for the per-part output.
      const portfolio = new Map<string, number[]>();
      for (const p of d.partDemand) {
        const s = portfolio.get(p.part) ?? portfolio.set(p.part, new Array<number>(p.daily.length).fill(0)).get(p.part)!;
        p.daily.forEach((v, i) => (s[i]! += v));
      }
      const partModels = [...portfolio].filter(([, y]) => y.length >= 14).map(([part, y]) => fitDemand(part, y));
      // Sites with no consumption history for a part get no policy (no evidence of demand there).
      const policies = d.stock.flatMap((s) => {
        const m = models.get(`${s.part}@${s.site}`);
        return m ? [stockPolicy(m, s.site, s.position, s.leadTimeDays, s.criticality)] : [];
      });
      const outputs: ModelOutput[] = partModels.map((m) => ({ subjectType: "part", subject: m.part, measure: "demand_rate", value: m.rate, unit: "units/day", detail: { method: m.method, holdoutMae: m.holdoutMae, demandDays: m.demandDays, observedDays: m.observedDays } }));
      for (const p of policies) outputs.push({ subjectType: "part_stock", subject: `${p.part}@${p.site}`, measure: "reorder_point", value: p.reorderPoint, unit: "units", detail: { ...p } });
      return { metrics: { parts: partModels.length, partSites: models.size, policies: policies.length, reorderNow: policies.filter((p) => p.recommendedOrder > 0).length, methods: partModels.reduce<Record<string, number>>((a, m) => ((a[m.method] = (a[m.method] ?? 0) + 1), a), {}) }, outputs };
    }),
  );
  return runs;
}

