# Power Platform runbook

**Confidential — Sustantix.**

Sustantix builds AIP in its own Power Platform account, exports it as a **managed solution**, and customers import it into their tenant. Everything ships inside the `SustantixAIP` solution (publisher `sustantix`, prefix `sus`):

| Component | Detail |
|---|---|
| Code app | *Sustantix Asset Intelligence Platform* (the v732 runtime) |
| Platform tables | `sus_runtimestate`: workbook-import snapshot, gzip JSON file column. `sus_licensestate`: anti-rollback memory, plug-in only. |
| Data-model tables | 107 `sus_*` tables generated from the governed workbook, each with an alternate key `sus_<table>_bk` and native multi-currency Money columns. Optional. |
| Plug-in assembly | `Sustantix.Aip.Licensing`: `LicenseGuard` steps and the `sus_GetLicenseStatus` Custom API |
| Environment variables | `sus_LicenseKey`, `sus_LicenseRevocationList` |
| Security roles | *Sustantix AIP User* (read). *Sustantix AIP Administrator* (read/write, workbook import). |

## A. One-time setup in the Sustantix build environment

1. Create a **Production-type** Dataverse environment for builds (for example *Sustantix AIP Build*). Enable code apps under Power Platform admin center → Environment → Settings → Features → *Power Apps code apps*.
2. Register an Entra app (service principal), add it as a Dataverse **application user** with System Administrator, and store `PP_ENV_URL`, `PP_TENANT_ID`, `PP_CLIENT_ID` and `PP_CLIENT_SECRET` in the GitHub environment `powerplatform-build`.
3. Generate the plug-in strong-name key once (`dotnet run --project tools/snkgen -- <vault>/aip-plugin.snk`) and store it base64-encoded as `SX_PLUGIN_SNK_B64`.
4. Generate the license signing key (see [licensing.md](licensing.md)) and commit the public keyset.
5. Initialise the code app once: in `apps/powerapp`, run `pac auth create --environment <url>`, then `pac code init --displayName "Sustantix AIP"`. Commit the resulting `power.config.json`.

## B. Build a release

Run the **release-powerplatform** workflow with version `7.32.0.0`, or run the same steps locally:

```bash
pnpm install && pnpm --filter @sustantix/license build
dotnet build powerplatform/plugins/Sustantix.Aip.Licensing -c Release -p:SxSnkPath=<vault>/aip-plugin.snk

# Idempotent: safe to re-run; only missing components are created
pnpm --filter @sustantix/pp-provision sx-pp provision --env $PP_ENV_URL --version 7.32.0.0 --data-model

cd apps/powerapp
pac code add-data-source -a dataverse -t sus_runtimestate
node scripts/build.mjs --release          # refuses test keys in release builds
pac code push --solutionName SustantixAIP

pac solution export --name SustantixAIP --managed   --path out/SustantixAIP_7.32.0.0_managed.zip
pac solution export --name SustantixAIP             --path out/SustantixAIP_7.32.0.0_unmanaged.zip
```

Only the **managed** package goes to customers. The unmanaged package stays in Sustantix's source vault.

Before exporting, set the plug-in steps and the Custom API as **not customisable**. In the maker portal, select the component, open *Managed properties*, and turn *Can be customized* off. Customers then cannot disable the license guard.

## C. Roll out to a customer

1. Customer admin: create or choose an environment with Dataverse, enable code apps, and confirm the **INR** currency exists. For other currencies, provision with `--fx <ISO>=<rate>`.
2. Import `SustantixAIP_<ver>_managed.zip`, either from **Solutions → Import** or with `pac solution import --path … --activate-plugins`.
3. Read the organisation id from `sx-pp whoami --env <url>` or from Settings → Session details. Send it to Sustantix.
4. Sustantix issues a trial or paid license bound to that organisation id. The customer pastes it into the environment variable **Sustantix AIP license key**.
5. Assign *Sustantix AIP User* or *Sustantix AIP Administrator* to users or teams, and share the app.
6. Optional: load the governed workbook through **Data Management** in the app (admin role), or seed the relational model with `sx-pp provision --seed <workbook.xlsx>`.

**Upgrades:** import the newer managed package (`pac solution import --stage-and-upgrade`). The license stays valid, because it is bound to the organisation, not to the solution version.

## What was verified before handover

- The plug-in builds for .NET Framework 4.6.2 and signs with a strong-name key. Its verifier passes the shared conformance suite.
- The provisioning plan runs end to end against an in-memory Dataverse double. A second run creates nothing, and every create carries the `MSCRM.SolutionUniqueName: SustantixAIP` header.
- The code-app bundle builds, and the runtime inside it is proven screen-identical to v732.

These were *not* possible from the build container and must be done on the first run in the Sustantix build environment:

1. The first live `sx-pp provision`: Web API metadata calls against a real org.
2. `pac code push`: the code-app hosting size limits for the ~65 MB bundle (57 MB of it governed datasets).
3. A managed export and import round trip.

If the bundle exceeds the code-app limits, the fallback is to move the datasets out of the bundle into a Dataverse file column and have the host bridge fetch them before the runtime boots. This fallback is **not yet implemented**; it is a contained change in `packages/host-bridge` and `apps/runtime/build.mjs`.
