/**
 * The runtime catalogue: where every table in the runtime's tenant datasets is held, once each, by name.
 *
 *   - A table that is a copy of a governed workbook sheet (same sheet name, its columns all among the governed sheet's)
 *     is not stored again: its dataset refers to the governed sheet and reads the columns it uses. Edits made to the
 *     governed tables (grids, change sets, imports) therefore reach every screen.
 *   - Every other table is a catalogue sheet, stored once however many datasets carry it. A family of like lists
 *     (the same list kept per decision, per asset…) is one sheet whose rows are grouped by that key.
 *   - Each dataset keeps only its layout: its own structure and values, with references in place of tables.
 *
 * Deterministic: the same datasets and governed sheets always give the same catalogue (schema/runtime-sheets.json
 * records it, docs/data/runtime-sheets.md explains it).
 */
import { createHash } from "node:crypto";
import { isGovernedRef, isSheetRef, isTable, layoutOf, tablesOf, type Json, type TableRef } from "../../../packages/host-bridge/src/dataset-parts.ts";

export interface RuntimeDataset {
  id: string;
  label: string;
  value: Json;
}

export interface CatalogueSheet {
  name: string;
  rows: Json[];
  /** For a family of like lists: each list's key and its rows' range (lists kept in their family order). */
  groups?: Array<{ key: string; first: number; count: number }>;
  /** "<dataset label> <JSON Pointer>" of every table this sheet holds. */
  usedBy: string[];
}

export interface Catalogue {
  datasets: Array<{ id: string; label: string; layout: Json }>;
  sheets: CatalogueSheet[];
  /** Governed sheets read by the datasets, with the tables that read them. */
  governed: Array<{ sheet: string; usedBy: string[] }>;
}

const unescape = (t: string) => t.replace(/~1/g, "/").replace(/~0/g, "~");
const tokens = (pointer: string) => (pointer === "" ? [] : pointer.slice(1).split("/").map(unescape));
const hash = (rows: Json[]) => createHash("sha256").update(JSON.stringify(rows)).digest("hex");
const STRUCTURAL = new Set(["__rows", "rows", "data", "items", "records", "list", "sheets"]);
/** Tables of the built-in synthetic data (kept as data; the Excel variant is what the screens use by default). */
const SYNTHETIC = /synth|Synthetic/;

/** The name a table goes by: its key, or the nearest meaningful key above it. */
function baseName(path: string[], label: string): string {
  for (let i = path.length - 1; i >= 0; i--) {
    const t = path[i]!;
    if (/^\d+$/.test(t) || (STRUCTURAL.has(t) && i > 0)) continue;
    return t;
  }
  return label;
}

/** Columns of a table of records in first-seen order (null when any row is not a record). */
function columnsOf(rows: Json[]): string[] | null {
  const seen = new Set<string>();
  for (const r of rows) {
    if (typeof r !== "object" || r === null || Array.isArray(r)) return null;
    for (const k of Object.keys(r)) seen.add(k);
  }
  return [...seen];
}

