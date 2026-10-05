import type { DataPort, LlmClient, LlmResponse, RunLog } from "@sustantix/agents";
import { describe, expect, it } from "vitest";
import { AssistantRequestSchema, askAgent, catalogueFor, decideProposal, type ProposalStore } from "../lib/agents/service";
import type { Membership } from "../lib/tenant";

const member = (role: Membership["role"]): Membership => ({ tenantId: "t", role, createdAt: "2026-01-01T00:00:00Z" });
const port: DataPort = {
  queryView: async () => [],
  lineage: async () => [],
  latestOutputs: async () => [],
  latestRuns: async () => [],
  proposals: async () => [],
  createProposal: async () => ({ code: "PRP-1" }),
};
const log = (): RunLog & { finished: boolean } => ({ finished: false, start: async () => "run-1", step: async () => {}, async finish() { this.finished = true; } });
const llm = (text: string): LlmClient => ({ create: async (): Promise<LlmResponse> => ({ content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) });

describe("agent endpoints", () => {
  it("shows every agent, marking which the caller's role may use", () => {
    const v = catalogueFor(member("viewer"));
    expect(v.find((a) => a.id === "aip-copilot")!.available).toBe(true);
    expect(v.find((a) => a.id === "reliability-agent")!.available).toBe(false);
    expect(v.every((a) => !a.canPropose)).toBe(true);
    expect(catalogueFor(member("planner")).find((a) => a.id === "reliability-agent")!.canPropose).toBe(true);
  });

  it("answers through the agent, needs the server key, and enforces roles", async () => {
    const deps = { membership: member("viewer"), llm: llm("Two sites."), model: "claude-test", port, log: log(), today: "2026-10-05" };
    const r = await askAgent("aip-copilot", { messages: [{ role: "user", content: "How many sites?" }] }, deps);
    expect(r.reply).toBe("Two sites.");
    expect(deps.log.finished).toBe(true);
    await expect(askAgent("aip-copilot", { messages: [{ role: "user", content: "x" }] }, { ...deps, llm: null })).rejects.toMatchObject({ status: 503, code: "agents_not_configured" });
    await expect(askAgent("reliability-agent", { messages: [{ role: "user", content: "x" }] }, deps)).rejects.toMatchObject({ status: 403 });
    await expect(askAgent("nope", { messages: [{ role: "user", content: "x" }] }, deps)).rejects.toMatchObject({ status: 404 });
    await expect(askAgent("aip-copilot", { messages: [{ role: "assistant", content: "x" }] }, deps)).rejects.toMatchObject({ status: 400 });
  });

  it("accepts the runtime Assistant's request shape, including its health check", () => {
    expect(AssistantRequestSchema.safeParse({ health_check: true, max_tokens: 24, system: "Return only OK.", messages: [{ role: "user", content: "Connection test" }] }).success).toBe(true);
    expect(AssistantRequestSchema.safeParse({ max_tokens: 1400, system: "ctx", messages: [{ role: "user", content: "q" }], attachments: [{ name: "a.csv", type: "text/csv", size: 10 }] }).success).toBe(true);
    expect(AssistantRequestSchema.safeParse({ messages: [] }).success).toBe(false);
  });
});

describe("proposal decisions", () => {
  const store = (status = "pending") => {
    const s = { status, decided: [] as string[], applied: 0 };
    const impl: ProposalStore = {
      get: async () => ({ id: "p1", status: s.status }),
      decide: async (_id, st) => { s.decided.push(st); s.status = st; },
      apply: async () => { s.applied++; s.status = "applied"; return "AGT-PRP-1"; },
    };
    return { s, impl };
  };

  it("lets planners approve (and applies) or reject; never viewers; never twice", async () => {
    const a = store();
    expect(await decideProposal("PRP-1", { decision: "approve", note: "ok" }, { membership: member("planner"), userId: "u", store: a.impl })).toEqual({ code: "PRP-1", status: "applied", appliedRef: "AGT-PRP-1" });
    const r = store();
    expect((await decideProposal("PRP-1", { decision: "reject" }, { membership: member("admin"), userId: "u", store: r.impl })).status).toBe("rejected");
    expect(r.s.applied).toBe(0);
    await expect(decideProposal("PRP-1", { decision: "approve" }, { membership: member("viewer"), userId: "u", store: store().impl })).rejects.toMatchObject({ status: 403 });
    await expect(decideProposal("PRP-1", { decision: "approve" }, { membership: member("admin"), userId: "u", store: store("applied").impl })).rejects.toMatchObject({ status: 409 });
    await expect(decideProposal("PRP-1", { decision: "maybe" }, { membership: member("admin"), userId: "u", store: store().impl })).rejects.toMatchObject({ status: 400 });
  });
});
