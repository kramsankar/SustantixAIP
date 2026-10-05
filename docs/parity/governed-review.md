# Governed-mode baseline — review notes

**Status: proposed, pending review by the product owner.** CI holds governed mode to `reference/v915-governed-crawl.json` exactly, so any further change is a deliberate re-baseline. The bundled-data parity (all 29 screens identical to v9.15) is unchanged and still required.

Run: 29 screens, 0 page errors (reference 0). Unchanged: 14. Changed: 15 (`governed-baseline.md` lists the first difference on each).

## Why screens change

| Cause | Screens | Example |
| --- | --- | --- |
| Governed corrections add the records the workbook referenced but lacked (C1–C12) | Operations Hub, Portfolio Intelligence, Asset Explorer, Work Order Intelligence, Maintenance Strategy, Planning & Optimization, Maintenance Spares Intelligence, Portfolio Action Prioritization, Data Management | Assets 969 → 1,205 (historical, case and event-log assets); open work orders 95 → 172 (planned WO-20xxx/40xxx and HSE-cited WO-7xxx); spare demand 28 → 78 units (re-keyed planning parts) |
| Newer governed workbook values replace older copies bundled in the runtime | Enterprise Integration, Reliability Engineering, Sustainability Performance | Connector status "Defined in demo" → "Configured"; data-mode label "Excel demo data" → "Uploaded data" |
| Source asset classes of corrected records appear in class lists | Asset Relationships | Classes such as "Electrical", "SCADA" and "Cleaning" now listed (they come from the historical asset series C1 added) |

## Decisions needed

1. **AI Guardrails** shows 0 evaluated actions instead of 71. The governed `AI Guardrail Decisions` sheet is empty; the 71 were demo entries bundled in the runtime. Governed mode shows the tenant's truth (no decisions yet). Accept, or seed demo tenants with a decision log.
2. **Operational Twin** solar window reads 06:15–19:00 instead of 06:00–19:00. The window is derived from the governed engineering and forecast sheets rather than the bundled copy. Accept, or align the governed twin parameters with the bundle.
3. **Asset class labels** of the corrected asset series ("Electrical", "SCADA", "Cleaning") are their source spellings. The vocabulary maps them to ELECTRICAL_BOP, SCADA_SYSTEM and PV_ARRAY. Accept, or show canonical labels by rebuilding Asset Master through a compatibility view (planned next in phase 3).

Once accepted, change the status line above to "accepted" with the date.
