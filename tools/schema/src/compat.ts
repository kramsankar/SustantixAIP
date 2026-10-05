/**
 * Compatibility: rebuilding each replaced workbook sheet from the normalized model.
 *
 * The same SheetSpec drives two things that must agree:
 *   - rebuildSheet (TypeScript) reconstructs every sheet row from the built rows and compares it, cell by cell,
 *     with the corrected workbook — the round-trip gate;
 *   - compatSql emits aip_compat.<sheet> views that rebuild the sheet inside the database.
 * Differences are classified: vocabulary (a spelling normalized to its canonical label), copy (a duplicated
 * attribute that disagreed with its master) — both expected consequences of normalizing — and unexplained, which
 * fails the gate.
 */
import { coerce } from "./rows.ts";
import { isoDateTime, type BuiltMaster, type MasterBuild, type MasterDef, type MasterRow } from "./masters.ts";
import { Resolver, isScoped, type Vocabulary } from "./reference.ts";
import type { ColumnDef, Registry, TableDef } from "./registry.ts";
import { SHEET_SPECS, type Copy, type SheetSpec, type Source } from "./sheet-model.ts";
import { applyCorrections, type CorrectionSet } from "./corrections.ts";
import type { SourceRow } from "./rows.ts";
import { rowKey } from "./rows.ts";

export type DiffClass = "vocabulary" | "format" | "copy" | "unexplained";

export interface SheetRoundTrip {
  sheet: string;
  model: string;
  rows: number;
  identicalRows: number;
  cells: number;
  diffs: Record<DiffClass, number>;
  examples: Array<{ key: string; column: string; class: DiffClass; workbook: unknown; rebuilt: unknown }>;
}

const srcCol = (s: Source): string => (typeof s === "string" ? s : "col" in s ? s.col : "datetime" in s ? s.datetime : s.bool);

function labels(vocab: Vocabulary): (ref: string, code: unknown, scope?: string) => string | null {
  const m = new Map<string, string>();
  for (const t of vocab.tables) for (const v of t.values) m.set(`${t.name}|${isScoped(t) ? v.scope : ""}|${v.code}`, v.label);
  return (ref, code, scope) => (code === null || code === undefined ? null : m.get(`${ref}|${scope ?? ""}|${String(code)}`) ?? null);
}

