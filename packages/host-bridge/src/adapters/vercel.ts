import type { LicenseStatus, RuntimeEnvironment } from "@sustantix/license";
import type { HostAdapter, Identity, RuntimeState } from "../types.js";

export async function gzipJson(value: unknown): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Vercel / Next.js host. Identity (Supabase Auth), license verdict and tenant state
 * are all server-side; the browser only holds an HttpOnly session cookie.
 */
export function vercelAdapter(apiBase = "/api/aip"): HostAdapter {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(apiBase + path, {
      credentials: "same-origin",
      ...init,
      headers: { "content-type": "application/json", "x-aip-client": "runtime", ...(init?.headers as Record<string, string> | undefined) },
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
      // Gzip keeps large workbook snapshots under the platform request-body limit (4.5 MB on Vercel).
      save: async (state) => {
        const body = await gzipJson(state);
        await call<void>("/state", { method: "PUT", body, headers: { "content-type": "application/json", "content-encoding": "gzip", "x-aip-client": "runtime" } });
      },
      clear: () => call<void>("/state", { method: "DELETE" }),
    },
  };
}
