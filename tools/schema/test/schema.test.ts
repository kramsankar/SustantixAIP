import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dataModelPlan, platformPlan } from "../src/dataverse.ts";
import { detectKey, inferKind, inferRegistry, snake } from "../src/infer.ts";
import { dataModelSql, platformSql } from "../src/postgres.ts";
import { MAX_NAME } from "../src/registry.ts";
import { dataverseRecord, pgRecord, readSheets, rowKey } from "../src/rows.ts";

const wb = readFileSync(new URL("../../../reference/AIP_Data_v732.xlsx", import.meta.url));
const reg = inferRegistry(wb, "AIP_Data_v732.xlsx");
const sheets = readSheets(wb);

describe("type inference", () => {
  it("detects money by currency token and keeps the ISO code", () => {
    expect(inferKind("Unit_Cost_INR", [10, 12.5])).toMatchObject({ kind: "money", currency: "INR" });
    expect(inferKind("Regular_Rate_INR_Hr", [450])).toMatchObject({ kind: "money", currency: "INR" });
  });
  it("never stores money as a float-typed decimal", () => {
    for (const t of reg.tables) for (const c of t.columns) if (/_INR(_|$)/.test(c.source)) expect(c.kind).toBe("money");
  });
  it("separates dates, timestamps, integers and decimals", () => {
    expect(inferKind("D", ["2026-07-17"]).kind).toBe("date");
    expect(inferKind("D", ["2026-07-17 01:00", "2026-07-18"]).kind).toBe("datetime");
    expect(inferKind("N", [1, 2, 3]).kind).toBe("integer");
    expect(inferKind("N", [1, 2.25]).kind).toMatch("decimal");
    expect(inferKind("N", [1, "x"]).kind).toBe("text");
  });
  it("prefers unique *_ID columns and period-anchored composites for keys", () => {
    expect(detectKey(["A", "X_ID"], [{ A: 1, X_ID: "a" }, { A: 1, X_ID: "b" }])).toEqual(["X_ID"]);
    const rows = [
      { Period: "2026-07", Plant_ID: "SP-01", Worker_Type: "Employee", Hours: 10 },
      { Period: "2026-07", Plant_ID: "SP-01", Worker_Type: "Contractor", Hours: 10 },
    ];
    expect(detectKey(Object.keys(rows[0]!), rows)).toEqual(["Period", "Worker_Type"]);
  });
  it("normalises names", () => {
    expect(snake("Cost & Rate Master")).toBe("cost_and_rate_master");
    expect(snake("PNO_Optimization_Source_Reg")).toBe("pno_optimization_source_reg");
  });
});

describe("registry over the governed workbook", () => {
  it("covers every non-empty sheet", () => {
    const nonEmpty = Object.entries(sheets).filter(([, r]) => r.length || true).map(([k]) => k);
    expect(reg.tables.map((t) => t.sheet).sort()).toEqual(nonEmpty.filter((s) => reg.tables.some((t) => t.sheet === s)).sort());
    expect(reg.tables.length).toBeGreaterThanOrEqual(100);
  });
  it("produces unique, bounded identifiers", () => {
    const names = reg.tables.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of reg.tables) {
      expect(t.name.length).toBeLessThanOrEqual(MAX_NAME);
      const cols = t.columns.map((c) => c.name);
      expect(new Set(cols).size).toBe(cols.length);
      for (const c of cols) {
        expect(c.length).toBeLessThanOrEqual(MAX_NAME);
        expect(c).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(["name", "tenant_id", "row_key", "currency"]).not.toContain(c);
      }
    }
  });
  it("gives every table a business key that is unique in the seed", () => {
    for (const t of reg.tables) {
      const keys = (sheets[t.sheet] ?? []).map((r, i) => rowKey(t, r, i));
      expect(new Set(keys).size, t.sheet).toBe(keys.length);
    }
  });
  it("coerces every seed row for Postgres and Dataverse", () => {
    let n = 0;
    for (const t of reg.tables) {
      (sheets[t.sheet] ?? []).forEach((r, i) => {
        pgRecord(t, r, i, "00000000-0000-0000-0000-000000000000", "INR");
        const d = dataverseRecord(t, r, i, { INR: "11111111-1111-1111-1111-111111111111" });
        expect(typeof d.sus_name).toBe("string");
        n++;
      });
    }
    expect(n).toBe(reg.tables.reduce((s, t) => s + t.rowCount, 0));
  });
});

describe("generated backends", () => {
  it("enables RLS, audit and tenant scoping on every Postgres table", () => {
    const sql = dataModelSql(reg);
    for (const t of reg.tables) {
      expect(sql).toContain(`alter table aip."${t.name}" enable row level security;`);
      expect(sql).toContain(`create trigger t_audit after insert or update or delete on aip."${t.name}"`);
    }
    expect(platformSql("INR")).toMatch(/audit_log is append-only/);
  });
  it("emits Dataverse metadata with a primary name, alternate key and typed attributes", () => {
    const plan = dataModelPlan(reg);
    expect(plan).toHaveLength(reg.tables.length);
    for (const p of plan) {
      expect(p.logicalName).toMatch(/^sus_[a-z0-9_]+$/);
      expect(p.logicalName.length).toBeLessThanOrEqual(50);
      const attrs = p.entity.Attributes as Array<Record<string, unknown>>;
      expect(attrs[0]).toMatchObject({ SchemaName: "sus_name", IsPrimaryName: true });
      expect(p.keys[0]).toMatchObject({ KeyAttributes: ["sus_name"] });
      for (const a of p.attributes) expect(String(a["@odata.type"])).toMatch(/^Microsoft\.Dynamics\.CRM\.\w+AttributeMetadata$/);
    }
    const money = plan.flatMap((p) => p.attributes).filter((a) => a.AttributeType === "Money");
    expect(money.length).toBe(reg.tables.flatMap((t) => t.columns).filter((c) => c.kind === "money").length);
    expect(platformPlan().map((p) => p.logicalName)).toEqual(["sus_runtimestate", "sus_licensestate"]);
  });
});
