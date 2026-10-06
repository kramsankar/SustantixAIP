import type { GovernedSource, GovernedWorkbook, RuntimeState } from "./types.js";

/**
 * Governed mode keeps the database the system of record. The workbook the runtime booted on is remembered row by row;
 * when the runtime saves (a workbook import), only the rows that differ are sent, with the loaded rows they replace,
 * so the server can write exactly what changed and refuse to overwrite anything someone else changed meanwhile.
 * A refused save restores the changed sheets, so the screens never show data that was not saved.
 */

type Row = Record<string, unknown>;

export interface ImportResult {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: Array<{ sheet: string; reason: string; rows: number }>;
}

export interface GovernedSyncDeps {
  load(): Promise<GovernedWorkbook | null>;
  post(body: { id: string; sheets: Record<string, { after: Row[]; before: Row[] }> }): Promise<ImportResult>;
  notify(message: string, kind: "ok" | "error"): void;
  newId?(): string;
}

export function governedSync(deps: GovernedSyncDeps): GovernedSource {
  let baseline = new Map<string, string[]>();
  return {
    async load() {
      const wb = await deps.load();
      baseline = new Map(Object.entries(wb?.sheets ?? {}).map(([name, rows]) => [name, (rows as Row[]).map((r) => JSON.stringify(r))]));
      return wb;
    },
    async save(state: RuntimeState) {
      const sheets: Record<string, { after: Row[]; before: Row[] }> = {};
      const snapshot = new Map<string, string[]>();
      for (const [name, rows] of Object.entries(state.data ?? {})) {
        const now = (rows as Row[]).map((r) => JSON.stringify(r));
        const was = baseline.get(name) ?? [];
        const wasSet = new Set(was);
        const nowSet = new Set(now);
        const after = now.filter((r) => !wasSet.has(r));
        const before = was.filter((r) => !nowSet.has(r));
        if (!after.length && !before.length) continue;
        sheets[name] = { after: after.map((r) => JSON.parse(r) as Row), before: before.map((r) => JSON.parse(r) as Row) };
        snapshot.set(name, now);
      }
      if (!Object.keys(sheets).length) return;
      try {
        const r = await deps.post({ id: deps.newId?.() ?? crypto.randomUUID(), sheets });
        for (const [name, rows] of snapshot) baseline.set(name, rows);
        const parts = [`${r.inserted} added`, `${r.updated} updated`].filter((p) => !p.startsWith("0 "));
        const kept = r.skipped.reduce((n, x) => n + x.rows, 0);
        deps.notify(`Saved to governed data: ${parts.join(", ") || "no changes"}${kept ? ` · ${kept} row(s) not imported (${[...new Set(r.skipped.map((x) => x.reason))].join("; ")})` : ""}`, "ok");
      } catch (e) {
        // Nothing was written: show the data that is actually stored.
        for (const name of Object.keys(sheets)) state.data[name] = (baseline.get(name) ?? []).map((r) => JSON.parse(r) as Row);
        deps.notify(`Import not saved: ${e instanceof Error ? e.message : "the governed data service refused it"}`, "error");
        throw e;
      }
    },
  };
}
