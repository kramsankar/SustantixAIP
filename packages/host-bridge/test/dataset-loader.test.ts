import { describe, expect, it } from "vitest";
import { DatasetsChanged, loadDatasets, type DatasetFetch, type DatasetManifest } from "../src/dataset-loader.ts";
import type { Json } from "../src/dataset-parts.ts";

/** A host holding a small catalogue: one plain sheet, one family sheet, one governed sheet, blocks of two rows. */
function host() {
  const crew: Json[] = [{ Z: 1, A: "x" }, { Z: 2, A: "y" }, { Z: 3, A: "z" }];
  const scenarios: Json[] = [{ s: 1 }, { s: 2 }, { s: 3 }];
  const sheets: Record<string, Json[]> = { "Crew Assignments": crew, "Alternatives · scenarios": scenarios };
  const blocks: DatasetManifest["blocks"] = [];
  const rows: Json[][] = [];
  for (const [name, all] of Object.entries(sheets))
    for (let i = 0; i < all.length; i += 2) {
      blocks.push([name, i, Math.min(2, all.length - i)]);
      rows.push(all.slice(i, i + 2));
    }
  const manifest: DatasetManifest = {
    version: "v1",
    layouts: {
      "00000000000000aa": { label: "A", crew: { $aipSheet: "Crew Assignments" }, wo: { $aipGoverned: "Work Orders", columns: ["Status", "WO_ID"] } },
      "00000000000000bb": { "DEC-1": { scenarios: { $aipSheet: "Alternatives · scenarios", group: "DEC-1" } }, "DEC-2": { scenarios: { $aipSheet: "Alternatives · scenarios", group: "DEC-2" } } },
    },
    sheets: { "Crew Assignments": { rows: 3 }, "Alternatives · scenarios": { rows: 3, groups: [["DEC-1", 0, 2], ["DEC-2", 2, 1]] } },
    blocks,
    chunks: blocks.map((_, i) => i).reduce<number[][]>((acc, i) => (i % 2 ? acc[acc.length - 1]!.push(i) : acc.push([i]), acc), []),
  };
  const governed = { "Work Orders": [{ WO_ID: "WO-1", Cost: 5, Status: "Open" }] as Json[] };
  return { manifest, rows, governed };
}

const want = {
  "00000000000000aa": '{"label":"A","crew":[{"Z":1,"A":"x"},{"Z":2,"A":"y"},{"Z":3,"A":"z"}],"wo":[{"Status":"Open","WO_ID":"WO-1"}]}',
  "00000000000000bb": '{"DEC-1":{"scenarios":[{"s":1},{"s":2}]},"DEC-2":{"scenarios":[{"s":3}]}}',
};

describe("database-only dataset loading", () => {
  it("rebuilds every dataset from its layout, whatever order the chunks arrive in", async () => {
    const h = host();
    const fetcher: DatasetFetch = {
      manifest: async () => h.manifest,
      governed: async () => h.governed,
      chunk: async (version, index) => {
        await new Promise((r) => setTimeout(r, (h.manifest.chunks.length - index) * 3));
        return { version, blocks: h.manifest.chunks[index]!.map((b) => h.rows[b]!) };
      },
    };
    const seen: Array<[number, number]> = [];
    const got = await loadDatasets(fetcher, (d, t) => seen.push([d, t]), 3);
    expect(Object.fromEntries(got)).toEqual(want);
    expect(seen[0]).toEqual([0, h.manifest.chunks.length]);
    expect(seen.at(-1)).toEqual([h.manifest.chunks.length, h.manifest.chunks.length]);
  });

  it("starts again once when the data changes while it loads, then fails if it keeps changing", async () => {
    const h = host();
    let manifests = 0;
    const once: DatasetFetch = {
      manifest: async () => (manifests++, h.manifest),
      governed: async () => h.governed,
      chunk: async (version, index) => {
        if (manifests === 1 && index === 1) throw new DatasetsChanged();
        return { version, blocks: h.manifest.chunks[index]!.map((b) => h.rows[b]!) };
      },
    };
    expect((await loadDatasets(once)).get("00000000000000bb")).toBe(want["00000000000000bb"]);
    expect(manifests).toBe(2);
    const always: DatasetFetch = { manifest: async () => h.manifest, governed: async () => h.governed, chunk: async () => ({ version: "v2", blocks: [] }) };
    await expect(loadDatasets(always)).rejects.toBeInstanceOf(DatasetsChanged);
  });

  it("refuses a block with the wrong number of rows, a missing governed sheet, and passes other failures through", async () => {
    const h = host();
    const short: DatasetFetch = { manifest: async () => h.manifest, governed: async () => h.governed, chunk: async (version, index) => ({ version, blocks: h.manifest.chunks[index]!.map(() => []) }) };
    await expect(loadDatasets(short)).rejects.toBeInstanceOf(DatasetsChanged);
    const noGoverned: DatasetFetch = { manifest: async () => h.manifest, governed: async () => ({}), chunk: async (version, index) => ({ version, blocks: h.manifest.chunks[index]!.map((b) => h.rows[b]!) }) };
    await expect(loadDatasets(noGoverned)).rejects.toThrow(/governed sheet "Work Orders" was not loaded/);
    const down: DatasetFetch = { manifest: async () => { throw new Error("service unavailable"); }, governed: async () => h.governed, chunk: async () => ({ version: "", blocks: [] }) };
    await expect(loadDatasets(down)).rejects.toThrow("service unavailable");
  });
});
