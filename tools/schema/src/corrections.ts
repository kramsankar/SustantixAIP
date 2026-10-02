/**
 * Governed data corrections (schema/reference/corrections.json), applied in order to a working copy of the
 * workbook rows:
 *   derive — add the records the workbook references but lacks, built from the rows that reference them;
 *   remap  — change values in place (re-point a reference, detach a placeholder, move a flag to provenance).
 * The governed workbook stays untouched; corrections are applied when data is loaded into the system of record
 * and every derived record and every changed cell is logged with its source.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { attributeMetadata, lbl, logical, type EntityPlan } from "./dataverse.ts";
import type { Registry, TableDef } from "./registry.ts";
import { rowKey, type SourceRow } from "./rows.ts";

export type ValueSpec =
  | string
  | { const: unknown }
  | { template: string }
  | { column: string; transform?: "dmy_to_iso"; default?: string; map?: Record<string, unknown> };

interface CorrectionBase {
  id: string;
  title: string;
  decision: string;
  map: Record<string, ValueSpec>;
}

export interface DeriveCorrection extends CorrectionBase {
  kind?: "derive";
  target: string;
  key: string;
  source: { table: string; where: Record<string, string> };
}

export interface RemapCorrection extends CorrectionBase {
  kind: "remap";
  target: string;
  where: Record<string, string>;
}

export type Correction = DeriveCorrection | RemapCorrection;

export interface CorrectionSet {
  version: 1;
  description: string;
  corrections: Correction[];
}

export interface CorrectionEntry {
  correction: string;
  kind: "derive" | "remap";
  target: string;
  /** Row key of the derived or changed row in the target table. */
  key: string;
  /** The row as loaded, in workbook header form (the same object that sits in the corrected sheets). */
  row: SourceRow;
  sourceTable: string;
  sourceKey: string;
  /** Remaps only: each changed cell (registry column name) with its value before and after. */
  changes?: Array<{ column: string; from: unknown; to: unknown }>;
}

export interface CorrectionResult {
  /** Workbook rows with every correction applied (unchanged sheets are shared, never mutated). */
  sheets: Record<string, SourceRow[]>;
  entries: CorrectionEntry[];
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
  if (spec.map) return Object.prototype.hasOwnProperty.call(spec.map, String(raw)) ? spec.map[String(raw)] : raw;
  return spec.transform === "dmy_to_iso" ? dmyToIso(raw) : raw;
}

const matches = (t: TableDef, where: Record<string, string>, r: SourceRow) =>
  Object.entries(where).every(([col, re]) => new RegExp(re).test(String(r[header(t, col)] ?? "")));

/**
 * Applies every correction in order. Throws when a derived record would overwrite an existing one, when two
 * source rows derive conflicting identities for one key, when a correction matches nothing, or when a remap
 * changes nothing (a stale correction).
 */
