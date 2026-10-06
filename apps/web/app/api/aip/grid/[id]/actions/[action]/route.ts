import { ApiError, errorResponse, json } from "@/lib/http";
import { jsonBody } from "@/lib/grid/body";
import { CHANGE_MODEL, gridById } from "@/lib/grid/catalogue";
import { deliveryContext } from "@/lib/ingest/context";
import { discard, replay } from "@/lib/ingest/service";
import { guard } from "@/lib/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const body = z.object({ keys: z.array(z.string().regex(/^\d{1,18}$/)).min(1).max(5000) }).strict();

/** POST /api/aip/grid/{id}/actions/{action} — {keys}: a grid's own actions (quarantine: replay or discard rows). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { id, action } = await params;
    const def = gridById(id);
    if (!def.actions?.some((a) => a.id === action)) throw new ApiError(404, "not_found", "no such action");
    const v = body.safeParse(await jsonBody(req, 256 * 1024));
    if (!v.success) throw new ApiError(400, "invalid_action", "keys: the selected rows");
    const ids = v.data.keys.map(Number);
    const ctx = await deliveryContext(req.headers);
    if (ctx.who.role === "viewer") throw new ApiError(403, "forbidden", "viewers cannot change quarantined data");
    if (id === "data-quarantine" && action === "replay") return json(await replay(ids, ctx.who, CHANGE_MODEL, ctx.store, ctx.ledger, ctx.newId));
    if (id === "data-quarantine" && action === "discard") return json(await discard(ids, ctx.ledger));
    throw new ApiError(404, "not_found", "no such action");
  } catch (err) {
    return errorResponse(err);
  }
}
