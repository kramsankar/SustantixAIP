/**
 * A small resolver over reference rows as the database holds them (aip.ref_* and aip.ref_alias): code, label or
 * alias, exact first, then case-insensitive. The full governed resolver lives in @sustantix/schema; hosts that only
 * have the database use this one.
 */
export interface RefRow {
  table: string;
  scope?: string | null;
  code: string;
  label: string;
}
export interface AliasRow {
  table: string;
  scope?: string | null;
  alias: string;
  code: string;
}

export function referenceResolver(refs: RefRow[], aliases: AliasRow[]): (ref: string, value: unknown, scope?: string) => string | null {
  const exact = new Map<string, string>();
  const folded = new Map<string, string>();
  const put = (table: string, scope: string | null | undefined, key: string, code: string) => {
    const k = `${table}|${scope ?? ""}|`;
    if (!exact.has(k + key)) exact.set(k + key, code);
    if (!folded.has(k + key.toLowerCase())) folded.set(k + key.toLowerCase(), code);
  };
  for (const r of refs) { put(r.table, r.scope, r.code, r.code); put(r.table, r.scope, r.label, r.code); }
  for (const a of aliases) put(a.table, a.scope, a.alias, a.code);
  return (ref, value, scope) => {
    if (value === null || value === undefined) return null;
    const v = String(value).trim();
    if (!v) return null;
    const k = `${ref}|${scope ?? ""}|`;
    return exact.get(k + v) ?? folded.get(k + v.toLowerCase()) ?? null;
  };
}
