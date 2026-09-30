
(function(){
'use strict';
const DAY=86400000;
const pad=n=>String(n).padStart(2,'0');
const fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtLocal=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parse=v=>{if(!v||typeof v!=='string')return null;const d=new Date(v.replace(' ','T'));return Number.isFinite(+d)?d:null};
const shiftVal=(v,days)=>{const d=parse(v);if(!d)return v;return fmt(new Date(+d+days*DAY))};
const dateKeys=new Set(['Planning_As_Of','Required_By','Planned_Start','Planned_Finish','Actual_Start','Actual_Completion','Start','End','Planned_End','AIP_Optimized_Start','AIP_Optimized_Finish','Approved_Start','Approved_Finish','Proposed_Start','Proposed_End','Calculation_As_Of','Resolution_Date','Baseline_Date','Target_Date','Effective_From','Effective_To','As_Of','Valid_From','Valid_To','Forecast_Time','Observed_At','Need_By','Earliest_Receipt','Effective_Date','Last_Validated','Certification_Expiry','Valid_To']);
function shiftDates(obj,days){
 const z={...obj};Object.keys(z).forEach(k=>{if(dateKeys.has(k)&&typeof z[k]==='string'&&parse(z[k]))z[k]=shiftVal(z[k],days)});return z;
}
function newInterventionId(old,cohort){const n=Number(String(old).replace(/\D/g,''))||0;return `INT-${pad3(n+23*cohort)}`}
function pad3(n){return String(n).padStart(3,'0')}
function newWorkOrderId(old,cohort){const n=Number(String(old||'').replace(/\D/g,''))||0;return `WO-${String(n+20000*cohort).padStart(5,'0')}`}
function clonePlanningPopulation(store){
 const base=(store.PLAN_Interventions||[]).filter(r=>/^INT-0\d\d$/.test(String(r.Intervention_ID))).slice(0,23);
 if(base.length!==23 || (store.PLAN_Interventions||[]).length>=69)return;
 const baseById=new Map(base.map(r=>[r.Intervention_ID,r]));
 const cohorts=[122,244];
 cohorts.forEach((offset,ci)=>{
   const cohort=ci+1;
   const idMap=new Map(),woMap=new Map();
   base.forEach(r=>{idMap.set(r.Intervention_ID,newInterventionId(r.Intervention_ID,cohort));woMap.set(r.Work_Order_ID,newWorkOrderId(r.Work_Order_ID,cohort))});
   const ints=base.map((r,idx)=>{
     let z=shiftDates(r,offset);z.Intervention_ID=idMap.get(r.Intervention_ID);z.Work_Order_ID=woMap.get(r.Work_Order_ID);z.Source_Record_ID=`REC-${cohort+1}-${pad3(idx+1)}`;
     z.Planning_Status=(idx%5===0?'Approved':idx%3===0?'AIP Optimized':'Resource Readiness');
     z.Actual_Start='';z.Actual_Duration_Hours='';z.Actual_Completion='';z.ERP_Execution_Status='Not Started';z.Actual_Source='';
     z.Calculation_Basis=String(z.Calculation_Basis||'').replace('Enterprise Value Exposure','Value Exposure');
     return z;
   });
   store.PLAN_Interventions.push(...ints);
   const cloneByIntervention=(name,mutate)=>{
     const arr=store[name];if(!Array.isArray(arr))return;const originals=arr.filter(x=>idMap.has(x.Intervention_ID));
     const clones=originals.map((x,idx)=>{let z=shiftDates(x,offset);z.Intervention_ID=idMap.get(x.Intervention_ID);if(z.Work_Order_ID&&woMap.has(z.Work_Order_ID))z.Work_Order_ID=woMap.get(z.Work_Order_ID);if(mutate)z=mutate(z,x,idx,cohort);return z});arr.push(...clones);
   };
   cloneByIntervention('PLAN_Requirements',(z,x,idx)=>({...z,Requirement_ID:`REQ-${cohort+1}-${String(idx+1).padStart(3,'0')}`}));
   cloneByIntervention('PLAN_Readiness',(z,x,idx)=>({...z,Overall_Readiness_Pct:Math.max(55,Math.min(100,Number(z.Overall_Readiness_Pct||85)-(idx%4)*3))}));
   cloneByIntervention('PLAN_Schedule',(z,x,idx)=>({...z,Schedule_ID:`SCH-${String(23*cohort+idx+1).padStart(3,'0')}`,Status:'Planned',AIP_Optimized_Start:'',AIP_Optimized_Duration_Hours:null,AIP_Optimized_Finish:'',Approved_Start:'',Approved_Finish:''}));
   cloneByIntervention('PLAN_Governance_Handoff',(z,x,idx)=>({...z,Governance_ID:`GOV-${String(23*cohort+idx+1).padStart(3,'0')}`,Approval_Status:idx%5===0?'Approved':'Pending',Handoff_Status:'Not handed off',ERP_EAM_Acknowledgement:'Pending'}));
   cloneByIntervention('PLAN_Field_Packs',(z,x,idx)=>({...z,Field_Pack_ID:`FP-${cohort+1}-${String(idx+1).padStart(3,'0')}`}));
   cloneByIntervention('PLAN_Scenarios',(z,x,idx)=>({...z,Scenario_ID:`SCN-${cohort+1}-${String(idx+1).padStart(3,'0')}`,Scenario_Status:'Draft'}));
   cloneByIntervention('VE_Intervention_Inputs',(z,x,idx)=>({...z,Input_ID:`V25-${cohort}-${String(idx+1).padStart(4,'0')}`}));
   cloneByIntervention('VE_Calculation_Detail',(z,x,idx)=>({...z,Evaluation_ID:`VE25-${cohort}-${String(idx+1).padStart(4,'0')}`}));
   cloneByIntervention('VE_Exposure_Summary');
   cloneByIntervention('PNO_Intervention_Cost_Basis');
   const wo=store['Work Orders'];if(Array.isArray(wo)){
     const originals=wo.filter(x=>woMap.has(x.Work_Order_ID));
     wo.push(...originals.map((x,idx)=>{let z=shiftDates(x,offset);z.Work_Order_ID=woMap.get(x.Work_Order_ID);z.Status='Open';z.Actual_Resolution_Hours='';return z}));
   }
 });
}
function extendDailySeries(store,name,idKey,startKey,endKey,targetDays){
 const arr=store[name];if(!Array.isArray(arr)||!arr.length)return;
 const groups=new Map();arr.forEach(r=>{const id=String(r[idKey]||'');if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r)});
 const add=[];
 groups.forEach((rows,id)=>{
   rows.sort((a,b)=>(parse(a[startKey])||0)-(parse(b[startKey])||0));
   if(!rows.length)return;const first=parse(rows[0][startKey]);if(!first)return;
   const existingDays=new Set(rows.map(r=>Math.round((parse(r[startKey])-first)/DAY)));
   const pattern=rows.slice(0,Math.min(rows.length,28));
   for(let di=0;di<targetDays;di++){
     if(existingDays.has(di))continue;const p=pattern[di%pattern.length];let z={...p};
     const ps=parse(p[startKey]),pe=parse(p[endKey]);const t=new Date(+first+di*DAY);t.setHours(ps.getHours(),ps.getMinutes(),0,0);z[startKey]=fmt(t);
     if(pe){const te=new Date(+first+di*DAY);te.setHours(pe.getHours(),pe.getMinutes(),0,0);z[endKey]=fmt(te)}
     if(z.Resource_Event_ID)z.Resource_Event_ID=`RCE-${id}-${String(di+1).padStart(3,'0')}`;
     if(z.Evidence_ID)z.Evidence_ID=`EVD-WX-${id}-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}`;
     add.push(z);
   }
 });arr.push(...add);
}
function rebaseStore(store,deltaDays,ref){
 const planningSheets=['PLAN_Interventions','PLAN_Requirements','PLAN_Calendar','PLAN_Schedule','PLAN_Field_Packs','PLAN_Governance_Handoff','PLAN_Execution_Feedback','PLAN_Scenarios','VE_Time_Rules','VE_Rate_Config','VE_Calculation_Detail','VE_Exposure_Summary','PLAN_RCM_Context','PLAN_Weather_Forecast','PLAN_Resource_Calendar','PLAN_Attention_Rules','PNO_Materials'];
 planningSheets.forEach(name=>{if(Array.isArray(store[name]))store[name]=store[name].map(r=>shiftDates(r,deltaDays))});
 const from=new Date(+ref-15*DAY),to=new Date(ref);to.setMonth(to.getMonth()+12);
 store.PLAN_Data_Window_Config=[{Config_ID:'PDW-001',Reference_Date:fmt(ref),Available_From:fmt(from),Available_To:fmt(to),Lookback_Days:15,Forward_Months:12,Rebase_Mode:'On application load / governed demo source',Custom_Range_Default_From:fmt(ref),Custom_Range_Default_To:fmt(new Date(+ref+30*DAY)),Governance_Status:'Approved'}];
}
function prepareStore(store){
 if(!store||!Array.isArray(store.PLAN_Interventions)||!store.PLAN_Interventions.length)return;
 // v234 authority: v225 prepares population breadth only. Runtime date rebasing is centralized in sheet()/planRollingRows
 // so embedded Excel, Synthetic and subsequently imported Excel follow exactly one rolling-date rule.
 clonePlanningPopulation(store);
 extendDailySeries(store,'PLAN_Resource_Calendar','Resource_ID','Start','End',366);
 extendDailySeries(store,'PLAN_Weather_Forecast','Plant_ID','Valid_From','Valid_To',366);
}
try{prepareStore(window.EMBEDDED_EXCEL_DATA)}catch(e){console.error('v225 embedded rolling data',e)}
try{prepareStore(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData)}catch(e){console.error('v225 synthetic rolling data',e)}
function uiWindow(){const d=window.AIP_DEMO_NOW?new Date(window.AIP_DEMO_NOW):new Date();d.setHours(8,0,0,0);const from=new Date(+d-15*DAY),to=new Date(d);to.setMonth(to.getMonth()+12);return {from,to,ref:d}}
function clampCustom(v){const d=parse(v);const w=uiWindow();if(!d||!w.from||!w.to)return v;const x=new Date(Math.max(+w.from,Math.min(+w.to,+d)));return fmtLocal(x)}
const U=window.PLAN_UI;if(U){const w=uiWindow();if(w.ref){U.customFrom=fmtLocal(w.ref);U.customTo=fmtLocal(new Date(+w.ref+30*DAY))}}
function wrapCustom(){if(typeof window.planSetCustom==='function'&&!window.planSetCustom.__v225){const old=window.planSetCustom;const f=(k,v)=>old(k,clampCustom(v));f.__v225=true;window.planSetCustom=f}}
function applyBounds(){const w=uiWindow();if(!w.from||!w.to)return;document.querySelectorAll('#poCustomFrom,#poCustomTo').forEach(el=>{el.min=fmtLocal(w.from);el.max=fmtLocal(w.to)});}
wrapCustom();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{wrapCustom();applyBounds();new MutationObserver(applyBounds).observe(document.body,{childList:true,subtree:true})});else{wrapCustom();applyBounds();new MutationObserver(applyBounds).observe(document.body,{childList:true,subtree:true})}
window.AIP_V225_ROLLING_DATA={version:'v225',role:'population expansion only under v234',lookbackDays:15,forwardMonths:12,interventionTarget:69,customRangeGoverned:true,doubleRebaseDisabled:true};
})();
