
(function(){
  'use strict';
  var serial=0, pending=0, attempts=0, lastCanvas=null, sourceDirty897=false;
  function active(){
    var parent=document.getElementById('view-portfoliointelligence');
    var overview=document.getElementById('view-overview');
    return !!(parent&&overview&&parent.classList.contains('active')&&overview.classList.contains('active'));
  }
  function ready(){
    try{return Array.isArray(PLANTS)&&PLANTS.length>0&&
      Array.isArray(ALL_WOS)&&ALL_WOS.length>0&&
      Array.isArray(ASSET_REGISTRY)&&ASSET_REGISTRY.length>0&&
      Array.isArray(PR_TREND)&&PR_TREND.length>0&&
      Array.isArray(ESG_MONTHLY)&&ESG_MONTHLY.length>0&&
      Array.isArray(CORRECTIVE_WOS)&&Array.isArray(PREVENTIVE_WOS)&&
      Array.isArray(ADAPTIVE_WOS)&&Array.isArray(PREDICTIVE_WOS);
    }catch(_){return false;}
  }
  function paintCharts(){
    if(!active())return;
    var pr=document.getElementById('chartPRTrend');
    if(!pr||!pr.isConnected||!pr.parentElement||pr.parentElement.clientWidth<1)return;
    try{
      CH.overview=[];
      CH_LAYOUT_SIG.overview='';
      initOverviewCharts();
      resizeView('overview',true);
      lastCanvas=pr;
    }catch(e){console.warn('v879 Overview chart paint',e);}
  }
  function settle(){
    if(!active())return;
    if(!ready()){retry();return;}
    try{
      const host=document.getElementById('view-overview');
      if(sourceDirty897||!host?.querySelector('.ov527-all-kpis')){renderOverview();sourceDirty897=false;}
      requestAnimationFrame(function(){requestAnimationFrame(paintCharts)});
    }catch(e){console.warn('v879 Overview render',e);retry();}
  }
  function retry(){
    if(!active()||++attempts>20)return;
    var id=serial;
    setTimeout(function(){if(id===serial)settle()},300);
  }
  function schedule(){
    ++serial;
    attempts=0;
    clearTimeout(pending);
    pending=setTimeout(settle,30);
  }
  function boot(){
    var parent=document.getElementById('view-portfoliointelligence');
    var overview=document.getElementById('view-overview');
    if(parent&&overview){
      var observer=new MutationObserver(function(records){
        if(records.some(function(r){return r.type==='attributes'&&r.attributeName==='class'})&&active())schedule();
      });
      observer.observe(parent,{attributes:true,attributeFilter:['class']});
      observer.observe(overview,{attributes:true,attributeFilter:['class']});
      var canvasObserver=new MutationObserver(function(){
        if(active()&&document.getElementById('chartPRTrend')!==lastCanvas)
          requestAnimationFrame(function(){requestAnimationFrame(paintCharts)});
      });
      canvasObserver.observe(overview,{childList:true});
    }
    schedule();
  }
  ['aip:data-source-changed','apm:datasource-refreshed','aip:data-rendered','aip:runtime-ready'].forEach(function(name){
    document.addEventListener(name,function(){if(name==='aip:data-source-changed'||name==='apm:datasource-refreshed')sourceDirty897=true;schedule()});
  });
  document.addEventListener('click',function(e){
    if(e.target.closest('[data-view="portfoliointelligence"],[data-aip500-tab="overview"]'))
      setTimeout(schedule,0);
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  window.AIP_CURRENT_BUILD='v879';
})();
