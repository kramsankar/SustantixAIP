/**
 * The tools agents may call. Every tool validates its input, reads through a DataPort that runs with the caller's
 * permissions, and returns plain JSON. Only create_proposal writes, and only a pending proposal.
 */
import { MODEL_CARDS } from "@sustantix/analytics";
import { z } from "zod";
import { MASTERS, ROLE_RANK, type AgentDefinition, type Role, type ToolName } from "./catalogue.ts";
import { EvidenceSchema, PAYLOADS, PROPOSAL_TYPES, SUBJECT_MASTER, type ProposalType } from "./proposals.ts";

export type Row = Record<string, unknown>;

export interface Filter {
  column: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "ilike" | "is_null" | "not_null";
  value?: string | number | boolean | null;
}

export interface NewProposal {
  agent: string;
  runId: string | null;
  type: ProposalType;
  subjectType: string;
  subjectCode: string;
  title: string;
  rationale: string;
  payload: Record<string, unknown>;
  evidence: Array<{ source: string; detail: string }>;
}

/** Storage port: Supabase (code views, RLS) on Vercel; Dataverse in the Power Platform edition; memory in tests. */
export interface DataPort {
  queryView(view: string, q: { filters: Filter[]; columns?: string[]; order?: { column: string; desc: boolean }; limit: number }): Promise<Row[]>;
  lineage(master: string, code: string): Promise<Row[]>;
  latestOutputs(q: { model?: string; measure?: string; subject?: string; subjectType?: string; orderByValueDesc?: boolean; limit: number }): Promise<Row[]>;
  latestRuns(): Promise<Row[]>;
  proposals(q: { status?: string; agent?: string; subject?: string; limit: number }): Promise<Row[]>;
  createProposal(p: NewProposal): Promise<{ code: string }>;
}

export interface ToolContext {
  port: DataPort;
  agent: AgentDefinition;
  role: Role;
  runId: string | null;
  /** Proposals created so far in this run (guardrail: at most `maxProposals`). */
  proposalsCreated: number;
  maxProposals: number;
}

export interface ToolSpec {
  name: ToolName;
  description: string;
  input_schema: Record<string, unknown>;
  run(ctx: ToolContext, input: unknown): Promise<unknown>;
}

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const r = schema.safeParse(input ?? {});
  if (!r.success) throw new ToolError(`invalid input: ${r.error.issues.map((i) => `${i.path.join(".") || "input"} ${i.message}`).join("; ")}`);
  return r.data;
};

const masterNames = MASTERS.map((m) => m.name) as [string, ...string[]];
const masterInfo = (name: string) => {
  const m = MASTERS.find((x) => x.name === name);
  if (!m) throw new ToolError(`unknown master ${name}`);
  return m;
};
const checkColumns = (master: string, cols: string[]) => {
  const known = new Set(["code", ...masterInfo(master).columns.map((c) => c.name)]);
  const bad = cols.filter((c) => !known.has(c));
  if (bad.length) throw new ToolError(`unknown column(s) on ${master}: ${bad.join(", ")}`);
};

const FilterSchema = z.object({
  column: z.string().regex(/^[a-z][a-z0-9_]*$/),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "is_null", "not_null"]),
  value: z.union([z.string().max(200), z.number(), z.boolean(), z.null()]).optional(),
});

const QuerySchema = z.object({
  master: z.enum(masterNames),
  filters: z.array(FilterSchema).max(8).default([]),
  columns: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).max(40).optional(),
  order_by: z.string().regex(/^[a-z][a-z0-9_]*$/).optional(),
  descending: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(25),
}).strict();

const OutputsSchema = z.object({
  model: z.enum(MODEL_CARDS.map((m) => m.code) as [string, ...string[]]).optional(),
  measure: z.string().regex(/^[a-z][a-z0-9_]*$/).optional(),
  subject: z.string().min(1).max(200).optional(),
  subject_type: z.enum(["site", "asset", "asset_class", "part", "part_stock", "bess", "portfolio"]).optional(),
  highest_first: z.boolean().default(false),
  limit: z.number().int().min(1).max(200).default(50),
}).strict();

