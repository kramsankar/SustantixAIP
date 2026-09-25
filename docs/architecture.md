# Architecture

**Confidential — Sustantix.**

## Principle: one experience, two platforms, no drift

The v732 reference build is the approved product experience. It consists of about 4 MB of application logic accumulated over hundreds of governed iterations, plus 52 MB of governed datasets. Rewriting it screen by screen would risk exactly what the business signed off. Instead, AIP ships the reference logic unchanged and re-engineers everything *around* it for production:

```
                    ┌──────────────────────────────────────────────┐
                    │ apps/runtime  (v732 experience, 27 screens)   │
                    │  697 script modules · 39 datasets · assets    │
                    └───────────────▲──────────────────────────────┘
                                    │ host seams: identity · license · tenant state
                    ┌───────────────┴──────────────────────────────┐
                    │ packages/host-bridge                          │
                    │  license gate · module gating · SSO sign-in   │
                    └──────┬──────────────────────┬────────────────┘
               Power Apps adapter            Vercel adapter
          ┌────────────────▼───────────┐  ┌───────▼────────────────────────┐
          │ Power Apps code app         │  │ Next.js (apps/web)             │
          │ Entra ID identity           │  │ Supabase Auth (HttpOnly)       │
          │ Dataverse: sus_* tables     │  │ Postgres: aip.* + RLS + audit  │
          │ LicenseGuard plug-in        │  │ license verdict API/middleware │
          └─────────────────────────────┘  └────────────────────────────────┘
```

## Runtime decomposition (`tools/extract-v732`)

The extractor is deterministic and reproducible from the reference file. Its manifest records the reference SHA-256.

- Every executable `<script>` becomes `apps/runtime/src/js/NNNN-<id>.js`, numbered in its original order.
- Every inline dataset literal of 20 KB or more becomes `src/data/<sha256-16>.json`, byte for byte and deduplicated. The code references it as `__AIP_DS("<hash>")`, which returns a fresh object graph per call, exactly as re-evaluating the literal did.
- Embedded images become files under `src/assets/`.
- The extractor applies four **host seams**, and fails if any seam signature does not match exactly once:
  1. **Sign-in:** the prototype's hard-coded credential check is replaced by `window.AIPHost.signIn`, so no credential exists in the client.
  2. **Persistence:** `saveEamState`, `loadEamState` and `clearEamState` are routed to the tenant store (Dataverse file column or Supabase `aip.runtime_state`) when the host registers one.
  3. **Deferred loading:** the deferred-module loader is extended for external modules.
  4. **Workbook import:** the SheetJS CDN dependency is vendored locally, so the product makes no third-party runtime calls.

### Why the build inlines scripts again

v732 ran every block synchronously in one parser pass. Loading 697 blocks as external files lets timers and idle callbacks fire *between* blocks, and a first attempt showed one screen (Maintenance Strategy) rendering site labels differently. `apps/runtime/build.mjs` therefore keeps separate files in source control but inlines them at their original positions in the shipped `index.html`. Execution semantics are then exactly those of the reference, and the parity suite proves it: 27 of 27 screens are identical.

## Data contract (`schema/aip-data-model.json`)

`tools/schema` infers the contract from the governed workbook: 107 tables, 1,458 typed columns, business keys (single, or period-anchored composites), and 80 money columns carrying their ISO-4217 currency. From it, the tool generates:

- **Supabase:** tenant-scoped tables with RLS (viewer / planner / admin), an audit trigger on every table writing to the append-only `aip.audit_log`, daily FX rates in `aip.fx_rates`, `aip.runtime_state` and `aip.license_clock`.
- **Dataverse:** EntityMetadata payloads with native Money (transaction currency plus base conversion), time-zone-independent timestamps for plant-local times, and alternate keys for idempotent upserts.

Money is never a float. Postgres uses `numeric(24,p)` with a `currency char(3)` column; Dataverse uses Money with a transaction currency.

## Multi-region

- **Currency:** stored per row. The tenant default currency is configurable (`aip.tenants.default_currency`); FX conversion comes from the stored daily rate table.
- **Region:** `aip.tenants.region` identifies the jurisdiction. The seed tenant is India (INR, BRSR), and nothing in the platform layer assumes India.
- **Sustainability frameworks:** framework selection (BRSR / ISSB / GRI / CSRD) is data in `SUS_Framework_Mapping`, not code.

## Evolution path

The runtime is intentionally the reference code. Future work replaces it screen by screen with typed modules behind the same host bridge. Each replacement must keep `apps/runtime/test/parity.mjs` green, or deliberately update the reference with a sign-off.
