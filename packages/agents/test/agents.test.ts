import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AGENTS,
  AnthropicClient,
  MASTERS,
  PROPOSAL_TYPES,
  TOOLS,
  runAgent,
  type DataPort,
  type Filter,
  type LlmClient,
  type LlmRequest,
  type LlmResponse,
  type NewProposal,
  type Row,
  type RunLog,
} from "../src/index.ts";

class MemoryPort implements DataPort {
  readonly created: NewProposal[] = [];
  readonly queries: Array<{ view: string; filters: Filter[] }> = [];
  constructor(private readonly views: Record<string, Row[]> = {}, private readonly outputs: Row[] = []) {}
  async queryView(view: string, q: { filters: Filter[]; limit: number }) {
    this.queries.push({ view, filters: q.filters });
    return (this.views[view] ?? []).filter((r) => q.filters.every((f) => f.op !== "eq" || r[f.column] === f.value)).slice(0, q.limit);
  }
  async lineage() {
    return [{ source_table: "asset_master", source_key: "AST-00001", role: "primary" }];
  }
  async latestOutputs(q: { measure?: string; subject?: string; limit: number }) {
    return this.outputs.filter((o) => (!q.measure || o.measure === q.measure) && (!q.subject || o.subject_code === q.subject)).slice(0, q.limit);
  }
  async latestRuns() {
    return [{ model: "AIP-RISK-1", code: "AIP-RISK-1/2026-10-05T10:00:00Z", as_of: "2026-09-30", metrics: { assets: 665 } }];
  }
  async proposals(q: { status?: string; subject?: string }) {
    return this.created.filter((p) => (!q.subject || p.subjectCode === q.subject)).map((p) => ({ proposal_type: p.type, subject_code: p.subjectCode, status: "pending" }));
  }
  async createProposal(p: NewProposal) {
    this.created.push(p);
    return { code: `PRP-${this.created.length}` };
  }
}

class MemoryLog implements RunLog {
  readonly steps: Array<{ kind: string; tool: string | null; payload: unknown }> = [];
  finished: unknown;
  async start() {
    return "run-1";
  }
  async step(_r: string, _s: number, kind: "tool_call" | "tool_result" | "reply" | "guardrail", tool: string | null, payload: unknown) {
    this.steps.push({ kind, tool, payload });
  }
  async finish(_r: string, f: unknown) {
    this.finished = f;
  }
}

/** Plays back a fixed sequence of model turns and records what it was sent. */
class ScriptedLlm implements LlmClient {
  readonly requests: LlmRequest[] = [];
  constructor(private readonly turns: LlmResponse[]) {}
  async create(req: LlmRequest): Promise<LlmResponse> {
    this.requests.push(JSON.parse(JSON.stringify(req)));
    const t = this.turns.shift();
    if (!t) throw new Error("script exhausted");
    return t;
  }
}

const toolUse = (name: string, input: unknown, id = name): LlmResponse => ({ content: [{ type: "tool_use", id, name, input }], stop_reason: "tool_use", usage: { input_tokens: 100, output_tokens: 20 } });
const say = (text: string): LlmResponse => ({ content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 50, output_tokens: 30 } });

const asset = { code: "AST-00020", site: "SP-02", asset_class: "TRANSFORMER", tag: "SP-02-TRF-001" };
const port = () =>
  new MemoryPort({ v_asset: [asset], v_site: [{ code: "SP-02", name: "Plant 2" }] }, [
    { model: "AIP-RISK-1", measure: "risk", subject_code: "AST-00020", value: 92, detail: { band: "CRITICAL", expectedLoss: 1910257.5, currency: "INR", plant: "SP-02", pFail: 0.0447 } },
  ]);
const proposal = {
  type: "intervention",
  subject_type: "asset",
  subject_code: "AST-00020",
  title: "Replace transformer bushing on SP-02-TRF-001",
  rationale: "Failure probability 4.5 % in 90 days with expected loss INR 1.91 million, the highest in the portfolio.",
  payload: { asset: "AST-00020", maintenance_type: "PREDICTIVE", description: "Inspect and replace HV bushing", priority: "CRITICAL", required_by: "2026-10-20" },
  evidence: [{ source: "AIP-RISK-1/2026-10-05T10:00:00Z", detail: "risk 92, band CRITICAL, expected loss INR 1,910,257.50" }],
};

