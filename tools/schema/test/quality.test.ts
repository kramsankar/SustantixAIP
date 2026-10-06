import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { changeModel } from "../src/changes-sql.ts";
import { buildMasters } from "../src/masters.ts";
import { checkRecords, recordRules, ruleProblems, type QualityRules } from "../src/quality.ts";
import { loadCorrections } from "../src/corrections.ts";
import { loadVocabulary } from "../src/reference.ts";
import type { Registry } from "../src/registry.ts";
import { readSheets } from "../src/rows.ts";
import { masterDefs } from "../src/masters.ts";
import { transactionDefs } from "../src/sheet-model.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const reg = JSON.parse(readFileSync(new URL("../../../schema/aip-data-model.json", import.meta.url), "utf8")) as Registry;
const rules = JSON.parse(readFileSync(new URL("../../../schema/quality/rules.json", import.meta.url), "utf8")) as QualityRules;
const model = changeModel([...masterDefs(reg), ...transactionDefs(reg)]);

describe("governed data-quality rules", () => {
  it("name only entities and fields the governed model has; population rules say why they are monitored", () => {
    expect(ruleProblems(rules, (e) => model.entities.find((x) => x.name === e)?.columns.map((c) => c.name) ?? null)).toEqual([]);
    const ids = new Set(rules.rules.map((r) => r.id));
    for (let i = 1; i <= 16; i++) expect(ids.has(`DQ-${String(i).padStart(3, "0")}`)).toBe(true);
  });

  it("pass on the governed data, as the workbook's own rule results say", () => {
    const built = buildMasters(reg, readSheets(readFileSync(new URL("../../../reference/AIP_Data_v915.xlsx", import.meta.url))), loadVocabulary(root), loadCorrections(root));
    for (const m of built.masters) {
      const issues = checkRecords(rules, m.def.name, m.rows.map((r) => ({ code: r.code, values: r.values }))).flat();
      expect(issues, m.def.name).toEqual([]);
    }
  });

  it("catch what each kind of rule is for, exactly", () => {
    const stock = (on: string, res: string, hold: string, avail: string) => ({ code: "S", values: { on_hand_qty: on, reserved_qty: res, quality_hold_qty: hold, available_qty: avail, in_transit_qty: "0" } });
    const out = checkRecords(rules, "part_stock", [stock("10", "2", "1", "7"), stock("10", "2", "1", "8"), stock("0.3", "0.1", "0.2", "0"), stock("1", "2", "0", "-1")]);
    expect(out[0]).toEqual([]);
    expect(out[1]!.map((i) => i.rule)).toEqual(["MSI-DQ-04"]);
    expect(out[2]).toEqual([]); // 0.3 − 0.1 − 0.2 is exactly 0: no floating-point drift
    expect(out[3]!.map((i) => i.rule)).toEqual(["MSI-DQ-05"]);
    const wo = checkRecords(rules, "work_order", [{ code: "W1", values: { site: "S", asset: "A", source_record: "EAM" } }, { code: "W1", values: { site: "S", asset: "", source_record: null } }]);
    expect(wo[0]).toEqual([]);
    expect(wo[1]!.map((i) => `${i.rule}:${i.severity}`)).toEqual(["DQ-002:reject", "DQ-003:reject", "DQ-008:warn"]);
    expect(recordRules(rules, "work_order").every((r) => r.scope !== "population")).toBe(true);
  });
});
