# Sustantix AIP: Vercel / Next.js + Supabase host

Confidential and proprietary to Sustantix. Not for distribution.

This app hosts the v732 AIP runtime (`apps/runtime`, built with `--target vercel`) as static
files under `/aip/`. It also serves the server-side API that the runtime's Vercel host adapter
(`packages/host-bridge/src/adapters/vercel.ts`) calls:

| Endpoint | Purpose | License gate |
| --- | --- | --- |
| `GET /api/aip/license[?refresh=1]` | Server SXL1 verdict (`LicenseStatus`) | open |
| `GET /api/aip/time` | Server clock `{ now }` (epoch seconds) | open |
| `GET /api/aip/session` | `{ displayName, login }` or `null` | open |
| `POST /api/aip/sign-in` | Supabase email/password, HttpOnly cookies | access ≠ `none` |
| `POST /api/aip/sign-out` | Ends the session (always allowed) | open |
| `GET /api/aip/state` | Tenant runtime snapshot, or 204 | access ≠ `none` |
| `PUT / DELETE /api/aip/state` | Save / clear the snapshot (tenant `admin`) | access = `full` |

When a gated endpoint is refused, the response is `402` with `{ error: "license_required", state, access, reason }`.
The same gate runs in `middleware.ts` (Node.js runtime) and again inside each route handler.

## Layout

```
app/api/aip/*/route.ts   thin route handlers
lib/license.ts           verdict, clock-memory throttle, 5-minute per-host cache
lib/gate.ts              402 policy + CSRF origin check (used by middleware and routes)
lib/state/*              zod schema, gzip / bytea-hex / sha256 codec, save-load-clear service
lib/tenant.ts            membership → tenant resolution (aip_tenant cookie preference)
lib/rate-limit.ts        RateLimiter interface + in-memory token bucket
lib/supabase/*           user-scoped (RLS) client, service-role client, store adapters
scripts/prebuild.mjs     builds license + host-bridge + runtime bundle into public/aip
```

## Local development

```bash
pnpm install                                   # at the monorepo root
cp apps/web/.env.example apps/web/.env.local   # fill in values
pnpm --filter @sustantix/aip-web dev           # assembles public/aip once, then next dev
pnpm --filter @sustantix/aip-web test          # vitest
pnpm --filter @sustantix/aip-web typecheck
pnpm --filter @sustantix/aip-web build         # prebuild + next build
```

`public/aip/` is generated and git-ignored. Delete it to force `dev` to reassemble it. `build` always reassembles it.
`next build` does not need secrets: the environment is validated when the first request arrives. If a variable is
missing or invalid, the API answers `503 server_misconfigured` and the log names the variable (never its value).

## Deploying to Vercel

1. **Project**: import the repository and set **Root Directory** to `apps/web`. `vercel.json` sets the framework
   to Next.js, runs the install at the monorepo root (`cd ../.. && pnpm install --frozen-lockfile`) and builds with
   `pnpm run build` (this runs `prebuild`). Turn on "Include files outside the root directory" so the build can read
   `apps/runtime`, `packages/*` and `config/license`.
