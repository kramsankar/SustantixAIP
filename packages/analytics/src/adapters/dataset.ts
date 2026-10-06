/**
 * Builds the storage-neutral analytics dataset from a tenant's governed data: phase 2 masters (identity, with
 * references as business codes) and the time-series / history tables (registry column names). The workbook and
 * the database each supply a TenantSource, so both paths run exactly the same mapping.
 */
import type { AnalyticsDataset } from "../portfolio.ts";

export type Rec = Record<string, unknown>;

/** Masters and history tables the dataset reads: hosts load exactly these. */
export const DATASET_MASTERS = ["site", "offtake_contract", "asset", "asset_inverter", "asset_bess", "warranty_contract", "part", "part_stock", "intervention"] as const;
export const DATASET_TABLES = [
  "twin_telemetry", "fcst_actual", "fcst_validation", "fcst_interval", "inverter_telemetry", "reliability_life_history",
  "work_orders", "bess_daily_operations", "bess_degradation_plan", "bess_capacity_tests", "risk_queue",
] as const;
/** Governed columns the dataset resolves to vocabulary codes (column → reference table). */
export const DATASET_BINDINGS: Record<string, string> = {
  "reliability_life_history.asset_class": "asset_class",
  "work_orders.maintenance_type": "maintenance_type",
  "part.category": "asset_class",
};

export interface TenantSource {
  currency: string;
  /** Master rows: business code plus values (references as the target's business code). */
  master(name: string): Array<{ code: string; values: Rec }>;
  /** Rows of a workbook-shaped table, keyed by registry column name. */
  rows(table: string): Rec[];
  /** Vocabulary code for a free-text value of a governed column (null when unmapped). */
  resolve(column: string, ref: string, value: unknown): string | null;
}

const iso = (v: unknown) => (v === null || v === undefined ? null : String(v).trim().replace(" ", "T"));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/** Safety severity (1–5) by asset class: a governed policy table, not a model output. */
export const SAFETY_SEVERITY: Record<string, number> = { TRANSFORMER: 3, SWITCHGEAR: 3, HV_SWITCHGEAR: 4, BESS_SYSTEM: 4, BESS_CONTAINER: 4, BESS_PCS: 3, BESS_MV_TRANSFORMER: 3 };

