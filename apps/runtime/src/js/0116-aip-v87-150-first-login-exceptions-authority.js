
(function(){
  'use strict';
  if(window.__AIP_V87150_EXCEPTIONS_AUTHORITY__) return;
  window.__AIP_V87150_EXCEPTIONS_AUTHORITY__=true;

  function forceExceptions(){
    window.AIP_WO_DESIRED_TAB='exceptions';
    try{
      if(window.OPS_WO) window.OPS_WO.tab='exceptions';
      else if(typeof OPS_WO!=='undefined') OPS_WO.tab='exceptions';
    }catch(_){}
    try{
      if(typeof window.renderWorkOrderIntelligence==='function'){
        window.renderWorkOrderIntelligence();
      }
    }catch(_){}
  }

  document.addEventListener('click',function(e){
    const btn=e.target && e.target.closest
      ? e.target.closest('#view-workorderintelligence .ops-tab[data-wo12-tab="exceptions"], #view-workorderintelligence .ops-tab')
      : null;
    if(!btn) return;

    const isExceptions =
      btn.dataset?.wo12Tab==='exceptions' ||
      /^Approvals\s*&\s*Exceptions$/i.test((btn.textContent||'').trim());

    if(!isExceptions) return;

    /* Own this one tab transition so first-load legacy handlers cannot reset to Ledger. */
    e.preventDefault();
    e.stopImmediatePropagation();

    forceExceptions();
    requestAnimationFrame(forceExceptions);
    setTimeout(forceExceptions,30);
  },true);
})();
