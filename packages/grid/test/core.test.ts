import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCellInput, type GridColumn } from "../src/contract.ts";
import { resolveCatalogue, type Catalogue, type ChangeModel, type RegistryLike } from "../src/catalogue.ts";
import { compareDecimals, moneyTotals, sumDecimals, toScaled } from "../src/decimal.ts";
import { matches, queryRows, sortRows } from "../src/query.ts";
import { EditBuffer } from "../src/ui/edits.ts";
import { exportValue, toCsv } from "../src/ui/grid.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8"));
const catalogue = read("schema/grids/grids.json") as Catalogue;
const model = read("schema/aip-change-model.json") as ChangeModel;
const registry = read("schema/aip-data-model.json") as RegistryLike;

const col = (field: string, kind: GridColumn["kind"]): GridColumn => ({ field, label: field, kind, editable: true });

describe("catalogue", () => {
  it("resolves the governed catalogue with no problems", () => {
    const r = resolveCatalogue(catalogue, model, registry);
    expect(r.problems).toEqual([]);
    expect(r.grids.map((g) => g.id)).toContain("pv-modules");
    // Time series never become editable grids.
    for (const g of r.grids.filter((x) => x.entity)) {
      const e = model.entities.find((x) => x.name === g.entity)!;
      expect(e.layer).not.toBe("series");
    }
  });

  it("reports columns a source does not have, and edits on read-only columns", () => {
    const bad: Catalogue = {
      version: 1,
      grids: [
        { id: "x", title: "X", screen: "S", source: { kind: "entity", name: "work_order" }, columns: ["code", "nope"], bulkEdit: ["code"], defaultSort: [{ field: "status", dir: "asc" }] },
        { id: "Y_bad", title: "Y", screen: "S", source: { kind: "entity", name: "missing" }, columns: ["code"] },
        { id: "z", title: "Z", screen: "S", source: { kind: "view", name: "audit_log" }, columns: ["code"] },
      ],
    };
    const r = resolveCatalogue(bad, model, registry);
    expect(r.problems).toEqual(
      expect.arrayContaining([
        "grid x: work_order has no column nope",
        "grid x: bulk edit on code, which is not editable",
        "grid x: sorts on status, which it does not show",
        "grid Y_bad: id must be lower-case words joined by hyphens",
        "grid Y_bad: unknown entity missing",
        "grid z: a view source names an aip.v_* view",
      ]),
    );
  });
});

describe("decimals", () => {
  it("sums amounts exactly, where floating point would drift", () => {
    expect(sumDecimals(["0.1", "0.2", "0.3"]).sum).toBe("0.6");
    expect(0.1 + 0.2 + 0.3).not.toBe(0.6);
    expect(sumDecimals(["1234567890123.4567", "-0.4567", "x", null]).sum).toBe("1234567890123");
    expect(sumDecimals(["-0.5", "0.25"]).sum).toBe("-0.25");
    expect(toScaled("1,250.50")).toBe(1_250_500_000n);
    expect(compareDecimals("10.5", "9.75")).toBe(1);
    expect(compareDecimals("2", "10")).toBe(-1);
  });

  it("never adds amounts in different currencies", () => {
    const totals = moneyTotals([{ a: "100.10", currency: "INR" }, { a: "5.5", currency: "USD" }, { a: "0.90", currency: "INR" }, { a: "1" }], "a", "currency", "INR");
    expect(totals).toEqual([{ currency: "INR", sum: "102" }, { currency: "USD", sum: "5.5" }]);
  });
});

