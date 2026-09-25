
(function(){
  /* v2.00 called the Planning closure's private sheet() accessor from a global
     weather helper.  Intervention Schedule therefore threw before rendering.
     Resolve the governed weather dataset locally using the active data mode. */
  window.weatherForIntervention=function(r){
    const dt=String((r&&r.schedule&&r.schedule.Planned_Start)||(r&&r.Planned_Start)||'').slice(0,10);
    const plant=String((r&&r.Plant_ID)||'');
    let active=[];
    let sourceMode='Excel';
    try{
      if(typeof predictiveDataModeV752==='function') sourceMode=String(predictiveDataModeV752()||'Excel');
      else {
        const m=String(window.APM_DATA_MODE||window.DATA_SOURCE_MODE||window.dataMode||'').toLowerCase();
        sourceMode=(m==='demo data'||m.includes('synthetic'))?'Synthetic':'Excel';
      }
    }catch(_e){ sourceMode='Excel'; }
    if(sourceMode==='Synthetic'){
      const p=window.AIP_INDEPENDENT_SYNTHETIC_DATA&&window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData;
      if(p&&Array.isArray(p.PLAN_Weather_Forecast)) active=p.PLAN_Weather_Forecast;
    }else{
      const imp=window.APM_IMPORTED_DATA;
      if(imp&&Array.isArray(imp.PLAN_Weather_Forecast)&&imp.PLAN_Weather_Forecast.length) active=imp.PLAN_Weather_Forecast;
      if(!active.length&&window.EMBEDDED_EXCEL_DATA&&Array.isArray(window.EMBEDDED_EXCEL_DATA.PLAN_Weather_Forecast)) active=window.EMBEDDED_EXCEL_DATA.PLAN_Weather_Forecast;
    }
    if(!active.length&&window.EMBEDDED_EXCEL_DATA&&Array.isArray(window.EMBEDDED_EXCEL_DATA.PLAN_Weather_Forecast)) active=window.EMBEDDED_EXCEL_DATA.PLAN_Weather_Forecast;
    const arr=active.filter(x=>String(x&&x.Plant_ID||'')===plant);
    return arr.find(x=>String(x&&x.Valid_From||'').slice(0,10)===dt)||arr.find(x=>String(x&&x.Valid_From||'').slice(0,10)>=dt)||null;
  };
  window.AIP_V201_AUDIT={release:'v2.01',baseline:'v2.00',excelBusinessDataChanged:false,changes:[
    'Fixed Intervention Schedule render freeze caused by cross-scope weather lookup',
    'Weather Context legend moved right as one group after Resource Unavailable',
    'Weather Low standardized to blue fill/blue border',
    'Weather Moderate standardized to amber fill/amber border',
    'Weather High standardized to light red fill/red border',
    'Resource Calendar weather cells now use the exact same fill and full border as the legend'
  ]};
})();
