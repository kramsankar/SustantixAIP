import type { RuntimeEnvironment } from "@sustantix/license";
import type { HostAdapter } from "../types.js";

export const STANDALONE_LICENSE_KEY = "sx_aip_license";

/**
 * Offline evaluation host (sales demos, local QA). The signed license — bound to the
 * serving hostname — is the only gate; identity is not federated in this mode, so it
 * must not be used for customer production data.
 */
export function standaloneAdapter(): HostAdapter {
  return {
    name: "standalone",
    async init() {},
    async environment(): Promise<RuntimeEnvironment> {
      return { platform: "vercel", hostname: location.hostname || "localhost" };
    },
    async licenseToken() {
      try {
        return localStorage.getItem(STANDALONE_LICENSE_KEY);
      } catch {
        return null;
      }
    },
    async trustedNow() {
      return Math.floor(Date.now() / 1000);
    },
    async signIn(login, secret) {
      return login.trim().length > 0 && secret.length > 0;
    },
  };
}
