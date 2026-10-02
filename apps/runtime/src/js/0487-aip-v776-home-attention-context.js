
(function(){'use strict';
 function norm(x){return String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
 function clear(root){
   (root||document).querySelectorAll('.aip776-home-action-hit').forEach(x=>x.classList.remove('aip776-home-action-hit'));
   (root||document).querySelectorAll('.aip776-home-action-banner').forEach(x=>x.remove());
 }
 function banner(root,text){
   if(!root)return; root.querySelector('.aip776-home-action-banner')?.remove();
   const b=document.createElement('div'); b.className='aip776-home-action-banner';
   b.innerHTML='<span>Operations Hub action context · '+String(text||'Selected source record')+'</span><button type="button" aria-label="Clear Operations Hub action context">×</button>';
   const anchor=root.querySelector('.msi-head,.view-head,.xi-head')||root.firstElementChild;
   if(anchor) anchor.insertAdjacentElement('afterend',b); else root.prepend(b);
   b.querySelector('button').onclick=()=>clear(root);
 }
 function bestTextRow(root,needles){
   const nn=needles.map(norm).filter(Boolean); if(!root||!nn.length)return null;
   const rows=[...root.querySelectorAll('tbody tr,.msi-rec')];
   let best=null,score=0;
   rows.forEach(r=>{const t=norm(r.textContent);let sc=0;nn.forEach(n=>{if(t.includes(n))sc+=Math.max(2,n.split(' ').length)});if(sc>score){score=sc;best=r}});
   return score>=2?best:null;
 }
 window.AIPHomeOpenAttentionExact=function(meta){
   meta=meta||{}; const view=meta.view||''; window.__aipLastUserNavTime=Date.now();
   const isSpares=meta.type==='Spares'||view==='spares';
   let sparesRoot=isSpares?document.getElementById('view-spares'):null;
   // For a Home -> Spares handoff, keep the destination hidden until Inventory and the exact source row are ready.
   if(sparesRoot){sparesRoot.style.visibility='hidden';sparesRoot.setAttribute('data-aip-home-handoff','1')}
   try{window.AIPHideHome?.()}catch(_){}
   try{if(view&&typeof window.activate==='function')window.activate(view)}catch(_){}
   let tries=0;
   const revealSpares=()=>{if(sparesRoot){sparesRoot.style.visibility='';sparesRoot.removeAttribute('data-aip-home-handoff')}};
   const resolve=()=>{
     const root=document.getElementById('view-'+view);
     if(!root||!root.classList.contains('active')){if(tries++<30)return setTimeout(resolve,40);revealSpares();return}
     clear(root);
     // Work-order attention must hand off by the authoritative WO id.
     // Do not use generic text matching here: records from the same site/entity can
     // otherwise select a different visible WO (for example WO-00067 instead of WO-00096).
     if((meta.type==='Work Order'||view==='workorderintelligence') && meta.id){
       let woTries=0;
       const openExactWO=()=>{
         try{
           if(typeof window.opsOpenWO==='function'){
             window.opsOpenWO(meta.id);
             const wr=document.getElementById('view-workorderintelligence');
             if(wr) banner(wr,(meta.title||meta.id)+' · exact work order '+meta.id+' selected');
             return;
           }
         }catch(_){}
         if(woTries++<30)return setTimeout(openExactWO,40);
         const wr=document.getElementById('view-workorderintelligence');
         if(wr) banner(wr,(meta.title||meta.id)+' · Work Order Intelligence opened; exact work-order renderer was not ready');
       };
       return openExactWO();
     }
     if(isSpares){
       // Replenishment/stock attention is an Inventory exception, never a generic Overview/Availability landing.
       try{window.msiSetTab?.('inventory')}catch(_){}
       let invTries=0;
       const locateInventory=()=>{
         const r=document.getElementById('view-spares'); sparesRoot=r||sparesRoot;
         const entity=String(meta.entity||'').replace(/\(central inverter\)/ig,'').trim();
         let hit=null;
         // Prefer the authoritative part/site data attributes, then fall back to visible part description.
         const part=entity.match(/PRT-\d+/i)?.[0]||'';
         if(part&&meta.site) hit=r?.querySelector('tr[data-msi-part="'+CSS.escape(part)+'"][data-msi-site="'+CSS.escape(meta.site)+'"]');
         if(!hit&&part) hit=r?.querySelector('tr[data-msi-part="'+CSS.escape(part)+'"]');
         if(!hit) hit=bestTextRow(r,[entity,meta.site]);
         if(!hit&&/igbt/i.test(entity)) hit=bestTextRow(r,['IGBT power module',meta.site]);
         // Inventory renderer may complete on the next paint; do not reveal an intermediate tab.
         if(!hit&&invTries++<20)return setTimeout(locateInventory,25);
         if(hit){hit.classList.add('aip776-home-action-hit');hit.scrollIntoView?.({block:'center',behavior:'auto'});banner(r,(meta.title||'Spares action')+' · exact inventory/reorder context');}
         else banner(r,(meta.title||'Spares action')+' · Inventory opened; exact source part was not found in the active governed inventory population');
         requestAnimationFrame(()=>requestAnimationFrame(revealSpares));
       };
       return locateInventory();
     }
     let hit=bestTextRow(root,[meta.id,meta.entity,meta.site]);
     if(hit){hit.classList.add('aip776-home-action-hit');hit.scrollIntoView?.({block:'center',behavior:'auto'});banner(root,(meta.title||meta.id||'Action')+' · source record selected');}
     else if(meta.id) banner(root,(meta.title||meta.id)+' · destination opened; exact source row is not exposed in this view');
   };
   resolve();
 };
 // Capture Home attention clicks before the legacy handler so every action receives record-level context.
 document.addEventListener('click',function(e){
   const b=e.target.closest&&e.target.closest('#aipHomeOverlay .home-attn-open[data-open-view]'); if(!b)return;
   e.preventDefault(); e.stopImmediatePropagation();
   let view=b.getAttribute('data-open-view')||''; if(view==='inventory')view='spares';
   window.AIPHomeOpenAttentionExact({view:view,id:b.getAttribute('data-record-id')||'',type:b.getAttribute('data-record-type')||'',entity:b.getAttribute('data-record-entity')||'',site:b.getAttribute('data-record-site')||'',title:b.closest('.home-attn-row')?.querySelector('.home-attn-body b')?.textContent||''});
 },true);
 window.AIP_V777_AUDIT={release:'v777',baseline:'v776',homeAttentionNavigation:'atomic Home-to-Spares Inventory handoff with exact row highlight and clear control',inventoryTable:'compact vertical header and rows',excelBusinessDataChanged:false};
 window.AIP_CURRENT_BUILD='v777';
})();
