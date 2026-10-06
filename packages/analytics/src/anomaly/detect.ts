/**
 * Equipment anomaly detection.
 *
 * Inverters: each inverter is compared with its plant's fleet at the same timestamp (specific yield, conversion
 * efficiency, temperature rise, DC voltage), so weather and curtailment cancel out. Daily feature vectors feed an
 * Isolation Forest; the features furthest from the fleet explain each score.
 *
 * Plants: a two-sided tabular CUSUM on the daylight performance residual (actual vs weather-adjusted expected)
 * flags sustained drift (soiling, degradation, a lost string) rather than single noisy intervals.
 */
import { fitIsolationForest, isolationScore } from "./isolation-forest.ts";
import { mean, median, quantile, round, std } from "../math/stats.ts";

export interface InverterReading {
  at: string;
  plant: string;
  asset: string;
  acMw: number;
  dcMw: number;
  dcVoltage: number | null;
  tempC: number | null;
  /** Rated AC power (MW) from the inverter configuration. */
  ratingMw: number;
  status?: string | null;
}

export interface InverterAnomaly {
  asset: string;
  plant: string;
  score: number;
  /** Score rank within the run, 1 = most anomalous. */
  rank: number;
  anomalous: boolean;
  /** Feature deviations from the plant fleet (robust z-scores), largest first. */
  drivers: Array<{ feature: string; z: number }>;
  intervals: number;
  lostEnergyMwh: number;
}

export const INVERTER_FEATURES = ["yield_ratio", "efficiency_delta", "temp_rise", "voltage_ratio", "downtime_share"] as const;

/** Robust z: deviation from the median in units of the scaled MAD. */
const robustZ = (v: number, xs: number[]) => {
  const m = median(xs);
  const mad = median(xs.map((x) => Math.abs(x - m))) * 1.4826;
  return mad > 1e-9 ? (v - m) / mad : 0;
};

export function detectInverterAnomalies(readings: InverterReading[], opts: { threshold?: number; intervalMinutes?: number; seed?: number } = {}): InverterAnomaly[] {
  const threshold = opts.threshold ?? 0.6;
  const h = (opts.intervalMinutes ?? 15) / 60;
  const daylight = readings.filter((r) => r.ratingMw > 0);
  // Fleet reference per plant and timestamp.
  const fleet = new Map<string, InverterReading[]>();
  for (const r of daylight) (fleet.get(`${r.plant}|${r.at}`) ?? fleet.set(`${r.plant}|${r.at}`, []).get(`${r.plant}|${r.at}`)!).push(r);
  const perAsset = new Map<string, { plant: string; ratio: number[]; eff: number[]; temp: number[]; volt: number[]; down: number; n: number; lost: number }>();
  for (const [, group] of fleet) {
    const producing = group.filter((g) => g.acMw > 0);
    if (producing.length < Math.max(3, group.length / 2)) continue; // night or plant-wide outage: no reference
    const sy = producing.map((g) => g.acMw / g.ratingMw);
    const syMed = median(sy);
    const eff = producing.filter((g) => g.dcMw > 0).map((g) => g.acMw / g.dcMw);
    const effMed = median(eff);
    const temps = producing.map((g) => g.tempC).filter((t): t is number => t !== null);
    const tMed = temps.length ? median(temps) : 0;
    const volts = producing.map((g) => g.dcVoltage).filter((v): v is number => v !== null && v > 0);
    const vMed = volts.length ? median(volts) : 0;
    for (const g of group) {
      const a = perAsset.get(g.asset) ?? perAsset.set(g.asset, { plant: g.plant, ratio: [], eff: [], temp: [], volt: [], down: 0, n: 0, lost: 0 }).get(g.asset)!;
      a.n++;
      const ratio = g.acMw / g.ratingMw / (syMed || 1);
      a.ratio.push(ratio);
      if (g.acMw <= 0) a.down++;
      if (g.dcMw > 0 && effMed > 0) a.eff.push(g.acMw / g.dcMw - effMed);
      if (g.tempC !== null && temps.length) a.temp.push(g.tempC - tMed);
      if (g.dcVoltage !== null && g.dcVoltage > 0 && vMed > 0) a.volt.push(g.dcVoltage / vMed);
      a.lost += Math.max(0, syMed * g.ratingMw - g.acMw) * h;
    }
  }
  const assets = [...perAsset.entries()].filter(([, a]) => a.n >= 4);
  if (assets.length < 8) return [];
  const vectors = assets.map(([, a]) => [mean(a.ratio), a.eff.length ? mean(a.eff) : 0, a.temp.length ? mean(a.temp) : 0, a.volt.length ? mean(a.volt) : 1, a.down / a.n]);
  const forest = fitIsolationForest(vectors, [...INVERTER_FEATURES], { seed: opts.seed ?? 101 });
  const cols = INVERTER_FEATURES.map((_, f) => vectors.map((v) => v[f]!));
  const scored = assets.map(([asset, a], i) => {
    const v = vectors[i]!;
    const drivers = INVERTER_FEATURES.map((feature, f) => ({ feature, z: round(robustZ(v[f]!, cols[f]!), 2) }))
      .filter((d) => Math.abs(d.z) >= 2)
      .sort((x, y) => Math.abs(y.z) - Math.abs(x.z));
    return { asset, plant: a.plant, score: round(isolationScore(forest, v), 4), rank: 0, anomalous: false, drivers, intervals: a.n, lostEnergyMwh: round(a.lost, 3) };
  });
  scored.sort((x, y) => y.score - x.score);
  scored.forEach((s, i) => {
    s.rank = i + 1;
    // Anomalous = isolated quickly and measurably different from the fleet on at least one feature.
    s.anomalous = s.score >= threshold && s.drivers.length > 0;
  });
  return scored;
}

