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
