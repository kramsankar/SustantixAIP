/**
 * How the grid talks to its host. The Vercel host serves this over /api/aip; another host supplies its own GridApi
 * with the same contract.
 */
import type { ChangeSetRequest, ChangeSetResult, ConflictBody, GridDef, GridPage, GridQuery } from "../contract.ts";

export type CatalogueGrid = GridDef & { canEdit: boolean };

export interface SavedView {
  id: string;
  grid: string;
  name: string;
  shared: boolean;
  mine: boolean;
  state: Record<string, unknown>;
  rowVersion: number;
}

export interface GridApi {
  catalogue(): Promise<{ role: string; grids: CatalogueGrid[] }>;
  rows(grid: string, q: Partial<GridQuery>): Promise<GridPage>;
  exportRows(grid: string, format: "csv" | "xlsx", q: Partial<GridQuery>): Promise<GridPage & { truncated: boolean }>;
  options(kind: "ref" | "fk", name: string, scope: string | null, search: string): Promise<Array<{ code: string; label: string | null }>>;
  views(grid: string): Promise<SavedView[]>;
  saveView(grid: string, v: { name: string; shared: boolean; state: Record<string, unknown> }, existing?: SavedView): Promise<SavedView>;
  deleteView(grid: string, id: string): Promise<void>;
  applyChanges(req: ChangeSetRequest): Promise<ChangeSetResult>;
  /** A grid's own action on selected rows (keys); resolves the host's counts. */
  runAction?(grid: string, action: string, keys: string[]): Promise<Record<string, unknown>>;
}

/** A refused request, with the server's error code and body (a 409 conflict carries the current row). */
export class GridApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GridApiError";
  }
  get conflict(): ConflictBody | null {
    return this.status === 409 && this.code === "conflict" ? (this.body as unknown as ConflictBody) : null;
  }
}

export function httpGridApi(base = "/api/aip", fetchImpl: typeof fetch = (...a) => fetch(...a)): GridApi {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetchImpl(base + path, {
      credentials: "same-origin",
      ...init,
      headers: { "content-type": "application/json", "x-aip-client": "grid", ...((init?.headers as Record<string, string>) ?? {}) },
    });
    if (res.status === 204) return undefined as T;
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new GridApiError(res.status, String(body.error ?? "error"), String(body.message ?? `request failed (${res.status})`), body);
    return body as T;
  };
  const post = <T>(path: string, body: unknown, method = "POST") => call<T>(path, { method, body: JSON.stringify(body) });
  const enc = encodeURIComponent;
  return {
    catalogue: () => call("/grid"),
    rows: (grid, q) => post(`/grid/${enc(grid)}/rows`, q),
    exportRows: (grid, format, q) => post(`/grid/${enc(grid)}/export`, { format, query: q }),
    options: async (kind, name, scope, search) => {
      const p = new URLSearchParams({ kind, name, q: search });
      if (scope) p.set("scope", scope);
      return (await call<{ options: Array<{ code: string; label: string | null }> }>(`/grid/options?${p}`)).options;
    },
    views: async (grid) => (await call<{ views: SavedView[] }>(`/grid/${enc(grid)}/views`)).views,
    saveView: (grid, v, existing) =>
      existing ? post(`/grid/${enc(grid)}/views/${enc(existing.id)}`, { ...v, rowVersion: existing.rowVersion }, "PUT") : post(`/grid/${enc(grid)}/views`, v),
    deleteView: (grid, id) => call(`/grid/${enc(grid)}/views/${enc(id)}`, { method: "DELETE" }),
    applyChanges: (req) => post("/changes", req),
    runAction: (grid, action, keys) => post(`/grid/${enc(grid)}/actions/${enc(action)}`, { keys }),
  };
}
