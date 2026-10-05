import { AGENTS, AgentAccessError, canUse, runAgent, type AgentResult, type DataPort, type LlmClient, type RunLog } from "@sustantix/agents";
import { z } from "zod";
import { ApiError } from "../http";
import type { Membership } from "../tenant";

/** Agent endpoints: the catalogue for a role, a conversation turn with an agent, and decisions on proposals. */

export const MAX_AGENT_BODY = 256 * 1024;

const Content = z.string().min(1).max(20_000);
export const AgentRequestSchema = z
  .object({
    messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: Content }).strict()).min(1).max(40).refine((m) => m.at(-1)?.role === "user", "the last message must be the user's"),
    context: z.string().max(20_000).optional(),
  })
  .strict();

/** The runtime's Assistant screen posts {system, messages, max_tokens, attachments}; its system text is client data. */
export const AssistantRequestSchema = z.object({
  health_check: z.boolean().optional(),
  system: z.string().max(60_000).optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: Content }).passthrough()).min(1).max(40),
  max_tokens: z.number().int().positive().max(8192).optional(),
  attachments: z.array(z.unknown()).max(20).optional(),
});

export interface AgentDeps {
  membership: Membership;
  llm: LlmClient | null;
  model: string;
  port: DataPort;
  log: RunLog;
  today: string;
}

export function catalogueFor(m: Membership) {
  return AGENTS.map((a) => ({ id: a.id, name: a.name, summary: a.summary, screens: a.screens, minRole: a.minRole, available: canUse(a, m.role), canPropose: a.proposalTypes.length > 0 && m.role !== "viewer", proposalTypes: a.proposalTypes }));
}

export async function askAgent(agentId: string, body: unknown, deps: AgentDeps): Promise<AgentResult> {
  const parsed = AgentRequestSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "invalid_request", parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  if (!deps.llm) throw new ApiError(503, "agents_not_configured", "agents need ANTHROPIC_API_KEY on the server");
  try {
    return await runAgent({ agentId, role: deps.membership.role, messages: parsed.data.messages, clientContext: parsed.data.context, asOf: deps.today }, { llm: deps.llm, model: deps.model, port: deps.port, log: deps.log });
  } catch (e) {
    if (e instanceof AgentAccessError) throw new ApiError(e.code === "forbidden" ? 403 : 404, e.code, e.message);
    throw e;
  }
}

export const DecisionSchema = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().max(2000).optional() }).strict();

/** Where decisions are recorded and approved proposals applied (with the decider's own permissions). */
export interface ProposalStore {
  get(code: string): Promise<{ id: string; status: string } | null>;
  decide(id: string, status: "approved" | "rejected", userId: string, note: string | null): Promise<void>;
  apply(id: string): Promise<string | null>;
}

export async function decideProposal(code: string, body: unknown, ctx: { membership: Membership; userId: string; store: ProposalStore }): Promise<{ code: string; status: string; appliedRef: string | null }> {
  if (ctx.membership.role === "viewer") throw new ApiError(403, "forbidden", "deciding proposals requires the planner or admin role");
  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "invalid_request", "decision must be approve or reject");
  const p = await ctx.store.get(code);
  if (!p) throw new ApiError(404, "not_found", `no proposal ${code}`);
  if (p.status !== "pending") throw new ApiError(409, "already_decided", `proposal ${code} is ${p.status}`);
  const status = parsed.data.decision === "approve" ? "approved" : "rejected";
  await ctx.store.decide(p.id, status, ctx.userId, parsed.data.note ?? null);
  if (status === "rejected") return { code, status, appliedRef: null };
  const ref = await ctx.store.apply(p.id);
  const after = await ctx.store.get(code);
  return { code, status: after?.status ?? status, appliedRef: ref };
}
