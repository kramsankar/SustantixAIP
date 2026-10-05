import { errorResponse, json } from "@/lib/http";
import { jsonBody } from "@/lib/grid/body";
import { CHANGE_MODEL } from "@/lib/grid/catalogue";
import { gridContext } from "@/lib/grid/context";
import { applyChanges } from "@/lib/grid/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/aip/changes — one change set {id, source, items[]}, applied atomically with the caller's rights.
 * 409 when a row changed since it was read (the body carries the current row) or a code already exists;
 * a repeated id returns the stored result without applying anything twice.
 */
export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const body = await jsonBody(req, 512 * 1024);
    const ctx = await gridContext();
    return json(await applyChanges(body, CHANGE_MODEL, ctx.membership, ctx.changes));
  } catch (err) {
    return errorResponse(err);
  }
}
