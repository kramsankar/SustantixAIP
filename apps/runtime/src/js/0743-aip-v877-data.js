(function(){
'use strict';
function install(store){if(!store)return;
  var b=store.platformSyntheticData&&store.platformSyntheticData['BESS Systems']?store.platformSyntheticData:store;
  if(Array.isArray(b['BESS Operating Limits']))b['BESS Operating Limits'].forEach(function(r){if(r.Residual_Tolerance_Pct==null)r.Residual_Tolerance_Pct=1;if(r.SoC_Drift_Tolerance_Pct==null)r.SoC_Drift_Tolerance_Pct=2});
  if(Array.isArray(b['BESS Safety & Compliance']))b['BESS Safety & Compliance'].forEach(function(r){if(r.Evidence_Document_ID==null)r.Evidence_Document_ID=''});
  if(!Array.isArray(b['BESS Component Register']))b['BESS Component Register']=[];
}
try{install(window.EMBEDDED_EXCEL_DATA)}catch(e){console.error('v877 data install',e)}
try{install(window.AIP_INDEPENDENT_SYNTHETIC_DATA)}catch(e){console.error('v877 synthetic data install',e)}
try{if(window.APM_SHEET_RULES){window.APM_SHEET_RULES['BESS Component Register']={required:['Component_ID','BESS_ID','Parent_Asset_ID','Level','Evidence_Document_ID'],key:['Component_ID'],group:'BESS'};
  window.APM_SHEET_RULES['Forecast Weather']={required:['Plant_ID','Forecast_Run_Timestamp','Interval_Start','Clear_Sky_Index'],key:['Plant_ID','Forecast_Run_Timestamp','Interval_Start'],group:'Generation Forecast'};}}catch(e){console.error('v877 importer rules',e)}
})();
