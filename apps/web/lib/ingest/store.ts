import type { ChangeSetRequest, ChangeSetResult } from "@sustantix/grid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { changeError } from "../grid/service";
import type { IngestStore, InboundRecord, Outcome } from "./pipeline";

type AipClient = SupabaseClient<any, "aip", "aip">;
type Row = Record<string, unknown>;

const ENTITY = /^[a-z][a-z0-9_]*$/;
const safe = (name: string) => {
  if (!ENTITY.test(name)) throw new Error(`invalid name ${name}`);
  return name;
};

/**
 * Reads and writes for one delivery. With a person's client every query is under row-level security; with the
 * service client (an integration, after its key was verified) every query names the tenant explicitly and every write
 * goes through apply_change_set_as, which runs the change set as the integration's own member of that tenant.
 */
export class SupabaseIngestStore implements IngestStore {
  constructor(
    private readonly db: AipClient,
    private readonly tenantId: string,
    private readonly actingAs: string | null = null,
  ) {}

  async current(entity: string, codes: string[]): Promise<Row[]> {
    const { data, error } = await this.db.from(`v_${safe(entity)}`).select("*").eq("tenant_id", this.tenantId).in("code", codes);
    if (error) throw new Error(`v_${entity}: ${error.message}`);
    return (data ?? []) as Row[];
  }

  async existing(entity: string, codes: string[]): Promise<Set<string>> {
    const { data, error } = await this.db.from(safe(entity)).select("code").eq("tenant_id", this.tenantId).in("code", codes);
    if (error) throw new Error(`${entity}: ${error.message}`);
    return new Set((data ?? []).map((r: { code: string }) => r.code));
  }

  async vocabulary(ref: string, scope: string | null, codes: string[]): Promise<Set<string>> {
    let q = this.db.from(`ref_${safe(ref)}`).select("code").eq("is_active", true).or(`tenant_id.is.null,tenant_id.eq.${this.tenantId}`).in("code", codes);
    if (scope) q = q.eq("scope", scope);
    const { data, error } = await q;
    if (error) throw new Error(`ref_${ref}: ${error.message}`);
    return new Set((data ?? []).map((r: { code: string }) => r.code));
  }

  async apply(req: ChangeSetRequest): Promise<ChangeSetResult> {
    const args = { p_id: req.id, p_tenant: this.tenantId, p_source: req.source, p_items: req.items };
    const { data, error } = this.actingAs ? await this.db.rpc("apply_change_set_as", { p_actor: this.actingAs, ...args }) : await this.db.rpc("apply_change_set", args);
    if (error) throw changeError(error);
    return data as ChangeSetResult;
  }
}

export interface StagedRow {
  id: number;
  entity: string;
  code: string | null;
  sourceRecordId: string | null;
  values: Record<string, unknown>;
}

/** The staging ledger: what was delivered, and what became of each record. */
export class SupabaseStaging {
  constructor(private readonly db: AipClient, private readonly tenantId: string) {}

  async record(batch: { id: string; source: string; integrationId: string | null; entity: string; actor: string }, records: InboundRecord[], outcomes: Outcome[]): Promise<void> {
    const count = (s: Outcome["status"]) => outcomes.filter((o) => o.status === s).length;
    const b = await this.db.from("staging_batch").insert({
      id: batch.id, tenant_id: this.tenantId, source: batch.source, integration_id: batch.integrationId, entity: batch.entity, actor: batch.actor,
      total: records.length, applied: count("applied"), unchanged: count("unchanged"), quarantined: count("quarantined"),
    });
    if (b.error) throw new Error(`staging batch: ${b.error.message}`);
    const rows = records.map((r, i) => ({
      tenant_id: this.tenantId, batch_id: batch.id, row_no: i + 1, entity: batch.entity, code: r.code, source_record_id: r.sourceRecordId ?? null,
      values: r.values ?? {}, status: outcomes[i]!.status, issues: outcomes[i]!.issues, change_set_id: outcomes[i]!.changeSetId ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const r = await this.db.from("staging_row").insert(rows.slice(i, i + 500));
      if (r.error) throw new Error(`staging rows: ${r.error.message}`);
    }
  }

  async quarantined(ids: number[]): Promise<StagedRow[]> {
    const { data, error } = await this.db.from("staging_row").select("id, entity, code, source_record_id, values").eq("tenant_id", this.tenantId).eq("status", "quarantined").in("id", ids);
    if (error) throw new Error(`staging rows: ${error.message}`);
    return (data ?? []).map((r: { id: number; entity: string; code: string | null; source_record_id: string | null; values: Record<string, unknown> }) => ({ id: r.id, entity: r.entity, code: r.code, sourceRecordId: r.source_record_id, values: r.values }));
  }

  async settle(id: number, outcome: Pick<Outcome, "status" | "issues" | "changeSetId"> | { status: "discarded"; issues?: undefined; changeSetId?: undefined }): Promise<void> {
    const patch: Record<string, unknown> = { status: outcome.status, updated_at: new Date().toISOString() };
    if (outcome.issues) patch.issues = outcome.issues;
    if (outcome.changeSetId) patch.change_set_id = outcome.changeSetId;
    const { error } = await this.db.from("staging_row").update(patch).eq("tenant_id", this.tenantId).eq("id", id);
    if (error) throw new Error(`staging row ${id}: ${error.message}`);
  }
}
