
window.AIP_V390_AUDIT={
 release:'v390',baseline:'v389',
 area:'Maintenance Learning & Recovery first-entry stability and KPI titles',
 uiOnly:true,excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false,
 rootCause:'The final Learning & Recovery authority retained multiple legacy timed repaint sequences (0/40/140/320 ms and 0/30/100/250 ms) plus an 80 ms startup repaint. Those were redundant after the mutation-based immediate repair and caused visible first-entry KPI movement.',
 changes:[
  'Removed repeated timed first-entry rerenders from the authoritative activate path',
  'Removed repeated timed rerenders from the left-navigation capture path',
  'Removed the extra delayed startup repaint',
  'Retained one immediate authoritative render plus one requestAnimationFrame verification after activation',
  'Retained mutation-based immediate repair if any stale renderer replaces the active workspace',
  'Made all eight Maintenance Learning & Recovery KPI titles uppercase',
  'Policy Optimization and OEM & Warranty tab-switch behavior is unchanged',
  'No KPI values, calculations, Excel data or Synthetic business evidence changed'
 ]
};
