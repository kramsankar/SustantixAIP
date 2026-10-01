/**
 * Controlled vocabulary (phase 1 of the normalized model): canonical code tables, the aliases
 * observed in the governed workbook, which workbook columns each table governs, and the
 * decisions still owed by the data owner. Generates the Supabase and Dataverse reference layer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { attributeMetadata, lbl, logical, type EntityPlan } from "./dataverse.ts";
import type { Registry } from "./registry.ts";

export type RefKind = "text" | "integer" | "decimal" | "boolean" | "date";

export interface RefAttribute {
  name: string;
  kind: RefKind;
}

export interface RefValue {
  code: string;
  label: string;
  scope?: string;
  sort_order?: number;
  [attribute: string]: unknown;
}

export interface RefAlias {
  alias: string;
  code: string;
  scope?: string;
  /** ISO-4217 currency implied by the alias (for example INR/kWh → CUR_PER_KWH + INR). */
  currency?: string;
  /** Provenance implied by the alias: demo, synthetic, illustrative, configured. */
  provenance?: string;
}

export interface TenantSeed {
  sheet: string;
  map: Record<string, string | { column: string; ref: string }>;
}

export interface RefTable {
  name: string;
  label: string;
  description: string;
  /** Uniqueness within a tenant; default ["code"]. Scoped tables use ["scope", "code"]. */
  key?: string[];
  attributes: RefAttribute[];
  values: RefValue[];
  aliases: RefAlias[];
  tenantSeed?: TenantSeed;
}

export interface Binding {
  /** "<table>.<column>" in the data-model registry. */
  column: string;
  ref: string;
  scope?: string;
  /** Value meaning "applies to every code" (stored as null + flag in phase 2). */
  wildcard?: string;
  nullTokens?: string[];
  /** Second vocabulary consulted when the first has no match (polymorphic columns, split in phase 2). */
  fallbackRef?: string;
}

export interface OpenDecision {
  ref: string;
  columns: string[];
  values: string[];
  question: string;
  kind?: "map" | "confirm" | "merge" | "reclassify" | "decompose";
  /** The column stays unbound until the decision is made. */
  unbound?: boolean;
}

export interface Vocabulary {
  version: 1;
  description: string;
  nullTokens: string[];
  tables: RefTable[];
  bindings: Binding[];
  openDecisions: OpenDecision[];
}

export const REF_PREFIX = "ref_";
const CODE = /^[A-Z0-9][A-Z0-9_-]*$/;
const IDENT = /^[a-z][a-z0-9_]*$/;
const RESERVED = new Set(["id", "tenant_id", "scope", "code", "label", "description", "sort_order", "is_active", "created_at", "updated_at", "row_version"]);

export function loadVocabulary(root: string): Vocabulary {
  return JSON.parse(readFileSync(join(root, "schema/reference/vocabulary.json"), "utf8")) as Vocabulary;
}

export const isScoped = (t: RefTable) => (t.key ?? ["code"]).includes("scope");

