
(function(){
'use strict';
const IDS=new Set(['contextgraph','operationaltwin','decisionintelligence','decisionworkspace']);
const pending=new Map();
function refresh(id){
  const v=document.getElementById('view-'+id);
  if(!v||!v.classList.contains('active')) return;
  clearTimeout(pending.get(id));
  pending.set(id,setTimeout(()=>{
    pending.delete(id);
    try{window.AIPKPIMaster?.scan(v)}catch(e){console.warn('Enterprise KPI refresh',id,e)}
  },70));
}
document.addEventListener('click',e=>{
  const n=e.target.closest?.('[data-view],[data-edi-view]');
  const id=n?.dataset?.view||n?.dataset?.ediView;
  if(IDS.has(id)) refresh(id);
},false);
window.AIPEnterpriseKPIRefresh=refresh;
})();
