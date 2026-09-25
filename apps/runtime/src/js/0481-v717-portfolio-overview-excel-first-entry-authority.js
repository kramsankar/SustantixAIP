
(function(){
  var timer=0, seq=0;
  function overviewIsCurrent(){
    var parent=document.getElementById('view-portfoliointelligence');
    var ov=document.getElementById('view-overview');
    return !!(parent&&parent.classList.contains('active')&&ov&&ov.classList.contains('active'));
  }
  function dataReady(){
    try{
      return Array.isArray(PLANTS)&&PLANTS.length>0 &&
             Array.isArray(PR_TREND)&&PR_TREND.length>0 &&
             Array.isArray(CORRECTIVE_WOS)&&Array.isArray(PREVENTIVE_WOS)&&
             Array.isArray(ADAPTIVE_WOS)&&Array.isArray(PREDICTIVE_WOS) &&
             Array.isArray(ESG_MONTHLY)&&ESG_MONTHLY.length>0;
    }catch(_){return false;}
  }
  function authoritativeRender(reason){
    if(!overviewIsCurrent()||!dataReady()) return false;
    try{
      /* Rebuild the Overview against the CURRENT dataset. This is deliberate:
         Excel is loaded asynchronously, so the first-login DOM/canvases may have
         been created before the imported arrays replaced the bootstrap data. */
      renderOverview();
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          try{ initOverviewCharts(); }catch(e){console.warn('v717 overview init',reason,e);}
          try{ resizeView('overview',true); }catch(_){ }
          try{ window.dispatchEvent(new Event('resize')); }catch(_){ }
        });
      });
      return true;
    }catch(e){console.warn('v717 overview rebuild',reason,e);return false;}
  }
  function settle(reason){
    var my=++seq;
    clearTimeout(timer);
    var waits=[0,60,160,350,700,1200,2200,3600];
    waits.forEach(function(ms){
      setTimeout(function(){ if(my===seq) authoritativeRender(reason+'@'+ms); },ms);
    });
  }
  /* Dataset events are the primary authority. */
  document.addEventListener('aip:data-source-changed',function(){settle('data-source-changed')},true);
  document.addEventListener('apm:datasource-refreshed',function(){settle('datasource-refreshed')},true);
  document.addEventListener('aip:data-rendered',function(){settle('data-rendered')},true);
  /* First login / first Portfolio Overview entry: do not require a synthetic->Excel toggle. */
  function boot(){ settle('first-entry'); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  /* Also catch direct Portfolio/Overview tab entry after an async Excel import. */
  document.addEventListener('click',function(e){
    if(e.target.closest('[data-view="portfoliointelligence"],[data-aip500-tab="overview"]')) settle('overview-entry');
  },true);
})();
