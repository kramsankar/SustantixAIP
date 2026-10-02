/**
 * Phase-1 data quality: does every governed column use the controlled vocabulary, and does every
 * cross-sheet reference resolve? Every gap must be either fixed by a mechanical rule or classified
 * (phase-2 merge, owner decision); an unclassified gap fails the check.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CorrectionEntry } from "./corrections.ts";
import { Resolver, type Binding, type OpenDecision, type Vocabulary } from "./reference.ts";
import type { Registry, TableDef } from "./registry.ts";
import type { SourceRow } from "./rows.ts";

export interface ColumnConformance {
  column: string;
  ref: string;
  scope?: string;
  values: number;
  byCode: number;
  byLabel: number;
  byAlias: number;
  fallback: number;
  wildcard: number;
  nulls: number;
  declared: Array<{ value: string; count: number }>;
  undeclared: Array<{ value: string; count: number }>;
}

export interface IntegrityRule {
  from: string;
  class: "crosswalk" | "null-token" | "aggregate" | "merge" | "owner";
  kind?: "composite" | "alternate";
  match?: string;
  template?: string;
  to?: string;
  note?: string;
  question?: string;
}

export interface IntegrityRules {
  version: 1;
  description: string;
  relationships: Array<{ from: string; to: string; except?: string[] }>;
  rules: IntegrityRule[];
}

export interface ReferenceCheck {
  from: string;
  to: string;
  values: number;
  resolved: number;
  /** Values that resolve only because a governed correction derived the referenced record. */
  corrected: number;
  correctedBy: Map<string, number>;
  byClass: Partial<Record<IntegrityRule["class"], { values: number; distinct: number; rules: Set<IntegrityRule> }>>;
  unclassified: Array<{ value: string; count: number }>;
  /** Values matched by a mechanical rule that the rule failed to resolve. */
  failedMechanical: Array<{ value: string; count: number }>;
  /** Values classified by each rule. */
  byRule: Map<IntegrityRule, number>;
}

export function loadIntegrityRules(root: string): IntegrityRules {
  return JSON.parse(readFileSync(join(root, "schema/reference/integrity.json"), "utf8")) as IntegrityRules;
}

type Rows = Record<string, SourceRow[]>;

function columnValues(reg: Registry, sheets: Rows, ref: string): { table: TableDef; source: string; rows: SourceRow[] } {
  const [tn, cn] = ref.split(".");
  const table = reg.tables.find((t) => t.name === tn);
  const col = table?.columns.find((c) => c.name === cn);
  if (!table || !col) throw new Error(`unknown column ${ref}`);
  return { table, source: col.source, rows: sheets[table.sheet] ?? [] };
}

const declaredFor = (decisions: OpenDecision[], b: Binding, value: string) =>
  decisions.some((d) => d.columns.includes(b.column) && d.values.includes(value));

export function conformance(reg: Registry, sheets: Rows, v: Vocabulary): ColumnConformance[] {
  const resolver = new Resolver(v);
  return v.bindings.map((b) => {
    const { source, rows } = columnValues(reg, sheets, b.column);
    const r: ColumnConformance = { column: b.column, ref: b.ref, scope: b.scope, values: 0, byCode: 0, byLabel: 0, byAlias: 0, fallback: 0, wildcard: 0, nulls: 0, declared: [], undeclared: [] };
    const misses = new Map<string, number>();
    for (const row of rows) {
      const res = resolver.resolve(b, row[source]);
      if (res.status === "null") { r.nulls++; continue; }
      r.values++;
      if (res.status === "code") r[res.via === "code" ? "byCode" : res.via === "label" ? "byLabel" : "byAlias"]++;
      else if (res.status === "fallback") r.fallback++;
      else if (res.status === "wildcard") r.wildcard++;
      else misses.set(String(row[source]).trim(), (misses.get(String(row[source]).trim()) ?? 0) + 1);
    }
    for (const [value, count] of [...misses].sort((a, b) => b[1] - a[1])) (declaredFor(v.openDecisions, b, value) ? r.declared : r.undeclared).push({ value, count });
    return r;
  });
}

