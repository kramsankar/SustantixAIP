
(function(){
 const ext=__AIP_DS("ba7804246226c7d0");
 try{ Object.keys(ext).forEach(k=>{ EMBEDDED_EXCEL_DATA[k]=ext[k]; }); }catch(e){console.error('v222 Excel optimization layer',e);}
 try{ window.AIP_INDEPENDENT_SYNTHETIC_DATA=window.AIP_INDEPENDENT_SYNTHETIC_DATA||{}; const p=window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData=window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData||{}; Object.keys(ext).forEach(k=>p[k]=ext[k].map(x=>({...x}))); }catch(e){console.error('v222 Synthetic optimization layer',e);}
 window.AIP_V222_OPTIMIZATION_INPUT_AUDIT={release:'v222',sourceBaseline:'v221',rawDataMutation:false,addedSheets:Object.keys(ext),costBoundary:'Execution cost excludes Value Exposure / cost of delay',weather:'Informational only',inventoryOptimization:'Excluded'};
})();
