import { ApiError, errorResponse, json } from "@/lib/http";
import { jsonBody } from "@/lib/grid/body";
import { CHANGE_MODEL } from "@/lib/grid/catalogue";
import { deliveryContext } from "@/lib/ingest/context";
import { deliver } from "@/lib/ingest/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/aip/ingest — one delivery: {entity, records[]} or {sheet, rows[]} (up to 5,000), from an integration
 * (Authorization: Bearer sxi_…) or a signed-in planner or administrator. Records are checked against the governed
 * model, the data-quality rules and their references; the rest are merged by business code; the answer counts what
 * was applied, unchanged and quarantined. Gzip bodies are accepted.
 */
export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const ctx = await deliveryContext(req.headers);
    if (ctx.who.role === "viewer") throw new ApiError(403, "forbidden", "viewers cannot deliver data");
    const body = await jsonBody(req, 16 * 1024 * 1024);
    return json(await deliver(body, ctx.who, CHANGE_MODEL, ctx.store, ctx.ledger, ctx.newId));
  } catch (err) {
    return errorResponse(err);
  }
}
