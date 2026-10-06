
window.AIP_V393_AUDIT={
  release:'v393',baseline:'v392',
  area:'Maintenance Learning & Recovery first-entry KPI authority only',
  uiOnly:true,excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false,
  rootCause:'At least one accumulated call path still referenced the original lexical renderMaintenanceLearning() function directly. Replacing window.renderMaintenanceLearning and the core renderFns mapping did not affect those lexical references.',
  changes:[
    'Added an absolute guard at the start of the original legacy renderMaintenanceLearning() function: once v856 exists, every legacy call delegates immediately to the canonical renderer and the old KPI markup cannot execute',
    'The left-pane Maintenance Learning & Recovery click is now owned in capture phase; older sidebar bubble handlers are stopped for this route',
    'Direct entry explicitly activates Maintenance Learning & Recovery and renders Policy Optimization with the canonical eight KPI cards',
    'Preserved the correct KPI set: Qualified Learning Cases, Optimization Candidates, Awaiting Governance, Implemented Changes, Repeat-Failure Exposure, Value Recovery Opportunity, OEM / Warranty Opportunity, Verified Benefit',
    'Preserved uppercase titles and existing Policy Optimization / OEM & Warranty Learning tab behavior',
    'No KPI values, calculations, Excel data or Synthetic evidence changed'
  ]
};
