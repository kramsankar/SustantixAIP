import { ApiError, errorResponse, json, readBody } from "@/lib/http";
import { proposalContext } from "@/lib/agents/context";
import { decideProposal } from "@/lib/agents/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/aip/agents/proposals/{code} — {decision: approve|reject, note?}; approval applies with the caller's rights. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { id } = await params;
    if (!/^PRP-[A-Z0-9-]{1,60}$/.test(id)) throw new ApiError(404, "not_found", "no such proposal");
    let body: unknown;
    try {
      body = JSON.parse((await readBody(req, 8 * 1024)).toString("utf8"));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(400, "invalid_json", "request body is not JSON");
    }
    const ctx = await proposalContext();
    return json(await decideProposal(id, body, ctx));
  } catch (err) {
    return errorResponse(err);
  }
}
