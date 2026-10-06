/**
 * Database-only data: after sign-in the host loads the tenant's runtime datasets from its database (frames and blocks
 * of rows, see dataset-parts.ts), joins them back and registers each under the id the runtime asks for, before any
 * runtime module runs. The deployment ships no tenant data at all.
 */
import { joinDataset, type Json } from "./dataset-parts.js";

export interface DatasetManifest {
  version: string;
  frames: Record<string, Json>;
  /** [dataset, part, first ordinal, row count] of each block. */
  blocks: Array<[string, string, number, number]>;
  /** Block indexes answered by each chunk. */
  chunks: number[][];
}

export interface DatasetFetch {
  manifest(): Promise<DatasetManifest>;
  chunk(version: string, index: number): Promise<{ version: string; blocks: Json[][] }>;
}

/** A failure that a fresh load may cure: the data changed while it was loading. */
export class DatasetsChanged extends Error {
  constructor() {
    super("the data changed while it was loading");
    this.name = "DatasetsChanged";
  }
}

export type Progress = (done: number, total: number) => void;

/** Every dataset of the tenant, as JSON text by dataset id (one retry when the data changes mid-load). */
export async function loadDatasets(fetcher: DatasetFetch, progress: Progress = () => undefined, concurrency = 4): Promise<Map<string, string>> {
  try {
    return await loadOnce(fetcher, progress, concurrency);
  } catch (e) {
    if (!(e instanceof DatasetsChanged)) throw e;
    return loadOnce(fetcher, progress, concurrency);
  }
}

async function loadOnce(fetcher: DatasetFetch, progress: Progress, concurrency: number): Promise<Map<string, string>> {
  const m = await fetcher.manifest();
  const rows: Array<Json[] | undefined> = new Array(m.blocks.length);
  let done = 0;
  progress(0, m.chunks.length);
  let next = 0;
  const worker = async () => {
    while (next < m.chunks.length) {
      const index = next++;
      const answer = await fetcher.chunk(m.version, index);
      const want = m.chunks[index]!;
      if (answer.version !== m.version || answer.blocks.length !== want.length) throw new DatasetsChanged();
      want.forEach((b, i) => {
        const block = answer.blocks[i]!;
        if (!Array.isArray(block) || block.length !== m.blocks[b]![3]) throw new DatasetsChanged();
        rows[b] = block;
      });
      progress(++done, m.chunks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, m.chunks.length)) }, worker));
  // Blocks are listed in order within each table: concatenating them restores each table's rows in order.
  const tables = new Map<string, Map<string, Json[]>>();
  m.blocks.forEach(([dataset, part], i) => {
    const block = rows[i];
    if (!block) throw new Error(`dataset block ${dataset}${part} #${i} was not loaded`);
    const byPart = tables.get(dataset) ?? new Map<string, Json[]>();
    const list = byPart.get(part) ?? [];
    for (const r of block) list.push(r);
    byPart.set(part, list);
    tables.set(dataset, byPart);
  });
  const out = new Map<string, string>();
  for (const [id, frame] of Object.entries(m.frames)) out.set(id, JSON.stringify(joinDataset(frame, tables.get(id) ?? new Map())));
  for (const id of tables.keys()) if (!(id in m.frames)) throw new Error(`dataset ${id} has rows but no frame`);
  return out;
}
