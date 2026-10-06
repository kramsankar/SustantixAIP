import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { licensedHost, requireCron } from "../lib/cron";
import { resetServerEnvCache } from "../lib/env";
import { requirementFor } from "../lib/gate";
import { allowedUrl, deliverDue, privateAddress, sign, type Destination, type OutboxDeps, type OutboxEvent } from "../lib/outbox/deliver";
import { createDestination, type DestinationStore } from "../lib/outbox/destinations";
import type { Membership } from "../lib/tenant";

const event = (id: number, destination = "d1"): OutboxEvent => ({
  id,
  event_id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  destination_id: destination,
  kind: "change",
  event: "work_order.update",
  entity: "work_order",
  code: `WO-${id}`,
  payload: { record: { code: `WO-${id}`, sla_hours: 4 } },
  attempts: 1,
  created_at: "2026-10-06T00:00:00Z",
});

function harness(over: Partial<OutboxDeps> & { destinations?: Record<string, Destination | null>; status?: number; addresses?: string[] } = {}) {
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const completed: Array<{ id: number; ok: boolean; error: string | null }> = [];
  const lookups: string[] = [];
  const deps: OutboxDeps = {
    claim: async () => [event(1), event(2)],
    complete: async (id, ok, error) => void completed.push({ id, ok, error }),
    destination: async (id) => {
      lookups.push(id);
      return (over.destinations ?? { d1: { url: "https://erp.example.com/hooks/aip", secret: "s".repeat(43), enabled: true } })[id] ?? null;
    },
    resolve: async () => over.addresses ?? ["203.0.113.10"],
    fetch: (async (url: URL | string, init?: RequestInit) => {
      sent.push({ url: String(url), init: init! });
      return new Response(null, { status: over.status ?? 204 });
    }) as typeof fetch,
    now: () => 1_791_244_800_000,
    ...over,
  };
  return { deps, sent, completed, lookups };
}

describe("outbox delivery", () => {
  it("signs t.<body> with the destination secret, in the header receivers verify", () => {
    const sig = sign("k".repeat(32), '{"a":1}', 1_700_000_000);
    const want = createHmac("sha256", "k".repeat(32)).update('1700000000.{"a":1}').digest("hex");
    expect(sig).toBe(`t=1700000000,v1=${want}`);
  });

  it("refuses private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])
      expect(privateAddress(ip), ip).toBe(true);
    for (const ip of ["203.0.113.10", "172.32.0.1", "8.8.8.8", "2001:db8::1", "::ffff:8.8.8.8"]) expect(privateAddress(ip), ip).toBe(false);
  });

  it("accepts only https URLs on public host names", () => {
    expect(allowedUrl("https://erp.example.com/hooks")?.hostname).toBe("erp.example.com");
    expect(allowedUrl("https://erp.example.com:443/x")).not.toBeNull();
    for (const bad of ["http://erp.example.com/x", "https://user:pw@erp.example.com/", "https://erp.example.com:8443/", "https://localhost/x", "https://svc.internal/x", "https://printer.local/", "https://intranet/", "https://10.0.0.5/x", "https://[::1]/x", "ftp://erp.example.com", "not a url"])
      expect(allowedUrl(bad), bad).toBeNull();
  });

  it("delivers each event signed, with its id as the idempotency key and redirects not followed", async () => {
    const h = harness();
    expect(await deliverDue(h.deps)).toEqual({ delivered: 2, failed: 0 });
    expect(h.lookups).toEqual(["d1"]); // one lookup per destination per run
    const first = h.sent[0]!;
    const headers = first.init.headers as Record<string, string>;
    expect(first.init.redirect).toBe("manual");
    expect(headers["idempotency-key"]).toBe(event(1).event_id);
    const body = String(first.init.body);
    expect(headers["x-sustantix-signature"]).toBe(sign("s".repeat(43), body, 1_791_244_800));
    expect(JSON.parse(body)).toMatchObject({ id: event(1).event_id, event: "work_order.update", code: "WO-1", attempt: 1, data: { record: { sla_hours: 4 } } });
    expect(h.completed).toEqual([
      { id: 1, ok: true, error: null },
      { id: 2, ok: true, error: null },
    ]);
  });

  it("records a failure for a non-2xx answer, a redirect, a private resolution or a removed destination", async () => {
    for (const [over, error] of [
      [{ status: 500 }, "HTTP 500"],
      [{ status: 302 }, "HTTP 302"],
      [{ addresses: ["203.0.113.10", "10.0.0.7"] }, "destination resolves to a private address"],
      [{ addresses: [] }, "destination resolves to a private address"],
      [{ destinations: {} }, "destination disabled or removed"],
      [{ destinations: { d1: { url: "https://erp.example.com/", secret: "x".repeat(32), enabled: false } } }, "destination disabled or removed"],
      [{ destinations: { d1: { url: "http://erp.example.com/", secret: "x".repeat(32), enabled: true } } }, "destination URL is not an allowed https address"],
    ] as const) {
      const h = harness(over as never);
      expect(await deliverDue(h.deps)).toEqual({ delivered: 0, failed: 2 });
      expect(h.completed.map((c) => c.error)).toEqual([error, error]);
      if ("addresses" in over || "destinations" in over) expect(h.sent).toHaveLength(0);
    }
  });

  it("keeps going when one event's send throws", async () => {
    let n = 0;
    const h = harness({
      fetch: (async () => {
        if (++n === 1) throw new Error("connection reset");
        return new Response(null, { status: 200 });
      }) as typeof fetch,
    });
    expect(await deliverDue(h.deps)).toEqual({ delivered: 1, failed: 1 });
    expect(h.completed[0]).toEqual({ id: 1, ok: false, error: "connection reset" });
  });
});