describe("query semantics", () => {
  const cols = [col("code", "text"), col("n", "integer"), col("amt", "money"), col("d", "date"), col("ok", "boolean")];
  const rows = [
    { code: "A-10", n: 3, amt: "10.50", d: "2026-01-05", ok: true },
    { code: "A-9", n: null, amt: "9.75", d: null, ok: false },
    { code: "B-1", n: 12, amt: "100", d: "2025-12-31", ok: null },
  ];

  it("filters like the database: nulls never match comparisons, text equality is exact", () => {
    expect(rows.filter((r) => matches(r, { field: "n", op: "neq", value: 3 }, "integer")).map((r) => r.code)).toEqual(["B-1"]);
    expect(rows.filter((r) => matches(r, { field: "amt", op: "gt", value: "9.8" }, "money")).map((r) => r.code)).toEqual(["A-10", "B-1"]);
    expect(rows.filter((r) => matches(r, { field: "d", op: "lt", value: "2026-01-01" }, "date")).map((r) => r.code)).toEqual(["B-1"]);
    expect(rows.filter((r) => matches(r, { field: "code", op: "eq", value: "a-10" }, "text"))).toHaveLength(0);
    expect(rows.filter((r) => matches(r, { field: "code", op: "contains", value: "a-" }, "text"))).toHaveLength(2);
    expect(rows.filter((r) => matches(r, { field: "n", op: "empty" }, "integer")).map((r) => r.code)).toEqual(["A-9"]);
    expect(rows.filter((r) => matches(r, { field: "code", op: "in", value: ["A-9", "B-1"] }, "text"))).toHaveLength(2);
  });

  it("sorts naturally and numerically, empty values last, with the key as tie-breaker", () => {
    expect(sortRows(rows, [{ field: "code", dir: "asc" }], cols, "code").map((r) => r.code)).toEqual(["A-9", "A-10", "B-1"]);
    expect(sortRows(rows, [{ field: "amt", dir: "desc" }], cols, "code").map((r) => r.code)).toEqual(["B-1", "A-10", "A-9"]);
    expect(sortRows(rows, [{ field: "n", dir: "desc" }], cols, "code").map((r) => r.code)).toEqual(["B-1", "A-10", "A-9"]);
    const r = queryRows(rows, { offset: 1, limit: 1, sort: [{ field: "n", dir: "asc" }], filters: [], search: "a-" }, cols, "code");
    expect(r).toEqual({ rows: [rows[1]], total: 2 });
  });
});

describe("cell input", () => {
  it("keeps amounts as decimal strings and checks every type", () => {
    expect(parseCellInput("money", "1,250.50")).toEqual({ value: "1250.50" });
    expect(parseCellInput("money", "12abc")).toEqual({ error: "Enter a number" });
    expect(parseCellInput("integer", "4.5")).toEqual({ error: "Enter a whole number" });
    expect(parseCellInput("integer", "42")).toEqual({ value: 42 });
    expect(parseCellInput("date", "2026-02-30")).toEqual({ error: "Use YYYY-MM-DD" });
    expect(parseCellInput("date", "2028-02-29")).toEqual({ value: "2028-02-29" });
    expect(parseCellInput("datetime", "2026-10-05 25:00")).toEqual({ error: "Use YYYY-MM-DD HH:MM" });
    expect(parseCellInput("date", "30/01/2026")).toEqual({ error: "Use YYYY-MM-DD" });
    expect(parseCellInput("datetime", "2026-10-05 14:30")).toEqual({ value: "2026-10-05T14:30:00" });
    expect(parseCellInput("boolean", "no")).toEqual({ value: false });
    expect(parseCellInput("text", "  ")).toEqual({ value: null });
  });
});

describe("pending edits", () => {
  const row = { code: "WO-1", status: "OPEN", sla_hours: 4, row_version: 7 };

  it("builds one change set with each row's version, and keeps its id until the edits change", () => {
    let n = 0;
    const b = new EditBuffer("work_order", () => `id-${++n}`);
    b.set(row, "status", "IN_PROGRESS");
    b.set(row, "sla_hours", 8);
    b.insert("WO-NEW", { description: "x" });
    b.remove({ code: "WO-2", row_version: 3 });
    const set = b.toChangeSet()!;
    expect(set.items).toEqual([
      { entity: "work_order", op: "update", code: "WO-1", baseVersion: 7, values: { status: "IN_PROGRESS", sla_hours: 8 } },
      { entity: "work_order", op: "insert", code: "WO-NEW", values: { description: "x" } },
      { entity: "work_order", op: "delete", code: "WO-2", baseVersion: 3 },
    ]);
    expect(b.toChangeSet()!.id).toBe(set.id);
    b.set(row, "sla_hours", 4); // back to what was read: that edit drops
    expect(b.toChangeSet()!.id).not.toBe(set.id);
    expect(b.toChangeSet()!.items[0]!.values).toEqual({ status: "IN_PROGRESS" });
    b.rebase("WO-1", 9);
    expect(b.toChangeSet()!.items[0]!.baseVersion).toBe(9);
    b.set(row, "status", "OPEN");
    expect(b.has("WO-1")).toBe(false);
  });
});

describe("export", () => {
  it("neutralises formula injection and keeps amounts exact", () => {
    expect(exportValue(col("t", "text"), "=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(exportValue(col("t", "text"), "@SUM(A1)")).toBe("'@SUM(A1)");
    expect(exportValue(col("a", "money"), "-1250.5000")).toBe("-1250.5000");
    expect(exportValue(col("n", "integer"), 5)).toBe(5);
    expect(toCsv([["a", "b"], ['x,"y"', null]])).toBe('﻿a,b\r\n"x,""y""",\r\n');
  });
});