export interface CusumPoint {
  at: string;
  /** Observed / expected − 1 (performance residual). */
  residual: number;
}

export interface DriftAlarm {
  plant: string;
  direction: "under" | "over";
  /** First interval of the sustained shift and the interval the alarm fired. */
  onset: string;
  alarmAt: string;
  /** Mean residual since onset minus the plant's baseline residual (e.g. −0.04 = 4 points worse than usual). */
  shift: number;
  /** Mean residual since onset (the level the plant is running at). */
  level: number;
}

/**
 * Tabular CUSUM with allowance k and decision interval h, both in units of the residual's in-control standard
 * deviation. The first `baseline` points estimate the in-control mean and spread; monitoring starts after them. Defaults k = 0.5σ, h = 5σ detect a 1σ shift quickly
 * with a low false-alarm rate.
 */
export function cusum(plant: string, series: CusumPoint[], opts: { k?: number; h?: number; baseline?: number } = {}): DriftAlarm[] {
  const pts = series.filter((p) => Number.isFinite(p.residual)).sort((a, b) => a.at.localeCompare(b.at));
  const nb = Math.min(pts.length, opts.baseline ?? Math.max(7, Math.floor(pts.length / 3)));
  if (nb < 5) return [];
  // Phase I: the in-control level and spread come from the baseline window; phase II monitors what follows.
  const base = pts.slice(0, nb).map((p) => p.residual);
  const mu = mean(base);
  const sigma = std(base) || quantile(base.map((x) => Math.abs(x - mu)), 0.5) * 1.4826 || 1e-6;
  const k = (opts.k ?? 0.5) * sigma;
  const h = (opts.h ?? 5) * sigma;
  // One alarm per episode: after an alarm the statistic keeps accumulating, and a new alarm in the same direction
  // needs it to return to zero first (the shift ended). Onset and size are estimated when the episode closes
  // (or the series ends), with every point of the episode as evidence.
  const episodes: Array<{ dir: "over" | "under"; start: number; alarm: number; end: number }> = [];
  const open: Record<"over" | "under", { start: number; alarm: number } | null> = { over: null, under: null };
  const st = { over: 0, under: 0 };
  const runStart = { over: nb, under: nb };
  for (let i = nb; i < pts.length; i++) {
    const x = pts[i]!.residual - mu;
    for (const dir of ["over", "under"] as const) {
      if (st[dir] === 0) {
        runStart[dir] = i;
        const e = open[dir];
        if (e) { episodes.push({ dir, start: e.start, alarm: e.alarm, end: i - 1 }); open[dir] = null; }
      }
      st[dir] = Math.max(0, st[dir] + (dir === "over" ? x : -x) - k);
      if (st[dir] > h && !open[dir]) open[dir] = { start: runStart[dir], alarm: i };
    }
  }
  for (const dir of ["over", "under"] as const) if (open[dir]) episodes.push({ dir, ...open[dir]!, end: pts.length - 1 });
  const alarms: DriftAlarm[] = episodes
    .sort((a, b) => a.alarm - b.alarm)
    .map((e) => {
      // Maximum-likelihood change point for a mean shift within the episode: argmax over τ of (n−τ)·(x̄_τ − μ)².
      let tau = e.start;
      let best = -1;
      let acc = 0;
      for (let t = e.end; t >= e.start; t--) {
        acc += pts[t]!.residual - mu;
        const stat = (acc * acc) / (e.end - t + 1);
        if (stat > best && (e.dir === "over" ? acc > 0 : acc < 0)) { best = stat; tau = t; }
      }
      const level = mean(pts.slice(tau, e.end + 1).map((p) => p.residual));
      return { plant, direction: e.dir, onset: pts[tau]!.at, alarmAt: pts[e.alarm]!.at, shift: round(level - mu, 4), level: round(level, 4) };
    });
  return alarms;
}
