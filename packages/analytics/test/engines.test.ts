import { describe, expect, it } from "vitest";
import {
  Rng,
  bLife,
  conditionalFailure,
  croston,
  cusum,
  detectInverterAnomalies,
  fitDemand,
  fitGeneration,
  fitIsolationForest,
  fitLife,
  fitWeibull,
  forecastBess,
  gbmFit,
  gbmPredict,
  hazardMultiplier,
  isolationScore,
  mean,
  nelderMead,
  normCdf,
  normInv,
  planAt,
  quantile,
  remainingLife,
  revenueAtRisk,
  scoreRisk,
  stockPolicy,
  survival,
  type GenerationObservation,
  type InverterReading,
  type LifeSample,
} from "../src/index.ts";

describe("numerical core", () => {
  it("is reproducible from its seed", () => {
    const a = new Rng(1);
    const b = new Rng(1);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
    const r = new Rng(3);
    const xs = Array.from({ length: 20000 }, () => r.normal());
    expect(Math.abs(mean(xs))).toBeLessThan(0.03);
    expect(Math.abs(quantile(xs, 0.9) - 1.2816)).toBeLessThan(0.05);
  });

  it("inverts the normal distribution", () => {
    for (const p of [0.001, 0.05, 0.5, 0.9, 0.999]) expect(normCdf(normInv(p))).toBeCloseTo(p, 6);
  });

  it("minimises the Rosenbrock function", () => {
    const r = nelderMead(([x, y]) => (1 - x!) ** 2 + 100 * (y! - x! * x!) ** 2, [-1.2, 1], { tol: 1e-14 });
    expect(r.x[0]).toBeCloseTo(1, 3);
    expect(r.x[1]).toBeCloseTo(1, 3);
  });

  it("boosted trees learn a step, and quantile loss brackets the noise", () => {
    const rng = new Rng(5);
    const x = Array.from({ length: 3000 }, () => [rng.next() * 10]);
    const y = x.map(([v]) => (v! > 5 ? 3 : 0) + rng.normal());
    const m = gbmFit(x, y, ["x"], { trees: 80 });
    expect(gbmPredict(m, [8])).toBeCloseTo(3, 0);
    expect(gbmPredict(m, [2])).toBeCloseTo(0, 0);
    const q90 = gbmFit(x, y, ["x"], { trees: 80, loss: 0.9 });
    const covered = x.filter(([v], i) => y[i]! <= gbmPredict(q90, [v!])).length / x.length;
    expect(covered).toBeGreaterThan(0.86);
    expect(covered).toBeLessThan(0.94);
  });
});

describe("life-data analysis", () => {
  const simulate = (n: number, beta: number, eta: number, censorAt: number, seed = 9): LifeSample[] => {
    const rng = new Rng(seed);
    return Array.from({ length: n }, () => {
      const t = eta * (-Math.log(1 - rng.next())) ** (1 / beta);
      const c = censorAt * (0.5 + rng.next());
      return t <= c ? { hours: t, failed: true } : { hours: c, failed: false };
    });
  };

  it("recovers Weibull parameters from right-censored data", () => {
    const f = fitWeibull(simulate(3000, 2.5, 40000, 40000));
    expect(f.params.beta! / 2.5).toBeGreaterThan(0.93);
    expect(f.params.beta! / 2.5).toBeLessThan(1.07);
    expect(f.params.eta! / 40000).toBeGreaterThan(0.95);
    expect(f.params.eta! / 40000).toBeLessThan(1.05);
  });

  it("chooses Weibull for wear-out data and the exponential for random failures", () => {
    expect(fitLife(simulate(2000, 3, 1000, 1200))[0]!.distribution).toBe("weibull");
    const exp = fitLife(simulate(2000, 1, 1000, 1500, 21));
    // With β = 1 the exponential is the same model with one parameter fewer, so AICc prefers it or ties.
    const w = exp.find((f) => f.distribution === "weibull")!;
    const e = exp.find((f) => f.distribution === "exponential")!;
    expect(e.aicc).toBeLessThan(w.aicc + 2);
  });

  it("keeps conditional failure, remaining life and B-life consistent", () => {
    const f = fitWeibull(simulate(2000, 2, 1000, 1500));
    const age = 800;
    const rul = remainingLife(f, age);
    expect(survival(f, age + rul) / survival(f, age)).toBeCloseTo(0.5, 6);
    expect(conditionalFailure(f, age, rul)).toBeCloseTo(0.5, 6);
    expect(1 - survival(f, bLife(f, 0.1))).toBeCloseTo(0.1, 6);
    // Worse condition → higher failure probability and shorter life.
    expect(conditionalFailure(f, age, 100, hazardMultiplier(40, 2))).toBeGreaterThan(conditionalFailure(f, age, 100, hazardMultiplier(95, 2)));
    expect(remainingLife(f, age, hazardMultiplier(40, 2))).toBeLessThan(rul);
    expect(hazardMultiplier(null, 2)).toBe(1);
  });
});

