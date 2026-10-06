import { describe, expect, it } from "vitest";
import { isSameOrigin } from "../lib/csrf";
import { clientIp, hostnameOf, requestHost } from "../lib/host";
import { headers } from "./helpers";

describe("CSRF origin check", () => {
  const host = "aip.example.com";

  it("lets safe methods through", () => {
    expect(isSameOrigin("GET", headers({ origin: "https://evil.example" }), host)).toBe(true);
    expect(isSameOrigin("HEAD", headers({}), host)).toBe(true);
  });

  it("accepts a matching Origin", () => {
    expect(isSameOrigin("POST", headers({ origin: "https://aip.example.com" }), host)).toBe(true);
    expect(isSameOrigin("PUT", headers({ origin: "https://AIP.example.com" }), host)).toBe(true);
    expect(isSameOrigin("DELETE", headers({ origin: "http://localhost:3000" }), "localhost:3000")).toBe(true);
  });

  it("refuses a foreign or sibling Origin", () => {
    expect(isSameOrigin("POST", headers({ origin: "https://evil.example" }), host)).toBe(false);
    expect(isSameOrigin("PUT", headers({ origin: "https://other.example.com" }), host)).toBe(false);
    expect(isSameOrigin("DELETE", headers({ origin: "https://aip.example.com.evil.io" }), host)).toBe(false);
    expect(isSameOrigin("POST", headers({ origin: "https://aip.example.com:8443" }), host)).toBe(false);
  });

  it("refuses opaque, malformed and non-http origins", () => {
    expect(isSameOrigin("POST", headers({ origin: "null" }), host)).toBe(false);
    expect(isSameOrigin("POST", headers({ origin: "not a url" }), host)).toBe(false);
    expect(isSameOrigin("POST", headers({ origin: "file://aip.example.com" }), host)).toBe(false);
  });

  it("falls back to Fetch Metadata only when Origin is absent", () => {
    expect(isSameOrigin("POST", headers({}), host)).toBe(false);
    expect(isSameOrigin("POST", headers({ "sec-fetch-site": "same-origin" }), host)).toBe(true);
    expect(isSameOrigin("POST", headers({ "sec-fetch-site": "same-site" }), host)).toBe(false);
  });

  it("refuses when the host is unknown", () => {
    expect(isSameOrigin("POST", headers({ origin: "https://aip.example.com" }), null)).toBe(false);
  });
});

describe("request host", () => {
  it("uses Host, lower-cased", () => {
    expect(requestHost(headers({ host: "AIP.Example.com:3000" }), false)).toBe("aip.example.com:3000");
  });

  it("ignores x-forwarded-host unless trusted (Vercel)", () => {
    const h = headers({ host: "internal.vercel.app", "x-forwarded-host": "aip.example.com" });
    expect(requestHost(h, false)).toBe("internal.vercel.app");
    expect(requestHost(h, true)).toBe("aip.example.com");
  });

  it("takes the first forwarded value and falls back to Host when it is invalid", () => {
    expect(requestHost(headers({ host: "h.example", "x-forwarded-host": "a.example, b.example" }), true)).toBe("a.example");
    expect(requestHost(headers({ host: "h.example", "x-forwarded-host": "bad host/" }), true)).toBe("h.example");
  });

  it("rejects malformed hosts", () => {
    expect(requestHost(headers({ host: "evil.com/path" }), false)).toBeNull();
    expect(requestHost(headers({ host: "a b" }), false)).toBeNull();
    expect(requestHost(headers({}), false)).toBeNull();
  });

  it("strips a trailing dot", () => {
    expect(requestHost(headers({ host: "aip.example.com." }), false)).toBe("aip.example.com");
  });

  it("strips the port for license binding", () => {
    expect(hostnameOf("aip.example.com:443")).toBe("aip.example.com");
    expect(hostnameOf("aip.example.com")).toBe("aip.example.com");
    expect(hostnameOf("[::1]:3000")).toBe("[::1]");
  });

  it("trusts client IP headers only behind a trusted proxy", () => {
    const h = headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientIp(h, false)).toBe("direct");
    expect(clientIp(h, true)).toBe("203.0.113.9");
    expect(clientIp(headers({ "x-real-ip": "198.51.100.4", "x-forwarded-for": "1.1.1.1" }), true)).toBe("198.51.100.4");
  });
});