/** Internal consistency of the vocabulary against the registry. Empty array = valid. */
export function validateVocabulary(v: Vocabulary, reg: Registry): string[] {
  const problems: string[] = [];
  const tables = new Map(v.tables.map((t) => [t.name, t]));
  if (tables.size !== v.tables.length) problems.push("duplicate reference table names");
  for (const t of v.tables) {
    if (!IDENT.test(t.name) || (REF_PREFIX + t.name).length > 40) problems.push(`${t.name}: invalid table name`);
    for (const a of t.attributes) {
      if (!IDENT.test(a.name)) problems.push(`${t.name}.${a.name}: invalid attribute name`);
      if (RESERVED.has(a.name) && a.name !== "scope") problems.push(`${t.name}.${a.name}: reserved column name`);
    }
    if (isScoped(t) && !t.attributes.some((a) => a.name === "scope")) problems.push(`${t.name}: scoped key without a scope attribute`);
    const seen = new Set<string>();
    const scopes = new Set(t.values.map((x) => x.scope ?? ""));
    for (const x of t.values) {
      if (!CODE.test(x.code)) problems.push(`${t.name}: code "${x.code}" is not UPPER_SNAKE`);
      if (!x.label?.trim()) problems.push(`${t.name}.${x.code}: empty label`);
      const k = `${isScoped(t) ? x.scope : ""}|${x.code}`;
      if (seen.has(k)) problems.push(`${t.name}: duplicate code ${k}`);
      seen.add(k);
      if (isScoped(t) && !x.scope) problems.push(`${t.name}.${x.code}: scoped value without scope`);
      for (const key of Object.keys(x)) if (!["code", "label", "scope", "sort_order"].includes(key) && !t.attributes.some((a) => a.name === key)) problems.push(`${t.name}.${x.code}: unknown attribute ${key}`);
      for (const a of t.attributes) {
        const val = x[a.name];
        if (val === undefined || val === null) continue;
        const ok = a.kind === "text" || a.kind === "date" ? typeof val === "string" : a.kind === "boolean" ? typeof val === "boolean" : typeof val === "number";
        if (!ok) problems.push(`${t.name}.${x.code}.${a.name}: expected ${a.kind}`);
      }
      if (typeof x.parent_code === "string" && !t.values.some((p) => p.code === x.parent_code)) problems.push(`${t.name}.${x.code}: parent ${x.parent_code} missing`);
    }
    const aliasSeen = new Set<string>();
    for (const al of t.aliases) {
      const k = `${al.scope ?? ""}|${al.alias.toLowerCase()}`;
      if (aliasSeen.has(k)) problems.push(`${t.name}: duplicate alias "${al.alias}"`);
      aliasSeen.add(k);
      if (!t.values.some((x) => x.code === al.code && (!isScoped(t) || x.scope === al.scope))) problems.push(`${t.name}: alias "${al.alias}" → unknown code ${al.code}`);
      if (al.currency && !tables.get("currency")?.values.some((c) => c.code === al.currency)) problems.push(`${t.name}: alias "${al.alias}" → unknown currency ${al.currency}`);
    }
    if (isScoped(t)) for (const al of t.aliases) if (!al.scope || !scopes.has(al.scope)) problems.push(`${t.name}: alias "${al.alias}" needs a known scope`);
  }
  const columnExists = (ref: string) => {
    const [tn, cn] = ref.split(".");
    return reg.tables.some((t) => t.name === tn && t.columns.some((c) => c.name === cn));
  };
  const bound = new Set<string>();
  for (const b of v.bindings) {
    if (bound.has(b.column)) problems.push(`${b.column}: bound twice`);
    bound.add(b.column);
    if (!columnExists(b.column)) problems.push(`${b.column}: not in the registry`);
    const t = tables.get(b.ref);
    if (!t) { problems.push(`${b.column}: unknown reference ${b.ref}`); continue; }
    if (isScoped(t) !== !!b.scope) problems.push(`${b.column}: scope ${isScoped(t) ? "required" : "not allowed"} for ${b.ref}`);
    if (b.scope && !t.values.some((x) => x.scope === b.scope)) problems.push(`${b.column}: unknown scope ${b.scope}`);
    if (b.fallbackRef && !tables.has(b.fallbackRef)) problems.push(`${b.column}: unknown fallback ${b.fallbackRef}`);
  }
  for (const d of v.openDecisions) {
    if (!tables.has(d.ref)) problems.push(`decision on unknown reference ${d.ref}`);
    for (const c of d.columns) if (!columnExists(c)) problems.push(`decision column ${c} not in the registry`);
    if (!d.question.trim()) problems.push(`decision on ${d.ref} has no question`);
  }
  for (const t of v.tables) {
    if (!t.tenantSeed) continue;
    const src = reg.tables.find((x) => x.name === t.tenantSeed!.sheet);
    if (!src) { problems.push(`${t.name}: tenant seed sheet ${t.tenantSeed.sheet} not in the registry`); continue; }
    for (const [target, from] of Object.entries(t.tenantSeed.map)) {
      if (target !== "code" && target !== "label" && !t.attributes.some((a) => a.name === target)) problems.push(`${t.name}: tenant seed target ${target} unknown`);
      const col = typeof from === "string" ? from : from.column;
      if (!src.columns.some((c) => c.name === col)) problems.push(`${t.name}: tenant seed column ${col} not in ${src.name}`);
    }
  }
  return problems;
}

export type Resolution =
  | { status: "code"; code: string; via: "code" | "label" | "alias"; alias?: RefAlias }
  | { status: "fallback"; ref: string; code: string; via: "code" | "label" | "alias" }
  | { status: "null" }
  | { status: "wildcard" }
  | { status: "unmapped" };

