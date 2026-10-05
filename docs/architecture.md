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

`schema/reference/vocabulary.json` is the curated controlled vocabulary. It holds 16 code tables (asset class, status by entity, priority, severity, risk band, unit, currency, region, failure mode, defect, skill, event type, source system, framework, emission factor, maintenance type), the aliases observed in the workbook, which data-model column each table governs, and the record of every vocabulary decision. `schema/reference/integrity.json` declares the cross-sheet references and classifies every unresolved value:

- mechanical rules (crosswalk, null token, aggregate row), each of which must resolve everything it matches;
- phase 2 merges, each naming the master whose consolidated codes must contain every value it matches.

Every owner decision has been taken and recorded as a governed correction or a vocabulary decision.

From these, `tools/schema` generates:

- **Supabase:** `aip.ref_*` tables. Platform defaults (`tenant_id` null) are readable by every member and changed only by migrations. Tenant rows extend them, are writable by that tenant's administrators, and are audited and versioned (`row_version`). `aip.ref_alias` and `aip.ref_binding` drive validation and grid dropdowns.
- **Dataverse:** `sus_ref_*` tables keyed on their code, provisioned by `sx-pp` with every platform code and alias.

`schema/reference/corrections.json` holds governed data corrections decided by the data owner. Corrections apply in order. A derive correction adds the records the workbook references but lacks (historical assets, case assets, planned and HSE-cited work orders, RCA events, optimisation candidates), built from the rows that reference them. A remap correction changes values in place (legacy plant and asset codes, forecast placeholders, a provenance flag held in a status), logging each changed cell before and after. Corrections are applied when data is loaded into the system of record (Supabase seed, Dataverse provisioning) and logged per record in `aip.data_correction` / `sus_datacorrection`. The governed workbook and the v9.15 runtime datasets stay unchanged, so screen parity is unaffected until phase 3 moves the runtime onto the database.

`pnpm --filter @sustantix/schema check:data` is the phase 1 gate. It fails CI on any vocabulary value that is neither mapped nor declared, any unclassified reference, or any mechanical rule that does not resolve. It writes `docs/data/phase1-reference-report.md`.

## Master data (phase 2 of the normalized model)

