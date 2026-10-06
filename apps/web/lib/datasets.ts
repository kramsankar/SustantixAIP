import { createHash } from "node:crypto";
import { ApiError } from "./http";

/**
 * The runtime catalogue, served from the database after sign-in (tools/schema/src/runtime-catalogue.ts decides what
 * is held where; packages/host-bridge joins it back). The manifest carries each dataset's layout, the catalogue
 * sheets (with the groups of those that hold a family of lists), and a fixed plan that groups the sheets' blocks into
 * chunks of about CHUNK_BYTES, small enough for one response each; the browser fetches the chunks in parallel and the
 * governed sheets the layouts refer to from GET /api/aip/workbook. Chunk answers are immutable for a version, so a
 * later sign-in with unchanged data reads them from the browser's cache.
 */

/** A block of one sheet's rows: sheet, first ordinal, row count, text size. */
export interface BlockMeta {
  sheet: string;
  first: number;
  rows: number;
  bytes: number;
}

export interface LayoutMeta {
  dataset: string;
  layout: unknown;
  updatedAt: string;
}

export interface SheetMeta {
  sheet: string;
  rows: number;
  updatedAt: string;
}

export interface GroupMeta {
  sheet: string;
  key: string;
  first: number;
  rows: number;
}

export interface DatasetStore {
  layouts(tenantId: string): Promise<LayoutMeta[]>;
  /** Every catalogue sheet of the tenant (name, row count, time), ordered by name. */
  sheets(tenantId: string): Promise<SheetMeta[]>;
  groups(tenantId: string): Promise<GroupMeta[]>;
  /** Every block of the tenant, ordered by sheet and first ordinal. */
  blocks(tenantId: string): Promise<BlockMeta[]>;
  /** The layouts' times only (what the version needs), without their content. */
  stamps(tenantId: string): Promise<Array<{ dataset: string; updatedAt: string }>>;
  /** The rows of each block asked for, in the order asked (null where a block is not readable). */
  read(tenantId: string, blocks: Array<Pick<BlockMeta, "sheet" | "first">>): Promise<Array<unknown[] | null>>;
}

export interface DatasetManifest {
  version: string;
  /** Layout of each dataset, by dataset id. */
  layouts: Record<string, unknown>;
  /** Each catalogue sheet: its row count and, for a family of lists, [key, first ordinal, row count] of each group. */
  sheets: Record<string, { rows: number; groups?: Array<[string, number, number]> }>;
  /** [sheet, first ordinal, row count] of each block. */
  blocks: Array<[string, number, number]>;
  /** Block indexes answered by each chunk. */
  chunks: number[][];
}

export const CHUNK_BYTES = 2_500_000;

/** Consecutive blocks grouped while their text stays within the budget (a block larger than the budget goes alone). */
export function chunkPlan(blocks: ReadonlyArray<Pick<BlockMeta, "bytes">>, budget = CHUNK_BYTES): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  let size = 0;
  blocks.forEach((b, i) => {
    if (cur.length && size + b.bytes > budget) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(i);
    size += b.bytes;
  });
  if (cur.length) out.push(cur);
  return out;
}

/** Changes whenever the tenant's catalogue is reloaded (a reload rewrites its layouts, so their times change). */
export function datasetsVersion(tenantId: string, stamps: ReadonlyArray<{ dataset: string; updatedAt: string }>, blocks: readonly BlockMeta[]): string {
  const h = createHash("sha256").update(tenantId);
  for (const s of [...stamps].sort((a, b) => (a.dataset < b.dataset ? -1 : 1))) h.update(`|${s.dataset}@${s.updatedAt}`);
  for (const b of blocks) h.update(`|${b.sheet}#${b.first}+${b.rows}:${b.bytes}`);
  return h.digest("hex").slice(0, 24);
}

export async function datasetsManifest(store: DatasetStore, tenantId: string): Promise<DatasetManifest> {
  const [layouts, sheets, groups, blocks] = await Promise.all([store.layouts(tenantId), store.sheets(tenantId), store.groups(tenantId), store.blocks(tenantId)]);
  const bySheet: DatasetManifest["sheets"] = {};
  for (const s of sheets) bySheet[s.sheet] = { rows: s.rows };
  for (const g of groups) {
    const s = bySheet[g.sheet];
    if (!s) continue;
    (s.groups ??= []).push([g.key, g.first, g.rows]);
  }
  for (const s of Object.values(bySheet)) s.groups?.sort((a, b) => a[1] - b[1]);
  return {
    version: datasetsVersion(tenantId, layouts, blocks),
    layouts: Object.fromEntries(layouts.map((l) => [l.dataset, l.layout])),
    sheets: bySheet,
    blocks: blocks.map((b) => [b.sheet, b.first, b.rows]),
    chunks: chunkPlan(blocks),
  };
}