/** Maps raw workbook values to canonical codes. Exact matches win over case-insensitive ones. */
export class Resolver {
  private readonly tables: Map<string, RefTable>;
  constructor(private readonly v: Vocabulary) {
    this.tables = new Map(v.tables.map((t) => [t.name, t]));
  }

  table(name: string): RefTable {
    const t = this.tables.get(name);
    if (!t) throw new Error(`unknown reference table ${name}`);
    return t;
  }

  private lookup(ref: string, scope: string | undefined, value: string): { code: string; via: "code" | "label" | "alias"; alias?: RefAlias } | undefined {
    const t = this.table(ref);
    const inScope = <T extends { scope?: string }>(x: T) => !isScoped(t) || x.scope === scope;
    const values = t.values.filter(inScope);
    const aliases = t.aliases.filter(inScope);
    const lower = value.toLowerCase();
    const byCode = values.find((x) => x.code === value);
    if (byCode) return { code: byCode.code, via: "code" };
    const byLabel = values.find((x) => x.label === value);
    if (byLabel) return { code: byLabel.code, via: "label" };
    const byAlias = aliases.find((a) => a.alias === value);
    if (byAlias) return { code: byAlias.code, via: "alias", alias: byAlias };
    const ciLabel = values.find((x) => x.label.toLowerCase() === lower);
    if (ciLabel) return { code: ciLabel.code, via: "label" };
    const ciAlias = aliases.find((a) => a.alias.toLowerCase() === lower);
    if (ciAlias) return { code: ciAlias.code, via: "alias", alias: ciAlias };
    return undefined;
  }

  resolve(b: Binding, raw: unknown): Resolution {
    if (raw === null || raw === undefined) return { status: "null" };
    const value = String(raw).trim();
    if (!value || this.v.nullTokens.includes(value) || b.nullTokens?.includes(value)) return { status: "null" };
    if (b.wildcard && value === b.wildcard) return { status: "wildcard" };
    const hit = this.lookup(b.ref, b.scope, value);
    if (hit) return { status: "code", ...hit };
    if (b.fallbackRef) {
      const fb = this.lookup(b.fallbackRef, undefined, value);
      if (fb) return { status: "fallback", ref: b.fallbackRef, code: fb.code, via: fb.via };
    }
    return { status: "unmapped" };
  }
}

// ── Postgres ────────────────────────────────────────────────────────────────

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const pgKind: Record<RefKind, string> = { text: "text", integer: "integer", decimal: "numeric(24,10)", boolean: "boolean", date: "date" };

function sqlValue(kind: RefKind | "text", v: unknown): string {
  if (v === undefined || v === null) return "null";
  if (kind === "integer" || kind === "decimal") {
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`not a number: ${String(v)}`);
    return String(v);
  }
  if (kind === "boolean") return v ? "true" : "false";
  return lit(String(v));
}

function platformRowsSql(t: RefTable): string {
  if (!t.values.length) return "";
  const attrs = t.attributes.filter((a) => a.name !== "scope");
  const cols = [...(isScoped(t) ? ["scope"] : []), "code", "label", "sort_order", ...attrs.map((a) => a.name)];
  const rows = t.values.map((x, i) =>
    `(${[...(isScoped(t) ? [sqlValue("text", x.scope)] : []), sqlValue("text", x.code), sqlValue("text", x.label), String(x.sort_order ?? i + 1), ...attrs.map((a) => sqlValue(a.kind, x[a.name]))].join(", ")})`,
  );
  const conflict = isScoped(t) ? "(tenant_id, scope, code)" : "(tenant_id, code)";
  const updates = cols.filter((c) => c !== "code" && c !== "scope").map((c) => `${c} = excluded.${c}`);
  return `insert into aip.${REF_PREFIX}${t.name} (${cols.join(", ")}) values\n  ${rows.join(",\n  ")}\non conflict ${conflict} do update set ${updates.join(", ")};`;
}

