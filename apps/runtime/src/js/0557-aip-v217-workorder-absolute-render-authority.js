
(function(){
'use strict';
if(window.__AIP_V217_WO_ABSOLUTE_AUTHORITY__)return;
window.__AIP_V217_WO_ABSOLUTE_AUTHORITY__=true;
function stable(){return typeof window.__AIP_WO_STABLE_RENDER==='function'?window.__AIP_WO_STABLE_RENDER:null}
function renderStable(){
  const fn=stable();
  if(!fn)return false;
  window.renderWorkOrderIntelligence=fn;
  fn();
  const root=document.getElementById('view-workorderintelligence');
  if(!root)return false;
  root.querySelectorAll(':scope > .ops-kpis,:scope > .ov121-kpis,:scope > .ovd-kpis,:scope > .rigour-grid').forEach(n=>n.remove());
  return root.querySelectorAll(':scope > .wo213-kpis .wo213-kpi').length===6;
}
function renderWhenReady(attempt){
  if(renderStable())return;
  if((attempt||0)<30)requestAnimationFrame(()=>renderWhenReady((attempt||0)+1));
}
/* Own the left-nav entry before the sidebar's legacy bubble handler executes. */
document.addEventListener('click',function(e){
  const nav=e.target&&e.target.closest?e.target.closest('#sidebar .nav-item[data-view="workorderintelligence"]'):null;
  if(!nav)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  try{ if(typeof window.activate==='function') window.activate('workorderintelligence'); }catch(err){ console.error('v2.17 Work Order navigation failed',err); }
  renderWhenReady(0);
},true);
/* Reassert ownership when deferred runtime is ready and after source refreshes. */
window.addEventListener('aip:runtime-ready',()=>{if(document.getElementById('view-workorderintelligence')?.classList.contains('active'))renderWhenReady(0)});
document.addEventListener('aip:data-source-changed',()=>{if(document.getElementById('view-workorderintelligence')?.classList.contains('active'))renderWhenReady(0)});
document.addEventListener('apm:datasource-refreshed',()=>{if(document.getElementById('view-workorderintelligence')?.classList.contains('active'))renderWhenReady(0)});
})();
