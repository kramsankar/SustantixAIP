import { ApiError, errorResponse, json, noContent } from "@/lib/http";
import { jsonBody } from "@/lib/grid/body";
import { gridById } from "@/lib/grid/catalogue";
import { gridContext } from "@/lib/grid/context";
import { parseView } from "@/lib/grid/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function target(params: Promise<{ id: string; view: string }>) {
  const { id, view } = await params;
  gridById(id);
  if (!UUID.test(view)) throw new ApiError(404, "not_found", "no such view");
  return view;
}

/** PUT /api/aip/grid/{id}/views/{view} — {name, shared, state, rowVersion}; 409 when the view changed meanwhile. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; view: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const view = await target(params);
    const body = await jsonBody(req, 40 * 1024);
    const ctx = await gridContext();
    const v = parseView(body, ctx.membership, true);
    const saved = await ctx.views.update(view, ctx.membership.tenantId, v.rowVersion!, { name: v.name, shared: v.shared, state: v.state });
    if (!saved) throw new ApiError(409, "conflict", "the view was changed or removed since it was loaded");
    return json(saved);
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/aip/grid/{id}/views/{view} — removes a view the caller may change. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; view: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const view = await target(params);
    const ctx = await gridContext();
    if (!(await ctx.views.remove(view, ctx.membership.tenantId))) throw new ApiError(404, "not_found", "no such view");
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
