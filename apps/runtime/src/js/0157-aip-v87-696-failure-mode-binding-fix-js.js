
(function(){
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];

 function norm(x){ return String(x??'').trim(); }
 function uniq(a){ return [...new Set(a.map(norm).filter(Boolean))]; }

 function getState(ws){
   return {
     site: ws?.dataset?.ms686site || '',
     asset: ws?.dataset?.ms686asset || '',
     failure: ws?.dataset?.ms686failure || ''
   };
 }

 function findFailureSelect(ws){
   const sels=[...ws.querySelectorAll('select')];
   return sels.find(s=>{
     const txt=(s.closest('.ms686-field')?.textContent||'')+' '+(s.name||'')+' '+(s.id||'');
     return /failure\s*mode/i.test(txt);
   }) || null;
 }

 function collectFailureModes(ws){
   const state=getState(ws);
   const pop=Array.isArray(window.ms686Population)?window.ms686Population:
             (typeof window.buildPopulation==='function' ? window.buildPopulation() : []);

   let rows=pop;
   if(state.site && !/^all$/i.test(state.site)){
     rows=rows.filter(p=>norm(p.site)===norm(state.site) || norm(p.siteId)===norm(state.site));
   }
   if(state.asset && !/^all$/i.test(state.asset)){
     rows=rows.filter(p=>{
       const keys=[p.asset,p.assetId,p.asset_id,p.tag,p.assetTag,p.id].map(norm);
       return keys.includes(norm(state.asset));
     });
   }

   let modes=[];
   rows.forEach(p=>{
     if(Array.isArray(p.failureModes)) modes.push(...p.failureModes);
     if(Array.isArray(p.failures)) modes.push(...p.failures);
     ['failureMode','failure_mode','failure','mode','failureName'].forEach(k=>{
       if(p[k]) modes.push(p[k]);
     });
     if(Array.isArray(p.work)) p.work.forEach(r=>{
       ['Failure_Mode','Failure Mode','failure_mode','failureMode','Failure','Failure_Mode_Name'].forEach(k=>{
         if(r?.[k]) modes.push(r[k]);
       });
     });
     if(Array.isArray(p.condition)) p.condition.forEach(r=>{
       ['Failure_Mode','Failure Mode','failure_mode','failureMode','Failure','Failure_Mode_Name'].forEach(k=>{
         if(r?.[k]) modes.push(r[k]);
       });
     });
     if(Array.isArray(p.risk)) p.risk.forEach(r=>{
       ['Failure_Mode','Failure Mode','failure_mode','failureMode','Failure','Failure_Mode_Name'].forEach(k=>{
         if(r?.[k]) modes.push(r[k]);
       });
     });
   });

   return uniq(modes);
 }

 function rebuild(ws){
   const sel=findFailureSelect(ws);
   if(!sel) return;

   const state=getState(ws);
   const modes=collectFailureModes(ws);
   const current=state.failure || sel.value || '';

   const desired = modes.length
     ? ['All applicable failure modes', ...modes]
     : ['No applicable failure mode available'];

   const existing=[...sel.options].map(o=>o.textContent.trim());
   if(existing.length===desired.length && existing.every((x,i)=>x===desired[i])) return;

   sel.innerHTML='';
   desired.forEach((label,i)=>{
     const o=document.createElement('option');
     o.textContent=label;
     o.value = i===0 ? (modes.length ? 'All' : '') : label;
     sel.appendChild(o);
   });

   if(modes.length){
     if(current && !/^all/i.test(current) && modes.includes(current)) sel.value=current;
     else sel.value='All';
     sel.disabled=false;
     sel.classList.remove('ms696-no-fm');
   }else{
     sel.value='';
     sel.disabled=true;
     sel.classList.add('ms696-no-fm');
     ws.dataset.ms686failure='';
   }
 }

 function apply(){
   VIEWS.forEach(v=>{
     const root=document.getElementById('view-'+v);
     const ws=root?.querySelector('.ms686-workspace');
     if(ws) rebuild(ws);
   });
 }

 let raf=0;
 function schedule(){
   if(raf) cancelAnimationFrame(raf);
   raf=requestAnimationFrame(()=>{raf=0;apply();});
 }

 document.addEventListener('change',e=>{
   if(e.target.matches('select')) setTimeout(schedule,25);
 },true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(schedule,30));
 document.addEventListener('click',e=>{
   if(e.target.closest('.ms686-tabs,.tabs,.tab')) setTimeout(schedule,30);
 },true);

 setTimeout(schedule,40);
 setTimeout(schedule,250);
})();
