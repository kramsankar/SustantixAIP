import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadIntegrityRules } from "../src/conformance.ts";
import { applyCorrections, loadCorrections } from "../src/corrections.ts";
import { lookupName, masterPlan, masterRecords, masterRelationships } from "../src/master-dataverse.ts";
import { dbColumn, masterSeedSql, mastersSql } from "../src/master-sql.ts";
import { logical } from "../src/dataverse.ts";
import { buildMasters, isoDateTime, masterDefs, mergeResolution, phase2Report, slug, topoOrder, type MasterBuild } from "../src/masters.ts";
import { loadVocabulary } from "../src/reference.ts";
import type { Registry } from "../src/registry.ts";
import { readSheets, type SourceRow } from "../src/rows.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const reg = JSON.parse(readFileSync(new URL("../../../schema/aip-data-model.json", import.meta.url), "utf8")) as Registry;
const sheets = readSheets(readFileSync(new URL("../../../reference/AIP_Data_v915.xlsx", import.meta.url)));
const vocab = loadVocabulary(root);
const corrections = loadCorrections(root);
const built = buildMasters(reg, sheets, vocab, corrections);
const master = (b: MasterBuild, name: string) => b.masters.find((m) => m.def.name === name)!;
const row = (b: MasterBuild, name: string, code: string) => master(b, name).rows.find((r) => r.code === code)!;

