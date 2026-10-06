import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { composeDataset, isGovernedRef, isSheetRef, layoutOf, projectRows, tablesOf, type Json } from "../src/dataset-parts.ts";

const src = join(import.meta.dirname, "../../../apps/runtime/src");
const manifest = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8")) as { datasets: Record<string, unknown> };
const classes = JSON.parse(readFileSync(join(src, "../dataset-classes.json"), "utf8")) as { product: Record<string, string>; tenant: Record<string, string> };

describe("dataset layouts", () => {
  it("finds outer tables only, and rebuilds a dataset from its layout with keys in their original order", () => {
    const value: Json = { b: 1, a: { rows: [{ z: 1, y: [{ n: 1 }] }, { z: 2, y: [] }], list: [1, 2], grid: [[1, "x"], [2, "y"]] }, empty: [], "a/b~c": [{ k: 1 }] };
    expect(tablesOf(value).map((t) => t.part)).toEqual(["/a/rows", "/a/grid", "/a~1b~0c"]);
    const tables = new Map(tablesOf(value).map((t) => [t.part, t.rows]));
    const layout = layoutOf(value, (part) => ({ $aipSheet: part }));
    expect(JSON.stringify(layout)).toBe('{"b":1,"a":{"rows":{"$aipSheet":"/a/rows"},"list":[1,2],"grid":{"$aipSheet":"/a/grid"}},"empty":[],"a/b~c":{"$aipSheet":"/a~1b~0c"}}');
    const back = composeDataset(JSON.parse(JSON.stringify(layout)) as Json, { sheet: (n) => tables.get(n), governed: () => undefined });
    expect(JSON.stringify(back)).toBe(JSON.stringify(value));
  });

  it("reads one group of a sheet, and a governed sheet with the screen's columns in its order", () => {
    const layout: Json = { a: { $aipSheet: "scenarios", group: "DEC-2" }, wo: { $aipGoverned: "Work Orders", columns: ["Status", "WO_ID"] } };
    const family = new Map([["DEC-1", [{ s: 1 }]], ["DEC-2", [{ s: 2 }, { s: 3 }]]]);
    const governed: Json[] = [{ WO_ID: "WO-1", Cost: 5, Status: "Open" }, { WO_ID: "WO-2", Cost: 7 }];
    const got = composeDataset(layout, { sheet: (n, g) => (n === "scenarios" ? family.get(g!) : undefined), governed: (s) => (s === "Work Orders" ? governed : undefined) });
    expect(JSON.stringify(got)).toBe('{"a":[{"s":2},{"s":3}],"wo":[{"Status":"Open","WO_ID":"WO-1"},{"WO_ID":"WO-2"}]}');
    expect(projectRows([{ b: 1, a: 2 }], ["a", "b"])).toEqual([{ a: 2, b: 1 }]);
  });

  it("refuses a reference that is not answered, and a dataset that already holds a reference key", () => {
    expect(() => composeDataset({ t: { $aipSheet: "missing" } }, { sheet: () => undefined, governed: () => undefined })).toThrow(/sheet "missing" was not loaded/);
    expect(() => composeDataset({ t: { $aipGoverned: "Sites", columns: [] } }, { sheet: () => undefined, governed: () => undefined })).toThrow(/governed sheet "Sites"/);
    expect(() => tablesOf({ x: { $aipSheet: "y" } })).toThrow(/reference key/);
  });

  it("tells references from data", () => {
    expect(isSheetRef({ $aipSheet: "a" })).toBe(true);
    expect(isSheetRef({ $aipSheet: "a", group: "g" })).toBe(true);
    expect(isSheetRef({ $aipSheet: "a", other: 1 })).toBe(false);
    expect(isGovernedRef({ $aipGoverned: "a", columns: [] })).toBe(true);
    expect(isGovernedRef({ $aipGoverned: "a" })).toBe(false);
  });

  it("keeps a __proto__ key as data", () => {
    const value = JSON.parse('{"__proto__":{"x":1},"t":[{"__proto__":2}]}') as Json;
    const tables = new Map(tablesOf(value).map((t) => [t.part, t.rows]));
    const back = composeDataset(layoutOf(value, (p) => ({ $aipSheet: p })), { sheet: (n) => tables.get(n), governed: () => undefined });
    expect(JSON.stringify(back)).toBe(JSON.stringify(value));
  });

  it("classifies every runtime dataset exactly once, and labels each tenant dataset", () => {
    const files = readdirSync(join(src, "data")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
    expect(Object.keys(manifest.datasets).sort()).toEqual(files);
    expect([...Object.keys(classes.product), ...Object.keys(classes.tenant)].sort()).toEqual(files);
  });
});
