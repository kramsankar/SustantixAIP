import { AnthropicClient } from "@sustantix/agents";
import { serverEnv } from "../env";
import { requestContext } from "../analytics/context";
import { SupabaseDataPort, SupabaseRunLog } from "./port";
import type { AgentDeps, ProposalStore } from "./service";

/** Production wiring: the caller's client for data, the server-held key for the model. */
export async function agentDeps(): Promise<AgentDeps & { userId: string }> {
  const { userId, membership, db } = await requestContext();
  const env = serverEnv();
  return {
    userId,
    membership,
    llm: env.ANTHROPIC_API_KEY ? new AnthropicClient({ apiKey: env.ANTHROPIC_API_KEY }) : null,
    model: env.AIP_AGENT_MODEL,
    port: new SupabaseDataPort(db, membership.tenantId, userId),
    log: new SupabaseRunLog(db, membership.tenantId, userId),
    today: new Date().toISOString().slice(0, 10),
  };
}

export async function proposalContext() {
  const { userId, membership, db } = await requestContext();
  const store: ProposalStore = {
    async get(code) {
      const { data, error } = await db.from("agent_proposal").select("id, status").eq("tenant_id", membership.tenantId).eq("code", code).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: String(data.id), status: String(data.status) } : null;
    },
    async decide(id, status, uid, note) {
      const { error } = await db.from("agent_proposal").update({ status, decided_by: uid, decision_note: note }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    async apply(id) {
      const { data, error } = await db.rpc("apply_agent_proposal", { p_id: id });
      if (error) throw new Error(error.message);
      return (data as string | null) ?? null;
    },
  };
  return { userId, membership, db, store };
}
