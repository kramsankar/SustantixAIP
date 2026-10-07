import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blocksOf, catalogueSeedSql, catalogueSql, firstStoreRetirementSql } from "../src/datasets-sql.ts";
import { buildCatalogue } from "../src/runtime-catalogue.ts";
import { buildRuntimeCatalogue, catalogueMap } from "../src/runtime-catalogue-cli.ts";

const root = join(import.meta.dirname, "../../..");
const ds = (id: string, label: string, value: unknown) => ({ id, label, value: value as never });

describe("runtime catalogue", () => {
  const governed = { "Work Orders": ["WO_ID", "Status", "Cost"], Sites: ["Plant_ID", "Name"] };
  const c = buildCatalogue(
    [
      ds("00000000000000aa", "Workbook", {
        "Work Orders": [{ WO_ID: "W1", Status: "Open" }],
        Sites: [{ Plant_ID: "SP-01", Region: "N" }],
        "Crew Assignments": [{ Crew: "C1" }],
        perf: [{ m: 1 }],
      }),
      ds("00000000000000bb", "Workbook runtime extensions", {
        platformSyntheticData: { "Crew Assignments": [{ Crew: "C9" }], "Work Orders": [{ Status: "Closed", WO_ID: "W9" }] },
        copy: { "Crew Assignments": [{ Crew: "C1" }] },
      }),
      ds("00000000000000cc", "Alternatives", { "DEC-1": { scenarios: [{ s: 1 }, { s: 2 }] }, "DEC-2": { scenarios: [{ s: 3 }] }, "DEC-3": { scenarios: [{ s: 4 }] } }),
    ],
    governed,
  );
  const sheet = (name: string) => c.sheets.find((s) => s.name === name);

  it("reads governed sheets for copies whose columns the governed sheet has, in the copy's column order", () => {
    expect(c.governed).toEqual([{ sheet: "Work Orders", usedBy: ["Workbook /Work Orders", "Workbook runtime extensions /platformSyntheticData/Work Orders"] }]);
    const layout = c.datasets.find((d) => d.id === "00000000000000bb")!.layout as Record<string, Record<string, unknown>>;
    expect(layout.platformSyntheticData!["Work Orders"]).toEqual({ $aipGoverned: "Work Orders", columns: ["Status", "WO_ID"] });
    // A column the governed sheet lacks keeps the table in the catalogue.
    expect(sheet("Sites")).toBeTruthy();
  });

  it("holds each distinct table once, names variants plainly and code keys with their dataset", () => {
    expect(sheet("Crew Assignments · Excel")!.usedBy).toEqual(["Workbook /Crew Assignments", "Workbook runtime extensions /copy/Crew Assignments"]);
    expect(sheet("Crew Assignments · synthetic")!.rows).toEqual([{ Crew: "C9" }]);
    expect(sheet("Workbook · perf")).toBeTruthy();
  });

  it("keeps a family of like lists as one sheet grouped by its key", () => {
    const s = sheet("Alternatives · scenarios")!;
    expect(s.rows).toEqual([{ s: 1 }, { s: 2 }, { s: 3 }, { s: 4 }]);
    expect(s.groups).toEqual([{ key: "DEC-1", first: 0, count: 2 }, { key: "DEC-2", first: 2, count: 1 }, { key: "DEC-3", first: 3, count: 1 }]);
    const layout = c.datasets.find((d) => d.id === "00000000000000cc")!.layout as Record<string, Record<string, unknown>>;
    expect(layout["DEC-2"]!.scenarios).toEqual({ $aipSheet: "Alternatives · scenarios", group: "DEC-2" });
  });

  it("seeds a tenant's catalogue idempotently: everything replaced, blocks in order, quotes escaped", () => {
    const sql = catalogueSeedSql("00000000-0000-0000-0000-0000000000c1", { datasets: [{ id: "0123456789abcdef", label: "O'Neil data", layout: { t: { $aipSheet: "S" } } }], sheets: [{ name: "S", rows: [{ a: 1 }, { a: 2 }], usedBy: ["O'Neil data /t"] }], governed: [] }, 8);
    expect(sql.slice(0, 2)).toEqual(["delete from aip.runtime_dataset where tenant_id = '00000000-0000-0000-0000-0000000000c1';", "delete from aip.runtime_sheet where tenant_id = '00000000-0000-0000-0000-0000000000c1';"]);
    expect(sql.join("\n")).toContain(`'0123456789abcdef', 'O''Neil data', '{"t":{"$aipSheet":"S"}}'::json`);
    expect(sql.join("\n")).toContain(`'S', 0, 1, 9, '[{"a":1}]'::json`);
    expect(sql.join("\n")).toContain(`'S', 1, 1, 9, '[{"a":2}]'::json`);
    expect(() => catalogueSeedSql("00000000-0000-0000-0000-0000000000c1", { datasets: [{ id: "../x", label: "x", layout: {} }], sheets: [], governed: [] })).toThrow(/not a runtime dataset id/);
  });

  it("cuts a sheet into consecutive blocks that rejoin to the same rows", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ Id: i, Text: "x".repeat(i % 7) }));
    const blocks = blocksOf(rows, 120);
    for (let i = 1; i < blocks.length; i++) expect(blocks[i]!.first).toBe(blocks[i - 1]!.first + blocks[i - 1]!.count);
    expect(blocks.flatMap((b) => JSON.parse(b.text) as unknown[])).toEqual(rows);
  });

  it("keeps members read-only and the stored text as written; leaves the first store for a later migration", () => {
    const sql = catalogueSql();
    expect(sql).toContain("rows json not null");
    expect(sql).not.toMatch(/drop table/);
    expect(sql).toMatch(/grant select on aip\.runtime_dataset, aip\.runtime_sheet, aip\.runtime_sheet_group, aip\.runtime_sheet_block to authenticated/);
    expect(sql).not.toMatch(/jsonb not null/);
  });

  it("retires the first store idempotently and touches nothing the catalogue holds", () => {
    const sql = firstStoreRetirementSql();
    const statements = sql.split("\n").filter((l) => l && !l.startsWith("--"));
    expect(statements).toEqual([
      "drop function if exists aip.dataset_blocks(uuid, jsonb);",
      "drop table if exists aip.dataset_block, aip.dataset_part;",
      "drop function if exists aip.audit_dataset_write();",
    ]);
    expect(sql).not.toMatch(/runtime_|cascade/);
  });

  it("builds from the real datasets as recorded in schema/runtime-sheets.json (regenerate with runtime:catalogue)", () => {
    const built = catalogueMap(buildRuntimeCatalogue(root));
    const committed = JSON.parse(readFileSync(join(root, "schema/runtime-sheets.json"), "utf8"));
    expect(built).toEqual(committed);
    expect(built.datasets).toHaveLength(36);
  }, 120_000);
});
