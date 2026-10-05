/**
 * Remaining useful life and failure risk per asset, from its class's life model, its age and its condition.
 *
 * Condition enters as a proportional-hazards multiplier: exp(γ · (1 − health/100)), so a fully healthy asset
 * follows its population and an asset at health 50 with γ = 2 fails e¹ ≈ 2.7× as fast. γ is a governed policy
 * parameter (default 2), not estimated: the life history carries no condition data to estimate it from.
 */
import { bootstrap, conditionalFailure, fitLife, remainingLife, type LifeFit, type LifeSample } from "./lifetime.ts";
import { round } from "../math/stats.ts";

export interface AssetState {
  asset: string;
  assetClass: string;
  ageHours: number;
  /** 0–100; null = unknown (treated as the population). */
  health: number | null;
}

export interface ClassModel {
  assetClass: string;
  fit: LifeFit;
  alternatives: Array<Pick<LifeFit, "distribution" | "aicc">>;
  samples: number;
  failures: number;
}

export interface RulEstimate {
  asset: string;
  assetClass: string;
  ageHours: number;
  hazardMultiplier: number;
  /** Probability of failure within the horizon, with a bootstrap 90 % interval. */
  pFail: number;
  pFailLow: number;
  pFailHigh: number;
  /** Median remaining life in days, with the 10th–90th percentile range of remaining life. */
  rulDays: number;
  rulDaysP10: number;
  rulDaysP90: number;
  distribution: LifeFit["distribution"];
}

export const HOURS_PER_DAY = 24;

export function fitClassModels(history: Array<LifeSample & { assetClass: string }>, minFailures = 5): ClassModel[] {
  const byClass = new Map<string, LifeSample[]>();
  for (const h of history) (byClass.get(h.assetClass) ?? byClass.set(h.assetClass, []).get(h.assetClass)!).push(h);
  const out: ClassModel[] = [];
  for (const [assetClass, data] of byClass) {
    const failures = data.filter((d) => d.failed).length;
    if (failures < minFailures) continue;
    const fits = fitLife(data);
    out.push({ assetClass, fit: fits[0]!, alternatives: fits.map((f) => ({ distribution: f.distribution, aicc: round(f.aicc, 2) })), samples: data.length, failures });
  }
  return out.sort((a, b) => a.assetClass.localeCompare(b.assetClass));
}

export const hazardMultiplier = (health: number | null, gamma: number) => (health === null ? 1 : Math.exp(gamma * (1 - Math.min(100, Math.max(0, health)) / 100)));

/**
 * Estimates per asset. Bootstrap intervals are computed once per class at a grid of ages and interpolated, so the
 * cost does not grow with the number of assets.
 */
export function estimateRul(models: ClassModel[], assets: AssetState[], history: Array<LifeSample & { assetClass: string }>, opts: { horizonDays?: number; gamma?: number; replicates?: number } = {}): RulEstimate[] {
  const horizon = (opts.horizonDays ?? 90) * HOURS_PER_DAY;
  const gamma = opts.gamma ?? 2;
  const byClass = new Map(models.map((m) => [m.assetClass, m]));
  const bands = new Map<string, (age: number, mult: number) => { low: number; high: number }>();
  for (const m of models) {
    const data = history.filter((h) => h.assetClass === m.assetClass);
    const ages = [0, 0.25, 0.5, 1, 1.5, 2].map((k) => k * (m.fit.distribution === "weibull" ? m.fit.params.eta! : m.fit.distribution === "lognormal" ? Math.exp(m.fit.params.mu!) : 1 / m.fit.params.lambda!));
    // Relative half-widths of the interval on P(fail), per reference age, applied to each asset's own estimate.
    const rel = ages.map((age) => {
      const point = conditionalFailure(m.fit, age, horizon);
      const b = bootstrap(data, m.fit.distribution, (f) => conditionalFailure(f, age, horizon), opts.replicates ?? 60);
      return { age, lo: point > 0 ? b.q05 / point : 1, hi: point > 0 ? b.q95 / point : 1 };
    });
    bands.set(m.assetClass, (age) => {
      const i = Math.max(0, rel.findIndex((r) => r.age >= age) - 1);
      const r = rel[Math.min(i, rel.length - 1)]!;
      return { low: r.lo, high: r.hi };
    });
  }
  const out: RulEstimate[] = [];
  for (const a of assets) {
    const m = byClass.get(a.assetClass);
    if (!m) continue;
    const mult = hazardMultiplier(a.health, gamma);
    const p = conditionalFailure(m.fit, a.ageHours, horizon, mult);
    const band = bands.get(a.assetClass)!(a.ageHours, mult);
    out.push({
      asset: a.asset,
      assetClass: a.assetClass,
      ageHours: round(a.ageHours, 0),
      hazardMultiplier: round(mult, 4),
      pFail: round(p, 5),
      pFailLow: round(Math.min(p, p * band.low), 5),
      pFailHigh: round(Math.min(1, Math.max(p, p * band.high)), 5),
      rulDays: round(remainingLife(m.fit, a.ageHours, mult, 0.5) / HOURS_PER_DAY, 1),
      rulDaysP10: round(remainingLife(m.fit, a.ageHours, mult, 0.9) / HOURS_PER_DAY, 1),
      rulDaysP90: round(remainingLife(m.fit, a.ageHours, mult, 0.1) / HOURS_PER_DAY, 1),
      distribution: m.fit.distribution,
    });
  }
  return out;
}

export interface Maintainability {
  assetClass: string;
  failures: number;
  exposureHours: number;
  mtbfHours: number;
  repairs: number;
  mttrHours: number;
  /** Inherent availability MTBF / (MTBF + MTTR), %. */
  availabilityPct: number;
}

/** MTBF from life-history exposure, MTTR from completed corrective work orders. */
export function maintainability(history: Array<LifeSample & { assetClass: string }>, repairs: Array<{ assetClass: string; hours: number }>): Maintainability[] {
  const classes = new Set([...history.map((h) => h.assetClass), ...repairs.map((r) => r.assetClass)]);
  const out: Maintainability[] = [];
  for (const c of classes) {
    const h = history.filter((x) => x.assetClass === c);
    const failures = h.filter((x) => x.failed).length;
    const exposure = h.reduce((a, x) => a + x.hours, 0);
    const rep = repairs.filter((r) => r.assetClass === c && r.hours > 0);
    const mtbf = failures ? exposure / failures : NaN;
    const mttr = rep.length ? rep.reduce((a, r) => a + r.hours, 0) / rep.length : NaN;
    out.push({
      assetClass: c,
      failures,
      exposureHours: round(exposure, 0),
      mtbfHours: round(mtbf, 1),
      repairs: rep.length,
      mttrHours: round(mttr, 2),
      availabilityPct: Number.isFinite(mtbf) && Number.isFinite(mttr) ? round((mtbf / (mtbf + mttr)) * 100, 4) : NaN,
    });
  }
  return out.sort((a, b) => a.assetClass.localeCompare(b.assetClass));
}
