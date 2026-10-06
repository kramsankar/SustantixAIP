/**
 * Probabilistic solar generation forecast (hybrid physics + machine learning).
 *
 * The physics chain (clear sky → weather → availability → curtailment → asset state) supplies the baseline.
 * Gradient-boosted trees learn its residual, normalised by plant capacity, from lead time, time of day and the
 * physics level itself: a squared-loss model for q50 and pinball-loss models for q10 and q90. Split conformal
 * calibration (conformalised quantile regression) then widens or narrows the band so that, on data the model has
 * not seen, q10–q90 really covers 80 % of outcomes. Everything is evaluated on a time-ordered holdout.
 *
 * Naming: qNN is the NN-th percentile of output. In energy-yield language the exceedance values are the mirror
 * image: P90 (exceeded 90 % of the time) = q10, P50 = q50, P10 = q90.
 */
import { gbmFit, gbmImportance, gbmPredict, type GbmModel, type GbmOptions } from "../math/gbm.ts";
import { clamp, mean, pinball, quantile, round } from "../math/stats.ts";

export interface GenerationObservation {
  plant: string;
  /** Interval start, ISO local time (plant wall clock). */
  at: string;
  leadHours: number;
  physicsMw: number;
  actualMw: number;
  capacityMw: number;
}

export type GenerationInput = Omit<GenerationObservation, "actualMw">;

export interface GenerationQuantiles {
  plant: string;
  at: string;
  leadHours: number;
  physicsMw: number;
  q10: number;
  q50: number;
  q90: number;
}

export interface GenerationMetrics {
  samples: number;
  /** Mean absolute error as % of capacity (daylight intervals). */
  physicsNmaePct: number;
  hybridNmaePct: number;
  improvementPct: number;
  hybridRmseMw: number;
  biasMw: number;
  /** Share of outcomes inside q10–q90 (target 80 %). */
  coveragePct: number;
  meanBandPctOfCapacity: number;
  pinballQ10: number;
  pinballQ50: number;
  pinballQ90: number;
  /** Benchmark: the workbook's own hybrid forecast on the same intervals, when supplied. */
  benchmarkNmaePct?: number;
}

export interface GenerationModel {
  q50: GbmModel;
  q10: GbmModel;
  q90: GbmModel;
  /** Conformal adjustment (fraction of capacity) added outside the raw q10–q90. */
  conformal: number;
  nominalCoverage: number;
  trainedOn: { from: string; to: string; samples: number };
  importance: Record<string, number>;
}

export const FEATURES = ["physics_frac", "lead_hours", "hour_sin", "hour_cos", "capacity_mw"] as const;

const DAYLIGHT = (o: { physicsMw: number; actualMw?: number }) => o.physicsMw > 0 || (o.actualMw ?? 0) > 0;

function features(o: GenerationInput): number[] {
  const hhmm = /T?(\d{2}):(\d{2})/.exec(o.at.slice(10));
  const hour = hhmm ? Number(hhmm[1]) + Number(hhmm[2]) / 60 : 12;
  return [o.physicsMw / o.capacityMw, o.leadHours, Math.sin((2 * Math.PI * hour) / 24), Math.cos((2 * Math.PI * hour) / 24), o.capacityMw];
}

export interface FitOptions {
  /** Time-ordered fractions: train, calibration (rest is test). */
  split: [number, number];
  nominalCoverage: number;
  gbm: Partial<GbmOptions>;
}

export const FIT_DEFAULTS: FitOptions = { split: [0.6, 0.15], nominalCoverage: 0.8, gbm: {} };

export interface GenerationFit {
  model: GenerationModel;
  metrics: GenerationMetrics;
  test: GenerationQuantiles[];
}

/** Fits the residual models on the earliest data, calibrates on the next slice and evaluates on the latest. */
export function fitGeneration(history: GenerationObservation[], opts: Partial<FitOptions> = {}, benchmark?: Map<string, number>): GenerationFit {
  const o = { ...FIT_DEFAULTS, ...opts };
  const rows = history.filter((h) => h.capacityMw > 0 && DAYLIGHT(h)).sort((a, b) => a.at.localeCompare(b.at) || a.plant.localeCompare(b.plant));
  if (rows.length < 200) throw new Error(`generation forecast: ${rows.length} daylight observations; at least 200 are needed`);
  const nTrain = Math.floor(rows.length * o.split[0]);
  const nCal = Math.floor(rows.length * o.split[1]);
  const train = rows.slice(0, nTrain);
  const cal = rows.slice(nTrain, nTrain + nCal);
  const test = rows.slice(nTrain + nCal);
  const X = train.map(features);
  const r = train.map((h) => (h.actualMw - h.physicsMw) / h.capacityMw);
  const names = [...FEATURES];
  const alpha = (1 - o.nominalCoverage) / 2;
  const q50 = gbmFit(X, r, names, { ...o.gbm, loss: "squared", seed: 11 });
  const q10 = gbmFit(X, r, names, { ...o.gbm, loss: alpha, seed: 13 });
  const q90 = gbmFit(X, r, names, { ...o.gbm, loss: 1 - alpha, seed: 17 });
  // Conformal step: nonconformity = how far outside the raw band each calibration outcome falls.
  const scores = cal.map((h) => {
    const x = features(h);
    const y = (h.actualMw - h.physicsMw) / h.capacityMw;
    return Math.max(gbmPredict(q10, x) - y, y - gbmPredict(q90, x));
  });
  const level = Math.min(1, (Math.ceil((cal.length + 1) * o.nominalCoverage) / cal.length));
  const conformal = quantile(scores, level);
  const model: GenerationModel = {
    q50, q10, q90, conformal, nominalCoverage: o.nominalCoverage,
    trainedOn: { from: train[0]!.at, to: train[train.length - 1]!.at, samples: train.length },
    importance: gbmImportance(q50),
  };
  const preds = predictGeneration(model, test);
  return { model, metrics: evaluate(test, preds, benchmark), test: preds };
}