export function buildCatalogue(datasets: readonly RuntimeDataset[], governedColumns: Readonly<Record<string, readonly string[]>>): Catalogue {
  type Found = { ds: RuntimeDataset; part: string; path: string[]; rows: Json[]; ref?: TableRef };
  const found: Found[] = [];
  for (const ds of datasets) for (const t of tablesOf(ds.value)) found.push({ ds, part: t.part, path: tokens(t.part), rows: t.rows });

  // 1 · Copies of governed sheets read the governed sheet.
  const governedUse = new Map<string, string[]>();
  for (const f of found) {
    const name = f.path.at(-1);
    const gcols = name === undefined ? undefined : governedColumns[name];
    const cols = columnsOf(f.rows);
    if (!gcols || !cols || !cols.every((c) => gcols.includes(c))) continue;
    f.ref = { $aipGoverned: name!, columns: cols };
    governedUse.set(name!, [...(governedUse.get(name!) ?? []), `${f.ds.label} ${f.part}`]);
  }

  // 2 · Families: three or more lists of one dataset that differ only in the key just above their name.
  const rest = found.filter((f) => !f.ref);
  const familyOf = new Map<Found, string>();
  const bySignature = new Map<string, Found[]>();
  for (const f of rest) {
    if (f.path.length < 2 || STRUCTURAL.has(f.path.at(-1)!)) continue;
    const sig = `${f.ds.id}|${f.path.slice(0, -2).join("/")}|*|${f.path.at(-1)}`;
    bySignature.set(sig, [...(bySignature.get(sig) ?? []), f]);
  }
  for (const [sig, members] of bySignature) if (members.length >= 3) for (const m of members) familyOf.set(m, sig);

  // 3 · Distinct contents (a family is one unit), each named by its key; a name two contents share is qualified by
  // the dataset that holds it, then by the path above it.
  type Unit = { key: string; base: string; members: Found[]; family: boolean };
  const units = new Map<string, Unit>();
  for (const f of rest) {
    const sig = familyOf.get(f);
    const key = sig ? `family|${sig}` : `table|${hash(f.rows)}`;
    const u = units.get(key) ?? { key, base: sig ? f.path.at(-1)! : baseName(f.path, f.ds.label), members: [], family: !!sig };
    u.members.push(f);
    units.set(key, u);
  }
  // A family's identity is its content too: two datasets holding the same family share it.
  const familyContent = (u: Unit) => hash(u.members.map((m) => [m.path.at(-2)!, m.rows] as unknown as Json));
  const merged = new Map<string, Unit>();
  for (const u of units.values()) {
    const id = u.family ? `family|${familyContent(u)}` : u.key;
    const into = merged.get(id);
    if (into) into.members.push(...u.members);
    else merged.set(id, { ...u, key: id, members: [...u.members] });
  }
  const byBase = new Map<string, Unit[]>();
  for (const u of merged.values()) byBase.set(u.base, [...(byBase.get(u.base) ?? []), u]);
  const names = new Map<Unit, string>();
  for (const [base, list] of byBase) {
    // A workbook-style name (a sheet) stands alone; a code key (lower-case) is named with the datasets that hold it.
    const code = /^[a-z]/.test(base);
    const labels = (u: Unit) => [...new Set(u.members.map((m) => m.ds.label))].sort().join(" + ");
    const variants = (u: Unit) => [...new Set(u.members.map((m) => (SYNTHETIC.test(`${m.ds.label} ${m.part}`) ? "synthetic" : "Excel")))].sort().join(" + ");
    const candidates: Array<(u: Unit) => string> = code
      ? [(u) => `${labels(u)} · ${base}`]
      : list.length === 1
        ? [() => base]
        : [(u) => `${base} · ${variants(u)}`, (u) => `${base} · ${labels(u)}`];
    // The plainest naming that tells every content apart; the path above the table settles the rest.
    let chosen = candidates.find((name) => new Set(list.map(name)).size === list.length) ?? candidates.at(-1)!;
    const counts = new Map<string, number>();
    for (const u of list) counts.set(chosen(u), (counts.get(chosen(u)) ?? 0) + 1);
    for (const u of list) {
      const n = chosen(u);
      if (counts.get(n) === 1) names.set(u, n);
      else {
        const m = u.members[0]!;
        const above = m.path.slice(0, u.family ? -2 : -1).filter((t) => !/^\d+$/.test(t) && !STRUCTURAL.has(t)).slice(-2).join(" / ");
        names.set(u, `${n} (${above || "root"})`);
      }
    }
  }
  const taken = new Set<string>();
  for (const [u, n] of names) {
    if (taken.has(n)) throw new Error(`catalogue name "${n}" is not unique`);
    taken.add(n);
  }

  // 4 · Sheets and references.
  const sheets: CatalogueSheet[] = [];
  for (const u of merged.values()) {
    const name = names.get(u)!;
    const usedBy = u.members.map((m) => `${m.ds.label} ${m.part}`).sort();
    if (!u.family) {
      for (const m of u.members) m.ref = { $aipSheet: name };
      sheets.push({ name, rows: u.members[0]!.rows, usedBy });
      continue;
    }
    // One copy of the family's lists (the first dataset holding it), in their order there; groups keyed by list key.
    const first = u.members[0]!.ds.id;
    const lists = u.members.filter((m) => m.ds.id === first);
    const rows: Json[] = [];
    const groups: Array<{ key: string; first: number; count: number }> = [];
    for (const m of lists) {
      groups.push({ key: m.path.at(-2)!, first: rows.length, count: m.rows.length });
      rows.push(...m.rows);
    }
    for (const m of u.members) m.ref = { $aipSheet: name, group: m.path.at(-2)! };
    sheets.push({ name, rows, groups, usedBy });
  }
  sheets.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const refs = new Map(found.map((f) => [`${f.ds.id}${f.part}`, f.ref!]));
  const out: Catalogue = {
    datasets: datasets.map((ds) => ({ id: ds.id, label: ds.label, layout: layoutOf(ds.value, (part) => refs.get(`${ds.id}${part}`)!) })),
    sheets,
    governed: [...governedUse].map(([sheet, usedBy]) => ({ sheet, usedBy: usedBy.sort() })).sort((a, b) => (a.sheet < b.sheet ? -1 : 1)),
  };

  // Every catalogue reference must give back exactly the table it replaced.
  const bySheet = new Map(out.sheets.map((s) => [s.name, s]));
  const sheetRows = (name: string, group?: string) => {
    const s = bySheet.get(name);
    if (!s) return undefined;
    if (group === undefined) return s.groups ? undefined : s.rows;
    const g = s.groups?.find((x) => x.key === group);
    return g ? s.rows.slice(g.first, g.first + g.count) : undefined;
  };
  for (const f of found) {
    if (!("$aipSheet" in f.ref!)) continue;
    const got = sheetRows(f.ref.$aipSheet, f.ref.group);
    if (JSON.stringify(got) !== JSON.stringify(f.rows)) throw new Error(`catalogue sheet "${f.ref.$aipSheet}" does not give back ${f.ds.label} ${f.part}`);
  }
  // And each layout matches its dataset everywhere else: same keys in the same order, same values, and a reference
  // exactly where each table was (a governed reference naming that table's columns).
  for (const d of out.datasets) checkLayout(d.layout, datasets.find((x) => x.id === d.id)!.value, sheetRows, d.label);
  return out;
}

