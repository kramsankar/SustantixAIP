// Shared fixtures for the grid UI tests: a work-order grid definition and an in-memory host.
import type { ChangeSetRequest, GridColumn, GridPage, GridQuery } from "../src/contract.ts";
import { queryRows } from "../src/query.ts";
import { GridApiError, type CatalogueGrid, type GridApi, type SavedView } from "../src/ui/api.ts";
import { SustantixGrid, type GridOptions } from "../src/ui/grid.ts";

export type Row = Record<string, unknown>;

export const columns: GridColumn[] = [
  { field: "code", label: "Code", kind: "text", editable: false },
  { field: "status", label: "Status", kind: "ref", ref: "status", scope: "work_order", editable: true },
  { field: "sla_hours", label: "SLA hours", kind: "integer", editable: true },
  { field: "estimated_cost", label: "Estimated cost", kind: "money", editable: true },
  { field: "site", label: "Site", kind: "fk", fk: "site", editable: true },
];

export const def = (over: Partial<CatalogueGrid> = {}): CatalogueGrid => ({
  id: "work-orders",
  title: "Work orders",
  screen: "Work Order Intelligence",
  source: { kind: "entity", name: "work_order" },
  relation: "aip.v_work_order",
  columns,
  key: "code",
  entity: "work_order",
  writers: ["planner", "admin"],
  defaultSort: [{ field: "code", dir: "asc" }],
  groupBy: [],
  bulkEdit: ["status"],
  tree: null,
  canEdit: true,
  ...over,
});

export class FakeApi implements GridApi {
  rowsCalls: Array<Partial<GridQuery>> = [];
  changeSets: ChangeSetRequest[] = [];
  exports: unknown[] = [];
  failNext: GridApiError | null = null;
  constructor(public data: Row[]) {}
  async catalogue() {
    return { role: "planner", grids: [def()] };
  }
  async rows(_grid: string, q: Partial<GridQuery>): Promise<GridPage> {
    this.rowsCalls.push(q);
    const full: GridQuery = { offset: q.offset ?? 0, limit: q.limit ?? 100, sort: q.sort ?? [], filters: q.filters ?? [], ...(q.search ? { search: q.search } : {}) };
    const r = queryRows(this.data, full, columns, "code");
    return { rows: r.rows.map((x) => ({ ...x })), total: r.total, offset: full.offset };
  }
  async exportRows(_grid: string, format: "csv" | "xlsx", q: Partial<GridQuery>) {
    this.exports.push({ format, q });
    return { rows: this.data, total: this.data.length, offset: 0, truncated: false };
  }
  async options() {
    return [{ code: "OPEN", label: "Open" }];
  }
  async views(): Promise<SavedView[]> {
    return [];
  }
  async saveView(_g: string, v: { name: string; shared: boolean; state: Record<string, unknown> }): Promise<SavedView> {
    return { id: "v1", grid: "work-orders", name: v.name, shared: v.shared, mine: true, state: v.state, rowVersion: 1 };
  }
  async deleteView() {}
  async applyChanges(req: ChangeSetRequest) {
    this.changeSets.push(JSON.parse(JSON.stringify(req)));
    if (this.failNext) {
      const e = this.failNext;
      this.failNext = null;
      throw e;
    }
    for (const item of req.items) {
      const r = this.data.find((x) => x.code === item.code);
      if (r && item.op === "update") Object.assign(r, item.values, { row_version: Number(r.row_version) + 1 });
    }
    return { id: req.id, items: req.items.map((i) => ({ entity: i.entity, op: i.op, code: i.code, rowVersion: 2 })), replayed: false };
  }
}

export const sample = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ code: `WO-${String(i + 1).padStart(4, "0")}`, status: i % 2 ? "OPEN" : "COMPLETED", sla_hours: (i * 7) % 50, estimated_cost: `${100 + i}.25`, currency: i % 5 ? "INR" : "USD", site: "SP-01", row_version: 1 }));

export const flush = () => new Promise((r) => setTimeout(r, 0));
export const cells = (g: SustantixGrid, col: number) => [...g.el.querySelectorAll<HTMLElement>(`.sxg-body [data-c="${col}"][role=gridcell]`)].map((c) => c.textContent);
export const button = (g: SustantixGrid, label: string) => [...g.el.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;

export async function mount(api: FakeApi, over: Partial<CatalogueGrid> = {}, opts: Partial<GridOptions> = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  let n = 0;
  const g = new SustantixGrid(host, { api, def: def(over), initialRect: { width: 1200, height: 640 }, newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, ...opts });
  await g.load();
  await flush();
  return g;
}