describe("probabilistic generation forecast", () => {
  const synth = (seed: number): GenerationObservation[] => {
    const rng = new Rng(seed);
    const out: GenerationObservation[] = [];
    for (let day = 0; day < 40; day++) {
      for (let q = 24; q < 76; q++) {
        const hour = q / 4;
        const physics = 100 * Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
        // The physics chain over-predicts in the afternoon (soiling + heat) and is noisier at long lead times.
        const lead = (q % 48) + 1;
        const actual = Math.max(0, physics * (hour > 13 ? 0.93 : 1.0) + rng.normal() * (1 + lead / 24));
        out.push({ plant: "P1", at: `2026-07-${String(1 + (day % 28)).padStart(2, "0")}T${String(Math.floor(hour)).padStart(2, "0")}:${String((q % 4) * 15).padStart(2, "0")}:00`.replace(/^2026-07-(\d\d)/, (_, d) => `2026-${day < 28 ? "07" : "08"}-${d}`), leadHours: lead, physicsMw: physics, actualMw: actual, capacityMw: 120 });
      }
    }
    return out;
  };

  it("beats the physics baseline and calibrates q10–q90 to about 80 % on unseen data", () => {
    const fit = fitGeneration(synth(1));
    expect(fit.metrics.hybridNmaePct).toBeLessThan(fit.metrics.physicsNmaePct * 0.7);
    expect(fit.metrics.coveragePct).toBeGreaterThan(74);
    expect(fit.metrics.coveragePct).toBeLessThan(86);
    for (const q of fit.test) {
      expect(q.q10).toBeLessThanOrEqual(q.q50);
      expect(q.q50).toBeLessThanOrEqual(q.q90);
      expect(q.q10).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("anomaly detection", () => {
  it("isolates outliers faster than inliers", () => {
    const rng = new Rng(2);
    const x = Array.from({ length: 500 }, () => [rng.normal(), rng.normal()]);
    const f = fitIsolationForest(x, ["a", "b"]);
    expect(isolationScore(f, [6, 6])).toBeGreaterThan(0.65);
    expect(isolationScore(f, [0, 0])).toBeLessThan(0.5);
  });

  it("flags an inverter that under-produces against its fleet, and explains why", () => {
    const rng = new Rng(4);
    const readings: InverterReading[] = [];
    for (let t = 0; t < 32; t++) {
      const sun = Math.max(0, Math.sin(((t + 2) / 36) * Math.PI));
      for (let i = 0; i < 40; i++) {
        const fault = i === 7 ? 0.8 : 1;
        const ac = 2.5 * sun * fault * (1 + rng.normal() * 0.01);
        readings.push({ at: `2026-08-19T${String(6 + Math.floor(t / 4)).padStart(2, "0")}:${String((t % 4) * 15).padStart(2, "0")}:00`, plant: "P1", asset: `INV-${i}`, acMw: ac, dcMw: ac / 0.98, dcVoltage: 1100 + rng.normal() * 5, tempC: 40 + rng.normal(), ratingMw: 2.5 });
      }
    }
    const scored = detectInverterAnomalies(readings);
    const top = scored[0]!;
    expect(top.asset).toBe("INV-7");
    expect(top.anomalous).toBe(true);
    expect(top.drivers[0]!.feature).toBe("yield_ratio");
    expect(top.lostEnergyMwh).toBeGreaterThan(0);
    expect(scored.filter((s) => s.anomalous).length).toBeLessThanOrEqual(3);
  });

  it("detects a sustained shift quickly and stays quiet on noise", () => {
    const rng = new Rng(8);
    const noise = Array.from({ length: 60 }, (_, i) => ({ at: `D${String(i).padStart(3, "0")}`, residual: rng.normal() * 0.01 }));
    expect(cusum("P", noise)).toEqual([]);
    const shifted = noise.map((p, i) => ({ ...p, residual: p.residual + (i >= 40 ? -0.03 : 0) }));
    const alarms = cusum("P", shifted);
    expect(alarms).toHaveLength(1);
    expect(alarms[0]!.direction).toBe("under");
    expect(Number(alarms[0]!.alarmAt.slice(1))).toBeLessThan(48);
    expect(alarms[0]!.shift).toBeLessThan(-0.02);
    expect(Number(alarms[0]!.onset.slice(1))).toBeGreaterThanOrEqual(38);
  });
});

describe("BESS state of health", () => {
  const plan = Array.from({ length: 15 }, (_, i) => ({ year: i + 1, retentionPct: 100 - 2.2 * (i + 1) }));
  it("follows the plan when the tests do, and flags faster fade against the guarantee", () => {
    const onPlan = forecastBess([{ bess: "B1", commissioned: "2024-01-01", plan, tests: [{ date: "2025-01-01", sohPct: 97.8 }], dailyEfc: [1, 1], guaranteedYear10Pct: 75, cycleLimit: 6000, warrantyEnd: "2034-01-01" }], { asOf: "2026-01-01", priorWeight: 0 })[0]!;
    expect(onPlan.fadeRatio).toBeCloseTo(1, 2);
    expect(onPlan.sohYear10Pct).toBeCloseTo(planAt(plan, 10), 1);
    expect(onPlan.projectedCyclesAtWarrantyEnd).toBeGreaterThan(3600);
    const fast = forecastBess([{ bess: "B2", commissioned: "2024-01-01", plan, tests: [{ date: "2025-01-01", sohPct: 96 }], dailyEfc: [], guaranteedYear10Pct: 75 }], { asOf: "2026-01-01", priorWeight: 0 })[0]!;
    expect(fast.fadeRatio).toBeGreaterThan(1.7);
    expect(fast.marginYear10Pct).toBeLessThan(0);
  });
});

describe("risk, revenue and spares", () => {
  it("ranks by expected loss and maps the 95th percentile to the critical threshold", () => {
    const inputs = Array.from({ length: 100 }, (_, i) => ({ asset: `A${i}`, plant: "P", assetClass: "INVERTER", ratedMw: 2.5, pFail: i / 1000, outageHours: 72, capacityFactor: 0.25, tariffPerMwh: 2650, repairCost: 80000, currency: "INR" }));
    const r = scoreRisk(inputs);
    expect(r[0]!.asset).toBe("A99");
    expect(r.find((x) => x.asset === "A95")!.score).toBeCloseTo(80, 0);
    expect(r.filter((x) => x.band === "CRITICAL").length).toBeLessThanOrEqual(6);
    expect(r.at(-1)!.band).toBe("LOW");
  });

  it("simulates revenue reproducibly with ordered percentiles", () => {
    const intervals = Array.from({ length: 96 * 3 }, (_, i) => {
      const s = Math.max(0, Math.sin(((i % 96) / 96) * 2 * Math.PI - Math.PI / 2)) * 100;
      return { at: `2026-08-2${Math.floor(i / 96)}T00:00:00`, q10: s * 0.9, q50: s, q90: s * 1.08, capacityMw: 120 };
    });
    const input = { plant: "P", intervals, intervalMinutes: 15, tariffPerMwh: 2650, currency: "INR", outages: [{ asset: "A", ratedMw: 10, pFail: 0.5, outageHours: 24 }] };
    const a = revenueAtRisk(input, { simulations: 500 });
    expect(revenueAtRisk(input, { simulations: 500 })).toEqual(a);
    expect(a.energyP90Mwh).toBeLessThan(a.energyP50Mwh);
    expect(a.revenueAtRisk95).toBeGreaterThan(0);
    expect(a.expectedOutageLoss).toBeGreaterThan(0);
  });

  it("forecasts intermittent demand and orders only below the reorder point", () => {
    const daily = Array.from({ length: 200 }, (_, i) => (i % 20 === 0 ? 2 : 0));
    expect(croston(daily, 0.1)).toBeCloseTo(0.1, 2);
    const m = fitDemand("PRT-1", daily);
    expect(m.rate).toBeGreaterThan(0.05);
    expect(m.rate).toBeLessThan(0.15);
    const low = stockPolicy(m, "S1", 0, 30, "CRITICAL");
    expect(low.recommendedOrder).toBe(low.orderUpTo);
    const high = stockPolicy(m, "S1", 50, 30, "CRITICAL");
    expect(high.recommendedOrder).toBe(0);
    expect(stockPolicy(m, "S1", 0, 30, "CRITICAL").reorderPoint).toBeGreaterThanOrEqual(stockPolicy(m, "S1", 0, 30, "LOW").reorderPoint);
  });
});

describe("database vocabulary resolver", () => {
  it("resolves codes, labels and aliases, exact first, then case-insensitive", async () => {
    const { referenceResolver } = await import("../src/vocabulary.ts");
    const r = referenceResolver(
      [{ table: "asset_class", code: "SCB", label: "String Combiner Box" }, { table: "status", scope: "work_order", code: "OPEN", label: "Open" }],
      [{ table: "asset_class", alias: "String/Combiner", code: "SCB" }],
    );
    expect(r("asset_class", "String/Combiner")).toBe("SCB");
    expect(r("asset_class", "string combiner box")).toBe("SCB");
    expect(r("asset_class", "SCB")).toBe("SCB");
    expect(r("status", "Open", "work_order")).toBe("OPEN");
    expect(r("status", "Open")).toBeNull();
    expect(r("asset_class", "Flux")).toBeNull();
  });
});
