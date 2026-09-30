
(function(){
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];

 function evidenceCountFromAssessment(a){
   if(!a) return 0;
   if(Number.isFinite(+a.ev)) return +a.ev;
   const counts=[
     a.work?.length,a.condition?.length,a.risk?.length,a.failure?.length,
     a.workCount,a.conditionCount,a.riskCount,a.failureCount
   ].filter(x=>Number.isFinite(+x)).map(Number);
   return counts.reduce((s,n)=>s+n,0);
 }

 function hasCalculatedScores(a){
   if(!a) return false;
   const vals=[a.preventive,a.predictive,a.corrective,a.riskbased,a.adaptive,
               a.Preventive,a.Predictive,a.Corrective,a['Risk-Based'],a.Adaptive];
   return vals.some(v=>Number.isFinite(+v));
 }

 function isAggregateAssessment(a, ws){
   if(!a) return false;
   if(Array.isArray(a.items) && a.items.length>0) return true;
   if(Number.isFinite(+a.n) && +a.n>1) return true;
   const assetSel=ws?.querySelector('select[data-ms686="asset"],select[name*="asset" i],.ms686-field select');
   if(assetSel && /all/i.test(assetSel.options?.[assetSel.selectedIndex]?.text||'')) return true;
   return false;
 }

 function sufficient(a, ws){
   if(!a) return false;

   // Explicit boolean from the core renderer remains authoritative when true.
   if(a.sufficient === true) return true;

   const ev=evidenceCountFromAssessment(a);
   const calc=hasCalculatedScores(a);

   // Individual asset/failure-mode: two linked evidence records is enough.
   // This matches the core assessment rule and prevents valid 521/538-type cases
   // from being incorrectly hidden by the no-evidence UI layer.
   if(!isAggregateAssessment(a,ws)) return calc && ev >= 2;

   // Aggregate ("All"): only show a suitability distribution when at least one
   // qualifying assessed member contributes a calculated score and evidence.
   // Do not require every member to meet the individual threshold.
   const items=Array.isArray(a.items)?a.items:[];
   if(items.length){
     return items.some(x=>hasCalculatedScores(x) && evidenceCountFromAssessment(x)>=2);
   }
   return calc && ev >= 2;
 }

 function apply(){
   VIEWS.forEach(v=>{
     const root=document.getElementById('view-'+v);
     const ws=root?.querySelector('.ms686-workspace');
     if(!ws)return;

     const cards=[...ws.querySelectorAll('.ms686-card')];
     const suit=cards.find(c=>/Cross-Strategy Suitability/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''));
     if(!suit)return;

     const a=ws._a||{};
     const scoreGrid=suit.querySelector('.ms686-scoregrid');
     const ok=sufficient(a,ws);
     let state=suit.querySelector('.ms693-empty');

     if(ok){
       if(scoreGrid) scoreGrid.style.display='';
       state?.remove();

       // Remove stale visibility suppression from earlier patch.
       suit.querySelectorAll('.ms686-score').forEach(x=>x.style.display='');

       let note=suit.querySelector('.ms695-note');
       if(!note){
         note=document.createElement('div');
         note.className='ms695-note';
         suit.appendChild(note);
       }
       note.textContent=isAggregateAssessment(a,ws)
         ? 'All = aggregated suitability across qualifying assessed assets/components.'
         : 'Suitability calculated from linked evidence for the selected context.';
     }else{
       if(scoreGrid) scoreGrid.style.display='none';
       suit.querySelector('.ms695-note')?.remove();

       if(!state){
         state=document.createElement('div');
         state.className='ms693-empty';
         suit.appendChild(state);
       }
       const ev=evidenceCountFromAssessment(a);
       state.textContent=ev===0
         ? 'No significant maintenance, condition or risk evidence exists to assess cross-strategy suitability for the selected context.'
         : 'Insufficient linked evidence to assess cross-strategy suitability reliably for the selected context.';
     }
   });
 }

 // Run after core renderer/filter changes without creating a self-triggering mutation loop.
 let raf=0;
 function schedule(){
   if(raf) cancelAnimationFrame(raf);
   raf=requestAnimationFrame(()=>{raf=0;apply();});
 }
 document.addEventListener('aip:data-source-changed',()=>setTimeout(schedule,20));
 document.addEventListener('change',()=>setTimeout(schedule,20),true);
 document.addEventListener('click',e=>{
   if(e.target.closest('.ms686-field,.ms686-tabs,.tabs,.tab')) setTimeout(schedule,20);
 },true);
 setTimeout(schedule,30);
 setTimeout(schedule,220);
})();
