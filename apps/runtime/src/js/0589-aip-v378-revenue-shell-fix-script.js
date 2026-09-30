
(function(){
  function normalizePane(paneId,helpView){
    const pane=document.getElementById(paneId);
    if(!pane)return;
    let holder=pane.querySelector(':scope > .f1-help-top-right.aip-v378-revenue-help');
    let button=pane.querySelector('.f1-btn');
    if(!holder){
      holder=document.createElement('div');
      holder.className='f1-help-top-right aip-v378-revenue-help';
      pane.insertBefore(holder,pane.firstChild);
    }
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='f1-btn';
      button.innerHTML='<span class="f1-key">F1</span> Help';
    }
    if(button.parentNode!==holder)holder.appendChild(button);
    button.onclick=function(e){
      e.preventDefault();e.stopPropagation();
      if(typeof window.openHelp==='function')window.openHelp(helpView);
    };
    button.dataset.helpView=helpView;
    button.title='F1 Help';
    button.setAttribute('aria-label','Open F1 Help');
    /* Remove duplicate/legacy controls and child page-heads after preserving one F1. */
    pane.querySelectorAll('.f1-btn').forEach(b=>{if(b!==button)b.remove()});
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
