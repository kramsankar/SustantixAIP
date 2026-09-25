import type { LicenseStatus, RuntimeEnvironment } from "@sustantix/license";
import type { HostAdapter, Identity, RuntimeState } from "../types.js";

/**
 * Vercel / Next.js host. Identity (Supabase Auth), license verdict and tenant state
 * are all server-side; the browser only holds an HttpOnly session cookie.
 */
export function vercelAdapter(apiBase = "/api/aip"): HostAdapter {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(apiBase + path, {
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-aip-client": "runtime" },
      ...init,
    });
    if (res.status === 204) return undefined as T;
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return (await res.json()) as T;
  };

  return {
    name: "vercel",
    async init() {},
    async environment(): Promise<RuntimeEnvironment> {
      return { platform: "vercel", hostname: location.hostname };
    },
    async serverVerdict(refresh) {
      return call<LicenseStatus>("/license" + (refresh ? "?refresh=1" : ""));
    },
    async trustedNow() {
      const { now } = await call<{ now: number }>("/time");
      return now;
    },
    async ssoIdentity() {
      try {
        return await call<Identity | null>("/session");
      } catch {
        return null;
      }
    },
    async signIn(login, secret) {
      try {
        const r = await call<{ ok: boolean }>("/sign-in", { method: "POST", body: JSON.stringify({ email: login, password: secret }) });
        return !!r?.ok;
      } catch {
        return false;
      }
    },
    async signOut() {
      await call("/sign-out", { method: "POST" });
    },
    persistence: {
      load: () => call<RuntimeState | undefined>("/state"),
      save: (state) => call<void>("/state", { method: "PUT", body: JSON.stringify(state) }),
      clear: () => call<void>("/state", { method: "DELETE" }),
    },
  };
}
