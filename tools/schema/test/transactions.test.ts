import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compatSql, compatTestSql, rebuildSheets, workbookDateTime } from "../src/compat.ts";
import { loadCorrections } from "../src/corrections.ts";
import { buildMasters, masterCodes, masterDefs } from "../src/masters.ts";
import { loadVocabulary } from "../src/reference.ts";
import type { Registry } from "../src/registry.ts";
import { readSheets } from "../src/rows.ts";
import { SHEET_SPECS, linkProblems, specProblems, transactionDefs, type SheetSpec } from "../src/sheet-model.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const reg = JSON.parse(readFileSync(new URL("../../../schema/aip-data-model.json", import.meta.url), "utf8")) as Registry;
const raw = readSheets(readFileSync(new URL("../../../reference/AIP_Data_v915.xlsx", import.meta.url)));
const vocab = loadVocabulary(root);
const corrections = loadCorrections(root);
const built = buildMasters(reg, raw, vocab, corrections);
const trips = rebuildSheets(reg, raw, built, vocab, corrections);
const rows = (name: string) => built.masters.find((m) => m.def.name === name)!.rows;

describe("phase 3 sheet model", () => {
  it("accounts for every column of every replaced sheet, and never reuses a sheet table's name", () => {
    expect(SHEET_SPECS.flatMap((s) => specProblems(reg, s))).toEqual([]);
    const sheets = new Set(reg.tables.map((t) => t.name));
    for (const d of [...masterDefs(reg), ...transactionDefs(reg)]) expect(sheets.has(d.name)).toBe(false);
    expect(new Set(SHEET_SPECS.map((s) => s.sheet)).size).toBe(SHEET_SPECS.length);
  });

  it("catches a sheet column that is neither carried, rebuilt nor omitted", () => {
    const wo = SHEET_SPECS.find((s) => s.name === "work_order")!;
    const { data_basis: _drop, ...columns } = wo.columns;
    const broken: SheetSpec = { ...wo, columns };
    expect(specProblems(reg, broken)).toEqual(["work_order: work_orders.data_basis is neither carried, rebuilt nor omitted"]);
    expect(specProblems(reg, { ...wo, copies: { ...wo.copies, description: { via: "asset", attr: "name" } } })).toContain("work_order: work_orders.description is accounted for twice");
  });

  it("builds every transaction and series with every reference resolved", () => {
    expect(built.issues).toEqual([]);
    expect(rows("work_order")).toHaveLength(453);
    expect(rows("plant_telemetry")).toHaveLength(19944);
    expect(rows("life_observation")).toHaveLength(7584);
    expect(rows("work_order").find((r) => r.code === "WO-7001")!.values).toMatchObject({ site: "SP-01", status: "COMPLETED" });
    // Series carry no per-row lineage; transactions do.
    expect(rows("plant_telemetry")[0]!.lineage).toEqual([]);
    expect(rows("work_order")[0]!.lineage[0]).toMatchObject({ table: "work_orders", role: "primary" });
  });

  it("splits a column across two vocabularies where the sheet mixed them", () => {
    const cbm = rows("cbm_assessment");
    expect(cbm.some((r) => r.values.failure_mode && !r.values.observed_defect)).toBe(true);
    expect(cbm.some((r) => r.values.observed_defect && !r.values.failure_mode)).toBe(true);
  });

  it("links records across modules, with both ends present", () => {
    const links = rows("record_link");
    expect(links).toHaveLength(350);
    expect(linkProblems(links, masterCodes(built))).toEqual([]);
    expect(links.filter((l) => l.values.from_entity === "intervention")).toHaveLength(295);
    expect(linkProblems([{ code: "x", values: { from_entity: "work_order", from_code: "WO-NOPE", link_type: "raised", to_entity: "alert", to_code: "x" }, lineage: [] }], masterCodes(built))).toHaveLength(2);
  });
});

describe("phase 3 round trip", () => {
  it("rebuilds every sheet with no unexplained difference; time series exactly", () => {
    expect(trips).toHaveLength(SHEET_SPECS.length);
    for (const t of trips) expect(t.diffs.unexplained, t.sheet).toBe(0);
    for (const s of ["twin_telemetry", "inverter_telemetry", "fcst_interval", "fcst_validation", "work_orders"] as const) {
      const t = trips.find((x) => x.sheet === s)!;
      expect(t.cells).toBeGreaterThan(0);
      if (s !== "work_orders") expect(t.identicalRows).toBe(t.rows);
    }
  });

  it("classifies the workbook's own inconsistencies as copy drift, not as data loss", () => {
    const v = trips.find((t) => t.sheet === "vision_findings")!;
    expect(v.diffs.copy).toBeGreaterThan(0);
    expect(v.examples.find((e) => e.class === "copy" && e.column === "asset_tag")).toBeDefined();
    const fmt = trips.find((t) => t.sheet === "msi_spare_requirements")!;
    expect(fmt.diffs.format).toBeGreaterThan(0);
  });

  it("reports a corrupted value as unexplained", () => {
    const copy = { ...built, masters: built.masters.map((m) => (m.def.name === "work_order" ? { ...m, rows: m.rows.map((r, i) => (i === 0 ? { ...r, values: { ...r.values, sla_hours: 999999 } } : r)) } : m)) };
    const t = rebuildSheets(reg, raw, copy, vocab, corrections, SHEET_SPECS.filter((s) => s.name === "work_order"))[0]!;
    expect(t.diffs.unexplained).toBe(1);
    expect(t.examples[0]).toMatchObject({ column: "sla_hours", class: "unexplained", rebuilt: 999999 });
  });

  it("writes date-times back in the workbook's own forms", () => {
    expect(workbookDateTime("2026-09-08T16:00:00", "dmy")).toBe("08-09-2026 16:00");
    expect(workbookDateTime("2026-09-08T16:00:00")).toBe("2026-09-08 16:00");
    expect(workbookDateTime(null)).toBeNull();
  });
});

describe("phase 3 SQL", () => {
  const sql = compatSql(reg, [...masterDefs(reg), ...transactionDefs(reg)]);

  it("emits one security-invoker compatibility view per replaced sheet, typed like the sheet", () => {
    for (const s of SHEET_SPECS) expect(sql).toContain(`create view aip_compat."${s.sheet}" with (security_invoker = true)`);
    expect(sql).toMatch(/to_char\(t\."as_of", 'DD-MM-YYYY HH24:MI'\)/);
    expect(sql).toMatch(/aip_compat."work_orders"[\s\S]*?j\d+\.code\)::varchar\(200\) as "asset_id"/);
    expect(sql).not.toMatch(/\b(real|double precision|float)\b/i);
  });

  it("checks every exactly-rebuilt sheet on all of its columns in the database", () => {
    const test = compatTestSql(reg, trips, "00000000-0000-0000-0000-0000000000c1");
    const twin = test.split("do $$").find((b) => b.includes("aip_compat.\"twin_telemetry\""))!;
    for (const c of reg.tables.find((t) => t.name === "twin_telemetry")!.columns) expect(twin).toContain(`"${c.name}"`);
    expect(test).toContain("except all");
  });
});
