import * as XLSX from "xlsx";
import { logical } from "./dataverse.ts";
import type { ColumnDef, Registry, TableDef } from "./registry.ts";

export type SourceRow = Record<string, unknown>;

export function readSheets(workbook: Buffer): Record<string, SourceRow[]> {
  const wb = XLSX.read(workbook, { type: "buffer", cellDates: false });
  const out: Record<string, SourceRow[]> = {};
  for (const name of wb.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name]!, { header: 1, defval: null, raw: true });
    const headers = (matrix[0] ?? []).map((h) => (h === null ? "" : String(h).trim()));
    out[name] = matrix
      .slice(1)
      .filter((r) => r.some((v) => v !== null && v !== ""))
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null]).filter(([h]) => h)));
  }
  return out;
}

export function rowKey(t: TableDef, row: SourceRow, index: number): string {
  if (!t.key.length) return `R${String(index + 1).padStart(6, "0")}`;
  return t.key.map((k) => String(row[k] ?? "")).join(" | ");
}

function toIsoDateTime(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().replace(" ", "T");
  const withSeconds = /T\d{2}:\d{2}$/.test(s) ? s + ":00" : /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T00:00:00" : s;
  return withSeconds;
}

export function coerce(c: ColumnDef, v: unknown): unknown {
  if (v === null || v === undefined || v === "") return null;
  switch (c.kind) {
    case "integer":
    case "bigint":
    case "decimal":
    case "money": {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) throw new Error(`${c.source}: "${String(v)}" is not numeric`);
      return c.kind === "integer" || c.kind === "bigint" ? Math.round(n) : n;
    }
    case "boolean":
      return typeof v === "boolean" ? v : /^(true|yes|1)$/i.test(String(v));
    case "date":
      return String(v).slice(0, 10);
    case "datetime":
      return toIsoDateTime(v);
    default: {
      const s = String(v);
      if (c.maxLength && s.length > c.maxLength) throw new Error(`${c.source}: value exceeds ${c.maxLength} characters`);
      return s;
    }
  }
}

/** Postgres row for aip.<table>; tenant supplied by the caller. */
export function pgRecord(t: TableDef, row: SourceRow, index: number, tenantId: string, currency: string): Record<string, unknown> {
  const rec: Record<string, unknown> = { tenant_id: tenantId, row_key: rowKey(t, row, index) };
  for (const c of t.columns) rec[c.name] = coerce(c, row[c.source]);
  if (t.columns.some((c) => c.kind === "money")) rec.currency = t.columns.find((c) => c.kind === "money")?.currency ?? currency;
  return rec;
}

/** Dataverse Web API record body; money columns bind the ISO currency's transactioncurrency. */
export function dataverseRecord(t: TableDef, row: SourceRow, index: number, currencyIds: Record<string, string>): Record<string, unknown> {
  const rec: Record<string, unknown> = { [logical("name")]: rowKey(t, row, index) };
  let currency: string | undefined;
  for (const c of t.columns) {
    const v = coerce(c, row[c.source]);
    if (c.kind === "datetime" && typeof v === "string") rec[logical(c.name)] = v.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(v) ? v : v + "Z";
    else rec[logical(c.name)] = v;
    if (c.kind === "money") currency = c.currency;
  }
  if (currency) {
    const id = currencyIds[currency];
    if (!id) throw new Error(`transaction currency ${currency} is not provisioned`);
    rec["transactioncurrencyid@odata.bind"] = `/transactioncurrencies(${id})`;
  }
  return rec;
}

export function tableRows(reg: Registry, sheets: Record<string, SourceRow[]>): Array<{ table: TableDef; rows: SourceRow[] }> {
  return reg.tables.map((t) => ({ table: t, rows: sheets[t.sheet] ?? [] }));
}
