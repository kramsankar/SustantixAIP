import { errorResponse, json } from "@/lib/http";
import { CHANGE_MODEL } from "@/lib/grid/catalogue";
import { gridContext } from "@/lib/grid/context";
import { listOptions } from "@/lib/grid/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/grid/options?kind=ref|fk&name=…&scope=…&q=… — dropdown values for an editable cell. */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const ctx = await gridContext();
    return json({ options: await listOptions(new URL(req.url).searchParams, CHANGE_MODEL, ctx.membership, ctx.options) });
  } catch (err) {
    return errorResponse(err);
  }
}
