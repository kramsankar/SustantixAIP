import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildMasters } from "../src/masters.ts";
import { loadVocabulary } from "../src/reference.ts";
import type { Registry } from "../src/registry.ts";
import { readSheets } from "../src/rows.ts";
import { comparable, importSheetRows, specForSheet } from "../src/sheet-import.ts";
import { SHEET_SPECS } from "../src/sheet-model.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const reg = JSON.parse(readFileSync(new URL("../../../schema/aip-data-model.json", import.meta.url), "utf8")) as Registry;
const raw = readSheets(readFileSync(new URL("../../../reference/AIP_Data_v915.xlsx", import.meta.url)));
const vocab = loadVocabulary(root);
const built = buildMasters(reg, raw, vocab);
const sheetOf = (table: string) => reg.tables.find((t) => t.name === table)!.sheet;

describe("governed import: sheet rows back to records", () => {
  it("maps every transaction sheet exactly as the loader built it", () => {
    for (const spec of SHEET_SPECS.filter((s) => s.layer === "transaction")) {
      const sheet = sheetOf(spec.sheet);
      const imp = importSheetRows(reg, vocab, sheet, raw[sheet] ?? []);
      const rows = built.masters.find((m) => m.def.name === spec.name)!.rows;
      expect(imp.records.length, spec.name).toBe(rows.length);
      imp.records.forEach((r, i) => {
        const { source_ordinal: _o, ...want } = rows[i]!.values;
        expect(r.code).toBe(rows[i]!.code);
        expect(r.values, `${spec.name} ${r.code}`).toEqual(want);
      });
    }
  });

  it("resolves labels and aliases to codes, and reports values outside the vocabulary", () => {
    const sheet = sheetOf("work_orders");
    const row = { ...raw[sheet]![0]!, Priority: "Critical", Status: "In Progress" };
    const imp = importSheetRows(reg, vocab, sheet, [row]);
    expect(imp.records[0]!.values).toMatchObject({ priority: "CRITICAL", status: "IN_PROGRESS" });
    const bad = importSheetRows(reg, vocab, sheet, [{ ...row, Priority: "Whenever" }]);
    expect(bad.issues).toEqual([expect.objectContaining({ column: "priority", value: "Whenever", problem: "unmapped reference" })]);
  });

  it("knows which sheets are normalized", () => {
    expect(specForSheet(reg, sheetOf("work_orders"))?.name).toBe("work_order");
    expect(specForSheet(reg, sheetOf("sites"))).toBeNull();
  });

  it("compares stored and imported values by meaning, not by form", () => {
    expect(comparable("money", "1250.50")).toBe(comparable("money", 1250.5));
    expect(comparable("decimal", "0.10")).toBe("0.1");
    expect(comparable("integer", "007")).toBe("7");
    expect(comparable("datetime", "2026-10-05 14:30")).toBe("2026-10-05T14:30:00");
    expect(comparable("datetime", "2026-10-05T14:30:00")).toBe("2026-10-05T14:30:00");
    expect(comparable("boolean", "Yes")).toBe("true");
    expect(comparable("text", " ")).toBeNull();
  });
});
