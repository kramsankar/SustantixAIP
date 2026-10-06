/**
 * Battery state-of-health forecast, relative to the manufacturer's degradation plan.
 *
 * The plan gives expected retention by operating year. Each capacity test measures how much faster or slower the
 * battery is fading than planned: k = (100 − SoH_measured) / (100 − plan(t)). k is shrunk towards the fleet
 * average in proportion to how many tests a battery has (one annual test is weak evidence), and the forecast is
 * SoH(t) = 100 − k · (100 − plan(t)). Cycle use is projected from recent daily equivalent full cycles.
 */
import { mean, round } from "../math/stats.ts";

export interface PlanPoint {
  year: number;
  retentionPct: number;
  cumulativeCycles?: number | null;
}

export interface CapacityTest {
  date: string;
  sohPct: number;
}

export interface BessInput {
  bess: string;
  commissioned: string;
  plan: PlanPoint[];
  tests: CapacityTest[];
  /** Recent equivalent full cycles per day (e.g. last 30 days). */
  dailyEfc: number[];
  /** Guaranteed retention at year 10 and at end of warranty, and the warranty cycle limit. */
  guaranteedYear10Pct?: number | null;
  guaranteedEolPct?: number | null;
  warrantyEnd?: string | null;
  cycleLimit?: number | null;
}

export interface BessForecast {
  bess: string;
  asOf: string;
  fadeRatio: number;
  tests: number;
  sohNowPct: number;
  sohYear10Pct: number;
  planYear10Pct: number;
  guaranteedYear10Pct: number | null;
  /** Projected minus guaranteed retention at year 10 (negative = warranty claim risk). */
  marginYear10Pct: number | null;
  /** Operating year in which SoH first falls below the end-of-life threshold, if within the plan. */
  endOfLifeYear: number | null;
  efcPerDay: number;
  projectedCyclesAtWarrantyEnd: number | null;
  cycleLimit: number | null;
  /** Year-by-year projection (operating year → SoH %). */
  trajectory: Array<{ year: number; sohPct: number; planPct: number }>;
}

const YEAR_MS = 365.25 * 86400000;
const years = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / YEAR_MS;

/** Plan retention at fractional operating year t (linear between plan points; 100 % at t = 0). */
export function planAt(plan: PlanPoint[], t: number): number {
  const pts = [{ year: 0, retentionPct: 100 }, ...plan].sort((a, b) => a.year - b.year);
  if (t <= 0) return 100;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (t <= b.year) return a.retentionPct + ((t - a.year) / (b.year - a.year)) * (b.retentionPct - a.retentionPct);
  }
  const a = pts[pts.length - 2]!;
  const b = pts[pts.length - 1]!;
  return b.retentionPct + ((t - b.year) / (b.year - a.year || 1)) * (b.retentionPct - a.retentionPct);
}

export function forecastBess(inputs: BessInput[], opts: { asOf: string; endOfLifePct?: number; priorWeight?: number }): BessForecast[] {
  const eol = opts.endOfLifePct ?? 70;
  const n0 = opts.priorWeight ?? 1;
  // Per-battery fade ratios from every test after commissioning with measurable planned fade.
  const ratios = inputs.map((b) =>
    b.tests
      .map((t) => ({ t: years(b.commissioned, t.date), soh: Math.min(100, t.sohPct) }))
      .filter((x) => x.t > 0.25 && 100 - planAt(b.plan, x.t) > 0.1)
      .map((x) => (100 - x.soh) / (100 - planAt(b.plan, x.t))),
  );
  const pooled = ratios.flat();
  const fleet = pooled.length ? mean(pooled) : 1;
  return inputs.map((b, i) => {
    const own = ratios[i]!;
    const k = Math.max(0, (own.reduce((a, x) => a + x, 0) + n0 * fleet) / (own.length + n0));
    const soh = (t: number) => 100 - k * (100 - planAt(b.plan, t));
    const now = years(b.commissioned, opts.asOf);
    const lastYear = Math.max(...b.plan.map((p) => p.year), 10);
    const trajectory = Array.from({ length: Math.ceil(lastYear) }, (_, y) => ({ year: y + 1, sohPct: round(soh(y + 1), 2), planPct: round(planAt(b.plan, y + 1), 2) }));
    const eolYear = trajectory.find((p) => p.sohPct < eol)?.year ?? null;
    const efc = b.dailyEfc.length ? mean(b.dailyEfc) : 0;
    const daysToWarrantyEnd = b.warrantyEnd ? (Date.parse(b.warrantyEnd) - Date.parse(b.commissioned)) / 86400000 : null;
    const g10 = b.guaranteedYear10Pct ?? null;
    return {
      bess: b.bess,
      asOf: opts.asOf,
      fadeRatio: round(k, 4),
      tests: own.length,
      sohNowPct: round(soh(now), 2),
      sohYear10Pct: round(soh(10), 2),
      planYear10Pct: round(planAt(b.plan, 10), 2),
      guaranteedYear10Pct: g10,
      marginYear10Pct: g10 === null ? null : round(soh(10) - g10, 2),
      endOfLifeYear: eolYear,
      efcPerDay: round(efc, 4),
      projectedCyclesAtWarrantyEnd: daysToWarrantyEnd === null ? null : Math.round(efc * daysToWarrantyEnd),
      cycleLimit: b.cycleLimit ?? null,
      trajectory,
    };
  });
}
