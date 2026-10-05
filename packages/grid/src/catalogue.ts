/**
 * Resolves the grid catalogue (schema/grids/grids.json) against the governed model: entity columns take their type,
 * vocabulary, references and editability from the change model; sheet columns from the data-model registry. A grid
 * that names a column its source does not have is a catalogue error, reported rather than rendered.
 */
import type { ColumnKind, GridColumn, GridDef, GridFilter, GridSource, SortSpec } from "./contract.ts";

export interface CatalogueColumn {
  field: string;
  label: string;
  kind: ColumnKind;
}

export interface CatalogueGrid {
  id: string;
  title: string;
  screen: string;
  source: { kind: GridSource["kind"]; name?: string; fixed?: GridFilter[]; platformRows?: boolean };
  columns: Array<string | CatalogueColumn>;
  key?: string;
  defaultSort?: SortSpec[];
  groupBy?: string[];
  bulkEdit?: string[];
  tree?: { parent: string };
}

export interface Catalogue {
  version: 1;
  grids: CatalogueGrid[];
}

export interface ChangeModel {
  version: 1;
  maxItems: number;
  entities: Array<{
    name: string;
    label: string;
    layer: string;
    view: string;
    writers: string[];
    editable: boolean;
    columns: Array<{ name: string; label: string; kind: ColumnKind; ref?: string; scope?: string; fk?: string; editable: boolean }>;
  }>;
}

export interface RegistryLike {
  tables: Array<{ name: string; sheet: string; columns: Array<{ name: string; label: string; kind: string; currency?: string }> }>;
}

const ID = /^[a-z][a-z0-9-]*$/;
const KINDS = new Set<ColumnKind>(["text", "memo", "url", "integer", "decimal", "money", "date", "datetime", "boolean", "fk", "ref"]);

export function resolveCatalogue(cat: Catalogue, model: ChangeModel, registry: RegistryLike): { grids: GridDef[]; problems: string[] } {
  const problems: string[] = [];
  const grids: GridDef[] = [];
  const seen = new Set<string>();
  for (const g of cat.grids) {
    const where = `grid ${g.id}`;
    if (!ID.test(g.id)) problems.push(`${where}: id must be lower-case words joined by hyphens`);
    if (seen.has(g.id)) problems.push(`${where}: duplicate id`);
    seen.add(g.id);
    let columns: GridColumn[] = [];
    let relation = "";
    let key = g.key ?? "code";
    let entity: string | null = null;
    let writers: string[] = [];
    switch (g.source.kind) {
      case "entity": {
        const e = model.entities.find((x) => x.name === g.source.name);
        if (!e) {
          problems.push(`${where}: unknown entity ${g.source.name}`);
          continue;
        }
        relation = `aip.${e.view}`;
        entity = e.name;
        writers = e.editable ? e.writers : [];
        key = "code";
        for (const c of g.columns) {
          const field = typeof c === "string" ? c : c.field;
          const m = e.columns.find((x) => x.name === field);
          if (!m) {
            problems.push(`${where}: ${e.name} has no column ${field}`);
            continue;
          }
          columns.push({
            field,
            label: typeof c === "string" ? m.label : c.label,
            kind: m.kind,
            editable: e.editable && m.editable,
            ...(m.ref ? { ref: m.ref } : {}),
            ...(m.scope ? { scope: m.scope } : {}),
            ...(m.fk ? { fk: m.fk } : {}),
          });
        }
        break;
      }
      case "sheet": {
        const t = registry.tables.find((x) => x.name === g.source.name);
        if (!t) {
          problems.push(`${where}: unknown sheet table ${g.source.name}`);
          continue;
        }
        relation = `aip.${t.name}`;
        key = "row_key";
        for (const c of g.columns) {
          const field = typeof c === "string" ? c : c.field;
          const m = t.columns.find((x) => x.name === field);
          if (!m) {
            problems.push(`${where}: ${t.name} has no column ${field}`);
            continue;
          }
          columns.push({ field, label: typeof c === "string" ? m.label : c.label, kind: (KINDS.has(m.kind as ColumnKind) ? m.kind : "text") as ColumnKind, editable: false });
        }
        break;
      }
      case "view":
      case "registry": {
        if (g.source.kind === "view" && !/^v_[a-z0-9_]+$/.test(g.source.name ?? "")) problems.push(`${where}: a view source names an aip.v_* view`);
        relation = g.source.kind === "view" ? `aip.${g.source.name}` : "registry";
        if (!g.key) problems.push(`${where}: ${g.source.kind} sources declare their key`);
        for (const c of g.columns) {
          if (typeof c === "string" || !KINDS.has(c.kind)) {
            problems.push(`${where}: ${g.source.kind} columns declare field, label and kind`);
            continue;
          }
          columns.push({ field: c.field, label: c.label, kind: c.kind, editable: false });
        }
        break;
      }
    }
    if (!columns.length) problems.push(`${where}: no columns`);
    const fields = new Set(columns.map((c) => c.field));
    for (const s of g.defaultSort ?? []) if (!fields.has(s.field)) problems.push(`${where}: sorts on ${s.field}, which it does not show`);
    for (const f of g.groupBy ?? []) if (!fields.has(f)) problems.push(`${where}: groups by ${f}, which it does not show`);
    for (const f of g.bulkEdit ?? []) if (!columns.find((c) => c.field === f)?.editable) problems.push(`${where}: bulk edit on ${f}, which is not editable`);
    if (g.tree && columns.find((c) => c.field === g.tree!.parent)?.fk !== entity) problems.push(`${where}: tree parent ${g.tree.parent} must reference the grid's own entity`);
    grids.push({
      id: g.id,
      title: g.title,
      screen: g.screen,
      source: g.source,
      relation,
      columns,
      key,
      entity,
      writers,
      defaultSort: g.defaultSort ?? [],
      groupBy: g.groupBy ?? [],
      bulkEdit: g.bulkEdit ?? [],
      tree: g.tree ?? null,
    });
  }
  return { grids, problems };
}

/** The Data Management field dictionary: one row per governed field, from the registry and vocabulary bindings. */
export function registryRows(registry: RegistryLike, bindings: Array<{ column: string; ref: string; scope?: string }>): Array<Record<string, unknown>> {
  const governed = new Map(bindings.map((b) => [b.column, b.scope ? `${b.ref} (${b.scope})` : b.ref]));
  return registry.tables.flatMap((t) =>
    t.columns.map((c) => ({
      id: `${t.name}.${c.name}`,
      sheet: t.sheet,
      column: c.label,
      type: c.kind,
      currency: c.currency ?? null,
      governed_by: governed.get(`${t.name}.${c.name}`) ?? null,
    })),
  );
}
