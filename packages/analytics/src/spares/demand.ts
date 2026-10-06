/**
 * Intermittent spare-part demand and stocking policy.
 *
 * Croston, SBA (Syntetos–Boylan) and TSB (Teunter–Syntetos–Babai) are fitted on daily demand and compared on a
 * time-ordered holdout against the mean; the best rate (units/day) drives a reorder point over the lead time:
 * ROP = rate·L + z·σ_d·√L, with z from the service level the part's criticality calls for.
 */
import { mean, normInv, round, std } from "../math/stats.ts";

export type Method = "croston" | "sba" | "tsb" | "mean";

export function croston(y: number[], alpha: number, variant: "croston" | "sba" = "croston"): number {
  const sizes = y.filter((v) => v > 0);
  if (!sizes.length) return 0;
  // Initialise at the series averages (mean size, mean interval) rather than the first observation, which biases
  // the interval low when demand happens to start on the first day.
  let z = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  let p = y.length / sizes.length;
  let q = 1;
  for (const v of y) {
    if (v > 0) {
      z += alpha * (v - z);
      p += alpha * (q - p);
      q = 1;
    } else q++;
  }
  return (variant === "sba" ? 1 - alpha / 2 : 1) * (z / p);
}

export function tsb(y: number[], alpha: number, beta: number): number {
  let prob: number | null = null;
  let size: number | null = null;
  for (const v of y) {
    const d = v > 0 ? 1 : 0;
    prob = prob === null ? d : prob + beta * (d - prob);
    if (v > 0) size = size === null ? v : size + alpha * (v - size);
  }
  return (prob ?? 0) * (size ?? 0);
}

export interface DemandModel {
  part: string;
  method: Method;
  /** Expected units per day. */
  rate: number;
  holdoutMae: Record<Method, number>;
  demandDays: number;
  observedDays: number;
  sigmaPerDay: number;
}

const METHODS: Array<[Method, (y: number[]) => number]> = [
  ["croston", (y) => croston(y, 0.1)],
  ["sba", (y) => croston(y, 0.1, "sba")],
  ["tsb", (y) => tsb(y, 0.1, 0.05)],
  ["mean", (y) => mean(y)],
];

/** Chooses the method with the lowest mean absolute error of cumulative demand over the holdout window. */
export function fitDemand(part: string, daily: number[], holdoutShare = 0.3): DemandModel {
  const cut = Math.max(1, Math.floor(daily.length * (1 - holdoutShare)));
  const train = daily.slice(0, cut);
  const test = daily.slice(cut);
  const mae = {} as Record<Method, number>;
  for (const [m, f] of METHODS) {
    const rate = f(train);
    let cum = 0;
    let err = 0;
    test.forEach((v, i) => {
      cum += v;
      err += Math.abs(cum - rate * (i + 1));
    });
    mae[m] = test.length ? round(err / test.length, 4) : 0;
  }
  const best = METHODS.map(([m]) => m).sort((a, b) => mae[a] - mae[b])[0]!;
  const rate = METHODS.find(([m]) => m === best)![1](daily);
  return { part, method: best, rate: round(rate, 6), holdoutMae: mae, demandDays: daily.filter((v) => v > 0).length, observedDays: daily.length, sigmaPerDay: round(std(daily), 6) };
}

export const SERVICE_LEVEL: Record<string, number> = { CRITICAL: 0.99, HIGH: 0.975, MEDIUM: 0.95, LOW: 0.9 };

export interface StockPolicy {
  part: string;
  site: string;
  leadTimeDays: number;
  serviceLevel: number;
  reorderPoint: number;
  orderUpTo: number;
  position: number;
  /** Units to order now (0 when the stock position is above the reorder point). */
  recommendedOrder: number;
  daysOfCover: number | null;
}

export function stockPolicy(m: DemandModel, site: string, position: number, leadTimeDays: number, criticality: string | null, reviewDays = 30): StockPolicy {
  const sl = SERVICE_LEVEL[criticality ?? "MEDIUM"] ?? 0.95;
  const z = normInv(sl);
  const rop = m.rate * leadTimeDays + z * m.sigmaPerDay * Math.sqrt(Math.max(1, leadTimeDays));
  const s = rop + m.rate * reviewDays;
  const reorderPoint = Math.ceil(rop - 1e-9);
  const orderUpTo = Math.max(reorderPoint, Math.ceil(s - 1e-9));
  return {
    part: m.part,
    site,
    leadTimeDays,
    serviceLevel: sl,
    reorderPoint,
    orderUpTo,
    position,
    recommendedOrder: position <= reorderPoint ? Math.max(0, orderUpTo - position) : 0,
    daysOfCover: m.rate > 0 ? round(position / m.rate, 1) : null,
  };
}
