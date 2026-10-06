import {
  DATE_PATTERN,
  DATETIME_PATTERN,
  DECIMAL_PATTERN,
  FILTER_OPS,
  LIMITS,
  opsFor,
  queryRows,
  type ChangeModel,
  type ChangeSetRequest,
  type ChangeSetResult,
  type ColumnKind,
  type GridColumn,
  type GridDef,
  type GridFilter,
  type GridPage,
  type GridQuery,
} from "@sustantix/grid";
import { z } from "zod";
import { ApiError } from "../http";
import type { Membership } from "../tenant";

/**
 * The grid service: validates every grid request against the catalogue and the change model before anything reaches
 * the database, then reads and writes with the caller's own client (row-level security decides what is visible and
 * writable). Store interfaces keep it testable without Supabase.
 */

export interface GridStore {
  read(def: GridDef, q: GridQuery, tenantId: string): Promise<GridPage>;
}

export interface ChangeStore {
  apply(req: ChangeSetRequest, tenantId: string): Promise<ChangeSetResult>;
}

export interface ExportLog {
  record(tenantId: string, grid: string, format: "csv" | "xlsx", rows: number, query: unknown): Promise<void>;
}

export interface OptionStore {
  options(kind: "ref" | "fk", name: string, scope: string | null, search: string, tenantId: string): Promise<Array<{ code: string; label: string | null }>>;
}

export interface SavedView {
  id: string;
  grid: string;
  name: string;
  shared: boolean;
  mine: boolean;
  state: Record<string, unknown>;
  rowVersion: number;
}

export interface ViewStore {
  list(grid: string, tenantId: string): Promise<SavedView[]>;
  create(grid: string, tenantId: string, v: { name: string; shared: boolean; state: Record<string, unknown> }): Promise<SavedView>;
  update(id: string, tenantId: string, rowVersion: number, v: { name: string; shared: boolean; state: Record<string, unknown> }): Promise<SavedView | null>;
  remove(id: string, tenantId: string): Promise<boolean>;
}

// ── Catalogue, per caller ──────────────────────────────────────────────────

const canWriteGrid = (def: GridDef, m: Membership) => def.writers.includes(m.role);

/** The catalogue as one caller sees it: editability narrowed to what their role may write. */
export function catalogueFor(defs: GridDef[], m: Membership): Array<GridDef & { canEdit: boolean }> {
  return defs.map((d) => {
    const canEdit = canWriteGrid(d, m);
    return { ...d, canEdit, columns: d.columns.map((c) => ({ ...c, editable: canEdit && c.editable })) };
  });
}

// ── Queries ────────────────────────────────────────────────────────────────

const scalar = z.union([z.string().max(200), z.number().finite(), z.boolean()]);
const querySchema = z
  .object({
    offset: z.number().int().min(0).max(10_000_000).default(0),
    limit: z.number().int().min(1).max(LIMITS.pageMax).default(100),
    sort: z.array(z.object({ field: z.string().max(80), dir: z.enum(["asc", "desc"]) }).strict()).max(5).default([]),
    filters: z.array(z.object({ field: z.string().max(80), op: z.enum(FILTER_OPS), value: z.union([scalar, z.array(z.union([z.string().max(200), z.number().finite()])).max(100)]).optional() }).strict()).max(LIMITS.filtersMax).default([]),
    search: z.string().max(LIMITS.searchMax).optional(),
  })
  .strict();

function checkFilterValue(col: GridColumn, f: GridFilter): void {
  const bad = (why: string) => new ApiError(400, "invalid_filter", `${col.label}: ${why}`);
  if (!opsFor(col.kind).includes(f.op)) throw bad(`cannot filter with ${f.op}`);
  if (f.op === "empty" || f.op === "notEmpty") return;
  const values = f.op === "in" ? f.value : [f.value];
  if (!Array.isArray(values) || !values.length) throw bad(f.op === "in" ? "needs a list of values" : "needs a value");
  for (const v of values) {
    if (v === undefined) throw bad("needs a value");
    if (!valueFits(col.kind, v, true)) throw bad(`${String(v)} is not a valid ${col.kind}`);
  }
}

function valueFits(kind: ColumnKind, v: unknown, forFilter = false): boolean {
  switch (kind) {
    case "integer":
      return typeof v === "number" ? Number.isInteger(v) : forFilter && typeof v === "string" && /^-?\d{1,12}$/.test(v);
    case "decimal":
    case "money":
      return typeof v === "string" ? DECIMAL_PATTERN.test(v) : forFilter && typeof v === "number" && Number.isFinite(v);
    case "date":
      return typeof v === "string" && DATE_PATTERN.test(v);
    case "datetime":
      return typeof v === "string" && (DATETIME_PATTERN.test(v) || (forFilter && DATE_PATTERN.test(v)));
    case "boolean":
      return typeof v === "boolean";
    default:
      return typeof v === "string" && v.length <= 4000;
  }
}