/** Supabase migration for the reference layer: tables, platform defaults, aliases and bindings. */
export function referenceSql(v: Vocabulary): string {
  const out: string[] = [
    `-- Sustantix AIP · reference data (phase 1 of the normalized model)
-- Generated by tools/schema from schema/reference/vocabulary.json — do not edit by hand.
-- Rows with tenant_id null are platform defaults (read by every member, changed only by migrations);
-- tenant rows extend or override them and are writable by that tenant's administrators.

-- Audits tenant rows only: platform defaults change through versioned migrations.
create or replace function aip.audit_ref_row() returns trigger language plpgsql security definer set search_path = aip, pg_temp as $$
declare
  t uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  if t is not null then
    insert into aip.audit_log(tenant_id, actor, action, entity, entity_key, before, after)
    values (t, auth.uid(), lower(tg_op), tg_table_name, coalesce(new.code, old.code),
            case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
            case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  end if;
  return coalesce(new, old);
end $$;

-- Keeps updated_at current and increments row_version on every update (optimistic concurrency).
create or replace function aip.touch_versioned() returns trigger language plpgsql set search_path = aip, pg_temp as $$
begin
  new.updated_at := now();
  new.row_version := old.row_version + 1;
  return new;
end $$;

-- Creates (idempotently) one reference table with the standard columns, row-level security and triggers.
-- Migration-only: executes the supplied column DDL, so no application role may call it.
create or replace function aip.create_ref_table(p_name text, p_label text, p_columns text, p_scoped boolean)
returns void language plpgsql set search_path = aip, pg_temp as $fn$
declare
  t text := format('aip.%I', 'ref_' || p_name);
begin
  if p_name !~ '^[a-z][a-z0-9_]*$' then raise exception 'invalid reference table name %', p_name; end if;
  execute format(
    'create table if not exists %s (id uuid primary key default gen_random_uuid(), tenant_id uuid references aip.tenants(id) on delete cascade, %s code text not null check (code ~ ''^[A-Z0-9][A-Z0-9_-]*$''), label text not null check (length(label) between 1 and 300), description text, sort_order integer not null default 0, is_active boolean not null default true%s, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), row_version bigint not null default 1, unique nulls not distinct (tenant_id, %scode))',
    t, case when p_scoped then 'scope text not null check (scope ~ ''^[a-z][a-z0-9_]*$''),' else '' end,
    case when p_columns = '' then '' else ', ' || p_columns end,
    case when p_scoped then 'scope, ' else '' end);
  execute format('comment on table %s is %L', t, 'Reference data: ' || p_label);
  execute format('alter table %s enable row level security', t);
  execute format('drop policy if exists p_read on %s', t);
  execute format('create policy p_read on %s for select to authenticated using (tenant_id is null or aip.has_role(tenant_id))', t);
  execute format('drop policy if exists p_write on %s', t);
  execute format('create policy p_write on %s for all to authenticated using (tenant_id is not null and aip.has_role(tenant_id, array[''admin''])) with check (tenant_id is not null and aip.has_role(tenant_id, array[''admin'']))', t);
  execute format('drop trigger if exists t_audit on %s', t);
  execute format('create trigger t_audit after insert or update or delete on %s for each row execute function aip.audit_ref_row()', t);
  execute format('drop trigger if exists t_touch on %s', t);
  execute format('create trigger t_touch before update on %s for each row execute function aip.touch_versioned()', t);
  execute format('grant select, insert, update, delete on %s to authenticated', t);
  execute format('grant all on %s to service_role', t);
end $fn$;
revoke all on function aip.create_ref_table(text, text, text, boolean) from public;
`,
  ];
  for (const t of v.tables) {
    const cols = t.attributes.filter((a) => a.name !== "scope").map((a) => `${a.name} ${pgKind[a.kind]}`).join(", ");
    out.push(`-- ${t.label}: ${t.values.length} platform value(s), ${t.aliases.length} alias(es)\nselect aip.create_ref_table(${lit(t.name)}, ${lit(t.label)}, ${lit(cols)}, ${isScoped(t)});`);
    const rows = platformRowsSql(t);
    if (rows) out.push(rows);
  }

  out.push(`
-- Observed spellings mapped to canonical codes (currency and provenance carried where the alias implies them).
create table if not exists aip.ref_alias (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references aip.tenants(id) on delete cascade,
  ref_table text not null check (ref_table ~ '^[a-z][a-z0-9_]*$'),
  scope text,
  alias text not null check (length(alias) between 1 and 300),
  code text not null,
  currency char(3) check (currency ~ '^[A-Z]{3}$'),
  provenance text check (provenance in ('demo','synthetic','illustrative','configured')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1,
  unique nulls not distinct (tenant_id, ref_table, scope, alias)
);
alter table aip.ref_alias enable row level security;
drop policy if exists p_read on aip.ref_alias;
create policy p_read on aip.ref_alias for select to authenticated using (tenant_id is null or aip.has_role(tenant_id));
drop policy if exists p_write on aip.ref_alias;
create policy p_write on aip.ref_alias for all to authenticated
  using (tenant_id is not null and aip.has_role(tenant_id, array['admin'])) with check (tenant_id is not null and aip.has_role(tenant_id, array['admin']));
drop trigger if exists t_touch on aip.ref_alias;
create trigger t_touch before update on aip.ref_alias for each row execute function aip.touch_versioned();
create or replace function aip.audit_alias_row() returns trigger language plpgsql security definer set search_path = aip, pg_temp as $$
declare
  t uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  if t is not null then
    insert into aip.audit_log(tenant_id, actor, action, entity, entity_key, before, after)
    values (t, auth.uid(), lower(tg_op), 'ref_alias', coalesce(new.ref_table || ':' || new.alias, old.ref_table || ':' || old.alias),
            case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
            case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists t_audit on aip.ref_alias;
create trigger t_audit after insert or update or delete on aip.ref_alias for each row execute function aip.audit_alias_row();`);
  const aliasRows = v.tables.flatMap((t) => t.aliases.map((a) => `(${[lit(t.name), a.scope ? lit(a.scope) : "null", lit(a.alias), lit(a.code), a.currency ? lit(a.currency) : "null", a.provenance ? lit(a.provenance) : "null"].join(", ")})`));
  if (aliasRows.length)
    out.push(`insert into aip.ref_alias (ref_table, scope, alias, code, currency, provenance) values\n  ${aliasRows.join(",\n  ")}\non conflict (tenant_id, ref_table, scope, alias) do update set code = excluded.code, currency = excluded.currency, provenance = excluded.provenance;`);

  out.push(`
-- Which data-model column each reference table governs (drives grid dropdowns and validation).
create table if not exists aip.ref_binding (
  table_name text not null,
  column_name text not null,
  ref_table text not null,
  scope text,
  wildcard text,
  fallback_ref text,
  primary key (table_name, column_name)
);
alter table aip.ref_binding enable row level security;
drop policy if exists p_read on aip.ref_binding;
create policy p_read on aip.ref_binding for select to authenticated using (true);
delete from aip.ref_binding;`);
  const bindingRows = v.bindings.map((b) => {
    const [tn, cn] = b.column.split(".");
    return `(${[lit(tn!), lit(cn!), lit(b.ref), b.scope ? lit(b.scope) : "null", b.wildcard ? lit(b.wildcard) : "null", b.fallbackRef ? lit(b.fallbackRef) : "null"].join(", ")})`;
  });
  out.push(`insert into aip.ref_binding (table_name, column_name, ref_table, scope, wildcard, fallback_ref) values\n  ${bindingRows.join(",\n  ")};`);
  out.push(`
grant select, insert, update, delete on aip.ref_alias to authenticated;
grant select on aip.ref_binding to authenticated;
grant all on aip.ref_alias, aip.ref_binding to service_role;
`);
  return out.join("\n");
}

