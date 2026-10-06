import { acceptsGzip, errorResponse, NO_STORE } from "@/lib/http";
import { jsonBody } from "@/lib/grid/body";
import { dictionaryRows, gridById } from "@/lib/grid/catalogue";
import { gridContext } from "@/lib/grid/context";
import { exportGrid } from "@/lib/grid/service";
import { guard } from "@/lib/server";
import { gzipSync } from "node:zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/aip/grid/{id}/export — {format, query}: exactly the filtered rows (audited); the grid writes the file. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const def = gridById((await params).id);
    const body = await jsonBody(req, 32 * 1024);
    const ctx = await gridContext();
    const out = Buffer.from(JSON.stringify(await exportGrid(def, body, ctx.membership, ctx.grid, ctx.exports, dictionaryRows)));
    const headers: Record<string, string> = { ...NO_STORE, "content-type": "application/json; charset=utf-8", vary: "accept-encoding" };
    if (acceptsGzip(req)) return new Response(new Uint8Array(gzipSync(out)), { status: 200, headers: { ...headers, "content-encoding": "gzip" } });
    return new Response(new Uint8Array(out), { status: 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}
