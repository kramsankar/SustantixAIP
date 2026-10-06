/**
 * Display formatting. Amounts are formatted from their decimal strings (Intl formats strings exactly), with the row's
 * own currency, in the viewer's locale; dates and times are shown as stored, because plant-local times carry no zone.
 */
import type { GridColumn } from "../contract.ts";

const money = new Map<string, Intl.NumberFormat>();
const moneyCode = new Map<string, Intl.NumberFormat>();
const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 });
const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function moneyFormat(currency: string, byCode = false): Intl.NumberFormat {
  const cache = byCode ? moneyCode : money;
  let f = cache.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2, ...(byCode ? { currencyDisplay: "code" as const } : {}) });
    } catch {
      f = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    }
    cache.set(currency, f);
  }
  return f;
}

/** Intl accepts decimal strings and formats them without converting through floating point. */
const fmt = (f: Intl.NumberFormat, v: unknown) => (f.format as (x: unknown) => string)(typeof v === "number" ? v : String(v));

export function display(col: GridColumn, v: unknown, row?: Record<string, unknown>, fallbackCurrency = "INR"): string {
  if (v === null || v === undefined || v === "") return "";
  switch (col.kind) {
    case "money":
      return fmt(moneyFormat(String(row?.currency ?? fallbackCurrency)), v);
    case "decimal":
      return fmt(decimal, v);
    case "integer":
      return fmt(integer, v);
    case "boolean":
      return v === true ? "Yes" : v === false ? "No" : String(v);
    case "datetime":
      return String(v).replace("T", " ").slice(0, 16);
    case "date":
      return String(v).slice(0, 10);
    default:
      return String(v);
  }
}

/** Totals name their currency by code: a footer may list several side by side, and "$" alone is ambiguous. */
export function moneyTotal(sum: string, currency: string): string {
  return fmt(moneyFormat(currency, true), sum);
}

/** What an editor starts from: the stored value, not its display form. */
export function editText(col: GridColumn, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (col.kind === "datetime") return String(v).replace("T", " ").slice(0, 16);
  if (col.kind === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export const alignRight = (col: GridColumn) => col.kind === "integer" || col.kind === "decimal" || col.kind === "money";
