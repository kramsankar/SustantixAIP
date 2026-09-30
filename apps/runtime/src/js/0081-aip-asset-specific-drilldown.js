
(function(){
'use strict';
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function selected(){
 const row=document.querySelector('#view-assetexplorer .ax-asset.active')||document.querySelector('#view-assetexplorer .ax-asset.aip-key-cursor');
 const id=row?.dataset.axId||window.AIP_SELECTED_ASSET_CONTEXT?.assetId||'';
 const tag=row?.querySelector('b')?.textContent?.trim()||window.AIP_SELECTED_ASSET_CONTEXT?.tag||'';
 const hero=document.querySelector('#view-assetexplorer .ax-title')?.textContent?.trim()||tag;
 return {assetId:id,tag:tag||hero};
}
function go(target,source,recordId){
 const c=selected(); if(!c.assetId&&!c.tag)return;
 window.AIP_ASSET_DRILL_CONTEXT={...c,target,source:source||'Asset Explorer',recordId:recordId||''};
 try{sessionStorage.setItem('aip.asset.drill',JSON.stringify(window.AIP_ASSET_DRILL_CONTEXT))}catch(_){ }
 const nav=document.querySelector('.nav-item[data-view="'+target+'"]');
 if(nav){nav.click();setTimeout(()=>apply(target),180);setTimeout(()=>apply(target),650);setTimeout(()=>apply(target),1300)}
}
function context(){
 if(window.AIP_ASSET_DRILL_CONTEXT)return window.AIP_ASSET_DRILL_CONTEXT;
 try{return JSON.parse(sessionStorage.getItem('aip.asset.drill')||'null')}catch(_){return null}
}
function release(view){
 view.querySelectorAll('.aip-asset-filtered-row').forEach(r=>r.classList.remove('aip-asset-filtered-row'));
 view.querySelectorAll('.aip-asset-filter-hidden').forEach(r=>r.classList.remove('aip-asset-filter-hidden'));
 view.querySelectorAll('.aip-asset-context-ribbon').forEach(x=>x.remove());
 window.AIP_ASSET_DRILL_CONTEXT=null;try{sessionStorage.removeItem('aip.asset.drill')}catch(_){ }
}
function candidates(view){
 const tables=[...view.querySelectorAll('table tbody')];
 return tables.flatMap(tb=>[...tb.querySelectorAll(':scope > tr')]);
}
function apply(target){
 const c=context(); if(!c||c.target!==target)return;
 const view=document.getElementById('view-'+target); if(!view)return;
 view.querySelectorAll('.aip-asset-context-ribbon').forEach(x=>x.remove());
 const head=view.querySelector('.view-head,.page-header,.xi-head,.ai3-head')||view.firstElementChild;
 const ribbon=document.createElement('div');ribbon.className='aip-asset-context-ribbon';
 ribbon.innerHTML='<span>Asset: <b>'+String(c.tag||c.assetId)+'</b> · '+String(c.source||'Asset Explorer')+'</span><button type="button" aria-label="Show all records">Show all records ×</button>';
 ribbon.querySelector('button').onclick=()=>release(view);
 if(head)head.insertAdjacentElement('afterend',ribbon);else view.prepend(ribbon);
 const keys=[norm(c.recordId),norm(c.assetId),norm(c.tag)].filter(Boolean);
 const rows=candidates(view); let matched=0;
 rows.forEach(r=>{
   const hit=keys.some(k=>norm(r.textContent).includes(k));
   r.classList.toggle('aip-asset-filtered-row',hit);
   r.classList.toggle('aip-asset-filter-hidden',!hit);
   if(hit)matched++;
 });
 if(!matched){rows.forEach(r=>r.classList.remove('aip-asset-filter-hidden'));ribbon.querySelector('span').insertAdjacentHTML('beforeend',' · <em>No exact linked record in this dataset</em>')}
}
function decorate(){
 const kpis=document.querySelectorAll('#view-assetexplorer .ax-kpi');
 const wo=kpis[3];
 if(wo&&!wo.dataset.aipDrill){wo.dataset.aipDrill='workorderintelligence';wo.classList.add('aip-asset-drill');wo.tabIndex=0;wo.title='Open work orders for the selected asset';wo.setAttribute('role','button')}
 document.querySelectorAll('#view-assetexplorer .ax-capability[data-ax-cap]').forEach(tile=>{
   if(tile.dataset.aipExactBound)return;tile.dataset.aipExactBound='1';
   tile.addEventListener('click',()=>{const t=tile.dataset.axCap;if(t)setTimeout(()=>apply(t),250)},true)
 })
}
document.addEventListener('click',e=>{const k=e.target.closest('#view-assetexplorer .ax-kpi[data-aip-drill]');if(k){e.preventDefault();go(k.dataset.aipDrill,'Asset Explorer · Open Work Orders')}},true);
document.addEventListener('keydown',e=>{const k=e.target.closest?.('#view-assetexplorer .ax-kpi[data-aip-drill]');if(k&&(e.key==='Enter'||e.key===' ')){e.preventDefault();go(k.dataset.aipDrill,'Asset Explorer · Open Work Orders')}},true);
window.AIPAssetDrillGo=go;
document.addEventListener('aip:asset-explorer-rendered',decorate);
document.addEventListener('aip:data-source-changed',()=>setTimeout(decorate,0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
})();
