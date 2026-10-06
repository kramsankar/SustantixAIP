import { ApiError, errorResponse, json, readBody } from "@/lib/http";
import { agentDeps } from "@/lib/agents/context";
import { askAgent, MAX_AGENT_BODY } from "@/lib/agents/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/aip/agents/{agent} — one conversation turn: {messages, context?} → {reply, proposals, runId}. */
export async function POST(req: Request, { params }: { params: Promise<{ agent: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { agent } = await params;
    if (!/^[a-z][a-z0-9-]{1,60}$/.test(agent)) throw new ApiError(404, "unknown_agent", "no such agent");
    let body: unknown;
    try {
      body = JSON.parse((await readBody(req, MAX_AGENT_BODY)).toString("utf8"));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(400, "invalid_json", "request body is not JSON");
    }
    return json(await askAgent(agent, body, await agentDeps()));
  } catch (err) {
    return errorResponse(err);
  }
}
