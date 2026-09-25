import type { Access, LicenseStatus } from "@sustantix/license";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guardRequest, permits, requirementFor } from "../lib/gate";

const status = (access: Access): LicenseStatus => ({
  state: access === "full" ? "valid" : access === "read_only" ? "grace" : "expired",
  access,
  reason: `reason-${access}`,
});

async function call(method: string, path: string, access: Access, extra: Record<string, string> = {}) {
  const h = new Headers({ host: "aip.example.com", origin: "https://aip.example.com", ...extra });
  const verdict = vi.fn(async () => status(access));
  const res = await guardRequest({ pathname: path, method, headers: h, host: "aip.example.com" }, { verdict });
  return { res, verdict };
}

describe("license gate policy", () => {
  it("classifies endpoints", () => {
    expect(requirementFor("/api/aip/license", "GET")).toBe("open");
    expect(requirementFor("/api/aip/time", "GET")).toBe("open");
    expect(requirementFor("/api/aip/session", "GET")).toBe("open");
    expect(requirementFor("/api/aip/session/", "GET")).toBe("open");
    expect(requirementFor("/api/aip/sign-out", "POST")).toBe("open");
    expect(requirementFor("/api/aip/sign-in", "POST")).toBe("readable");
    expect(requirementFor("/api/aip/state", "GET")).toBe("readable");
    expect(requirementFor("/api/aip/state", "PUT")).toBe("writable");
    expect(requirementFor("/api/aip/state", "DELETE")).toBe("writable");
    expect(requirementFor("/api/aip/anything-new", "GET")).toBe("readable");
    expect(requirementFor("/api/aip/licenses", "GET")).toBe("readable");
  });

  it("maps access to permissions", () => {
    expect(permits("open", "none")).toBe(true);
    expect(permits("readable", "read_only")).toBe(true);
    expect(permits("readable", "none")).toBe(false);
    expect(permits("writable", "read_only")).toBe(false);
    expect(permits("writable", "full")).toBe(true);
  });
});

describe("guardRequest", () => {
  const gated: Array<[string, string]> = [
    ["GET", "/api/aip/state"],
    ["PUT", "/api/aip/state"],
    ["DELETE", "/api/aip/state"],
    ["POST", "/api/aip/sign-in"],
  ];

  for (const [method, path] of gated) {
    it(`${method} ${path} → 402 when access is none`, async () => {
      const { res } = await call(method, path, "none");
      expect(res?.status).toBe(402);
      const body = await res!.json();
      expect(body).toMatchObject({ error: "license_required", access: "none", state: "expired" });
      expect(res!.headers.get("cache-control")).toContain("no-store");
    });
  }

  for (const path of ["/api/aip/license", "/api/aip/time", "/api/aip/session"]) {
    it(`GET ${path} is reachable without a license and skips the verdict`, async () => {
      const { res, verdict } = await call("GET", path, "none");
      expect(res).toBeNull();
      expect(verdict).not.toHaveBeenCalled();
    });
  }

  it("grace (read-only) allows reads but refuses writes", async () => {
    expect((await call("GET", "/api/aip/state", "read_only")).res).toBeNull();
    for (const m of ["PUT", "DELETE"]) {
      const { res } = await call(m, "/api/aip/state", "read_only");
      expect(res?.status).toBe(402);
      expect((await res!.json()).reason).toMatch(/read-only/);
    }
  });

  it("full access allows everything", async () => {
    for (const [method, path] of gated) expect((await call(method, path, "full")).res).toBeNull();
  });

  it("refuses cross-origin writes before consulting the license", async () => {
    const { res, verdict } = await call("PUT", "/api/aip/state", "full", { origin: "https://evil.example" });
    expect(res?.status).toBe(403);
    expect(verdict).not.toHaveBeenCalled();
  });

  it("refuses a missing host", async () => {
    const res = await guardRequest({ pathname: "/api/aip/state", method: "GET", headers: new Headers(), host: null }, { verdict: async () => status("full") });
    expect(res?.status).toBe(400);
  });

  it("returns 503 when the verdict cannot be computed", async () => {
    const res = await guardRequest(
      { pathname: "/api/aip/state", method: "GET", headers: new Headers(), host: "aip.example.com" },
      { verdict: async () => Promise.reject(new Error("env")) },
    );
    expect(res?.status).toBe(503);
  });

  it("passes the port-stripped hostname to the verdict", async () => {
    const verdict = vi.fn(async () => status("full"));
    await guardRequest({ pathname: "/api/aip/state", method: "GET", headers: new Headers(), host: "aip.example.com:8443" }, { verdict });
    expect(verdict).toHaveBeenCalledWith("aip.example.com");
  });
});

describe("Next.js middleware", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../lib/server");
  });

  async function loadMiddleware(access: Access) {
    vi.doMock("../lib/server", async () => {
      const host = await import("../lib/host");
      return {
        currentHost: (req: Request) => host.requestHost(req.headers, false),
        serverLicenseVerdict: vi.fn(async () => status(access)),
      };
    });
    return (await import("../middleware")).middleware;
  }

  const req = (method: string, path: string, origin = "https://aip.example.com") =>
    new NextRequest(`https://aip.example.com${path}`, { method, headers: { host: "aip.example.com", origin } });

  it("returns 402 for gated endpoints when unlicensed and passes open ones", async () => {
    const mw = await loadMiddleware("none");
    expect((await mw(req("GET", "/api/aip/state"))).status).toBe(402);
    expect((await mw(req("POST", "/api/aip/sign-in"))).status).toBe(402);
    const open = await mw(req("GET", "/api/aip/license"));
    expect(open.headers.get("x-middleware-next")).toBe("1");
  });

  it("returns 402 for writes during grace and 403 for cross-origin writes", async () => {
    const mw = await loadMiddleware("read_only");
    expect((await mw(req("PUT", "/api/aip/state"))).status).toBe(402);
    expect((await mw(req("GET", "/api/aip/state"))).headers.get("x-middleware-next")).toBe("1");
    expect((await mw(req("DELETE", "/api/aip/state", "https://evil.example"))).status).toBe(403);
  });

  it("declares the Node.js runtime and the API matcher", async () => {
    vi.doMock("../lib/server", () => ({ currentHost: () => null, serverLicenseVerdict: vi.fn() }));
    const { config } = await import("../middleware");
    expect(config).toEqual({ matcher: ["/api/:path*"], runtime: "nodejs" });
  });
});