2. **Environment variables** (Production, and Preview if used):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`: server only. Mark it *Sensitive*. It is used only for `aip.license_clock` and
     `aip.audit_log` appends.
   - `AIP_LICENSE_KEY`: the SXL1 token for this deployment's domain (step 5).
   - `AIP_LICENSE_REVOCATION`: optional signed SXR1 list.
3. **Supabase schema**: from the monorepo root, `supabase link --project-ref <ref>` and then `supabase db push`.
   This applies `supabase/migrations/*`. Then in the Supabase dashboard go to **Settings → API → Exposed schemas**
   and add `aip`, because the API reads `aip.*` through PostgREST.
   In **Authentication → Providers**, enable Email and disable public sign-ups if accounts are provisioned by an administrator.
4. **First tenant and administrator**: create the user in **Authentication → Users**. Set `full_name` in the user
   metadata if you want a display name. Then run this in the SQL editor:
   ```sql
   with t as (
     insert into aip.tenants (name, region, default_currency) values ('Customer Name', 'IN', 'INR') returning id
   )
   insert into aip.tenant_members (tenant_id, user_id, role)
   select t.id, u.id, 'admin' from t, auth.users u where u.email = 'admin@customer.example';
   ```
   Add further members with the roles `viewer`, `planner` or `admin`. Only `admin` can save or clear the runtime snapshot.
5. **License**: on the Sustantix issuing workstation, bind the license to the exact production hostname or hostnames:
   ```bash
   pnpm --filter @sustantix/license-cli sx-license issue --key <private.pem> --kid <kid> \
     --customer-id <id> --customer-name "<name>" --edition standard --platform vercel \
     --days 365 --grace 14 --domain aip.customer.example [--domain www.aip.customer.example]
   ```
   Paste the token into `AIP_LICENSE_KEY` and redeploy. After a key change, `GET /api/aip/license?refresh=1`
   re-evaluates the verdict immediately (at most once every 10 s). Otherwise the verdict is cached for 5 minutes per instance.
   Domain binding uses the request host with the port removed. On Vercel the platform-set `x-forwarded-host` is used.
   Elsewhere only `Host` is trusted, unless `AIP_TRUST_PROXY=1` is set behind your own proxy.
   The build fails closed while `config/license/trusted-keys.json` is empty: every verdict is `no_trusted_keys`.
6. **Preview deployments**: this is a confidential product. Enable **Vercel Deployment Protection** (Vercel
   Authentication or Password Protection) for Preview, and for Production too unless the custom domain is the only
   entry point. Preview hosts (`*.vercel.app`) are not licensed domains, so their API answers 402 anyway. The
   static bundle, however, is readable to anyone who can reach the URL unless protection is on.

## Security notes

- Headers on every response: HSTS (2 years, includeSubDomains, preload), `X-Frame-Options: DENY`, `nosniff`,
  `strict-origin-when-cross-origin`, a Permissions-Policy that denies camera, microphone and geolocation, and a CSP.
  The CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts because the legacy runtime inlines its scripts and
  uses inline handlers and eval (see `next.config.ts`).
- Cache: `/aip/{data,assets,vendor}/*` are served `immutable` because their file names are content hashes or pinned
  versions. `/aip/index.html` and `/api/*` are served `no-store`, and `/aip/host/*` must revalidate.
- CSRF: every non-GET request under `/api` must carry an `Origin` equal to the request host. If `Origin` is absent,
  `Sec-Fetch-Site: same-origin` is accepted instead. Session cookies are always `HttpOnly; Secure; SameSite=Lax`.
- Sign-in is limited to 5 attempts per minute per IP and per email with an in-memory token bucket, one per serverless
  instance. For a hard global limit, implement `RateLimiter` (`lib/rate-limit.ts`) on a durable store.
- Tenant data is read and written with the user-scoped Supabase client, so RLS (`aip.has_role`) decides access.
  The service role touches only the license clock and audit appends (authenticated users have no INSERT on `audit_log`).
- The runtime snapshot is stored as `gzip(JSON)` in `runtime_state.payload` (bytea, sent as `\x` hex).
  `bytes` and `sha256` describe the canonical JSON and are checked on every read. Audit rows record `{bytes, sha256}`, never the payload.

## Known limits

- **Vercel request body limit (4.5 MB).** The API accepts snapshots of up to 50 MB and also accepts
  `Content-Encoding: gzip` request bodies under the same 50 MB decompressed ceiling. However, the current host bridge
  sends plain JSON, so Vercel rejects snapshots larger than about 4.5 MB (`413 FUNCTION_PAYLOAD_TOO_LARGE`)
  before this code runs. The fix belongs in the bridge: gzip the body with `CompressionStream` and set
  `Content-Encoding: gzip`. Responses are not affected, because `GET /state` streams the stored gzip bytes directly.
- **Audit append is not transactional** with the state write. It happens after the write through the service role.
  A failed append is logged as an error, and the save still succeeds. Making them atomic needs a `security definer` RPC in a migration.
- The verdict cache and rate limiter are per-process memory. On Vercel each function instance has its own.
