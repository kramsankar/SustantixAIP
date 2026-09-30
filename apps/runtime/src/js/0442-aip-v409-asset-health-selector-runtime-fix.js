
window.AIP_V409_AUDIT={
 release:'v409',baseline:'v408',
 scope:'Operational Foundations · Asset Health Scoring Framework · Test & Explain selector',
 uiOnly:true,excelChanged:false,syntheticBusinessDataChanged:false,
 rootCause:'The Test & Explain selector was reading window-scoped stores, while AIP defines APM_IMPORTED_DATA and EMBEDDED_EXCEL_DATA as lexical globals; therefore the selector received no governed Asset Master rows.',
 changes:[
  'Reads APM_IMPORTED_DATA and EMBEDDED_EXCEL_DATA directly using the same runtime scope as the rest of AIP',
  'Falls back to other governed asset stores only when needed',
  'Populates Test & Explain with governed Asset Master records in the active data mode',
  'Preserves the duplicate-instruction removal from v408',
  'No Asset Health formulas, weights, thresholds, source evidence or business data changed'
 ]
};