`tools/schema/src/masters.ts` defines 32 masters and consolidated registers. They are built from the corrected workbook and replace 52 sheets:
- **Organisation:** site, party, party role.
- **Assets:** equipment model, asset, the inverter, BESS and PV array extensions, PV module group, population segment, PV module.
- **Supply:** part, part stock, rate card.
- **Workforce:** crew, technician, planning resource, vehicle, tool.
- **Integration:** system, connector, interface, source document.
- **Sustainability:** ESG metric, metric disclosure mapping.
- **Analytics:** analytical model (`ml_model`, which also registers AIP's own engines).
- **Contracts:** warranty, offtake contract.
- **Registers:** intervention, scenario, scenario line, HSE incident.

Each master holds its own attributes only. References to other masters are foreign keys, and controlled values are references into the phase 1 vocabulary. Attributes copied from a parent are dropped. Duplicate registers merge on their business code (two part masters, two intervention registers, two scenario tables), and every row keeps lineage to the sheet rows it replaced (`aip.master_lineage`).

- **Supabase:**
  - Each master has a `uuid` identity and a business code unique per tenant.
  - Foreign keys are composite `(tenant_id, id)`, so no row can reference another tenant's row.
  - Vocabulary references are foreign keys guarded so that a tenant uses only platform values or its own.
  - Every row carries `row_version`; every change is audited.
  - Administrators write masters; planners also write registers.
  - Each master has a read view `aip.v_<master>` that shows references as business codes (`security_invoker`, so the caller's RLS applies). Grids, analytics and agents read these views.
- **Dataverse:** each master is a table keyed on its code, with restricted lookups bound by alternate key; self-references load in a second pass.

The data gate (`check:data`) builds every master and fails on duplicate codes, unmapped vocabulary, unresolved references, broken 1:1 extensions or an unresolved merge. Its report is `docs/data/phase2-master-report.md`.

## Transactions, time series and compatibility (phase 3)

`tools/schema/src/sheet-model.ts` declares each transaction and time series once, as a mapping from the sheet it replaces. Every sheet column is accounted for: carried, a reference to a master, a controlled value, re-typed, or a copy of a master attribute that is rebuilt through the reference. A spec that leaves a column unaccounted fails the gate.

There are 23 transaction tables and 11 time series (83,365 rows). They cover work orders, events, root-cause cases and evidence, alerts, recommendations, vision inspections and findings, warranty claims, PM plans, condition assessments, requirements, outages, capacity tests, ESG activity, execution and outcome feedback, forecast runs and PPA settlements. The time series are plant, inverter and BESS telemetry, BESS days, weather, forecast intervals, metered output, validation, life observations, the resource calendar and site weather.

`aip.record_link` is the cross-module ledger. It records each process hop that one foreign key cannot express (intervention → work order, finding → work order, HSE incident → work order, assessment → work order), and both ends are checked.

From the same declarations:
- **`aip_compat.<sheet>`** views (security invoker) rebuild each replaced sheet with its columns, types and order.
- **The round trip** (`rebuildSheets`) compares 1.6 million cells with the corrected workbook. Every difference is classified as one of:
  - vocabulary (a canonical label);
  - format (the same instant in the sheet's other date form);
  - copy (an attribute the workbook repeated that disagreed with its master).

  Unexplained differences fail CI, and `supabase/tests/95_compat_equivalence.sql` proves the views in Postgres.

Planners write transactions; administrators and integrations write time series. Report: `docs/data/phase3-transactions-report.md`.

**Runtime on governed data.** The runtime normally shows its bundled data. With `AIP_DATA_SOURCE=governed`:
- The host bridge registers `window.__AIP_GOVERNED__`.
- At boot, a host seam in the runtime loads the bundled baseline and then overlays the tenant's governed workbook. That workbook comes from `GET /api/aip/workbook`: compatibility views, then the remaining sheet tables, in workbook order, headers and value forms. The overlay is exactly what a workbook upload does.
- Large time series stay with the bundle.
- While governed data is active the runtime does not persist snapshots, because the database is the system of record. Runtime edits reach the database through the change-set API in phase 4.

Screens that read the data change where governed data differs from the bundle: corrected records, canonical labels, and masters replacing stale copies. `pnpm --filter @sustantix/aip-runtime test:governed -- --rebase` writes the reviewed governed baseline (`docs/parity/governed-baseline.md`), and CI then holds governed mode to it exactly. The bundled-data parity crawl is unchanged.

## Analytics (`packages/analytics`)

The reference app displayed model results (forecast bands, remaining life, risk, state of health) that were precomputed in the workbook. `@sustantix/analytics` computes them from each tenant's own data, deterministically (seeded):

| Model | Method |
| --- | --- |
| `AIP-GEN-HYBRID-1` hybrid solar forecast | Physics baseline + gradient-boosted residual trees (q50) and quantile trees (q10/q90), split-conformal calibrated |
| `AIP-ANOM-INV-1` inverter anomalies | Isolation Forest on fleet-relative daily features, robust-z explanations |
| `AIP-DRIFT-CUSUM-1` plant drift | Two-sided CUSUM on daily performance, change point by likelihood |
| `AIP-LIFE-1` life models | Right-censored Weibull / lognormal / exponential MLE, AICc selection, bootstrap |
| `AIP-RUL-1` remaining life | Conditional reliability with a health proportional-hazards multiplier |
| `AIP-MAINT-1` MTBF / MTTR | Life-history exposure, corrective work-order repair times |
| `AIP-RISK-1` composite risk | Expected loss (lost generation × tariff + repair) × safety weight; governed bands |
| `AIP-BESS-SOH-1` battery health | Fade relative to the OEM plan from capacity tests, shrunk to the fleet |
| `AIP-RAR-MC-1` revenue at risk | Monte Carlo over the forecast distribution and asset outages |
| `AIP-SPARES-1` spares | Croston / SBA / TSB on a holdout; reorder points by criticality service level |

The model cards are governed in `schema/analytics/models.json`. A back-test on the governed workbook (`pnpm --filter @sustantix/analytics backtest`, report `docs/analytics/model-report.md`) is a CI gate. Results persist as `aip.model_run` and `aip.model_output`:
- outputs are append-only and audited once per batch;
- quantiles are kept ordered;
- `v_model_output_latest` serves each model's latest successful run.

Hosts build the dataset through one interface (`TenantSource`). The workbook supplies it for the back-test; the database supplies it through the code views on Vercel.

## Agents (`packages/agents`)

Ten agents are defined in `schema/agents/agents.json`:
- AIP Copilot
- Reliability
- Forecast
- Maintenance Planning
- Spares
- Battery Storage
- Warranty Recovery
- Sustainability Reporting
- Data Quality Steward
- Commercial

Each agent has a minimum role, the screens it serves, an allow-list of tools and the proposal types it may raise. Claude (Messages API, tool use) plans; AIP's tools act:
- `query_master` and `get_record` read the code views and lineage.
- `latest_model_outputs`, `top_risks` and `model_catalogue` read the analytics results.
- `create_proposal` is the only tool that writes. It writes a **pending** proposal.

Guardrails:
- **Permissions:** agents run with the caller's own permissions, so RLS applies. Proposals need a planner or administrator, and each one is validated against its type's schema and its subject's existence. Duplicate pending proposals are refused, and proposals are capped per request.
- **Bounds and untrusted data:** tool rounds are capped. Tool results are wrapped as data and truncated. The system rules state that data is never instructions, and client context (such as the Assistant screen's data summary) is passed only as data.
- **Logging:** every run and step is logged (`aip.agent_run`, `aip.agent_step`).
- **Decisions:**
  - People decide every proposal: pending → approved or rejected, then applied or failed. Each decision is one-way and recorded by the deciding user.
  - Approval applies with the decider's own rights (`aip.apply_agent_proposal`). An intervention or inspection proposal adds an intervention under review; a reschedule updates the intervention it names. Other types stay approved, for downstream systems to act on.
- **Configuration:** the model key (`ANTHROPIC_API_KEY`) stays on the server. Without it the agent endpoints answer 503.

The Dataverse edition provisions the same run, output, agent-run and proposal tables. Its agent runtime (Copilot Studio or an Azure Function host over the same catalogue) is the next step.

## Multi-region

- **Currency:** stored per row. The tenant default currency is configurable (`aip.tenants.default_currency`); FX conversion comes from the stored daily rate table.
- **Region:** `aip.tenants.region` identifies the jurisdiction. The seed tenant is India (INR, BRSR), and nothing in the platform layer assumes India.
- **Sustainability frameworks:** framework selection (BRSR / ISSB / GRI / CSRD) is data in `SUS_Framework_Mapping`, not code.

## Roadmap

- **Phase 3 (done):** transactions, time series, `record_link`, compatibility views and the governed-data boot seam. Next within it: rebuild the master-replaced sheets (sites, assets, parts…) through compatibility views too, and move the modules that still read only their bundled datasets onto the governed workbook.
- **Phase 4:** change-set API with `row_version` and the Sustantix Enterprise Grid on the governed views.
- **Phase 5:** staging and data-quality quarantine, outbox (approved proposals to ERP/EAM), realtime, Dataverse sync, and scheduled agent runs.

## Evolution path

The runtime is intentionally the reference code. Future work replaces it screen by screen with typed modules behind the same host bridge. Each replacement must keep `apps/runtime/test/parity.mjs` green, or deliberately update the reference with a sign-off.
