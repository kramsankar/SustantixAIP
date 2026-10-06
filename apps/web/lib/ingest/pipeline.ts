import { LIMITS, type ChangeItem, type ChangeModel, type ChangeSetRequest, type ChangeSetResult, type ColumnKind } from "@sustantix/grid";
import { checkRecords, comparable, type Issue, type QualityRules } from "@sustantix/schema";
import { valueFits } from "../grid/service";

/**
 * The inbound pipeline (phase 5). Every record of a delivery is checked, in order:
 *   1. against the governed model (the entity, its columns, value types);
 *   2. against the governed data-quality rules (schema/quality/rules.json);
 *   3. for its references: every master code and vocabulary code must exist for the tenant.
 * A record that fails any of these is quarantined with the reasons. The rest are merged by business code (insert,
 * update of the fields that differ, or unchanged) and applied as change sets of at most 500 records, each atomic.
 * Should a change set be refused, its records are applied one by one so a single bad record cannot hold back the
 * others, and the refused ones join the quarantine with the database's reason.
 */

type Row = Record<string, unknown>;
type Entity = ChangeModel["entities"][number];

export interface InboundRecord {
  code: string | null;
  sourceRecordId?: string | null;
  values: Record<string, unknown>;
}

export interface Outcome {
  status: "applied" | "unchanged" | "quarantined";
  issues: Issue[];
  changeSetId?: string;
}

export interface IngestStore {
  /** Current rows of an entity's code view, by business code. */
  current(entity: string, codes: string[]): Promise<Row[]>;
  /** Which of these business codes exist for a master or transaction. */
  existing(entity: string, codes: string[]): Promise<Set<string>>;
  /** Which of these vocabulary codes are active for the tenant (platform or own), in a scope. */
  vocabulary(ref: string, scope: string | null, codes: string[]): Promise<Set<string>>;
  apply(req: ChangeSetRequest): Promise<ChangeSetResult>;
}

export interface IngestContext {
  model: ChangeModel;
  rules: QualityRules;
  /** The role that writes: the signed-in person's, or the integration member's. */
  role: string;
  store: IngestStore;
  newId: () => string;
  /** Integrations may be restricted to some entities. */
  entities?: string[];
}

export class IngestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

const issue = (rule: string, check: string, message: string, field?: string): Issue => ({ rule, check, severity: "reject", message, ...(field ? { field } : {}) });

/** The entity a delivery targets, if the caller may load it. Series load only through ingestion, by their writers. */
export function ingestEntity(model: ChangeModel, name: string, role: string, scope?: string[]): Entity {
  const e = model.entities.find((x) => x.name === name);
  if (!e) throw new IngestError(422, "unknown_entity", `unknown entity ${name}`);
  if (!e.editable && e.layer !== "series") throw new IngestError(403, "read_only", `${e.label} cannot be loaded`);
  if (!e.writers.includes(role)) throw new IngestError(403, "forbidden", `this role cannot load ${e.label}`);
  if (scope?.length && !scope.includes(e.name)) throw new IngestError(403, "out_of_scope", `this integration may not load ${e.label}`);
  return e;
}

/** Columns a delivery may set: every column the entity holds, except the code and system columns. */
const loadable = (e: Entity) => new Map(e.columns.filter((c) => c.name !== "code" && c.name !== "source_ordinal").map((c) => [c.name, c]));

/** Step 1: the governed model. */
function modelIssues(e: Entity, r: InboundRecord): Issue[] {
  const cols = loadable(e);
  const out: Issue[] = [];
  if (typeof r.code !== "string" || !r.code.trim() || r.code.length > 200) out.push(issue("MODEL", "Governed model", "a business code is required", "code"));
  for (const [k, v] of Object.entries(r.values ?? {})) {
    const c = cols.get(k);
    if (!c) out.push(issue("MODEL", "Governed model", `${k} is not a column of ${e.label}`, k));
    else if (v !== null && (k === "currency" ? !(typeof v === "string" && /^[A-Z]{3}$/.test(v)) : !valueFits(c.kind as ColumnKind, v))) {
      out.push(issue("MODEL", "Governed model", `${c.label} cannot be ${JSON.stringify(v)}${c.kind === "money" || c.kind === "decimal" ? " (amounts are sent as decimal strings)" : ""}`, k));
    }
  }
  return out;
}

