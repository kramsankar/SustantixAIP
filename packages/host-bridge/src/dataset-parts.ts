/**
 * Runtime datasets held in the database. A bundled dataset is split into its frame (the dataset with every table
 * replaced by a reference) and its tables (arrays of records, stored one row per record). The host joins them back
 * after sign-in, so each runtime module receives exactly the value it was built against: same keys, same key order,
 * same rows in the same order.
 *
 * Pure functions: the seed generator splits with them, the host bridge joins with them.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Where a table sat in its dataset (JSON Pointer) and the rows it held. */
export interface DatasetTable {
  part: string;
  rows: Json[];
}

export interface SplitDataset {
  frame: Json;
  tables: DatasetTable[];
}

/** The reference a frame holds in place of a table. */
export const PART_REF = "$aipPart";

const isRecord = (v: Json): v is { [key: string]: Json } => typeof v === "object" && v !== null && !Array.isArray(v);
const isRef = (v: Json): v is { [PART_REF]: string } => isRecord(v) && Object.keys(v).length === 1 && typeof v[PART_REF] === "string";
const escapeToken = (k: string) => k.replace(/~/g, "~0").replace(/\//g, "~1");
// Own properties only, so a key such as "__proto__" stays a key, as JSON.parse leaves it.
const put = (o: { [key: string]: Json }, k: string, v: Json) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });

/** A table is a non-empty array whose every entry is a record or a row of values. */
export function isTable(v: Json): v is Json[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "object" && x !== null);
}

/** Splits a dataset into its frame and its tables (outermost tables only: a table inside a row stays in the row). */
export function splitDataset(value: Json): SplitDataset {
  const tables: DatasetTable[] = [];
  const walk = (v: Json, pointer: string): Json => {
    if (isTable(v)) {
      tables.push({ part: pointer, rows: v });
      return { [PART_REF]: pointer };
    }
    if (isRecord(v)) {
      if (PART_REF in v) throw new Error(`dataset already holds the key ${PART_REF} at ${pointer || "/"}`);
      const out: { [key: string]: Json } = {};
      for (const [k, x] of Object.entries(v)) put(out, k, walk(x, `${pointer}/${escapeToken(k)}`));
      return out;
    }
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${pointer}/${i}`));
    return v;
  };
  const frame = walk(value, "");
  return { frame, tables };
}

/** Joins a frame and its tables back into the dataset. Every reference must be answered, and every table used. */
export function joinDataset(frame: Json, tables: ReadonlyMap<string, Json[]>): Json {
  const used = new Set<string>();
  const walk = (v: Json): Json => {
    if (isRef(v)) {
      const rows = tables.get(v[PART_REF]);
      if (!rows) throw new Error(`dataset table ${v[PART_REF]} was not loaded`);
      used.add(v[PART_REF]);
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
  const value = walk(frame);
  for (const part of tables.keys()) if (!used.has(part)) throw new Error(`dataset table ${part} has no place in its frame`);
  return value;
}
