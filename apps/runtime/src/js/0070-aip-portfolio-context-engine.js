
(function(){
 'use strict';
 const KEY='aip_portfolio_filter_v1';
 const state={plantId:'',plantName:''};
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 function norm(v){return String(v??'').trim().toLowerCase()}
 function canonicalSite(v){const x=String(v??'').trim().toUpperCase();const m=x.match(/^(?:SP|SOL)[-_ ]?0*(\d+)$/);return m?'SP-'+String(Number(m[1])).padStart(2,'0'):x}
 function dataStore(){try{return (typeof APM_IMPORTED_DATA!=='undefined'&&APM_IMPORTED_DATA)||window.APM_IMPORTED_DATA||{}}catch(_){return window.APM_IMPORTED_DATA||{}}}
 function embedded(){try{return (typeof EMBEDDED_EXCEL_DATA!=='undefined'&&EMBEDDED_EXCEL_DATA)||window.EMBEDDED_EXCEL_DATA||{}}catch(_){return window.EMBEDDED_EXCEL_DATA||{}}}
 function rawSites(){
   const d=dataStore(),e=embedded();
   let rows=Array.isArray(d.Sites)&&d.Sites.length?d.Sites:(Array.isArray(e.Sites)?e.Sites:[]);
   if(!rows.length){try{rows=(window.PLANTS||PLANTS||[]).map(x=>({Plant_ID:x.id,Plant_Name:x.name}))}catch(_){}}
   const seen=new Set();
   return rows.map(r=>({id:String(r.Plant_ID??r.Site_ID??r.id??r.plant??'').trim(),name:String(r.Plant_Name??r.Site_Name??r.name??r.plantName??'').trim()}))
     .filter(x=>x.id&&!seen.has(canonicalSite(x.id))&&(seen.add(canonicalSite(x.id)),true));
 }
 function assetPlantMap(){
   const d=dataStore(),e=embedded();
   const rows=(Array.isArray(d['Asset Master'])&&d['Asset Master'].length)?d['Asset Master']:(Array.isArray(e['Asset Master'])?e['Asset Master']:[]);
   const m=new Map();
   rows.forEach(r=>{const p=String(r.Plant_ID??r.Site_ID??r.plant??'').trim();[r.Asset_ID,r.Asset_Tag,r.assetId,r.tag,r.id].forEach(v=>{if(v!=null&&String(v).trim())m.set(norm(v),p)})});
   return m;
 }
 function relationPlantMap(){
   const d=dataStore(),e=embedded(),m=new Map();
   ['Maintenance Outcomes','Event Log','Warranty Register','Warranty Claims','Root Cause Analysis'].forEach(name=>{
     const rows=(Array.isArray(d[name])&&d[name].length)?d[name]:(Array.isArray(e[name])?e[name]:[]);
     rows.forEach(r=>{const p=r.Plant_ID??r.Site_ID??r.Plant??r.Site;if(p==null||!String(p).trim())return;
       ['Incident_ID','Source_Incident_ID','Outcome_ID','Warranty_ID','Claim_ID','Event_ID','Failure_Event_ID','Source_Record_ID'].forEach(k=>{const v=r[k];if(v!=null&&String(v).trim())m.set(norm(v),String(p).trim())})
     })
   });
   return m;
 }
 function rowPlant(r){
   if(!r||typeof r!=='object')return '';
   const direct=r.Plant_ID??r.Site_ID??r.Plant??r.Site??r.plantId??r.siteId??r.plant??r.site;
   if(direct!=null&&String(direct).trim())return canonicalSite(direct);
   const amap=assetPlantMap();
   for(const k of ['Asset_ID','Asset_Tag','assetId','assetTag','asset','tag']){const v=r[k];if(v!=null&&amap.has(norm(v)))return canonicalSite(amap.get(norm(v)));}
   const rmap=relationPlantMap();
   for(const k of ['Incident_ID','Source_Incident_ID','Outcome_ID','Warranty_ID','Claim_ID','Event_ID','Failure_Event_ID','Source_Record_ID']){const v=r[k];if(v!=null&&rmap.has(norm(v)))return canonicalSite(rmap.get(norm(v)));}
   return '';
 }
 function filterRows(rows){if(!state.plantId||!Array.isArray(rows))return rows;return rows.filter(r=>{const p=rowPlant(r);return !!p&&canonicalSite(p)===canonicalSite(state.plantId)})}
 function viewRows(rows){return filterRows(Array.isArray(rows)?rows:[])}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}}
 function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');state.plantId=String(x.plantId||'');state.plantName=String(x.plantName||'')}catch(_){}}
 function validSelected(){return !state.plantId||rawSites().some(s=>canonicalSite(s.id)===canonicalSite(state.plantId))}
 function removeLegacyUI(){document.getElementById('aipPortfolioContextBar')?.remove();document.querySelectorAll('.portfolio-scope-banner,.aip-portfolio-breadcrumb').forEach(x=>x.remove())}
 const breadcrumbViews=new Set(['view-portfoliobenchmarking','view-siteperformance','view-assetexplorer','view-assetrelationships','view-commercialppa','view-managementactions','view-maintenancelearning','view-warrantyrecovery']);
 function decorateBreadcrumb(){
   document.querySelectorAll('.aip-portfolio-breadcrumb,.portfolio-scope-banner').forEach(x=>x.remove());
   if(!state.plantId)return;
   const view=document.querySelector('.view.active');if(!view||!breadcrumbViews.has(view.id))return;
   const head=view.querySelector('.view-head,.page-head');if(!head)return;
   const b=document.createElement('div');b.className='aip-portfolio-breadcrumb';
   b.innerHTML='<span class="pcb-root">Portfolio</span><span class="pcb-arrow">→</span><span class="pcb-site">'+esc(state.plantId+' · '+(state.plantName||state.plantId))+'</span><button class="pcb-back" type="button" title="Restore all portfolio sites">×&nbsp; Back to Portfolio</button>';
   b.querySelector('.pcb-back').addEventListener('click',()=>setContext('','breadcrumb'));
   head.insertAdjacentElement('afterend',b);
 }
 function decorateTables(){
   document.querySelectorAll('.site-performance-league-table tbody tr').forEach(tr=>{
     const m=(tr.textContent||'').match(/\b(?:SP|SOL)-\d{2,}\b/i);if(!m)return;
     const id=canonicalSite(m[0]);tr.dataset.portfolioSite=id;tr.title='Open '+id+' portfolio context';
     tr.classList.toggle('pc-selected',!!state.plantId&&id===canonicalSite(state.plantId));
   });
 }
 function applyExecutiveSummary(){
   const view=document.getElementById('view-executiveperformance');
   const table=view?.querySelector('.executive-site-summary-table');if(!table)return;
   table.querySelectorAll('tbody tr').forEach(tr=>{
     tr.style.display='';
     tr.classList.remove('pc-selected');
     tr.removeAttribute('data-portfolio-site');
     tr.removeAttribute('title');
   });
   view.querySelectorAll('.exec-context-restore,.aip-portfolio-breadcrumb').forEach(x=>x.remove());
 }
 function resolveExecutiveSite(tr){
   const match=(tr.textContent||'').match(/\b(?:SP|SOL)-\d{2,}\b/i);
   const id=canonicalSite(match?match[0]:'');
   const site=rawSites().find(s=>canonicalSite(s.id)===id);
   const first=tr.querySelector('td');
   return {id:(site&&site.id)||id,name:(site&&site.name)||String(first?.textContent||id).replace(id,'').replace(/^[\s·–—-]+/,'').trim()};
 }
 function chooseExistingAssetExplorerSite(site){
   if(!site||!site.id)return false;
   const buttons=[...document.querySelectorAll('#view-assetexplorer [data-ax-site]')];
   const btn=buttons.find(b=>
     canonicalSite(b.dataset.axSite)===canonicalSite(site.id)||
     norm(b.dataset.axSite)===norm(site.name)||
     norm(b.textContent).includes(norm(site.id))||
     (site.name&&norm(b.textContent).includes(norm(site.name)))
   );
   if(!btn)return false;
   btn.click();
   btn.scrollIntoView?.({block:'nearest',behavior:'auto'});
   return true;
 }
 function openAssetExplorerForSite(site){
   if(!site||!site.id)return;
   state.plantId='';state.plantName='';save();
   document.querySelectorAll('.aip-portfolio-breadcrumb,.portfolio-scope-banner').forEach(x=>x.remove());
   const nav=document.querySelector('.nav-item[data-view="assetexplorer"]');
   const target=document.getElementById('view-assetexplorer');
   if(!nav||!target)return;

   // Switch the visible pane immediately, before the heavier Asset Explorer render.
   document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
   nav.classList.add('active');
   document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
   target.classList.add('active');

   // Let the browser paint the new pane, then invoke the existing navigation/render logic.
   setTimeout(()=>{
     nav.click();
     let attempts=0;
     const select=()=>{
       if(chooseExistingAssetExplorerSite(site))return;
       if(++attempts<8)setTimeout(select,80);
     };
     requestAnimationFrame(select);
   },0);
 }
 function decorateExecutiveInvestigate(){
   const table=document.querySelector('#view-executiveperformance .executive-site-summary-table');if(!table)return;
   const hr=table.querySelector('thead tr');
   if(hr&&!hr.querySelector('.exec-investigate-head')){
     const th=document.createElement('th');th.className='exec-investigate-head';th.textContent='Investigate';hr.appendChild(th);
   }
   table.querySelectorAll('tbody tr').forEach(tr=>{
     let td=tr.querySelector('.exec-investigate-cell');
     if(!td){td=document.createElement('td');td.className='exec-investigate-cell';tr.appendChild(td)}
     const site=resolveExecutiveSite(tr);
     let btn=td.querySelector('.exec-investigate-btn');
     if(!site.id){td.textContent='';return}
     if(!btn){
       btn=document.createElement('button');
       btn.type='button';btn.className='exec-investigate-btn';btn.textContent='Investigate';
       td.replaceChildren(btn);
     }
     btn.setAttribute('aria-label','Investigate '+(site.name||site.id)+' in Asset Explorer');
     btn.dataset.siteId=site.id;btn.dataset.siteName=site.name||'';
     if(btn.dataset.bound!=='1'){
       btn.dataset.bound='1';
       btn.addEventListener('click',e=>{
         e.preventDefault();e.stopPropagation();
         const selected={id:btn.dataset.siteId,name:btn.dataset.siteName};
         openAssetExplorerForSite(selected);
       });
     }
   });
 }
 function syncAssetExplorer(){
   if(!state.plantId||!document.getElementById('view-assetexplorer')?.classList.contains('active'))return;
   const site=rawSites().find(s=>canonicalSite(s.id)===canonicalSite(state.plantId));
   const buttons=[...document.querySelectorAll('#view-assetexplorer [data-ax-site]')];
   const btn=buttons.find(b=>norm(b.dataset.axSite)===norm(state.plantId)||norm(b.dataset.axSite)===norm(site?.name)||norm(b.textContent).includes(norm(state.plantId))||norm(b.textContent).includes(norm(site?.name)));
   if(btn&&!btn.closest('.ax-site')?.classList.contains('pc-site-synced')){btn.closest('.ax-site')?.classList.add('pc-site-synced');btn.click()}
 }
 function refreshDecorations(){removeLegacyUI();decorateTables();applyExecutiveSummary();decorateExecutiveInvestigate();syncAssetExplorer();decorateBreadcrumb()}
 function forceRefresh(){try{window.refreshAllAPM?.()}catch(e){console.warn('Portfolio context refresh failed',e)}setTimeout(refreshDecorations,80);setTimeout(refreshDecorations,260)}
 function setContext(id,source){
   const sites=rawSites(),s=sites.find(x=>canonicalSite(x.id)===canonicalSite(id));
   state.plantId=s?s.id:'';state.plantName=s?s.name:'';save();
   const active=document.querySelector('.view.active');
   const comparison=active&&['view-portfoliobenchmarking','view-siteperformance'].includes(active.id);
   if(comparison)refreshDecorations();else forceRefresh();
   document.dispatchEvent(new CustomEvent('aip:portfolio-context-changed',{detail:{...state,source}}));
 }
 document.addEventListener('click',e=>{
   const tr=e.target.closest('.site-performance-league-table tbody tr');if(!tr)return;
   const match=(tr.textContent||'').match(/\b(?:SP|SOL)-\d{2,}\b/i);
   const id=tr.dataset.portfolioSite||(match?match[0]:'');if(id)setContext(id,'portfolio-table');
 },true);
 document.addEventListener('click',e=>{if(e.target.closest('.nav-item'))setTimeout(refreshDecorations,120)},true);
 ['aip:data-source-changed','apm:datasource-refreshed','aip:data-rendered'].forEach(ev=>document.addEventListener(ev,()=>{if(!validSelected()){state.plantId='';state.plantName='';save()}setTimeout(refreshDecorations,100)}));
 let obsTimer=0;const obs=new MutationObserver(()=>{
   const active=document.querySelector('.view.active');
   if(active?.id==='view-assetexplorer')return;
   if(active&&!breadcrumbViews.has(active.id)&&active.id!=='view-executiveperformance')return;
   clearTimeout(obsTimer);obsTimer=setTimeout(refreshDecorations,100);
 });
 function boot(){load();if(!validSelected()){state.plantId='';state.plantName='';save()}removeLegacyUI();refreshDecorations();obs.observe(document.getElementById('main')||document.body,{childList:true,subtree:true});setTimeout(refreshDecorations,350)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 window.AIPPortfolioContext={get:()=>({...state}),set:setContext,clear:()=>setContext('','api'),filterRows,viewRows,rowPlant,canonicalSite};
})();
