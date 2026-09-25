import { afterEach, describe, expect, it, vi } from "vitest";
import { identityOf, signIn, type PasswordAuth } from "../lib/auth";
import { MemoryTokenBucket } from "../lib/rate-limit";
import { hardenCookie } from "../lib/supabase/server";

const limiter = () => new MemoryTokenBucket({ capacity: 5, refillPerSec: 5 / 60 });
const auth = (accept: (e: string, p: string) => boolean): PasswordAuth & { calls: number } => {
  const a = {
    calls: 0,
    async signInWithPassword(e: string, p: string) {
      a.calls++;
      return accept(e, p);
    },
  };
  return a;
};

describe("sign-in", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts valid credentials and normalises the e-mail", async () => {
    const seen: string[] = [];
    const res = await signIn({ email: "  Ada@Example.COM ", password: "correct horse" }, { auth: auth((e) => (seen.push(e), true)), limiter: limiter(), clientIp: "1.2.3.4" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(seen).toEqual(["ada@example.com"]);
  });

  it("returns ok:false for bad credentials", async () => {
    const res = await signIn({ email: "a@b.io", password: "nope" }, { auth: auth(() => false), limiter: limiter(), clientIp: "ip" });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  it("treats auth backend failures as a failed sign-in", async () => {
    const a: PasswordAuth = { signInWithPassword: async () => Promise.reject(new Error("down")) };
    const res = await signIn({ email: "a@b.io", password: "x" }, { auth: a, limiter: limiter(), clientIp: "ip" });
    expect(res.status).toBe(401);
  });

  it("validates input with zod", async () => {
    const a = auth(() => true);
    for (const body of [undefined, null, {}, { email: "not-an-email", password: "x" }, { email: "a@b.io", password: "" }, { email: "a@b.io", password: "x", extra: 1 }, { email: "a@b.io", password: "p".repeat(2000) }]) {
      const res = await signIn(body, { auth: a, limiter: limiter(), clientIp: "ip" });
      expect(res.status).toBe(400);
    }
    expect(a.calls).toBe(0);
  });

  it("rate-limits per e-mail across IPs", async () => {
    const rl = limiter();
    const a = auth(() => false);
    for (let i = 0; i < 5; i++) {
      expect((await signIn({ email: "t@x.io", password: "x" }, { auth: a, limiter: rl, clientIp: `10.0.0.${i}`, nowMs: 0 })).status).toBe(401);
    }
    const res = await signIn({ email: "t@x.io", password: "x" }, { auth: a, limiter: rl, clientIp: "10.0.0.99", nowMs: 0 });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(a.calls).toBe(5);
  });

  it("rate-limits per IP across e-mails, including malformed attempts", async () => {
    const rl = limiter();
    const a = auth(() => false);
    for (let i = 0; i < 3; i++) await signIn({ email: `u${i}@x.io`, password: "x" }, { auth: a, limiter: rl, clientIp: "9.9.9.9", nowMs: 0 });
    for (let i = 0; i < 2; i++) await signIn({ junk: true }, { auth: a, limiter: rl, clientIp: "9.9.9.9", nowMs: 0 });
    expect((await signIn({ email: "fresh@x.io", password: "x" }, { auth: a, limiter: rl, clientIp: "9.9.9.9", nowMs: 0 })).status).toBe(429);
  });

  it("never writes the password to logs or the response", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const secret = "S3cr3t-Pa55word!";
    const failing: PasswordAuth = { signInWithPassword: async () => Promise.reject(new Error("backend exploded")) };
    const res = await signIn({ email: "a@b.io", password: secret }, { auth: failing, limiter: limiter(), clientIp: "ip" });
    expect(await res.text()).not.toContain(secret);
    for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toContain(secret);
  });
});

describe("session identity", () => {
  it("prefers full_name, falls back to e-mail", () => {
    expect(identityOf({ id: "u", email: "ada@example.com", user_metadata: { full_name: " Ada Lovelace " } })).toEqual({
      displayName: "Ada Lovelace",
      login: "ada@example.com",
    });
    expect(identityOf({ id: "u", email: "ada@example.com", user_metadata: {} })).toEqual({ displayName: "ada@example.com", login: "ada@example.com" });
    expect(identityOf({ id: "u", email: "ada@example.com", user_metadata: { full_name: 42 } })?.displayName).toBe("ada@example.com");
    expect(identityOf(null)).toBeNull();
  });
});

describe("session cookies", () => {
  it("are always HttpOnly, Secure, SameSite=Lax", () => {
    expect(hardenCookie({ httpOnly: false, secure: false, sameSite: "none", maxAge: 100 })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 100,
    });
  });
});
