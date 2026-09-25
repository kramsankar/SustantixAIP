import { identityOf } from "@/lib/auth";
import { errorResponse, json } from "@/lib/http";
import { guard } from "@/lib/server";
import { userClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signed-in identity, or JSON null. getUser() re-validates the token with Supabase Auth. */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const db = await userClient();
    const { data, error } = await db.auth.getUser();
    return json(error ? null : identityOf(data.user));
  } catch (err) {
    return errorResponse(err);
  }
}