export function predictGeneration(m: GenerationModel, inputs: GenerationInput[]): GenerationQuantiles[] {
  return inputs.map((o) => {
    if (o.capacityMw <= 0 || o.physicsMw <= 0) return { plant: o.plant, at: o.at, leadHours: o.leadHours, physicsMw: o.physicsMw, q10: 0, q50: 0, q90: 0 };
    const x = features(o);
    const fix = (frac: number) => clamp(o.physicsMw + frac * o.capacityMw, 0, o.capacityMw);
    const lo = gbmPredict(m.q10, x) - m.conformal;
    const hi = gbmPredict(m.q90, x) + m.conformal;
    const mid = gbmPredict(m.q50, x);
    const q50 = fix(mid);
    return { plant: o.plant, at: o.at, leadHours: o.leadHours, physicsMw: o.physicsMw, q10: Math.min(fix(lo), q50), q50, q90: Math.max(fix(hi), q50) };
  });
}

function evaluate(obs: GenerationObservation[], q: GenerationQuantiles[], benchmark?: Map<string, number>): GenerationMetrics {
  const n = obs.length;
  const cap = obs.map((o) => o.capacityMw);
  const ae = (pred: (i: number) => number) => mean(obs.map((o, i) => Math.abs(o.actualMw - pred(i)) / cap[i]!)) * 100;
  const physics = ae((i) => obs[i]!.physicsMw);
  const hybrid = ae((i) => q[i]!.q50);
  const bench = benchmark ? obs.map((o, i) => [benchmark.get(`${o.plant}|${o.at}`), i] as const).filter(([b]) => b !== undefined) : [];
  return {
    samples: n,
    physicsNmaePct: round(physics, 3),
    hybridNmaePct: round(hybrid, 3),
    improvementPct: round(((physics - hybrid) / physics) * 100, 2),
    hybridRmseMw: round(Math.sqrt(mean(obs.map((o, i) => (o.actualMw - q[i]!.q50) ** 2))), 3),
    biasMw: round(mean(obs.map((o, i) => q[i]!.q50 - o.actualMw)), 3),
    coveragePct: round((obs.filter((o, i) => o.actualMw >= q[i]!.q10 && o.actualMw <= q[i]!.q90).length / n) * 100, 2),
    meanBandPctOfCapacity: round(mean(obs.map((o, i) => (q[i]!.q90 - q[i]!.q10) / cap[i]!)) * 100, 3),
    pinballQ10: round(mean(obs.map((o, i) => pinball(o.actualMw, q[i]!.q10, 0.1))), 4),
    pinballQ50: round(mean(obs.map((o, i) => pinball(o.actualMw, q[i]!.q50, 0.5))), 4),
    pinballQ90: round(mean(obs.map((o, i) => pinball(o.actualMw, q[i]!.q90, 0.9))), 4),
    ...(bench.length ? { benchmarkNmaePct: round(mean(bench.map(([b, i]) => Math.abs(obs[i]!.actualMw - b!) / cap[i]!)) * 100, 3) } : {}),
  };
}

export interface EnergySummary {
  plant: string;
  intervals: number;
  physicsMwh: number;
  q10Mwh: number;
  q50Mwh: number;
  q90Mwh: number;
}

/**
 * Energy per plant over the forecast horizon. q10/q90 are summed interval quantiles, which assumes errors move
 * together across intervals (a conservative, wide band); the revenue-at-risk engine simulates the joint spread.
 */
export function energySummary(q: GenerationQuantiles[], intervalMinutes = 15): EnergySummary[] {
  const h = intervalMinutes / 60;
  const by = new Map<string, EnergySummary>();
  for (const x of q) {
    const s = by.get(x.plant) ?? by.set(x.plant, { plant: x.plant, intervals: 0, physicsMwh: 0, q10Mwh: 0, q50Mwh: 0, q90Mwh: 0 }).get(x.plant)!;
    s.intervals++;
    s.physicsMwh += x.physicsMw * h;
    s.q10Mwh += x.q10 * h;
    s.q50Mwh += x.q50 * h;
    s.q90Mwh += x.q90 * h;
  }
  return [...by.values()].map((s) => ({ ...s, physicsMwh: round(s.physicsMwh, 2), q10Mwh: round(s.q10Mwh, 2), q50Mwh: round(s.q50Mwh, 2), q90Mwh: round(s.q90Mwh, 2) }));
}