export async function ingest(entityName: string, records: InboundRecord[], ctx: IngestContext): Promise<Outcome[]> {
  if (!records.length || records.length > 5000) throw new IngestError(400, "invalid_delivery", "a delivery holds 1 to 5,000 records");
  const e = ingestEntity(ctx.model, entityName, ctx.role, ctx.entities);
  const outcomes: Outcome[] = records.map((r) => ({ status: "applied", issues: modelIssues(e, r) }));

  // 2. Data-quality rules.
  checkRecords(ctx.rules, e.name, records.map((r) => ({ code: r.code, values: r.values ?? {} }))).forEach((list, i) => outcomes[i]!.issues.push(...list));

  // 3. References: master codes and vocabulary codes must exist for this tenant.
  const refCols = e.columns.filter((c) => (c.kind === "fk" || c.kind === "ref") && c.name !== "code");
  for (const c of refCols) {
    const codes = [...new Set(records.map((r, i) => (outcomes[i]!.issues.some((x) => x.severity === "reject") ? null : r.values?.[c.name])).filter((v): v is string => typeof v === "string" && v !== ""))];
    if (!codes.length) continue;
    const found = new Set<string>();
    for (let i = 0; i < codes.length; i += 200) {
      const part = codes.slice(i, i + 200);
      for (const x of c.kind === "fk" ? await ctx.store.existing(c.fk!, part) : await ctx.store.vocabulary(c.ref!, c.scope ?? null, part)) found.add(x);
    }
    records.forEach((r, i) => {
      const v = r.values?.[c.name];
      if (typeof v === "string" && v !== "" && !found.has(v) && !outcomes[i]!.issues.some((x) => x.severity === "reject")) {
        outcomes[i]!.issues.push(issue("REF", "Reference integrity", `${c.label} "${v}" does not exist${c.kind === "ref" ? " in the vocabulary" : ""}`, c.name));
      }
    });
  }
  const rejected = (i: number) => outcomes[i]!.issues.some((x) => x.severity === "reject");
  outcomes.forEach((o, i) => rejected(i) && (o.status = "quarantined"));

  // 4. Merge by business code.
  const live = records.map((r, i) => ({ r, i })).filter(({ i }) => !rejected(i));
  const current = new Map<string, Row>();
  const codes = [...new Set(live.map(({ r }) => r.code!))];
  for (let i = 0; i < codes.length; i += 200) for (const row of await ctx.store.current(e.name, codes.slice(i, i + 200))) current.set(String(row.code), row);
  const kinds = new Map(e.columns.map((c) => [c.name, c.kind as string]));
  const items: Array<{ item: ChangeItem; index: number }> = [];
  for (const { r, i } of live) {
    const cur = current.get(r.code!);
    const values = Object.fromEntries(Object.entries(r.values ?? {}).filter(([, v]) => v !== undefined));
    if (!cur) {
      items.push({ index: i, item: { entity: e.name, op: "insert", code: r.code!, values: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)) } });
      continue;
    }
    const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => comparable(kinds.get(k) ?? "text", v) !== comparable(kinds.get(k) ?? "text", cur[k])));
    if (!Object.keys(changed).length) {
      outcomes[i]!.status = "unchanged";
      continue;
    }
    items.push({ index: i, item: { entity: e.name, op: "update", code: r.code!, baseVersion: Number(cur.row_version), values: changed } });
  }

  // 5. Apply in atomic change sets; isolate refused records one by one.
  for (let k = 0; k < items.length; k += LIMITS.changeItemsMax) {
    const chunk = items.slice(k, k + LIMITS.changeItemsMax);
    try {
      const res = await ctx.store.apply({ id: ctx.newId(), source: "import", items: chunk.map((c) => c.item) });
      for (const c of chunk) outcomes[c.index]!.changeSetId = res.id;
    } catch {
      for (const c of chunk) {
        try {
          const res = await ctx.store.apply({ id: ctx.newId(), source: "import", items: [c.item] });
          outcomes[c.index]!.changeSetId = res.id;
        } catch (err) {
          outcomes[c.index]!.status = "quarantined";
          outcomes[c.index]!.issues.push(issue("APPLY", "Governed write", err instanceof Error ? err.message : "the database refused this record"));
        }
      }
    }
  }
  return outcomes;
}

/** A workbook sheet in the delivery is mapped to records of its entity first (the governed import path). */
export interface DeliverySummary {
  batch: string;
  entity: string;
  total: number;
  applied: number;
  unchanged: number;
  quarantined: number;
  issues: Array<{ record: string | null; rule: string; message: string }>;
}

export function summarize(batch: string, entity: string, records: InboundRecord[], outcomes: Outcome[]): DeliverySummary {
  const count = (s: Outcome["status"]) => outcomes.filter((o) => o.status === s).length;
  return {
    batch,
    entity,
    total: records.length,
    applied: count("applied"),
    unchanged: count("unchanged"),
    quarantined: count("quarantined"),
    issues: outcomes.flatMap((o, i) => o.issues.map((x) => ({ record: records[i]!.code, rule: x.rule, message: x.message }))).slice(0, 100),
  };
}
