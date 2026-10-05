/**
 * Writes the governed workbook (the tenant view of the governed data in the runtime's own shape) built from the
 * workbook, for the governed-mode parity crawl.
 *   tsx src/governed-cli.ts <out.json> [--max-rows 5000]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { governedWorkbook } from "./compat.ts";
import { loadCorrections } from "./corrections.ts";
import { buildMasters } from "./masters.ts";
import { loadVocabulary } from "./reference.ts";
import type { Registry } from "./registry.ts";
import { readSheets } from "./rows.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = process.argv[2];
if (!out) throw new Error("usage: governed-cli <out.json> [--max-rows n]");
const i = process.argv.indexOf("--max-rows");
const reg = JSON.parse(readFileSync(join(root, "schema/aip-data-model.json"), "utf8")) as Registry;
const raw = readSheets(readFileSync(join(root, "reference/AIP_Data_v915.xlsx")));
const vocab = loadVocabulary(root);
const corrections = loadCorrections(root);
const g = governedWorkbook(reg, raw, buildMasters(reg, raw, vocab, corrections), vocab, corrections, { maxRows: i > 0 ? Number(process.argv[i + 1]) : 5000 });
writeFileSync(out, JSON.stringify(g));
console.log(`governed workbook: ${Object.keys(g.sheets).length} sheets (${g.omitted.length} large sheets left to the bundled data) → ${out}`);
