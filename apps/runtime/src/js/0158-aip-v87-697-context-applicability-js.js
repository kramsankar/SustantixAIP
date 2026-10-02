
(function(){
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const norm=x=>String(x??'').trim();
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

 function uniq(arr){ return [...new Set(arr.map(norm).filter(Boolean))]; }

 function option(value,label,selected,disabled){
   const o=document.createElement('option');
   o.value=value;
   o.textContent=label;
   o.selected=!!selected;
   o.disabled=!!disabled;
   if(disabled) o.title='Not applicable to the current upstream selection';
   return o;
 }

 function ensureNote(field,text){
   if(!field)return;
   let n=field.querySelector('.ms697-context-note');
   if(!n){
     n=document.createElement('div');
     n.className='ms697-context-note';
     field.appendChild(n);
   }
   if(n.textContent!==text)n.textContent=text;
 }

 function bind(view){
   const root=document.getElementById('view-'+view);
   const ws=root?.querySelector('.ms686-workspace');
   const sel=ws?._sel;
   if(!ws||!sel||!Array.isArray(sel.lens))return;

   const siteSel=ws.querySelector('.ms686-site');
   const assetSel=ws.querySelector('.ms686-asset');
   const failSel=ws.querySelector('.ms686-failure');
   if(!siteSel||!assetSel||!failSel)return;

   const site=norm(root.dataset.ms686site||sel.site||'All');
   const asset=norm(root.dataset.ms686asset||sel.asset||'All');
   const failure=norm(root.dataset.ms686failure||sel.failure||'All');

   // ASSET: retain every qualifying asset in the active strategy lens.
   // Only assets belonging to the selected site remain selectable.
   const allAssets=[...sel.lens].sort((a,b)=>norm(a.key).localeCompare(norm(b.key)));
   const assetAllowed=p => site==='All' || norm(p.plant)===site;

   // If upstream context made the current asset invalid, return to aggregate safely.
   const currentAsset=allAssets.find(p=>norm(p.key)===asset);
   if(asset!=='All' && (!currentAsset || !assetAllowed(currentAsset))){
     root.dataset.ms686asset='All';
     root.dataset.ms686failure='All';
   }
   const effectiveAsset=norm(root.dataset.ms686asset||'All');

   const afrag=document.createDocumentFragment();
   afrag.appendChild(option('All','All qualifying assets / components',effectiveAsset==='All',false));
   allAssets.slice(0,400).forEach(p=>{
     const allowed=assetAllowed(p);
     afrag.appendChild(option(
       norm(p.key),
       norm(p.key)+' · '+norm(p.label||p.key),
       norm(p.key)===effectiveAsset,
       !allowed
     ));
   });
   assetSel.replaceChildren(afrag);

   // FAILURE MODE: retain every explicit mode in the active strategy lens.
   // Applicability is Site -> Asset -> explicit mode. No inferred cross-equipment joins.
   const allModes=uniq(sel.lens.flatMap(p=>Array.isArray(p.failures)?p.failures:[])).sort();
   const eligiblePopulation=sel.lens.filter(p=>{
     if(site!=='All' && norm(p.plant)!==site)return false;
     if(effectiveAsset!=='All' && norm(p.key)!==effectiveAsset)return false;
     return true;
   });
   const applicableModes=new Set(uniq(eligiblePopulation.flatMap(p=>Array.isArray(p.failures)?p.failures:[])));

   let effectiveFailure=failure;
   if(effectiveFailure!=='All' && !applicableModes.has(effectiveFailure)){
     root.dataset.ms686failure='All';
     effectiveFailure='All';
   }

   const ffrag=document.createDocumentFragment();
   if(allModes.length){
     ffrag.appendChild(option('All','All applicable failure modes',effectiveFailure==='All',false));
     allModes.forEach(mode=>{
       ffrag.appendChild(option(mode,mode,mode===effectiveFailure,!applicableModes.has(mode)));
     });
     failSel.disabled=false;
     failSel.classList.remove('ms696-no-fm');
   }else{
     ffrag.appendChild(option('','No applicable failure mode available',true,true));
     failSel.disabled=true;
     failSel.classList.add('ms696-no-fm');
   }
   failSel.replaceChildren(ffrag);

   ensureNote(assetSel.closest('.ms686-field'),
     site==='All'
       ? 'All assets remain selectable until a Site is chosen.'
       : 'Dark = applicable to selected Site · light = visible but unavailable.'
   );
   ensureNote(failSel.closest('.ms686-field'),
     effectiveAsset==='All'
       ? 'Dark = applicable to the current Site scope · light = unavailable.'
       : 'Dark = applicable to selected Asset / Asset Class · light = visible but unavailable.'
   );
 }

 function apply(){VIEWS.forEach(bind)}
 let raf=0;
 function schedule(){
   if(raf)return;
   raf=requestAnimationFrame(()=>{raf=0;apply()});
 }

 // Capture upstream changes after the core renderer has rebuilt the workspace.
 document.addEventListener('change',e=>{
   if(e.target.matches('.ms686-site,.ms686-asset,.ms686-failure'))setTimeout(schedule,25);
 },true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(schedule,40));
 document.addEventListener('click',e=>{
   if(e.target.closest('.aip-maint-subtabs,.tabs,.tab,[data-view]'))setTimeout(schedule,35);
 },true);

 // Observe workspace replacement only; callback itself is idempotent.
 const main=document.getElementById('main')||document.body;
 new MutationObserver(muts=>{
   if(muts.some(m=>[...m.addedNodes].some(n=>n.nodeType===1 && (n.matches?.('.ms686-workspace')||n.querySelector?.('.ms686-workspace')))))schedule();
 }).observe(main,{childList:true,subtree:true});

 setTimeout(schedule,60);
 setTimeout(schedule,260);
})();
