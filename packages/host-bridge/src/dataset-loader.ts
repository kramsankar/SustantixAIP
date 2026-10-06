/**
 * Database-only data: after sign-in the host loads the tenant's runtime catalogue (dataset layouts and the sheets they
 * use, see dataset-parts.ts) and the governed workbook the layouts refer to, joins every dataset back and registers
 * each under the id the runtime asks for, before any runtime module runs. The deployment ships no tenant data at all.
 */
import { composeDataset, type Json } from "./dataset-parts.js";

export interface DatasetManifest {
  version: string;
  layouts: Record<string, Json>;
  sheets: Record<string, { rows: number; groups?: Array<[string, number, number]> }>;
  /** [sheet, first ordinal, row count] of each block. */
  blocks: Array<[string, number, number]>;
  /** Block indexes answered by each chunk. */
  chunks: number[][];
}

export interface DatasetFetch {
  manifest(): Promise<DatasetManifest>;
  chunk(version: string, index: number): Promise<{ version: string; blocks: Json[][] }>;
  /** The governed workbook's sheets (the layouts' governed references read them). */
  governed(): Promise<Record<string, Json[]>>;
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
  const [m, governed] = await Promise.all([fetcher.manifest(), fetcher.governed()]);
  const blockRows: Array<Json[] | undefined> = new Array(m.blocks.length);
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
        if (!Array.isArray(block) || block.length !== m.blocks[b]![2]) throw new DatasetsChanged();
        blockRows[b] = block;
      });
      progress(++done, m.chunks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, m.chunks.length)) }, worker));
  // Blocks are listed in order within each sheet: concatenating them restores each sheet's rows in order.
  const sheets = new Map<string, Json[]>();
  m.blocks.forEach(([sheet], i) => {
    const block = blockRows[i];
    if (!block) throw new Error(`block ${i} of sheet "${sheet}" was not loaded`);
    const rows = sheets.get(sheet) ?? [];
    for (const r of block) rows.push(r);
    sheets.set(sheet, rows);
  });
  for (const [name, s] of Object.entries(m.sheets)) {
    if ((sheets.get(name)?.length ?? 0) !== s.rows) throw new DatasetsChanged();
    if (!sheets.has(name)) sheets.set(name, []);
  }
  const groups = new Map(Object.entries(m.sheets).map(([name, s]) => [name, new Map((s.groups ?? []).map(([k, first, count]) => [k, [first, count] as const]))]));
  const source = {
    sheet(name: string, group?: string) {
      const rows = sheets.get(name);
      if (!rows) return undefined;
      if (group === undefined) return rows;
      const g = groups.get(name)?.get(group);
      return g ? rows.slice(g[0], g[0] + g[1]) : undefined;
    },
    governed: (sheet: string) => governed[sheet],
  };
  const out = new Map<string, string>();
  for (const [id, layout] of Object.entries(m.layouts)) out.set(id, JSON.stringify(composeDataset(layout, source)));
  return out;
}
