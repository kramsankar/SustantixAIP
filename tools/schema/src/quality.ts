/**
 * Phase 5: the governed data-quality rules (schema/quality/rules.json) as executable checks on records of the
 * normalized model. Record rules gate ingestion; population rules are monitored and never block a single record.
 */
import { comparable } from "./sheet-import.ts";

export interface QualityRule {
  id: string;
  check: string;
  scope?: "record" | "population";
  reason?: string;
  entity?: string;
  kind?: "required" | "unique" | "nonNegative" | "reconcile";
  fields?: string[];
  target?: string;
  terms?: Array<{ field: string; sign: 1 | -1 }>;
  severity?: "reject" | "warn";
}

export interface QualityRules {
  version: 1;
  rules: QualityRule[];
}

export interface Issue {
  rule: string;
  check: string;
  severity: "reject" | "warn";
  field?: string;
  message: string;
}

export interface RecordIn {
  code: string | null;
  values: Record<string, unknown>;
}

const empty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** The rules that judge single records of an entity. */
export const recordRules = (rules: QualityRules, entity: string) => rules.rules.filter((r) => r.scope !== "population" && r.entity === entity);

/** Scaled integer (6 decimals) of a figure, or null: reconciliations are exact, never floating point. */
function scaled(v: unknown): bigint | null {
  const s = comparable("decimal", v);
  if (s === null || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  const [w, f = ""] = s.replace("-", "").split(".");
  const n = BigInt(w!) * 1_000_000n + BigInt((f + "000000").slice(0, 6));
  return s.startsWith("-") ? -n : n;
}

/** Checks every record of one entity; returns the issues of each record, in order. */
export function checkRecords(rules: QualityRules, entity: string, records: RecordIn[]): Issue[][] {
  const active = recordRules(rules, entity);
  const out: Issue[][] = records.map(() => []);
  const value = (r: RecordIn, f: string) => (f === "code" ? r.code : r.values[f]);
  for (const rule of active) {
    const sev = rule.severity ?? "reject";
    const base = { rule: rule.id, check: rule.check, severity: sev } as const;
    switch (rule.kind) {
      case "required":
        records.forEach((r, i) => {
          const missing = (rule.fields ?? []).filter((f) => empty(value(r, f)));
          if (missing.length) out[i]!.push({ ...base, field: missing[0], message: `${rule.check}: ${missing.join(", ")} missing` });
        });
        break;
      case "unique": {
        const seen = new Map<string, number>();
        records.forEach((r, i) => {
          const key = JSON.stringify((rule.fields ?? []).map((f) => value(r, f)));
          const first = seen.get(key);
          if (first === undefined) seen.set(key, i);
          else out[i]!.push({ ...base, field: rule.fields?.[0], message: `${rule.check}: duplicates record ${first + 1} of this delivery` });
        });
        break;
      }
      case "nonNegative":
        records.forEach((r, i) => {
          const bad = (rule.fields ?? []).filter((f) => {
            const n = scaled(value(r, f));
            return n !== null && n < 0n;
          });
          if (bad.length) out[i]!.push({ ...base, field: bad[0], message: `${rule.check}: ${bad.join(", ")} below zero` });
        });
        break;
      case "reconcile":
        records.forEach((r, i) => {
          const target = scaled(value(r, rule.target!));
          const terms = (rule.terms ?? []).map((t) => [scaled(value(r, t.field)), t.sign] as const);
          // A reconciliation is judged only when every figure is present.
          if (target === null || terms.some(([n]) => n === null)) return;
          const sum = terms.reduce((a, [n, sign]) => a + (sign === 1 ? n! : -n!), 0n);
          if (sum !== target) {
            const expr = (rule.terms ?? []).map((t, k) => `${k ? (t.sign === 1 ? " + " : " − ") : ""}${t.field}`).join("");
            out[i]!.push({ ...base, field: rule.target, message: `${rule.check}: ${rule.target} should equal ${expr}` });
          }
        });
        break;
    }
  }
  return out;
}

/** Rules that name fields their entity does not have, or are incomplete (checked by the gate). */
export function ruleProblems(rules: QualityRules, columnsOf: (entity: string) => string[] | null): string[] {
  const problems: string[] = [];
  for (const r of rules.rules) {
    if (r.scope === "population") {
      if (!r.reason) problems.push(`${r.id}: a population rule states why it is monitored, not gated`);
      continue;
    }
    const cols = r.entity ? columnsOf(r.entity) : null;
    if (!cols) {
      problems.push(`${r.id}: unknown entity ${r.entity}`);
      continue;
    }
    const fields = [...(r.fields ?? []), ...(r.target ? [r.target] : []), ...(r.terms ?? []).map((t) => t.field)];
    if (!fields.length) problems.push(`${r.id}: no fields`);
    for (const f of fields) if (f !== "code" && !cols.includes(f)) problems.push(`${r.id}: ${r.entity} has no field ${f}`);
    if (!["required", "unique", "nonNegative", "reconcile"].includes(r.kind ?? "")) problems.push(`${r.id}: unknown kind ${r.kind}`);
  }
  return problems;
}