const changed = () => new ApiError(409, "datasets_changed", "the data changed while it was loading; load it again");

/** The rows of one chunk of the plan; refused (409) when the data changed since the manifest was read. */
export async function datasetsChunk(store: DatasetStore, tenantId: string, version: string, index: number): Promise<{ version: string; blocks: unknown[][] }> {
  const [stamps, blocks] = await Promise.all([store.stamps(tenantId), store.blocks(tenantId)]);
  const current = datasetsVersion(tenantId, stamps, blocks);
  if (version !== current) throw changed();
  const chunk = chunkPlan(blocks)[index];
  if (!chunk) throw new ApiError(404, "no_chunk", `chunk ${index} is not part of this version`);
  const want = chunk.map((i) => blocks[i]!);
  const rows = await store.read(tenantId, want);
  if (rows.length !== want.length || rows.some((r, i) => !Array.isArray(r) || r.length !== want[i]!.rows)) throw changed();
  return { version: current, blocks: rows as unknown[][] };
}

type Db = {
  from(table: string): any;
  rpc(fn: string, args: Record<string, unknown>): any;
};

const PAGE = 1000;

async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`${what}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Reads with the caller's client: row-level security limits every answer to the caller's own tenant. */
export function supabaseDatasetStore(db: Db): DatasetStore {
  return {
    async layouts(tenantId) {
      const rows = await all<{ dataset: string; layout: unknown; updated_at: string }>((a, b) => db.from("runtime_dataset").select("dataset,layout,updated_at").eq("tenant_id", tenantId).order("dataset").range(a, b), "runtime_dataset");
      return rows.map((r) => ({ dataset: r.dataset, layout: r.layout, updatedAt: r.updated_at }));
    },
    async stamps(tenantId) {
      const rows = await all<{ dataset: string; updated_at: string }>((a, b) => db.from("runtime_dataset").select("dataset,updated_at").eq("tenant_id", tenantId).order("dataset").range(a, b), "runtime_dataset");
      return rows.map((r) => ({ dataset: r.dataset, updatedAt: r.updated_at }));
    },
    async sheets(tenantId) {
      const rows = await all<{ sheet: string; row_count: number; updated_at: string }>((a, b) => db.from("runtime_sheet").select("sheet,row_count,updated_at").eq("tenant_id", tenantId).order("sheet").range(a, b), "runtime_sheet");
      return rows.map((r) => ({ sheet: r.sheet, rows: r.row_count, updatedAt: r.updated_at }));
    },
    async groups(tenantId) {
      const rows = await all<{ sheet: string; group_key: string; first_ordinal: number; row_count: number }>((a, b) => db.from("runtime_sheet_group").select("sheet,group_key,first_ordinal,row_count").eq("tenant_id", tenantId).order("sheet").order("first_ordinal").range(a, b), "runtime_sheet_group");
      return rows.map((r) => ({ sheet: r.sheet, key: r.group_key, first: r.first_ordinal, rows: r.row_count }));
    },
    async blocks(tenantId) {
      const rows = await all<{ sheet: string; first_ordinal: number; row_count: number; bytes: number }>((a, b) => db.from("runtime_sheet_block").select("sheet,first_ordinal,row_count,bytes").eq("tenant_id", tenantId).order("sheet").order("first_ordinal").range(a, b), "runtime_sheet_block");
      return rows.map((r) => ({ sheet: r.sheet, first: r.first_ordinal, rows: r.row_count, bytes: r.bytes }));
    },
    async read(tenantId, blocks) {
      const { data, error } = await db.rpc("runtime_sheet_blocks", { p_tenant: tenantId, p_blocks: blocks.map((b) => ({ s: b.sheet, f: b.first })) });
      if (error) throw new Error(`runtime_sheet_blocks: ${error.message}`);
      return (data ?? []) as Array<unknown[] | null>;
    },
  };
}
