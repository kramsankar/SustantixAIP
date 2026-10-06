/**
 * The Sustantix Enterprise Grid contract: what a grid shows, how it asks for rows and how it writes. Shared by the
 * hosts (which serve and validate it) and the grid component (which renders it), so both sides read one definition.
 */

/** Value kinds a grid column can hold. fk and ref columns carry business codes; money and decimal carry strings. */
export type ColumnKind = "text" | "memo" | "url" | "integer" | "decimal" | "money" | "date" | "datetime" | "boolean" | "fk" | "ref";

export interface GridColumn {
  field: string;
  label: string;
  kind: ColumnKind;
  /** Written through a change set (entity sources only, and only for roles that write the entity). */
  editable: boolean;
  /** ref: vocabulary table and scope; fk: the entity whose business code this column holds. */
  ref?: string;
  scope?: string;
  fk?: string;
  /** Sort (and compare) by this field's number instead of the shown text (screen tables of formatted figures). */
  sortKey?: string;
  /** Initial width in pixels (screen grids size columns to their content). */
  width?: number;
}

export type SourceKind = "entity" | "view" | "sheet" | "registry";

export interface GridSource {
  kind: SourceKind;
  /** entity: the governed entity; view: an aip view; sheet: a sheet table. */
  name?: string;
  /** Filters the source always applies (for example one model's outputs). */
  fixed?: GridFilter[];
  /** The view also serves platform rows (tenant_id null) beside the tenant's own. */
  platformRows?: boolean;
}

export interface SortSpec {
  field: string;
  dir: "asc" | "desc";
}

export interface GridDef {
  id: string;
  title: string;
  screen: string;
  source: GridSource;
  /** The relation rows are read from: schema-qualified by the host. */
  relation: string;
  columns: GridColumn[];
  /** Business key of a row; entity grids also carry row_version for optimistic concurrency. */
  key: string;
  entity: string | null;
  writers: string[];
  defaultSort: SortSpec[];
  groupBy: string[];
  bulkEdit: string[];
  tree: { parent: string } | null;
  /** A boolean field that, when true, makes its row read-only (platform vocabulary rows). */
  readOnlyWhen?: string;
  /** Actions on selected rows that the host carries out (for example replaying quarantined records). */
  actions?: GridAction[];
}

export interface GridAction {
  id: string;
  label: string;
  /** The question asked before the action runs. */
  confirm?: string;
}

export const FILTER_OPS = ["eq", "neq", "lt", "lte", "gt", "gte", "contains", "starts", "in", "empty", "notEmpty"] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export interface GridFilter {
  field: string;
  op: FilterOp;
  value?: string | number | boolean | Array<string | number>;
}

export interface GridQuery {
  offset: number;
  limit: number;
  sort: SortSpec[];
  filters: GridFilter[];
  search?: string;
}

export interface GridPage {
  rows: Array<Record<string, unknown>>;
  total: number;
  offset: number;
}

/** Bounds every host enforces. */
export const LIMITS = {
  pageMax: 1000,
  /** At or below this many rows the grid loads everything and sorts, filters and groups in the browser. */
  clientRowsMax: 5000,
  exportRowsMax: 50000,
  filtersMax: 20,
  searchMax: 100,
  changeItemsMax: 500,
} as const;

/** Which filter operators make sense for a column kind. */
export function opsFor(kind: ColumnKind): FilterOp[] {
  switch (kind) {
    case "boolean":
      return ["eq", "empty", "notEmpty"];
    case "integer":
    case "decimal":
    case "money":
    case "date":
    case "datetime":
      return ["eq", "neq", "lt", "lte", "gt", "gte", "in", "empty", "notEmpty"];
    case "fk":
    case "ref":
      return ["eq", "neq", "in", "contains", "starts", "empty", "notEmpty"];
    default:
      return ["eq", "neq", "contains", "starts", "in", "empty", "notEmpty"];
  }
}

export const isNumeric = (k: ColumnKind) => k === "integer" || k === "decimal" || k === "money";
export const isTextual = (k: ColumnKind) => k === "text" || k === "memo" || k === "url" || k === "fk" || k === "ref";

// ── Change sets ────────────────────────────────────────────────────────────

export type ChangeOp = "insert" | "update" | "delete";

export interface ChangeItem {
  entity: string;
  op: ChangeOp;
  code: string;
  baseVersion?: number;
  values?: Record<string, unknown>;
}

export interface ChangeSetRequest {
  id: string;
  source: "grid" | "runtime" | "agent" | "import";
  items: ChangeItem[];
}

export interface ChangeSetResult {
  id: string;
  items: Array<{ entity: string; op: ChangeOp; code: string; rowVersion: number | null }>;
  replayed: boolean;
}

/** 409 body when a row changed since it was read: the grid shows the current row beside the user's edit. */
export interface ConflictBody {
  error: "conflict";
  message: string;
  entity: string;
  code: string;
  current: Record<string, unknown>;
}

// ── Values ─────────────────────────────────────────────────────────────────

export const DECIMAL_PATTERN = /^-?\d{1,15}(\.\d{1,6})?$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;

/** A calendar date that exists (no 30 February). */
function realDate(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/**
 * Parses what a user typed into a cell into the value a change set carries, or an error message.
 * Money and decimals stay strings end to end: they are never parsed into floating point.
 */
export function parseCellInput(kind: ColumnKind, input: string): { value: unknown } | { error: string } {
  const s = input.trim();
  if (s === "") return { value: null };
  switch (kind) {
    case "integer":
      return /^-?\d{1,12}$/.test(s) ? { value: Number(s) } : { error: "Enter a whole number" };
    case "decimal":
    case "money": {
      const plain = s.replace(/,/g, "");
      return DECIMAL_PATTERN.test(plain) ? { value: plain } : { error: "Enter a number" };
    }
    case "date":
      return DATE_PATTERN.test(s) && realDate(s) ? { value: s } : { error: "Use YYYY-MM-DD" };
    case "datetime": {
      const v = s.replace(" ", "T");
      return DATETIME_PATTERN.test(v) && realDate(v.slice(0, 10)) && Number(v.slice(11, 13)) < 24 && Number(v.slice(14, 16)) < 60
        ? { value: v.length === 16 ? `${v}:00` : v }
        : { error: "Use YYYY-MM-DD HH:MM" };
    }
    case "boolean":
      if (/^(true|yes|y|1)$/i.test(s)) return { value: true };
      if (/^(false|no|n|0)$/i.test(s)) return { value: false };
      return { error: "Yes or no" };
    default:
      return s.length <= 4000 ? { value: s } : { error: "Too long" };
  }
}
