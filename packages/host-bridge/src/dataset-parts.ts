/**
 * Runtime datasets held in the database. Each dataset's tenant data is a layout (the dataset with every table replaced
 * by a reference) plus the tables it refers to, which are held once each by name:
 *   - a governed table: {"$aipGoverned": "<workbook sheet>", "columns": [...]} — the rows of the governed sheet, with
 *     the columns the screen reads, in its order;
 *   - a catalogue sheet: {"$aipSheet": "<name>"} or, for one group of a sheet that holds a family of like lists,
 *     {"$aipSheet": "<name>", "group": "<key>"}.
 * The seed splits datasets with these functions (tools/schema/src/runtime-catalogue.ts); the host joins them back after
 * sign-in, so each runtime module receives its dataset in the shape it was built against.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface GovernedRef {
  $aipGoverned: string;
  columns: string[];
}
export interface SheetRef {
  $aipSheet: string;
  group?: string;
}
export type TableRef = GovernedRef | SheetRef;

/** Where a table sat in its dataset (JSON Pointer) and the rows it held. */
export interface DatasetTable {
  part: string;
  rows: Json[];
}

const isRecord = (v: Json): v is { [key: string]: Json } => typeof v === "object" && v !== null && !Array.isArray(v);
const escapeToken = (k: string) => k.replace(/~/g, "~0").replace(/\//g, "~1");
// Own properties only, so a key such as "__proto__" stays a key, as JSON.parse leaves it.
const put = (o: { [key: string]: Json }, k: string, v: Json) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });

export function isGovernedRef(v: Json): v is GovernedRef & { [key: string]: Json } {
  return isRecord(v) && typeof v.$aipGoverned === "string" && Array.isArray(v.columns) && Object.keys(v).length === 2;
}
export function isSheetRef(v: Json): v is SheetRef & { [key: string]: Json } {
  if (!isRecord(v) || typeof v.$aipSheet !== "string") return false;
  const keys = Object.keys(v);
  return keys.length === 1 || (keys.length === 2 && typeof v.group === "string");
}

/** A table is a non-empty array whose every entry is a record or a row of values. */
export function isTable(v: Json): v is Json[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "object" && x !== null);
}

/** Every outermost table of a dataset with its JSON Pointer (a table inside a row stays in the row). */
export function tablesOf(value: Json): DatasetTable[] {
  const out: DatasetTable[] = [];
  const walk = (v: Json, pointer: string) => {
    if (isTable(v)) return void out.push({ part: pointer, rows: v });
    if (isRecord(v)) {
      if ("$aipGoverned" in v || "$aipSheet" in v) throw new Error(`dataset already holds a table reference key at ${pointer || "/"}`);
      for (const [k, x] of Object.entries(v)) walk(x, `${pointer}/${escapeToken(k)}`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${pointer}/${i}`));
  };
  walk(value, "");
  return out;
}

/** The dataset with each table replaced by the reference chosen for it (by JSON Pointer). */
export function layoutOf(value: Json, refFor: (part: string, rows: Json[]) => TableRef): Json {
  const walk = (v: Json, pointer: string): Json => {
    if (isTable(v)) return refFor(pointer, v) as unknown as Json;
    if (isRecord(v)) {
      const out: { [key: string]: Json } = {};
      for (const [k, x] of Object.entries(v)) put(out, k, walk(x, `${pointer}/${escapeToken(k)}`));
      return out;
    }
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${pointer}/${i}`));
    return v;
  };
  return walk(value, "");
}

/** A governed sheet's rows with the columns a screen reads, in its order (a column a row lacks stays absent). */
export function projectRows(rows: readonly Json[], columns: readonly string[]): Json[] {
  return rows.map((r) => {
    const out: { [key: string]: Json } = {};
    if (isRecord(r)) for (const c of columns) if (Object.prototype.hasOwnProperty.call(r, c)) put(out, c, r[c]!);
    return out;
  });
}

export interface TableSource {
  /** A catalogue sheet's rows, or one group of them. */
  sheet(name: string, group?: string): Json[] | undefined;
  /** A governed sheet's rows (all columns, as the governed workbook serves them). */
  governed(sheet: string): Json[] | undefined;
}

/** Joins a layout back into its dataset. Every reference must be answered. */
export function composeDataset(layout: Json, source: TableSource): Json {
  const walk = (v: Json): Json => {
    if (isGovernedRef(v)) {
      const rows = source.governed(v.$aipGoverned);
      if (!rows) throw new Error(`governed sheet "${v.$aipGoverned}" was not loaded`);
      return projectRows(rows, v.columns);
    }
    if (isSheetRef(v)) {
      const rows = source.sheet(v.$aipSheet, v.group);
      if (!rows) throw new Error(`sheet "${v.$aipSheet}"${v.group === undefined ? "" : ` group "${v.group}"`} was not loaded`);
      return rows;
    }
    if (isRecord(v)) {
      const out: { [key: string]: Json } = {};
      for (const [k, x] of Object.entries(v)) put(out, k, walk(x));
      return out;
    }
    if (Array.isArray(v)) return v.map(walk);
    return v;
  };
  return walk(layout);
}
