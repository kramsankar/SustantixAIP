import { importSheetRows, Resolver, specForSheet, type QualityRules, type Registry, type Vocabulary } from "@sustantix/schema";
import type { ChangeModel } from "@sustantix/grid";
import { z } from "zod";
import registry from "../../../../schema/aip-data-model.json";
import vocabulary from "../../../../schema/reference/vocabulary.json";
import rulesJson from "../../../../schema/quality/rules.json";
import { ApiError } from "../http";
import { ingest, IngestError, summarize, type DeliverySummary, type InboundRecord, type IngestStore, type Outcome } from "./pipeline";
import type { StagedRow } from "./store";

export const RULES = rulesJson as unknown as QualityRules;
const REG = registry as unknown as Registry;
const VOCAB = vocabulary as unknown as Vocabulary;

const record = z.object({ code: z.string().max(200).nullable(), sourceRecordId: z.string().max(200).nullish(), values: z.record(z.string(), z.unknown()) }).strict();
const delivery = z.union([
  z.object({ entity: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/), records: z.array(record).min(1).max(5000) }).strict(),
  z.object({ sheet: z.string().min(1).max(120), rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000) }).strict(),
]);

export interface Ledger {
  record(batch: { id: string; source: string; integrationId: string | null; entity: string; actor: string }, records: InboundRecord[], outcomes: Outcome[]): Promise<void>;
  quarantined(ids: number[]): Promise<StagedRow[]>;
  settle(id: number, outcome: { status: Outcome["status"] | "discarded"; issues?: Outcome["issues"]; changeSetId?: string }): Promise<void>;
}

export interface Deliverer {
  role: string;
  actor: string;
  source: string;
  integrationId: string | null;
  entities?: string[];
}

const fail = (e: unknown): never => {
  if (e instanceof IngestError) throw new ApiError(e.status, e.code, e.message);
  throw e;
};

/**
 * One delivery: records of one entity, or rows of one normalized workbook sheet (mapped through its spec; a value
 * outside the vocabulary quarantines its row). Every record ends applied, unchanged or quarantined, in the ledger.
 */
export async function deliver(body: unknown, who: Deliverer, model: ChangeModel, store: IngestStore, ledger: Ledger, newId: () => string): Promise<DeliverySummary> {
  const parsed = delivery.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "invalid_delivery", parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  let entity: string;
  let records: InboundRecord[];
  const preIssues = new Map<number, Outcome["issues"]>();
  if ("entity" in parsed.data) {
    entity = parsed.data.entity;
    records = parsed.data.records;
  } else {
    const spec = specForSheet(REG, parsed.data.sheet);
    if (!spec) throw new ApiError(422, "unknown_sheet", `${parsed.data.sheet} is not a normalized sheet; deliver its records by entity`);
    const mapped = importSheetRows(REG, VOCAB, parsed.data.sheet, parsed.data.rows, new Resolver(VOCAB));
    entity = spec.name;
    records = mapped.records.map((r) => ({ code: r.code, values: r.values }));
    // A value outside the vocabulary is not guessed: its row waits in quarantine.
    const byCode = new Map(records.map((r, i) => [r.code, i]));
    for (const x of mapped.issues) {
      const i = byCode.get(x.code);
      if (i === undefined) continue;
      preIssues.set(i, [...(preIssues.get(i) ?? []), { rule: "VOCAB", check: "Controlled vocabulary", severity: "reject", field: x.column, message: `${x.column} "${x.value}" is not in the vocabulary` }]);
    }
  }
  const held = [...preIssues.keys()];
  const toLoad = records.filter((_, i) => !preIssues.has(i));
  let loaded: Outcome[] = [];
  if (toLoad.length) loaded = await ingest(entity, toLoad, { model, rules: RULES, role: who.role, store, newId, ...(who.entities ? { entities: who.entities } : {}) }).catch(fail);
  else if (!held.length) throw new ApiError(400, "invalid_delivery", "nothing to load");
  let k = 0;
  const outcomes: Outcome[] = records.map((_, i) => (preIssues.has(i) ? { status: "quarantined", issues: preIssues.get(i)! } : loaded[k++]!));
  const batch = newId();
  await ledger.record({ id: batch, source: who.source, integrationId: who.integrationId, entity, actor: who.actor }, records, outcomes);
  return summarize(batch, entity, records, outcomes);
}

/** Replays quarantined records (after the source or a master was fixed); each ends applied, unchanged or quarantined again. */
export async function replay(ids: number[], who: Deliverer, model: ChangeModel, store: IngestStore, ledger: Ledger, newId: () => string) {
  const rows = await ledger.quarantined(ids);
  const result = { applied: 0, unchanged: 0, quarantined: 0 };
  const byEntity = new Map<string, StagedRow[]>();
  for (const r of rows) byEntity.set(r.entity, [...(byEntity.get(r.entity) ?? []), r]);
  for (const [entity, list] of byEntity) {
    const outcomes = await ingest(entity, list.map((r) => ({ code: r.code, sourceRecordId: r.sourceRecordId, values: r.values })), { model, rules: RULES, role: who.role, store, newId }).catch(fail);
    for (let i = 0; i < list.length; i++) {
      await ledger.settle(list[i]!.id, outcomes[i]!);
      result[outcomes[i]!.status]++;
    }
  }
  return { ...result, missing: ids.length - rows.length };
}

export async function discard(ids: number[], ledger: Ledger) {
  const rows = await ledger.quarantined(ids);
  for (const r of rows) await ledger.settle(r.id, { status: "discarded" });
  return { discarded: rows.length, missing: ids.length - rows.length };
}
