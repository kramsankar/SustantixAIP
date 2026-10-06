import { describe, expect, it } from "vitest";
import { DatasetsChanged, loadDatasets, type DatasetFetch, type DatasetManifest } from "../src/dataset-loader.ts";
import { splitDataset, type Json } from "../src/dataset-parts.ts";

/** Serves datasets the way the host does: frames in the manifest, rows in blocks grouped into chunks. */
function host(datasets: Record<string, Json>, blockRows = 2, chunkBlocks = 2) {
  const frames: Record<string, Json> = {};
  const blocks: DatasetManifest["blocks"] = [];
  const rows: Json[][] = [];
  for (const [id, value] of Object.entries(datasets)) {
    const split = splitDataset(value);
    frames[id] = split.frame;
    for (const t of split.tables)
      for (let i = 0; i < t.rows.length; i += blockRows) {
        blocks.push([id, t.part, i, Math.min(blockRows, t.rows.length - i)]);
        rows.push(t.rows.slice(i, i + blockRows));
      }
  }
  const chunks = Array.from({ length: Math.ceil(blocks.length / chunkBlocks) }, (_, c) => blocks.map((_, i) => i).slice(c * chunkBlocks, (c + 1) * chunkBlocks));
  return { manifest: { version: "v1", frames, blocks, chunks } satisfies DatasetManifest, rows };
}

const DATA: Record<string, Json> = {
  "00000000000000aa": { label: "A", sheets: { "Work Orders": [{ Z: 1, A: "x" }, { Z: 2, A: "y" }, { Z: 3, A: "z" }], Sites: [{ Id: "S1" }] } },
  "00000000000000bb": [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]],
  "00000000000000cc": { note: "frame only", list: [1, 2, 3] },
};

describe("database-only dataset loading", () => {
  it("rebuilds every dataset exactly, whatever order the chunks arrive in", async () => {
    const h = host(DATA);
    const fetcher: DatasetFetch = {
      manifest: async () => h.manifest,
      chunk: async (version, index) => {
        // Later chunks answer first.
        await new Promise((r) => setTimeout(r, (h.manifest.chunks.length - index) * 3));
        return { version, blocks: h.manifest.chunks[index]!.map((b) => h.rows[b]!) };
      },
    };
    const seen: Array<[number, number]> = [];
    const got = await loadDatasets(fetcher, (d, t) => seen.push([d, t]), 3);
    for (const [id, value] of Object.entries(DATA)) expect(got.get(id)).toBe(JSON.stringify(value));
    expect(seen[0]).toEqual([0, h.manifest.chunks.length]);
    expect(seen.at(-1)).toEqual([h.manifest.chunks.length, h.manifest.chunks.length]);
  });

  it("starts again once when the data changes while it loads, then fails if it keeps changing", async () => {
    const h = host(DATA);
    let manifests = 0;
    const once: DatasetFetch = {
      manifest: async () => (manifests++, h.manifest),
      chunk: async (version, index) => {
        if (manifests === 1 && index === 1) throw new DatasetsChanged();
        return { version, blocks: h.manifest.chunks[index]!.map((b) => h.rows[b]!) };
      },
    };
    expect((await loadDatasets(once)).get("00000000000000bb")).toBe(JSON.stringify(DATA["00000000000000bb"]));
    expect(manifests).toBe(2);
    const always: DatasetFetch = { manifest: async () => h.manifest, chunk: async () => ({ version: "v2", blocks: [] }) };
    await expect(loadDatasets(always)).rejects.toBeInstanceOf(DatasetsChanged);
  });

  it("refuses a block with the wrong number of rows, and passes other failures through", async () => {
    const h = host(DATA);
    const short: DatasetFetch = { manifest: async () => h.manifest, chunk: async (version, index) => ({ version, blocks: h.manifest.chunks[index]!.map(() => []) }) };
    await expect(loadDatasets(short)).rejects.toBeInstanceOf(DatasetsChanged);
    const down: DatasetFetch = { manifest: async () => { throw new Error("service unavailable"); }, chunk: async () => ({ version: "", blocks: [] }) };
    await expect(loadDatasets(down)).rejects.toThrow("service unavailable");
  });
});