/** Tenant rows for reference tables that tenants govern themselves (emission factors). */
export function tenantReferenceRows(v: Vocabulary, reg: Registry, sheets: Record<string, Array<Record<string, unknown>>>): Array<{ table: string; rows: Array<Record<string, unknown>> }> {
  const resolver = new Resolver(v);
  const out: Array<{ table: string; rows: Array<Record<string, unknown>> }> = [];
  for (const t of v.tables) {
    if (!t.tenantSeed) continue;
    const src = reg.tables.find((x) => x.name === t.tenantSeed!.sheet);
    if (!src) throw new Error(`${t.name}: tenant seed sheet ${t.tenantSeed.sheet} not in the registry`);
    const header = (col: string) => src.columns.find((c) => c.name === col)?.source ?? col;
    const rows = (sheets[src.sheet] ?? []).map((r, i) => {
      const rec: Record<string, unknown> = { sort_order: i + 1 };
      for (const [target, from] of Object.entries(t.tenantSeed!.map)) {
        const col = typeof from === "string" ? from : from.column;
        const raw = r[header(col)] ?? null;
        if (typeof from === "string") rec[target] = raw === "" ? null : raw;
        else {
          const res = resolver.resolve({ column: `${src.name}.${col}`, ref: from.ref }, raw);
          if (res.status !== "code" && res.status !== "null") throw new Error(`${t.name}: "${String(raw)}" has no ${from.ref} code`);
          rec[target] = res.status === "code" ? res.code : null;
        }
      }
      return rec;
    });
    out.push({ table: REF_PREFIX + t.name, rows });
  }
  return out;
}

