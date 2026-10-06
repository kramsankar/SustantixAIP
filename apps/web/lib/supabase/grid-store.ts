import { isNumeric, isTextual, type ChangeSetRequest, type ChangeSetResult, type GridDef, type GridPage, type GridQuery } from "@sustantix/grid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { changeError, type ChangeStore, type ExportLog, type GridStore, type OptionStore, type SavedView, type ViewStore } from "../grid/service";

type AipClient = SupabaseClient<any, "aip", "aip">;

/** The PostgREST filter methods a grid query uses (supabase-js builders provide all of them). */
export interface FilterBuilder {
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
  gt(column: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  ilike(column: string, pattern: string): this;
  in(column: string, values: readonly unknown[]): this;
  is(column: string, value: null): this;
  not(column: string, operator: string, value: unknown): this;
  or(filters: string): this;
  order(column: string, opts: { ascending: boolean; nullsFirst: boolean }): this;
  range(from: number, to: number): this;
}

/** Escapes LIKE wildcards so a user's text matches literally. */
export const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, "");

/** Quotes a value inside a PostgREST or=(...) list, where commas, dots and parentheses are syntax. */
const orValue = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * Columns to select: every shown column (amounts as text, so money never passes through floating point), the key,
 * and what the grid needs to write (row_version), total money (currency) and draw trees (the parent column).
 */
export function selectList(def: GridDef): string {
  const fields = new Set<string>([def.key, ...def.columns.map((c) => c.field)]);
  if (def.entity) {
    fields.add("row_version");
    if (def.columns.some((c) => c.kind === "money")) fields.add("currency");
  }
  if (def.tree) fields.add(def.tree.parent);
  if (def.readOnlyWhen) fields.add(def.readOnlyWhen);
  const kinds = new Map(def.columns.map((c) => [c.field, c.kind]));
  return [...fields].map((f) => (isNumeric(kinds.get(f) ?? "text") && kinds.get(f) !== "integer" ? `${f}:${f}::text` : f)).join(",");
}

/** Applies tenant scope, filters, search, order and paging to a builder. */
export function applyGridQuery<B extends FilterBuilder>(b: B, def: GridDef, q: GridQuery, tenantId: string): B {
  let x = def.source.platformRows ? b.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`) : b.eq("tenant_id", tenantId);
  for (const f of q.filters) {
    switch (f.op) {
      case "empty":
        x = x.is(f.field, null);
        break;
      case "notEmpty":
        x = x.not(f.field, "is", null);
        break;
      case "contains":
        x = x.ilike(f.field, `%${likeLiteral(String(f.value))}%`);
        break;
      case "starts":
        x = x.ilike(f.field, `${likeLiteral(String(f.value))}%`);
        break;
      case "in":
        x = x.in(f.field, f.value as unknown[]);
        break;
      default:
        x = x[f.op](f.field, f.value);
    }
  }
  if (q.search) {
    const term = likeLiteral(q.search);
    const fields = def.columns.filter((c) => isTextual(c.kind)).map((c) => c.field);
    if (fields.length) x = x.or(fields.map((f) => `${f}.ilike.${orValue(`*${term}*`)}`).join(","));
  }
  const order = [...q.sort, ...(q.sort.some((s) => s.field === def.key) ? [] : [{ field: def.key, dir: "asc" as const }])];
  for (const s of order) x = x.order(s.field, { ascending: s.dir === "asc", nullsFirst: false });
  return x.range(q.offset, q.offset + q.limit - 1);
}

/** Grid reads through the caller's client: row-level security decides every row returned. */
export class SupabaseGridStore implements GridStore, OptionStore {
  constructor(private readonly db: AipClient) {}

  async read(def: GridDef, q: GridQuery, tenantId: string): Promise<GridPage> {
    const relation = def.relation.replace(/^aip\./, "");
    const base = this.db.from(relation).select(selectList(def), { count: "exact" });
    const { data, error, count } = await applyGridQuery(base as unknown as FilterBuilder, def, q, tenantId) as unknown as { data: unknown[] | null; error: { message: string } | null; count: number | null };
    if (error) throw new Error(`${def.relation}: ${error.message}`);
    return { rows: (data ?? []) as Array<Record<string, unknown>>, total: count ?? 0, offset: q.offset };
  }

  async options(kind: "ref" | "fk", name: string, scope: string | null, search: string, tenantId: string) {
    const term = likeLiteral(search);
    if (kind === "ref") {
      let b = this.db.from(`ref_${name}`).select("code,label").eq("is_active", true).or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
      if (scope) b = b.eq("scope", scope);
      if (term) b = b.or(`code.ilike.${orValue(`*${term}*`)},label.ilike.${orValue(`*${term}*`)}`);
      const { data, error } = await b.order("sort_order").order("code").limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: { code: string; label: string | null }) => ({ code: r.code, label: r.label }));
    }
    let b = this.db.from(`v_${name}`).select("code").eq("tenant_id", tenantId).eq("is_active", true);
    if (term) b = b.ilike("code", `%${term}%`);
    const { data, error } = await b.order("code").limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { code: string }) => ({ code: r.code, label: null }));
  }
}

/** Current governed rows by business code, read as the caller (an import compares against what they may see). */
export class SupabaseCurrentReader {
  constructor(private readonly db: AipClient) {}

  async rows(entity: string, codes: string[], tenantId: string): Promise<Array<Record<string, unknown>>> {
    if (!/^[a-z][a-z0-9_]*$/.test(entity)) throw new Error(`invalid entity ${entity}`);
    const { data, error } = await this.db.from(`v_${entity}`).select("*").eq("tenant_id", tenantId).in("code", codes);
    if (error) throw new Error(`v_${entity}: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }
}

