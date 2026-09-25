
(function(){
'use strict';
document.addEventListener('click',function(e){
  const host=e.target?.closest?.('#view-workorderintelligence');
  if(!host)return;

  const row=e.target?.closest?.('[data-wo-id],.workorder-row,.wo-row,.ops-exception');
  let id=row?.dataset?.woId||row?.getAttribute?.('data-id')||'';

  const btn=e.target?.closest?.('button,a');
  if(btn){
    const attr=btn.getAttribute('onclick')||'';
    const m=attr.match(/(?:opsAdvanceWO|opsOpenWODetail|openWorkOrderDetails)\('([^']+)'\)/);
    if(!id&&m)id=m[1];
  }

  if(id&&typeof opsSetSelectedWorkOrder==='function')opsSetSelectedWorkOrder(id);

  if(btn){
    const txt=(btn.textContent||'').trim().toLowerCase();
    if(txt.includes('open details')){
      const selected=id||opsSelectedWorkOrderId();
      if(selected&&typeof opsOpenSelectedWorkOrderDetails==='function'){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        opsOpenSelectedWorkOrderDetails(selected);
      }
    }
  }
},true);
})();
