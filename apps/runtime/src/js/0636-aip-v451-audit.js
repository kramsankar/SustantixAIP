
window.AIP_V451_AUDIT={
 release:'v451',
 baseline:'AIP v450',
 area:'Work Order Intelligence visible six KPI cards',
 uiOnly:true,
 excelBusinessDataChanged:false,
 syntheticBusinessDataChanged:false,
 rootCause:'The visible Work Order KPI cards are rendered by the stable wo213 renderer (.wo213-label/.wo213-value). Earlier v449/v450 patches targeted legacy ops/ov121 KPI classes, so the visible six cards retained 9px titles and 17px values.',
 portfolioReference:{
   title:'8px / 700 / 9.5px / #607681 / .26px uppercase',
   value:'10.5px / 800 / 14px / #173f57',
   unit:'7.5px / 700 / 11px / #607681'
 },
 changes:[
   'Corrected the actual visible six Work Order Intelligence KPI title elements (.wo213-label)',
   'Corrected the actual visible six Work Order Intelligence KPI value elements (.wo213-value)',
   'Corrected the actual visible unit spans inside the six values',
   'No KPI values, bars, card geometry, Work Order behavior, navigation or data changed'
 ]
};
