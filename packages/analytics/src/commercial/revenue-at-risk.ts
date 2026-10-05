/**
 * Monte Carlo revenue at risk per plant over the forecast horizon.
 *
 * Each interval's output is drawn from its forecast distribution (split-normal through q10/q50/q90, clipped to
 * [0, capacity]). Errors are correlated within a day through a common factor (ρ), as cloud regimes persist.
 * Asset failures are added as Bernoulli outages using each asset's failure probability scaled to the horizon.
 * Revenue = energy × tariff. Results: expected revenue, percentiles, and revenue at risk = P50 − 5th percentile.
 */
import { Rng } from "../math/rng.ts";
import { mean, quantile, round } from "../math/stats.ts";

export interface IntervalForecast {
  at: string;
  q10: number;
  q50: number;
  q90: number;
  capacityMw: number;
}

export interface OutageRisk {
  asset: string;
  ratedMw: number;
  /** Failure probability over the horizon. */
  pFail: number;
  outageHours: number;
}

export interface RevenueAtRiskInput {
  plant: string;
  intervals: IntervalForecast[];
  intervalMinutes: number;
  tariffPerMwh: number;
  currency: string;
  outages?: OutageRisk[];
}

export interface RevenueAtRisk {
  plant: string;
  currency: string;
  simulations: number;
  expectedEnergyMwh: number;
  energyP50Mwh: number;
  /** Energy exceeded with 90 % probability (the 10th percentile of simulated energy). */
  energyP90Mwh: number;
  expectedRevenue: number;
  revenueP50: number;
  revenueP90: number;
  revenue5th: number;
  /** P50 revenue minus the 5th percentile (95 % one-sided value at risk). */
  revenueAtRisk95: number;
  /** Mean shortfall below P50 in the worst 5 % of outcomes (expected shortfall). */
  expectedShortfall95: number;
  /** Expected revenue lost to asset failures. */
  expectedOutageLoss: number;
}

const Z90 = 1.2815515655446004;

function draw(f: IntervalForecast, z: number): number {
  const lo = (f.q50 - f.q10) / Z90;
  const hi = (f.q90 - f.q50) / Z90;
  const v = f.q50 + z * (z < 0 ? lo : hi);
  return Math.min(f.capacityMw, Math.max(0, v));
}

export function revenueAtRisk(input: RevenueAtRiskInput, opts: { simulations?: number; rho?: number; seed?: number } = {}): RevenueAtRisk {
  const n = opts.simulations ?? 2000;
  const rho = opts.rho ?? 0.6;
  const rng = new Rng(opts.seed ?? 4242);
  const h = input.intervalMinutes / 60;
  const days = [...new Set(input.intervals.map((i) => i.at.slice(0, 10)))];
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const energies: number[] = [];
  const outageLosses: number[] = [];
  const horizonHours = input.intervals.length * h;
  const meanCf = mean(input.intervals.map((i) => (i.capacityMw > 0 ? i.q50 / i.capacityMw : 0)));
  for (let s = 0; s < n; s++) {
    const common = days.map(() => rng.normal());
    let e = 0;
    for (const f of input.intervals) {
      if (f.q90 <= 0) continue;
      const z = Math.sqrt(rho) * common[dayIndex.get(f.at.slice(0, 10))!]! + Math.sqrt(1 - rho) * rng.normal();
      e += draw(f, z) * h;
    }
    let lost = 0;
    for (const o of input.outages ?? []) if (rng.next() < o.pFail) lost += o.ratedMw * meanCf * Math.min(o.outageHours, horizonHours);
    energies.push(Math.max(0, e - lost));
    outageLosses.push(lost);
  }
  const rev = energies.map((e) => e * input.tariffPerMwh);
  const p50 = quantile(rev, 0.5);
  const p05 = quantile(rev, 0.05);
  const tail = rev.filter((r) => r <= p05);
  return {
    plant: input.plant,
    currency: input.currency,
    simulations: n,
    expectedEnergyMwh: round(mean(energies), 2),
    energyP50Mwh: round(quantile(energies, 0.5), 2),
    energyP90Mwh: round(quantile(energies, 0.1), 2),
    expectedRevenue: round(mean(rev), 2),
    revenueP50: round(p50, 2),
    revenueP90: round(quantile(rev, 0.1), 2),
    revenue5th: round(p05, 2),
    revenueAtRisk95: round(p50 - p05, 2),
    expectedShortfall95: round(tail.length ? p50 - mean(tail) : 0, 2),
    expectedOutageLoss: round(mean(outageLosses) * input.tariffPerMwh, 2),
  };
}

/** Probability over `days` from a probability over `baseDays`, assuming a constant hazard within the window. */
export const scaleProbability = (p: number, baseDays: number, days: number) => 1 - (1 - Math.min(0.999999, Math.max(0, p))) ** (days / baseDays);

