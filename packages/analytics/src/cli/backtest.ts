/**
 * Back-tests every AIP engine on the governed workbook, writes docs/analytics/model-report.md and exits non-zero
 * when a quality gate fails.
 *   tsx src/cli/backtest.ts [--no-write]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCorrections, loadVocabulary, readSheets, type Registry } from "@sustantix/schema";
import { workbookDataset } from "../adapters/workbook.ts";
import { detectInverterAnomalies } from "../anomaly/detect.ts";
import { forecastBess, planAt } from "../bess/degradation.ts";
import { Rng } from "../math/rng.ts";
import { mean, round } from "../math/stats.ts";
import { runPortfolio, type ModelRun } from "../portfolio.ts";
import { MODEL_CARDS } from "../registry.ts";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const reg = JSON.parse(readFileSync(join(root, "schema/aip-data-model.json"), "utf8")) as Registry;
const { dataset } = workbookDataset(reg, readSheets(readFileSync(join(root, "reference/AIP_Data_v915.xlsx"))), loadVocabulary(root), loadCorrections(root));
const runs = runPortfolio(dataset);
const run = (code: string) => runs.find((r) => r.model === code)!;

// Injected-fault recall: degrade 10 random inverters by 15 % and see how many the detector flags.
const rng = new Rng(77);
const inverters = [...new Set(dataset.inverterReadings.map((r) => r.asset))];
const baseline = new Set(detectInverterAnomalies(dataset.inverterReadings).filter((s) => s.anomalous).map((s) => s.asset));
const candidates = inverters.filter((a) => !baseline.has(a));
const injected = new Set<string>();
while (injected.size < 10) injected.add(candidates[rng.int(candidates.length)]!);
const faulty = dataset.inverterReadings.map((r) => (injected.has(r.asset) ? { ...r, acMw: r.acMw * 0.85, dcMw: r.dcMw } : r));
const flagged = new Set(detectInverterAnomalies(faulty).filter((s) => s.anomalous).map((s) => s.asset));
const recall = [...injected].filter((a) => flagged.has(a)).length / injected.size;
const falsePositives = [...flagged].filter((a) => !injected.has(a) && !baseline.has(a)).length;

// BESS: predict each battery's latest test from the fleet without that battery's tests (leave-one-out).
const loo = dataset.bess.flatMap((b) => {
  const last = [...b.tests].sort((x, y) => x.date.localeCompare(y.date)).at(-1);
  if (!last || !b.tests.length) return [];
  const others = dataset.bess.filter((x) => x.bess !== b.bess);
  const held = forecastBess([{ ...b, tests: b.tests.filter((t) => t !== last) }, ...others], { asOf: last.date, priorWeight: 1 })[0]!;
  const t = (Date.parse(last.date) - Date.parse(b.commissioned)) / (365.25 * 86400000);
  const predicted = 100 - held.fadeRatio * (100 - planAt(b.plan, t));
  return [{ bess: b.bess, actual: last.sohPct, predicted: round(predicted, 2), error: round(Math.abs(predicted - Math.min(100, last.sohPct)), 2) }];
});
const looMae = round(mean(loo.map((x) => x.error)), 3);

// Risk: Spearman rank agreement with the workbook's expert risk queue on the assets both score.
const ranks = (xs: number[]) => {
  const order = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
    for (let k = i; k <= j; k++) r[order[k]![1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
};
const expert = new Map((dataset.expertRisk ?? []).map((e) => [e.asset, e.score]));
const paired = run("AIP-RISK-1").outputs.filter((o) => expert.has(o.subject)).map((o) => [Number((o.detail as Record<string, unknown>).expectedLoss), expert.get(o.subject)!] as const);
const ra = ranks(paired.map((p) => p[0]));
const rb = ranks(paired.map((p) => p[1]));
const n = paired.length;
const spearman = n > 2 ? round(1 - (6 * ra.reduce((a, x, i) => a + (x - rb[i]!) ** 2, 0)) / (n * (n * n - 1)), 3) : NaN;
(run("AIP-RISK-1").metrics as Record<string, unknown>).spearmanVsExpertQueue = spearman;
(run("AIP-RISK-1").metrics as Record<string, unknown>).assetsCompared = n;

const gen = run("AIP-GEN-HYBRID-1").metrics as { improvementPct: number; coveragePct: number; biasMw: number };
const gates: Array<{ gate: string; value: string; pass: boolean }> = [
  { gate: "Every engine runs on the governed data", value: `${runs.filter((r) => r.status === "succeeded").length}/${runs.length}`, pass: runs.every((r) => r.status === "succeeded") },
  { gate: "Hybrid forecast improves on physics by ≥ 30 % (nMAE)", value: `${gen.improvementPct} %`, pass: gen.improvementPct >= 30 },
  { gate: "q10–q90 coverage on unseen data within 75–85 % (target 80 %)", value: `${gen.coveragePct} %`, pass: gen.coveragePct >= 75 && gen.coveragePct <= 85 },
  { gate: "Forecast bias within ±1 % of mean capacity", value: `${gen.biasMw} MW`, pass: Math.abs(gen.biasMw) <= 0.01 * mean(dataset.sites.map((s) => s.capacityMw)) },
  { gate: "Injected inverter faults found (recall ≥ 80 %)", value: `${round(recall * 100, 1)} % (${falsePositives} other new flag(s))`, pass: recall >= 0.8 },
  { gate: "BESS leave-one-out SoH error ≤ 3 percentage points", value: `${looMae} pp`, pass: looMae <= 3 },
];

const fmt = (v: unknown): string => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 4 }) : typeof v === "object" && v !== null ? Object.entries(v).map(([k, x]) => `${k}: ${fmt(x)}`).join(", ") : String(v));
const section = (r: ModelRun) => {
  const card = MODEL_CARDS.find((m) => m.code === r.model)!;
  return [
    `### ${card.name} (\`${card.code}\`)`,
    "",
    `${card.algorithm}. Validation: ${card.validation_method}.`,
    "",
    "| Metric | Value |",
    "| --- | --- |",
    ...Object.entries(r.metrics).map(([k, v]) => `| ${k} | ${fmt(v)} |`),
    `| outputs | ${r.outputs.length.toLocaleString("en-US")} |`,
    "",
  ];
};
const topRisk = run("AIP-RISK-1").outputs.slice(0, 10);
const lines = [
  "# AIP analytics — model back-test report",
  "",
  `Generated by \`pnpm --filter @sustantix/analytics backtest\` from ${reg.source} (sha256 ${reg.sourceSha256.slice(0, 12)}…), as of ${dataset.asOf}. Do not edit by hand.`,
  "",
  "The workbook data is synthetic demonstration data, so these figures show that each engine works and is calibrated, not how it will perform on a customer's plants. Every engine re-runs and re-validates on the customer's own data.",
  "",
  "## Quality gates",
  "",
  "| Gate | Value | Result |",
  "| --- | --- | --- |",
  ...gates.map((g) => `| ${g.gate} | ${g.value} | ${g.pass ? "pass" : "**FAIL**"} |`),
  "",
  "## Models",
  "",
  ...runs.flatMap(section),
  "## Validation details",
  "",
  `Injected faults: ${[...injected].sort().join(", ")}; flagged ${[...injected].filter((a) => flagged.has(a)).length} of 10.`,
  "",
  "| BESS | Latest test SoH (%) | Predicted without it (%) | Error (pp) |",
  "| --- | --- | --- | --- |",
  ...loo.map((x) => `| ${x.bess} | ${x.actual} | ${x.predicted} | ${x.error} |`),
  "",
  "Top 10 assets by expected loss:",
  "",
  "| Rank | Asset | Class | P(failure, 90 d) | Expected loss | Band |",
  "| --- | --- | --- | --- | --- | --- |",
  ...topRisk.map((o) => {
    const d = o.detail as Record<string, unknown>;
    return `| ${String(d.rank)} | ${o.subject} | ${String(run("AIP-RUL-1").outputs.find((x) => x.subject === o.subject)?.detail?.assetClass ?? "")} | ${fmt(d.pFail)} | ${fmt(d.expectedLoss)} ${String(d.currency)} | ${String(d.band)} |`;
  }),
  "",
];

if (!process.argv.includes("--no-write")) {
  mkdirSync(join(root, "docs/analytics"), { recursive: true });
  writeFileSync(join(root, "docs/analytics/model-report.md"), lines.join("\n"));
}
for (const g of gates) console.log(`${g.pass ? "pass" : "FAIL"}  ${g.gate}: ${g.value}`);
for (const r of runs.filter((x) => x.status !== "succeeded")) console.error(`${r.model}: ${r.status} ${r.message ?? ""}`);
process.exit(gates.every((g) => g.pass) ? 0 : 1);
