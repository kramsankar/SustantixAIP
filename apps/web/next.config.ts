import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Content-Security-Policy for the AIP runtime.
 *
 * 'unsafe-inline' and 'unsafe-eval' in script-src are deliberate: the v732 runtime is
 * shipped as one HTML document whose scripts are inlined at their original positions
 * (see apps/runtime/build.mjs), it wires UI through inline on* handler attributes, and
 * parts of it evaluate generated code. Nonces cannot be applied to a static document
 * and hashes cannot cover handler attributes. Everything else stays locked to 'self';
 * the runtime never talks to Supabase from the browser, connect-src only allows it for
 * future direct use.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: CSP },
];

const IMMUTABLE = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
const NO_STORE = [{ key: "Cache-Control", value: "no-store, max-age=0" }];
const REVALIDATE = [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Trace workspace packages (pnpm symlinks) from the monorepo root.
  outputFileTracingRoot: join(here, "../.."),
  // The runtime bundle under public/aip is static and never needs to be traced into functions.
  outputFileTracingExcludes: { "*": ["public/aip/**"] },
  experimental: {
    // lib/trusted-keys.ts imports the monorepo keyset from config/license.
    externalDir: true,
  },
  async redirects() {
    return [
      { source: "/", destination: "/aip/index.html", permanent: false },
      { source: "/aip", destination: "/aip/index.html", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Content-addressed file names (data/<hash>.js, assets/img-<hash>.png) or pinned vendor builds.
      { source: "/aip/data/:path*", headers: IMMUTABLE },
      { source: "/aip/assets/:path*", headers: IMMUTABLE },
      { source: "/aip/vendor/:path*", headers: IMMUTABLE },
      // Not content-addressed: revalidate on every load so a deploy is picked up immediately.
      { source: "/aip/host/:path*", headers: REVALIDATE },
      { source: "/aip/build-info.json", headers: REVALIDATE },
      { source: "/aip/index.html", headers: NO_STORE },
      { source: "/api/:path*", headers: NO_STORE },
    ];
  },
};

export default config;
