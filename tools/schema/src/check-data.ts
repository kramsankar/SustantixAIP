/**
 * Phase-1 data-quality gate. Validates the vocabulary, checks conformance and reference integrity
 * against the governed workbook, writes docs/data/phase1-reference-report.md, and exits non-zero on
 * any undeclared vocabulary gap, unclassified reference or failed mechanical rule.
 *   tsx src/check-data.ts [--workbook file] [--no-write]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { conformance, integrity, loadIntegrityRules, phase1Report, summarize } from "./conformance.ts";
import { applyCorrections, loadCorrections } from "./corrections.ts";
import { loadVocabulary, validateVocabulary } from "./reference.ts";
import type { Registry } from "./registry.ts";
import { readSheets } from "./rows.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const flag = (k: string) => {
  const i = process.argv.indexOf("--" + k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const reg = JSON.parse(readFileSync(join(root, "schema/aip-data-model.json"), "utf8")) as Registry;
const sheets = readSheets(readFileSync(flag("workbook") ?? join(root, "reference/AIP_Data_v915.xlsx")));
const vocab = loadVocabulary(root);
const rules = loadIntegrityRules(root);

const corrections = loadCorrections(root);
const { sheets: corrected, entries: derived } = applyCorrections(reg, sheets, corrections);
const problems = validateVocabulary(vocab, reg);
const c = conformance(reg, corrected, vocab);
const ic = integrity(reg, corrected, rules, derived);
const s = summarize(c, ic);

if (!process.argv.includes("--no-write")) {
  mkdirSync(join(root, "docs/data"), { recursive: true });
  writeFileSync(join(root, "docs/data/phase1-reference-report.md"), phase1Report(reg, vocab, rules, c, ic, corrections.corrections.map((x) => ({ ...x, records: derived.filter((d) => d.correction === x.id).length, kind: x.kind ?? "derive" }))));
}

console.log(
  `vocabulary: ${vocab.tables.length} tables · ${s.bindings} governed columns · ${s.conformingValues} conforming values · ${s.declaredGaps} awaiting decision · ${s.undeclaredGaps} undeclared`,
);
console.log(`corrections: ${corrections.corrections.map((x) => `${x.id} ${x.kind === "remap" ? "~" : "+"}${derived.filter((d) => d.correction === x.id).length} ${x.target}`).join(" · ")}`);
console.log(
  `references: ${s.referenceValues} values · ${s.resolvedDirect} direct · ${s.resolvedByCorrection} corrected · ${s.resolvedMechanical} mechanical · ${s.awaitingMerge} phase-2 merge · ${s.awaitingOwner} owner · ${s.unclassified + s.failedMechanical} unclassified`,
);
for (const p of problems) console.error(`vocabulary: ${p}`);
for (const x of c) for (const u of x.undeclared) console.error(`undeclared: ${x.column} "${u.value}" ×${u.count}`);
for (const x of ic) for (const u of x.unclassified) console.error(`unclassified: ${x.from} → ${x.to} "${u.value}" ×${u.count}`);
for (const x of ic) for (const u of x.failedMechanical) console.error(`mechanical rule failed: ${x.from} "${u.value}" ×${u.count}`);
process.exit(problems.length || s.undeclaredGaps || s.unclassified || s.failedMechanical ? 1 : 0);
