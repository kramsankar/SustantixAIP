import { z } from "zod";

/**
 * Server environment. Validated lazily on first use (never at import time) so that
 * `next build` can run without production secrets present.
 */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  AIP_LICENSE_KEY: z.preprocess(blankToUndefined, z.string().trim().max(16384).optional()),
  AIP_LICENSE_REVOCATION: z.preprocess(blankToUndefined, z.string().trim().max(262144).optional()),
  // Data source for the runtime: "embedded" (bundled demo data, the default) or "governed" (the tenant's data from
  // the governed model through the phase 3 compatibility views).
  AIP_DATA_SOURCE: z.preprocess(blankToUndefined, z.enum(["embedded", "governed"]).default("embedded")),
  // Agents (optional): without a key the agent endpoints answer 503 agents_not_configured.
  ANTHROPIC_API_KEY: z.preprocess(blankToUndefined, z.string().trim().min(20).optional()),
  AIP_AGENT_MODEL: z.preprocess(blankToUndefined, z.string().trim().regex(/^claude-[a-z0-9.-]+$/).default("claude-sonnet-5-5")),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export class EnvError extends Error {
  constructor(readonly variables: string[]) {
    super(`server environment is incomplete or invalid: ${variables.join(", ")}`);
    this.name = "EnvError";
  }
}

let cached: ServerEnv | undefined;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = ServerEnvSchema.safeParse(source);
  if (!result.success) {
    // Report variable names only; values may be secrets.
    const names = [...new Set(result.error.issues.map((i) => String(i.path[0] ?? "?")))];
    throw new EnvError(names);
  }
  return result.data;
}

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** For tests only. */
export function resetServerEnvCache(): void {
  cached = undefined;
}

/** True when running on Vercel's infrastructure, where proxy headers are set by the platform. */
export function onVercel(): boolean {
  return process.env.VERCEL === "1";
}

/** Proxy headers (x-forwarded-*) are only trusted when the platform guarantees them. */
export function trustProxyHeaders(): boolean {
  return onVercel() || process.env.AIP_TRUST_PROXY === "1";
}
