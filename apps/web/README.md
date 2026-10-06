# Sustantix AIP: Vercel / Next.js + Supabase host

Confidential and proprietary to Sustantix. Not for distribution.

This app hosts the AIP runtime (`apps/runtime`, built with `--target vercel`) as static
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

## Analytics and agents

- `POST /api/aip/analytics/run` (planner or admin) runs the AIP engines on the tenant's own data and records each run
  and its outputs (`aip.model_run`, `aip.model_output`). `GET /api/aip/analytics/latest?model=&measure=&subject=` reads
  the latest successful results. A full run on the demo portfolio takes tens of seconds (`maxDuration` 300 s needs a
  Vercel plan that allows it).
- `GET /api/aip/agents` lists the agents and which the caller's role may use; `POST /api/aip/agents/{agent}` runs one
  conversation turn; `GET /api/aip/agents/proposals` and `POST /api/aip/agents/proposals/{code}` (approve or reject)
  handle what agents propose. The runtime's Assistant screen calls `/api/assistant`, which the AIP Copilot answers.

## Enterprise Grid and change sets (phase 4)

The Sustantix Enterprise Grid workspace is served at `/grids` (static bundle `public/aip/grid/`, built from
`packages/grid`). It calls these endpoints with the signed-in user's session; row-level security decides every row:

| Endpoint | Purpose | License gate |
| --- | --- | --- |
| `GET /api/aip/grid` | The grid catalogue, editability narrowed to the caller's role | readable |
| `POST /api/aip/grid/{id}/rows` | One page: `{offset, limit, sort, filters, search}`, evaluated in the database | readable |
| `POST /api/aip/grid/{id}/export` | `{format, query}`: every filtered row (≤ 50,000), audited | readable |
| `GET /api/aip/grid/options?kind=ref\|fk&name=&scope=&q=` | Dropdown values for an editable cell | readable |
| `GET / POST /api/aip/grid/{id}/views`, `PUT / DELETE …/views/{view}` | Saved views (admins share) | writes: `full` |
| `POST /api/aip/changes` | One change set `{id, source, items[]}`, applied atomically | `full` |
| `POST /api/aip/workbook/changes` | A workbook import made on governed data, as one change set | `full` |
| `GET /api/aip/ui` | Deployment switches for the runtime (`gridScreens`) | readable |
| `POST /api/aip/grid/export-audit` | Audits an export a screen grid made in the browser | readable |
| `GET /api/aip/changes/feed?since=<cursor>` | Live refresh: which records of the tenant changed (entity, code, operation), never who or what | readable |

A change set item is `{entity, op: insert|update|delete, code, baseVersion, values}`. References travel as business
codes, amounts as decimal strings. A stale `baseVersion` answers `409 conflict` with the current row; a repeated `id`
returns the stored result without applying twice. Viewers cannot write; planners write registers and transactions;
administrators also write masters; time series are never written cell by cell. The Reference Data grid reads
`aip.v_reference`; no extra schema needs exposing.

**Live refresh.** While the page is shown, an open grid polls the change feed every 15 seconds (longer after
failures). The feed is `aip.change_feed`: any member of the tenant may call it, and it returns business codes only,
with a two-minute overlap so late commits are not missed. When another user or an integration changes records of
the grid's entity:
- The grid fetches just those records and merges them in place. It reloads in full after more than 200 changes, or
  after a day away.
- The user's unsaved edits stay; a real collision still surfaces as a conflict on save.
- A change set the page saved itself is not echoed back.

## Integration: inbound data and outbound events (phase 5)

**Inbound.** A source system (ERP/EAM, SCADA, a weather service) delivers with an integration key:

| Endpoint | Purpose | License gate |
| --- | --- | --- |
| `GET / POST /api/aip/integrations` | List integrations; create one (`{name, role, entities}`) and receive its `sxi_` key **once** | writes: `full` |
| `PATCH /api/aip/integrations/{id}` | Enable or disable, narrow its entities | `full` |
| `POST /api/aip/ingest` | `Authorization: Bearer sxi_…` with `{entity, records[]}` or `{sheet, rows[]}` (≤ 5,000) | `full` |
| `POST /api/aip/grid/data-quarantine/actions/replay` / `…/discard` | Replay or discard quarantined rows | `full` |

Only the key's SHA-256 is stored. Each integration is its own technical tenant member, so its writes carry a role and
an audit identity. Every record is checked against the data model and the executable rules in
`schema/quality/rules.json`. Its references are resolved, and it is merged as a change set in chunks of 500. A
failing record is isolated rather than failing its chunk. Each record ends **applied**, **unchanged** or
**quarantined**. Quarantined rows show in the Data Quarantine grid with their issues, ready to replay once the
source or a master is fixed.

**Outbound.** Administrators subscribe destinations to events:

