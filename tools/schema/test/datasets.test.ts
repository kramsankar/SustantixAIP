import { describe, expect, it } from "vitest";
import { blocksOf, datasetSeedSql, datasetsSql, FRAME_PART } from "../src/datasets-sql.ts";

describe("runtime datasets in the database", () => {
  it("cuts a table into consecutive blocks that rejoin to the same rows", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ Id: i, Text: "x".repeat(i % 7) }));
    const blocks = blocksOf(rows, 120);
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks[0]!.first).toBe(0);
    for (let i = 1; i < blocks.length; i++) expect(blocks[i]!.first).toBe(blocks[i - 1]!.first + blocks[i - 1]!.count);
    expect(blocks.flatMap((b) => JSON.parse(b.text) as unknown[])).toEqual(rows);
    // A row larger than a block still travels, alone.
    expect(blocksOf([{ big: "y".repeat(500) }, { a: 1 }], 100).map((b) => b.count)).toEqual([1, 1]);
  });

  it("seeds a tenant's datasets idempotently: everything replaced, frame and tables, quotes escaped", () => {
    const sql = datasetSeedSql("00000000-0000-0000-0000-0000000000c1", [{ id: "0123456789abcdef", value: { label: "O'Neil", rows: [{ a: 1 }, { a: 2 }] } }]);
    expect(sql[0]).toBe("delete from aip.dataset_part where tenant_id = '00000000-0000-0000-0000-0000000000c1';");
    expect(sql.join("\n")).toContain(`'${FRAME_PART}', '{"label":"O''Neil","rows":{"$aipPart":"/rows"}}'::json`);
    expect(sql.join("\n")).toContain(`'/rows', 0, 2, 17, '[{"a":1},{"a":2}]'::json`);
  });

  it("refuses anything that is not a runtime dataset id", () => {
    expect(() => datasetSeedSql("00000000-0000-0000-0000-0000000000c1", [{ id: "../x", value: {} }])).toThrow(/not a runtime dataset id/);
  });

  it("keeps members read-only and the stored text as written", () => {
    const sql = datasetsSql();
    expect(sql).toContain("rows json not null");
    expect(sql).toContain("grant select on aip.dataset_part, aip.dataset_block to authenticated");
    expect(sql).not.toMatch(/jsonb not null/);
  });
});
