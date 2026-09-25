// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { normalizeServerVerdict } from "../src/adapters/powerapps.js";
import { resolveLicense } from "../src/license-gate.js";
import type { HostAdapter } from "../src/types.js";

const base: HostAdapter = {
  name: "standalone",
  async init() {},
  async environment() {
    return { platform: "vercel", hostname: "localhost" };
  },
  async trustedNow() {
    return 1_790_000_000;
  },
  async signIn() {
    return true;
  },
};

describe("license resolution", () => {
  it("prefers the server verdict over any client token", async () => {
    const s = await resolveLicense({ ...base, serverVerdict: async () => ({ state: "valid", access: "full", reason: "server" }), licenseToken: async () => "garbage" }, []);
    expect(s.reason).toBe("server");
  });
  it("fails closed when the license service is unreachable", async () => {
    const s = await resolveLicense({ ...base, serverVerdict: async () => { throw new Error("503"); } }, []);
    expect(s.access).toBe("none");
  });
  it("fails closed without trusted keys on the client path", async () => {
    const s = await resolveLicense({ ...base, licenseToken: async () => "SXL1.a.b.c" }, []);
    expect(s.state).toBe("no_trusted_keys");
  });
});

describe("Dataverse verdict normalisation", () => {
  it("maps the plug-in's flat JSON onto LicenseStatus", () => {
    const s = normalizeServerVerdict({ state: "valid", access: "full", reason: "trial active", lid: "L1", edition: "trial", customer: "Demo IPP", modules: ["portfolio"], daysRemaining: 12, expiresAt: "2026-10-07T00:00:00.000Z", fingerprint: "ABCD" });
    expect(s.license?.edition).toBe("trial");
    expect(s.license?.modules).toEqual(["portfolio"]);
    expect(s.daysRemaining).toBe(12);
  });
  it("keeps unlicensed verdicts minimal", () => {
    expect(normalizeServerVerdict({ state: "no_license", access: "none", reason: "no license key installed" })).toEqual({ state: "no_license", access: "none", reason: "no license key installed" });
  });
});