/** Parses a grid query and checks every field and filter against the grid's own columns. */
export function parseQuery(def: GridDef, body: unknown, opts: { unpaged?: boolean } = {}): GridQuery {
  const r = querySchema.safeParse(body ?? {});
  if (!r.success) throw new ApiError(400, "invalid_query", r.error.issues.map((i) => `${i.path.join(".") || "query"}: ${i.message}`).join("; "));
  const q = r.data;
  const byField = new Map(def.columns.map((c) => [c.field, c]));
  for (const s of q.sort) if (!byField.has(s.field)) throw new ApiError(400, "invalid_query", `cannot sort on ${s.field}`);
  for (const f of q.filters) {
    const col = byField.get(f.field);
    if (!col) throw new ApiError(400, "invalid_query", `cannot filter on ${f.field}`);
    checkFilterValue(col, f as GridFilter);
  }
  return {
    offset: opts.unpaged ? 0 : q.offset,
    limit: opts.unpaged ? LIMITS.exportRowsMax : q.limit,
    sort: q.sort.length ? q.sort : def.defaultSort,
    filters: [...(def.source.fixed ?? []), ...(q.filters as GridFilter[])],
    ...(q.search?.trim() ? { search: q.search.trim() } : {}),
  };
}

export async function readGrid(def: GridDef, body: unknown, m: Membership, store: GridStore, dictionary: () => Array<Record<string, unknown>>): Promise<GridPage> {
  const q = parseQuery(def, body);
  if (def.source.kind === "registry") {
    const r = queryRows(dictionary(), q, def.columns, def.key);
    return { rows: r.rows, total: r.total, offset: q.offset };
  }
  return store.read(def, q, m.tenantId);
}

/** Every row the filters select (up to the export ceiling), and an audit entry saying who exported what. */
export async function exportGrid(def: GridDef, body: unknown, m: Membership, store: GridStore, log: ExportLog, dictionary: () => Array<Record<string, unknown>>): Promise<GridPage & { truncated: boolean }> {
  const b = z.object({ format: z.enum(["csv", "xlsx"]), query: z.unknown().optional() }).strict().safeParse(body);
  if (!b.success) throw new ApiError(400, "invalid_export", "export needs a format (csv or xlsx) and an optional query");
  const q = parseQuery(def, b.data.query ?? {}, { unpaged: true });
  const rows: Array<Record<string, unknown>> = [];
  let total = 0;
  if (def.source.kind === "registry") {
    const r = queryRows(dictionary(), q, def.columns, def.key);
    rows.push(...r.rows);
    total = r.total;
  } else {
    for (let offset = 0; offset < LIMITS.exportRowsMax; offset += LIMITS.pageMax) {
      const page = await store.read(def, { ...q, offset, limit: LIMITS.pageMax }, m.tenantId);
      rows.push(...page.rows);
      total = page.total;
      if (page.rows.length < LIMITS.pageMax || rows.length >= total) break;
    }
  }
  await log.record(m.tenantId, def.id, b.data.format, rows.length, { filters: q.filters, sort: q.sort, search: q.search ?? null });
  return { rows, total, offset: 0, truncated: total > rows.length };
}

// ── Change sets ────────────────────────────────────────────────────────────

