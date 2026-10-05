import type { ModelOutput, ModelRun } from "@sustantix/analytics";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResultStore } from "../analytics/service";
import type { Row, TableReader } from "../analytics/source";

type AipClient = SupabaseClient<any, "aip", "aip">;

const PAGE = 1000;

/** Reads whole tables through the caller's client (RLS applies), in PostgREST-sized pages. */
export class SupabaseTableReader implements TableReader {
  constructor(private readonly db: AipClient) {}

  async readAll(table: string): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.db.from(table).select("*").range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) return out;
    }
  }
}

/** Writes runs and outputs as the caller: planners and administrators only, enforced again by RLS. */
export class SupabaseResultStore implements ResultStore {
  constructor(private readonly db: AipClient) {}

  async recordRun(tenantId: string, run: ModelRun, meta: { code: string; asOf: string; params: Record<string, unknown>; userId: string }): Promise<string> {
    const model = await this.db.from("ml_model").select("id").eq("tenant_id", tenantId).eq("code", run.model).maybeSingle();
    if (model.error) throw new Error(model.error.message);
    if (!model.data) throw new Error(`model ${run.model} is not registered for this tenant`);
    const { data, error } = await this.db
      .from("model_run")
      .insert({
        tenant_id: tenantId, code: meta.code, ml_model_id: model.data.id, status: run.status, as_of: meta.asOf, finished_at: new Date().toISOString(),
        params: meta.params, metrics: run.metrics, message: run.message ?? null, output_count: run.outputs.length, triggered_by: meta.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return String(data.id);
  }

  async recordOutputs(tenantId: string, runId: string, outputs: ModelOutput[]): Promise<void> {
    for (let i = 0; i < outputs.length; i += 500) {
      const rows = outputs.slice(i, i + 500).map((o) => ({
        tenant_id: tenantId, run_id: runId, subject_type: o.subjectType, subject_code: o.subject, measure: o.measure, at: o.at ?? null,
        horizon_hours: o.horizonHours ?? null, value: o.value ?? null, q10: o.q10 ?? null, q50: o.q50 ?? null, q90: o.q90 ?? null, unit: o.unit, detail: o.detail ?? null,
      }));
      const { error } = await this.db.from("model_output").insert(rows);
      if (error) throw new Error(error.message);
    }
  }
}
