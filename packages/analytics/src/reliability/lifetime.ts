/**
 * Life-data analysis with right censoring: Weibull (profile maximum likelihood), lognormal and exponential fits,
 * model choice by AICc, and conditional reliability for assets that have survived to their current age.
 */
import { nelderMead } from "../math/optimize.ts";
import { Rng } from "../math/rng.ts";
import { normCdf, normInv, quantile } from "../math/stats.ts";

export interface LifeSample {
  /** Operating hours at failure or at the last observation. */
  hours: number;
  failed: boolean;
}

export type Distribution = "weibull" | "lognormal" | "exponential";

export interface LifeFit {
  distribution: Distribution;
  /** Weibull: beta (shape), eta (scale, h). Lognormal: mu, sigma (log h). Exponential: lambda (1/h). */
  params: Record<string, number>;
  n: number;
  failures: number;
  logLik: number;
  aicc: number;
}

const LN_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);

function aicc(logLik: number, k: number, n: number): number {
  return -2 * logLik + 2 * k + (n - k - 1 > 0 ? (2 * k * (k + 1)) / (n - k - 1) : Infinity);
}

/** Weibull MLE: for a given shape the scale has a closed form, so only the shape is searched (golden section on ln β). */
export function fitWeibull(data: LifeSample[]): LifeFit {
  const xs = data.filter((d) => d.hours > 0);
  const r = xs.filter((d) => d.failed).length;
  if (r < 2) throw new Error(`weibull: ${r} failure(s); at least 2 are needed`);
  const scale = Math.max(...xs.map((d) => d.hours));
  const t = xs.map((d) => d.hours / scale);
  const sumLogFail = xs.reduce((a, d, i) => a + (d.failed ? Math.log(t[i]!) : 0), 0);
  const profile = (beta: number) => {
    const s = t.reduce((a, v) => a + v ** beta, 0);
    const eta = (s / r) ** (1 / beta);
    return { eta, ll: r * Math.log(beta) - r * beta * Math.log(eta) + (beta - 1) * sumLogFail - s / eta ** beta };
  };
  let a = Math.log(0.05);
  let b = Math.log(30);
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  for (let i = 0; i < 200 && b - a > 1e-10; i++) {
    if (profile(Math.exp(c)).ll > profile(Math.exp(d)).ll) b = d;
    else a = c;
    c = b - g * (b - a);
    d = a + g * (b - a);
  }
  const beta = Math.exp((a + b) / 2);
  const { eta, ll } = profile(beta);
  // Undo the time scaling: log-likelihood of densities shifts by -r·ln(scale).
  const logLik = ll - r * Math.log(scale);
  return { distribution: "weibull", params: { beta, eta: eta * scale }, n: xs.length, failures: r, logLik, aicc: aicc(logLik, 2, xs.length) };
}

export function fitExponential(data: LifeSample[]): LifeFit {
  const xs = data.filter((d) => d.hours > 0);
  const r = xs.filter((d) => d.failed).length;
  if (r < 1) throw new Error("exponential: no failures");
  const total = xs.reduce((a, d) => a + d.hours, 0);
  const lambda = r / total;
  const logLik = r * Math.log(lambda) - lambda * total;
  return { distribution: "exponential", params: { lambda }, n: xs.length, failures: r, logLik, aicc: aicc(logLik, 1, xs.length) };
}

export function fitLognormal(data: LifeSample[]): LifeFit {
  const xs = data.filter((d) => d.hours > 0);
  const r = xs.filter((d) => d.failed).length;
  if (r < 2) throw new Error("lognormal: at least 2 failures are needed");
  const logs = xs.map((d) => Math.log(d.hours));
  const fl = logs.filter((_, i) => xs[i]!.failed);
  const mu0 = fl.reduce((a, b) => a + b, 0) / fl.length;
  const s0 = Math.max(0.3, Math.sqrt(fl.reduce((a, v) => a + (v - mu0) ** 2, 0) / Math.max(1, fl.length - 1)));
  const negLl = ([mu, ls]: number[]) => {
    const sigma = Math.exp(ls!);
    let ll = 0;
    for (let i = 0; i < xs.length; i++) {
      const z = (logs[i]! - mu!) / sigma;
      ll += xs[i]!.failed ? -LN_SQRT_2PI - Math.log(sigma) - logs[i]! - 0.5 * z * z : Math.log(Math.max(1e-300, 1 - normCdf(z)));
    }
    return -ll;
  };
  const best = nelderMead(negLl, [mu0 + 0.5, Math.log(s0)], { tol: 1e-12 });
  const logLik = -best.f;
  return { distribution: "lognormal", params: { mu: best.x[0]!, sigma: Math.exp(best.x[1]!) }, n: xs.length, failures: r, logLik, aicc: aicc(logLik, 2, xs.length) };
}

