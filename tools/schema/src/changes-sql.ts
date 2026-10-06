/**
 * Phase 4: the change-set write path. Every edit from a grid or the runtime arrives as one change set: a list of
 * row changes (insert, update, delete) addressed by entity and business code, each update or delete carrying the
 * row_version it was read at. aip.apply_change_set applies a set in one transaction with the caller's own rights
 * (security invoker, so row-level security decides), resolves references from business codes, refuses a stale
 * version with the current row, replays a set already applied under the same id, and tags every audit entry with
 * the change set that caused it. Saved grid views and audited exports complete the grid contract.
 */
import { dbColumn, writers } from "./master-sql.ts";
import type { MasterColumn, MasterDef } from "./masters.ts";
import { isScoped, type Vocabulary } from "./reference.ts";

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Largest change set the database accepts; the API enforces the same bound before calling it. */
export const MAX_CHANGE_ITEMS = 500;

/** SQLSTATEs raised by apply_change_set beyond the standard ones (23503, 23505, 42501, 22023). */
export const CHANGE_ERRORS = { conflict: "AX409", notFound: "AX404" } as const;

/** Columns the platform maintains: never written through a change set. */
const SYSTEM_COLUMNS = new Set(["source_ordinal"]);

/** Time series are written by administrators and integrations in bulk, never cell by cell. */
export const editableEntity = (d: MasterDef) => d.layer !== "series";

export interface ChangeColumn {
  name: string;
  dbColumn: string;
  kind: MasterColumn["kind"];
  target: string | null;
  scope: string | null;
  editable: boolean;
}

/** The writable surface of one entity: its own columns, then is_active and, where it holds money, currency. */
export function changeColumns(d: MasterDef): ChangeColumn[] {
  const own = d.columns.map((c): ChangeColumn => ({
    name: c.name,
    dbColumn: dbColumn(c),
    kind: c.kind,
    target: c.kind === "fk" ? c.fk! : c.kind === "ref" ? `ref_${c.ref}` : null,
    scope: c.kind === "ref" ? (c.scope ?? null) : null,
    editable: editableEntity(d) && !SYSTEM_COLUMNS.has(c.name),
  }));
  const extra: ChangeColumn[] = [{ name: "is_active", dbColumn: "is_active", kind: "boolean", target: null, scope: null, editable: editableEntity(d) }];
  if (d.columns.some((c) => c.kind === "money")) extra.push({ name: "currency", dbColumn: "currency", kind: "text", target: null, scope: null, editable: editableEntity(d) });
  return [...own, ...extra];
}

/**
 * Vocabulary tables as change-set entities: administrators add the tenant's own codes and maintain their label,
 * description, order and active flag. Platform codes (tenant_id null) change only with a Sustantix release. A scoped
 * table (status) addresses a row as "scope:CODE", because a code repeats across scopes.
 */
export interface RefEntity {
  name: string;
  table: string;
  label: string;
  scoped: boolean;
}

export const refEntities = (vocab: Vocabulary): RefEntity[] => vocab.tables.map((t) => ({ name: `ref_${t.name}`, table: t.name, label: `${t.label} (reference)`, scoped: isScoped(t) }));

const REF_COLUMNS: Array<{ name: string; label: string; kind: MasterColumn["kind"] }> = [
  { name: "label", label: "Label", kind: "text" },
  { name: "description", label: "Description", kind: "text" },
  { name: "sort_order", label: "Order", kind: "integer" },
  { name: "is_active", label: "Active", kind: "boolean" },
];

const arr = (xs: string[]) => `array[${xs.map(lit).join(",")}]::text[]`;
const nul = (s: string | null) => (s === null ? "null" : lit(s));

