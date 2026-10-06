
(function(){
'use strict';
const INNER='#view-assetexplorer :is(.ax-domain-metrics,.ax-context-grid,.ax-mini-kpis,.ax-ai-detail,.ax-finance-grid) > div';
function bars(){const s=document.createElement('span');s.className='aip862-kpi-bars';s.setAttribute('aria-hidden','true');s.innerHTML='<i></i><i></i><i></i><i></i><i></i>';return s}
function cleanLegacy(card){
  card.classList.remove('aip-kpi-master');
  card.removeAttribute('data-aip-kpi-index');
  card.querySelectorAll(':scope > .aip-kpi-display-label,:scope > .aip-kpi-display-value,:scope > .aip-kpi-master-bars').forEach(x=>x.remove());
}
function apply(){
  const root=document.getElementById('view-assetexplorer');if(!root)return;
  root.querySelectorAll('.ax-kpis > .ax-kpi').forEach(cleanLegacy);
  root.querySelectorAll(INNER).forEach((card,i)=>{
    cleanLegacy(card);
    card.classList.add('aip862-asset-kpi');
    card.dataset.aip862Index=String(i%6);
    if(!card.querySelector(':scope > .aip862-kpi-bars'))card.append(bars());
  });
}
document.addEventListener('aip:asset-explorer-rendered',apply);
document.addEventListener('aip:data-source-changed',()=>requestAnimationFrame(apply));
document.addEventListener('apm:datasource-refreshed',()=>requestAnimationFrame(apply));
document.addEventListener('click',e=>{if(e.target.closest('#view-assetexplorer [data-ax-tab],.nav-item[data-view="assetexplorer"]'))requestAnimationFrame(apply)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
window.AIP862AssetExplorerKPIRefresh=apply;
})();
