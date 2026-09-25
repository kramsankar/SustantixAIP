
(function(){
 const ADD=__AIP_DS("988337cfeeeef646");
 const keyMap={'MSI_Part_Master':'Part_ID','MSI_Spare_Requirements':'Requirement_ID','MSI_ERP_Spares':'Record_ID','PNO_Interventions':'Intervention_ID','Work Orders':'Work_Order_ID'};
 function merge(dst,name){if(!dst)return; if(!Array.isArray(dst[name]))dst[name]=[]; const k=keyMap[name],seen=new Set(dst[name].map(x=>String(x&&x[k]||''))); (ADD[name]||[]).forEach(x=>{if(!seen.has(String(x[k]||''))){dst[name].push(x);seen.add(String(x[k]||''))}})}
 Object.keys(ADD).forEach(n=>{merge(window.EMBEDDED_EXCEL_DATA,n);merge(window.AIP_INDEPENDENT_SYNTHETIC_DATA&&window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData,n);});
 window.AIP_V676_DATA_HARDENING={release:'v676',baseline:'v675',sites:12,parts:28,scope:'Data/model hardening and longitudinal maintenance-spares expansion',expanded:Object.fromEntries(Object.entries(ADD).map(([k,v])=>[k,v.length])),generationForecastIntervalsChanged:false,forecastAlgorithmsChanged:false,optimizationAlgorithmsChanged:false,excelSyntheticParity:true};
 window.AIP_CURRENT_BUILD='v676';
})();
