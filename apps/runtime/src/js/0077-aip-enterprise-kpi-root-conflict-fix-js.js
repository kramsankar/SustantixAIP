
(function(){
'use strict';
const ids=['contextgraph','operationaltwin','decisionintelligence','decisionworkspace'];
const roots=ids.map(id=>document.getElementById('view-'+id)).filter(Boolean);
let queued=false;
function refresh(){
  if(queued)return;queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    roots.forEach(v=>{
      if(!v.classList.contains('active'))return;
      v.querySelectorAll('.xi-kpi,.dd-kpi,.decision-card,[data-kpi-card]').forEach(c=>{c.style.setProperty('visibility','visible','important');c.style.setProperty('opacity','1','important')});
      try{window.AIPKPIMaster?.scan(v)}catch(e){console.warn('Enterprise KPI normalization failed',e)}
    });
  });
}
roots.forEach(v=>new MutationObserver(refresh).observe(v,{childList:true,subtree:true}));
document.addEventListener('click',e=>{
  const n=e.target.closest?.('[data-view],[data-edi-view]');
  const id=n?.dataset?.view||n?.dataset?.ediView;
  if(ids.includes(id)){refresh();setTimeout(refresh,80);setTimeout(refresh,220)}
},true);
document.addEventListener('aip:data-source-changed',()=>{refresh();setTimeout(refresh,120)});
document.addEventListener('apm:datasource-refreshed',()=>{refresh();setTimeout(refresh,120)});
})();
