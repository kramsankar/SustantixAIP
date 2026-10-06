import { queryRows, resolveCatalogue, type Catalogue, type ChangeModel, type ChangeSetRequest, type ChangeSetResult, type GridColumn, type GridDef, type GridPage, type GridQuery } from "@sustantix/grid";
import changeModel from "../../../../schema/aip-change-model.json";
import catalogue from "../../../../schema/grids/grids.json";
import dataverseModel from "../../../../powerplatform/schema/change-model.json";

/**
 * The Enterprise Grid on Dataverse (Power Apps code app). Reads go through the code app's data client: a grid loads
 * its table once (Dataverse pages of up to 5,000) and sorts, filters and groups in the browser with the same semantics
 * as everywhere else. Writes are change sets applied server-side by the sus_ApplyChangeSet plug-in, atomically, with
 * the caller's security roles and Dataverse row versions. Saved views stay in this browser on this host.
 */

type Row = Record<string, unknown>;

export interface DataverseGridClient {
  /** One page of a table (entity set name), selected attributes, with lookup names as formatted values. */
  list(table: string, select: string[], skipToken?: string): Promise<{ rows: Row[]; skipToken?: string }>;
  /** Calls a Custom API; resolves its output parameters, rejects with the plug-in's message. */
  customApi(name: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** The entity set (data source) name the code app registered for a table's logical name. */
  entitySet(logicalName: string): string;
}

interface DvColumn {
  name: string;
  kind: string;
  attribute: string;
  target?: string;
  scope?: string;
  editable: boolean;
}
interface DvEntity {
  name: string;
  table: string;
  scoped?: boolean;
  columns: DvColumn[];
}
const DV = dataverseModel as unknown as { api: string; key: string; entities: DvEntity[]; platformCodes: Record<string, string[]> };
const PLATFORM = new Map(Object.entries(DV.platformCodes).map(([k, v]) => [k, new Set(v)]));
const FORMATTED = "@OData.Community.Display.V1.FormattedValue";

export class GridApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly body: Record<string, unknown>) {
    super(message);
    this.name = "GridApiError";
  }
  get conflict() {
    return this.status === 409 && this.code === "conflict" ? this.body : null;
  }
}

const STATUS: Record<string, number> = { conflict: 409, duplicate: 409, not_found: 404, forbidden: 403, read_only: 403, license_required: 402, unknown_entity: 422, invalid_value: 422, invalid_code: 422, unknown_reference: 422 };

/** A refusal from sus_ApplyChangeSet ("AIPCHANGESET {json}") as the grid's own error. */
export function changeSetError(e: unknown): GridApiError {
  const message = e instanceof Error ? e.message : String(e);
  const i = message.indexOf("AIPCHANGESET ");
  if (i >= 0) {
    try {
      const body = JSON.parse(message.slice(i + "AIPCHANGESET ".length).trim()) as Record<string, unknown>;
      const code = String(body.error ?? "change_failed");
      return new GridApiError(STATUS[code] ?? 400, code, String(body.message ?? code), body);
    } catch {
      /* fall through */
    }
  }
  return new GridApiError(500, "change_failed", message, {});
}

/** A Dataverse record as a grid row: business code, row version, values by change-model column name. */
export function toRow(e: DvEntity, r: Row, key: string): Row {
  const row: Row = { code: e.scoped ? String(r[key] ?? "").replace("/", ":") : r[key], row_version: r.versionnumber === undefined ? null : Number(r.versionnumber) };
  for (const c of e.columns) {
    if (c.attribute === "transactioncurrencyid") {
      const iso = r[`_transactioncurrencyid_value${FORMATTED}`];
      row.currency = typeof iso === "string" ? iso : null;
    } else if (c.target) {
      const name = r[`_${c.attribute}_value${FORMATTED}`];
      row[c.name] = typeof name === "string" ? (c.scope && name.startsWith(`${c.scope}/`) ? name.slice(c.scope.length + 1) : name) : null;
    } else if (c.attribute === "statecode") {
      row[c.name] = r.statecode === undefined ? null : r.statecode === 0;
    } else {
      const v = r[c.attribute];
      // Dataverse returns decimals and money as JSON numbers; their shortest form is the stored decimal (≤ 15 digits).
      row[c.name] = v === undefined ? null : (c.kind === "decimal" || c.kind === "money") && typeof v === "number" ? String(v) : c.kind === "date" && typeof v === "string" ? v.slice(0, 10) : v;
    }
  }
  // Platform vocabulary is read-only in the grid, as the plug-in refuses to change it.
  const platform = PLATFORM.get(e.name);
  if (platform) row.is_platform = platform.has(String(r[key] ?? ""));
  return row;
}

const select = (e: DvEntity, key: string) => [key, "versionnumber", ...e.columns.map((c) => (c.target || c.attribute === "transactioncurrencyid" ? `_${c.attribute}_value` : c.attribute))];

