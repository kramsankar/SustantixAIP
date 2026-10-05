import registry from "../../../schema/aip-data-model.json";
import { GOVERNED_MAX_ROWS, workbookValue } from "@sustantix/schema/workbook-format";

/**
 * The tenant's governed workbook in the runtime's own shape: each sheet from its compatibility view
 * (aip_compat.<sheet>, rebuilt from the normalized model) or, for sheets not yet normalized, from its sheet table,
 * in workbook order, with workbook headers and value forms. Large time series stay with the runtime's bundle.
 */

interface Column {
  source: string;
  name: string;
  kind: string;
  midnightAsDate?: boolean;
}
interface Table {
  sheet: string;
  name: string;
  columns: Column[];
  rowCount: number;
}

export type Row = Record<string, unknown>;

/** Reads one sheet's rows, ordered by source_ordinal, from aip_compat (when rebuilt) or aip. */
export interface SheetReader {
  read(schema: "aip" | "aip_compat", table: string): Promise<Row[]>;
}

export interface GovernedWorkbook {
  label: string;
  sheets: Record<string, Row[]>;
  omitted: string[];
}

const TABLES = (registry as { tables: Table[] }).tables;

import compat from "../../../schema/aip-compat.json";

/** Sheet tables the phase 3 compatibility views rebuild (schema/aip-compat.json, generated). */
export const COMPAT_SHEETS: ReadonlySet<string> = new Set((compat as { sheets: string[] }).sheets);

export async function governedWorkbook(reader: SheetReader, compatTables: ReadonlySet<string>, label: string): Promise<GovernedWorkbook> {
  const out: GovernedWorkbook = { label, sheets: {}, omitted: [] };
  const wanted = TABLES.filter((t) => {
    if (t.rowCount > GOVERNED_MAX_ROWS) {
      out.omitted.push(t.sheet);
      return false;
    }
    return true;
  });
  const results = await Promise.all(wanted.map(async (t) => [t, await reader.read(compatTables.has(t.name) ? "aip_compat" : "aip", t.name)] as const));
  for (const [t, rows] of results) {
    out.sheets[t.sheet] = rows.map((r) => Object.fromEntries(t.columns.map((c) => [c.source, workbookValue(c as Parameters<typeof workbookValue>[0], r[c.name])])));
  }
  return out;
}
