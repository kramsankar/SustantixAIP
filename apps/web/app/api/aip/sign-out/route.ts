import { cookies } from "next/headers";
import { errorResponse, noContent } from "@/lib/http";
import { guard } from "@/lib/server";
import { userClient } from "@/lib/supabase/server";
import { TENANT_COOKIE } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Always permitted (even without a license): ending a session only reduces access. */
export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const db = await userClient();
    await db.auth.signOut({ scope: "local" }).catch(() => undefined);
    (await cookies()).delete(TENANT_COOKIE);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
