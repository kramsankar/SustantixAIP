import { errorResponse, json } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { catalogueFor } from "@/lib/agents/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/agents — the agents, and which of them the caller's role may use. */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { membership } = await requestContext();
    return json({ role: membership.role, agents: catalogueFor(membership) });
  } catch (err) {
    return errorResponse(err);
  }
}