// ── Dataverse ───────────────────────────────────────────────────────────────

const dvKind: Record<RefKind, "text" | "integer" | "decimal" | "boolean" | "date"> = { text: "text", integer: "integer", decimal: "decimal", boolean: "boolean", date: "date" };

/** Dataverse tables for the reference layer. The primary name is the code ("scope/code" when scoped). */
export function referencePlan(v: Vocabulary): EntityPlan[] {
  const plan = (name: string, label: string, plural: string, description: string, primary: string, attrs: Array<{ name: string; label: string; kind: RefKind | "memo"; maxLength?: number }>): EntityPlan => ({
    logicalName: logical(name),
    entity: {
      "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
      SchemaName: logical(name),
      DisplayName: lbl(label),
      DisplayCollectionName: lbl(plural),
      Description: lbl(description),
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
          MaxLength: 200,
          FormatName: { Value: "Text" },
          RequiredLevel: { Value: "ApplicationRequired", CanBeChanged: true, ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings" },
          DisplayName: lbl(primary),
          Description: lbl(primary),
        },
      ],
    },
    attributes: attrs.map((a) => attributeMetadata({ name: a.name, label: a.label, kind: a.kind === "memo" ? "memo" : dvKind[a.kind], maxLength: a.maxLength ?? 300, precision: 10 })),
    keys: [{ SchemaName: logical(`${name}_bk`), DisplayName: lbl("Business key"), KeyAttributes: [logical("name")] }],
  });
  const tables = v.tables.map((t) =>
    plan(`${REF_PREFIX}${t.name}`, `Ref: ${t.label}`, `Ref: ${t.label}`, t.description, isScoped(t) ? "Scope / code" : "Code", [
      { name: "code", label: "Code", kind: "text", maxLength: 100 },
      { name: "label", label: "Label", kind: "text" },
      { name: "description", label: "Description", kind: "memo", maxLength: 4000 },
      { name: "sortorder", label: "Sort order", kind: "integer" },
      { name: "isactive", label: "Active", kind: "boolean" },
      ...t.attributes.map((a) => ({ name: a.name.replace(/_/g, ""), label: a.name.replace(/_/g, " "), kind: a.kind })),
    ]),
  );
  tables.push(
    plan(`${REF_PREFIX}alias`, "Ref: Alias", "Ref: Aliases", "Observed spellings mapped to canonical reference codes.", "Table / scope / alias", [
      { name: "reftable", label: "Reference table", kind: "text", maxLength: 100 },
      { name: "scope", label: "Scope", kind: "text", maxLength: 100 },
      { name: "alias", label: "Alias", kind: "text" },
      { name: "code", label: "Code", kind: "text", maxLength: 100 },
      { name: "currency", label: "Currency", kind: "text", maxLength: 3 },
      { name: "provenance", label: "Provenance", kind: "text", maxLength: 20 },
    ]),
  );
  return tables;
}

/** Dataverse upsert records (keyed on sus_name) for the platform values and aliases. */
export function referenceRecords(v: Vocabulary): Array<{ logicalName: string; records: Array<Record<string, unknown>> }> {
  const out = v.tables.map((t) => ({
    logicalName: logical(`${REF_PREFIX}${t.name}`),
    records: t.values.map((x, i) => {
      const rec: Record<string, unknown> = {
        [logical("name")]: isScoped(t) ? `${x.scope}/${x.code}` : x.code,
        [logical("code")]: x.code,
        [logical("label")]: x.label,
        [logical("sortorder")]: x.sort_order ?? i + 1,
        [logical("isactive")]: true,
      };
      for (const a of t.attributes) if (x[a.name] !== undefined) rec[logical(a.name.replace(/_/g, ""))] = x[a.name];
      return rec;
    }),
  }));
  out.push({
    logicalName: logical(`${REF_PREFIX}alias`),
    records: v.tables.flatMap((t) =>
      t.aliases.map((a) => ({
        [logical("name")]: `${t.name}/${a.scope ?? ""}/${a.alias}`.slice(0, 200),
        [logical("reftable")]: t.name,
        [logical("scope")]: a.scope ?? null,
        [logical("alias")]: a.alias,
        [logical("code")]: a.code,
        [logical("currency")]: a.currency ?? null,
        [logical("provenance")]: a.provenance ?? null,
      })),
    ),
  });
  return out;
}
