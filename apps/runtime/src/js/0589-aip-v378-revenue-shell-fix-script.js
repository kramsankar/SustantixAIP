
(function(){
  function normalizePane(paneId,helpView){
    const pane=document.getElementById(paneId);
    if(!pane)return;
    /* Sustantix: F1 Help is retired (the v403 removal guard purges every F1 control on each change under #main).
       Recreating it here fought that guard in an endless add/remove loop, and every turn woke each page-wide
       observer, keeping the page busy on every screen. Only the redundant child page-heads are normalized now. */
    pane.querySelectorAll(':scope > .page-head').forEach(h=>h.remove());
  }
  function normalizeRevenueCommercial(){
    normalizePane('view-lossintelligence','lossintelligence');
    normalizePane('view-commercialppa','commercialppa');
  }
  function install(){
    const parent=document.getElementById('view-revenuecommercial');
    if(!parent)return;
    let queued=false;
    const requestNormalize=()=>{
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{queued=false;normalizeRevenueCommercial()});
    };
    new MutationObserver(requestNormalize).observe(parent,{childList:true,subtree:true});
    document.addEventListener('aip:view-changed',requestNormalize);
    document.addEventListener('aip:data-source-changed',requestNormalize);
    document.addEventListener('apm:datasource-refreshed',requestNormalize);
    requestNormalize();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.AIP_V378_AUDIT={
    release:'v378',baseline:'v377',
    scope:'Portfolio KPI drill icon placement and Revenue & Commercial Intelligence child-shell normalization',
    changes:[
      'Revenue at Risk and CO2 Avoided drill icons moved to lower-right within their existing KPI cards',
      'Removed redundant Generation & Revenue Loss Intelligence child heading',
      'Removed redundant Commercial & PPA Intelligence child heading',
      'Normalized F1 Help to the same top-right position across Loss Intelligence and Commercial & PPA',
      'Existing Revenue/CO2 drill navigation and all child-tab data/logic preserved'
    ],
    dataImpact:'None — Excel and Synthetic values/calculations unchanged',excelChanged:false
  };
})();