const ProposalSchema = z.object({
  type: z.enum(PROPOSAL_TYPES as [ProposalType, ...ProposalType[]]),
  subject_type: z.string().regex(/^[a-z_]+$/),
  subject_code: z.string().min(1).max(200),
  title: z.string().min(5).max(300),
  rationale: z.string().min(20).max(4000),
  payload: z.record(z.string(), z.unknown()),
  evidence: EvidenceSchema,
}).strict();

const json = (props: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties: props, required, additionalProperties: false });

export const TOOLS: ToolSpec[] = [
  {
    name: "list_masters",
    description: "Lists the governed master tables (sites, assets, parts, contracts, interventions…) with their columns. References appear as the target's business code.",
    input_schema: json({}),
    run: async () => MASTERS.map((m) => ({ master: m.name, label: m.label, description: m.description, columns: m.columns.map((c) => c.name + (c.fk ? ` → ${c.fk}` : c.ref ? ` (code of ${c.ref})` : "")) })),
  },
  {
    name: "query_master",
    description: "Queries one master table with filters (eq, neq, gt, gte, lt, lte, ilike with % wildcards, is_null, not_null), optional columns, ordering and a limit (max 100). Codes are business codes such as SP-01 or AST-00001.",
    input_schema: json({
      master: { type: "string", enum: masterNames },
      filters: { type: "array", items: json({ column: { type: "string" }, op: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "is_null", "not_null"] }, value: { type: ["string", "number", "boolean", "null"] } }, ["column", "op"]) },
      columns: { type: "array", items: { type: "string" } },
      order_by: { type: "string" },
      descending: { type: "boolean" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }, ["master"]),
    run: async (ctx, input) => {
      const q = parse(QuerySchema, input);
      checkColumns(q.master, [...q.filters.map((f) => f.column), ...(q.columns ?? []), ...(q.order_by ? [q.order_by] : [])]);
      const rows = await ctx.port.queryView(masterInfo(q.master).view, { filters: q.filters as Filter[], columns: q.columns ? ["code", ...q.columns.filter((c) => c !== "code")] : undefined, order: q.order_by ? { column: q.order_by, desc: q.descending } : undefined, limit: q.limit });
      return { master: q.master, rows: rows.length, records: rows };
    },
  },
  {
    name: "get_record",
    description: "Returns one master record by business code, the workbook rows it was consolidated from, and the latest model outputs about it.",
    input_schema: json({ master: { type: "string", enum: masterNames }, code: { type: "string" } }, ["master", "code"]),
    run: async (ctx, input) => {
      const q = parse(z.object({ master: z.enum(masterNames), code: z.string().min(1).max(200) }).strict(), input);
      const [rec] = await ctx.port.queryView(masterInfo(q.master).view, { filters: [{ column: "code", op: "eq", value: q.code }], limit: 1 });
      if (!rec) return { found: false, master: q.master, code: q.code };
      const [lineage, outputs] = await Promise.all([ctx.port.lineage(q.master, q.code), ctx.port.latestOutputs({ subject: q.code, limit: 50 })]);
      return { found: true, master: q.master, record: rec, lineage, modelOutputs: outputs };
    },
  },
  {
    name: "model_catalogue",
    description: "Lists AIP's analytical models (algorithm, validation) with each one's latest successful run and its metrics.",
    input_schema: json({}),
    run: async (ctx) => {
      const runs = await ctx.port.latestRuns();
      return MODEL_CARDS.map((m) => {
        const r = runs.find((x) => x.model === m.code);
        return { model: m.code, name: m.name, type: m.model_type, algorithm: m.algorithm, validation: m.validation_method, latestRun: r ? { run: r.code, asOf: r.as_of, metrics: r.metrics } : null };
      });
    },
  },
  {
    name: "latest_model_outputs",
    description: "Outputs of each model's latest successful run, filtered by model, measure (e.g. failure_probability, remaining_useful_life, risk, anomaly_score, energy_horizon, revenue_horizon, soh_year10, reorder_point, performance_drift), subject and subject type. q10/q50/q90 are percentiles where a range exists.",
    input_schema: json({
      model: { type: "string", enum: MODEL_CARDS.map((m) => m.code) },
      measure: { type: "string" },
      subject: { type: "string" },
      subject_type: { type: "string", enum: ["site", "asset", "asset_class", "part", "part_stock", "bess", "portfolio"] },
      highest_first: { type: "boolean" },
      limit: { type: "integer", minimum: 1, maximum: 200 },
    }),
    run: async (ctx, input) => {
      const q = parse(OutputsSchema, input);
      const rows = await ctx.port.latestOutputs({ model: q.model, measure: q.measure, subject: q.subject, subjectType: q.subject_type, orderByValueDesc: q.highest_first, limit: q.limit });
      return { outputs: rows.length, rows };
    },
  },
  {
    name: "top_risks",
    description: "The assets with the highest expected loss from the latest composite risk run, optionally for one site, with band, failure probability and expected loss.",
    input_schema: json({ site: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }),
    run: async (ctx, input) => {
      const q = parse(z.object({ site: z.string().max(40).optional(), limit: z.number().int().min(1).max(50).default(10) }).strict(), input);
      const rows = await ctx.port.latestOutputs({ model: "AIP-RISK-1", measure: "risk", orderByValueDesc: true, limit: q.site ? 200 : q.limit });
      const filtered = q.site ? rows.filter((r) => (r.detail as Row | null)?.plant === q.site) : rows;
      return filtered.slice(0, q.limit).map((r) => ({ asset: r.subject_code, score: r.value, ...(r.detail as Row) }));
    },
  },
  {
    name: "list_proposals",
    description: "Lists agent proposals (pending, approved, rejected, applied) to avoid duplicates and to report on decisions.",
    input_schema: json({ status: { type: "string", enum: ["pending", "approved", "rejected", "applied", "failed"] }, agent: { type: "string" }, subject: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 } }),
    run: async (ctx, input) => {
      const q = parse(z.object({ status: z.enum(["pending", "approved", "rejected", "applied", "failed"]).optional(), agent: z.string().max(60).optional(), subject: z.string().max(200).optional(), limit: z.number().int().min(1).max(100).default(25) }).strict(), input);
      return ctx.port.proposals(q);
    },
  },
  {
    name: "create_proposal",
    description: `Proposes an action for a person to approve; it changes nothing by itself. Types: ${PROPOSAL_TYPES.join(", ")}. The payload must match the type; evidence lists each source (model and run, record code) behind the proposal.`,
    input_schema: json({
      type: { type: "string", enum: PROPOSAL_TYPES },
      subject_type: { type: "string" },
      subject_code: { type: "string" },
      title: { type: "string" },
      rationale: { type: "string" },
      payload: { type: "object" },
      evidence: { type: "array", items: json({ source: { type: "string" }, detail: { type: "string" } }, ["source", "detail"]) },
    }, ["type", "subject_type", "subject_code", "title", "rationale", "payload", "evidence"]),
    run: async (ctx, input) => {
      if (ROLE_RANK[ctx.role] < ROLE_RANK.planner) throw new ToolError("proposals need a planner or administrator; describe the recommendation in your reply instead");
      if (ctx.proposalsCreated >= ctx.maxProposals) throw new ToolError(`at most ${ctx.maxProposals} proposals per request`);
      const p = parse(ProposalSchema, input);
      if (!ctx.agent.proposalTypes.includes(p.type)) throw new ToolError(`${ctx.agent.name} may not propose ${p.type}`);
      const payload = parse(PAYLOADS[p.type] as z.ZodType<Record<string, unknown>>, p.payload);
      const master = SUBJECT_MASTER[p.type];
      if (master) {
        if (p.subject_type !== master) throw new ToolError(`a ${p.type} proposal is about a ${master}`);
        const [hit] = await ctx.port.queryView(masterInfo(master).view, { filters: [{ column: "code", op: "eq", value: p.subject_code }], limit: 1 });
        if (!hit) throw new ToolError(`${master} ${p.subject_code} does not exist`);
      }
      const dup = await ctx.port.proposals({ status: "pending", subject: p.subject_code, limit: 50 });
      if (dup.some((d) => d.proposal_type === p.type)) throw new ToolError(`a pending ${p.type} proposal for ${p.subject_code} already exists`);
      const r = await ctx.port.createProposal({ agent: ctx.agent.id, runId: ctx.runId, type: p.type, subjectType: p.subject_type, subjectCode: p.subject_code, title: p.title, rationale: p.rationale, payload, evidence: p.evidence });
      ctx.proposalsCreated++;
      return { created: true, code: r.code, status: "pending", note: "A planner or administrator decides this proposal." };
    },
  },
];

export const toolsFor = (a: AgentDefinition) => TOOLS.filter((t) => a.tools.includes(t.name));
