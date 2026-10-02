
(function(){
'use strict';
if(window.__AIP_V215_WO_SINGLE_AUTHORITY__)return;
window.__AIP_V215_WO_SINGLE_AUTHORITY__=true;
function removeLegacyKpiLayer(){
  const host=document.getElementById('view-workorderintelligence');
  if(!host)return;
  host.querySelectorAll(':scope > .ov121-kpis,:scope > .ovd-kpis,:scope > .ops-kpis,:scope > .rigour-grid').forEach(n=>n.remove());
}
function renderOnlyStable(){
  removeLegacyKpiLayer();
  if(typeof window.__AIP_WO_STABLE_RENDER==='function'){
    window.renderWorkOrderIntelligence=window.__AIP_WO_STABLE_RENDER;
    window.opsWOTab=window.__AIP_WO_STABLE_RENDER;
    return window.__AIP_WO_STABLE_RENDER();
  }
  if(typeof window.renderWorkOrderIntelligence==='function')return window.renderWorkOrderIntelligence();
}
document.addEventListener('click',function(e){
  const nav=e.target?.closest?.('[data-view="workorderintelligence"]');
  const tab=e.target?.closest?.('#view-workorderintelligence .ops-tab');
  if(!nav&&!tab)return;
  requestAnimationFrame(()=>{
    removeLegacyKpiLayer();
    if(typeof window.__AIP_WO_STABLE_RENDER==='function'){
      window.renderWorkOrderIntelligence=window.__AIP_WO_STABLE_RENDER;
      window.opsWOTab=window.__AIP_WO_STABLE_RENDER;
    }
  });
},true);
document.addEventListener('aip:data-source-changed',()=>requestAnimationFrame(renderOnlyStable));
document.addEventListener('apm:datasource-refreshed',()=>requestAnimationFrame(renderOnlyStable));
})();