describe("outbox destinations", () => {
  const admin: Membership = { tenantId: "t", role: "admin", createdAt: "" };
  const planner: Membership = { tenantId: "t", role: "planner", createdAt: "" };
  const store = (): DestinationStore & { secrets: string[] } => {
    const secrets: string[] = [];
    return { secrets, create: async (_t, _u, _v, secret) => (secrets.push(secret), { id: "d1" }) };
  };

  it("lets administrators create one, and returns the secret once", async () => {
    const s = store();
    const out = await createDestination({ name: "ERP", url: "https://erp.example.com/hooks", events: ["proposal"] }, admin, "u", s);
    expect(out).toMatchObject({ id: "d1", name: "ERP", events: ["proposal"], entities: [] });
    expect(out.secret).toBe(s.secrets[0]);
    expect(out.secret.length).toBeGreaterThanOrEqual(32);
  });

  it("refuses non-administrators and URLs the worker would not call", async () => {
    await expect(createDestination({ name: "ERP", url: "https://erp.example.com/" }, planner, "u", store())).rejects.toMatchObject({ status: 403 });
    for (const url of ["http://erp.example.com/", "https://169.254.169.254/latest", "https://localhost/"])
      await expect(createDestination({ name: "ERP", url }, admin, "u", store())).rejects.toMatchObject({ status: 400, code: "invalid_destination" });
    await expect(createDestination({ name: "ERP", url: "https://erp.example.com/", secret: "mine" }, admin, "u", store())).rejects.toMatchObject({ status: 400 });
  });

  it("gates destination changes as writes", () => {
    expect(requirementFor("/api/aip/outbox/destinations", "POST")).toBe("writable");
    expect(requirementFor("/api/aip/grid/outbox/actions/retry", "POST")).toBe("writable");
    // The scheduler route authenticates and licenses itself (requireCron, requireCronLicense).
    expect(requirementFor("/api/aip/cron/outbox", "GET")).toBe("open");
  });
});

describe("scheduler authentication", () => {
  const env = (cron?: string) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://unit-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-for-unit-tests-only");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key-for-unit-tests-only");
    vi.stubEnv("CRON_SECRET", cron ?? "");
    resetServerEnvCache();
  };
  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });
  const req = (auth?: string) => new Request("https://aip.example.com/api/aip/cron/outbox", auth ? { headers: { authorization: auth } } : {});

  it("answers only the scheduler's bearer secret", () => {
    env("c".repeat(40));
    expect(() => requireCron(req(`Bearer ${"c".repeat(40)}`))).not.toThrow();
    expect(() => requireCron(req(`Bearer ${"c".repeat(39)}d`))).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => requireCron(req())).toThrow(expect.objectContaining({ status: 401 }));
  });

  it("is closed when no secret is configured", () => {
    env();
    expect(() => requireCron(req(`Bearer ${"c".repeat(40)}`))).toThrow(expect.objectContaining({ status: 503 }));
  });
});

describe("scheduled runs and the license", () => {
  const token = (payload: unknown) => `SXL1.k1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
  it("are licensed against the domain the deployment's key binds", () => {
    expect(licensedHost(token({ bind: { domains: ["AIP.Customer.example", "www.aip.customer.example"] } }))).toBe("aip.customer.example");
    expect(licensedHost(token({ bind: {} }))).toBe("localhost");
    expect(licensedHost(token({ bind: { domains: ["bad host/x"] } }))).toBe("localhost");
    expect(licensedHost("garbage")).toBe("localhost");
    expect(licensedHost(undefined)).toBe("localhost");
  });
});
