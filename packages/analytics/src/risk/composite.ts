/**
 * Composite asset risk = probability of failure × consequence.
 *
 * Consequence is money: lost generation (rated MW × capacity factor × outage hours × tariff) plus the repair cost,
 * with an optional safety weight. Expected loss ranks the portfolio; a 0–100 priority score maps it onto the
 * governed risk bands. Amounts are rounded to minor units; storage keeps them as numeric, never float.
 */
import { round } from "../math/stats.ts";

export interface RiskInput {
  asset: string;
  plant: string;
  assetClass: string;
  ratedMw: number;
  pFail: number;
  /** Hours the asset's output is lost if it fails (repair time plus part lead time). */
  outageHours: number;
  capacityFactor: number;
  /** Tariff per MWh in the asset's currency. */
  tariffPerMwh: number;
  repairCost: number;
  currency: string;
  /** 1–5 severity of a failure for people (1 = none). */
  safetySeverity?: number;
}

export interface RiskScore {
  asset: string;
  plant: string;
  assetClass: string;
  pFail: number;
  energyAtRiskMwh: number;
  consequence: number;
  expectedLoss: number;
  currency: string;
  score: number;
  band: RiskBand;
  rank: number;
}

export type RiskBand = "CRITICAL" | "HIGH" | "MEDIUM" | "WATCH" | "LOW";

/** Governed band thresholds on the 0–100 score (policy parameters). */
export const DEFAULT_BANDS: Array<[RiskBand, number]> = [["CRITICAL", 80], ["HIGH", 60], ["MEDIUM", 40], ["WATCH", 20], ["LOW", 0]];

export function scoreRisk(inputs: RiskInput[], opts: { bands?: Array<[RiskBand, number]>; safetyWeight?: number; scale?: number } = {}): RiskScore[] {
  const bands = opts.bands ?? DEFAULT_BANDS;
  const sw = opts.safetyWeight ?? 0.25;
  const rows = inputs.map((r) => {
    const energy = Math.max(0, r.ratedMw * r.capacityFactor * r.outageHours);
    const safety = 1 + sw * Math.max(0, (r.safetySeverity ?? 1) - 1);
    const consequence = (energy * r.tariffPerMwh + r.repairCost) * safety;
    return { r, energy, consequence, el: r.pFail * consequence };
  });
  // Score saturates smoothly: 100·(1 − 2^(−EL/half)), with half chosen so an expected loss equal to the scale
  // scores 80 (the critical threshold). The scale is the portfolio's 95th-percentile expected loss unless governed.
  const sorted = rows.map((x) => x.el).sort((a, b) => a - b);
  const scale = opts.scale ?? (sorted[Math.floor(sorted.length * 0.95)] || 1);
  const half = scale / Math.log2(5);
  const out = rows.map(({ r, energy, consequence, el }) => {
    const score = round(100 * (1 - 2 ** (-el / half)), 2);
    const band = bands.find(([, t]) => score >= t)?.[0] ?? "LOW";
    return { asset: r.asset, plant: r.plant, assetClass: r.assetClass, pFail: r.pFail, energyAtRiskMwh: round(energy, 3), consequence: round(consequence, 2), expectedLoss: round(el, 2), currency: r.currency, score, band, rank: 0 };
  });
  out.sort((a, b) => b.expectedLoss - a.expectedLoss);
  out.forEach((x, i) => (x.rank = i + 1));
  return out;
}
