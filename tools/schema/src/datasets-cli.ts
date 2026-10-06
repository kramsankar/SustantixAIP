/**
 * Writes the runtime datasets exactly as the database serves them (manifest and chunk answers), for testing the
 * database-only runtime without a database:
 *   tsx src/datasets-cli.ts <out-dir>      → <out-dir>/manifest.json, <out-dir>/chunk-<n>.json
 * Same split, same blocks and same chunk plan as the seed and the API (datasets-sql.ts, apps/web/lib/datasets.ts).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitDataset, type Json } from "../../../packages/host-bridge/src/dataset-parts.ts";
import { chunkPlan, datasetsVersion, type BlockMeta } from "../../../apps/web/lib/datasets.ts";
import { blocksOf, FRAME_PART } from "./datasets-sql.ts";
import { runtimeDatasets } from "./seed-sql.ts";

const out = process.argv[2];
if (!out) throw new Error("usage: tsx src/datasets-cli.ts <out-dir>");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const tenant = "00000000-0000-0000-0000-0000000000c1";
const frames: Array<{ dataset: string; frame: Json; updatedAt: string }> = [];
const blocks: Array<BlockMeta & { rowsText: string }> = [];
for (const { id, value } of runtimeDatasets(root)) {
  const { frame, tables } = splitDataset(value);
  frames.push({ dataset: id, frame, updatedAt: "2026-10-09T00:00:00Z" });
  for (const t of tables) for (const b of blocksOf(t.rows, 256_000)) blocks.push({ dataset: id, part: t.part, first: b.first, rows: b.count, bytes: b.text.length, rowsText: b.text });
}
// The database orders blocks by dataset, part and first ordinal (bytewise for these ASCII keys); so does this.
const byte = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
blocks.sort((a, b) => byte(a.dataset, b.dataset) || byte(a.part, b.part) || a.first - b.first);
frames.sort((a, b) => byte(a.dataset, b.dataset));
const version = datasetsVersion(tenant, frames, blocks);
const chunks = chunkPlan(blocks);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "manifest.json"), JSON.stringify({ version, frames: Object.fromEntries(frames.map((f) => [f.dataset, f.frame])), blocks: blocks.map((b) => [b.dataset, b.part, b.first, b.rows]), chunks }));
chunks.forEach((c, i) => writeFileSync(join(out, `chunk-${i}.json`), `{"version":${JSON.stringify(version)},"blocks":[${c.map((j) => blocks[j]!.rowsText).join(",")}]}`));
console.log(`datasets: ${frames.length} datasets, ${blocks.length} blocks, ${chunks.length} chunks (frame part ${FRAME_PART}) → ${out}`);
