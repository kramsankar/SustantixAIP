import { describe, expect, it } from "vitest";
import { chunkPlan, datasetsChunk, datasetsManifest, datasetsVersion, type BlockMeta, type DatasetStore } from "../lib/datasets";
import { ApiError } from "../lib/http";

const T = "00000000-0000-0000-0000-00000000000a";

function store(over: Partial<{ blocks: BlockMeta[]; rows: Map<string, unknown[]>; updatedAt: string }> = {}): DatasetStore & { reads: number } {
  const blocks = over.blocks ?? [
    { dataset: "00000000000000aa", part: "/rows", first: 0, rows: 2, bytes: 1_500_000 },
    { dataset: "00000000000000aa", part: "/rows", first: 2, rows: 1, bytes: 900_000 },
    { dataset: "00000000000000bb", part: "", first: 0, rows: 1, bytes: 3_000_000 },
  ];
  const rows = over.rows ?? new Map<string, unknown[]>([
    ["00000000000000aa/rows#0", [{ z: 1, a: 1 }, { z: 2, a: 2 }]],
    ["00000000000000aa/rows#2", [{ z: 3, a: 3 }]],
    ["00000000000000bb#0", [[1, 2, 3]]],
  ]);
  const s = {
    reads: 0,
    async frames() {
      return [
        { dataset: "00000000000000aa", frame: { label: "A", rows: { $aipPart: "/rows" } }, updatedAt: over.updatedAt ?? "2026-10-06T10:00:00Z" },
        { dataset: "00000000000000bb", frame: { $aipPart: "" }, updatedAt: "2026-10-06T10:00:00Z" },
      ];
    },
    async stamps() {
      return (await s.frames()).map(({ dataset, updatedAt }) => ({ dataset, updatedAt }));
    },
    async blocks() {
      return blocks;
    },
    async read(_t: string, want: Array<Pick<BlockMeta, "dataset" | "part" | "first">>) {
      s.reads++;
      return want.map((b) => rows.get(`${b.dataset}${b.part}#${b.first}`) ?? null);
    },
  };
  return s;
}

describe("runtime datasets served from the database", () => {
  it("groups blocks into chunks within the budget, a large block alone", () => {
    expect(chunkPlan([{ bytes: 1_500_000 }, { bytes: 900_000 }, { bytes: 3_000_000 }, { bytes: 10 }])).toEqual([[0, 1], [2], [3]]);
    expect(chunkPlan([])).toEqual([]);
  });

  it("answers frames, blocks and the chunk plan under one version", async () => {
    const m = await datasetsManifest(store(), T);
    expect(m.version).toMatch(/^[0-9a-f]{24}$/);
    expect(Object.keys(m.frames)).toEqual(["00000000000000aa", "00000000000000bb"]);
    expect(m.blocks).toEqual([["00000000000000aa", "/rows", 0, 2], ["00000000000000aa", "/rows", 2, 1], ["00000000000000bb", "", 0, 1]]);
    expect(m.chunks).toEqual([[0, 1], [2]]);
  });

  it("changes version when any dataset is reloaded, or for another tenant", async () => {
    const s = store();
    const [frames, blocks] = [await s.frames(T), await s.blocks(T)];
    const v = datasetsVersion(T, frames, blocks);
    expect(datasetsVersion(T, [...frames].reverse(), blocks)).toBe(v);
    expect(datasetsVersion(T, [{ ...frames[0]!, updatedAt: "2026-10-06T11:00:00Z" }, frames[1]!], blocks)).not.toBe(v);
    expect(datasetsVersion(T, frames, [...blocks.slice(0, 2), { ...blocks[2]!, rows: 2 }])).not.toBe(v);
    expect(datasetsVersion("00000000-0000-0000-0000-00000000000b", frames, blocks)).not.toBe(v);
  });

  it("serves a chunk's blocks in plan order, keys as stored", async () => {
    const s = store();
    const { version } = await datasetsManifest(s, T);
    const c0 = await datasetsChunk(s, T, version, 0);
    expect(JSON.stringify(c0.blocks)).toBe('[[{"z":1,"a":1},{"z":2,"a":2}],[{"z":3,"a":3}]]');
    expect((await datasetsChunk(s, T, version, 1)).blocks).toEqual([[[1, 2, 3]]]);
  });

  it("refuses a stale version, an unknown chunk, and a block that no longer matches", async () => {
    const s = store();
    const { version } = await datasetsManifest(s, T);
    await expect(datasetsChunk(store({ updatedAt: "2026-10-06T12:00:00Z" }), T, version, 0)).rejects.toMatchObject({ status: 409, code: "datasets_changed" });
    await expect(datasetsChunk(s, T, version, 2)).rejects.toMatchObject({ status: 404 });
    const missing = store({ rows: new Map() });
    await expect(datasetsChunk(missing, T, version, 0)).rejects.toBeInstanceOf(ApiError);
    const short = store({ rows: new Map([["00000000000000aa/rows#0", [{ z: 1 }]], ["00000000000000aa/rows#2", [{ z: 3 }]]]) });
    await expect(datasetsChunk(short, T, version, 0)).rejects.toMatchObject({ status: 409 });
  });
});
