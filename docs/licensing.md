# Licensing: SXL1

**Confidential — Sustantix.**

Every AIP installation runs on a Sustantix-signed license. A license is bound to one customer environment, names the modules it unlocks, and expires on a fixed date. Trials are fixed-length and cannot be extended by the customer.

## Token format

```
SXL1.<kid>.<base64url(payload JSON)>.<base64url(signature)>
```

- **Signature:** RSASSA-PKCS1-v1_5 with SHA-512 over the ASCII text `SXL1.<kid>.<payload>`. The signing key must be RSA and at least **4096 bits**; the issuer refuses weaker keys and every verifier rejects them.
- **`kid`:** selects the trusted public key, which allows key rotation without invalidating existing licenses.
- **Payload:** `v`, `lid` (license id), `customer {id,name}`, `edition` (`trial | standard | enterprise`), `platform` (`powerplatform | vercel | any`), `bind`, `iat/nbf/exp` (epoch seconds), `trialDays`, `graceDays`, `seats`, `modules` (`["*"]` or any of `portfolio`, `enterprise`, `maintenance`, `sustainability`; `core` is always granted).
- **Revocation:** a separately signed `SXR1` list of revoked `lid`s.

## Verification rules (identical in TypeScript and .NET)

1. **Fail closed.** A build with no trusted keys, a missing token or any parse error means no access.
2. The signature must verify with a trusted `kid`. Tampering with any payload byte invalidates it.
3. The payload is strictly validated (types, GUID formats, bounds).
4. **Platform** must match (`any` matches both).
5. **Binding.** At least one binding must be *proven* by the runtime, and every binding the runtime can observe must match:
   - **Dataverse plug-in:** `bind.orgId` is required and compared with the execution context's `OrganizationId`. The client cannot supply this value.
   - **Vercel:** `bind.domains` is compared with the request host on the server.
6. **Trial policy.** `trialDays` is between 1 and 90, the window equals the granted days, and there is no grace period.
7. **Revocation.** A signed list can revoke any `lid`.
8. **Clock rollback.** The server stores `lastSeen` per license. A clock that moves back more than one hour is flagged as `clock_tamper`. Dataverse keeps this in `sus_licensestate`, which only the plug-in writes; Vercel keeps it in `aip.license_clock`, which only the service role writes.
9. **Validity and access:**

   | State | Access |
   |---|---|
   | before `nbf` | none |
   | `nbf` to `exp` | full |
   | after `exp`, paid edition, within `graceDays` | read-only |
   | otherwise | expired, no access |

Both verifiers run the same signed conformance fixtures (`powerplatform/plugins/Sustantix.Aip.Licensing.Tests/fixtures`), so they cannot drift apart silently.

## Where enforcement happens

| Layer | Power Platform | Vercel |
|---|---|---|
| Authoritative | `LicenseGuard` plug-in, synchronous PreValidation on Create/Update/Delete/Retrieve/RetrieveMultiple of AIP tables. Throws before any data is returned or written. | Server verdict in API middleware: `402` for unlicensed calls; writes need `full` access. |
| Verdict API | Custom API `sus_GetLicenseStatus` | `GET /api/aip/license` |
| Experience | Host bridge: license panel instead of sign-in, trial countdown badge, module gating, lock screen on periodic re-check | same |

The browser-side checks are presentation only. Access decisions are always made server-side, where the customer controls neither the clock nor the code.

## Key custody

- Generate signing keys **offline** on the Sustantix issuing workstation:
  `pnpm --filter @sustantix/license-cli sx-license keygen --kid sx-prod-2026 --out <vault-path> --keyset config/license/trusted-keys.json`
  The CLI refuses to write private keys inside a git repository and creates them with mode `0600`.
- Commit only `config/license/trusted-keys.json`, which holds public keys. Builds embed it: the plug-in as an embedded resource, and the host bridge and web server at build time.
- **Rotation:** add the new `kid`, ship a release, issue new licenses with it, and remove the old `kid` only after its licenses expire.
- The plug-in's strong-name key (`tools/snkgen`) fixes the assembly identity across upgrades. Store it as the CI secret `SX_PLUGIN_SNK_B64`.

## Issuing

```bash
# Discover the customer's Dataverse organisation id (run with their admin, or from the provisioning report)
pnpm --filter @sustantix/pp-provision sx-pp whoami --env https://<org>.crm.dynamics.com

# 30-day trial, all modules
sx-license trial --key <vault>/sx-prod-2026.private.pem --kid sx-prod-2026 \
  --customer-id CUST-0042 --customer-name "<customer>" --platform powerplatform \
  --org <organisation-guid> --trial-days 30 --ledger <vault>/issuance.jsonl

# Annual enterprise license, 15-day read-only grace, two modules
sx-license issue --key ... --kid sx-prod-2026 --customer-id CUST-0042 --customer-name "<customer>" \
  --edition enterprise --platform powerplatform --org <guid> --days 365 --grace 15 \
  --modules portfolio,maintenance --ledger <vault>/issuance.jsonl

# Web deployment bound to a hostname
sx-license issue ... --platform vercel --domain aip.customer.com --days 365

# Revoke
sx-license revoke --key ... --kid sx-prod-2026 --lid <license-id> > revocation.sxr1
```

Every issue and revocation is appended to the ledger, giving an audit trail of what was issued, to whom, and when.

## Installing a license

- **Power Platform:** set the environment variable **Sustantix AIP license key** (`sus_LicenseKey`) in the solution, or run `sx-pp set-license --env <url> --token <SXL1…>`. The guard applies it within five minutes (or immediately, via `sus_GetLicenseStatus` with `Refresh=true`).
- **Vercel:** set the `AIP_LICENSE_KEY` environment variable on the project and redeploy.
