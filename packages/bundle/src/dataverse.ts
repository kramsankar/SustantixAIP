import type { ChangeModel, ChangeSetRequest } from "@sustantix/grid";
import type { QualityRules } from "@sustantix/schema";
import type { DataverseGridClient } from "@sustantix/host-bridge/src/adapters/dataverse-grid.ts";
import { dataverseGridApi } from "@sustantix/host-bridge/src/adapters/dataverse-grid.ts";
import type { BundleRecord, BundleSink, BundleSource } from "./bundle.ts";
import { ingest, summarize, type IngestStore } from "./merge.ts";

type Row = Record<string, unknown>;

/**
 * The Power Platform edition. Records are read with the same mapping the Enterprise Grid uses on Dataverse (business
 * codes for lookups, decimal strings for amounts), and written through the same merge as the Vercel edition, applied
 * by the sus_ApplyChangeSet plug-in with the caller's security roles and Dataverse row versions.
 */
export function dataverseSide(client: DataverseGridClient, model: ChangeModel, rules: QualityRules, opts: { tenant: string; role?: string; newId: () => string }) {
  const api = dataverseGridApi(client, null);
  const columns = new Map(model.entities.map((e) => [e.name, e.columns.filter((c) => c.name !== "code" && c.name !== "source_ordinal").map((c) => c.name)]));
  const valuesOf = (entity: string, row: Row) => Object.fromEntries((columns.get(entity) ?? []).filter((c) => row[c] !== undefined && row[c] !== null).map((c) => [c, row[c]]));

  const source: BundleSource = {
    edition: "powerplatform",
    tenant: opts.tenant,
    async *read(entity) {
      const rows = (await api.records(entity)).filter((r) => r.is_platform !== true);
      for (let i = 0; i < rows.length; i += 5000) yield rows.slice(i, i + 5000).map((r): BundleRecord => ({ code: String(r.code), values: valuesOf(entity, r) }));
    },
  };

  const byCode = async (entity: string, codes: string[]) => {
    const want = new Set(codes);
    return (await api.records(entity)).filter((r) => want.has(String(r.code)));
  };
  const store: IngestStore = {
    current: (entity, codes) => byCode(entity, codes),
    existing: async (entity, codes) => new Set((await byCode(entity, codes)).map((r) => String(r.code))),
    async vocabulary(ref, scope, codes) {
      const keys = new Map(codes.map((c) => [scope ? `${scope}:${c}` : c, c]));
      return new Set((await api.records(`ref_${ref}`)).filter((r) => keys.has(String(r.code)) && r.is_active !== false).map((r) => keys.get(String(r.code))!));
    },
    // The adapter drops the cached tables a change set touched, so the next read sees the write.
    apply: (req: ChangeSetRequest) => api.applyChanges(req),
  };

  const sink: BundleSink = {
    async deliver(entity, records) {
      const outcomes = await ingest(entity, records.map((r) => ({ code: r.code, values: r.values })), { model, rules, role: opts.role ?? "admin", store, newId: opts.newId });
      const s = summarize("", entity, records, outcomes);
      return { applied: s.applied, unchanged: s.unchanged, quarantined: s.quarantined, issues: s.issues };
    },
  };
  return { source, sink };
}
