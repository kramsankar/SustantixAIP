# Sustantix Asset Intelligence Platform (AIP)

**Confidential — Sustantix proprietary. Not for public distribution.**

AIP is Sustantix's intelligence layer for renewable-energy asset owners. It covers portfolio performance, maintenance strategy, work-order and planning optimisation, reliability engineering, spares, the operational twin and forecasting, and sustainability intelligence (BRSR / ISSB / GRI / CSRD vocabulary). All of it is governed by one data contract and a signed licensing layer.

This repository turns the approved **v732 reference build** (`AIP_v732.html` + `AIP_Data_v732.xlsx`) into a product that ships on two platforms:

| Edition | Hosting | Identity | Data | License enforcement |
|---|---|---|---|---|
| **Power Platform** *(priority)* | Power Apps code app inside the `SustantixAIP` managed solution | Microsoft Entra ID (Power Apps player) | Dataverse | Signed plug-in (`LicenseGuard`) in Dataverse + `sus_GetLicenseStatus` Custom API |
| **Vercel** | Next.js (`apps/web`) | Supabase Auth | Supabase Postgres (RLS on every table) | Server-side verdict API + middleware |

Both editions serve the **identical v732 experience**: 27 screens across 6 navigation groups. CI proves this on every push by crawling each screen against the reference and requiring an exact match.

## Repository map

```
apps/runtime/            the AIP application (v732, decomposed into maintainable sources)
  src/js/                697 script modules in original execution order
  src/data/              39 governed datasets (deduplicated, byte-identical to v732)
  build.mjs              per-target bundle: standalone | vercel | powerapps
  test/parity.mjs        27-screen parity + license-gate proof
apps/powerapp/           Power Apps code-app packaging (pac code push)
apps/web/                Vercel / Next.js host (auth, license verdict, tenant state)
packages/license/        SXL1 license format — verify (browser/Node/edge) + issue (Node)
packages/host-bridge/    connects the runtime to each platform (identity, license, persistence)
powerplatform/plugins/   Dataverse license plug-in (.NET 4.6.2) + conformance tests
powerplatform/provision/ sx-pp: idempotent Dataverse provisioning of the SustantixAIP solution
powerplatform/schema/    generated Dataverse metadata (107 data-model tables + platform tables)
supabase/                generated migrations, RLS isolation proof
schema/                  aip-data-model.json — the data contract (107 tables, 1,458 columns)
tools/extract-v732/      reproducible decomposition of the v732 reference
tools/schema/            data-contract inference + Postgres/Dataverse generators + seed
tools/license-cli/       sx-license: keygen, issue, trial, revoke, inspect, verify
tools/snkgen/            strong-name key generator for the plug-in assembly
config/license/          trusted PUBLIC signing keys compiled into every build
reference/               v732 workbook + reference screen crawl
docs/                    architecture, licensing, deployment runbooks, security
```

## Quick start

```bash
pnpm install
pnpm --filter @sustantix/license build

# Evaluate locally (standalone evaluation host; needs a license bound to "localhost")
pnpm --filter @sustantix/host-bridge build
pnpm --filter @sustantix/aip-runtime build
pnpm --filter @sustantix/aip-runtime serve        # http://localhost:4173
```

Runbooks:

- Power Platform: [docs/power-platform-deployment.md](docs/power-platform-deployment.md)
- Vercel: [apps/web/README.md](apps/web/README.md)
- Licensing operations: [docs/licensing.md](docs/licensing.md)

## Quality gates

| Suite | Scope | Result |
|---|---|---|
| `packages/license` | SXL1 signature, binding, trial policy, grace, revocation, clock rollback, conformance fixtures | 36 / 36 |
| `powerplatform/plugins` (.NET) | same conformance fixtures as the TypeScript verifier, weak-key rejection, fail-closed | 17 / 17 |
| `packages/host-bridge` | server-verdict precedence, fail-closed paths, Dataverse verdict mapping, gzip state saves | 6 / 6 |
| `apps/web` | license verdict API, 402 gating, CSRF, sign-in rate limit, tenant resolution, state codec/service | 133 / 133 |
| `tools/schema` | inference, key uniqueness over all seed rows, Postgres + Dataverse payloads | 11 / 11 |
| `powerplatform/provision` | full provisioning against a Dataverse double, idempotent re-run, throttling | 6 / 6 |
| `apps/powerapp` | pac data-source wiring | 3 / 3 |
| `supabase/tests` | migrations on Postgres 16, cross-tenant isolation, append-only audit | pass |
| `apps/runtime/test/parity.mjs` | 27 / 27 screens identical to v732 + 8 license-gate checks | 36 / 36 |


---
Karthikram S · Co-founder, Sustantix · Chennai · linkedin.com/in/karthiksustantix
*Ship, don't demo.*
