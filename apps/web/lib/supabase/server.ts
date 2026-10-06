import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serverEnv } from "../env";

/**
 * Session cookies are always HttpOnly, Secure and SameSite=Lax: the browser runtime never
 * touches Supabase directly, it only calls /api/aip/*. (Browsers accept Secure cookies on
 * http://localhost, so local development works unchanged.)
 */
export function hardenCookie(options: CookieOptions = {}): CookieOptions {
  return { ...options, httpOnly: true, secure: true, sameSite: "lax", path: "/" };
}

/** User-scoped client: every query runs as the signed-in user, so RLS applies. */
export async function userClient(): Promise<SupabaseClient<any, "aip", "aip">> {
  const env = serverEnv();
  const store = await cookies();
  return createServerClient<any, "aip">(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "aip" },
    cookieOptions: hardenCookie(),
    cookies: {
      getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, hardenCookie(options));
      },
    },
  }) as unknown as SupabaseClient<any, "aip", "aip">;
}
