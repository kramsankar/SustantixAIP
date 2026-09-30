
(function(){
'use strict';
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const ROUTES={
 'asset relationships':'assetrelationships','view asset relationships':'assetrelationships',
 'work order':'workorderintelligence','work orders':'workorderintelligence','open work orders':'workorderintelligence',
 'prediction':'predictive','predictive maintenance':'predictive',
 'root cause':'rootcause','event intelligence':'rootcause','events':'rootcause',
 'ai vision':'aivision','vision':'aivision',
 'scenario':'scenariosimulator2','scenario analysis':'scenariosimulator2',
 'warranty':'warrantyrecovery','warranty opportunity':'warrantyrecovery','warranty intelligence':'warrantyrecovery',
 'financial impact':'financialimpact','financial analysis':'financialimpact'
};
function mode(){
 try{return window.getDataMode?.()||window.currentDataMode||localStorage.getItem('aipDataMode')||localStorage.getItem('dataMode')||'excel'}catch(_){return 'excel'}
}
function selected(){
 const view=document.getElementById('view-assetexplorer');
 const row=view?.querySelector('.ax-asset.active,.ax-asset.aip-key-cursor,[data-ax-id].active');
 const existing=window.AIP_SELECTED_ASSET_CONTEXT||window.AIP_ASSET_DRILL_CONTEXT||{};
 const assetId=row?.dataset.axId||row?.dataset.assetId||existing.assetId||'';
 const tag=row?.querySelector('b')?.textContent?.trim()||existing.tag||existing.assetTag||assetId;
 const site=view?.querySelector('.ax-site.active b,.ax-title-sub')?.textContent?.trim()||existing.site||existing.plant||'';
 const assetClass=existing.assetClass||row?.dataset.assetClass||'';
 return {assetId,tag,site,assetClass,dataMode:mode(),originTab:window.AX_ACTIVE_TAB||'',timestamp:Date.now()};
}
function save(ctx){window.AIP_CONTEXT_NAV={...ctx};window.AIP_SELECTED_ASSET_CONTEXT={...(window.AIP_SELECTED_ASSET_CONTEXT||{}),...ctx};try{sessionStorage.setItem('aip.context.nav',JSON.stringify(ctx))}catch(_){}}
function load(){if(window.AIP_CONTEXT_NAV)return window.AIP_CONTEXT_NAV;try{return JSON.parse(sessionStorage.getItem('aip.context.nav')||'null')}catch(_){return null}}
function clear(view){
 window.AIP_CONTEXT_NAV=null;try{sessionStorage.removeItem('aip.context.nav')}catch(_){}
 if(view){view.classList.remove('aip-contextual-relationship');view.querySelectorAll('.aip-context-header,.aip-context-empty').forEach(x=>x.remove());view.querySelectorAll('.aip-context-match,.aip-context-hidden').forEach(x=>x.classList.remove('aip-context-match','aip-context-hidden'))}
}
function activate(target){
 /* Contextual navigation must not depend on a synthetic sidebar click. Several
    legacy capture-phase handlers can cancel that click before the normal view
    switch runs. Open the destination explicitly, then invoke its renderer. */
 if(target==='assetrelationships'){
   const view=document.getElementById('view-assetrelationships');
   const nav=document.querySelector('#sidebar .nav-item[data-view="assetrelationships"]');
   if(!view)return false;
   document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
   document.querySelectorAll('#sidebar .nav-item').forEach(n=>n.classList.remove('active'));
   view.classList.add('active');
   if(nav){
     nav.classList.add('active');
     const group=nav.closest('.x-nav-group');
     if(group){
       group.classList.add('open');
       group.querySelector('.x-nav-head')?.setAttribute('aria-expanded','true');
       const icon=group.querySelector('.x-nav-icon');if(icon)icon.textContent='−';
     }
   }
   try{window.AR_ACTIVE_TAB='explorer';window.renderAssetRelationships?.(window.AIP_PENDING_RELATIONSHIP_CONTEXT||window.AIP_CONTEXT_NAV||null)}catch(e){console.error('Asset Relationships render failed',e)}
   try{document.getElementById('main')?.scrollTo(0,0)}catch(_){}
   return true;
 }
 const nav=document.querySelector('.nav-item[data-view="'+CSS.escape(target)+'"]');
 if(nav){nav.click();return true}
 try{if(typeof window.activate==='function'){window.activate(target);return true}}catch(_){}
 return false;
}
let navSequence=0;
function navigate(target,source,recordId,explicitAssetId){
 let s=selected();
 if(explicitAssetId){
   const exact=document.querySelector('#view-assetexplorer [data-ax-id="'+CSS.escape(String(explicitAssetId))+'"]');
   const allRows=typeof window.arAssetSelectorRows==='function'?window.arAssetSelectorRows():[];
   const exactData=allRows.find(r=>norm(r.Asset_ID)===norm(explicitAssetId)||norm(r.Asset_Tag)===norm(explicitAssetId));
   s={...s,assetId:String(exactData?.Asset_ID||explicitAssetId),tag:String(exactData?.Asset_Tag||exact?.querySelector('b')?.textContent?.trim()||s.tag||explicitAssetId),site:String(exactData?.Plant_Name||s.site||''),assetClass:String(exactData?.Asset_Class||s.assetClass||'')};
 }
 if(!s.assetId&&!s.tag)return;
 const ctx={...s,target,source:source||'Asset Explorer',recordId:recordId||'',contextToken:'CTX-'+Date.now()+'-'+(++navSequence)};
 save(ctx);
 if(target==='assetrelationships'){
   window.AIP_PENDING_RELATIONSHIP_CONTEXT={assetId:String(ctx.assetId||''),tag:String(ctx.tag||''),site:String(ctx.site||''),assetClass:String(ctx.assetClass||''),contextToken:String(ctx.contextToken||'')};
   window.AIP_RELATIONSHIP_FOCUS_ASSET=String(ctx.assetId||ctx.tag||'');
   relationshipApplyKey='';
   if(relationshipTimer){clearTimeout(relationshipTimer);relationshipTimer=0;}
 }
 const seq=navSequence;
 activate(target);
 // Apply only after the destination has had time to render. A bounded retry
 // replaces the former page-wide MutationObserver, preventing render loops.
 let attempt=0;
 const settle=()=>{
   if(seq!==navSequence)return;
   const view=document.getElementById('view-'+target);
   if(view&&view.classList.contains('active')){
     if(target==='assetrelationships'&&view.dataset.aipContextToken!==ctx.contextToken){
       view.dataset.aipContextToken=ctx.contextToken;
       window.AIP_RELATIONSHIP_FOCUS_ASSET=String(ctx.assetId||ctx.tag||'');
       try{window.renderAssetRelationships?.();}catch(_){ }
       setTimeout(()=>apply(target),30);
     }else apply(target);
     return;
   }
   if(attempt++<12)setTimeout(settle,90);
 };
 setTimeout(settle,60);
}
function insertHeader(view,ctx){
 view.querySelectorAll('.aip-context-header').forEach(x=>x.remove());
 const head=view.querySelector('.view-head,.page-header,.xi-head,.ai3-head')||view.firstElementChild;
 const bar=document.createElement('div');bar.className='aip-context-header';
 const label=[ctx.site,ctx.tag||ctx.assetId].filter(Boolean).join(' › ');
 bar.innerHTML='<span class="aip-context-path">Asset Explorer › <b>'+esc(label)+'</b> › '+esc(titleFor(ctx.target))+' <small>('+esc(ctx.dataMode||mode())+')</small></span><span class="aip-context-actions"><button type="button" data-aip-return>Return to Asset Explorer</button><button type="button" data-aip-clear>Show all</button></span>';
 bar.querySelector('[data-aip-return]').onclick=()=>{activate('assetexplorer');setTimeout(()=>{try{window.renderAssetExplorer?.()}catch(_){}},100)};
 bar.querySelector('[data-aip-clear]').onclick=()=>clear(view);
 if(head)head.insertAdjacentElement('afterend',bar);else view.prepend(bar);
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function titleFor(t){const n=document.querySelector('.nav-item[data-view="'+CSS.escape(t||'')+'"] span:last-child');return n?.textContent?.trim()||String(t||'Context')}
let relationshipApplyKey='';
let relationshipTimer=0;
function applyRelationship(view,ctx){
 view.classList.add('aip-contextual-relationship');window.AR_ACTIVE_TAB='explorer';
 const rows=typeof window.arAssetSelectorRows==='function'?window.arAssetSelectorRows():[];
 const target=rows.find(r=>norm(r.Asset_ID)===norm(ctx.assetId)||norm(r.Asset_Tag)===norm(ctx.tag));
 if(!target){empty(view,'No relationship-network record is available for '+(ctx.tag||ctx.assetId)+'.');return}
 const key=[target.Plant_ID,target.Asset_Class,target.Asset_ID,ctx.dataMode].join('|');
 window.AIP_RELATIONSHIP_FOCUS_ASSET=String(target.Asset_ID);
 const h=view.querySelector('h1');if(h)h.textContent='Asset Relationship Intelligence — '+(target.Asset_Tag||ctx.tag||ctx.assetId);
 relationshipApplyKey=key;
 if(relationshipTimer)clearTimeout(relationshipTimer);
 const token=String(ctx.contextToken||'');
 let tries=0;
 const configure=()=>{
   const latest=load();
   if(!view.classList.contains('active')||String(latest?.contextToken||'')!==token)return;
   const site=document.getElementById('arSite');
   const type=document.getElementById('arAssetType');
   const focus=document.getElementById('arFocus');
   if(!site||!type||!focus){if(tries++<20)relationshipTimer=setTimeout(configure,70);return;}
   const siteId=String(target.Plant_ID),assetType=String(target.Asset_Class),assetId=String(target.Asset_ID);
   const all=typeof window.arAssetSelectorRows==='function'?window.arAssetSelectorRows():rows;
   const escOpt=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
   const sites=[...new Map(all.map(r=>[String(r.Plant_ID),{id:String(r.Plant_ID),name:String(r.Plant_Name||r.Plant_ID)}])).values()].sort((a,b)=>a.name.localeCompare(b.name));
   site.innerHTML=sites.map(x=>'<option value="'+escOpt(x.id)+'">'+escOpt(x.name)+'</option>').join('');
   site.value=siteId;
   const types=[...new Set(all.filter(r=>String(r.Plant_ID)===siteId).map(r=>String(r.Asset_Class)))].sort();
   type.innerHTML=types.map(x=>'<option value="'+escOpt(x)+'">'+escOpt(x)+'</option>').join('');
   type.value=assetType;
   const assets=all.filter(r=>String(r.Plant_ID)===siteId&&String(r.Asset_Class)===assetType).sort((a,b)=>String(a.Asset_Tag).localeCompare(String(b.Asset_Tag)));
   focus.innerHTML=assets.map(x=>'<option value="'+escOpt(x.Asset_ID)+'">'+escOpt(x.Asset_Tag)+(x.Description?' — '+escOpt(x.Description):'')+'</option>').join('');
   focus.value=assetId;
   if(site.value!==siteId||type.value!==assetType||focus.value!==assetId){
     if(tries++<20)relationshipTimer=setTimeout(configure,70);
     return;
   }
   window.AIP_RELATIONSHIP_FOCUS_ASSET=assetId;
   window.AIP_PENDING_RELATIONSHIP_CONTEXT={assetId,tag:String(target.Asset_Tag||''),site:siteId,assetClass:assetType,contextToken:token};
   view.dataset.aipAppliedRelationshipAsset=assetId;
   try{window.AR_GRAPH_STATE.positions={};window.AR_GRAPH_STATE.collapsed?.clear?.();window.AR_GRAPH_STATE.pathNodes?.clear?.();window.AR_GRAPH_STATE.pathRels?.clear?.();window.drawARGraph?.()}catch(_){ }
 };
 relationshipTimer=setTimeout(configure,40);
}
function empty(view,msg){view.querySelector('.aip-context-empty')?.remove();const d=document.createElement('div');d.className='aip-context-empty';d.textContent=msg;const bar=view.querySelector('.aip-context-header');bar?.insertAdjacentElement('afterend',d)}
function filterRows(view,ctx){
 if(ctx.target==='workorderintelligence'||ctx.target==='scenariosimulator2')return; // specialised existing renderers
 const rows=[...view.querySelectorAll('table tbody tr')];if(!rows.length)return;
 const keys=[ctx.recordId,ctx.assetId,ctx.tag].map(norm).filter(Boolean);let hits=0;
 rows.forEach(r=>{const hit=keys.some(k=>norm(r.textContent).includes(k));r.classList.toggle('aip-context-match',hit);r.classList.toggle('aip-context-hidden',!hit);if(hit)hits++});
 if(!hits){rows.forEach(r=>r.classList.remove('aip-context-hidden'));empty(view,'No linked '+titleFor(ctx.target).toLowerCase()+' record is available for '+(ctx.tag||ctx.assetId)+'.')}
}
function apply(target){
 const ctx=load();if(!ctx||ctx.target!==target)return;const view=document.getElementById('view-'+target);if(!view)return;
 insertHeader(view,ctx);
 if(target==='assetrelationships')applyRelationship(view,ctx);else filterRows(view,ctx);
}

function openRelationshipFromCurrentAsset(explicitAssetId){
 const ctl=window.AIPAssetExplorerController?.getState?.()||{};
 const authoritativeId=String(explicitAssetId||ctl.assetId||window.AIP_ASSET_EXPLORER_SELECTED_ID||'').trim();
 if(!authoritativeId)return false;
 const rows=typeof window.arAssetSelectorRows==='function'?window.arAssetSelectorRows():[];
 const target=rows.find(r=>norm(r.Asset_ID)===norm(authoritativeId)||norm(r.Asset_Tag)===norm(authoritativeId));
 if(!target){
  // Do not leave the button inert when the relationship selector has not yet
  // finished building. Preserve the selected Asset Explorer context and let
  // the normal bounded destination renderer resolve it after navigation.
  navigate('assetrelationships','Asset Explorer · Overview','',authoritativeId);
  return true;
 }
 const ctx={
  assetId:String(target.Asset_ID),tag:String(target.Asset_Tag||target.Asset_ID),
  site:String(target.Plant_Name||target.Plant_ID||''),siteId:String(target.Plant_ID||''),
  assetClass:String(target.Asset_Class||''),target:'assetrelationships',
  source:'Asset Explorer · Overview',dataMode:mode(),contextToken:'AR-DIRECT-'+Date.now()+'-'+(++navSequence)
 };
 save(ctx);
 window.AIP_ASSET_RELATIONSHIP_SOURCE_CONTEXT={...ctx};
 window.AIP_PENDING_RELATIONSHIP_CONTEXT={...ctx};
 window.AIP_RELATIONSHIP_FOCUS_ASSET=ctx.assetId;
 const opened=activate('assetrelationships');
 if(!opened)return false;
 let attempts=0;
 const renderDirect=()=>{
  const view=document.getElementById('view-assetrelationships');
  if(!view||!view.classList.contains('active')){
   if(attempts++<15)setTimeout(renderDirect,40);
   return;
  }
  try{window.AR_ACTIVE_TAB='explorer';window.renderAssetRelationships(ctx);}catch(e){console.error('Direct relationship render failed',e);return;}
  try{insertHeader(view,ctx);}catch(_){ }
  view.dataset.aipContextToken=ctx.contextToken;
  view.dataset.aipAppliedRelationshipAsset=ctx.assetId;
 };
 setTimeout(renderDirect,0);
 return true;
}
window.renderAssetRelationships=renderAssetRelationships;
window.arAssetSelectorRows=arAssetSelectorRows;
window.AIPOpenCurrentAssetRelationships=openRelationshipFromCurrentAsset;
// Authoritative button binding: capture the click and execute the direct pane
// transition. This remains stable even when legacy document handlers stop the
// event during bubbling.
document.addEventListener('click',function(e){
 const btn=e.target&&e.target.closest?e.target.closest('.ax-relationship-btn,[data-ax-relationship-asset]'):null;
 if(!btn)return;
 // v58 owns the Asset Explorer → Asset Relationships handoff.
 return;
},true);
function inferRoute(el){
 const explicit=el.dataset.axCap||el.dataset.aipContextTarget||'';if(explicit)return explicit;
 const text=(el.textContent||el.getAttribute('aria-label')||el.title||'').trim().toLowerCase();
 for(const [k,v] of Object.entries(ROUTES))if(text.includes(k))return v;return '';
}
document.addEventListener('click',function(e){
 const rel=e.target.closest('[data-ax-relationship-asset]');
 if(rel){
   // v58 owns the Asset Explorer → Asset Relationships handoff.
   return;
 }
 const el=e.target.closest('#view-assetexplorer [data-ax-context-nav],#view-assetexplorer [data-ax-cap],#view-assetexplorer .ax-kpi[data-aip-drill]');if(!el)return;
 const target=inferRoute(el);if(!target||target==='assetexplorer')return;
 e.preventDefault();e.stopImmediatePropagation();navigate(target,'Asset Explorer · '+((window.AX_ACTIVE_TAB||'context').toString()));
},true);
document.addEventListener('keydown',function(e){const el=e.target.closest?.('#view-assetexplorer [data-ax-context-nav],#view-assetexplorer [data-ax-cap],#view-assetexplorer .ax-kpi[data-aip-drill]');if(!el||!(e.key==='Enter'||e.key===' '))return;const t=inferRoute(el);if(t){e.preventDefault();e.stopImmediatePropagation();navigate(t,'Asset Explorer')}},true);
document.addEventListener('aip:data-source-changed',()=>{const c=load();if(c){c.dataMode=mode();save(c);setTimeout(()=>{if(document.getElementById('view-'+c.target)?.classList.contains('active'))apply(c.target)},180)}});
// No document-wide MutationObserver: contextual application is deliberately
// bounded to explicit navigation and data-source changes.
window.AIPContextNavigate=navigate;window.AIPApplyContext=apply;
})();
