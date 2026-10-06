
(function(){
  'use strict';
  function activeView(){
    const v=document.querySelector('.view.active[id^="view-"]');
    return v?v.id.replace(/^view-/,''):'';
  }
  function returnToRiskBased(){
    const ctx=window.AIP_RB_RCM_RETURN;
    if(!ctx||activeView()!=='rcm')return false;
    const n=document.querySelector('#sidebar .nav-item[data-view="riskbased"]');
    if(!n)return false;
    n.click();
    setTimeout(function(){
      try{
        if(typeof RB772_CLASS!=='undefined') RB772_CLASS=String(ctx.classFilter||ctx.assetClass||'All');
        if(typeof RB772_SELECTED!=='undefined') RB772_SELECTED=String(ctx.selected||'');
        if(typeof RB772_SEARCH!=='undefined') RB772_SEARCH=String(ctx.search||'');
        if(typeof renderRiskBased==='function') renderRiskBased();
        const input=document.getElementById('rb772-search');
        if(input)input.value=String(ctx.search||'');
        if(typeof rb772Search==='function') rb772Search(String(ctx.search||''));
        window.AIP_HISTORY_NAV?.record?.('riskbased');
      }catch(e){console.error('Risk-Based return restore failed',e)}
    },60);
    return true;
  }
  window.AIP_RETURN_FROM_RCM_TO_RISK=returnToRiskBased;
  const back=document.getElementById('aipBackBtn');
  if(back)back.addEventListener('click',function(e){
    if(returnToRiskBased()){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  document.addEventListener('keydown',function(e){
    if(e.altKey&&e.key==='ArrowLeft'&&returnToRiskBased()){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  if(window.AIP_HISTORY_NAV&&typeof window.AIP_HISTORY_NAV.back==='function'){
    const nativeBack=window.AIP_HISTORY_NAV.back.bind(window.AIP_HISTORY_NAV);
    window.AIP_HISTORY_NAV.back=function(){if(!returnToRiskBased())nativeBack();};
  }
})();
