/**
 * Values in the form the governed workbook carries them, shared by the compatibility rebuild and by hosts that
 * serve the governed workbook from the database. Dependency-free on purpose (hosts import it directly).
 */
import type { ColumnDef } from "./registry.ts";

/** Date-times as "YYYY-MM-DD HH:MM" (seconds only when present; a bare date where the column writes midnight so),
 *  dates as "YYYY-MM-DD", everything else unchanged. */
export function workbookValue(c: Pick<ColumnDef, "kind" | "midnightAsDate">, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (c.kind === "datetime") {
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/.exec(String(v));
    if (m && c.midnightAsDate && m[2] === "00:00" && (!m[3] || m[3] === "00")) return m[1];
    if (m) return m[3] && m[3] !== "00" ? `${m[1]} ${m[2]}:${m[3]}` : `${m[1]} ${m[2]}`;
    return String(v);
  }
  if (c.kind === "date") return String(v).slice(0, 10);
  if ((c.kind === "decimal" || c.kind === "money" || c.kind === "integer" || c.kind === "bigint") && typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return v;
}

/** Sheets too large for the boot payload: the runtime keeps its bundled copy of these. */
export const GOVERNED_MAX_ROWS = 5000;
