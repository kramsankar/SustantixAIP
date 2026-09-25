import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifyLicense, verifyRevocationList } from "../src/verify.js";
import type { ClockState, TrustedKey } from "../src/types.js";

// Shared with the Dataverse plug-in tests: both verifiers must agree on every case.
const dir = new URL("../../../powerplatform/plugins/Sustantix.Aip.Licensing.Tests/fixtures/", import.meta.url);
const keys: TrustedKey[] = JSON.parse(readFileSync(new URL("trusted-keys.json", dir), "utf8"));
const cases: Array<{ name: string; token: string; org: string; now: number; expect: string; access: string; days?: number; revocation?: string; clock?: ClockState }> =
  JSON.parse(readFileSync(new URL("cases.json", dir), "utf8"));

describe("SXL1 cross-language conformance (TypeScript side)", () => {
  for (const c of cases) {
    it(c.name, async () => {
      const revocation = await verifyRevocationList(c.revocation, keys);
      const { status } = await verifyLicense(c.token, { trustedKeys: keys, environment: { platform: "powerplatform", orgId: c.org }, now: c.now, clock: c.clock ?? null, revocation });
      expect(status.state).toBe(c.expect);
      expect(status.access).toBe(c.access);
      if (c.days !== undefined) expect(status.daysRemaining).toBe(c.days);
    });
  }
});