export function buildDataset(src: TenantSource, asOf: string): AnalyticsDataset {
  const asOfMs = Date.parse(asOf);
  const rows = (name: string) => src.master(name);
  const ctx = { rows: (t: string) => src.rows(t) };
  const code = (column: string, ref: string, v: unknown) => src.resolve(column, ref, v);

  // Sites: capacity, PPA tariff (per MWh) and the capacity factor observed over full days of metered output.
  const tariff = new Map(rows("offtake_contract").filter((c) => c.values.contract_type === "PPA").map((c) => [String(c.values.site), Number(c.values.tariff_per_kwh) * 1000]));
  const twin = ctx.rows("twin_telemetry");
  const metered = ctx.rows("fcst_actual");
  const cf = new Map<string, number>();
  for (const s of rows("site")) {
    const t = metered.filter((r) => r.plant_id === s.code && num(r.actual_ac_mw) !== null);
    const capacity = Number(s.values.capacity_mw);
    if (t.length && capacity > 0) cf.set(s.code, t.reduce((a, r) => a + Number(r.actual_ac_mw), 0) / t.length / capacity);
  }
  const sites = rows("site").map((s) => ({ code: s.code, capacityMw: Number(s.values.capacity_mw), tariffPerMwh: tariff.get(s.code) ?? null, capacityFactor: cf.get(s.code) ?? null }));

  // Life history: class codes, hours, failure flags; resets give each asset its current age.
  const life = ctx.rows("reliability_life_history");
  const lifeHistory = life.flatMap((r) => {
    const assetClass = code("reliability_life_history.asset_class", "asset_class", r.asset_class);
    // Module records carry calendar exposure instead of operating hours.
    const hours = num(r.operating_hours) ?? num(r.calendar_exposure_hours);
    if (!assetClass || hours === null || hours <= 0) return [];
    return [{ assetClass, hours, failed: String(r.failed_surviving) === "Failed" }];
  });
  const resetAt = new Map<string, number>();
  const commissioned = new Map<string, number>();
  for (const r of life) {
    const a = String(r.asset_id);
    if (r.commissioned_date) commissioned.set(a, Date.parse(String(r.commissioned_date)));
    if (String(r.replacement_reset) === "Yes" && r.observation_date) resetAt.set(a, Math.max(resetAt.get(a) ?? 0, Date.parse(String(r.observation_date))));
  }
  const assets = rows("asset").flatMap((a) => {
    const assetClass = a.values.asset_class as string | null;
    if (!assetClass) return [];
    const start = resetAt.get(a.code) ?? commissioned.get(a.code) ?? (a.values.install_year ? Date.UTC(Number(a.values.install_year), 0, 1) : null);
    if (start === null) return [];
    return [{ code: a.code, site: String(a.values.site), assetClass, ratedMw: num(a.values.rated_capacity_mw), ageHours: Math.max(0, (asOfMs - start) / 3600000), health: num(a.values.health_score) }];
  });

  // Corrective work orders: repair hours (MTTR) and repair cost per class.
  const assetClass = new Map(rows("asset").map((a) => [a.code, a.values.asset_class as string | null]));
  const repairs: AnalyticsDataset["repairs"] = [];
  const costs = new Map<string, number[]>();
  for (const w of ctx.rows("work_orders")) {
    if (code("work_orders.maintenance_type", "maintenance_type", w.maintenance_type) !== "CORRECTIVE") continue;
    const c = assetClass.get(String(w.asset_id));
    if (!c) continue;
    const h = num(w.actual_resolution_hours);
    if (h !== null && h > 0) repairs.push({ assetClass: c, hours: h });
    const cost = num(w.estimated_cost);
    if (cost !== null) (costs.get(c) ?? costs.set(c, []).get(c)!).push(cost);
  }
  const repairCostByClass = Object.fromEntries([...costs].map(([c, xs]) => [c, xs.reduce((a, b) => a + b, 0) / xs.length]));
  // Part lead time per class: parts whose category names the class.
  const leads = new Map<string, number[]>();
  for (const p of rows("part")) {
    const c = code("part.category", "asset_class", p.values.category);
    const lt = num(p.values.lead_time_days);
    if (c && lt !== null) (leads.get(c) ?? leads.set(c, []).get(c)!).push(lt);
  }
  const partLeadDaysByClass = Object.fromEntries([...leads].map(([c, xs]) => [c, xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!]));

  // Generation: history from the validation sheet, forward from the interval forecast.
  const capacity = new Map(sites.map((s) => [s.code, s.capacityMw]));
  const generationHistory = ctx.rows("fcst_validation").flatMap((r) => {
    const at = iso(r.interval_start);
    const cap = capacity.get(String(r.plant_id));
    if (!at || !cap || num(r.physics_forecast_mw) === null || num(r.actual_mw) === null) return [];
    return [{ plant: String(r.plant_id), at, leadHours: Number(r.lead_hours ?? 0), physicsMw: Number(r.physics_forecast_mw), actualMw: Number(r.actual_mw), capacityMw: cap }];
  });
  const generationBenchmark = new Map(ctx.rows("fcst_validation").flatMap((r) => (num(r.hybrid_forecast_mw) === null ? [] : [[`${String(r.plant_id)}|${iso(r.interval_start)}`, Number(r.hybrid_forecast_mw)] as [string, number]])));
  const generationForward = ctx.rows("fcst_interval").flatMap((r) => {
    const at = iso(r.interval_start);
    const cap = capacity.get(String(r.plant_id));
    if (!at || !cap) return [];
    return [{ plant: String(r.plant_id), at, leadHours: Number(r.lead_hours ?? 0), physicsMw: Number(r.after_asset_state_mw ?? 0), capacityMw: cap }];
  });

  // Inverter telemetry with ratings from the inverter extension.
  const rating = new Map(rows("asset_inverter").map((i) => [i.code, Number(i.values.ac_rating_mw)]));
  const inverterReadings = ctx.rows("inverter_telemetry").flatMap((r) => {
    const at = iso(r.timestamp);
    const rt = rating.get(String(r.asset_id));
    if (!at || !rt) return [];
    return [{ at, plant: String(r.plant_id), asset: String(r.asset_id), acMw: Number(r.ac_power_mw ?? 0), dcMw: Number(r.dc_power_mw ?? 0), dcVoltage: num(r.dc_voltage_v), tempC: num(r.inverter_temp_c), ratingMw: rt, status: (r.status as string | null) ?? null }];
  });
  // Plant performance: daily energy against weather-adjusted expected energy (a daily ratio; intra-day noise and
  // the diurnal cycle would otherwise dominate the drift test).
  const daily = new Map<string, { plant: string; at: string; actualMw: number; expectedMw: number }>();
  for (const r of twin) {
    const at = iso(r.timestamp);
    const exp = num(r.weather_adjusted_expected_ac_mw) ?? num(r.expected_ac_mw);
    const act = num(r.actual_ac_mw);
    if (!at || exp === null || act === null || exp <= 0) continue;
    const k = `${String(r.plant_id)}|${at.slice(0, 10)}`;
    const d = daily.get(k) ?? daily.set(k, { plant: String(r.plant_id), at: `${at.slice(0, 10)}T00:00:00`, actualMw: 0, expectedMw: 0 }).get(k)!;
    d.actualMw += act;
    d.expectedMw += exp;
  }
  const plantPerformance = [...daily.values()];

  // BESS: plan, tests, recent cycles and warranty terms.
  const warranty = new Map(rows("warranty_contract").filter((w) => w.code.startsWith("WTY-")).map((w) => [w.code.slice(4), w.values]));
  const bess = rows("asset_bess").map((b) => {
    const w = warranty.get(b.code);
    const daily = ctx.rows("bess_daily_operations").filter((r) => r.bess_id === b.code).sort((x, y) => String(x.date).localeCompare(String(y.date)));
    return {
      bess: b.code,
      commissioned: String(b.values.commissioning_date),
      plan: ctx.rows("bess_degradation_plan").filter((r) => r.bess_id === b.code).map((r) => ({ year: Number(r.operating_year), retentionPct: Number(r.expected_retention_pct), cumulativeCycles: num(r.expected_cumulative_cycles) })),
      tests: ctx.rows("bess_capacity_tests").filter((r) => r.bess_id === b.code && num(r.soh_energy_pct) !== null).map((r) => ({ date: String(r.test_date), sohPct: Number(r.soh_energy_pct) })),
      dailyEfc: daily.slice(-30).map((r) => Number(r.equivalent_full_cycles ?? 0)),
      guaranteedYear10Pct: num(w?.retention_pct_year10),
      guaranteedEolPct: num(w?.retention_pct_eol),
      warrantyEnd: (w?.end_date as string | null) ?? null,
      cycleLimit: num(w?.cycle_limit),
    };
  });

  // Spares: daily demand from executed interventions; stock positions from part stock.
  const executed = rows("intervention").filter((i) => i.values.actual_start && i.values.required_part);
  const days = executed.map((i) => String(i.values.actual_start).slice(0, 10)).sort();
  const partDemand: AnalyticsDataset["partDemand"] = [];
  if (days.length) {
    const first = Date.parse(days[0]!);
    const n = Math.max(1, Math.round((Date.parse(days[days.length - 1]!) - first) / 86400000) + 1);
    const byPart = new Map<string, number[]>();
    for (const i of executed) {
      const p = `${String(i.values.required_part)}@${String(i.values.site)}`;
      const d = Math.round((Date.parse(String(i.values.actual_start).slice(0, 10)) - first) / 86400000);
      const series = byPart.get(p) ?? byPart.set(p, new Array<number>(n).fill(0)).get(p)!;
      series[d]! += Number(i.values.required_part_qty ?? 1);
    }
    for (const [key, series] of byPart) {
      const [part, site] = key.split("@");
      partDemand.push({ part: part!, site: site!, daily: series });
    }
  }
  const crit = new Map(rows("part").map((p) => [p.code, (p.values.criticality as string | null) ?? null]));
  const lead = new Map(rows("part").map((p) => [p.code, num(p.values.lead_time_days)]));
  const stock = rows("part_stock").map((s) => ({
    part: String(s.values.part),
    site: String(s.values.site),
    position: Number(s.values.available_qty ?? s.values.on_hand_qty ?? 0) + Number(s.values.in_transit_qty ?? 0),
    leadTimeDays: num(s.values.lead_time_days) ?? lead.get(String(s.values.part)) ?? 14,
    criticality: crit.get(String(s.values.part)) ?? null,
  }));

  return {
    asOf,
    currency: src.currency,
    sites, assets, generationHistory, generationForward, generationBenchmark, inverterReadings, plantPerformance,
    lifeHistory, repairs, repairCostByClass, partLeadDaysByClass, safetySeverityByClass: SAFETY_SEVERITY, bess, partDemand, stock,
    expertRisk: ctx.rows("risk_queue").flatMap((r) => (num(r.composite_risk) === null ? [] : [{ asset: String(r.asset_id), score: Number(r.composite_risk) }])),
  };
}
