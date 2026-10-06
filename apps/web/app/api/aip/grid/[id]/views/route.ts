import { errorResponse, json } from "@/lib/http";
import { jsonBody } from "@/lib/grid/body";
import { gridById } from "@/lib/grid/catalogue";
import { gridContext } from "@/lib/grid/context";
import { parseView } from "@/lib/grid/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/grid/{id}/views — the caller's saved views and the tenant's shared ones. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const def = gridById((await params).id);
    const ctx = await gridContext();
    return json({ views: await ctx.views.list(def.id, ctx.membership.tenantId) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/aip/grid/{id}/views — {name, shared, state}; only administrators share. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const def = gridById((await params).id);
    const body = await jsonBody(req, 40 * 1024);
    const ctx = await gridContext();
    const v = parseView(body, ctx.membership);
    return json(await ctx.views.create(def.id, ctx.membership.tenantId, { name: v.name, shared: v.shared, state: v.state }), 201);
  } catch (err) {
    return errorResponse(err);
  }
}
