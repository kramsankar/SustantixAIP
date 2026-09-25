# Security posture

**Confidential — Sustantix.**

## Controls in place

| Area | Control |
|---|---|
| Identity | Power Platform: Entra ID via the Power Apps player; no local credentials. Vercel: Supabase Auth with HttpOnly, Secure, SameSite cookies, and rate-limited sign-in. The prototype's embedded credential was removed at extraction time. |
| Authorisation | Dataverse security roles (*User* read, *Administrator* write). Supabase RLS on every `aip.*` table, with tenant isolation proven by `supabase/tests/90_rls_isolation.sql` in CI. |
| Licensing | RSA-4096 / SHA-512 signed licenses bound to org or domain; server-side enforcement; fail-closed; revocation; clock-rollback detection. See [licensing.md](licensing.md). |
| Audit | `aip.audit_log` is append-only (update and delete raise an error) and written by triggers on every data table. Runtime-state saves and clears are audited by the web API. The license issuance ledger is kept by the CLI. |
| Secrets | Private signing keys never enter the repo: the CLI refuses git paths, and `.gitignore` blocks `*.pem`, `*.key`, `*.snk` and `secrets/`. Service-role and client secrets exist only in server environment variables and CI secrets. |
| Supply chain | No runtime CDN calls; SheetJS is vendored. The plug-in assembly is strong-named and deterministic. Release builds reject test keys (`AIP_RELEASE=1`). |
| Transport / headers | Vercel sends HSTS (preload), `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a Permissions-Policy and a CSP. |

## Known risks

1. **CSP needs `'unsafe-inline'` and `'unsafe-eval'`.** The v732 runtime uses inline event handlers, plus `eval` or `new Function` in five application modules. *Mitigation:* the runtime renders only governed data and makes no third-party script calls. *Path:* retire inline handlers module by module; remove dynamic evaluation from `0013`, `0041`, `0063`, `0107` and `0608`.
2. **SheetJS 0.18.5**, the last npm release, has known advisories: prototype pollution when reading crafted files, and ReDoS. *Mitigation:* workbook import is an Administrator-only action on trusted governed files. *Path:* vendor SheetJS ≥ 0.20.2 from the official tarball into `apps/runtime/static/vendor` and drop the npm dependency.
3. **Demo datasets ship inside the bundle.** Anyone who can open the app shell can read the governed demo data (synthetic, no customer data). Customer data only flows through guarded stores. *Path:* when datasets move to Dataverse or Supabase storage (see the Power Platform runbook fallback), they fall under the license guard as well.
4. **Standalone mode** (`apps/runtime` target `standalone`) gates on license only and accepts any sign-in. It is for Sustantix sales evaluation, never for customer data.
5. **Pre-existing runtime console errors.** v732 raises about 250 non-visible console errors, mostly optional vision decorators referencing undefined helpers. The product reproduces these faithfully; they do not affect rendered output, as the parity suite shows. Fix them inside the runtime modules together with a reference update.