export class SupabaseChangeStore implements ChangeStore {
  constructor(private readonly db: AipClient) {}

  async apply(req: ChangeSetRequest, tenantId: string): Promise<ChangeSetResult> {
    const { data, error } = await this.db.rpc("apply_change_set", { p_id: req.id, p_tenant: tenantId, p_source: req.source, p_items: req.items });
    if (error) throw changeError(error);
    return data as ChangeSetResult;
  }
}

export class SupabaseExportLog implements ExportLog {
  constructor(private readonly db: AipClient) {}

  async record(tenantId: string, grid: string, format: "csv" | "xlsx", rows: number, query: unknown): Promise<void> {
    const { error } = await this.db.rpc("record_grid_export", { p_tenant: tenantId, p_grid: grid, p_format: format, p_rows: rows, p_query: query });
    if (error) throw new Error(`export not recorded: ${error.message}`);
  }
}

interface ViewRow {
  id: string;
  grid: string;
  name: string;
  shared: boolean;
  owner: string;
  state: Record<string, unknown>;
  row_version: number;
}

export class SupabaseViewStore implements ViewStore {
  constructor(private readonly db: AipClient, private readonly userId: string) {}

  private view = (r: ViewRow): SavedView => ({ id: r.id, grid: r.grid, name: r.name, shared: r.shared, mine: r.owner === this.userId, state: r.state, rowVersion: r.row_version });

  async list(grid: string, tenantId: string): Promise<SavedView[]> {
    const { data, error } = await this.db.from("grid_view").select("id,grid,name,shared,owner,state,row_version").eq("tenant_id", tenantId).eq("grid", grid).order("shared", { ascending: false }).order("name");
    if (error) throw new Error(error.message);
    return ((data ?? []) as ViewRow[]).map(this.view);
  }

  async create(grid: string, tenantId: string, v: { name: string; shared: boolean; state: Record<string, unknown> }): Promise<SavedView> {
    const { data, error } = await this.db.from("grid_view").insert({ tenant_id: tenantId, grid, name: v.name, shared: v.shared, state: v.state }).select("id,grid,name,shared,owner,state,row_version").single();
    if (error) throw changeError(error);
    return this.view(data as ViewRow);
  }

  async update(id: string, tenantId: string, rowVersion: number, v: { name: string; shared: boolean; state: Record<string, unknown> }): Promise<SavedView | null> {
    const { data, error } = await this.db.from("grid_view").update({ name: v.name, shared: v.shared, state: v.state }).eq("tenant_id", tenantId).eq("id", id).eq("row_version", rowVersion).select("id,grid,name,shared,owner,state,row_version").maybeSingle();
    if (error) throw changeError(error);
    return data ? this.view(data as ViewRow) : null;
  }

  async remove(id: string, tenantId: string): Promise<boolean> {
    const { data, error } = await this.db.from("grid_view").delete().eq("tenant_id", tenantId).eq("id", id).select("id");
    if (error) throw changeError(error);
    return (data ?? []).length > 0;
  }
}
