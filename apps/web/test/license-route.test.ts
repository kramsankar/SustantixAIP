import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./fake-db";
import { DAY, issue, testKey } from "./helpers";

/**
 * GET /api/aip/license end-to-end through the real route handler, verdict cache and
 * Supabase clock store — with an ephemeral trusted key and an in-memory database.
 */
const db = new FakeDb();

vi.mock("../lib/trusted-keys", () => ({ TRUSTED_KEYS: [testKey().publicJwk] }));
vi.mock("../lib/supabase/admin", () => ({ adminClient: () => db }));

const saved = { ...process.env };

async function route() {
  return import("../app/api/aip/license/route");
}

function get(host: string, query = "", extra: Record<string, string> = {}) {
  return new Request(`https://${host}/api/aip/license${query}`, { headers: { host, ...extra } });
}

describe("GET /api/aip/license", () => {
  beforeAll(() => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: "https://unit-test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-for-unit-tests-only",
      SUPABASE_SERVICE_ROLE_KEY: "service-key-for-unit-tests-only",
    });
  });

  afterAll(() => {
    process.env = saved;
  });

  beforeEach(async () => {
    vi.resetModules();
    db.tables.clear();
    db.calls.length = 0;
    delete process.env.VERCEL;
    delete process.env.AIP_LICENSE_REVOCATION;
    const { resetServerEnvCache } = await import("../lib/env");
    resetServerEnvCache();
    const { verdictCache } = await import("../lib/license");
    verdictCache().clear();
  });

  it("returns a full-access verdict for the licensed domain and records clock memory", async () => {
    process.env.AIP_LICENSE_KEY = issue({ lid: "route-valid" }, Math.floor(Date.now() / 1000));
    const res = await (await route()).GET(get("aip.example.com"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    expect(body).toMatchObject({ state: "valid", access: "full" });
    const clock = db.table("license_clock");
    expect(clock).toHaveLength(1);
    expect(clock[0]).toMatchObject({ lid: "route-valid", verdict: "valid" });
  });

  it("strips the port before matching the domain", async () => {
    process.env.AIP_LICENSE_KEY = issue({}, Math.floor(Date.now() / 1000));
    const body = await (await (await route()).GET(get("aip.example.com:3000"))).json();
    expect(body.state).toBe("valid");
  });

  it("refuses another domain", async () => {
    process.env.AIP_LICENSE_KEY = issue({}, Math.floor(Date.now() / 1000));
    const body = await (await (await route()).GET(get("copy.example.org"))).json();
    expect(body).toMatchObject({ state: "binding_mismatch", access: "none" });
  });

  it("ignores a forged x-forwarded-host off Vercel, honours it on Vercel", async () => {
    process.env.AIP_LICENSE_KEY = issue({}, Math.floor(Date.now() / 1000));
    const forged = get("copy.example.org", "", { "x-forwarded-host": "aip.example.com" });
    expect((await (await (await route()).GET(forged)).json()).state).toBe("binding_mismatch");

    vi.resetModules();
    process.env.VERCEL = "1";
    const onVercel = get("deployment-abc.vercel.app", "", { "x-forwarded-host": "aip.example.com" });
    expect((await (await (await route()).GET(onVercel)).json()).state).toBe("valid");
  });

  it("reports expired licenses", async () => {
    process.env.AIP_LICENSE_KEY = issue({ validDays: 10 }, Math.floor(Date.now() / 1000) - 40 * DAY);
    const body = await (await (await route()).GET(get("aip.example.com"))).json();
    expect(body).toMatchObject({ state: "expired", access: "none" });
  });

  it("fails closed with no key installed", async () => {
    delete process.env.AIP_LICENSE_KEY;
    const body = await (await (await route()).GET(get("aip.example.com"))).json();
    expect(body).toMatchObject({ state: "no_license", access: "none" });
    expect(db.calls).not.toContain("license_clock.select");
  });

  it("caches the verdict and bypasses the cache on ?refresh=1", async () => {
    process.env.AIP_LICENSE_KEY = issue({ lid: "route-cache" }, Math.floor(Date.now() / 1000));
    const r = await route();
    await r.GET(get("aip.example.com"));
    await r.GET(get("aip.example.com"));
    expect(db.calls.filter((c) => c === "license_clock.select")).toHaveLength(1);

    vi.useFakeTimers({ now: Date.now() + 11_000, toFake: ["Date"] });
    try {
      await r.GET(get("aip.example.com", "?refresh=1"));
    } finally {
      vi.useRealTimers();
    }
    expect(db.calls.filter((c) => c === "license_clock.select")).toHaveLength(2);
    // Refreshed within the hour: clock memory is not rewritten.
    expect(db.calls.filter((c) => c === "license_clock.upsert")).toHaveLength(1);
  });

  it("answers 503 (without leaking names of secrets' values) when Supabase env is missing", async () => {
    process.env.AIP_LICENSE_KEY = issue({}, Math.floor(Date.now() / 1000));
    const keep = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const res = await (await route()).GET(get("aip.example.com"));
      expect(res.status).toBe(503);
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = keep;
    }
  });

  it("rejects a malformed Host header", async () => {
    const res = await (await route()).GET(new Request("https://x/api/aip/license", { headers: { host: "bad host" } }));
    expect(res.status).toBe(400);
  });
});