const changeSetSchema = z
  .object({
    id: z.string().uuid(),
    source: z.enum(["grid", "runtime", "import"]).default("grid"),
    items: z
      .array(
        z
          .object({
            entity: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/),
            op: z.enum(["insert", "update", "delete"]),
            code: z.string().trim().min(1).max(200),
            baseVersion: z.number().int().min(1).optional(),
            values: z.record(z.string(), z.unknown()).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(LIMITS.changeItemsMax),
  })
  .strict();

/**
 * Validates a change set against the change model and the caller's role before it reaches the database: unknown
 * entities and columns, read-only columns, values of the wrong type and missing row versions are refused with the
 * item they concern. The database re-checks all of it under the caller's rights.
 */
export function parseChangeSet(body: unknown, model: ChangeModel, m: Membership): ChangeSetRequest {
  const r = changeSetSchema.safeParse(body);
  if (!r.success) throw new ApiError(400, "invalid_change_set", r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  const req = r.data;
  req.items.forEach((item, idx) => {
    const where = `item ${idx + 1}`;
    const e = model.entities.find((x) => x.name === item.entity);
    if (!e) throw new ApiError(422, "unknown_entity", `${where}: unknown entity ${item.entity}`);
    if (!e.editable) throw new ApiError(403, "read_only", `${where}: ${e.label} is written by integrations only`);
    if (!e.writers.includes(m.role)) throw new ApiError(403, "forbidden", `${where}: your role cannot change ${e.label}`);
    if ((e as { scoped?: boolean }).scoped && !/^[a-z][a-z0-9_]*:[^:]+$/.test(item.code)) throw new ApiError(422, "invalid_code", `${where}: ${e.label} rows are addressed as scope:CODE`);
    if (item.op !== "insert" && item.baseVersion === undefined) throw new ApiError(400, "invalid_change_set", `${where}: ${item.op} needs the row version it was read at`);
    if (item.op === "update" && !Object.keys(item.values ?? {}).length) throw new ApiError(400, "invalid_change_set", `${where}: nothing to change`);
    if (item.op === "delete" && item.values && Object.keys(item.values).length) throw new ApiError(400, "invalid_change_set", `${where}: a delete carries no values`);
    for (const [k, v] of Object.entries(item.values ?? {})) {
      const col = e.columns.find((c) => c.name === k);
      if (!col || !col.editable) throw new ApiError(422, "invalid_value", `${where}: ${k} is not an editable column of ${e.label}`);
      if (v === null) continue;
      if (k === "currency" ? !(typeof v === "string" && /^[A-Z]{3}$/.test(v)) : !valueFits(col.kind, v)) {
        throw new ApiError(422, "invalid_value", `${where}: ${col.label} cannot be ${JSON.stringify(v)}${col.kind === "money" || col.kind === "decimal" ? " (amounts are sent as decimal strings)" : ""}`);
      }
    }
  });
  return { id: req.id, source: req.source, items: req.items };
}

export async function applyChanges(body: unknown, model: ChangeModel, m: Membership, store: ChangeStore): Promise<ChangeSetResult> {
  if (m.role === "viewer") throw new ApiError(403, "forbidden", "viewers cannot change data");
  return store.apply(parseChangeSet(body, model, m), m.tenantId);
}

/** Maps a database refusal of a change set to the API's answer. */
export function changeError(err: { code?: string; message?: string; details?: string | null }): ApiError {
  const message = err.message ?? "change set refused";
  switch (err.code) {
    case "AX409": {
      let detail: { entity?: string; code?: string; current?: unknown } = {};
      try {
        detail = JSON.parse(err.details ?? "{}");
      } catch {
        /* keep the message */
      }
      return new ApiError(409, "conflict", message, { entity: detail.entity, code: detail.code, current: detail.current });
    }
    case "AX404":
      return new ApiError(404, "not_found", message);
    case "23505":
      return new ApiError(409, "duplicate", message);
    case "23503":
      return new ApiError(422, "unknown_reference", message);
    case "42501":
      return new ApiError(403, "forbidden", message);
    case "22023":
    case "22P02":
    case "22007":
    case "22008":
    case "22003":
    case "23514":
    case "23502":
      return new ApiError(422, "invalid_value", message);
    default:
      return new ApiError(500, "change_failed", "the change set could not be applied");
  }
}

// ── Dropdown options and saved views ───────────────────────────────────────

export async function listOptions(params: URLSearchParams, model: ChangeModel, m: Membership, store: OptionStore) {
  const kind = params.get("kind");
  const name = params.get("name") ?? "";
  const scope = params.get("scope");
  const q = (params.get("q") ?? "").slice(0, LIMITS.searchMax);
  if (kind === "ref") {
    const known = model.entities.some((e) => e.columns.some((c) => c.kind === "ref" && c.ref === name && (c.scope ?? null) === (scope ?? null)));
    if (!known) throw new ApiError(400, "invalid_options", "unknown vocabulary");
    return store.options("ref", name, scope, q, m.tenantId);
  }
  if (kind === "fk") {
    if (!model.entities.some((e) => e.name === name)) throw new ApiError(400, "invalid_options", "unknown entity");
    return store.options("fk", name, null, q, m.tenantId);
  }
  throw new ApiError(400, "invalid_options", "kind must be ref or fk");
}

const viewSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    shared: z.boolean().default(false),
    state: z.record(z.string(), z.unknown()).refine((s) => JSON.stringify(s).length < 30_000, "view state is too large"),
    rowVersion: z.number().int().min(1).optional(),
  })
  .strict();

export function parseView(body: unknown, m: Membership, update = false) {
  const r = viewSchema.safeParse(body);
  if (!r.success) throw new ApiError(400, "invalid_view", r.error.issues.map((i) => `${i.path.join(".") || "view"}: ${i.message}`).join("; "));
  if (r.data.shared && m.role !== "admin") throw new ApiError(403, "forbidden", "only administrators share views with the tenant");
  if (update && r.data.rowVersion === undefined) throw new ApiError(400, "invalid_view", "an update needs the view's row version");
  return r.data;
}
