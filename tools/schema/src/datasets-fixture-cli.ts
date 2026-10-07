/**
 * Writes the runtime catalogue exactly as the host serves it (datasets manifest, chunk answers) and the governed
 * workbook its layouts refer to, for testing the database-only runtime without a database:
 *   tsx src/datasets-fixture-cli.ts <out-dir>   → manifest.json, chunk-<n>.json, governed.json
 * Same catalogue, blocks and chunk plan as the seed and the API (runtime-catalogue.ts, datasets-sql.ts,
 * apps/web/lib/datasets.ts).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chunkPlan, datasetsVersion, type BlockMeta } from "../../../apps/web/lib/datasets.ts";
import { governedWorkbook } from "./compat.ts";
import { loadCorrections } from "./corrections.ts";
import { BLOCK_BYTES, blocksOf } from "./datasets-sql.ts";
import { buildMasters } from "./masters.ts";
import { loadVocabulary } from "./reference.ts";
import type { Registry } from "./registry.ts";
import { readSheets } from "./rows.ts";
import { buildCatalogue } from "./runtime-catalogue.ts";
import { runtimeDatasets } from "./runtime-catalogue-cli.ts";
import { GOVERNED_MAX_ROWS } from "./workbook-format.ts";

const out = process.argv[2];
if (!out) throw new Error("usage: tsx src/datasets-fixture-cli.ts <out-dir>");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const tenant = "00000000-0000-0000-0000-0000000000c1";

const reg = JSON.parse(readFileSync(join(root, "schema/aip-data-model.json"), "utf8")) as Registry;
const raw = readSheets(readFileSync(join(root, "reference/AIP_Data_v915.xlsx")));
const vocab = loadVocabulary(root);
const corrections = loadCorrections(root);
const g = governedWorkbook(reg, raw, buildMasters(reg, raw, vocab, corrections), vocab, corrections, { maxRows: GOVERNED_MAX_ROWS });
const columns: Record<string, string[]> = {};
for (const [sheet, rows] of Object.entries(g.sheets)) {
  const cols = new Set<string>();
  for (const r of rows as Array<Record<string, unknown>>) for (const k of Object.keys(r)) cols.add(k);
  if (cols.size) columns[sheet] = [...cols];
}
const c = buildCatalogue(runtimeDatasets(root), columns);

// The database lists sheets and blocks by name and first ordinal (bytewise for these keys); so does this.
const byte = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sheets = [...c.sheets].sort((a, b) => byte(a.name, b.name));
const blocks: Array<BlockMeta & { text: string }> = [];
for (const s of sheets) for (const b of blocksOf(s.rows, BLOCK_BYTES)) blocks.push({ sheet: s.name, first: b.first, rows: b.count, bytes: b.text.length, text: b.text });
const stamps = c.datasets.map((d) => ({ dataset: d.id, updatedAt: "2026-10-10T00:00:00Z" }));
const version = datasetsVersion(tenant, stamps, blocks);
const chunks = chunkPlan(blocks);

mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, "manifest.json"),
  JSON.stringify({
    version,
    layouts: Object.fromEntries([...c.datasets].sort((a, b) => byte(a.id, b.id)).map((d) => [d.id, d.layout])),
    sheets: Object.fromEntries(sheets.map((s) => [s.name, { rows: s.rows.length, ...(s.groups ? { groups: s.groups.map((x) => [x.key, x.first, x.count]) } : {}) }])),
    blocks: blocks.map((b) => [b.sheet, b.first, b.rows]),
    chunks,
  }),
);
chunks.forEach((ch, i) => writeFileSync(join(out, `chunk-${i}.json`), `{"version":${JSON.stringify(version)},"blocks":[${ch.map((j) => blocks[j]!.text).join(",")}]}`));
writeFileSync(join(out, "governed.json"), JSON.stringify(g));
console.log(`datasets fixture: ${c.datasets.length} layouts, ${sheets.length} sheets, ${blocks.length} blocks, ${chunks.length} chunks, ${Object.keys(g.sheets).length} governed sheets → ${out}`);
