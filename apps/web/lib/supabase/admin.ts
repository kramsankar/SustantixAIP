import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "../env";

/**
 * Service-role client. Bypasses RLS — used only for the license clock memory and for
 * appending audit rows (authenticated users have no INSERT grant on aip.audit_log).
 * Never used to read or write tenant data on a user's behalf.
 */
let admin: SupabaseClient<any, "aip", "aip"> | undefined;

export function adminClient(): SupabaseClient<any, "aip", "aip"> {
  if (!admin) {
    const env = serverEnv();
    admin = createClient<any, "aip">(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      db: { schema: "aip" },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-client-info": "sustantix-aip-web" } },
    });
  }
  return admin;
}
