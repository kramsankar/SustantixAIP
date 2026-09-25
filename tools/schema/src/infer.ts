import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { MAX_NAME, type ColumnDef, type ColumnKind, type Registry, type TableDef } from "./registry.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const INT32 = 2 ** 31;

/** Names that collide with the platform-managed primary/key columns. */
const RESERVED = new Set(["name", "id", "key", "tenant_id", "row_key", "created_at", "updated_at", "currency", "source_row"]);

const DOMAINS: Array<[RegExp, string]> = [
  [/^PNO_|^PLAN_/, "Planning & Optimization"],
  [/^VE_/, "Value Exposure"],
  [/^SUS_|^PORT_/, "Sustainability & Portfolio"],
  [/^FCST_|^Twin /, "Forecast & Twin"],
  [/^MSI_/, "Maintenance Spares"],
  [/^CBM |^RCM |^Risk Queue|^Operational Reliability|^Work Orders|^Warranty|^OEM /, "Maintenance & Reliability"],
  [/^AI |^Data Quality|^DATA_|^Technology_/, "Governance & Technology"],
];

export function snake(s: string): string {
  return s
    .replace(/&/g, " and ")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function fit(name: string): string {
  if (name.length <= MAX_NAME) return name;
  const h = createHash("sha1").update(name).digest("hex").slice(0, 4);
  return name.slice(0, MAX_NAME - 5).replace(/_+$/, "") + "_" + h;
}

export function label(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\bPct\b/g, "%")
    .replace(/\bINR\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Money is recognised by an ISO currency token in the header (e.g. Unit_Cost_INR, Rate_INR_Hr). */
function moneyCurrency(header: string): string | undefined {
  const m = /(^|_)(INR|USD|EUR|GBP|AED|SGD|AUD)(_|$)/.exec(header);
  return m?.[2];
}

function columnName(header: string, currency: string | undefined, taken: Set<string>): string {
  let n = snake(currency ? header.replace(new RegExp(`(^|_)${currency}(?=_|$)`), "$1") : header);
  n = n.replace(/_+/g, "_").replace(/^_|_$/g, "") || "value";
  if (currency && /^(rate|value)?$/.test(n)) n = n ? `${n}_amount` : "amount";
  if (RESERVED.has(n)) n = `${n}_value`;
  n = fit(n);
  let unique = n;
  for (let i = 2; taken.has(unique); i++) unique = fit(`${n}_${i}`);
  taken.add(unique);
  return unique;
}

function decimals(v: number): number {
  const s = String(v);
  if (s.includes("e-")) return Math.min(10, Number(s.split("e-")[1]));
  const i = s.indexOf(".");
  return i < 0 ? 0 : Math.min(10, s.length - i - 1);
}

export function inferKind(header: string, values: unknown[]): Pick<ColumnDef, "kind" | "maxLength" | "precision" | "currency"> {
  const present = values.filter((v) => v !== null && v !== undefined && v !== "");
  const currency = moneyCurrency(header);
  if (present.length === 0) return currency ? { kind: "money", precision: 2, currency } : { kind: "text", maxLength: 200 };
  if (present.every((v) => typeof v === "boolean")) return { kind: "boolean" };
  if (present.every((v) => typeof v === "number" && Number.isFinite(v))) {
    const nums = present as number[];
    const places = Math.max(...nums.map(decimals));
    if (currency) return { kind: "money", precision: Math.max(2, Math.min(4, places)), currency };
    if (places === 0) return nums.every((n) => Math.abs(n) < INT32) ? { kind: "integer" } : { kind: "bigint" };
    return { kind: "decimal", precision: Math.max(2, places) };
  }
  const strs = present.map(String);
  if (strs.every((s) => DATE.test(s))) return { kind: "date" };
  if (strs.every((s) => DATE.test(s) || DATETIME.test(s))) return { kind: "datetime" };
  const longest = Math.max(...strs.map((s) => s.length));
  if (/_URL$/i.test(header) || strs.every((s) => /^https?:\/\//.test(s))) return { kind: "url", maxLength: 1000 };
  if (longest > 1000) return { kind: "memo", maxLength: 100000 };
  // Headroom for governed edits: round up generously, bounded for index-friendly columns.
  const maxLength = longest <= 100 ? 200 : longest <= 400 ? 1000 : 4000;
  return { kind: "text", maxLength };
}

function unique(rows: Record<string, unknown>[], cols: string[]): boolean {
  const seen = new Set<string>();
  for (const r of rows) {
    const parts = cols.map((c) => r[c]);
    if (parts.some((p) => p === null || p === undefined || p === "")) return false;
    const k = parts.map(String).join("␟");
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

/** Dimension-like columns are the only candidates for composite business keys (never measures). */
function isDimension(h: string, rows: Record<string, unknown>[]): boolean {
  if (/_ID$|^Period$|^Month$|_Type$|^Framework$|^Parameter$|_Start$|^Horizon_Hours$|_Timestamp$|^Scope$/i.test(h)) return true;
  return rows.every((r) => r[h] === null || typeof r[h] === "string") && !/(_Pct|_INR|_MWh|_MW|_Qty|_Hours|_Days|_Score)$/i.test(h);
}

export function detectKey(headers: string[], rows: Record<string, unknown>[]): string[] {
  if (!rows.length) return headers.slice(0, 1);
  const ids = headers.filter((h) => /_ID$/i.test(h));
  for (const h of ids) if (unique(rows, [h])) return [h];
  if (isDimension(headers[0]!, rows) && unique(rows, [headers[0]!])) return [headers[0]!];
  const dims = headers.filter((h) => isDimension(h, rows)).slice(0, 10);
  for (let size = 2; size <= 3; size++) {
    const pick = (start: number, acc: string[]): string[] | null => {
      if (acc.length === size) return unique(rows, acc) ? acc : null;
      for (let i = start; i < dims.length; i++) {
        const r = pick(i + 1, [...acc, dims[i]!]);
        if (r) return r;
      }
      return null;
    };
    const found = pick(0, []);
    if (found) {
      // A period column is always part of a composite key, even when one period is present in the seed.
      const period = headers.find((h) => /^(Period|Month)$/i.test(h));
      return period && !found.includes(period) ? [period, ...found] : found;
    }
  }
  return [];
}

export function inferRegistry(workbook: Buffer, sourceName: string, defaultCurrency = "INR"): Registry {
  const wb = XLSX.read(workbook, { type: "buffer", cellDates: false });
  const tableNames = new Set<string>();
  const tables: TableDef[] = [];
  for (const sheet of wb.SheetNames) {
    const ws = wb.Sheets[sheet]!;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
    const headers = (matrix[0] ?? []).map((h) => (h === null ? "" : String(h).trim())).filter(Boolean);
    if (!headers.length) continue;
    const rows = matrix
      .slice(1)
      .filter((r) => r.some((v) => v !== null && v !== ""))
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
    let tname = fit(snake(sheet));
    for (let i = 2; tableNames.has(tname); i++) tname = fit(`${snake(sheet)}_${i}`);
    tableNames.add(tname);
    const taken = new Set<string>();
    const columns: ColumnDef[] = headers.map((h) => {
      const k = inferKind(h, rows.map((r) => r[h]));
      return { source: h, name: columnName(h, k.currency, taken), label: label(h) || h, ...k, nullable: rows.some((r) => r[h] === null || r[h] === "") };
    });
    tables.push({
      sheet,
      name: tname,
      label: label(sheet),
      pluralLabel: label(sheet),
      domain: DOMAINS.find(([re]) => re.test(sheet))?.[1] ?? "Core",
      key: detectKey(headers, rows),
      columns,
      rowCount: rows.length,
    });
  }
  return {
    version: 1,
    source: sourceName,
    sourceSha256: createHash("sha256").update(workbook).digest("hex"),
    defaultCurrency,
    tables,
  };
}

export type { ColumnKind };