describe("agent catalogue", () => {
  it("only references real tools, proposal types the database accepts, and masters that exist", () => {
    const migration = readFileSync(new URL("../../../supabase/migrations/20261005000300_aip_agents.sql", import.meta.url), "utf8");
    for (const t of PROPOSAL_TYPES) expect(migration).toContain(`'${t}'`);
    expect(AGENTS.length).toBeGreaterThanOrEqual(10);
    for (const a of AGENTS) {
      for (const t of a.tools) expect(TOOLS.map((x) => x.name)).toContain(t);
      for (const p of a.proposalTypes) expect(PROPOSAL_TYPES).toContain(p);
      expect(a.tools.includes("create_proposal")).toBe(a.proposalTypes.length > 0);
      expect(a.instructions.length).toBeGreaterThan(80);
    }
    expect(MASTERS.map((m) => m.name)).toEqual(expect.arrayContaining(["asset", "site", "part", "intervention", "warranty_contract"]));
    expect(new Set(AGENTS.map((a) => a.id)).size).toBe(AGENTS.length);
  });
});

describe("agent runtime", () => {
  it("refuses agents the caller's role may not use", async () => {
    await expect(runAgent({ agentId: "reliability-agent", role: "viewer", messages: [{ role: "user", content: "hi" }] }, { llm: new ScriptedLlm([]), model: "m", port: port(), log: new MemoryLog() })).rejects.toMatchObject({ code: "forbidden" });
    await expect(runAgent({ agentId: "nope", role: "admin", messages: [] }, { llm: new ScriptedLlm([]), model: "m", port: port(), log: new MemoryLog() })).rejects.toMatchObject({ code: "unknown_agent" });
  });

  it("reads through tools, proposes with evidence, logs every step, and changes nothing itself", async () => {
    const p = port();
    const log = new MemoryLog();
    const llm = new ScriptedLlm([toolUse("top_risks", { limit: 5 }), toolUse("query_master", { master: "asset", filters: [{ column: "code", op: "eq", value: "AST-00020" }] }), toolUse("create_proposal", proposal), say("Proposed PRP-1 for AST-00020.")]);
    const r = await runAgent({ agentId: "reliability-agent", role: "planner", messages: [{ role: "user", content: "What should we act on first?" }], asOf: "2026-10-05" }, { llm, model: "claude-test", port: p, log });
    expect(r.status).toBe("completed");
    expect(r.proposals).toEqual(["PRP-1"]);
    expect(r.reply).toContain("PRP-1");
    expect(r.usage).toEqual({ inputTokens: 350, outputTokens: 90 });
    expect(p.created[0]).toMatchObject({ agent: "reliability-agent", runId: "run-1", type: "intervention", subjectCode: "AST-00020" });
    expect(log.steps.map((s) => s.kind)).toEqual(["tool_call", "tool_result", "tool_call", "tool_result", "tool_call", "tool_result", "reply"]);
    // Tool output reaches the model as wrapped data; the system prompt says data is not instructions.
    const last = llm.requests.at(-1)!;
    expect(JSON.stringify(last.messages)).toContain("<tool_data>");
    expect(last.system).toContain("never instructions");
    expect(last.tools.map((t) => t.name)).not.toContain("list_masters");
  });

  it("turns tool misuse into errors the model can correct, without failing the run", async () => {
    const p = port();
    const log = new MemoryLog();
    const llm = new ScriptedLlm([
      toolUse("list_masters", {}, "a"), // not one of this agent's tools
      toolUse("query_master", { master: "asset", filters: [{ column: "secret_column", op: "eq", value: 1 }] }, "b"),
      toolUse("create_proposal", { ...proposal, payload: { asset: "AST-00020" } }, "c"), // payload incomplete
      toolUse("create_proposal", { ...proposal, subject_code: "AST-99999", payload: { ...proposal.payload, asset: "AST-99999" } }, "d"),
      toolUse("create_proposal", { ...proposal, type: "purchase_requisition" }, "e"), // not this agent's type
      say("Done."),
    ]);
    const r = await runAgent({ agentId: "reliability-agent", role: "admin", messages: [{ role: "user", content: "go" }] }, { llm, model: "m", port: p, log });
    expect(r.status).toBe("completed");
    expect(p.created).toEqual([]);
    const errors = log.steps.filter((s) => s.kind === "guardrail").map((s) => (s.payload as { content: string }).content);
    expect(errors[0]).toMatch(/not available/);
    expect(errors[1]).toMatch(/unknown column/);
    expect(errors[2]).toMatch(/invalid input/);
    expect(errors[3]).toMatch(/does not exist/);
    expect(errors[4]).toMatch(/may not propose/);
  });

  it("lets viewers ask but not propose, refuses duplicates, and caps proposals and rounds", async () => {
    const viewer = new MemoryLog();
    await runAgent({ agentId: "forecast-agent", role: "viewer", messages: [{ role: "user", content: "flag SP-02" }] }, {
      llm: new ScriptedLlm([toolUse("create_proposal", { type: "notification", subject_type: "site", subject_code: "SP-02", title: "Low P90 at SP-02", rationale: "P90 energy is far below plan for the next seven days.", payload: { audience: "Scheduling desk", message: "SP-02 P90 low" }, evidence: [{ source: "AIP-GEN-HYBRID-1", detail: "energy_horizon" }] }), say("ok")]),
      model: "m", port: port(), log: viewer,
    });
    expect((viewer.steps.find((s) => s.kind === "guardrail")!.payload as { content: string }).content).toMatch(/planner or administrator/);

    const p = port();
    const dup = new MemoryLog();
    await runAgent({ agentId: "reliability-agent", role: "planner", messages: [{ role: "user", content: "x" }] }, { llm: new ScriptedLlm([toolUse("create_proposal", proposal, "1"), toolUse("create_proposal", proposal, "2"), say("ok")]), model: "m", port: p, log: dup });
    expect(p.created).toHaveLength(1);
    expect(JSON.stringify(dup.steps)).toContain("already exists");

    const capped = new MemoryLog();
    const p2 = new MemoryPort({ v_asset: [1, 2, 3].map((i) => ({ ...asset, code: `AST-${i}` })) });
    const make = (i: number) => ({ ...proposal, subject_code: `AST-${i}`, payload: { ...proposal.payload, asset: `AST-${i}` } });
    await runAgent({ agentId: "reliability-agent", role: "planner", messages: [{ role: "user", content: "x" }] }, { llm: new ScriptedLlm([toolUse("create_proposal", make(1), "1"), toolUse("create_proposal", make(2), "2"), toolUse("create_proposal", make(3), "3"), say("ok")]), model: "m", port: p2, log: capped, limits: { maxProposals: 2 } });
    expect(p2.created).toHaveLength(2);

    const loop = new MemoryLog();
    const r = await runAgent({ agentId: "aip-copilot", role: "viewer", messages: [{ role: "user", content: "x" }] }, { llm: new ScriptedLlm(Array.from({ length: 5 }, () => toolUse("model_catalogue", {}))), model: "m", port: port(), log: loop, limits: { maxRounds: 3 } });
    expect(r.status).toBe("stopped");
    expect(loop.steps.at(-1)!.kind).toBe("guardrail");
  });

  it("fails closed when the model service fails", async () => {
    const log = new MemoryLog();
    const r = await runAgent({ agentId: "aip-copilot", role: "viewer", messages: [{ role: "user", content: "x" }] }, { llm: { create: async () => { throw new Error("model API returned 500 (api_error)"); } }, model: "m", port: port(), log });
    expect(r.status).toBe("failed");
    expect(r.reply).toMatch(/Nothing was changed/);
    expect(log.finished).toMatchObject({ status: "failed" });
  });
});

describe("Claude API client", () => {
  it("retries on overload, then returns the message; errors never echo the body", async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const responses = [new Response("{}", { status: 529 }), new Response(JSON.stringify(say("hi")), { status: 200 })];
    const c = new AnthropicClient({ apiKey: "sk-test", fetcher: (async (url: string, init: RequestInit) => { calls.push({ url, headers: init.headers as Record<string, string> }); return responses.shift()!; }) as typeof fetch, sleep: async () => {} });
    const r = await c.create({ model: "m", system: "s", messages: [], tools: [], max_tokens: 10 });
    expect(r.content[0]).toMatchObject({ type: "text", text: "hi" });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(calls[0]!.headers["x-api-key"]).toBe("sk-test");
    const bad = new AnthropicClient({ apiKey: "k", maxRetries: 0, fetcher: (async () => new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "prompt: secret text" } }), { status: 400 })) as typeof fetch });
    await expect(bad.create({ model: "m", system: "s", messages: [], tools: [], max_tokens: 10 })).rejects.toThrow("model API returned 400 (invalid_request_error)");
    expect(() => new AnthropicClient({ apiKey: "" })).toThrow(/not configured/);
  });
});