function checkLayout(layout: Json, original: Json, sheetRows: (n: string, g?: string) => Json[] | undefined, where: string, at = ""): void {
  const fail = (why: string) => {
    throw new Error(`layout of ${where} differs at ${at || "/"}: ${why}`);
  };
  if (isTable(original)) {
    if (isGovernedRef(layout)) {
      if (JSON.stringify(layout.columns) !== JSON.stringify(columnsOf(original))) fail("governed columns");
      return;
    }
    if (isSheetRef(layout)) {
      if (JSON.stringify(sheetRows(layout.$aipSheet, layout.group)) !== JSON.stringify(original)) fail("sheet rows");
      return;
    }
    return fail("table without a reference");
  }
  if (Array.isArray(original)) {
    if (!Array.isArray(layout) || layout.length !== original.length) return fail("array");
    original.forEach((x, i) => checkLayout(layout[i]!, x, sheetRows, where, `${at}/${i}`));
    return;
  }
  if (typeof original === "object" && original !== null) {
    if (typeof layout !== "object" || layout === null || Array.isArray(layout)) return fail("object");
    const a = Object.keys(original);
    if (JSON.stringify(a) !== JSON.stringify(Object.keys(layout))) return fail("keys");
    for (const k of a) checkLayout((layout as Record<string, Json>)[k]!, (original as Record<string, Json>)[k]!, sheetRows, where, `${at}/${k}`);
    return;
  }
  if (layout !== original) fail("value");
}
