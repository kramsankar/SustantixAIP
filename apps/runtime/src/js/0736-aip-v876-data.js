
/* AIP v876 · bundled workbook data (Twin Telemetry = 30 days from an independent demo simulator): BESS sheets, tracker-aware twin
   parameters and telemetry, inverter configuration and telemetry, inverter master-data corrections, single PPA-tariff source.
   Installed into the app's data stores like every other bundled sheet; engine and UI code hold no values. */
(function(){
var DATA=__AIP_DS("96c292900a8f24d4");
function expand(sh){Object.keys(sh).forEach(function(k){var v=sh[k];if(v&&v.__cols){var c=v.__cols;sh[k]=v.__rows.map(function(r){var o={};for(var i=0;i<c.length;i++)o[c[i]]=r[i];return o})}})}
expand(DATA.excel.sheets);expand(DATA.synth.sheets);
function install(store,src,book){
  if(!store||!src)return;
  Object.keys(src.sheets).forEach(function(k){store[k]=src.sheets[k]});
  var tgt=book||store,am=tgt['Asset Master'];
  if(Array.isArray(am)){var byId={};am.forEach(function(a){byId[a.Asset_ID]=a});
    src.assetUpdates.forEach(function(u){var a=byId[u.Asset_ID];if(a)a.Rated_Capacity_MW=u.Rated_Capacity_MW});
    src.assets.forEach(function(a){if(!byId[a.Asset_ID]){am.push(Object.assign({},a));byId[a.Asset_ID]=1}})}
  if(Array.isArray(tgt['Warranty Register'])){var hw={};tgt['Warranty Register'].forEach(function(w){hw[w.Warranty_ID]=1});(src.warranty||[]).forEach(function(w){if(!hw[w.Warranty_ID])tgt['Warranty Register'].push(Object.assign({},w))})}
  if(Array.isArray(tgt['Spare Parts Master'])){var hp={};tgt['Spare Parts Master'].forEach(function(p){hp[p.Part_ID]=1});src.parts.forEach(function(p){if(!hp[p.Part_ID])tgt['Spare Parts Master'].push(Object.assign({},p))})}
  if(Array.isArray(tgt['Sites'])){tgt['Sites'].forEach(function(s){var x=src.sites[s.Plant_ID];Object.assign(s,x||{Has_BESS:'No',BESS_ID:null,Timezone:'Asia/Kolkata'},src.sitePatch[s.Plant_ID]||{})})}
}
/* one governed PPA tariff: VE_Rate_Config "PPA Tariff" rows follow Commercial & PPA */
function alignTariff(book,ppaBook){
  try{var ve=book&&book.VE_Rate_Config,ppa=(ppaBook&&ppaBook['Commercial & PPA'])||(book&&book['Commercial & PPA']);if(!Array.isArray(ve)||!Array.isArray(ppa))return;
    var t={};ppa.forEach(function(r){t[r.Plant_ID]=Number(r.PPA_Tariff_INR_kWh)});
    ve.forEach(function(r){if(String(r.Rate_Type)==='PPA Tariff'&&Number.isFinite(t[r.Applies_To])&&Number(r.Rate_or_Value)!==t[r.Applies_To]){r.Previous_Value=r.Rate_or_Value;r.Rate_or_Value=t[r.Applies_To];r.Source_Object='Commercial & PPA · PPA_Tariff_INR_kWh (aligned v874)'}})}catch(e){}
}
var X=null,S=null;try{X=EMBEDDED_EXCEL_DATA}catch(e){}try{S=AIP_INDEPENDENT_SYNTHETIC_DATA}catch(e){}
try{install(X,DATA.excel)}catch(e){console.error('v874 excel install',e)}
try{if(window.EMBEDDED_EXCEL_DATA&&window.EMBEDDED_EXCEL_DATA!==X){var tw=window.EMBEDDED_EXCEL_DATA;['Inverter Configuration','Inverter Telemetry','Forecast Weather','Forecast Runs','Forecast Input Snapshots','Planned Outages','Forecast Settings'].concat(Object.keys(DATA.excel.sheets).filter(function(k){return /^BESS/.test(k)})).forEach(function(k){tw[k]=DATA.excel.sheets[k]})}}catch(e){}
try{install(S,DATA.synth,S&&S.platformSyntheticData||{})}catch(e){console.error('v874 synthetic install',e)}
try{if(window.AIP_INDEPENDENT_SYNTHETIC_DATA&&window.AIP_INDEPENDENT_SYNTHETIC_DATA!==S){var ws=window.AIP_INDEPENDENT_SYNTHETIC_DATA;['Inverter Configuration','Inverter Telemetry','Forecast Weather','Forecast Runs','Forecast Input Snapshots','Planned Outages','Forecast Settings'].concat(Object.keys(DATA.synth.sheets).filter(function(k){return /^BESS/.test(k)})).forEach(function(k){ws[k]=DATA.synth.sheets[k]})}}catch(e){}
alignTariff(window.EMBEDDED_EXCEL_DATA,X);alignTariff(X,X);
try{alignTariff(S&&S.platformSyntheticData,S&&S.platformSyntheticData)}catch(e){}
try{alignTariff(window.AIP_INDEPENDENT_SYNTHETIC_DATA&&window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData,S&&S.platformSyntheticData)}catch(e){}
/* model registry must not present an untrained residual model as production */
function fixRegistry(book){if(!book)return;['AI Model Registry','FCST_Model_Governance'].forEach(function(k){var a=book[k];if(!Array.isArray(a))return;a.forEach(function(r){if(/^MDL-SFRC-01[12]$/.test(String(r.Model_ID||''))){
  if('Deployment_Status' in r||k==='AI Model Registry')r.Deployment_Status='Not trained on plant history';r.Approval_Status='Not approved for production';
  if(k==='AI Model Registry')r.Intended_Use='Residual correction — disabled until trained on ≥ 30 days of forecast-vs-actual history (demo fit on synthetic data only)';
  else{r.Production_Note='Demo fit on synthetic data only; not used by the Generation Forecast (v876)';r.Champion_Challenger='Not deployed'}}})})}
[X,S,window.EMBEDDED_EXCEL_DATA,window.AIP_INDEPENDENT_SYNTHETIC_DATA,S&&S.platformSyntheticData,window.AIP_INDEPENDENT_SYNTHETIC_DATA&&window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData].forEach(function(bk){try{fixRegistry(bk)}catch(e){}});
try{if(typeof MODEL_REGISTRY!=='undefined'&&Array.isArray(MODEL_REGISTRY))MODEL_REGISTRY.forEach(function(r){if(/SFRC|Residual Correction/i.test(String(r.model||r.Model_ID||''))){r.status='Not trained';r.deployment='Not trained';}})}catch(e){}
try{var reg=function(nm,req,key,g){if(!APM_SHEET_RULES[nm])APM_SHEET_RULES[nm]={required:req,key:key,group:g}};
  reg('Twin Engineering Parameters',['Plant_ID','AC_Capacity_MW','DC_AC_Ratio','Latitude_Deg','Longitude_Deg'],['Plant_ID'],'Operational Twin');
  reg('Twin Telemetry',['Timestamp','Plant_ID','POA_Wm2','Actual_AC_MW'],['Plant_ID','Timestamp','Weather_Mode'],'Operational Twin');
  reg('Inverter Configuration',['Asset_ID','Plant_ID','AC_Rating_MW','DC_Capacity_MWp'],['Asset_ID'],'Operational Twin');
  reg('Forecast Weather',['Plant_ID','Forecast_Run_Timestamp','Interval_Start','Clear_Sky_Index'],['Plant_ID','Forecast_Run_Timestamp','Interval_Start'],'Generation Forecast');reg('Forecast Runs',['Plant_ID','Forecast_Run_Timestamp'],['Plant_ID','Forecast_Run_Timestamp'],'Generation Forecast');
  reg('Forecast Input Snapshots',['Plant_ID','Forecast_Run_Timestamp'],['Plant_ID','Forecast_Run_Timestamp'],'Generation Forecast');reg('Planned Outages',['Outage_ID','Plant_ID','Start','End'],['Outage_ID'],'Generation Forecast');reg('Forecast Settings',['Plant_ID'],['Plant_ID'],'Generation Forecast');
  reg('Inverter Telemetry',['Timestamp','Plant_ID','Asset_ID'],['Asset_ID','Timestamp'],'Operational Twin');
  reg('BESS Systems',['BESS_ID','Plant_ID','Rated_Power_MW','Contracted_Energy_MWh'],['BESS_ID'],'BESS');reg('BESS Specifications',['BESS_ID','Chemistry'],['BESS_ID'],'BESS');
  reg('BESS Operating Limits',['BESS_ID','SoC_Operating_Min_Pct'],['BESS_ID'],'BESS');reg('BESS Warranty & Maintenance',['BESS_ID','Warranty_Provider'],['BESS_ID'],'BESS');
  reg('BESS Commercial & Dispatch',['Contract_ID','BESS_ID'],['Contract_ID'],'BESS');reg('BESS Capacity Tests',['Test_ID','BESS_ID','Test_Date'],['Test_ID'],'BESS');
  reg('BESS Degradation Plan',['BESS_ID','Operating_Year'],['BESS_ID','Operating_Year'],'BESS');reg('BESS Safety & Compliance',['BESS_ID'],['BESS_ID'],'BESS');
  reg('BESS Controls & Comms',['BESS_ID'],['BESS_ID'],'BESS');reg('BESS Daily Operations',['Date','BESS_ID'],['BESS_ID','Date'],'BESS');
  reg('BESS Telemetry',['Timestamp','BESS_ID','SoC_Pct'],['BESS_ID','Timestamp'],'BESS');
}catch(e){console.error('v874 importer registration',e)}
})();