export function changesSql(defs: MasterDef[], vocab: Vocabulary): string {
  const refs = vocab.tables.map((t) => `select r.tenant_id, ${lit(t.name)}::text as ref_table, ${isScoped(t) ? "r.scope" : "null::text"} as scope, r.code, r.label, r.description, r.sort_order, r.is_active, r.row_version, r.updated_at from aip.${`"ref_${t.name}"`} r`);
  const refEnts = refEntities(vocab);
  const entities = [
    ...defs.map((d) => `  (${lit(d.name)}, ${lit(d.label)}, ${lit(d.layer)}, ${arr(writers(d))}, ${editableEntity(d)}, ${d.columns.some((c) => c.kind === "money")}, false)`),
    ...refEnts.map((r) => `  (${lit(r.name)}, ${lit(r.label)}, 'reference', ${arr(["admin"])}, true, false, ${r.scoped})`),
  ];
  const columns = [
    ...defs.flatMap((d) => changeColumns(d).map((c) => `  (${lit(d.name)}, ${lit(c.name)}, ${lit(c.dbColumn)}, ${lit(c.kind)}, ${nul(c.target)}, ${nul(c.scope)}, ${c.editable})`)),
    ...refEnts.flatMap((r) => REF_COLUMNS.map((c) => `  (${lit(r.name)}, ${lit(c.name)}, ${lit(c.name)}, ${lit(c.kind)}, null, null, true)`)),
  ];
  const refViews = refEnts.map((r) => [
    `drop view if exists aip.${`"v_${r.name}"`};`,
    `create view aip.${`"v_${r.name}"`} with (security_invoker = true) as\nselect r.id, r.tenant_id, ${r.scoped ? "r.scope || ':' || r.code" : "r.code"} as code, ${r.scoped ? "r.scope" : "null::text"} as scope, r.code as ref_code, r.label, r.description, r.sort_order, r.is_active, (r.tenant_id is null) as is_platform, r.row_version, r.updated_at\nfrom aip.${`"ref_${r.table}"`} r;`,
    `grant select on aip.${`"v_${r.name}"`} to authenticated, service_role;`,
  ].join("\n"));
  return `-- Sustantix AIP · phase 4: change sets, saved grid views and audited exports
-- Generated by tools/schema from src/changes-sql.ts — do not edit by hand.
-- Grids and the runtime write through aip.apply_change_set: one transaction per set, the caller's own rights,
-- optimistic concurrency on row_version (a stale version raises ${CHANGE_ERRORS.conflict} with the current row), references
-- given as business codes, idempotent replay by change-set id, and every audit entry tagged with its change set.

-- Which change set caused each audited change.
alter table aip.audit_log add column if not exists change_set_id uuid;
create index if not exists audit_log_change_set_idx on aip.audit_log(change_set_id) where change_set_id is not null;

create or replace function aip.current_change_set() returns uuid language sql stable set search_path = aip, pg_temp as $$
  select nullif(current_setting('aip.change_set_id', true), '')::uuid;
$$;

-- Master, register and transaction audit now records the change set (null outside one).
create or replace function aip.audit_master_row() returns trigger language plpgsql security definer set search_path = aip, pg_temp as $$
begin
  insert into aip.audit_log(tenant_id, actor, action, entity, entity_key, before, after, change_set_id)
  values (coalesce(new.tenant_id, old.tenant_id), auth.uid(), lower(tg_op), tg_table_name, coalesce(new.code, old.code),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
          aip.current_change_set());
  return coalesce(new, old);
end $$;
revoke all on function aip.audit_master_row() from public, anon, authenticated;

-- Tenant vocabulary audit records the change set too (platform rows change only by migration and are not audited).
create or replace function aip.audit_ref_row() returns trigger language plpgsql security definer set search_path = aip, pg_temp as $$
declare
  t uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  if t is not null then
    insert into aip.audit_log(tenant_id, actor, action, entity, entity_key, before, after, change_set_id)
    values (t, auth.uid(), lower(tg_op), tg_table_name, coalesce(new.code, old.code),
            case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
            case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
            aip.current_change_set());
  end if;
  return coalesce(new, old);
end $$;
revoke all on function aip.audit_ref_row() from public, anon, authenticated;

-- What a change set may write: platform metadata generated from the governed model, rebuilt by every migration.
create table if not exists aip.change_entity (
  name text primary key,
  label text not null,
  layer text not null,
  writers text[] not null,
  editable boolean not null,
  has_currency boolean not null
);
-- A scoped vocabulary table addresses its rows as "scope:CODE".
alter table aip.change_entity add column if not exists scoped boolean not null default false;
create table if not exists aip.change_column (
  entity text not null references aip.change_entity(name) on delete cascade,
  name text not null,
  db_column text not null,
  kind text not null,
  target text,
  scope text,
  editable boolean not null,
  primary key (entity, name)
);
alter table aip.change_entity enable row level security;
alter table aip.change_column enable row level security;
drop policy if exists p_read on aip.change_entity;
create policy p_read on aip.change_entity for select to authenticated using (true);
drop policy if exists p_read on aip.change_column;
create policy p_read on aip.change_column for select to authenticated using (true);
revoke all on aip.change_entity, aip.change_column from authenticated;
grant select on aip.change_entity, aip.change_column to authenticated;
grant all on aip.change_entity, aip.change_column to service_role;

delete from aip.change_column;
delete from aip.change_entity;
insert into aip.change_entity(name, label, layer, writers, editable, has_currency, scoped) values
${entities.join(",\n")};
insert into aip.change_column(entity, name, db_column, kind, target, scope, editable) values
${columns.join(",\n")};

-- Vocabulary read views for the Reference Data grids: the row key (scope:CODE where scoped) and whether it is a platform row.
${refViews.join("\n")}

-- Every applied change set, append-only. Rejected sets roll back entirely and leave nothing behind.
create table if not exists aip.change_set (
  id uuid primary key,
  tenant_id uuid not null references aip.tenants(id) on delete cascade,
  actor uuid not null default auth.uid(),
  source text not null check (source in ('grid','runtime','agent','import')),
  item_count integer not null check (item_count between 1 and ${MAX_CHANGE_ITEMS}),
  result jsonb not null,
  applied_at timestamptz not null default now()
);
create index if not exists change_set_tenant_idx on aip.change_set(tenant_id, applied_at desc);
alter table aip.change_set enable row level security;
drop policy if exists p_read on aip.change_set;
create policy p_read on aip.change_set for select to authenticated using (actor = auth.uid() or aip.has_role(tenant_id, array['admin']));
drop policy if exists p_insert on aip.change_set;
create policy p_insert on aip.change_set for insert to authenticated with check (actor = auth.uid() and aip.has_role(tenant_id, array['planner','admin']));
revoke all on aip.change_set from authenticated;
grant select, insert on aip.change_set to authenticated;
grant all on aip.change_set to service_role;

-- Integrations bulk-load the time series a person never edits cell by cell: a change set with source "import" may
-- write them (administrators and integrations only, as the series' writers say). Grids never send that source.
create or replace function aip.change_set_may_write(ent aip.change_entity, p_source text) returns boolean
language sql immutable set search_path = aip, pg_temp as $$ select ent.editable or (ent.layer = 'series' and p_source = 'import') $$;

-- Applies one change set. Items: {entity, op: insert|update|delete, code, baseVersion (update/delete), values}.
-- values hold column → value, references as business codes; money and decimals as strings (never floats).
create or replace function aip.apply_change_set(p_id uuid, p_tenant uuid, p_source text, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = aip, pg_temp as $fn$
declare
  prior aip.change_set;
  item jsonb;
  ent aip.change_entity;
  col aip.change_column;
  i int := 0;
  op text;
  item_code text;
  base bigint;
  k text;
  v jsonb;
  rec jsonb;
  ref_id uuid;
  cols text[];
  list text;
  version bigint;
  cur jsonb;
  key_sql text;
  ins_code text;
  results jsonb := '[]'::jsonb;
begin
  if p_id is null or p_tenant is null then raise exception 'change set id and tenant are required' using errcode = '22023'; end if;
  select * into prior from aip.change_set where id = p_id;
  if found then
    if prior.tenant_id <> p_tenant or prior.actor <> auth.uid() then
      raise exception 'change set % was already used' , p_id using errcode = '23505';
    end if;
    return jsonb_build_object('id', p_id, 'items', prior.result, 'replayed', true);
  end if;
  if not aip.has_role(p_tenant, array['planner','admin']) then
    raise exception 'only planners and administrators write change sets' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and ${MAX_CHANGE_ITEMS} then
    raise exception 'a change set holds 1 to ${MAX_CHANGE_ITEMS} items' using errcode = '22023';
  end if;
  perform set_config('aip.change_set_id', p_id::text, true);

  for item in select value from jsonb_array_elements(p_items) loop
    i := i + 1;
    select * into ent from aip.change_entity where name = item->>'entity';
    if not found then raise exception 'item %: unknown entity %', i, item->>'entity' using errcode = '22023'; end if;
    if not aip.change_set_may_write(ent, p_source) then raise exception 'item %: % is written by integrations only', i, ent.name using errcode = '42501'; end if;
    if not aip.has_role(p_tenant, ent.writers) then raise exception 'item %: your role cannot write %', i, ent.label using errcode = '42501'; end if;
    op := item->>'op';
    item_code := item->>'code';
    if item_code is null or length(item_code) not between 1 and 200 then raise exception 'item %: a business code is required', i using errcode = '22023'; end if;
    if op not in ('insert','update','delete') then raise exception 'item %: unknown operation %', i, op using errcode = '22023'; end if;
    base := case when jsonb_typeof(item->'baseVersion') = 'number' then (item->>'baseVersion')::bigint end;
    if op <> 'insert' and base is null then raise exception 'item %: % needs the row version it was read at', i, op using errcode = '22023'; end if;
    if op <> 'delete' and jsonb_typeof(coalesce(item->'values', '{}'::jsonb)) <> 'object' then raise exception 'item %: values must be an object', i using errcode = '22023'; end if;

    -- Resolve values to database columns: references by business code within the tenant (or platform vocabulary).
    rec := '{}'::jsonb;
    for k, v in select key, value from jsonb_each(coalesce(item->'values', '{}'::jsonb)) loop
      select * into col from aip.change_column where entity = ent.name and name = k;
      if not found or not (col.editable or (ent.layer = 'series' and p_source = 'import' and col.name not in ('source_ordinal'))) then
        raise exception 'item %: % is not an editable column of %', i, k, ent.label using errcode = '22023';
      end if;
      if col.kind in ('fk','ref') and jsonb_typeof(v) <> 'null' then
        if jsonb_typeof(v) <> 'string' then raise exception 'item %: % takes a business code', i, k using errcode = '22023'; end if;
        if col.kind = 'fk' then
          execute format('select id from aip.%I where tenant_id = $1 and code = $2', col.target) into ref_id using p_tenant, v #>> '{}';
        else
          execute format('select id from aip.%I where code = $1 and is_active and (tenant_id is null or tenant_id = $2)%s order by tenant_id nulls last limit 1',
                         col.target, case when col.scope is null then '' else ' and scope = $3' end)
            into ref_id using v #>> '{}', p_tenant, col.scope;
        end if;
        if ref_id is null then raise exception 'item %: % "%" does not exist', i, k, v #>> '{}' using errcode = '23503'; end if;
        rec := rec || jsonb_build_object(col.db_column, ref_id);
      else
        rec := rec || jsonb_build_object(col.db_column, v);
      end if;
    end loop;
    -- Rows are addressed by business code; a scoped vocabulary row by "scope:CODE".
    key_sql := case when ent.scoped then '(t.scope || '':'' || t.code)' else 't.code' end;
    ins_code := item_code;
    if ent.scoped then
      if item_code !~ '^[a-z][a-z0-9_]*:[^:]+$' then raise exception 'item %: % rows are addressed as scope:CODE', i, ent.label using errcode = '22023'; end if;
      ins_code := split_part(item_code, ':', 2);
      if op = 'insert' then rec := rec || jsonb_build_object('scope', split_part(item_code, ':', 1)); end if;
    end if;
    select array_agg(key order by key) into cols from jsonb_object_keys(rec) as key;
    list := (select string_agg(format('%I', c), ', ') from unnest(cols) c);

    version := null;
    if op = 'insert' then
      execute format('insert into aip.%1$I as t (tenant_id, code%2$s) select $2, $3%3$s from jsonb_populate_record(null::aip.%1$I, $1) r returning t.row_version',
                     ent.name, coalesce(', ' || list, ''), coalesce(', ' || (select string_agg(format('r.%I', c), ', ') from unnest(cols) c), ''))
        into version using rec, p_tenant, ins_code;
    elsif op = 'update' then
      if cols is null then raise exception 'item %: nothing to change', i using errcode = '22023'; end if;
      execute format('update aip.%1$I t set (%2$s) = (select %3$s from jsonb_populate_record(null::aip.%1$I, $1) r) where t.tenant_id = $2 and %4$s = $3 and t.row_version = $4 returning t.row_version',
                     ent.name, list, (select string_agg(format('r.%I', c), ', ') from unnest(cols) c), key_sql)
        into version using rec, p_tenant, item_code, base;
    else
      execute format('delete from aip.%I t where t.tenant_id = $1 and %s = $2 and t.row_version = $3 returning t.row_version', ent.name, key_sql)
        into version using p_tenant, item_code, base;
    end if;

    if version is null then
      execute format('select to_jsonb(v) from aip.%I v where v.tenant_id = $1 and v.code = $2', 'v_' || ent.name) into cur using p_tenant, item_code;
      if cur is null then
        if ent.layer = 'reference' then
          execute format('select to_jsonb(v) from aip.%I v where v.tenant_id is null and v.code = $1', 'v_' || ent.name) into cur using item_code;
          if cur is not null then raise exception 'item %: % is a platform code; platform vocabulary changes only with a Sustantix release', i, item_code using errcode = '42501'; end if;
        end if;
        raise exception 'item %: % % does not exist', i, ent.label, item_code using errcode = '${CHANGE_ERRORS.notFound}';
      end if;
      raise exception 'item %: % % changed since version % (now %)', i, ent.label, item_code, base, cur->>'row_version'
        using errcode = '${CHANGE_ERRORS.conflict}', detail = jsonb_build_object('entity', ent.name, 'code', item_code, 'current', cur)::text;
    end if;
    results := results || jsonb_build_array(jsonb_build_object('entity', ent.name, 'op', op, 'code', item_code,
                 'rowVersion', case when op = 'delete' then null else version end));
  end loop;

  insert into aip.change_set(id, tenant_id, source, item_count, result) values (p_id, p_tenant, coalesce(p_source, 'grid'), i, results);
  perform set_config('aip.change_set_id', '', true);
  return jsonb_build_object('id', p_id, 'items', results, 'replayed', false);
end $fn$;
revoke all on function aip.apply_change_set(uuid, uuid, text, jsonb) from public, anon;
grant execute on function aip.apply_change_set(uuid, uuid, text, jsonb) to authenticated;

-- Saved grid views: personal by default; administrators may share a view with the whole tenant.
create table if not exists aip.grid_view (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references aip.tenants(id) on delete cascade,
  grid text not null check (grid ~ '^[a-z][a-z0-9_-]*$'),
  name text not null check (length(name) between 1 and 80),
  owner uuid not null default auth.uid(),
  shared boolean not null default false,
  state jsonb not null check (jsonb_typeof(state) = 'object' and pg_column_size(state) < 32768),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, grid, owner, name)
);
alter table aip.grid_view enable row level security;
drop policy if exists p_read on aip.grid_view;
create policy p_read on aip.grid_view for select to authenticated using (aip.has_role(tenant_id) and (owner = auth.uid() or shared));
drop policy if exists p_insert on aip.grid_view;
create policy p_insert on aip.grid_view for insert to authenticated
  with check (owner = auth.uid() and aip.has_role(tenant_id) and (not shared or aip.has_role(tenant_id, array['admin'])));
drop policy if exists p_update on aip.grid_view;
create policy p_update on aip.grid_view for update to authenticated
  using (owner = auth.uid() and aip.has_role(tenant_id) or shared and aip.has_role(tenant_id, array['admin']))
  with check (aip.has_role(tenant_id) and (not shared or aip.has_role(tenant_id, array['admin'])));
drop policy if exists p_delete on aip.grid_view;
create policy p_delete on aip.grid_view for delete to authenticated
  using (owner = auth.uid() and aip.has_role(tenant_id) or shared and aip.has_role(tenant_id, array['admin']));
revoke all on aip.grid_view from authenticated;
grant select, insert, update, delete on aip.grid_view to authenticated;
grant all on aip.grid_view to service_role;
drop trigger if exists t_touch on aip.grid_view;
create trigger t_touch before update on aip.grid_view for each row execute function aip.touch_versioned();

create or replace function aip.audit_grid_view() returns trigger language plpgsql security definer set search_path = aip, pg_temp as $$
begin
  insert into aip.audit_log(tenant_id, actor, action, entity, entity_key, before, after)
  values (coalesce(new.tenant_id, old.tenant_id), auth.uid(), lower(tg_op), 'grid_view', coalesce(new.grid, old.grid) || ':' || coalesce(new.name, old.name),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
revoke all on function aip.audit_grid_view() from public, anon, authenticated;
drop trigger if exists t_audit on aip.grid_view;
create trigger t_audit after insert or update or delete on aip.grid_view for each row execute function aip.audit_grid_view();

-- One read view over every vocabulary table, for the Reference Data grid (platform rows and the tenant's own).
drop view if exists aip.v_reference;
create view aip.v_reference with (security_invoker = true) as
${refs.join("\nunion all\n")};
grant select on aip.v_reference to authenticated, service_role;

-- Every export is audited: who exported which grid, in which format, how many rows, under which filters.
create or replace function aip.record_grid_export(p_tenant uuid, p_grid text, p_format text, p_rows integer, p_query jsonb)
returns void language plpgsql security definer set search_path = aip, pg_temp as $$
begin
  if not aip.has_role(p_tenant) then raise exception 'not a member of this tenant' using errcode = '42501'; end if;
  if p_grid !~ '^[a-z][a-z0-9_-]*$' or p_format not in ('csv','xlsx') or p_rows < 0 then
    raise exception 'invalid export record' using errcode = '22023';
  end if;
  insert into aip.audit_log(tenant_id, actor, action, entity, entity_key, after)
  values (p_tenant, auth.uid(), 'export', 'grid', p_grid, jsonb_build_object('format', p_format, 'rows', p_rows, 'query', p_query));
end $$;
revoke all on function aip.record_grid_export(uuid, text, text, integer, jsonb) from public, anon;
grant execute on function aip.record_grid_export(uuid, text, text, integer, jsonb) to authenticated;
`;
}

