/**
 * Grid query semantics evaluated in memory. The grid uses them when it holds every row (client mode) and hosts use
 * them for sources that are not tables; the database evaluates the same operators for server mode.
 */
import { compareDecimals } from "./decimal.ts";
import { isNumeric, isTextual, type GridColumn, type GridFilter, type GridQuery, type SortSpec } from "./contract.ts";

type Row = Record<string, unknown>;

const isEmpty = (v: unknown) => v === null || v === undefined || v === "";

export function compareValues(kind: GridColumn["kind"] | undefined, a: unknown, b: unknown): number {
  if (isEmpty(a) || isEmpty(b)) return isEmpty(a) ? (isEmpty(b) ? 0 : 1) : -1; // empty values sort last
  if (kind && isNumeric(kind)) return compareDecimals(a, b);
  if (kind === "boolean") return Number(a) - Number(b);
  const x = String(a);
  const y = String(b);
  return x.localeCompare(y, "en", { numeric: true, sensitivity: "base" });
}

export function matches(row: Row, f: GridFilter, kind: GridColumn["kind"] | undefined): boolean {
  const v = row[f.field];
  switch (f.op) {
    case "empty":
      return isEmpty(v);
    case "notEmpty":
      return !isEmpty(v);
    case "in":
      return Array.isArray(f.value) && f.value.some((x) => compareValues(kind, v, x) === 0 && !isEmpty(v));
    case "contains":
      return !isEmpty(v) && String(v).toLowerCase().includes(String(f.value ?? "").toLowerCase());
    case "starts":
      return !isEmpty(v) && String(v).toLowerCase().startsWith(String(f.value ?? "").toLowerCase());
  }
  // The database excludes nulls from every comparison, including "not equal".
  if (isEmpty(v)) return false;
  let c: number;
  if (kind === "boolean") c = Number(v) - Number(f.value);
  else if (kind && isNumeric(kind)) c = compareDecimals(v, f.value);
  // Equality on text is exact, as in the database; ordering uses the natural order the grid sorts by.
  else if (f.op === "eq" || f.op === "neq") c = String(v) === String(f.value) ? 0 : 1;
  else c = compareValues(kind, v, f.value);
  switch (f.op) {
    case "eq":
      return c === 0;
    case "neq":
      return c !== 0;
    case "lt":
      return c < 0;
    case "lte":
      return c <= 0;
    case "gt":
      return c > 0;
    case "gte":
      return c >= 0;
  }
  return false;
}

export function sortRows(rows: Row[], sort: SortSpec[], columns: GridColumn[], key: string): Row[] {
  const byField = new Map(columns.map((c) => [c.field, c]));
  const specs = [...sort, ...(sort.some((s) => s.field === key) ? [] : [{ field: key, dir: "asc" as const }])];
  return [...rows].sort((a, b) => {
    for (const s of specs) {
      const col = byField.get(s.field);
      const f = col?.sortKey ?? s.field;
      const av = a[f];
      const bv = b[f];
      // Empty values sort last in both directions, as the database orders them (nulls last).
      if (isEmpty(av) !== isEmpty(bv)) return isEmpty(av) ? 1 : -1;
      const c = compareValues(col?.sortKey ? "decimal" : col?.kind, av, bv);
      if (c) return s.dir === "desc" ? -c : c;
    }
    return 0;
  });
}

export function searchRows(rows: Row[], term: string | undefined, columns: GridColumn[]): Row[] {
  const t = (term ?? "").trim().toLowerCase();
  if (!t) return rows;
  const fields = columns.filter((c) => isTextual(c.kind)).map((c) => c.field);
  return rows.filter((r) => fields.some((f) => !isEmpty(r[f]) && String(r[f]).toLowerCase().includes(t)));
}

export function queryRows(rows: Row[], q: GridQuery, columns: GridColumn[], key: string): { rows: Row[]; total: number } {
  const kinds = new Map(columns.map((c) => [c.field, c.kind]));
  let out = rows.filter((r) => q.filters.every((f) => matches(r, f, kinds.get(f.field))));
  out = searchRows(out, q.search, columns);
  out = sortRows(out, q.sort, columns, key);
  return { rows: out.slice(q.offset, q.offset + q.limit), total: out.length };
}
