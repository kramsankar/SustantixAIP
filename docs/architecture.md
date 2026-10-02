# Architecture

**Confidential — Sustantix.**

## Principle: one experience, two platforms, no drift

The v915 reference build is the approved product experience. It consists of about 5 MB of application logic accumulated over hundreds of governed iterations, plus 52 MB of governed datasets. Rewriting it screen by screen would risk exactly what the business signed off. Instead, AIP ships the reference logic unchanged and re-engineers everything *around* it for production:

```
                    ┌──────────────────────────────────────────────┐
                    │ apps/runtime  (v915: Hub + 28 screens)        │
                    │  751 script modules · 45 datasets · assets    │
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

## Runtime decomposition (`tools/extract-reference`)

The extractor is deterministic and reproducible from the reference file. Its manifest records the reference SHA-256. From v915 the reference ships as a gzip + base64 container that writes the real app at load; the extractor unwraps it before decomposing.

- Every executable `<script>` becomes `apps/runtime/src/js/NNNN-<id>.js`, numbered in its original order.
- Every inline dataset literal of 20 KB or more becomes `src/data/<sha256-16>.json`, byte for byte and deduplicated. The code references it as `__AIP_DS("<hash>")`, which returns a fresh object graph per call, exactly as re-evaluating the literal did.
- Embedded images become files under `src/assets/`.
- The extractor applies four **host seams**, and fails if any seam signature does not match exactly once:
  1. **Sign-in:** the prototype's hard-coded credential check is replaced by `window.AIPHost.signIn`, so no credential exists in the client.
  2. **Persistence:** `saveEamState`, `loadEamState` and `clearEamState` are routed to the tenant store (Dataverse file column or Supabase `aip.runtime_state`) when the host registers one.
  3. **Deferred loading:** the deferred-module loader is extended for external modules.
  4. **Workbook import:** the SheetJS CDN dependency is vendored locally, so the product makes no third-party runtime calls.

### Why the build inlines scripts again

The reference ran every block synchronously in one parser pass. Loading ~750 blocks as external files lets timers and idle callbacks fire *between* blocks, and a first attempt showed one screen (Maintenance Strategy) rendering site labels differently. `apps/runtime/build.mjs` therefore keeps separate files in source control but inlines them at their original positions in the shipped `index.html`. Execution semantics are then exactly those of the reference, and the parity suite proves it: 29 of 29 screens are identical.

## Data contract (`schema/aip-data-model.json`)

`tools/schema` infers the contract from the governed workbook: 161 tables, 2,278 typed columns, business keys (taken from the runtime's own import rules, `APM_SHEET_RULES`, where declared; otherwise inferred as single or period-anchored composites), and 96 money columns carrying their ISO-4217 currency. From it, the tool generates:

- **Supabase:** tenant-scoped tables with RLS (viewer / planner / admin), an audit trigger on every table writing to the append-only `aip.audit_log`, daily FX rates in `aip.fx_rates`, `aip.runtime_state` and `aip.license_clock`.
- **Dataverse:** EntityMetadata payloads with native Money (transaction currency plus base conversion), time-zone-independent timestamps for plant-local times, and alternate keys for idempotent upserts.

Money is never a float. Postgres uses `numeric(24,p)` with a `currency char(3)` column; Dataverse uses Money with a transaction currency.

## Reference data (phase 1 of the normalized model)

`schema/reference/vocabulary.json` is the curated controlled vocabulary. It holds 16 code tables (asset class, status by entity, priority, severity, risk band, unit, currency, region, failure mode, defect, skill, event type, source system, framework, emission factor, maintenance type), the aliases observed in the workbook, which data-model column each table governs, and the questions still owed by the data owner. `schema/reference/integrity.json` declares the cross-sheet references and classifies every unresolved value:

- mechanical rules (crosswalk, null token, aggregate row), each of which must resolve everything it matches;
- phase 2 merges;
- owner decisions.

From these, `tools/schema` generates:

- **Supabase:** `aip.ref_*` tables. Platform defaults (`tenant_id` null) are readable by every member and changed only by migrations. Tenant rows extend them, are writable by that tenant's administrators, and are audited and versioned (`row_version`). `aip.ref_alias` and `aip.ref_binding` drive validation and grid dropdowns.
- **Dataverse:** `sus_ref_*` tables keyed on their code, provisioned by `sx-pp` with every platform code and alias.

`schema/reference/corrections.json` holds governed data corrections decided by the data owner. Corrections apply in order. A derive correction adds the records the workbook references but lacks (historical assets, case assets, planned and HSE-cited work orders, RCA events, optimisation candidates), built from the rows that reference them. A remap correction changes values in place (legacy plant and asset codes, forecast placeholders, a provenance flag held in a status), logging each changed cell before and after. Corrections are applied when data is loaded into the system of record (Supabase seed, Dataverse provisioning) and logged per record in `aip.data_correction` / `sus_datacorrection`. The governed workbook and the v9.15 runtime datasets stay unchanged, so screen parity is unaffected until phase 3 moves the runtime onto the database.

`pnpm --filter @sustantix/schema check:data` is the phase 1 gate. It fails CI on any vocabulary value that is neither mapped nor declared, any unclassified reference, or any mechanical rule that does not resolve. It writes `docs/data/phase1-reference-report.md`.

## Multi-region

- **Currency:** stored per row. The tenant default currency is configurable (`aip.tenants.default_currency`); FX conversion comes from the stored daily rate table.
- **Region:** `aip.tenants.region` identifies the jurisdiction. The seed tenant is India (INR, BRSR), and nothing in the platform layer assumes India.
- **Sustainability frameworks:** framework selection (BRSR / ISSB / GRI / CSRD) is data in `SUS_Framework_Mapping`, not code.

## Evolution path

The runtime is intentionally the reference code. Future work replaces it screen by screen with typed modules behind the same host bridge. Each replacement must keep `apps/runtime/test/parity.mjs` green, or deliberately update the reference with a sign-off.
