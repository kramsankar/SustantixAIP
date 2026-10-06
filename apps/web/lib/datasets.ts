import { createHash } from "node:crypto";
import { ApiError } from "./http";

/**
 * The runtime's tenant datasets, served from the database after sign-in (tools/schema/src/datasets-sql.ts holds
 * them; packages/host-bridge joins them back). The manifest carries each dataset's frame and a fixed plan that
 * groups the tables' blocks into chunks of about CHUNK_BYTES, small enough for one response each; the browser
 * fetches the chunks in parallel. Chunk answers are immutable for a version, so a later sign-in with unchanged data
 * reads them from the browser's cache.
 */

/** A block of one table's rows: dataset, part (JSON Pointer), first ordinal, row count, text size. */
export interface BlockMeta {
  dataset: string;
  part: string;
  first: number;
  rows: number;
  bytes: number;
}

export interface FrameMeta {
  dataset: string;
  frame: unknown;
  updatedAt: string;
}

export interface DatasetStore {
  frames(tenantId: string): Promise<FrameMeta[]>;
  /** The frames' times only (what the version needs), without their content. */
  stamps(tenantId: string): Promise<Array<Pick<FrameMeta, "dataset" | "updatedAt">>>;
  /** Every block of the tenant, ordered by dataset, part and first ordinal. */
  blocks(tenantId: string): Promise<BlockMeta[]>;
  /** The rows of each block asked for, in the order asked (null where a block is not readable). */
  read(tenantId: string, blocks: Array<Pick<BlockMeta, "dataset" | "part" | "first">>): Promise<Array<unknown[] | null>>;
}

export interface DatasetManifest {
  version: string;
  /** Frame of each dataset, by dataset id. */
  frames: Record<string, unknown>;
  /** [dataset, part, first ordinal, row count] of each block. */
  blocks: Array<[string, string, number, number]>;
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

/** Changes whenever any dataset of the tenant is reloaded (a reload rewrites its frame, so its time changes). */
export function datasetsVersion(tenantId: string, frames: ReadonlyArray<Pick<FrameMeta, "dataset" | "updatedAt">>, blocks: readonly BlockMeta[]): string {
  const h = createHash("sha256").update(tenantId);
  for (const f of [...frames].sort((a, b) => a.dataset.localeCompare(b.dataset))) h.update(`|${f.dataset}@${f.updatedAt}`);
  for (const b of blocks) h.update(`|${b.dataset}${b.part}#${b.first}+${b.rows}:${b.bytes}`);
  return h.digest("hex").slice(0, 24);
}

export async function datasetsManifest(store: DatasetStore, tenantId: string): Promise<DatasetManifest> {
  const [frames, blocks] = await Promise.all([store.frames(tenantId), store.blocks(tenantId)]);
  return {
    version: datasetsVersion(tenantId, frames, blocks),
    frames: Object.fromEntries(frames.map((f) => [f.dataset, f.frame])),
    blocks: blocks.map((b) => [b.dataset, b.part, b.first, b.rows]),
    chunks: chunkPlan(blocks),
  };
}

/** The rows of one chunk of the plan; refused (409) when the data changed since the manifest was read. */
export async function datasetsChunk(store: DatasetStore, tenantId: string, version: string, index: number): Promise<{ version: string; blocks: unknown[][] }> {
  const [stamps, blocks] = await Promise.all([store.stamps(tenantId), store.blocks(tenantId)]);
  const current = datasetsVersion(tenantId, stamps, blocks);
  if (version !== current) throw new ApiError(409, "datasets_changed", "the data changed while it was loading; load it again");
  const plan = chunkPlan(blocks);
  const chunk = plan[index];
  if (!chunk) throw new ApiError(404, "no_chunk", `chunk ${index} is not part of this version`);
  const want = chunk.map((i) => blocks[i]!);
  const rows = await store.read(tenantId, want);
  if (rows.length !== want.length || rows.some((r) => !Array.isArray(r))) throw new ApiError(409, "datasets_changed", "the data changed while it was loading; load it again");
  rows.forEach((r, i) => {
    if (r!.length !== want[i]!.rows) throw new ApiError(409, "datasets_changed", "the data changed while it was loading; load it again");
  });
  return { version: current, blocks: rows as unknown[][] };
}

type Db = {
  from(table: string): any;
  rpc(fn: string, args: Record<string, unknown>): any;
};

const PAGE = 1000;

/** Reads with the caller's client: row-level security limits every answer to the caller's own tenant. */
export function supabaseDatasetStore(db: Db): DatasetStore {
  return {
    async frames(tenantId) {
      const out: FrameMeta[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db.from("dataset_part").select("dataset,frame,updated_at").eq("tenant_id", tenantId).eq("part", "$frame").order("dataset").range(from, from + PAGE - 1);
        if (error) throw new Error(`dataset_part: ${error.message}`);
        out.push(...(data ?? []).map((r: { dataset: string; frame: unknown; updated_at: string }) => ({ dataset: r.dataset, frame: r.frame, updatedAt: r.updated_at })));
        if (!data || data.length < PAGE) return out;
      }
    },
    async stamps(tenantId) {
      const out: Array<Pick<FrameMeta, "dataset" | "updatedAt">> = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db.from("dataset_part").select("dataset,updated_at").eq("tenant_id", tenantId).eq("part", "$frame").order("dataset").range(from, from + PAGE - 1);
        if (error) throw new Error(`dataset_part: ${error.message}`);
        out.push(...(data ?? []).map((r: { dataset: string; updated_at: string }) => ({ dataset: r.dataset, updatedAt: r.updated_at })));
        if (!data || data.length < PAGE) return out;
      }
    },
    async blocks(tenantId) {
      const out: BlockMeta[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
          .from("dataset_block")
          .select("dataset,part,first_ordinal,row_count,bytes")
          .eq("tenant_id", tenantId)
          .order("dataset")
          .order("part")
          .order("first_ordinal")
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`dataset_block: ${error.message}`);
        out.push(...(data ?? []).map((r: { dataset: string; part: string; first_ordinal: number; row_count: number; bytes: number }) => ({ dataset: r.dataset, part: r.part, first: r.first_ordinal, rows: r.row_count, bytes: r.bytes })));
        if (!data || data.length < PAGE) return out;
      }
    },
    async read(tenantId, blocks) {
      const { data, error } = await db.rpc("dataset_blocks", { p_tenant: tenantId, p_blocks: blocks.map((b) => ({ d: b.dataset, p: b.part, f: b.first })) });
      if (error) throw new Error(`dataset_blocks: ${error.message}`);
      return (data ?? []) as Array<unknown[] | null>;
    },
  };
}