/** "2026-09-08T16:00:00" → "08-09-2026 16:00" (dmy) or "2026-09-08 16:00" (iso), the workbook's own forms. */
export function workbookDateTime(iso: unknown, format: "dmy" | "iso" = "iso"): string | null {
  if (iso === null || iso === undefined) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  return format === "dmy" ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}` : `${m[1]}-${m[2]}-${m[3]} ${m[4]}`;
}

const same = (a: unknown, b: unknown, c: ColumnDef): boolean => {
  if ((a === null || a === undefined || a === "") && (b === null || b === undefined || b === "")) return true;
  if (typeof a === "number" || typeof b === "number" || c.kind === "decimal" || c.kind === "money" || c.kind === "integer") return Math.abs(Number(a) - Number(b)) < 1e-9 * Math.max(1, Math.abs(Number(a)));
  return String(a).trim() === String(b).trim();
};

export function rebuildSheets(reg: Registry, raw: Record<string, SourceRow[]>, b: MasterBuild, vocab: Vocabulary, corrections: CorrectionSet, specs = SHEET_SPECS): SheetRoundTrip[] {
  const { sheets } = applyCorrections(reg, raw, corrections);
  const label = labels(vocab);
  const resolver = new Resolver(vocab);
  const byName = new Map(b.masters.map((m) => [m.def.name, m]));
  const index = new Map<string, Map<string, MasterRow>>();
  const rowOf = (master: string, code: unknown) => {
    if (code === null || code === undefined) return undefined;
    let ix = index.get(master);
    if (!ix) index.set(master, (ix = new Map(byName.get(master)!.rows.map((r) => [r.code, r]))));
    return ix.get(String(code));
  };
  const follow = (def: MasterDef, row: MasterRow | undefined, path: string, labelRef?: string): unknown => {
    if (!row) return null;
    const [head, ...rest] = path.split(".");
    const col = def.columns.find((c) => c.name === head);
    const v = head === "code" ? row.code : row.values[head!];
    if (!rest.length) {
      if (col?.kind === "ref") return label(col.ref!, v, col.scope);
      return labelRef ? label(labelRef, v) : v;
    }
    if (col?.kind !== "fk") throw new Error(`${def.name}.${head} is not a reference`);
    const target = byName.get(col.fk!)!;
    return follow(target.def, rowOf(col.fk!, v), rest.join("."), labelRef);
  };
  return specs.map((s) => {
    const t = reg.tables.find((x) => x.name === s.sheet)!;
    const built = byName.get(s.name)!;
    const original = new Map((sheets[t.sheet] ?? []).map((r, i) => [rowKey(t, r, i), r]));
    const code = t.key.length === 1 ? t.columns.find((c) => c.source === t.key[0])?.name : undefined;
    const out: SheetRoundTrip = { sheet: s.sheet, model: s.name, rows: built.rows.length, identicalRows: 0, cells: 0, diffs: { vocabulary: 0, format: 0, copy: 0, unexplained: 0 }, examples: [] };
    for (const row of built.rows) {
      const orig = original.get(row.code);
      let identical = true;
      for (const c of t.columns) {
        out.cells++;
        const want = orig ? coerce(c, orig[c.source]) : undefined;
        let got: unknown;
        let cls: DiffClass = "unexplained";
        const carried = Object.entries(s.columns).filter(([, src]) => srcCol(src) === c.name);
        const copy = s.copies?.[c.name];
        if (c.name === code && !carried.length) got = row.code;
        else if (copy) {
          const via = s.columns[copy.via] as { fk: string };
          got = follow(byName.get(via.fk)!.def, rowOf(via.fk, row.values[copy.via]), copy.attr, copy.label);
          cls = "copy";
        } else if (carried.length) {
          const values = carried.map(([name, src]) => {
            const v = row.values[name];
            if (typeof src === "string" || "fk" in src) return v;
            if ("ref" in src) return label(src.ref, v, src.scope);
            if ("datetime" in src) return workbookDateTime(v, src.format === "dmy" ? "dmy" : "iso");
            return v === null || v === undefined ? null : v ? "Yes" : "No";
          });
          got = values.find((v) => v !== null && v !== undefined) ?? null;
          // A spelling normalized to the canonical label is expected when the original resolves to the same code.
          const refSrcs = carried.filter(([, src]) => typeof src !== "string" && "ref" in src);
          for (const [name, srcAny] of refSrcs) {
            const src = srcAny as { ref: string; scope?: string; nullTokens?: string[] };
            const r = resolver.resolve({ column: `${s.sheet}.${c.name}`, ref: src.ref, scope: src.scope, nullTokens: src.nullTokens }, want);
            if (r.status === "code" && r.code === row.values[name]) cls = "vocabulary";
            if (r.status === "null" && (got === null || got === undefined)) cls = "vocabulary";
          }
          // The same instant written in the sheet's other date format.
          const dtSrc = carried.find(([, src]) => typeof src !== "string" && "datetime" in src);
          if (dtSrc && want !== null && want !== undefined && isoDateTime(want) === row.values[dtSrc[0]]) cls = "format";
        } else continue; // omitted with a documented reason
        if (!same(want, got, c)) {
          identical = false;
          out.diffs[cls]++;
          if (out.examples.length < 8 && (cls === "unexplained" || out.examples.filter((e) => e.class === cls).length < 3)) out.examples.push({ key: row.code, column: c.name, class: cls, workbook: want ?? null, rebuilt: got ?? null });
        }
      }
      if (identical) out.identicalRows++;
    }
    return out;
  });
}

// ── SQL ─────────────────────────────────────────────────────────────────────

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

function pgSheetType(c: ColumnDef): string {
  switch (c.kind) {
    case "text":
      return `varchar(${c.maxLength ?? 200})`;
    case "memo":
    case "url":
      return "text";
    case "integer":
      return "integer";
    case "bigint":
      return "bigint";
    case "decimal":
      return `numeric(24,${c.precision ?? 4})`;
    case "money":
      return `numeric(24,${c.precision ?? 2})`;
    case "date":
      return "date";
    case "datetime":
      return "timestamp without time zone";
    case "boolean":
      return "boolean";
  }
}

/**
 * aip_compat.<sheet>: the sheet rebuilt from the normalized tables, same columns and types, with row_key and the
 * source order (source_ordinal). security_invoker, so the caller's row-level security applies.
 */
export function compatSql(reg: Registry, defs: MasterDef[], specs = SHEET_SPECS): string {
  const byName = new Map(defs.map((d) => [d.name, d]));
  const out = [
    "-- Sustantix AIP · phase 3 compatibility views (generated by tools/schema from src/sheet-model.ts — do not edit by hand)",
    "-- Each view rebuilds one workbook sheet from the normalized model, so the runtime and integrations keep their shape.",
    "create schema if not exists aip_compat;",
    "grant usage on schema aip_compat to authenticated, service_role;",
  ];
  for (const s of specs) {
    const t = reg.tables.find((x) => x.name === s.sheet)!;
    const def = byName.get(s.name)!;
    const code = t.key.length === 1 ? t.columns.find((c) => c.source === t.key[0])?.name : undefined;
    const joins: string[] = [];
    const aliasFor = new Map<string, string>();
    // Join path through references: "asset" → alias, "asset.manufacturer" → alias, …
    const joinPath = (fromDef: MasterDef, fromAlias: string, path: string[]): { def: MasterDef; alias: string } => {
      let d = fromDef;
      let a = fromAlias;
      let key = fromAlias;
      for (const step of path) {
        const col = d.columns.find((c) => c.name === step);
        if (!col || col.kind !== "fk") throw new Error(`${d.name}.${step} is not a reference`);
        key = `${key}.${step}`;
        let alias = aliasFor.get(key);
        if (!alias) {
          alias = `j${aliasFor.size}`;
          aliasFor.set(key, alias);
          joins.push(`left join aip.${q(col.fk!)} ${alias} on ${alias}.id = ${a}.${q(`${step}_id`)}`);
        }
        d = byName.get(col.fk!)!;
        a = alias;
      }
      return { def: d, alias: a };
    };
    let refN = 0;
    const refLabel = (alias: string, column: string, ref: string) => {
      const r = `r${refN++}`;
      joins.push(`left join aip.${q(`ref_${ref}`)} ${r} on ${r}.id = ${alias}.${q(`${column}_id`)}`);
      return `${r}.label`;
    };
    const exprs: string[] = [];
    for (const c of t.columns) {
      const carried = Object.entries(s.columns).filter(([, src]) => srcCol(src) === c.name);
      const copy = s.copies?.[c.name];
      let e: string;
      if (c.name === code && !carried.length) e = "t.code";
      else if (copy) {
        const parts = copy.attr.split(".");
        const { def: d, alias } = joinPath(def, "t", [copy.via, ...parts.slice(0, -1)]);
        const last = parts[parts.length - 1]!;
        const col = d.columns.find((x) => x.name === last);
        if (last === "code") e = `${alias}.code`;
        else if (col?.kind === "fk") e = `(select x.code from aip.${q(col.fk!)} x where x.id = ${alias}.${q(`${last}_id`)})`;
        else if (col?.kind === "ref") e = refLabel(alias, last, col.ref!);
        else e = `${alias}.${q(last)}`;
      } else if (carried.length) {
        const parts = carried.map(([name, src]) => {
          if (typeof src === "string") return `t.${q(name)}`;
          if ("fk" in src) return `${joinPath(def, "t", [name]).alias}.code`;
          if ("ref" in src) return refLabel("t", name, src.ref);
          if ("datetime" in src) return `to_char(t.${q(name)}, '${src.format === "dmy" ? "DD-MM-YYYY HH24:MI" : "YYYY-MM-DD HH24:MI"}')`;
          return `case when t.${q(name)} then 'Yes' when not t.${q(name)} then 'No' end`;
        });
        e = parts.length > 1 ? `coalesce(${parts.join(", ")})` : parts[0]!;
      } else e = "null";
      exprs.push(`(${e})::${pgSheetType(c)} as ${q(c.name)}`);
    }
    if (t.columns.some((c) => c.kind === "money")) exprs.push("t.currency");
    out.push(
      `drop view if exists aip_compat.${q(t.name)};`,
      `create view aip_compat.${q(t.name)} with (security_invoker = true) as\nselect t.tenant_id, t.code as row_key, t.source_ordinal,\n  ${exprs.join(",\n  ")}\nfrom aip.${q(s.name)} t\n${joins.join("\n")};`,
      `comment on view aip_compat.${q(t.name)} is ${`'Workbook sheet "${t.sheet}" rebuilt from aip.${s.name}'`};`,
      `grant select on aip_compat.${q(t.name)} to authenticated, service_role;`,
    );
  }
  return out.join("\n") + "\n";
}

/** Columns each compat view must reproduce exactly (carried without transformation): checked in the database. */
export function exactColumns(reg: Registry, spec: SheetSpec): string[] {
  const t = reg.tables.find((x) => x.name === spec.sheet)!;
  const code = t.key.length === 1 ? t.columns.find((c) => c.source === t.key[0])?.name : undefined;
  return t.columns
    .filter((c) => c.name === code || Object.values(spec.columns).some((src) => (typeof src === "string" && src === c.name) || (typeof src !== "string" && "fk" in src && src.col === c.name)))
    .map((c) => c.name);
}

export type { BuiltMaster, TableDef, Copy };

/**
 * Database proof that each compatibility view rebuilds its sheet for a loaded tenant: same row count, and the same
 * rows on every column the round trip found identical (all columns where the sheet round-trips exactly).
 */
export function compatTestSql(reg: Registry, trips: SheetRoundTrip[], tenantId: string, specs = SHEET_SPECS): string {
  const out = [
    "-- Compatibility views rebuild their sheets (generated by tools/schema from the round trip — do not edit by hand).",
    "-- Run after the seed has loaded the tenant below.",
    "\\set ON_ERROR_STOP 1",
  ];
  for (const s of specs) {
    const t = reg.tables.find((x) => x.name === s.sheet)!;
    const trip = trips.find((x) => x.sheet === s.sheet)!;
    const exact = trip.identicalRows === trip.rows ? t.columns.map((c) => c.name) : exactColumns(reg, s);
    const cols = ["row_key", ...exact.filter((c) => c !== "row_key")].map(q).join(", ");
    const T = `'${tenantId}'`;
    out.push(`do $$
