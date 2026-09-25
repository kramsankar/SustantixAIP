
window.AIP_V392_AUDIT={
 release:'v392',baseline:'v391',
 area:'Maintenance Learning & Recovery first left-pane entry',
 uiOnly:true,excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false,
 rootCause:'The core renderFns registry captured the original lexical renderMaintenanceLearning function long before the later v856 authoritative workspace replaced window.renderMaintenanceLearning. Therefore the first lazy render from the left pane explicitly invoked the legacy KPI screen; subsequent Policy/OEM tab interactions invoked v856.',
 changes:[
  'Replaced the core renderFns Maintenance Learning entry with a dynamic call to the final v856 renderer',
  'Added a dedicated maintenancelearning branch in the core activate() router so first left-pane entry bypasses the legacy renderer entirely',
  'Core entry resets the unified workspace to Policy Optimization and validates that exactly eight canonical KPI cards were rendered',
  'Updated Operational Reliability learning navigation to use the same final renderer instead of the old lexical function',
  'Preserved uppercase eight-KPI titles in Policy Optimization and OEM & Warranty Learning',
  'No KPI values, calculations, Excel data or Synthetic evidence changed'
 ]
};
