import { errorResponse, json } from "@/lib/http";
import { proposalContext } from "@/lib/agents/context";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/agents/proposals?status=pending — proposals waiting for (or past) a decision. */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { db, membership } = await proposalContext();
    const status = new URL(req.url).searchParams.get("status");
    let q = db.from("agent_proposal").select("code, agent, proposal_type, subject_type, subject_code, title, rationale, payload, evidence, status, created_at, decided_at, decision_note, applied_ref").eq("tenant_id", membership.tenantId).order("created_at", { ascending: false }).limit(200);
    if (status && /^(pending|approved|rejected|applied|failed)$/.test(status)) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return json({ proposals: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}