function ruleApplies(rule: IntegrityRule, from: string, value: string): boolean {
  const [rt, rc] = rule.from.split(".");
  const [ft, fc] = from.split(".");
  if (rc !== fc || (rt !== "*" && rt !== ft)) return false;
  return rule.match ? new RegExp(rule.match).test(value) : true;
}

/**
 * Checks every declared reference. Pass the corrected rows and the correction entries (see applyCorrections)
 * to see which references a correction resolved; without them the check runs on the raw workbook.
 */
export function integrity(reg: Registry, sheets: Rows, rules: IntegrityRules, corrections: CorrectionEntry[] = []): ReferenceCheck[] {
  const derivedKeys = new Map<string, Map<string, string>>();
  // Cells a remap changed: a reference that resolves through one counts as resolved by that correction.
  const remapped = new Map<SourceRow, Map<string, string>>();
  for (const e of corrections.filter((x) => x.kind === "remap")) {
    const t = reg.tables.find((x) => x.name === e.target)!;
    const cells = remapped.get(e.row) ?? new Map<string, string>();
    for (const ch of e.changes ?? []) cells.set(t.columns.find((c) => c.name === ch.column)!.source, e.correction);
    remapped.set(e.row, cells);
  }
  for (const d of corrections.filter((x) => x.kind === "derive")) {
    const t = reg.tables.find((x) => x.name === d.target)!;
    for (const [col, v] of Object.entries(d.row)) {
      const c = t.columns.find((x) => x.source === col);
      if (!c || v === null || v === undefined) continue;
      const k = `${d.target}.${c.name}`;
      (derivedKeys.get(k) ?? derivedKeys.set(k, new Map()).get(k)!).set(String(v), d.correction);
    }
  }
  const keysOf = (ref: string) => {
    const { source, rows } = columnValues(reg, sheets, ref);
    return new Set(rows.map((r) => r[source]).filter((x) => x !== null && x !== undefined && x !== "").map(String));
  };
  const out: ReferenceCheck[] = [];
  for (const rel of rules.relationships) {
    const [ft, fc] = rel.from.split(".");
    const target = rel.to.split(".")[0];
    const sources = ft === "*" ? reg.tables.filter((t) => t.name !== target && !rel.except?.includes(t.name) && t.columns.some((c) => c.name === fc)).map((t) => `${t.name}.${fc}`) : [rel.from];
    const keys = keysOf(rel.to);
    const viaCorrection = derivedKeys.get(rel.to) ?? new Map<string, string>();
    for (const from of sources) {
      const { table, source, rows } = columnValues(reg, sheets, from);
      const check: ReferenceCheck = { from, to: rel.to, values: 0, resolved: 0, corrected: 0, correctedBy: new Map(), byClass: {}, unclassified: [], failedMechanical: [], byRule: new Map() };
      const unclassified = new Map<string, number>();
      const failed = new Map<string, number>();
      const distinct = new Map<IntegrityRule["class"], Set<string>>();
      for (const row of rows) {
        const raw = row[source];
        if (raw === null || raw === undefined || raw === "") continue;
        const value = String(raw).trim();
        check.values++;
        if (keys.has(value)) {
          const by = remapped.get(row)?.get(source) ?? viaCorrection.get(value);
          if (by) {
            check.corrected++;
            check.correctedBy.set(by, (check.correctedBy.get(by) ?? 0) + 1);
          } else check.resolved++;
          continue;
        }
        const rule = rules.rules.find((r) => ruleApplies(r, from, value));
        if (!rule) { unclassified.set(value, (unclassified.get(value) ?? 0) + 1); continue; }
        if (rule.class === "crosswalk") {
          const ok =
            rule.kind === "composite"
              ? keys.has(rule.template!.replace(/\{([a-z0-9_]+)\}/g, (_, c: string) => String(row[table.columns.find((x) => x.name === c)?.source ?? c] ?? "")))
              : keysOf(rule.to!).has(value);
          if (!ok) { failed.set(value, (failed.get(value) ?? 0) + 1); continue; }
        }
        const slot = (check.byClass[rule.class] ??= { values: 0, distinct: 0, rules: new Set() });
        slot.values++;
        slot.rules.add(rule);
        check.byRule.set(rule, (check.byRule.get(rule) ?? 0) + 1);
        (distinct.get(rule.class) ?? distinct.set(rule.class, new Set()).get(rule.class)!).add(value);
      }
      for (const [cls, set] of distinct) check.byClass[cls]!.distinct = set.size;
      check.unclassified = [...unclassified].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
      check.failedMechanical = [...failed].map(([value, count]) => ({ value, count }));
      if (check.values) out.push(check);
    }
  }
  return out;
}

