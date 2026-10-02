/**
 * Governed data corrections: records derived from the rows that reference them (schema/reference/corrections.json).
 * The governed workbook stays untouched; corrections are applied when data is loaded into the system of
 * record and every derived row is logged with its correction ID and source row.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lbl, logical, type EntityPlan, attributeMetadata } from "./dataverse.ts";
import type { Registry, TableDef } from "./registry.ts";
import type { SourceRow } from "./rows.ts";

type ValueSpec = string | { const: unknown } | { template: string } | { column: string; transform?: "dmy_to_iso"; default?: string };

export interface Correction {
  id: string;
  title: string;
  decision: string;
  target: string;
  key: string;
  source: { table: string; where: Record<string, string> };
  map: Record<string, ValueSpec>;
}

export interface CorrectionSet {
  version: 1;
  description: string;
  corrections: Correction[];
}

export interface DerivedRecord {
  correction: string;
  target: string;
  key: string;
  /** Row in workbook header form, so the existing Postgres and Dataverse record builders apply unchanged. */
  row: SourceRow;
  /** Row key of the source row the record was derived from. */
  sourceTable: string;
  sourceKey: string;
}

export function loadCorrections(root: string): CorrectionSet {
  return JSON.parse(readFileSync(join(root, "schema/reference/corrections.json"), "utf8")) as CorrectionSet;
}

/** "07-01-2027 08:00" → "2027-01-07 08:00" (the register's own format). */
export function dmyToIso(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}:\d{2}))?$/.exec(String(v).trim());
  if (!m) throw new Error(`not a dd-mm-yyyy value: ${String(v)}`);
  return `${m[3]}-${m[2]}-${m[1]}${m[4] ? " " + m[4] : ""}`;
}

const table = (reg: Registry, name: string): TableDef => {
  const t = reg.tables.find((x) => x.name === name);
  if (!t) throw new Error(`unknown table ${name}`);
  return t;
};
const header = (t: TableDef, col: string): string => {
  const c = t.columns.find((x) => x.name === col);
  if (!c) throw new Error(`${t.name} has no column ${col}`);
  return c.source;
};

function fill(template: string, src: TableDef, row: SourceRow): string {
  return template.replace(/\{([a-z0-9_]+)\}/g, (_, col: string) => {
    const v = row[header(src, col)];
    return v === null || v === undefined ? "" : String(v);
  });
}

function value(spec: ValueSpec, src: TableDef, row: SourceRow): unknown {
  if (typeof spec === "string") return row[header(src, spec)] ?? null;
  if ("const" in spec) return spec.const;
  if ("template" in spec) return fill(spec.template, src, row);
  const raw = row[header(src, spec.column)];
  if (raw === null || raw === undefined || raw === "") return spec.default !== undefined ? fill(spec.default, src, row) : null;
  return spec.transform === "dmy_to_iso" ? dmyToIso(raw) : raw;
}

/**
 * Materialises every correction. Throws when a correction would overwrite an existing record, when two source
 * rows derive conflicting values for the same key, or when a mapped column does not exist.
 */
export function deriveCorrections(reg: Registry, sheets: Record<string, SourceRow[]>, set: CorrectionSet): DerivedRecord[] {
  const out: DerivedRecord[] = [];
  const taken = new Map<string, string>();
  for (const c of set.corrections) {
    const src = table(reg, c.source.table);
    const tgt = table(reg, c.target);
    for (const col of Object.keys(c.map)) header(tgt, col);
    const tgtKey = header(tgt, c.key);
    const existing = new Set((sheets[tgt.sheet] ?? []).map((r) => String(r[tgtKey] ?? "")));
    const filters = Object.entries(c.source.where).map(([col, re]) => [header(src, col), new RegExp(re)] as const);
    const srcKeyCols = src.key.map((k) => k);
    const byKey = new Map<string, DerivedRecord>();
    for (const r of sheets[src.sheet] ?? []) {
      if (!filters.every(([h, re]) => re.test(String(r[h] ?? "")))) continue;
      const row: SourceRow = {};
      for (const [col, spec] of Object.entries(c.map)) row[header(tgt, col)] = value(spec, src, r);
      const key = String(row[tgtKey] ?? "");
      if (!key) throw new Error(`${c.id}: derived record without ${c.key}`);
      if (existing.has(key)) continue; // already present in the register: nothing to correct
      const prev = byKey.get(key);
      if (prev) {
        // Several source rows may describe the same record; identity attributes must agree.
        for (const col of ["plant_id", "asset_tag", "asset_class", "asset_id"].filter((x) => x in c.map)) {
          const h = header(tgt, col);
          if (String(prev.row[h] ?? "") !== String(row[h] ?? "")) throw new Error(`${c.id}: ${key} has conflicting ${col} (${String(prev.row[h])} vs ${String(row[h])})`);
        }
        continue;
      }
      const owner = taken.get(`${c.target}|${key}`);
      if (owner) throw new Error(`${c.id}: ${c.target} ${key} is already derived by ${owner}`);
      taken.set(`${c.target}|${key}`, c.id);
      byKey.set(key, { correction: c.id, target: c.target, key, row, sourceTable: src.name, sourceKey: srcKeyCols.map((k) => String(r[k] ?? "")).join(" | ") });
    }
    if (!byKey.size) throw new Error(`${c.id}: derives no records; remove it or fix its filter`);
    out.push(...byKey.values());
  }
  return out;
}