export interface ChangeModelEntity {
  name: string;
  label: string;
  layer: MasterDef["layer"] | "reference";
  /** Rows are addressed as "scope:CODE". */
  scoped?: boolean;
  view: string;
  writers: string[];
  editable: boolean;
  columns: Array<{ name: string; label: string; kind: MasterColumn["kind"]; ref?: string; scope?: string; fk?: string; editable: boolean }>;
}

/** What hosts validate change sets and grid queries against (schema/aip-change-model.json). */
export function changeModel(defs: MasterDef[], vocab?: Vocabulary): { version: 1; maxItems: number; entities: ChangeModelEntity[] } {
  const refs: ChangeModelEntity[] = (vocab ? refEntities(vocab) : []).map((r) => ({
    name: r.name,
    label: r.label,
    layer: "reference",
    view: `v_${r.name}`,
    writers: ["admin"],
    editable: true,
    ...(r.scoped ? { scoped: true } : {}),
    columns: [{ name: "code", label: r.scoped ? "Scope:Code" : "Code", kind: "text" as const, editable: false }, ...REF_COLUMNS.map((c) => ({ ...c, editable: true }))],
  }));
  return {
    version: 1,
    maxItems: MAX_CHANGE_ITEMS,
    entities: [...defs.map((d) => {
      const byName = new Map(d.columns.map((c) => [c.name, c]));
      return {
        name: d.name,
        label: d.label,
        layer: d.layer,
        view: `v_${d.name}`,
        writers: writers(d),
        editable: editableEntity(d),
        columns: [
          { name: "code", label: "Code", kind: "text" as const, editable: false },
          ...changeColumns(d).map((c) => {
            const m = byName.get(c.name);
            return {
              name: c.name,
              label: m?.label ?? (c.name === "is_active" ? "Active" : "Currency"),
              kind: c.kind,
              ...(m?.ref ? { ref: m.ref } : {}),
              ...(m?.scope ? { scope: m.scope } : {}),
              ...(m?.fk ? { fk: m.fk } : {}),
              editable: c.editable,
            };
          }),
        ],
      };
    }), ...refs],
  };
}