/** Fits every candidate distribution and returns them best (lowest AICc) first. */
export function fitLife(data: LifeSample[]): LifeFit[] {
  const fits: LifeFit[] = [];
  for (const f of [fitWeibull, fitLognormal, fitExponential]) {
    try {
      fits.push(f(data));
    } catch {
      // Too few failures for this family: it simply does not compete.
    }
  }
  if (!fits.length) throw new Error("life data: no distribution could be fitted");
  return fits.sort((a, b) => a.aicc - b.aicc);
}

/** Survival probability R(t). */
export function survival(f: LifeFit, hours: number): number {
  if (hours <= 0) return 1;
  switch (f.distribution) {
    case "weibull":
      return Math.exp(-((hours / f.params.eta!) ** f.params.beta!));
    case "exponential":
      return Math.exp(-f.params.lambda! * hours);
    case "lognormal":
      return 1 - normCdf((Math.log(hours) - f.params.mu!) / f.params.sigma!);
  }
}

/**
 * Probability of failure within the next `horizon` hours for an item that has survived `age` hours, with a
 * proportional-hazards multiplier (1 = the population, >1 = worse condition than the population).
 */
export function conditionalFailure(f: LifeFit, age: number, horizon: number, hazardMultiplier = 1): number {
  const r0 = survival(f, age);
  if (r0 <= 1e-12) return 1;
  return 1 - (survival(f, age + horizon) / r0) ** hazardMultiplier;
}

/** Remaining life (h) at which the conditional survival falls to `p` (median: p = 0.5). */
export function remainingLife(f: LifeFit, age: number, hazardMultiplier = 1, p = 0.5): number {
  const target = Math.log(p) / hazardMultiplier; // ln R(age+x)/R(age) = target
  const r0 = Math.log(Math.max(1e-300, survival(f, age)));
  let lo = 0;
  let hi = Math.max(1, age);
  while (Math.log(Math.max(1e-300, survival(f, age + hi))) - r0 > target && hi < 1e9) hi *= 2;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (Math.log(Math.max(1e-300, survival(f, age + mid))) - r0 > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Life by which a fraction q of the population has failed (B10: q = 0.1). */
export function bLife(f: LifeFit, q: number): number {
  switch (f.distribution) {
    case "weibull":
      return f.params.eta! * (-Math.log(1 - q)) ** (1 / f.params.beta!);
    case "exponential":
      return -Math.log(1 - q) / f.params.lambda!;
    case "lognormal":
      return Math.exp(f.params.mu! + f.params.sigma! * normInv(q));
  }
}

/** Parametric-free bootstrap: refits the chosen family on resampled data to give an interval for any statistic. */
export function bootstrap(data: LifeSample[], family: Distribution, stat: (f: LifeFit) => number, replicates = 200, seed = 29): { q05: number; q50: number; q95: number } {
  const rng = new Rng(seed);
  const fit = family === "weibull" ? fitWeibull : family === "lognormal" ? fitLognormal : fitExponential;
  const out: number[] = [];
  for (let b = 0; b < replicates; b++) {
    const sample = data.map(() => data[rng.int(data.length)]!);
    try {
      out.push(stat(fit(sample)));
    } catch {
      // A resample with too few failures carries no information about the statistic.
    }
  }
  return { q05: quantile(out, 0.05), q50: quantile(out, 0.5), q95: quantile(out, 0.95) };
}
