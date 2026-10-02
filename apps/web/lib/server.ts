import type { LicenseStatus } from "@sustantix/license";
import { serverEnv, trustProxyHeaders } from "./env";
import { guardRequest } from "./gate";
import { requestHost } from "./host";
import { computeVerdict, epochSeconds, verdictCache } from "./license";
import { adminClient } from "./supabase/admin";
import { SupabaseClockStore } from "./supabase/stores";
import { TRUSTED_KEYS } from "./trusted-keys";

/** Production wiring of the pure modules to env, Supabase and the process-wide caches. */

export function currentHost(req: Request): string | null {
  return requestHost(req.headers, trustProxyHeaders());
}

export async function serverLicenseVerdict(hostname: string, refresh = false): Promise<LicenseStatus> {
  return verdictCache().get(hostname, epochSeconds(), refresh, () => {
    const env = serverEnv();
    return computeVerdict(hostname, {
      token: env.AIP_LICENSE_KEY,
      revocationToken: env.AIP_LICENSE_REVOCATION,
      trustedKeys: TRUSTED_KEYS,
      clockStore: new SupabaseClockStore(adminClient()),
      now: epochSeconds,
      warn: (m) => console.warn(`[aip-web] ${m}`),
    });
  });
}

/** Route-level copy of the middleware gate (defence in depth if the matcher is ever bypassed). */
export async function guard(req: Request): Promise<Response | null> {
  return guardRequest(
    { pathname: new URL(req.url).pathname, method: req.method, headers: req.headers, host: currentHost(req) },
    { verdict: (h) => serverLicenseVerdict(h) },
  );
}
