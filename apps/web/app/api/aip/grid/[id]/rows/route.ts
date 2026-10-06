import { errorResponse, json } from "@/lib/http";
import { jsonBody } from "@/lib/grid/body";
import { dictionaryRows, gridById } from "@/lib/grid/catalogue";
import { gridContext } from "@/lib/grid/context";
import { readGrid } from "@/lib/grid/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/aip/grid/{id}/rows — one page of a grid: {offset, limit, sort, filters, search}, evaluated in the database. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const def = gridById((await params).id);
    const body = await jsonBody(req, 32 * 1024);
    const ctx = await gridContext();
    return json(await readGrid(def, body, ctx.membership, ctx.grid, dictionaryRows));
  } catch (err) {
    return errorResponse(err);
  }
}