/** Derived rows grouped by target table, in workbook header form. */
export function correctedRows(derived: DerivedRecord[]): Record<string, SourceRow[]> {
  const out: Record<string, SourceRow[]> = {};
  for (const d of derived) (out[d.target] ??= []).push(d.row);
  return out;
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Migration: the per-tenant log of applied corrections (written by loaders, readable by members, never edited). */
export function correctionLogSql(): string {
  return `-- Sustantix AIP · data-correction log
-- Generated by tools/schema — do not edit by hand. Loaders (seed, provisioning) write one row per derived record;
-- members read it; nobody edits it through the API.
create table if not exists aip.data_correction (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references aip.tenants(id) on delete cascade,
  correction_id text not null check (correction_id ~ '^C[0-9]+$'),
  target_table text not null,
  row_key text not null,
  source_table text not null,
  source_key text not null,
  title text not null,
  applied_at timestamptz not null default now(),
  unique (tenant_id, correction_id, target_table, row_key)
);
create index if not exists data_correction_target_idx on aip.data_correction(tenant_id, target_table, row_key);
alter table aip.data_correction enable row level security;
drop policy if exists p_read on aip.data_correction;
create policy p_read on aip.data_correction for select to authenticated using (aip.has_role(tenant_id));
grant select on aip.data_correction to authenticated;
grant all on aip.data_correction to service_role;
`;
}

/** Seed statements recording each derived record against the tenant. */
export function correctionLogInsert(set: CorrectionSet, derived: DerivedRecord[], tenantId: string): string {
  if (!derived.length) return "";
  const title = new Map(set.corrections.map((c) => [c.id, c.title]));
  const rows = derived.map((d) => `(${[lit(tenantId), lit(d.correction), lit(d.target), lit(d.key), lit(d.sourceTable), lit(d.sourceKey), lit(title.get(d.correction)!)].join(",")})`);
  return `insert into aip.data_correction (tenant_id, correction_id, target_table, row_key, source_table, source_key, title) values\n${rows.join(",\n")}\non conflict (tenant_id, correction_id, target_table, row_key) do update set source_table = excluded.source_table, source_key = excluded.source_key, title = excluded.title;`;
}

/** Dataverse counterpart of the correction log. */
export function correctionLogPlan(): EntityPlan {
  return {
    logicalName: logical("datacorrection"),
    entity: {
      "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
      SchemaName: logical("datacorrection"),
      DisplayName: lbl("AIP Data Correction"),
      DisplayCollectionName: lbl("AIP Data Corrections"),
      Description: lbl("Records derived by governed data corrections (schema/reference/corrections.json)."),
      OwnershipType: "OrganizationOwned",
      IsActivity: false,
      HasActivities: false,
      HasNotes: false,
      ChangeTrackingEnabled: true,
      Attributes: [
        {
          "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
          SchemaName: logical("name"),
          IsPrimaryName: true,
          AttributeType: "String",
          AttributeTypeName: { Value: "StringType" },
          MaxLength: 300,
          FormatName: { Value: "Text" },
          RequiredLevel: { Value: "ApplicationRequired", CanBeChanged: true, ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings" },
          DisplayName: lbl("Correction / table / key"),
          Description: lbl("Correction / table / key"),
        },
      ],
    },
    attributes: [
      attributeMetadata({ name: "correctionid", label: "Correction", kind: "text", maxLength: 20 }),
      attributeMetadata({ name: "targettable", label: "Target table", kind: "text", maxLength: 100 }),
      attributeMetadata({ name: "rowkey", label: "Row key", kind: "text", maxLength: 200 }),
      attributeMetadata({ name: "sourcetable", label: "Source table", kind: "text", maxLength: 100 }),
      attributeMetadata({ name: "sourcekey", label: "Source key", kind: "text", maxLength: 200 }),
      attributeMetadata({ name: "title", label: "Correction title", kind: "text", maxLength: 300 }),
    ],
    keys: [{ SchemaName: logical("datacorrection_bk"), DisplayName: lbl("Business key"), KeyAttributes: [logical("name")] }],
  };
}

export function correctionLogRecords(set: CorrectionSet, derived: DerivedRecord[]): Array<Record<string, unknown>> {
  const title = new Map(set.corrections.map((c) => [c.id, c.title]));
  return derived.map((d) => ({
    [logical("name")]: `${d.correction}/${d.target}/${d.key}`.slice(0, 300),
    [logical("correctionid")]: d.correction,
    [logical("targettable")]: d.target,
    [logical("rowkey")]: d.key,
    [logical("sourcetable")]: d.sourceTable,
    [logical("sourcekey")]: d.sourceKey,
    [logical("title")]: title.get(d.correction),
  }));
}
