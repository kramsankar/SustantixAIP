import { MAX_SIGN_IN_BODY, signIn } from "@/lib/auth";
import { trustProxyHeaders } from "@/lib/env";
import { clientIp } from "@/lib/host";
import { errorResponse, readBody } from "@/lib/http";
import { signInLimiter } from "@/lib/rate-limit";
import { guard } from "@/lib/server";
import { userClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const raw = await readBody(req, MAX_SIGN_IN_BODY);
    let body: unknown;
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      body = undefined;
    }
    const db = await userClient();
    return await signIn(body, {
      limiter: signInLimiter(),
      clientIp: clientIp(req.headers, trustProxyHeaders()),
      auth: {
        async signInWithPassword(email, password) {
          const { data, error } = await db.auth.signInWithPassword({ email, password });
          return !error && !!data.session;
        },
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
