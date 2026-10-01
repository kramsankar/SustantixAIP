import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { conformance, integrity, loadIntegrityRules, summarize } from "../src/conformance.ts";
import {
  REF_PREFIX,
  Resolver,
  isScoped,
  loadVocabulary,
  referencePlan,
  referenceRecords,
  referenceSql,
  tenantReferenceRows,
  validateVocabulary,
  type Vocabulary,
} from "../src/reference.ts";
import type { Registry } from "../src/registry.ts";
import { readSheets } from "../src/rows.ts";
import { seedSql } from "../src/seed-sql.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const wb = readFileSync(new URL("../../../reference/AIP_Data_v915.xlsx", import.meta.url));
const reg = JSON.parse(readFileSync(new URL("../../../schema/aip-data-model.json", import.meta.url), "utf8")) as Registry;
const sheets = readSheets(wb);
const vocab = loadVocabulary(root);
const rules = loadIntegrityRules(root);
const resolver = new Resolver(vocab);
const clone = (): Vocabulary => JSON.parse(JSON.stringify(vocab)) as Vocabulary;

describe("controlled vocabulary", () => {
  it("is internally consistent and bound only to registry columns", () => {
    expect(validateVocabulary(vocab, reg)).toEqual([]);
  });

  it("has the 16 reference tables of the target model", () => {
    expect(vocab.tables.map((t) => t.name).sort()).toEqual(
      ["asset_class", "currency", "defect_code", "emission_factor", "event_type", "failure_mode", "framework", "maintenance_type", "priority", "region", "risk_band", "severity", "skill", "source_system", "status", "unit"].sort(),
    );
  });

  it("catches broken aliases, duplicate codes, unknown columns and scope mistakes", () => {
    const v = clone();
    v.tables.find((t) => t.name === "asset_class")!.aliases.push({ alias: "Panel", code: "NOPE" });
    v.tables.find((t) => t.name === "priority")!.values.push({ code: "HIGH", label: "High again" });
    v.bindings.push({ column: "work_orders.not_a_column", ref: "priority" });
    v.bindings.push({ column: "plan_schedule.plan_status_x", ref: "status" });
    const problems = validateVocabulary(v, reg).join("\n");
    expect(problems).toContain('alias "Panel" → unknown code NOPE');
    expect(problems).toContain("duplicate code |HIGH");
    expect(problems).toContain("work_orders.not_a_column: not in the registry");
    expect(problems).toContain("scope required for status");
  });

  it("keeps codes UPPER_SNAKE and money-rate aliases explicit about currency", () => {
    for (const t of vocab.tables) for (const x of t.values) expect(x.code).toMatch(/^[A-Z0-9][A-Z0-9_-]*$/);
    const unit = vocab.tables.find((t) => t.name === "unit")!;
    for (const a of unit.aliases.filter((a) => a.code.startsWith("CUR"))) expect(a.currency).toMatch(/^[A-Z]{3}$/);
  });
});

describe("resolver", () => {
  const b = (ref: string, extra = {}) => ({ column: "x.y", ref, ...extra });
  it("resolves by code, label, alias and case-insensitively", () => {
    expect(resolver.resolve(b("priority"), "HIGH")).toMatchObject({ status: "code", code: "HIGH", via: "code" });
    expect(resolver.resolve(b("priority"), "High")).toMatchObject({ status: "code", code: "HIGH", via: "label" });
    expect(resolver.resolve(b("asset_class"), "String/Combiner")).toMatchObject({ status: "code", code: "SCB", via: "alias" });
    expect(resolver.resolve(b("asset_class"), "hv switchgear")).toMatchObject({ status: "code", code: "HV_SWITCHGEAR" });
  });
  it("carries currency and provenance implied by an alias", () => {
    expect(resolver.resolve(b("unit"), "INR/kWh")).toMatchObject({ code: "CUR_PER_KWH", alias: { currency: "INR" } });
    expect(resolver.resolve(b("source_system"), "Plant meter demo")).toMatchObject({ code: "REVENUE_METER", alias: { provenance: "demo" } });
  });
  it("respects scopes: the same label maps per entity", () => {
    expect(resolver.resolve(b("status", { scope: "work_order" }), "Completed")).toMatchObject({ code: "COMPLETED" });
    expect(resolver.resolve(b("status", { scope: "readiness" }), "Constraint")).toMatchObject({ code: "CONSTRAINED", via: "alias" });
    expect(resolver.resolve(b("status", { scope: "alert" }), "Completed")).toEqual({ status: "unmapped" });
  });
  it("handles null tokens, wildcards and fallbacks", () => {
    expect(resolver.resolve(b("priority"), "N/A")).toEqual({ status: "null" });
    expect(resolver.resolve(b("priority"), "  ")).toEqual({ status: "null" });
    expect(resolver.resolve(b("asset_class", { wildcard: "All" }), "All")).toEqual({ status: "wildcard" });
    expect(resolver.resolve(b("failure_mode", { fallbackRef: "defect_code" }), "Thermal Hotspot")).toMatchObject({ status: "fallback", ref: "defect_code", code: "HOTSPOT" });
    expect(resolver.resolve(b("failure_mode", { nullTokens: ["No confirmed functional failure"] }), "No confirmed functional failure")).toEqual({ status: "null" });
  });
});