export function dataverseGridApi(client: DataverseGridClient, storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage) {
  const cache = new Map<string, Promise<Row[]>>();
  let probed: Promise<{ role: string; gridScreens: string }> | null = null;
  /** The caller's AIP role and the environment's screen-grid switch, from the change-set plug-in. */
  const probe = () =>
    (probed ??= client
      .customApi(DV.api, { ChangeSetJson: JSON.stringify({ probe: "role" }) })
      .then((o) => {
        const r = JSON.parse(String(o.ResultJson ?? "{}")) as { role?: string; gridScreens?: string };
        return { role: String(r.role ?? "viewer"), gridScreens: String(r.gridScreens ?? "") };
      })
      .catch(() => ({ role: "viewer", gridScreens: "" })));
  const entity = (name: string) => {
    const e = DV.entities.find((x) => x.name === name);
    if (!e) throw new GridApiError(404, "not_found", `no Dataverse table for ${name}`, {});
    return e;
  };
  const load = (name: string): Promise<Row[]> => {
    let hit = cache.get(name);
    if (!hit) {
      const e = entity(name);
      hit = (async () => {
        const out: Row[] = [];
        let token: string | undefined;
        do {
          const page = await client.list(client.entitySet(e.table), select(e, DV.key), token);
          out.push(...page.rows.map((r) => toRow(e, r, DV.key)));
          token = page.skipToken;
        } while (token);
        return out;
      })();
      cache.set(name, hit);
      hit.catch(() => cache.delete(name));
    }
    return hit;
  };
  const grids = (): GridDef[] => {
    const resolved = resolveCatalogue(catalogue as Catalogue, changeModel as ChangeModel, { tables: [] });
    // Dataverse serves the governed entities; analytics views, sheet tables and the registry are Supabase-side.
    return resolved.grids.filter((g) => g.entity && DV.entities.some((e) => e.name === g.entity));
  };
  const views = (grid: string) => {
    try {
      return JSON.parse(storage?.getItem(`sx_aip_grid_views:${grid}`) ?? "[]") as Array<{ id: string; grid: string; name: string; shared: boolean; mine: boolean; state: Record<string, unknown>; rowVersion: number }>;
    } catch {
      return [];
    }
  };
  const putViews = (grid: string, list: ReturnType<typeof views>) => {
    try {
      storage?.setItem(`sx_aip_grid_views:${grid}`, JSON.stringify(list));
    } catch {
      /* storage unavailable: views last for this visit */
    }
  };
  const gridDef = (id: string) => {
    const g = grids().find((x) => x.id === id);
    if (!g) throw new GridApiError(404, "not_found", "no such grid", {});
    return g;
  };
  const page = async (id: string, q: Partial<GridQuery>): Promise<GridPage> => {
    const g = gridDef(id);
    const rows = await load(g.entity!);
    const all = { offset: q.offset ?? 0, limit: q.limit ?? 100, sort: q.sort?.length ? q.sort : g.defaultSort, filters: [...(g.source.fixed ?? []), ...(q.filters ?? [])], ...(q.search ? { search: q.search } : {}) };
    const r = queryRows(rows, all, g.columns as GridColumn[], "code");
    return { rows: r.rows, total: r.total, offset: all.offset };
  };

  return {
    probe,
    async catalogue() {
      const r = (await probe()).role;
      return {
        role: r,
        grids: grids().map((g) => {
          const canEdit = g.writers.includes(r);
          return { ...g, canEdit, columns: g.columns.map((c) => ({ ...c, editable: canEdit && c.editable })) };
        }),
      };
    },
    rows: page,
    async exportRows(id: string, _format: "csv" | "xlsx", q: Partial<GridQuery>) {
      const r = await page(id, { ...q, offset: 0, limit: Number.MAX_SAFE_INTEGER });
      return { ...r, truncated: false };
    },
    async options(kind: "ref" | "fk", name: string, scope: string | null, search: string) {
      const rows = await load(kind === "ref" ? `ref_${name}` : name);
      const t = search.trim().toLowerCase();
      return rows
        .map((r) => {
          const code = String(r.code ?? "");
          return { code: scope && code.startsWith(`${scope}:`) ? code.slice(scope.length + 1) : code, label: typeof r.label === "string" ? r.label : null, scoped: code.includes(":"), scope: code.split(":")[0] };
        })
        .filter((o) => (scope ? o.scoped && o.scope === scope : true) && (!t || o.code.toLowerCase().includes(t) || (o.label ?? "").toLowerCase().includes(t)))
        .slice(0, kind === "ref" ? 200 : 50)
        .map(({ code, label }) => ({ code, label }));
    },
    views: async (grid: string) => views(grid),
    async saveView(grid: string, v: { name: string; shared: boolean; state: Record<string, unknown> }, existing?: { id: string }) {
      const list = views(grid).filter((x) => x.id !== existing?.id);
      const saved = { id: existing?.id ?? crypto.randomUUID(), grid, name: v.name, shared: false, mine: true, state: v.state, rowVersion: 1 };
      putViews(grid, [...list, saved]);
      return saved;
    },
    async deleteView(grid: string, id: string) {
      putViews(grid, views(grid).filter((x) => x.id !== id));
    },
    async applyChanges(req: ChangeSetRequest): Promise<ChangeSetResult> {
      try {
        const out = await client.customApi(DV.api, { ChangeSetJson: JSON.stringify(req) });
        for (const e of new Set(req.items.map((i) => i.entity))) cache.delete(e);
        return JSON.parse(String(out.ResultJson)) as ChangeSetResult;
      } catch (e) {
        throw changeSetError(e);
      }
    },
  };
}
