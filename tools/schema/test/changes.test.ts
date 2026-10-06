import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { changeColumns, changeModel, changesSql, MAX_CHANGE_ITEMS } from "../src/changes-sql.ts";
import { masterDefs } from "../src/masters.ts";
import { loadVocabulary } from "../src/reference.ts";
import type { Registry } from "../src/registry.ts";
import { transactionDefs } from "../src/sheet-model.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const reg = JSON.parse(readFileSync(new URL("../../../schema/aip-data-model.json", import.meta.url), "utf8")) as Registry;
const defs = [...masterDefs(reg), ...transactionDefs(reg)];

describe("phase 4 change sets", () => {
  it("lets change sets write masters, registers and transactions, never time series or system columns", () => {
    const m = changeModel(defs);
    expect(m.entities).toHaveLength(defs.length);
    for (const e of m.entities) {
      expect(e.columns.find((c) => c.name === "code")!.editable).toBe(false);
      if (e.layer === "series") expect(e.editable || e.columns.some((c) => c.editable)).toBe(false);
      expect(e.columns.find((c) => c.name === "source_ordinal")?.editable ?? false).toBe(false);
    }
    const wo = m.entities.find((e) => e.name === "work_order")!;
    expect(wo.writers).toEqual(["planner", "admin"]);
    expect(wo.columns.find((c) => c.name === "currency")).toMatchObject({ kind: "text", editable: true });
    expect(m.entities.find((e) => e.name === "site")!.writers).toEqual(["admin"]);
  });

  it("lets administrators maintain tenant vocabulary, addressing scoped rows as scope:CODE", () => {
    const m = changeModel(defs, loadVocabulary(root));
    const status = m.entities.find((e) => e.name === "ref_status")!;
    expect(status).toMatchObject({ layer: "reference", writers: ["admin"], scoped: true, view: "v_ref_status" });
    expect(status.columns.map((c) => c.name)).toEqual(["code", "label", "description", "sort_order", "is_active"]);
    expect(m.entities.find((e) => e.name === "ref_priority")!.scoped).toBeUndefined();
    const sql = changesSql(defs, loadVocabulary(root));
    expect(sql).toContain(`create view aip."v_ref_status" with (security_invoker = true) as\nselect r.id, r.tenant_id, r.scope || ':' || r.code as code`);
    expect(sql).toContain("platform vocabulary changes only with a Sustantix release");
  });

  it("maps references to their id columns and vocabulary tables", () => {
    const asset = changeColumns(defs.find((d) => d.name === "asset")!);
    expect(asset.find((c) => c.name === "site")).toMatchObject({ dbColumn: "site_id", kind: "fk", target: "site" });
    expect(asset.find((c) => c.name === "operating_status")).toMatchObject({ dbColumn: "operating_status_id", target: "ref_status", scope: "asset_operating" });
  });

  it("emits one invoker-rights apply function, metadata for every entity and a bounded, append-only log", () => {
    const sql = changesSql(defs, loadVocabulary(root));
    expect(sql).toMatch(/create or replace function aip\.apply_change_set\(p_id uuid, p_tenant uuid, p_source text, p_items jsonb\)\s+returns jsonb language plpgsql security invoker/);
    expect(sql).toContain(`between 1 and ${MAX_CHANGE_ITEMS}`);
    expect(sql).toContain("t.row_version = $4");
    expect(sql).toContain("grant select, insert on aip.change_set to authenticated");
    for (const d of defs) expect(sql).toContain(`('${d.name}', `);
    expect(sql).not.toMatch(/\b(real|double precision|float)\b/i);
    expect(sql.match(/union all/g)).toHaveLength(loadVocabulary(root).tables.length - 1);
  });
});

describe("Dataverse attribute naming", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const dv = JSON.parse(readFileSync(`${root}powerplatform/schema/change-model.json`, "utf8")) as { key: string; entities: Array<{ name: string; columns: Array<{ name: string; attribute: string }> }> };
  const tables = JSON.parse(readFileSync(`${root}powerplatform/schema/master-tables.json`, "utf8")) as { tables: Array<{ logicalName: string; attributes: Array<{ SchemaName: string }> }> };

  it("never stores a value column in the business-code attribute", () => {
    // sus_name is each table's code and alternate key: a "name" column written there would rename the record.
    expect(dv.entities.flatMap((e) => e.columns.filter((c) => c.attribute === dv.key).map((c) => `${e.name}.${c.name}`))).toEqual([]);
    expect(dv.entities.find((e) => e.name === "site")!.columns.find((c) => c.name === "name")!.attribute).toBe("sus_displayname");
  });

  it("defines each attribute of a table once", () => {
    for (const t of tables.tables) {
      const names = t.attributes.map((a) => a.SchemaName);
      expect(names.filter((n, i) => names.indexOf(n) !== i), t.logicalName).toEqual([]);
      expect(names, t.logicalName).not.toContain("sus_name");
    }
    for (const e of dv.entities) {
      const attrs = e.columns.map((c) => c.attribute);
      expect(attrs.filter((a, i) => attrs.indexOf(a) !== i), e.name).toEqual([]);
    }
  });
});
