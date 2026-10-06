import { describe, expect, it } from "vitest";
import { chunkPlan, datasetsChunk, datasetsManifest, datasetsVersion, type BlockMeta, type DatasetStore } from "../lib/datasets";
import { ApiError } from "../lib/http";

const T = "00000000-0000-0000-0000-00000000000a";

function store(over: Partial<{ blocks: BlockMeta[]; rows: Map<string, unknown[]>; updatedAt: string }> = {}): DatasetStore {
  const blocks = over.blocks ?? [
    { sheet: "Alternatives · scenarios", first: 0, rows: 3, bytes: 900_000 },
    { sheet: "Crew Assignments", first: 0, rows: 2, bytes: 1_500_000 },
    { sheet: "Crew Assignments", first: 2, rows: 1, bytes: 3_000_000 },
  ];
  const rows = over.rows ?? new Map<string, unknown[]>([
    ["Alternatives · scenarios#0", [{ s: 1 }, { s: 2 }, { s: 3 }]],
    ["Crew Assignments#0", [{ z: 1, a: 1 }, { z: 2, a: 2 }]],
    ["Crew Assignments#2", [{ z: 3, a: 3 }]],
  ]);
  const layouts = [
    { dataset: "00000000000000aa", layout: { label: "A", crew: { $aipSheet: "Crew Assignments" } }, updatedAt: over.updatedAt ?? "2026-10-06T10:00:00Z" },
    { dataset: "00000000000000bb", layout: { "DEC-1": { $aipSheet: "Alternatives · scenarios", group: "DEC-1" } }, updatedAt: "2026-10-06T10:00:00Z" },
  ];
  return {
    layouts: async () => layouts,
    stamps: async () => layouts.map(({ dataset, updatedAt }) => ({ dataset, updatedAt })),
    sheets: async () => [
      { sheet: "Alternatives · scenarios", rows: 3, updatedAt: "2026-10-06T10:00:00Z" },
      { sheet: "Crew Assignments", rows: 3, updatedAt: "2026-10-06T10:00:00Z" },
    ],
    groups: async () => [
      { sheet: "Alternatives · scenarios", key: "DEC-2", first: 2, rows: 1 },
      { sheet: "Alternatives · scenarios", key: "DEC-1", first: 0, rows: 2 },
    ],
    blocks: async () => blocks,
    read: async (_t, want) => want.map((b) => rows.get(`${b.sheet}#${b.first}`) ?? null),
  };
}

describe("runtime catalogue served from the database", () => {
  it("groups blocks into chunks within the budget, a large block alone", () => {
    expect(chunkPlan([{ bytes: 1_500_000 }, { bytes: 900_000 }, { bytes: 3_000_000 }, { bytes: 10 }])).toEqual([[0, 1], [2], [3]]);
    expect(chunkPlan([])).toEqual([]);
  });

  it("answers layouts, sheets with their groups in order, blocks and the chunk plan under one version", async () => {
    const m = await datasetsManifest(store(), T);
    expect(m.version).toMatch(/^[0-9a-f]{24}$/);
    expect(Object.keys(m.layouts)).toEqual(["00000000000000aa", "00000000000000bb"]);
    expect(m.sheets).toEqual({ "Alternatives · scenarios": { rows: 3, groups: [["DEC-1", 0, 2], ["DEC-2", 2, 1]] }, "Crew Assignments": { rows: 3 } });
    expect(m.blocks).toEqual([["Alternatives · scenarios", 0, 3], ["Crew Assignments", 0, 2], ["Crew Assignments", 2, 1]]);
    expect(m.chunks).toEqual([[0, 1], [2]]);
  });

  it("changes version when the catalogue is reloaded, or for another tenant", async () => {
    const s = store();
    const [stamps, blocks] = [await s.stamps(T), await s.blocks(T)];
    const v = datasetsVersion(T, stamps, blocks);
    expect(datasetsVersion(T, [...stamps].reverse(), blocks)).toBe(v);
    expect(datasetsVersion(T, [{ ...stamps[0]!, updatedAt: "2026-10-06T11:00:00Z" }, stamps[1]!], blocks)).not.toBe(v);
    expect(datasetsVersion(T, stamps, [...blocks.slice(0, 2), { ...blocks[2]!, rows: 2 }])).not.toBe(v);
    expect(datasetsVersion("00000000-0000-0000-0000-00000000000b", stamps, blocks)).not.toBe(v);
  });

  it("serves a chunk's blocks in plan order, keys as stored", async () => {
    const s = store();
    const { version } = await datasetsManifest(s, T);
    const c0 = await datasetsChunk(s, T, version, 0);
    expect(JSON.stringify(c0.blocks)).toBe('[[{"s":1},{"s":2},{"s":3}],[{"z":1,"a":1},{"z":2,"a":2}]]');
    expect((await datasetsChunk(s, T, version, 1)).blocks).toEqual([[{ z: 3, a: 3 }]]);
  });

  it("refuses a stale version, an unknown chunk, and a block that no longer matches", async () => {
    const s = store();
    const { version } = await datasetsManifest(s, T);
    await expect(datasetsChunk(store({ updatedAt: "2026-10-06T12:00:00Z" }), T, version, 0)).rejects.toMatchObject({ status: 409, code: "datasets_changed" });
    await expect(datasetsChunk(s, T, version, 2)).rejects.toMatchObject({ status: 404 });
    await expect(datasetsChunk(store({ rows: new Map() }), T, version, 0)).rejects.toBeInstanceOf(ApiError);
    const short = store({ rows: new Map([["Alternatives · scenarios#0", [{ s: 1 }]], ["Crew Assignments#0", [{ z: 1 }, { z: 2 }]]]) });
    await expect(datasetsChunk(short, T, version, 0)).rejects.toMatchObject({ status: 409 });
  });
});