describe("phase-1 gate on the governed workbook", () => {
  const c = conformance(reg, sheets, vocab);
  const ic = integrity(reg, sheets, rules);
  const s = summarize(c, ic);

  it("every governed value conforms or awaits a declared owner decision", () => {
    expect(s.bindings).toBe(vocab.bindings.length);
    expect(s.undeclaredGaps).toBe(0);
    expect(s.conformingValues).toBeGreaterThan(50000);
  });

  it("every unresolved reference is classified and every mechanical rule resolves what it claims", () => {
    expect(s.unclassified).toBe(0);
    expect(s.failedMechanical).toBe(0);
  });

  it("re-keys forecast validations to run × horizon and module histories to PV modules", () => {
    const fv = ic.find((x) => x.from === "fcst_validation.forecast_run_id")!;
    expect(fv.byClass.crosswalk?.values).toBe(8064);
    expect(fv.resolved).toBe(0);
    const rl = ic.find((x) => x.from === "reliability_life_history.asset_id")!;
    expect(rl.byClass.crosswalk?.values).toBe(6000);
  });

  it("does not treat zero-padding drift as the same intervention", () => {
    const opt = ic.find((x) => x.from === "pno_optimization.intervention_id")!;
    expect(opt.byClass.owner?.values).toBe(160);
    expect(opt.byClass.crosswalk).toBeUndefined();
  });

  it("flags a value outside the vocabulary when it is not declared", () => {
    const v = clone();
    v.openDecisions = v.openDecisions.filter((d) => d.ref !== "priority");
    const gaps = conformance(reg, sheets, v).find((x) => x.column === "cbm_assessments.priority")!;
    expect(gaps.undeclared.map((u) => u.value).sort()).toEqual(["P1", "P2"]);
  });
});

describe("reference SQL", () => {
  const sql = referenceSql(vocab);
  it("creates every table through the guarded helper with RLS", () => {
    for (const t of vocab.tables) expect(sql).toContain(`select aip.create_ref_table('${t.name}'`);
    expect(sql).toContain("create policy p_write on %s for all to authenticated using (tenant_id is not null and aip.has_role(tenant_id, array[''admin''])");
    expect(sql).toContain("revoke all on function aip.create_ref_table(text, text, text, boolean) from public;");
    expect(sql).toContain("alter table aip.ref_alias enable row level security;");
  });
  it("loads platform defaults idempotently and never as tenant rows", () => {
    const inserts = sql.match(/^insert into aip\.ref_\w+ \(/gm) ?? [];
    expect(inserts.length).toBe(vocab.tables.filter((t) => t.values.length).length + 2); // + aliases + bindings
    expect(sql).not.toMatch(/insert into aip\.ref_\w+ \(tenant_id/);
    for (const t of vocab.tables.filter((t) => t.values.length)) expect(sql).toContain(`on conflict ${isScoped(t) ? "(tenant_id, scope, code)" : "(tenant_id, code)"} do update`);
  });
  it("records every binding for grids and validation", () => {
    const block = sql.slice(sql.indexOf("insert into aip.ref_binding"));
    expect(block.match(/^\s+\('/gm)?.length).toBe(vocab.bindings.length);
  });
});

describe("tenant reference rows", () => {
  it("loads emission factors with resolved unit codes", () => {
    const [ef] = tenantReferenceRows(vocab, reg, sheets);
    expect(ef!.table).toBe(`${REF_PREFIX}emission_factor`);
    expect(ef!.rows.map((r) => r.unit_code)).toEqual(["TCO2E_PER_MWH", "TCO2E_PER_MWH", "KGCO2E_PER_L", "KGCO2E_PER_KG"]);
    expect(ef!.rows[0]).toMatchObject({ code: "EF-IND-GRID-CEA-001", value: 0.71, effective_from: "2026-04-01" });
  });
  it("are part of the tenant seed", () => {
    const sql = seedSql(reg, wb, { id: "00000000-0000-0000-0000-0000000000c1", name: "t", region: "IN", currency: "INR" }, vocab);
    expect(sql).toContain('insert into aip."ref_emission_factor" ("tenant_id"');
    expect(sql).toContain("on conflict (tenant_id, code) do update");
  });
});

describe("Dataverse reference layer", () => {
  const plan = referencePlan(vocab);
  it("plans one table per reference plus the alias table, keyed on the primary name", () => {
    expect(plan).toHaveLength(vocab.tables.length + 1);
    for (const p of plan) {
      expect(p.logicalName.length).toBeLessThanOrEqual(50);
      expect(p.keys[0]).toMatchObject({ KeyAttributes: ["sus_name"] });
    }
  });
  it("upserts unique primary names for every value and alias", () => {
    for (const { logicalName, records } of referenceRecords(vocab)) {
      const names = records.map((r) => r.sus_name);
      expect(new Set(names).size, logicalName).toBe(names.length);
    }
    const total = referenceRecords(vocab).reduce((n, x) => n + x.records.length, 0);
    expect(total).toBe(vocab.tables.reduce((n, t) => n + t.values.length + t.aliases.length, 0));
  });
});