declare a int; b int; d int;
begin
  select count(*) into a from aip_compat.${q(t.name)} where tenant_id = ${T};
  select count(*) into b from aip.${q(t.name)} where tenant_id = ${T};
  if a <> b then raise exception '${t.name}: compat view has % rows, sheet has %', a, b; end if;
  select count(*) into d from (select ${cols} from aip_compat.${q(t.name)} where tenant_id = ${T} except all select ${cols} from aip.${q(t.name)} where tenant_id = ${T}) x;
  if d <> 0 then raise exception '${t.name}: % rebuilt row(s) differ on ${exact.length} checked column(s)', d; end if;
end $$;`);
  }
  out.push(`\\echo 'compatibility views rebuild ${specs.length} sheets'`);
  return out.join("\n") + "\n";
}

const n = (x: number) => x.toLocaleString("en-US");

/** Markdown report: what phase 3 normalized and how exactly each sheet rebuilds. */
export function phase3Report(reg: Registry, b: MasterBuild, trips: SheetRoundTrip[], linkIssues: number, specIssues: string[]): string {
  const tx = b.masters.filter((m) => m.def.layer === "transaction" || m.def.layer === "series");
  const links = b.masters.find((m) => m.def.name === "record_link")?.rows ?? [];
  const byType = new Map<string, number>();
  for (const l of links) byType.set(`${String(l.values.from_entity)} → ${String(l.values.link_type)} → ${String(l.values.to_entity)}`, (byType.get(`${String(l.values.from_entity)} → ${String(l.values.link_type)} → ${String(l.values.to_entity)}`) ?? 0) + 1);
  const sum = (k: DiffClass) => trips.reduce((a, t) => a + t.diffs[k], 0);
  const lines = [
    "# Phase 3 — transactions, time series, record links and compatibility",
    "",
    `Generated by \`pnpm --filter @sustantix/schema check:data\` from ${reg.source} (sha256 ${reg.sourceSha256.slice(0, 12)}…). Do not edit by hand.`,
    "",
    "## Summary",
    "",
    "| Measure | Value |",
    "| --- | --- |",
    `| Transaction tables | ${tx.filter((m) => m.def.layer === "transaction").length} (${n(tx.filter((m) => m.def.layer === "transaction").reduce((a, m) => a + m.rows.length, 0))} rows) |`,
    `| Time-series tables | ${tx.filter((m) => m.def.layer === "series").length} (${n(tx.filter((m) => m.def.layer === "series").reduce((a, m) => a + m.rows.length, 0))} rows) |`,
    `| Record links | ${n(links.length)} (${linkIssues} with a missing end) |`,
    `| Sheets rebuilt by compatibility views | ${trips.length}, ${trips.filter((t) => t.identicalRows === t.rows).length} exactly |`,
    `| Cells compared | ${n(trips.reduce((a, t) => a + t.cells, 0))} |`,
    `| Differences: vocabulary normalized | ${n(sum("vocabulary"))} |`,
    `| Differences: other date format, same instant | ${n(sum("format"))} |`,
    `| Differences: copy disagreed with its master | ${n(sum("copy"))} |`,
    `| Differences: unexplained | ${n(sum("unexplained"))} |`,
    `| Unaccounted sheet columns | ${specIssues.length} |`,
    "",
    "Vocabulary and format differences are the normalization itself: the compatibility view shows the canonical label or the ISO form. Copy differences are inconsistencies the workbook carried: a sheet that repeated an asset tag or plant name that disagrees with the master. The master is the truth, so screens that showed the stale copy change when the runtime reads the compatibility views (phase 3c), and their parity baselines are re-reviewed.",
    "",
    "## Sheets",
    "",
    "| Sheet | Table | Rows | Exact rows | Vocabulary | Format | Copy | Unexplained | Examples |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...trips.map((t) => `| \`${t.sheet}\` | \`${t.model}\` | ${n(t.rows)} | ${n(t.identicalRows)} | ${t.diffs.vocabulary || ""} | ${t.diffs.format || ""} | ${t.diffs.copy || ""} | ${t.diffs.unexplained ? `**${t.diffs.unexplained}**` : ""} | ${t.examples.filter((e) => e.class !== "vocabulary").slice(0, 2).map((e) => `${e.key}.${e.column}: ${JSON.stringify(e.workbook)} → ${JSON.stringify(e.rebuilt)}`).join("; ")} |`),
    "",
    "## Record links",
    "",
    "| Link | Count |",
    "| --- | --- |",
    ...[...byType].map(([k, v]) => `| ${k} | ${n(v)} |`),
    "",
  ];
  if (specIssues.length) lines.push("## Unaccounted columns", "", ...specIssues.map((s) => `- ${s}`), "");
  return lines.join("\n");
}