export interface Phase1Summary {
  bindings: number;
  conformingValues: number;
  aliasedValues: number;
  declaredGaps: number;
  undeclaredGaps: number;
  references: number;
  referenceValues: number;
  resolvedDirect: number;
  resolvedByCorrection: number;
  resolvedMechanical: number;
  awaitingMerge: number;
  awaitingOwner: number;
  unclassified: number;
  failedMechanical: number;
}

export function summarize(c: ColumnConformance[], ic: ReferenceCheck[]): Phase1Summary {
  const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);
  const cls = (k: IntegrityRule["class"]) => sum(ic, (x) => x.byClass[k]?.values ?? 0);
  return {
    bindings: c.length,
    conformingValues: sum(c, (x) => x.byCode + x.byLabel + x.byAlias + x.fallback + x.wildcard),
    aliasedValues: sum(c, (x) => x.byAlias),
    declaredGaps: sum(c, (x) => sum(x.declared, (d) => d.count)),
    undeclaredGaps: sum(c, (x) => sum(x.undeclared, (d) => d.count)),
    references: ic.length,
    referenceValues: sum(ic, (x) => x.values),
    resolvedDirect: sum(ic, (x) => x.resolved),
    resolvedByCorrection: sum(ic, (x) => x.corrected),
    resolvedMechanical: cls("crosswalk") + cls("null-token") + cls("aggregate"),
    awaitingMerge: cls("merge"),
    awaitingOwner: cls("owner"),
    unclassified: sum(ic, (x) => sum(x.unclassified, (u) => u.count)),
    failedMechanical: sum(ic, (x) => sum(x.failedMechanical, (u) => u.count)),
  };
}

const n = (x: number) => x.toLocaleString("en-US");

