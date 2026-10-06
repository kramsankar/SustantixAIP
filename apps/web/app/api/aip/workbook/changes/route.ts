import { errorResponse, json } from "@/lib/http";
import { jsonBody } from "@/lib/grid/body";
import { gridContext } from "@/lib/grid/context";
import { governedImport } from "@/lib/grid/import";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/aip/workbook/changes — a workbook import made while the runtime shows governed data:
 * {id, sheets: {<sheet>: {after: rows, before: rows}}}, written as one change set (source "import").
 */
export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const body = await jsonBody(req, 8 * 1024 * 1024);
    const ctx = await gridContext();
    return json(await governedImport(body, ctx.membership, ctx.current, ctx.changes));
  } catch (err) {
    return errorResponse(err);
  }
}
