import { beforeAll, describe, expect, it } from "vitest";
import {
  CLOCK_WRITE_INTERVAL_SEC,
  computeVerdict,
  peekLicenseId,
  shouldPersistClock,
  VerdictCache,
  type LicenseDeps,
} from "../lib/license";
import { DAY, issue, MemoryClockStore, revocationFor, T0, testKey } from "./helpers";

function deps(token: string | undefined, over: Partial<LicenseDeps> = {}): LicenseDeps & { clockStore: MemoryClockStore } {
  const clockStore = new MemoryClockStore();
  return { token, revocationToken: undefined, trustedKeys: [testKey().publicJwk], clockStore, now: () => T0, ...over } as LicenseDeps & {
    clockStore: MemoryClockStore;
  };
}

describe("server license verdict", () => {
  beforeAll(() => {
    testKey();
  });

  it("grants full access for a valid domain-bound license", async () => {
    const d = deps(issue());
    const s = await computeVerdict("aip.example.com", d);
    expect(s.state).toBe("valid");
    expect(s.access).toBe("full");
    expect(s.license?.customer.name).toBe("Test Customer");
    expect(d.clockStore.writes).toHaveLength(1);
    expect(d.clockStore.writes[0]).toMatchObject({ firstSeen: T0, lastSeen: T0, verdict: "valid" });
  });

  it("matches the domain case-insensitively", async () => {
    const s = await computeVerdict("AIP.Example.COM", deps(issue()));
    expect(s.state).toBe("valid");
  });

  it("refuses a host that is not licensed", async () => {
    const s = await computeVerdict("evil.example.net", deps(issue()));
    expect(s.state).toBe("binding_mismatch");
    expect(s.access).toBe("none");
    expect(s.reason).toContain("evil.example.net");
  });

  it("refuses a license issued for another platform", async () => {
    const s = await computeVerdict("aip.example.com", deps(issue({ platform: "powerplatform" })));
    expect(s.state).toBe("platform_mismatch");
    expect(s.access).toBe("none");
  });

  it("reports expired after the validity window and grace", async () => {
    const token = issue({ validDays: 30, graceDays: 7 }, T0 - 60 * DAY);
    const s = await computeVerdict("aip.example.com", deps(token));
    expect(s.state).toBe("expired");
    expect(s.access).toBe("none");
  });

  it("grants read-only access during grace", async () => {
    const token = issue({ validDays: 30, graceDays: 7 }, T0 - 32 * DAY);
    const s = await computeVerdict("aip.example.com", deps(token));
    expect(s.state).toBe("grace");
    expect(s.access).toBe("read_only");
  });

  it("fails closed without a key", async () => {
    const s = await computeVerdict("aip.example.com", deps(undefined));
    expect(s.state).toBe("no_license");
    expect(s.access).toBe("none");
  });

  it("fails closed with no trusted keys (the shipped default)", async () => {
    const s = await computeVerdict("aip.example.com", deps(issue(), { trustedKeys: [] }));
    expect(s.state).toBe("no_trusted_keys");
    expect(s.access).toBe("none");
  });

  it("rejects a tampered token", async () => {
    const [p, kid, body, sig] = issue().split(".");
    const forged = JSON.parse(Buffer.from(body!, "base64url").toString());
    forged.bind.domains = ["evil.example.net"];
    const token = [p, kid, Buffer.from(JSON.stringify(forged)).toString("base64url"), sig].join(".");
    const s = await computeVerdict("evil.example.net", deps(token));
    expect(s.state).toBe("invalid_signature");
  });

  it("honours a signed revocation list", async () => {
    const token = issue({ lid: "lic-revoked-1" });
    const s = await computeVerdict("aip.example.com", deps(token, { revocationToken: revocationFor(["lic-revoked-1"]) }));
    expect(s.state).toBe("revoked");
  });

  it("detects clock rollback against persisted memory", async () => {
    const token = issue({ lid: "lic-clock-1" });
    const d = deps(token);
    d.clockStore.rows.set("lic-clock-1", { lid: "lic-clock-1", firstSeen: T0, lastSeen: T0 + 10 * DAY, verdict: "valid" });
    const s = await computeVerdict("aip.example.com", d);
    expect(s.state).toBe("clock_tamper");
    expect(d.clockStore.writes).toHaveLength(0);
  });

  it("still verifies when clock memory is unavailable", async () => {
    const warnings: string[] = [];
    const d = deps(issue(), { warn: (m) => warnings.push(m) });
    d.clockStore.failReads = true;
    const s = await computeVerdict("aip.example.com", d);
    expect(s.state).toBe("valid");
    expect(warnings.join()).toMatch(/clock read failed/);
  });

  it("throttles clock memory writes to at most hourly", async () => {
    const token = issue({ lid: "lic-throttle" });
    let now = T0;
    const d = deps(token, { now: () => now });
    await computeVerdict("aip.example.com", d);
    expect(d.clockStore.writes).toHaveLength(1);

    now = T0 + 300;
    await computeVerdict("aip.example.com", d);
    now = T0 + CLOCK_WRITE_INTERVAL_SEC - 1;
    await computeVerdict("aip.example.com", d);
    expect(d.clockStore.writes).toHaveLength(1);

    now = T0 + CLOCK_WRITE_INTERVAL_SEC;
    await computeVerdict("aip.example.com", d);
    expect(d.clockStore.writes).toHaveLength(2);
    expect(d.clockStore.writes[1]).toMatchObject({ firstSeen: T0, lastSeen: T0 + CLOCK_WRITE_INTERVAL_SEC });
  });

  it("writes immediately when the verdict changes", () => {
    const prev = { lid: "a", firstSeen: 1, lastSeen: 100, verdict: "valid" };
    expect(shouldPersistClock(prev, { ...prev, lastSeen: 101, verdict: "grace" })).toBe(true);
    expect(shouldPersistClock(prev, { ...prev, lastSeen: 101 })).toBe(false);
    expect(shouldPersistClock(null, prev)).toBe(true);
  });
});

describe("peekLicenseId", () => {
  it("extracts the lid without verifying", () => {
    expect(peekLicenseId(issue({ lid: "lic-peek" }))).toBe("lic-peek");
  });
  it("tolerates garbage", () => {
    expect(peekLicenseId(undefined)).toBeNull();
    expect(peekLicenseId("SXL1.k.!!!.x")).toBeNull();
    expect(peekLicenseId("not-a-token")).toBeNull();
  });
});

describe("VerdictCache", () => {
  const ok = { state: "valid", access: "full", reason: "" } as const;

  it("caches per hostname for five minutes", async () => {
    const c = new VerdictCache();
    let calls = 0;
    const compute = async () => (calls++, { ...ok });
    await c.get("a", 1000, false, compute);
    await c.get("a", 1299, false, compute);
    expect(calls).toBe(1);
    await c.get("b", 1299, false, compute);
    expect(calls).toBe(2);
    await c.get("a", 1300, false, compute);
    expect(calls).toBe(3);
  });

  it("recomputes on refresh, but not more often than the refresh floor", async () => {
    const c = new VerdictCache(300, 10);
    let calls = 0;
    const compute = async () => (calls++, { ...ok });
    await c.get("a", 1000, false, compute);
    await c.get("a", 1005, true, compute);
    expect(calls).toBe(1);
    await c.get("a", 1010, true, compute);
    expect(calls).toBe(2);
  });

  it("does not cache failures", async () => {
    const c = new VerdictCache();
    await expect(c.get("a", 1, false, async () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    const s = await c.get("a", 1, false, async () => ({ ...ok }));
    expect(s.access).toBe("full");
  });
});
