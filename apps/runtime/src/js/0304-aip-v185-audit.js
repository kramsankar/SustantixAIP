
window.AIP_V185_AUDIT={
 release:'v1.85',baseline:'v1.84',excelBusinessDataChanged:false,
 changes:[
  'Timeline width is now driven directly by planning-horizon days, not by the number of visible interventions or labels',
  'Six-month Daily therefore creates a full six-month day canvas; Weekly creates roughly 26 weeks; Monthly spans the full six-month period',
  'Current, optimized, approved and weather marks are fixed 6x16 vertical date markers and never stretch horizontally as the horizon changes',
  'Legend markers use the exact same 6x16 shape and colors as the Gantt markers',
  'Required Completion By diamond renders whenever its governed date lies inside the selected horizon and no longer disappears because of marker-width calculations',
  'Top and bottom scrollbars continue to control the same timeline viewport'
 ]
};
