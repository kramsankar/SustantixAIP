
(function(){
'use strict';
const UI467=()=>window.PLAN_UI||(window.PLAN_UI={});
const RT467=()=>window.AIPPlanningRuntime;

const MAP={
 'Balanced':'balanced',
 'Earliest Completion':'earliest_completion',
 'Lowest Execution Cost':'lowest_execution_cost',
 'Resource Efficiency':'resource_efficiency',
 'Minimum Schedule Change':'minimum_schedule_change'
};

function raw463(name){
 const syn=(typeof mode==='function'?RT467().dataMode():'Excel')==='Synthetic';let raw=[];
 if(syn){const p=window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData||{};if(Array.isArray(p[name]))raw=p[name]}
 if(!raw.length){const imp=window.APM_IMPORTED_DATA||{};if(!syn&&Array.isArray(imp[name])&&imp[name].length)raw=imp[name]}
 if(!raw.length&&Array.isArray(window.EMBEDDED_EXCEL_DATA?.[name]))raw=window.EMBEDDED_EXCEL_DATA[name];
 return raw;
}
function source463(){
 const names=['PLAN_Interventions','PLAN_Schedule','PLAN_Requirements','PNO_Materials','PNO_Technician_Skills','PLAN_Resource_Calendar','PNO_Resource_Calendar','PLAN_Calendar','PLAN_Tool_Master','PLAN_Vehicle_Master','PNO_Intervention_Cost_Basis','PLAN_RCM_Context','PNO_Site_Mobilization','PNO_Vehicle_Mobilization','PLAN_Weather_Forecast','PLAN_Data_Window_Config','PNO_Data_Window_Config','PNO_Interventions','PNO_Fleet_Schedule','PNO_Crew_Rates','PNO_Optimization_Cost_Config'];
 const out={};names.forEach(n=>out[n]=raw463(n));return out;
}
function opts463(strategy){
 const now=RT467().runtimeNow(),custom=UI467().horizon==='custom';
 const horizonDays=custom?Math.max(1,Math.ceil((new Date(UI467().customTo)-now)/86400000)):Math.max(1,Number(UI467().horizon)||30);
 return {asOf:now,siteId:UI467().site||'All',horizonDays,horizonEnd:custom?UI467().customTo:null,slotHours:8,sourceMode:RT467().dataMode(),objectiveStrategy:MAP[strategy]||'balanced'};
}
function slotDate463(model,slot){
 const d=new Date(model.horizon.startDate);d.setHours(d.getHours()+Number(slot||0)*Number(model.horizon.slotHours||8));return d;
}
function num467(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function avg467(a,d=0){const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:d}
function dayToken467(d){return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]}
function parseWorkDays467(v){
 const t=String(v||'Mon–Fri').replaceAll('—','–').trim();
 const all=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 if(/Mon.?Sat/i.test(t))return new Set(['Mon','Tue','Wed','Thu','Fri','Sat']);
 if(/Mon.?Fri/i.test(t))return new Set(['Mon','Tue','Wed','Thu','Fri']);
 const out=new Set();all.forEach(x=>{if(new RegExp(x,'i').test(t))out.add(x)});return out.size?out:new Set(['Mon','Tue','Wed','Thu','Fri']);
}
function enrichModel467(model,src){
 const tech=(src.PNO_Technician_Skills||[]),costRows=(src.PNO_Intervention_Cost_Basis||[]);
 const costBy=new Map(costRows.map(r=>[String(r.Intervention_ID),r]));
 const skillStats=new Map();
 tech.forEach(t=>{
   const k=String(t.Primary_Skill||'').trim();if(!k)return;
   const x=skillStats.get(k)||{regular:[],holiday:[],ot:[],days:[]};
   x.regular.push(num467(t.Regular_Rate_INR_Hr,0));x.holiday.push(num467(t.Holiday_Rate_INR_Hr,0));x.ot.push(num467(t.Overtime_Rate_INR_Hr,0));x.days.push(parseWorkDays467(t.Work_Days));skillStats.set(k,x);
 });
 function skillProfile(skill){
   const x=skillStats.get(String(skill||''))||{regular:[1],holiday:[1.75],ot:[1.5],days:[new Set(['Mon','Tue','Wed','Thu','Fri'])]};
   const reg=Math.max(1,avg467(x.regular,1)),hol=Math.max(reg,avg467(x.holiday,reg*1.75));
   return {holidayMultiplier:hol/reg,days:x.days};
 }
 function normalShare(profile,d){const tok=dayToken467(d);return profile.days.length?profile.days.filter(set=>set.has(tok)).length/profile.days.length:1}
 (model.interventions||[]).forEach(iv=>{
   const c=costBy.get(String(iv.id))||{};
   const total=num467(c.Total_Execution_Cost_INR,iv.executionCost||0),labour=Math.max(0,num467(c.Labour_Cost_INR,0));
   const skill=(iv.resourceRequirements||[]).find(q=>String(q.resourceId||'').startsWith('SKILL::'))?.resourceId?.slice(7)||'';
   const profile=skillProfile(skill),fixed=Math.max(0,total-labour);
   iv.executionCost=fixed;
   iv.baseLabourCost=labour;
   iv.governedTotalExecutionCost=total;
   iv.startEconomicCostBySlot={};
   iv.startCostBySlot={};
   const hours=Math.max(0,num467(iv.durationHours,num467(iv.durationSlots,1)*num467(model.horizon.slotHours,8)));
   (iv.allowedStartSlots||[]).forEach(st=>{
      let remaining=hours,weighted=0,totalH=0,block=0;
      while(remaining>1e-9){
        const h=Math.min(num467(model.horizon.slotHours,8),remaining),d=slotDate463(model,Number(st)+block);
        const share=normalShare(profile,d),mult=share>=0.5?1:profile.holidayMultiplier;
        weighted+=h*mult;totalH+=h;remaining-=h;block++;
      }
      const dynLabour=labour*(totalH?weighted/totalH:1),economic=Math.max(0,dynLabour);
      iv.startEconomicCostBySlot[st]=economic;
      // Tiny schedule-stability amount breaks exact economic ties without changing displayed INR economics.
      iv.startCostBySlot[st]=economic+Math.abs(Number(st)-Number(iv.baselineStartSlot||0))*1e-4;
   });
   iv.costLineage={fixedNonLabourINR:fixed,baseLabourINR:labour,governedTotalINR:total,skill,rule:'Governed labour premium by feasible start date; exact-cost ties minimize schedule movement'};
 });
 return model;
}
function economicCost467(iv,slot){
 const e=iv?.startEconomicCostBySlot?.[slot];
 return num467(iv?.executionCost,0)+(e!==undefined?num467(e,0):num467(iv?.baseLabourCost,0));
}
function resourceMetrics467(model,schedule){
 const used={};(model.resources||[]).forEach(r=>used[r.id]=Array.from({length:model.horizon.slots},()=>0));
 (schedule||[]).forEach(x=>{const iv=(model.interventions||[]).find(i=>i.id===x.interventionId);if(!iv)return;(iv.resourceRequirements||[]).forEach(req=>{if(!used[req.resourceId])return;for(let t=Number(x.startSlot);t<Number(x.startSlot)+Number(iv.durationSlots||1)&&t<used[req.resourceId].length;t++)used[req.resourceId][t]+=num467(req.quantity,1)})});
 let peak=0,constrained=0,conflicts=0,burden=0;
 (model.resources||[]).forEach(r=>{for(let t=0;t<model.horizon.slots;t++){const u=num467(used[r.id]?.[t],0),cap=num467(r.capacityBySlot?.[t],num467(r.capacity,0));if(u<=0)continue;if(cap<=0){conflicts++;peak=100;continue}const pct=100*u/cap;peak=Math.max(peak,pct);if(pct>=80)constrained++;if(pct>100+1e-7)conflicts++}});
 return {peakResourceUtilizationPct:Number(peak.toFixed(1)),peakResourceUtilizationLabel:`${Number(peak.toFixed(1))}%`,resourceBurdenScore:Number(burden.toFixed(3)),resourceBurdenScoreLabel:Number(burden.toFixed(2)).toFixed(2),constrainedResourceSlots:constrained,resourceConflicts:conflicts};
}
function baselineReason467(iv){
 const b=Number(iv.baselineStartSlot||0),allowed=(iv.allowedStartSlots||[]).map(Number);
 if(allowed.includes(b))return 'Objective improvement within governed feasible window';
 if(b<Number(iv.earliestStartSlot||0))return 'Forced move · baseline precedes material/readiness window';
 if(b>Number(iv.latestStartSlot??Infinity)||b+Number(iv.durationSlots||1)>Number(iv.requiredBySlot??Infinity))return 'Forced move · Required Completion / governed latest-start boundary';
 if(iv.sourceRecord?.outageRequired===true||String(iv.sourceRecord?.outageRequired||'').toLowerCase()==='yes')return 'Forced move · outage/access/resource window';
 return 'Forced move · governed access/resource availability';
}
function baselineSchedule467(model){return (model.interventions||[]).map(iv=>({interventionId:iv.id,startSlot:Number(iv.baselineStartSlot||0)}))}
function commonMetrics467(model,schedule){
 let latest=null,crew=0,cost=0,movement=0,due=0,forced=0;
 (schedule||[]).forEach(s=>{const iv=(model.interventions||[]).find(x=>x.id===s.interventionId);if(!iv)return;const st=slotDate463(model,s.startSlot),en=new Date(+st+num467(iv.durationHours,8)*3600000);if(!latest||en>latest)latest=en;crew+=num467(iv.durationHours,0);cost+=economicCost467(iv,s.startSlot);movement+=Math.abs(Number(s.startSlot)-Number(iv.baselineStartSlot))*Number(model.horizon.slotHours||8);if(Number(s.startSlot)+Number(iv.durationSlots)>Number(iv.requiredBySlot))due++;if(!(iv.allowedStartSlots||[]).map(Number).includes(Number(iv.baselineStartSlot)))forced++});
 const rm=resourceMetrics467(model,schedule);
 return {completion:latest,completionLabel:latest?RT467().fmtDateTime(latest):'—',dueBreaches:due,resourceConflicts:rm.resourceConflicts,peakResourceUtilizationPct:rm.peakResourceUtilizationPct,peakResourceUtilizationLabel:rm.peakResourceUtilizationLabel,resourceBurdenScore:rm.resourceBurdenScore,resourceBurdenScoreLabel:rm.resourceBurdenScoreLabel,constrainedResourceSlots:rm.constrainedResourceSlots,crewHours:Number(crew.toFixed(1)),overtimeHours:0,executionCost:Math.round(cost),executionCostLabel:cost?RT467().money(Math.round(cost)):'—',movementHours:Number(movement.toFixed(1)),movementLabel:movement?`${Number((movement/24).toFixed(1))} days`:'0 days',forcedBaselineMoves:forced};
}
function baseMetrics463(model){
 const m=commonMetrics467(model,baselineSchedule467(model));m.costDeltaLabel='Reference';m.hardViolations=m.forcedBaselineMoves+m.resourceConflicts+m.dueBreaches;return m;
}
function metrics463(model,alt,base){
 const m=commonMetrics467(model,alt.schedule||[]),violations=(alt.validation?.violations||[]).length;
 m.hardViolations=violations;m.forcedBaselineMoves=(model.interventions||[]).filter(iv=>!(iv.allowedStartSlots||[]).map(Number).includes(Number(iv.baselineStartSlot))).length;
 const delta=m.executionCost-num467(base?.executionCost,0);m.costDeltaINR=delta;m.costDeltaLabel=Math.abs(delta)<1?'No change':`${delta<0?'−':'+'}${RT467().money(Math.abs(delta))}`;return m;
}
function improvement463(strategy,m,b){
 if(strategy==='Earliest Completion'&&m.completion&&b.completion){const h=(b.completion-m.completion)/3600000;return h>0.01?`${Number((h/24).toFixed(1))} days earlier`:'No earlier feasible completion'}
 if(strategy==='Lowest Execution Cost'){const d=b.executionCost-m.executionCost;if(d>0)return `${RT467().money(d)} lower governed execution cost`;if(Math.abs(d)<1)return 'No governed cost saving available';return `Lowest feasible plan costs ${RT467().money(Math.abs(d))} more because baseline is not feasible`}
 if(strategy==='Resource Efficiency'){if(m.resourceBurdenScore+0.001<b.resourceBurdenScore)return `${Number((b.resourceBurdenScore-m.resourceBurdenScore).toFixed(2))} lower governed resource burden score`;if(m.peakResourceUtilizationPct+0.1<b.peakResourceUtilizationPct)return `${Number((b.peakResourceUtilizationPct-m.peakResourceUtilizationPct).toFixed(1))} pp lower peak resource utilization`;if(m.constrainedResourceSlots<b.constrainedResourceSlots)return `${b.constrainedResourceSlots-m.constrainedResourceSlots} fewer constrained resource slots`;return 'No resource-loading improvement available'}
 if(strategy==='Minimum Schedule Change'){if(m.movementHours===0)return 'Baseline timing retained';return `${Number((m.movementHours/24).toFixed(1))} minimum movement days · ${m.forcedBaselineMoves} baseline move${m.forcedBaselineMoves===1?'':'s'} forced by constraints`}
 const cost=b.executionCost-m.executionCost,load=b.peakResourceUtilizationPct-m.peakResourceUtilizationPct,days=(b.completion&&m.completion)?(b.completion-m.completion)/86400000:0;
 if(cost>0||load>0||days>0)return `Balanced gain · ${days>0?Number(days.toFixed(1))+' d earlier · ':''}${cost>0?RT467().money(cost)+' lower cost · ':''}${load>0?Number(load.toFixed(1))+' pp lower peak load':''}`.replace(/ · $/,'');
 return 'Baseline already near the governed balanced optimum';
}
function alt463(model,ea,strategy,index,base){
 const m=metrics463(model,ea,base);m.improvementLabel=improvement463(strategy,m,base);
 const chosen=(ea.schedule||[]).map(s=>{const iv=model.interventions.find(x=>x.id===s.interventionId);return {r:{Intervention_ID:s.interventionId,Duration_Hours:iv?.durationHours||8,schedule:{Planned_Start:RT467().fmtRuntimeDate(slotDate463(model,iv?.baselineStartSlot||0))}},st:RT467().fmtRuntimeDate(slotDate463(model,s.startSlot))}});
 const changes=(ea.schedule||[]).map(s=>{const iv=model.interventions.find(x=>x.id===s.interventionId);if(!iv||Number(s.startSlot)===Number(iv.baselineStartSlot))return null;const bd=slotDate463(model,iv.baselineStartSlot),pd=slotDate463(model,s.startSlot),delta=(pd-bd)/3600000,reason=baselineReason467(iv);return {id:s.interventionId,baseline:RT467().fmtDateTime(bd),recommended:RT467().fmtDateTime(pd),change:`${delta>0?'+':''}${Math.round(delta)} h`,reason:reason.startsWith('Forced')?reason:`${strategy} · ${reason}`,resourceChange:`Peak load ${m.peakResourceUtilizationLabel}`,st:RT467().fmtRuntimeDate(pd)}}).filter(Boolean);
 const baselineEquivalent=(ea.schedule||[]).every(s=>{const iv=model.interventions.find(x=>x.id===s.interventionId);return iv&&Number(s.startSlot)===Number(iv.baselineStartSlot)});
 return {id:`ALT-${String(index+1).padStart(2,'0')}`,name:baselineEquivalent?`Baseline already optimal — ${strategy}`:`Alternative ${index+1} — ${strategy}`,objective:strategy,chosen,changes,metrics:m,native:ea,baselineEquivalent};
}
function restoreOptStatus470(){
 const saved=UI467().optRunStatus;
 if(!saved||!saved.text)return;
 const root=document.getElementById('view-resourceplanning');
 if(!root)return;
 const anchor=root.querySelector('.po246-strategy-wrap');
 if(!anchor)return;
 let n=root.querySelector('.aip463-opt-status');
 if(!n){
   n=document.createElement('div');
   n.className='aip463-opt-status';
   anchor.insertAdjacentElement('afterend',n);
 }
 const cls='aip463-opt-status '+(saved.kind||'info');
 if(n.className!==cls)n.className=cls;
 if(n.textContent!==saved.text)n.textContent=saved.text;
}
function status463(text,kind='info'){
 UI467().optRunStatus={text:String(text||''),kind:kind||'info',updatedAt:new Date().toISOString()};
 setTimeout(restoreOptStatus470,0);
}
async function native463(selected){
 const src=source463(),first=selected[0]||'Balanced',firstModel=enrichModel467(window.AIPV459Adapter.build(src,opts463(first)),src),base=baseMetrics463(firstModel);
 const alternatives=[],suppressedStrategies=[],seen=new Set(),runs=[];
 if(!(firstModel.interventions||[]).length){
   const ts=new Date().toISOString();
   return {runId:'OPT-MILP-'+ts.replace(/\D/g,'').slice(0,17),status:'No Eligible Movable Interventions',solver:'AIP Native Optimizer',provider:'AIP Native MILP',interventions:firstModel.adapterDiagnostics?.scopeInterventions||0,candidates:firstModel.adapterDiagnostics?.scopeInterventions||0,rejected:firstModel.hardRejected?.length||0,feasibleCombinations:0,alternatives:[],best:null,baselineMetrics:base,runAt:ts,model:`AIP-MAINT-OPT · Engine ${window.AIPOptimizationEngine.VERSION} · Contract ${window.AIPOptimizationEngine.CONTRACT_VERSION} · Cost/Resource Model v467`,mode:RT467().dataMode(),selectedStrategies:selected,suppressedStrategies:[],objectiveName:selected.join(' · '),validationStatus:'No movable population in selected planning scope',adapterDiagnostics:firstModel.adapterDiagnostics,rollingWindow:firstModel.rollingWindow,hardRejected:firstModel.hardRejected||[]};
 }
 for(const strategy of selected){
   await new Promise(r=>setTimeout(r,0));
   const model=strategy===first?firstModel:enrichModel467(window.AIPV459Adapter.build(src,opts463(strategy)),src);
   if(!(model.interventions||[]).length)continue;
   const req=window.AIPV459Adapter.toEngineRequest(model,{alternatives:1,objectiveStrategy:MAP[strategy]||'balanced'});
   const t0=performance.now();
   const er=window.AIPOptimizationEngine.optimize(req);
   runs.push({strategy,response:er,elapsedMs:performance.now()-t0});
   if(er.status!=='optimal'||!(er.alternatives||[]).length)continue;
   const ea=er.alternatives[0],sig=(ea.schedule||[]).map(x=>`${x.interventionId}:${x.startSlot}`).sort().join('|');
   if(!sig||seen.has(sig)){suppressedStrategies.push(strategy);continue}
   seen.add(sig);alternatives.push(alt463(model,ea,strategy,alternatives.length,base));
 }
 const ts=new Date().toISOString(),runId=runs[0]?.response?.runId||('OPT-MILP-'+ts.replace(/\D/g,'').slice(0,17));
 return {runId,status:alternatives.length?'Alternatives Available':'Infeasible',solver:'AIP Native Optimizer',provider:'AIP Native MILP',interventions:firstModel.adapterDiagnostics?.scopeInterventions||0,candidates:firstModel.adapterDiagnostics?.scopeInterventions||0,rejected:firstModel.hardRejected?.length||0,feasibleCombinations:firstModel.interventions?.length||0,alternatives,best:alternatives[0]||null,baselineMetrics:base,runAt:ts,model:`AIP-MAINT-OPT · Engine ${window.AIPOptimizationEngine.VERSION} · Contract ${window.AIPOptimizationEngine.CONTRACT_VERSION} · Cost/Resource Model v467`,mode:RT467().dataMode(),selectedStrategies:selected,suppressedStrategies,objectiveName:selected.join(' · '),validationStatus:runs.every(x=>(x.response.alternatives||[]).every(a=>a.validation?.valid!==false))?'AIP Independently Validated':'Validation Attention',adapterDiagnostics:firstModel.adapterDiagnostics,rollingWindow:firstModel.rollingWindow,hardRejected:firstModel.hardRejected||[],solverTimings:runs.map(x=>({strategy:x.strategy,elapsedMs:Number(x.elapsedMs.toFixed(1))}))};
}

window.AIPRunOptimizerV467=function(event){
 const failEarly=(msg)=>{
   try{status463(msg,'error')}catch(_){}
   try{alert(msg)}catch(_){}
 };
 try{
   const ui=UI467();

   // A stale flag from any prior failed run must never silently swallow a click.
   const existingOverlay=document.getElementById('aipOptimizationRunningOverlay');
   if(window.AIP_OPT_RUNNING && !existingOverlay) window.AIP_OPT_RUNNING=false;
   if(window.AIP_OPT_RUNNING && existingOverlay){
     status463('Optimization is already running.','running');
     return;
   }

   if(ui.recommendationLocked){
     failEarly('This recommendation is under governance. Return it for re-optimization before running the optimizer again.');
     return;
   }

   const selected=(Array.isArray(ui.optStrategies)?ui.optStrategies:[]).filter(Boolean).slice(0,3);
   if(!selected.length){
     failEarly('Select at least one optimization strategy before running optimization.');
     return;
   }

   if(ui.solver==='External Optimization Solver'){
     failEarly('External Optimization Solver is not configured in this standalone demo. Select AIP Built-in Optimizer.');
     return;
   }

   const missing=[];
   if(!window.AIPPlanningRuntime)missing.push('planning runtime interface');
   if(!window.AIPV459Adapter)missing.push('optimization adapter');
   if(!window.AIPOptimizationEngine)missing.push('optimization engine');
   if(!window.LPEngine)missing.push('native solver');
   if(missing.length){
     failEarly('AIP Native Optimizer initialization failed: missing '+missing.join(', ')+'. No plan has been changed.');
     return;
   }

   const cleanup=()=>{
     window.AIP_OPT_RUNNING=false;
     document.body.classList.remove('aip-optimization-running');
     document.getElementById('aipOptimizationRunningOverlay')?.remove();
   };

   cleanup();
   window.AIP_OPT_RUNNING=true;
   document.body.classList.add('aip-optimization-running');

   const host=document.getElementById('view-resourceplanning');
   if(!host){
     cleanup();
     failEarly('Optimization screen container is unavailable. No plan has been changed.');
     return;
   }

   const ov=document.createElement('div');
   ov.id='aipOptimizationRunningOverlay';
   ov.className='aip-opt-running-overlay';
   ov.innerHTML=`<div class="aip-opt-running-card"><div class="aip-opt-spinner"></div><b>Optimization Engine is running</b><span>AIP Native MILP · ${selected.length} selected strateg${selected.length===1?'y':'ies'} · ${ui.horizon==='custom'?'Custom':ui.horizon+' day'} horizon</span></div>`;
   host.appendChild(ov);

   status463('Optimization request accepted · solving governed planning scope with AIP Native MILP.','running');

   setTimeout(async()=>{
     try{
       const result=await native463(selected);
       const current=UI467();
       current.optResult=result;
       current.selectedAlternative='baseline';
       current.planGovernance=current.planGovernance||{};
       current.planGovernance.selected='Baseline Plan';
       current.planGovernance.status='Draft';

       if(result.status==='No Eligible Movable Interventions'){
         status463('No eligible movable interventions in the selected planning scope. Completed and approved/fixed work is not re-optimized.','info');
       }else if(result.status==='Infeasible'){
         status463(`${result.interventions} governed intervention${result.interventions===1?'':'s'} assessed · ${result.rejected} constrained out · no feasible optimized alternative.`,'info');
       }else{
         status463(`Optimization completed successfully · ${result.alternatives.length} unique alternative${result.alternatives.length===1?'':'s'} generated${result.validationStatus==='AIP Independently Validated'?' · Feasibility verified':''}.`,'success');
       }
     }catch(err){
       console.error('AIP v467 optimization failed',err);
       UI467().optResult=null;
       const msg='Optimization failed: '+(err?.message||String(err));
       status463(msg,'error');
       try{alert(msg+'. The baseline plan has not been changed.')}catch(_){}
     }finally{
       cleanup();
       try{RT467().render()}catch(e){
         console.error('AIP v467 optimization render failed',e);
         try{status463('Optimization completed, but the screen could not refresh: '+(e?.message||String(e)),'error')}catch(_){}
       }
     }
   },80);

 }catch(err){
   window.AIP_OPT_RUNNING=false;
   try{document.body.classList.remove('aip-optimization-running')}catch(_){}
   try{document.getElementById('aipOptimizationRunningOverlay')?.remove()}catch(_){}
   console.error('AIP v467 Run Optimization entry failure',err);
   failEarly('Run Optimization could not start: '+(err?.message||String(err))+'. No plan has been changed.');
 }
}

document.addEventListener('click',function(ev){
 const b=ev.target?.closest?.('#view-resourceplanning .po247-run-action');if(!b)return;
 // Do not stop propagation: inline onclick will call the final global handler above.
 status463('Run Optimization selected.','running');
},true);

window.planRunOptimizer=window.AIPRunOptimizerV467;
window.AIP_V467_OPT_SELF_TEST=function(){
 const all=String(window.AIPRunOptimizerV467||'');
 const issues=[];
 if(!window.LPEngine)issues.push('Native solver missing');
 if(!window.AIPOptimizationEngine)issues.push('Optimization engine missing');
 if(!window.AIPV459Adapter)issues.push('v459 adapter missing');
 if(!all.includes('native463'))issues.push('Final Run Optimization authority is not v467');
 return {pass:issues.length===0,issues,release:'v467',engine:window.AIPOptimizationEngine?.VERSION,adapter:window.AIPV459Adapter?.VERSION,handler:'v467-final'};
};
window.AIP_V467_OPTIMIZATION_AUTHORITY={release:'v467',baseline:'v459',authority:'Final global planRunOptimizer definition at literal end of file',engine:'AIP Native MILP v6',oldHeuristicRetainedButInactive:true,costModel:'slot-sensitive governed labour premiums',resourceMetrics:'peak utilization + constrained slots',tieBreak:'minimum schedule movement on exact objective ties'};
})();
