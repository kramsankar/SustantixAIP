
window.AIP_V391_AUDIT={
 release:'v391',baseline:'v390',
 area:'Maintenance Learning & Recovery canonical first frame',
 uiOnly:true,excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false,
 rootCause:'A legacy Maintenance Learning renderer could still become visible during the first left-pane activation before the final v856 workspace reclaimed the DOM. v390 also targeted the wrong KPI label class for capitalization.',
 changes:[
  'Pre-renders the authoritative Maintenance Learning & Recovery workspace while its view is still hidden at startup',
  'On direct left-pane entry, resets the workspace to Policy Optimization and renders it synchronously in capture phase before normal navigation reveals the view',
  'Suppresses any non-v856 stale Maintenance Learning frame if legacy code replaces the active view; existing mutation repair then restores the canonical workspace',
  'Uppercases the eight KPI titles in the authoritative KPI markup itself, not only through CSS',
  'The same eight uppercase KPI titles remain visible in Policy Optimization and OEM & Warranty Learning',
  'No KPI values, bars, calculations, Excel data, Synthetic evidence or downstream tab content changed'
 ]
};
