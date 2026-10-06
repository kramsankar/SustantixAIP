import type { DataPort, Filter, NewProposal, Row, RunLog } from "@sustantix/agents";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

type AipClient = SupabaseClient<any, "aip", "aip">;

/** Agents read and propose through the caller's client: RLS decides what an agent can see and do. */
export class SupabaseDataPort implements DataPort {
  constructor(
    private readonly db: AipClient,
    private readonly tenantId: string,
    private readonly userId: string,
  ) {}

  async queryView(view: string, q: { filters: Filter[]; columns?: string[]; order?: { column: string; desc: boolean }; limit: number }): Promise<Row[]> {
    if (!/^v_[a-z_]+$/.test(view)) throw new Error(`not a master view: ${view}`);
    let query = this.db.from(view).select(q.columns ? q.columns.join(",") : "*").eq("tenant_id", this.tenantId);
    for (const f of q.filters) {
      if (f.op === "is_null") query = query.is(f.column, null);
      else if (f.op === "not_null") query = query.not(f.column, "is", null);
      else if (f.op === "ilike") query = query.ilike(f.column, String(f.value ?? ""));
      else {
        const v = f.value as string | number | boolean;
        switch (f.op) {
          case "eq": query = query.eq(f.column, v); break;
          case "neq": query = query.neq(f.column, v); break;
          case "gt": query = query.gt(f.column, v); break;
          case "gte": query = query.gte(f.column, v); break;
          case "lt": query = query.lt(f.column, v); break;
          case "lte": query = query.lte(f.column, v); break;
        }
      }
    }
    if (q.order) query = query.order(q.order.column, { ascending: !q.order.desc, nullsFirst: false });
    const { data, error } = await query.limit(q.limit);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Row[]).map(({ id: _i, tenant_id: _t, ...r }) => r);
  }

  async lineage(master: string, code: string): Promise<Row[]> {
    const { data, error } = await this.db.from("master_lineage").select("source_table, source_key, role").eq("tenant_id", this.tenantId).eq("master", master).eq("code", code).limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async latestOutputs(q: { model?: string; measure?: string; subject?: string; subjectType?: string; orderByValueDesc?: boolean; limit: number }): Promise<Row[]> {
    let query = this.db.from("v_model_output_latest").select("model, run, as_of, subject_type, subject_code, measure, at, horizon_hours, value, q10, q50, q90, unit, detail").eq("tenant_id", this.tenantId);
    if (q.model) query = query.eq("model", q.model);
    if (q.measure) query = query.eq("measure", q.measure);
    if (q.subject) query = query.eq("subject_code", q.subject);
    if (q.subjectType) query = query.eq("subject_type", q.subjectType);
    if (q.orderByValueDesc) query = query.order("value", { ascending: false, nullsFirst: false });
    const { data, error } = await query.limit(q.limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async latestRuns(): Promise<Row[]> {
    const { data, error } = await this.db.from("v_model_run_latest").select("model, code, as_of, metrics").eq("tenant_id", this.tenantId);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async proposals(q: { status?: string; agent?: string; subject?: string; limit: number }): Promise<Row[]> {
    let query = this.db.from("agent_proposal").select("code, agent, proposal_type, subject_type, subject_code, title, status, created_at, decided_at, applied_ref").eq("tenant_id", this.tenantId).order("created_at", { ascending: false });
    if (q.status) query = query.eq("status", q.status);
    if (q.agent) query = query.eq("agent", q.agent);
    if (q.subject) query = query.eq("subject_code", q.subject);
    const { data, error } = await query.limit(q.limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async createProposal(p: NewProposal): Promise<{ code: string }> {
    const code = `PRP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const { error } = await this.db.from("agent_proposal").insert({
      tenant_id: this.tenantId, code, agent: p.agent, run_id: p.runId, proposal_type: p.type, subject_type: p.subjectType, subject_code: p.subjectCode,
      title: p.title, rationale: p.rationale, payload: p.payload, evidence: p.evidence, proposed_by: this.userId,
    });
    if (error) throw new Error(error.message);
    return { code };
  }
}

/** Records the run when it starts and its steps when it ends (one audited batch). */
export class SupabaseRunLog implements RunLog {
  private readonly buffer: Array<{ seq: number; kind: string; tool: string | null; payload: unknown }> = [];
  constructor(
    private readonly db: AipClient,
    private readonly tenantId: string,
    private readonly userId: string,
  ) {}

  async start(meta: { agent: string; model: string; question: string }): Promise<string> {
    const code = `AGR-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const { data, error } = await this.db.from("agent_run").insert({ tenant_id: this.tenantId, code, agent: meta.agent, user_id: this.userId, model: meta.model, status: "running", question: meta.question }).select("id").single();
    if (error) throw new Error(error.message);
    return String(data.id);
  }

  async step(_runId: string, seq: number, kind: "tool_call" | "tool_result" | "reply" | "guardrail", tool: string | null, payload: unknown): Promise<void> {
    this.buffer.push({ seq, kind, tool, payload });
  }

  async finish(runId: string, r: { status: string; reply: string; steps: number; inputTokens: number; outputTokens: number; message?: string }): Promise<void> {
    if (this.buffer.length) {
      const { error } = await this.db.from("agent_step").insert(this.buffer.map((s) => ({ tenant_id: this.tenantId, run_id: runId, ...s })));
      if (error) throw new Error(error.message);
    }
    const { error } = await this.db
      .from("agent_run")
      .update({ status: r.status, reply: r.reply, steps: r.steps, input_tokens: r.inputTokens, output_tokens: r.outputTokens, message: r.message ?? null, finished_at: new Date().toISOString() })
      .eq("id", runId);
    if (error) throw new Error(error.message);
  }
}