| Endpoint | Purpose | License gate |
| --- | --- | --- |
| `GET / POST /api/aip/outbox/destinations` | List; create `{name, url, events: [change, proposal], entities}`, receiving the signing secret **once** | writes: `full` |
| `PATCH /api/aip/outbox/destinations/{id}` | `{enabled, events, entities}` | `full` |
| `GET /api/aip/cron/outbox` | The delivery worker; answers only Vercel Cron (`Authorization: Bearer $CRON_SECRET`), every 5 minutes | — |
| `POST /api/aip/grid/outbox/actions/retry` | Send failed or set-aside events again | `full` |

An event is written to `aip.outbox` in the same transaction as the change set, or as the proposal status change to
approved or applied, so it exists exactly when the change does. Each event carries the record as stored.

The worker claims due events under a lease and posts JSON to the destination. It refuses anything but https to a
public address, checked after DNS resolution, and does not follow redirects. Failures back off over 1 minute,
5 minutes, 30 minutes, 2 hours, 12 hours and 1 day; after 8 attempts the event is set aside (`dead`). The Outbox
grid shows every event and its last error. Receivers should:

1. Verify `X-Sustantix-Signature: t=<unix seconds>,v1=<hex>`, where `v1` is HMAC-SHA256 over `"<t>.<raw body>"`
   with the destination secret. Compare in constant time and reject a `t` older than a few minutes.
2. De-duplicate on `Idempotency-Key` (the event id), because a retry delivers the same event again.
3. Answer 2xx only once the event is stored.

**Scheduled agent runs.** Administrators give an agent a standing question and a cadence:

| Endpoint | Purpose | License gate |
| --- | --- | --- |
| `GET / POST /api/aip/agents/schedules` | List; create `{name, agent, prompt, cadence: hourly\|daily\|weekly, atHour, atWeekday, timeZone}` | writes: `full` |
| `PATCH /api/aip/agents/schedules/{id}` | `{enabled, prompt, cadence, atHour, atWeekday, timeZone}` | `full` |
| `GET /api/aip/cron/agents` | The worker; answers only Vercel Cron (`$CRON_SECRET`), hourly at minute 7 | — |
| `POST /api/aip/grid/agent-schedules/actions/run-now` | Run schedules at the worker's next pass | `full` |

- **Timing:** times are local to the schedule's own IANA time zone, including daylight-saving changes.
- **Identity:** each schedule acts as its own technical member (role planner), so its runs appear in `agent_run`
  and the audit trail under that identity.
- **Scope:** a run reads only its tenant's governed data. It can raise proposals, which wait for a person and then
  reach the outbox like any approved proposal; nothing it suggests changes data on its own.
- **Bookkeeping:** each slot is claimed once. The Agent schedules grid shows the next run and the last outcome.
- **Requirements:** the worker needs `ANTHROPIC_API_KEY`. Hourly crons need a Vercel plan that allows them.

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
   - `ANTHROPIC_API_KEY`: optional, server only, mark it *Sensitive*. Enables the AIP agents and the Assistant
     screen's online mode. Without it the agent endpoints answer `503 agents_not_configured`.
   - `AIP_AGENT_MODEL`: optional Claude model for the agents (default `claude-sonnet-5-5`).
   - `AIP_GRID_SCREENS`: optional. Screens whose tables show as Enterprise Grids: comma-separated screen names
     (for example `workorderintelligence,guardrails`), `all`, or empty for none (the default).
   - `CRON_SECRET`: at least 24 characters, mark it *Sensitive*. Vercel Cron sends it to the outbox worker (every
     5 minutes) and the agent-schedule worker (hourly), both set in `vercel.json`. Without it the workers answer
     `503` and nothing runs. Scheduled work is licensed against the first domain the deployment's license binds.
   - `AIP_DATA_SOURCE`: `embedded` (default: the runtime shows its bundled data) or `governed` (the runtime boots
     on the tenant's governed data through `GET /api/aip/workbook`). Governed mode needs the `aip_compat` schema
     exposed (step 3) and the tenant loaded.
3. **Supabase schema**: from the monorepo root, `supabase link --project-ref <ref>` and then `supabase db push`.
   This applies `supabase/migrations/*`. Then in the Supabase dashboard go to **Settings → API → Exposed schemas**
   and add `aip` and `aip_compat`, because the API reads `aip.*` (and, in governed mode, the compatibility views in
   `aip_compat.*`) through PostgREST.
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

- **Vercel request body limit (4.5 MB).** The host bridge gzips snapshot saves (`Content-Encoding: gzip`), and the
  API accepts them up to 50 MB decompressed. A snapshot whose compressed size still exceeds 4.5 MB is rejected by the
  platform (`413`) before this code runs.
- **Audit append is not transactional** with the state write. It happens after the write through the service role.
  A failed append is logged as an error, and the save still succeeds. Making them atomic needs a `security definer` RPC in a migration.
- The verdict cache and rate limiter are per-process memory. On Vercel each function instance has its own.
