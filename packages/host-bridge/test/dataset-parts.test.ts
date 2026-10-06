import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PART_REF, joinDataset, splitDataset, type Json } from "../src/dataset-parts.ts";

const src = join(import.meta.dirname, "../../../apps/runtime/src");
const manifest = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8")) as { datasets: Record<string, unknown> };
const classes = JSON.parse(readFileSync(join(src, "../dataset-classes.json"), "utf8")) as { product: Record<string, string> };

/** What the database gives back: the frame and each row as stored text (json columns keep the text as written). */
const throughStorage = (value: Json) => {
  const { frame, tables } = splitDataset(value);
  const stored = { frame: JSON.stringify(frame), tables: tables.map((t) => ({ part: t.part, rows: t.rows.map((r) => JSON.stringify(r)) })) };
  return joinDataset(JSON.parse(stored.frame) as Json, new Map(stored.tables.map((t) => [t.part, t.rows.map((r) => JSON.parse(r) as Json)])));
};

describe("dataset parts", () => {
  it("splits outer tables only and joins them back in place, keys in their original order", () => {
    const value: Json = { b: 1, a: { rows: [{ z: 1, y: [{ n: 1 }] }, { z: 2, y: [] }], list: [1, 2], grid: [[1, "x"], [2, "y"]] }, empty: [], "a/b~c": [{ k: 1 }] };
    const { frame, tables } = splitDataset(value);
    expect(tables.map((t) => t.part)).toEqual(["/a/rows", "/a/grid", "/a~1b~0c"]);
    expect(JSON.stringify(frame)).toBe(`{"b":1,"a":{"rows":{"${PART_REF}":"/a/rows"},"list":[1,2],"grid":{"${PART_REF}":"/a/grid"}},"empty":[],"a/b~c":{"${PART_REF}":"/a~1b~0c"}}`);
    expect(JSON.stringify(throughStorage(value))).toBe(JSON.stringify(value));
  });

  it("keeps a __proto__ key as data", () => {
    const value = JSON.parse('{"__proto__":{"x":1},"t":[{"__proto__":2}]}') as Json;
    expect(JSON.stringify(throughStorage(value))).toBe(JSON.stringify(value));
  });

  it("refuses a frame whose table was not loaded, and a table with no place", () => {
    const { frame } = splitDataset({ t: [{ a: 1 }] });
    expect(() => joinDataset(frame, new Map())).toThrow(/was not loaded/);
    expect(() => joinDataset(frame, new Map([["/t", [{ a: 1 }]], ["/u", [{ a: 2 }]]]))).toThrow(/no place/);
  });

  it("classifies every runtime dataset that exists", () => {
    const files = readdirSync(join(src, "data")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
    expect(Object.keys(manifest.datasets).sort()).toEqual(files);
    for (const h of Object.keys(classes.product)) expect(files).toContain(h);
  });

  it("rebuilds every tenant dataset exactly from its database parts", () => {
    let tables = 0;
    for (const h of Object.keys(manifest.datasets)) {
      if (h in classes.product) continue;
      const text = readFileSync(join(src, "data", `${h}.json`), "utf8");
      const value = JSON.parse(text) as Json;
      const split = splitDataset(value);
      tables += split.tables.length;
      // The frame carries structure only: no tenant table may remain in it.
      expect(JSON.stringify(split.frame).length, h).toBeLessThan(200_000);
      expect(JSON.stringify(throughStorage(value)), h).toBe(JSON.stringify(value));
    }
    expect(tables).toBeGreaterThan(700);
  });
});