export function applyCorrections(reg: Registry, input: Record<string, SourceRow[]>, set: CorrectionSet): CorrectionResult {
  const sheets: Record<string, SourceRow[]> = { ...input };
  const owned = new Set<string>();
  const own = (sheet: string) => {
    if (!owned.has(sheet)) {
      sheets[sheet] = (sheets[sheet] ?? []).map((r) => ({ ...r }));
      owned.add(sheet);
    }
    return sheets[sheet]!;
  };
  const entries: CorrectionEntry[] = [];
  const derivedBy = new Map<string, string>();
  for (const c of set.corrections) {
    const tgt = table(reg, c.target);
    for (const col of Object.keys(c.map)) header(tgt, col);
    if (c.kind === "remap") {
      const rows = own(tgt.sheet);
      let n = 0;
      rows.forEach((r, i) => {
        if (!matches(tgt, c.where, r)) return;
        const before = { ...r };
        const changes: CorrectionEntry["changes"] = [];
        for (const [col, spec] of Object.entries(c.map)) {
          const h = header(tgt, col);
          const next = value(spec, tgt, before);
          if (String(before[h] ?? "") !== String(next ?? "")) {
            changes.push({ column: col, from: before[h] ?? null, to: next });
            r[h] = next;
          }
        }
        if (!changes.length) return;
        n++;
        const key = rowKey(tgt, before, i);
        entries.push({ correction: c.id, kind: "remap", target: c.target, key, row: r, sourceTable: c.target, sourceKey: key, changes });
      });
      if (!n) throw new Error(`${c.id}: changes nothing; remove it or fix its filter`);
      continue;
    }
    const src = table(reg, c.source.table);
    const tgtKey = header(tgt, c.key);
    const existing = new Set((sheets[tgt.sheet] ?? []).map((r) => String(r[tgtKey] ?? "")));
    const byKey = new Map<string, CorrectionEntry>();
    for (const r of sheets[src.sheet] ?? []) {
      if (!matches(src, c.source.where, r)) continue;
      const row: SourceRow = {};
      for (const [col, spec] of Object.entries(c.map)) row[header(tgt, col)] = value(spec, src, r);
      const key = String(row[tgtKey] ?? "");
      if (!key) throw new Error(`${c.id}: derived record without ${c.key}`);
      if (existing.has(key)) continue; // already in the register: nothing to correct
      const prev = byKey.get(key);
      if (prev) {
        // Several source rows may describe the same record; its identity must agree.
        for (const col of ["plant_id", "asset_tag", "asset_class", "asset_id"].filter((x) => x in c.map)) {
          const h = header(tgt, col);
          if (String(prev.row[h] ?? "") !== String(row[h] ?? "")) throw new Error(`${c.id}: ${key} has conflicting ${col} (${String(prev.row[h])} vs ${String(row[h])})`);
        }
        continue;
      }
      const owner = derivedBy.get(`${c.target}|${key}`);
      if (owner) throw new Error(`${c.id}: ${c.target} ${key} is already derived by ${owner}`);
      derivedBy.set(`${c.target}|${key}`, c.id);
      byKey.set(key, { correction: c.id, kind: "derive", target: c.target, key, row, sourceTable: src.name, sourceKey: src.key.map((k) => String(r[k] ?? "")).join(" | ") });
    }
    if (!byKey.size) throw new Error(`${c.id}: derives no records; remove it or fix its filter`);
    own(tgt.sheet).push(...[...byKey.values()].map((e) => e.row));
    entries.push(...byKey.values());
  }
  return { sheets, entries };
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Migration: the per-tenant log of applied corrections (written by loaders, readable by members, never edited). */
export function correctionLogSql(): string {
  return `-- Sustantix AIP · data-correction log
-- Generated by tools/schema — do not edit by hand. Loaders (seed, provisioning) write one row per derived record
-- or changed row, with the cells changed; members read it; nobody edits it through the API.
create table if not exists aip.data_correction (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references aip.tenants(id) on delete cascade,
  correction_id text not null check (correction_id ~ '^C[0-9]+$'),
  kind text not null default 'derive' check (kind in ('derive','remap')),
  target_table text not null,
  row_key text not null,
  source_table text not null,
  source_key text not null,
  title text not null,
  changes jsonb,
  applied_at timestamptz not null default now(),
  unique (tenant_id, correction_id, target_table, row_key)
);
alter table aip.data_correction add column if not exists kind text not null default 'derive' check (kind in ('derive','remap'));
alter table aip.data_correction add column if not exists changes jsonb;
create index if not exists data_correction_target_idx on aip.data_correction(tenant_id, target_table, row_key);
alter table aip.data_correction enable row level security;
drop policy if exists p_read on aip.data_correction;
create policy p_read on aip.data_correction for select to authenticated using (aip.has_role(tenant_id));
grant select on aip.data_correction to authenticated;
grant all on aip.data_correction to service_role;
`;
}

const changesJson = (e: CorrectionEntry) => (e.changes ? JSON.stringify(e.changes) : null);

/** Seed statements recording each correction against the tenant. */
export function correctionLogInsert(set: CorrectionSet, entries: CorrectionEntry[], tenantId: string): string {
  if (!entries.length) return "";
  const title = new Map(set.corrections.map((c) => [c.id, c.title]));
  const rows = entries.map((e) => {
    const ch = changesJson(e);
    return `(${[lit(tenantId), lit(e.correction), lit(e.kind), lit(e.target), lit(e.key), lit(e.sourceTable), lit(e.sourceKey), lit(title.get(e.correction)!), ch ? `${lit(ch)}::jsonb` : "null"].join(",")})`;
  });
  return `insert into aip.data_correction (tenant_id, correction_id, kind, target_table, row_key, source_table, source_key, title, changes) values\n${rows.join(",\n")}\non conflict (tenant_id, correction_id, target_table, row_key) do update set kind = excluded.kind, source_table = excluded.source_table, source_key = excluded.source_key, title = excluded.title, changes = excluded.changes;`;
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
      Description: lbl("Records derived and values changed by governed data corrections (schema/reference/corrections.json)."),
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
      attributeMetadata({ name: "kind", label: "Kind", kind: "text", maxLength: 10 }),
      attributeMetadata({ name: "targettable", label: "Target table", kind: "text", maxLength: 100 }),
      attributeMetadata({ name: "rowkey", label: "Row key", kind: "text", maxLength: 200 }),
      attributeMetadata({ name: "sourcetable", label: "Source table", kind: "text", maxLength: 100 }),
      attributeMetadata({ name: "sourcekey", label: "Source key", kind: "text", maxLength: 200 }),
      attributeMetadata({ name: "title", label: "Correction title", kind: "text", maxLength: 300 }),
      attributeMetadata({ name: "changes", label: "Changed cells (JSON)", kind: "memo", maxLength: 10000 }),
    ],
    keys: [{ SchemaName: logical("datacorrection_bk"), DisplayName: lbl("Business key"), KeyAttributes: [logical("name")] }],
  };
}

export function correctionLogRecords(set: CorrectionSet, entries: CorrectionEntry[]): Array<Record<string, unknown>> {
  const title = new Map(set.corrections.map((c) => [c.id, c.title]));
  return entries.map((e) => ({
    [logical("name")]: `${e.correction}/${e.target}/${e.key}`.slice(0, 300),
    [logical("correctionid")]: e.correction,
    [logical("kind")]: e.kind,
    [logical("targettable")]: e.target,
    [logical("rowkey")]: e.key,
    [logical("sourcetable")]: e.sourceTable,
    [logical("sourcekey")]: e.sourceKey,
    [logical("title")]: title.get(e.correction),
    [logical("changes")]: changesJson(e),
  }));
}