/** Markdown report committed to docs/data so reviewers see exactly what phase 1 found. */
export function phase1Report(reg: Registry, v: Vocabulary, rules: IntegrityRules, c: ColumnConformance[], ic: ReferenceCheck[], corrections: { id: string; title: string; decision: string; target: string; records: number; kind: string }[] = []): string {
  const s = summarize(c, ic);
  const lines: string[] = [
    "# Phase 1 — reference data and integrity report",
    "",
    `Generated by \`pnpm --filter @sustantix/schema check:data\` from ${reg.source} (sha256 ${reg.sourceSha256.slice(0, 12)}…). Do not edit by hand.`,
    "",
    "## Summary",
    "",
    "| Measure | Value |",
    "| --- | --- |",
    `| Reference tables | ${v.tables.length} (${n(v.tables.reduce((k, t) => k + t.values.length, 0))} platform codes, ${n(v.tables.reduce((k, t) => k + t.aliases.length, 0))} aliases) |`,
    `| Governed columns | ${s.bindings} |`,
    `| Values that conform | ${n(s.conformingValues)} (${n(s.aliasedValues)} through an alias) |`,
    `| Values awaiting an owner decision | ${n(s.declaredGaps)} |`,
    `| Values outside the vocabulary and undeclared | ${n(s.undeclaredGaps)} |`,
    `| Cross-sheet references checked | ${s.references} columns, ${n(s.referenceValues)} values |`,
    `| Resolved directly | ${n(s.resolvedDirect)} |`,
    `| Resolved by a governed data correction | ${n(s.resolvedByCorrection)} |`,
    `| Resolved by a mechanical rule | ${n(s.resolvedMechanical)} |`,
    `| Resolve in the phase 2 merges | ${n(s.awaitingMerge)} |`,
    `| Awaiting an owner decision | ${n(s.awaitingOwner)} |`,
    `| Unclassified | ${n(s.unclassified + s.failedMechanical)} |`,
    "",
    "## Data corrections applied",
    "",
    "Governed corrections (schema/reference/corrections.json): derived records are built from the rows that reference them; remaps change values in place. Both are applied when data is loaded into the system of record and logged per row, with the changed cells, in `aip.data_correction`; the governed workbook is unchanged.",
    "",
    "| ID | Correction | Rows | Decision |",
    "| --- | --- | --- | --- |",
    ...corrections.map((x) => `| ${x.id} | ${x.title} (\`${x.target}\`) | ${n(x.records)} ${x.kind === "remap" ? "changed" : "added"} | ${x.decision} |`),
    ...(v.decisionsMade?.length
      ? ["", "### Vocabulary decisions", "", "| Date | Reference | Decision |", "| --- | --- | --- |", ...v.decisionsMade.map((d) => `| ${d.date} | ${d.ref} | ${d.decision} |`)]
      : []),
    "",
    "## Owner decisions",
    "",
    "### Reference integrity",
    "",
    "| Rule | Values | Question |",
    "| --- | --- | --- |",
  ];
  for (const rule of rules.rules.filter((r) => r.class === "owner")) {
    const matched = ic.reduce((k, x) => k + (x.byRule.get(rule) ?? 0), 0);
    lines.push(`| \`${rule.from}\`${rule.match ? ` ~ \`${rule.match}\`` : ""} | ${n(matched)} | ${rule.question ?? ""} |`);
  }
  lines.push("", "### Vocabulary", "", "| Reference | Columns | Values | Question |", "| --- | --- | --- | --- |");
  for (const d of v.openDecisions) lines.push(`| ${d.ref} | ${d.columns.map((x) => `\`${x}\``).join(", ")} | ${d.values.join("; ")} | ${d.question} |`);
  lines.push("", "## Column conformance", "", "| Column | Reference | Values | Code | Label | Alias | Other | Awaiting decision |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const x of c) {
    const other = x.fallback + x.wildcard;
    lines.push(`| \`${x.column}\` | ${x.ref}${x.scope ? ` / ${x.scope}` : ""} | ${n(x.values)} | ${n(x.byCode)} | ${n(x.byLabel)} | ${n(x.byAlias)} | ${other ? n(other) : ""} | ${x.declared.map((d) => `${d.value} (${d.count})`).join("; ")}${x.undeclared.length ? ` **UNDECLARED: ${x.undeclared.map((d) => `${d.value} (${d.count})`).join("; ")}**` : ""} |`);
  }
  lines.push("", "## Reference integrity", "", "| Reference | Target | Values | Direct | Corrected | Mechanical | Merge | Owner | Unclassified |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const x of ic) {
    const mech = (x.byClass.crosswalk?.values ?? 0) + (x.byClass["null-token"]?.values ?? 0) + (x.byClass.aggregate?.values ?? 0);
    const bad = [...x.unclassified, ...x.failedMechanical];
    lines.push(`| \`${x.from}\` | \`${x.to}\` | ${n(x.values)} | ${n(x.resolved)} | ${x.corrected ? `${n(x.corrected)} (${[...x.correctedBy.keys()].join(", ")})` : ""} | ${mech ? n(mech) : ""} | ${x.byClass.merge ? n(x.byClass.merge.values) : ""} | ${x.byClass.owner ? n(x.byClass.owner.values) : ""} | ${bad.length ? `**${bad.map((u) => `${u.value} (${u.count})`).slice(0, 5).join("; ")}**` : ""} |`);
  }
  lines.push("", "## Mechanical rules", "");
  for (const rule of rules.rules.filter((r) => r.class !== "owner")) lines.push(`- **${rule.class}** \`${rule.from}\`${rule.match ? ` ~ \`${rule.match}\`` : ""}: ${rule.note ?? ""}`);
  return lines.join("\n") + "\n";
}