describe("phase 2 masters", () => {
  it("build every master and register without a single problem", () => {
    expect(built.issues).toEqual([]);
    expect(built.masters).toHaveLength(32);
    const counts = Object.fromEntries(built.masters.map((m) => [m.def.name, m.rows.length]));
    expect(counts).toMatchObject({ site: 12, asset: 1205, asset_inverter: 323, asset_bess: 5, pv_module: 6000, part: 44, part_stock: 342, intervention: 335, scenario: 10, scenario_intervention: 166, hse_incident: 24, warranty_contract: 45, offtake_contract: 17 });
  });

  it("orders masters so every reference points to an earlier master", () => {
    const order = topoOrder(masterDefs(reg)).map((d) => d.name);
    for (const d of masterDefs(reg)) for (const c of d.columns.filter((x) => x.kind === "fk" && x.fk !== d.name)) expect(order.indexOf(c.fk!)).toBeLessThan(order.indexOf(d.name));
  });

  it("merges the two part masters and the planning materials into one part per code", () => {
    const igbt = row(built, "part", "PRT-001");
    expect(igbt.values.name).toBe("IGBT power module");
    expect(igbt.lineage.map((l) => `${l.table}:${l.role}`)).toEqual(["msi_part_master:primary", "spare_parts_master:merged"]);
    expect(row(built, "part", "PRT-B01").lineage[0]!.table).toBe("spare_parts_master");
    // C11 re-keys the planning list onto the part master; C12 adds the planning-only items.
    expect(row(built, "part", "PRT-019").lineage.map((l) => l.table)).toContain("pno_material_cost_logistics");
    expect(row(built, "part", "PRT-029").values.name).toBe("PV module clamp set");
    expect(master(built, "part").rows.filter((r) => r.lineage.some((l) => l.role === "merged")).length).toBeGreaterThanOrEqual(18);
  });

  it("merges the two intervention registers and keeps PV module interventions", () => {
    const pv = row(built, "intervention", "INT-PV-01");
    expect(pv.lineage).toEqual([expect.objectContaining({ table: "plan_interventions", role: "primary" })]);
    const first = row(built, "intervention", "INT-001");
    expect(first.lineage.map((l) => l.table)).toEqual(["pno_interventions", "plan_interventions"]);
    // dd-mm-yyyy (optimiser) and yyyy-mm-dd (planner) registers agree once both are ISO.
    expect(first.values.planned_start).toBe("2026-09-07T08:00:00");
    expect(first.values.planning_status).toMatch(/^[A-Z_]+$/);
    expect(row(built, "intervention", "INT-00001").lineage[0]!.table).toBe("pno_interventions"); // C9 candidate
  });

  it("resolves every phase 1 merge reference in its master", () => {
    const { sheets: corrected } = applyCorrections(reg, sheets, corrections);
    const merges = mergeResolution(built, corrected, reg, loadIntegrityRules(root));
    expect(merges).toHaveLength(6);
    for (const m of merges) expect(m.unresolved).toEqual([]);
    expect(merges.reduce((n, m) => n + m.values, 0)).toBeGreaterThanOrEqual(54);
    expect(phase2Report(reg, built, merges)).toContain("| `intervention` | register | 335 |");
  });

  it("drops copied attributes and keeps one hierarchy", () => {
    const asset = master(built, "asset");
    expect(asset.def.columns.map((c) => c.name)).not.toContain("plant_name");
    expect(asset.rows.filter((r) => r.values.parent).length).toBe(260);
    const inv = row(built, "asset_inverter", master(built, "asset_inverter").rows[0]!.code);
    expect(inv.values.asset).toBe(inv.code);
    expect(master(built, "asset_inverter").def.columns.map((c) => c.name)).not.toContain("inverter_tag");
  });

  it("splits product models from forecasting models", () => {
    expect(row(built, "equipment_model", "PV-MDL-DEMO-330").values.asset_class).toBe("PV_MODULE");
    expect(row(built, "ml_model", "EPM-2026.08R1")).toBeDefined();
    expect(master(built, "equipment_model").rows.some((r) => r.code === "EPM-2026.08R1")).toBe(false);
  });

  it("unpivots every priced component into the rate card with its unit", () => {
    const rc = master(built, "rate_card").rows;
    expect(new Set(rc.map((r) => r.code)).size).toBe(rc.length);
    const crew = rc.find((r) => r.code === "CREW-CREW-N-1-CREW_LABOUR_HOUR")!;
    expect(crew.values).toMatchObject({ per: "hour", subject: "CREW-N-1", subject_type: "crew" });
    expect(typeof crew.values.amount).toBe("number");
    expect(rc.filter((r) => r.code.startsWith("RATE-TARIFF-")).every((r) => r.values.unit !== null)).toBe(true);
  });

  it("derives one party per organisation name with its roles", () => {
    expect(slug("Weidmüller")).toBe("WEIDMULLER");
    expect(slug("Controls & SCADA Partner")).toBe("CONTROLS-AND-SCADA-PARTNER");
    expect(row(built, "party", "SECI")).toBeDefined();
    expect(row(built, "party_role", "SECI:OFFTAKER")).toBeDefined();
    expect(row(built, "asset_bess", master(built, "asset_bess").rows[0]!.code).values.cell_manufacturer).toMatch(/^[A-Z0-9-]+$/);
  });

  it("reports broken references, unmapped vocabulary and duplicate codes instead of loading them", () => {
    const bad: Record<string, SourceRow[]> = { ...sheets };
    const am = reg.tables.find((t) => t.name === "asset_master")!;
    const h = (c: string) => am.columns.find((x) => x.name === c)!.source;
    bad[am.sheet] = [
      ...sheets[am.sheet]!,
      { [h("asset_id")]: "AST-X-1", [h("plant_id")]: "SP-99", [h("asset_class")]: "Flux capacitor", [h("asset_tag")]: "X" },
      { ...sheets[am.sheet]![0]! },
    ];
    const b = buildMasters(reg, bad, vocab, corrections);
    const problems = b.issues.map((i) => `${i.master}.${i.column}:${i.problem}:${i.value}`);
    expect(problems).toContain("asset.site:unresolved foreign key:SP-99");
    expect(problems).toContain("asset.asset_class:unmapped reference:Flux capacitor");
    expect(problems.some((p) => p.startsWith("asset.code:duplicate code"))).toBe(true);
  });

  it("normalises workbook date-times", () => {
    expect(isoDateTime("08-09-2026 16:00")).toBe("2026-09-08T16:00:00");
    expect(isoDateTime("2026-09-08")).toBe("2026-09-08T00:00:00");
    expect(isoDateTime(null)).toBeNull();
    expect(() => isoDateTime("next Tuesday")).toThrow();
  });
});

