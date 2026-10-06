import { ApiError, errorResponse, json, readBody } from "@/lib/http";
import { agentDeps } from "@/lib/agents/context";
import { askAgent, AssistantRequestSchema, MAX_AGENT_BODY } from "@/lib/agents/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/aip/assistant (also served at /api/assistant) — the runtime Assistant screen's online endpoint,
 * answered by the AIP Copilot agent. The screen's own system text is passed as client data, not instructions.
 */
export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req, "/api/aip/assistant");
  if (denied) return denied;
  try {
    let raw: unknown;
    try {
      raw = JSON.parse((await readBody(req, MAX_AGENT_BODY)).toString("utf8"));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(400, "invalid_json", "request body is not JSON");
    }
    const parsed = AssistantRequestSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError(400, "invalid_request", "expected {messages:[{role, content}]}");
    const deps = await agentDeps();
    if (parsed.data.health_check) {
      if (!deps.llm) throw new ApiError(503, "agents_not_configured", "agents need ANTHROPIC_API_KEY on the server");
      return json({ status: "ok", reply: "OK" });
    }
    const messages = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));
    const r = await askAgent("aip-copilot", { messages, ...(parsed.data.system ? { context: parsed.data.system.slice(0, 20_000) } : {}) }, deps);
    return json({ reply: r.reply, runId: r.runId, proposals: r.proposals });
  } catch (err) {
    return errorResponse(err);
  }
}
