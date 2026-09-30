
(function(){
 const cards=' .card.enhanced-kpi,.kpi-card,.metric-card,.stat-card,.vision-kpi,.ops-kpi,.ai3-kpi,.aig-kpi,.sx-kpi,.avx-kpi,.dm-kpi,.aigsp-metric,.api-stat,.cb-stat,.mdp-stat,.ad-stat,.inv-tile';
 const explanations={
  'availability':'Fleet operating availability','generation':'Energy generated for the selected period','performance ratio':'Actual output relative to expected output','pr':'Fleet performance ratio','mttr':'Mean time required to restore service','mtbf':'Mean operating time between failures',
  'inspection coverage':'Coverage of scheduled inspections','panels inspected':'Solar modules inspected by AI vision','ai detections':'Potential defects detected by AI','critical defects':'Defects requiring immediate action','thermal hotspots':'Hotspots detected through thermal imaging','soiling findings':'Soiling-related performance issues identified','work orders created':'Maintenance orders generated from findings','defects resolved':'Detected defects successfully closed','estimated loss':'Potential energy loss identified','revenue risk':'Estimated financial exposure from unresolved issues',
  'open work orders':'Maintenance orders currently open','overdue work orders':'Work orders beyond their due date','predictive':'AI-recommended maintenance share','preventive':'Planned maintenance share','corrective':'Breakdown maintenance share','maintenance compliance':'Maintenance completed within plan','crew utilization':'Assigned productive capacity of available crews','first-time fix':'Jobs completed without repeat intervention',
  'claims':'Warranty claims identified','open claims':'Warranty claims awaiting closure','recovery':'Expected OEM warranty recovery','days open':'Average age of open claims','oem exposure':'Value attributable to OEM warranty obligations','claim opportunities':'Potential recoverable warranty cases',
  'success rate':'Share of interventions producing the intended outcome','recommendation confidence':'Confidence in the recommended maintenance action','learned practices':'Validated maintenance practices retained by the platform','root causes':'Distinct causal patterns identified','incidents':'Operational incidents reconstructed from event evidence',
  'inventory days':'Estimated days of spares coverage','stockout risk':'Items at risk of stockout','critical spares':'High-priority parts requiring assured availability','inventory value':'Current value of spare-parts inventory',
  'carbon avoided':'Emissions avoided through renewable generation','water intensity':'Water consumed per unit of generation','waste diverted':'Waste recovered or diverted from disposal','safety incidents':'Recorded health and safety incidents',
  'models active':'AI models currently active','models monitored':'Models under performance monitoring','policy compliance':'AI actions compliant with configured policies','approvals pending':'AI decisions awaiting human approval','guardrail breaches':'Policy or safety exceptions detected'
 };
 function txt(el,sel){const n=el.querySelector(sel);return n?(n.textContent||'').trim():''}
 function label(el){return (txt(el,'.kpi-label,.lbl,.label,.lab,.l,.metric-label,.vision-kpi-label,.tile-id,h3,h4')||'KPI').replace(/\s+/g,' ').trim()}
 function explanationFor(l){const k=l.toLowerCase();for(const [key,val] of Object.entries(explanations)){if(k===key||k.includes(key))return val}return 'Current '+l.toLowerCase()+' position based on the active dataset'}
 function normalizeCard(el){
  const l=label(el), exp=explanationFor(l);
  let wraps=[...el.querySelectorAll(':scope > .aip-kpi-ring-wrap')];
  if(wraps.length>1){wraps.slice(0,-1).forEach(x=>x.remove());wraps=[wraps[wraps.length-1]]}
  const wrap=wraps[0];
  if(wrap){
   let note=wrap.querySelector('.aip-kpi-ring-note');
   if(!note){note=document.createElement('div');note.className='aip-kpi-ring-note';wrap.appendChild(note)}
   const clean=(note.textContent||'').replace(/^\s*\d+(?:\.\d+)?%\s*:\s*/,'').trim();
   if(!clean||/current kpi position based/i.test(clean)||/no comparable numeric/i.test(clean)) note.textContent=exp;
  } else {
   let ctx=el.querySelector(':scope > .kpi-ring-context,:scope > .kpi-explanation,:scope > .metric-explanation,:scope > .ring-explanation');
   const hasRing=el.querySelector('.kpi-mini-ring,.vision-ring,.ai3-ring,.ops-donut');
   if(hasRing){
    if(!ctx){ctx=document.createElement('div');ctx.className='kpi-ring-context';el.appendChild(ctx)}
    if(!(ctx.textContent||'').trim())ctx.textContent=exp;
   }
  }
 }
 function run(root=document){root.querySelectorAll(cards).forEach(normalizeCard)}
 let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;run()})}
 function boot(){run();const main=document.getElementById('main')||document.body;new window.__APMSafeMutationObserver(queue).observe(main,{childList:true,subtree:true});setTimeout(run,500);setTimeout(run,1500)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