describe("phase 2 Postgres", () => {
  const sql = mastersSql(masterDefs(reg), "INR");

  it("creates every master with tenant-safe keys, guarded vocabulary and no floating point", () => {
    for (const d of masterDefs(reg)) expect(sql).toContain(`select aip.create_master_table('${d.name}'`);
    expect(sql).toContain("select aip.ensure_master_fk('asset', 'site_id', 'site', false);");
    expect(sql).toContain("select aip.ensure_master_fk('asset_inverter', 'asset_id', 'asset', true);");
    expect(sql).toMatch(/create trigger t_ref_guard before insert or update on aip\."asset" .*'asset_class_id', 'ref_asset_class'/);
    expect(sql).not.toMatch(/\b(real|double precision|float)\b/i);
    expect(sql).toContain("unique (tenant_id, id)");
    expect(sql).toContain("revoke all on function aip.create_master_table(text, text, text, char, text[]) from public;");
  });

  it("lets planners write registers and only administrators write masters", () => {
    expect(sql).toContain("select aip.create_master_table('intervention', 'Intervention', $cols$");
    expect(sql).toMatch(/create_master_table\('intervention'.*array\['planner','admin'\]\);/);
    expect(sql).toMatch(/create_master_table\('asset'.*array\['admin'\]\);/);
  });

  it("seeds by joining on business codes, with self-references in a second pass", () => {
    const seed = masterSeedSql(built.masters, "00000000-0000-0000-0000-0000000000c1", "INR");
    expect(seed).toContain(`left join aip."site" j0 on j0.tenant_id = '00000000-0000-0000-0000-0000000000c1' and j0.code = v."site"`);
    expect(seed).toMatch(/update aip\."asset" m set "parent_id" = p\.id/);
    expect(seed).toContain("on conflict (tenant_id, code) do update set");
    expect(seed).toContain("insert into aip.master_lineage");
    expect(dbColumn({ name: "site", label: "Site", kind: "fk", fk: "site" })).toBe("site_id");
  });
});

describe("phase 2 Dataverse", () => {
  const defs = masterDefs(reg);
  const plans = masterPlan(defs);

  it("names every table, column and lookup within Dataverse limits and without collisions", () => {
    const sheetTables = new Set(reg.tables.map((t) => logical(t.name)));
    for (const p of plans) {
      expect(sheetTables.has(p.logicalName)).toBe(false);
      expect(p.logicalName.length).toBeLessThanOrEqual(50);
    }
    for (const d of defs) {
      const names = [
        ...plans.find((p) => p.logicalName === logical(d.name))!.attributes.map((a) => String(a.SchemaName)),
        ...d.columns.filter((c) => c.kind === "fk" || c.kind === "ref").map(lookupName),
      ];
      expect(new Set(names).size).toBe(names.length);
      expect(names).not.toContain(`${logical(d.name)}id`);
      for (const n of names) expect(n.length).toBeLessThanOrEqual(50);
    }
  });

  it("declares one restricted relationship per reference column", () => {
    const rels = masterRelationships(defs);
    expect(rels.length).toBe(defs.reduce((n, d) => n + d.columns.filter((c) => c.kind === "fk" || c.kind === "ref").length, 0));
    expect(new Set(rels.map((r) => r.schemaName)).size).toBe(rels.length);
    const site = rels.find((r) => r.schemaName === "sus_asset_site")!.payload;
    expect(site).toMatchObject({ ReferencedEntity: "sus_site", ReferencedAttribute: "sus_siteid", ReferencingEntity: "sus_asset" });
    expect((site.CascadeConfiguration as Record<string, string>).Delete).toBe("Restrict");
  });

  it("binds lookups by business code and defers self-references", () => {
    const sets = (ln: string) => `${ln}s`;
    const recs = masterRecords(built.masters, vocab, sets, "00000000-0000-0000-0000-0000000000aa");
    const asset = recs.find((r) => r.logicalName === "sus_asset")!;
    expect(asset.records).toHaveLength(1205);
    expect(asset.links).toHaveLength(260);
    expect(asset.records.some((r) => "sus_parentid@odata.bind" in r)).toBe(false);
    const part = recs.find((r) => r.logicalName === "sus_part")!.records[0]!;
    expect(part["transactioncurrencyid@odata.bind"]).toBe("/transactioncurrencies(00000000-0000-0000-0000-0000000000aa)");
    expect(() => masterRecords(built.masters, vocab, sets)).toThrow(/transaction currency/);
  });
});
