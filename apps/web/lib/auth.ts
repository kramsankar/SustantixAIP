import { z } from "zod";
import { json } from "./http";
import { takeAll, type RateLimiter } from "./rate-limit";

/** Email/password sign-in and session identity (Supabase Auth behind a small interface). */

export const SignInSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    password: z.string().min(1).max(1024),
  })
  .strict();

export const MAX_SIGN_IN_BODY = 8 * 1024;

export interface PasswordAuth {
  /** Resolves true when the credentials were accepted and session cookies were issued. */
  signInWithPassword(email: string, password: string): Promise<boolean>;
}

export interface SignInDeps {
  auth: PasswordAuth;
  limiter: RateLimiter;
  clientIp: string;
  nowMs?: number;
}

export async function signIn(body: unknown, deps: SignInDeps): Promise<Response> {
  const parsed = SignInSchema.safeParse(body);
  // Count malformed attempts against the IP too, so probing is not free.
  const keys = [`ip:${deps.clientIp}`];
  if (parsed.success) keys.push(`email:${parsed.data.email}`);
  const rate = await takeAll(deps.limiter, keys, deps.nowMs);
  if (!rate.allowed) {
    return json({ ok: false, error: "rate_limited" }, 429, { "retry-after": String(rate.retryAfter) });
  }
  if (!parsed.success) return json({ ok: false, error: "invalid_request" }, 400);

  let ok = false;
  try {
    ok = await deps.auth.signInWithPassword(parsed.data.email, parsed.data.password);
  } catch {
    ok = false;
  }
  // Same response for unknown user and wrong password.
  return ok ? json({ ok: true }) : json({ ok: false, error: "invalid_credentials" }, 401);
}

export interface Identity {
  displayName: string;
  login: string;
}

export interface AuthUserLike {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export function identityOf(user: AuthUserLike | null | undefined): Identity | null {
  if (!user) return null;
  const login = (user.email ?? "").trim();
  const full = user.user_metadata?.["full_name"];
  const name = typeof full === "string" ? full.trim().slice(0, 200) : "";
  if (!login && !name) return { displayName: user.id, login: user.id };
  return { displayName: name || login, login: login || user.id };
}
