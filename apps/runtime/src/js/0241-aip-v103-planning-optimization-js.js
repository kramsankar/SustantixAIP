
(function(){
'use strict';
const PLAN103_DATA=__AIP_DS("351124fa2c08f71f");
function installData(){
  try{window.EMBEDDED_EXCEL_DATA=window.EMBEDDED_EXCEL_DATA||{};Object.assign(window.EMBEDDED_EXCEL_DATA,PLAN103_DATA)}catch(_){}
  try{
    window.AIP_INDEPENDENT_SYNTHETIC_DATA=window.AIP_INDEPENDENT_SYNTHETIC_DATA||{};
    window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData=window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData||{};
    Object.assign(window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData,JSON.parse(JSON.stringify(PLAN103_DATA)));
  }catch(_){}
}
installData();

const U=window.PLAN_UI=window.PLAN_UI||{tab:'overview',horizon:30,site:'All',selected:'',scenario:{},solver:'AIP Built-in Optimizer',optResult:null,search:'',customFrom:'',customTo:''};{const __n=new Date((window.AIP_DEMO_NOW?new Date(window.AIP_DEMO_NOW):new Date()));__n.setHours(8,0,0,0);const __z=n=>String(n).padStart(2,'0'),__fmt=d=>`${d.getFullYear()}-${__z(d.getMonth()+1)}-${__z(d.getDate())}T${__z(d.getHours())}:${__z(d.getMinutes())}`;if(!U.customFrom||/^2026-09-0[3-7]/.test(U.customFrom))U.customFrom=__fmt(__n);if(!U.customTo||/^2026-10-0[3-7]/.test(U.customTo))U.customTo=__fmt(new Date(+__n+30*86400000));}U.scheduleMode=U.scheduleMode||'schedule';U.scheduleScale=['daily','weekly','monthly','yearly'].includes(U.scheduleScale)?U.scheduleScale:'weekly';U.scheduleZoom=Number.isFinite(Number(U.scheduleZoom))?Number(U.scheduleZoom):1;U.scheduleCollapsed=U.scheduleCollapsed||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const money=v=>{const x=n(v);return x>=1e7?'₹'+(x/1e7).toFixed(2)+' Cr':x>=1e5?'₹'+(x/1e5).toFixed(2)+' L':'₹'+Math.round(x).toLocaleString('en-IN')};
const fmtDate=s=>{const d=new Date(String(s||'').replace(' ','T'));return Number.isFinite(+d)?d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}):'—'};
const mode=()=>{try{return typeof predictiveDataModeV752==='function'?predictiveDataModeV752():'Excel'}catch(_){return 'Excel'}};
const PLAN_ROLL_SOURCE_ANCHOR=new Date('2026-09-07T08:00:00');
function planRuntimeNow(){
 const x=window.AIP_DEMO_NOW;const d=x?new Date(x):new Date();
 if(!Number.isFinite(+d))return new Date(PLAN_ROLL_SOURCE_ANCHOR);
 return new Date(d.getFullYear(),d.getMonth(),d.getDate(),8,0,0,0);
}
function planParseDate(v){
 if(v===null||v===undefined||v==='')return null;const s=String(v).trim();if(!s||/^(not required|n\/a|—)$/i.test(s))return null;
 let m=s.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/);if(m)return new Date(+m[3],+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0),0,0);
 m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);if(m)return new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),0,0);
 const d=new Date(s.replace(' ','T'));return Number.isFinite(+d)?d:null;
}
function planFmtRuntimeDate(d){const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`}
function planRollDeltaDays(){const a=new Date(PLAN_ROLL_SOURCE_ANCHOR),n=planRuntimeNow();a.setHours(8,0,0,0);return Math.round((n-a)/86400000)}
function planRollDate(v){const d=planParseDate(v);if(!d)return v;d.setDate(d.getDate()+planRollDeltaDays());return planFmtRuntimeDate(d)}
function planRollMonth(v){const d=planParseDate(v);if(!d)return v;const n=planRuntimeNow(),a=PLAN_ROLL_SOURCE_ANCHOR,md=(n.getFullYear()-a.getFullYear())*12+n.getMonth()-a.getMonth();return planFmtRuntimeDate(new Date(d.getFullYear(),d.getMonth()+md,1,0,0,0,0))}
function planAddMonths(d,m){const x=new Date(d);const day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+m);x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate()));return x}
const PLAN_ROLL_FIELDS={
 'PLAN_Interventions':['Required_By','Planned_Start','Planned_Finish','Actual_Start','Actual_Completion'],
 'PLAN_Schedule':['Planned_Start','Planned_End','Planned_Finish','AIP_Optimized_Start','AIP_Optimized_Finish','Approved_Start','Approved_Finish','Actual_Start','Actual_Completion'],
 'PLAN_Calendar':['Start','End'],
 'PLAN_Resource_Calendar':['Start','End'],
 'PLAN_Weather_Forecast':['Forecast_Time','Valid_From','Valid_To'],
 'PLAN_Readiness':['Material_Earliest_Receipt'],
 'PLAN_Tool_Master':['Calibration_Expiry'],
 'PLAN_Vehicle_Master':['Last_Service_Date'],
 'PNO_Interventions':['Required_By','Planned_Start','Planned_Finish','Actual_Start','Actual_Completion'],
 'PNO_Fleet_Schedule':['Planned_Start','Planned_Finish','Required_By','Actual_Start','Actual_Completion','AIP_Optimized_Start','AIP_Optimized_Finish','Approved_Start','Approved_Finish'],
 'PNO_Technician_Skills':['Valid_To'],
 'PNO_Crew_Rates':['Rate_Effective_From']
};
function planRollingRows(name,rows){
 if(!Array.isArray(rows))return [];
 const now=planRuntimeNow();
 if(name==='PLAN_Data_Window_Config'||name==='PNO_Data_Window_Config')return rows.map((r,i)=>i?{...r}:{...r,Reference_Date:planFmtRuntimeDate(now),Available_From:planFmtRuntimeDate(new Date(+now-15*86400000)),Available_To:planFmtRuntimeDate(planAddMonths(now,12)),Lookback_Days:15,Forward_Months:12,Rebase_Mode:'Automatic runtime rebase on application/data-source initialization',Custom_Range_Default_From:planFmtRuntimeDate(now),Custom_Range_Default_To:planFmtRuntimeDate(new Date(+now+30*86400000)),Governance_Status:'Approved'});
 if(name==='PNO_Resource_Calendar')return rows.map(r=>({...r,Month:planRollMonth(r.Month)}));
 const fields=PLAN_ROLL_FIELDS[name];if(!fields&&name!=='PLAN_RCM_Context'&&name!=='PLAN_Operational_Feed')return rows;
 return rows.map(r=>{
   const x={...r};
   if(fields)fields.forEach(k=>{if(x[k]!==null&&x[k]!==undefined&&x[k]!=='')x[k]=planRollDate(x[k])});
   if(name==='PLAN_Interventions'||name==='PNO_Interventions')x.Planning_As_Of=planFmtRuntimeDate(now);
   if(name==='PLAN_RCM_Context')x.As_Of=planFmtRuntimeDate(now);
   if(name==='PLAN_Operational_Feed'){const age=Math.max(0,Number(x.Freshness_Seconds)||0);x.Observed_At=planFmtRuntimeDate(new Date(+now-age*1000))}
   return x;
 });
}
function sheet(name){
 const syn=mode()==='Synthetic';let raw=[];
 if(syn){const p=window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData||{};if(Array.isArray(p[name]))raw=p[name]}
 if(!raw.length){const imp=window.APM_IMPORTED_DATA||{};if(!syn&&Array.isArray(imp[name])&&imp[name].length)raw=imp[name]}
 if(!raw.length&&Array.isArray(window.EMBEDDED_EXCEL_DATA?.[name]))raw=window.EMBEDDED_EXCEL_DATA[name];
 return planRollingRows(name,raw);
}
function asof(){return planRuntimeNow()}
function rows(){
 const ints=sheet('PLAN_Interventions'),ready=new Map(sheet('PLAN_Readiness').map(r=>[r.Intervention_ID,r])),sch=new Map(sheet('PLAN_Schedule').map(r=>[r.Intervention_ID,r]));
 return ints.map(r=>({...r,readiness:ready.get(r.Intervention_ID)||{},schedule:sch.get(r.Intervention_ID)||{}}));
}
function scopeRows(forcePortfolio=false){
 const all=rows();
 if(U.horizon==='custom'){
  const from=new Date(U.customFrom||planRuntimeNow()),to=new Date(U.customTo||new Date(+planRuntimeNow()+30*86400000));
  return all.filter(r=>{const due=new Date(String(r.Required_By).replace(' ','T'));return (forcePortfolio||U.site==='All'||r.Plant_ID===U.site)&&due>=from&&due<=to});
 }
 const cut=requiredCompletionDate();
 return all.filter(r=>(forcePortfolio||U.site==='All'||r.Plant_ID===U.site)&&new Date(String(r.Required_By).replace(' ','T'))<=cut);
}
function sourceTag(){return `${mode()} · ${sheet('PLAN_Interventions').length} governed intervention records`}
function kpis(forcePortfolio=false){
 const rr=scopeRows(forcePortfolio),den=rr.length||1,ready=rr.filter(r=>n(r.readiness.Overall_Readiness_Pct)>=100),constraints=rr.filter(r=>r.readiness.Overall_Status!=='Ready');
 const risk=rr.filter(r=>new Date(String((U.scenario[r.Intervention_ID]?.start)||r.schedule.Planned_Start||r.Planned_Start).replace(' ','T'))>new Date(String(r.Required_By).replace(' ','T'))||n(r.readiness.Overall_Readiness_Pct)<83);
 const cal=sheet('PLAN_Calendar').filter(x=>/window/i.test(String(x.Event_Type)));
 const eligible=rr.filter(r=>cal.some(c=>c.Reference_ID===r.Plant_ID));
 const aligned=eligible.filter(r=>cal.some(c=>c.Reference_ID===r.Plant_ID&&String(c.Start).slice(0,10)===String((U.scenario[r.Intervention_ID]?.start)||r.schedule.Planned_Start||r.Planned_Start).slice(0,10)));
 const fb=sheet('PLAN_Execution_Feedback'),conf=fb.filter(x=>x.Conformance_Status==='Within Tolerance').length;
 return {
  readiness:100*ready.length/den,
  value:ready.reduce((s,r)=>s+n(r.Value_Exposure_INR),0),
  constraints:constraints.length,
  risk:100*risk.length/den,
  alignment:eligible.length?100*aligned.length/eligible.length:null,
  conformance:fb.length?100*conf/fb.length:null
 };
}
function kp(label,value,meta,index){return `<div class="aip-kpi-master po-kpi" data-aip-kpi-index="${index%8}"><span class="aip-kpi-display-label">${esc(label)}</span><span class="aip-kpi-display-value"><span class="aip-kpi-number">${value}</span></span><span class="po-kpi-meta">${esc(meta||'')}</span><span class="aip-kpi-master-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div>`}
function tabs(){
 const T=[['overview','Overview'],['resources','Plan & Resources'],['schedule','Intervention Schedule'],['optimize','Optimize & Govern']];
 return `<div class="po-tabs">${T.map(([k,l])=>`<button class="${U.tab===k?'active':''}" onclick="planSetTab('${k}')">${l}</button>`).join('')}<div class="po-v124-tab-actions">
<button class="po-btn po-v123-mini-btn" onclick="planOpenDrawer('operating')"><span class="po-v123-mini-text">Operating Model & Systems</span><span class="po-v123-mini-icon" aria-hidden="true">↗</span></button>
<button class="po-btn po-v123-mini-btn" onclick="planOpenTech()"><span class="po-v123-mini-text">Interfaces</span><span class="po-v123-mini-icon" aria-hidden="true">↗</span></button>
</div></div>`;
}
function head(){
 return `<div class="po-head"><div><div class="eyebrow">Maintenance Intelligence · governed planning workspace</div><h1>Planning &amp; Optimization</h1></div></div>${tabs()}`;
}
function requiredCompletionDate(){
 if(U.horizon==='custom')return new Date(U.customTo||'2026-10-03T18:00');
 const days=Number(U.horizon)||30;
 return new Date(+asof()+(days===1?0:days)*86400000);
}
function requiredCompletionLabel(){
 const d=requiredCompletionDate();
 return Number.isFinite(+d)?d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
}
function planMeridiem(v){const d=new Date(v||'');return Number.isFinite(+d)&&d.getHours()>=12?'PM':'AM'}
function toolbar(extra='',showSite=true){
 const sites=sheet('Sites');const presets=[['1','Today'],['7','This Week'],['14','2 Weeks'],['30','30 Days'],['60','60 Days'],['90','90 Days'],['180','6 Months'],['365','12 Months']];
 const cf=U.customFrom||planFmtRuntimeDate(planRuntimeNow()).replace(' ','T'),ct=U.customTo||planFmtRuntimeDate(new Date(+planRuntimeNow()+30*86400000)).replace(' ','T');
 const custom=U.horizon==='custom'?`<span class="po-range-label">From</span><span class="po-datetime-wrap"><input id="poCustomFrom" class="po-input po-date-input from" type="datetime-local" value="${cf}" onchange="planSetCustom('from',this.value)"><select class="po-meridiem" aria-label="From AM PM" onchange="planSetMeridiem('from',this.value)"><option ${planMeridiem(cf)==='AM'?'selected':''}>AM</option><option ${planMeridiem(cf)==='PM'?'selected':''}>PM</option></select><button class="po-calendar-close" title="Close calendar" aria-label="Close From calendar" onclick="planCloseCalendar('poCustomFrom')">×</button></span><span class="po-range-arrow">→</span><span class="po-range-label">To</span><span class="po-datetime-wrap"><input id="poCustomTo" class="po-input po-date-input to" type="datetime-local" value="${ct}" onchange="planSetCustom('to',this.value)"><select class="po-meridiem" aria-label="To AM PM" onchange="planSetMeridiem('to',this.value)"><option ${planMeridiem(ct)==='AM'?'selected':''}>AM</option><option ${planMeridiem(ct)==='PM'?'selected':''}>PM</option></select><button class="po-calendar-close" title="Close calendar" aria-label="Close To calendar" onclick="planCloseCalendar('poCustomTo')">×</button></span>`:'';
 return `<div class="po-toolbar po-toolbar-color"><label class="po-filter-label horizon">Planning Horizon</label><select class="po-select po-filter-select horizon" onchange="planSetHorizon(this.value)">${presets.map(x=>`<option value="${x[0]}" ${U.horizon==x[0]?'selected':''}>${x[1]}</option>`).join('')}<option value="custom" ${U.horizon==='custom'?'selected':''}>Custom range</option></select><span class="po-horizon-end-label">Horizon End Date</span><span class="po-horizon-end-value">${esc(requiredCompletionLabel())}</span>${custom}${showSite?`<label class="po-filter-label site">Planning scope</label><select class="po-select po-filter-select site" onchange="planSetSite(this.value)"><option value="All" ${U.site==='All'?'selected':''}>Portfolio · All sites</option>${sites.map(s=>`<option value="${esc(s.Plant_ID)}" ${U.site===s.Plant_ID?'selected':''}>${esc(s.Plant_ID)} · ${esc(s.Plant_Name)}</option>`).join('')}</select>`:'<span class="po-scope-all-sites">All Sites</span>'}${extra}</div>`;
}
function horizonScopeLabel(){
 if(U.horizon==='custom')return `Planning Horizon · ${fmtDate(U.customFrom)}–${fmtDate(U.customTo)} · All Sites`;
 return `Planning Horizon · ${requiredCompletionLabel()} · All Sites`;
}
function planGateState(rr){
 const hasReadiness=r=>r.readiness&&Object.keys(r.readiness).length>0;
 const hasSchedule=r=>r.schedule&&Object.keys(r.schedule).length>0&&(r.schedule.Planned_Start||r.Planned_Start);
 const prepared=r=>hasReadiness(r)&&hasSchedule(r)&&!/Resource Readiness/i.test(String(r.Planning_Status||''));
 const optimized=r=>prepared(r)&&/Optimized|Approved/i.test(String(r.Planning_Status||''));
 const approved=r=>optimized(r)&&String(r.Planning_Status||'')==='Approved';
 const ready=r=>approved(r)&&n(r.readiness.Overall_Readiness_Pct)>=100&&String(r.readiness.Overall_Status)==='Ready';
 const stages=[
  {key:'due',label:'DUE',rows:rr.slice(),cls:'due'},
  {key:'prepared',label:'PLAN PREPARED',rows:rr.filter(prepared),cls:'prepared'},
  {key:'optimized',label:'SCHEDULE OPTIMIZED',rows:rr.filter(optimized),cls:'optimized'},
  {key:'approved',label:'PLAN APPROVED',rows:rr.filter(approved),cls:'approved'},
  {key:'ready',label:'EXECUTION READY',rows:rr.filter(ready),cls:'ready'}
 ];
 const reason=(r,type)=>{
  const p=String(r.readiness?.Primary_Constraint||'').trim();
  if(type==='gap')return p&&p!=='None'?p:(/Resource Readiness/i.test(String(r.Planning_Status||''))?'Planning/resource checks incomplete':'Planning inputs incomplete');
  if(type==='schedule')return p&&p!=='None'?p:'Not selected in current optimized schedule';
  if(type==='approval')return 'Governance approval pending';
  return p&&p!=='None'?p:'Final execution prerequisite not cleared';
 };
 const exceptions=[
  {key:'gap',label:'Planning Gaps',rows:stages[0].rows.filter(r=>!prepared(r))},
  {key:'schedule',label:'Scheduling Constraints',rows:stages[1].rows.filter(r=>!optimized(r))},
  {key:'approval',label:'Awaiting Approval',rows:stages[2].rows.filter(r=>!approved(r))},
  {key:'execution',label:'Execution Blockers',rows:stages[3].rows.filter(r=>!ready(r))}
 ];
 exceptions.forEach(x=>x.rows=x.rows.map(r=>({...r,__planReason:reason(r,x.key)})));
 return {stages,exceptions};
}
function planAttentionRules(){return sheet('PLAN_Attention_Rules').filter(r=>String(r.Governance_Status||'Approved')==='Approved')}
function planQuantile(vals,p){const a=vals.map(n).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const pos=(a.length-1)*(p/100),lo=Math.floor(pos),hi=Math.ceil(pos);return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(pos-lo)}
function planAttentionModel(rr){
 const cfg=planAttentionRules(),cond=cfg.filter(x=>String(x.Rule_Type)!=='SEVERITY_BAND'),bands=cfg.filter(x=>String(x.Rule_Type)==='SEVERITY_BAND');
 const valueRule=cond.find(x=>String(x.Rule_Type)==='VALUE_EXPOSURE_PERCENTILE'),valueCut=planQuantile(rr.map(x=>n(x.Value_Exposure_INR)),n(valueRule?.Threshold_Value||75));
 const base=asof(),day=86400000,dims=['Crew','Material','Tool','Vehicle','Access','Outage'];
 const bandThreshold=t=>n(bands.find(x=>String(x.Rule_Name).toLowerCase().startsWith(t.toLowerCase()))?.Threshold_Value||({Critical:6,High:3,Watch:1}[t]));
 const evaluated=rr.map(r=>{
  const breaches=[],ready=n(r.readiness?.Overall_Readiness_Pct),due=new Date(String(r.Required_By).replace(' ','T')),start=new Date(String((U.scenario[r.Intervention_ID]?.start)||r.schedule?.Planned_Start||r.Planned_Start).replace(' ','T')),finish=new Date(+start+n(r.Duration_Hours)*3600000),dueDays=(due-base)/day;
  const unresolved=dims.filter(k=>String(r.readiness?.[k+'_Status']||'Review')!=='Ready'&&!/not required/i.test(String(r.readiness?.[k+'_Status']||'')));
  cond.forEach(rule=>{const type=String(rule.Rule_Type),thr=n(rule.Threshold_Value);let hit=false,actual='',threshold='';
   if(type==='READINESS_LT'){hit=ready<thr;actual=ready.toFixed(0)+'%';threshold='≥ '+thr+'%'}
   else if(type==='DEPENDENCY_NOT_READY'){hit=unresolved.length>=thr;actual=unresolved.length?unresolved.map(x=>x==='Outage'?'Outage Window':x).join(', '):'None';threshold='0 unresolved'}
   else if(type==='FORECAST_FINISH_AFTER_REQUIRED_BY'){hit=finish>due;actual=fmtDate(finish);threshold='≤ '+fmtDate(due)}
   else if(type==='GOVERNANCE_DUE_WINDOW'){hit=String(r.Planning_Status)!=='Approved'&&dueDays<=thr;actual=String(r.Planning_Status)+' · '+dueDays.toFixed(1)+'d to due';threshold='Approved before '+thr+'d window'}
   else if(type==='VALUE_EXPOSURE_PERCENTILE'){hit=n(r.Value_Exposure_INR)>=valueCut;actual=money(r.Value_Exposure_INR);threshold='≥ P'+thr+' · '+money(valueCut)}
   else if(type==='NEAR_DUE_NOT_READY'){hit=dueDays<=thr&&ready<100;actual=dueDays.toFixed(1)+'d · '+ready.toFixed(0)+'% ready';threshold='> '+thr+'d or 100% ready'}
   if(hit)breaches.push({id:rule.Rule_ID,name:rule.Rule_Name,type,actual,threshold,weight:n(rule.Severity_Weight),basis:rule.Evaluation_Basis});
  });
  const weight=breaches.reduce((a,b)=>a+n(b.weight),0),completionThreat=breaches.some(b=>b.type==='FORECAST_FINISH_AFTER_REQUIRED_BY');
  const severity=completionThreat||weight>=bandThreshold('Critical')?'Critical':weight>=bandThreshold('High')?'High':'Watch';
  return {...r,__attention:breaches,__attentionWeight:weight,__attentionSeverity:severity,__forecastFinish:finish,__dueDays:dueDays};
 });
 const attention=evaluated.filter(r=>r.__attention.length).sort((a,b)=>({Critical:3,High:2,Watch:1}[b.__attentionSeverity]-{Critical:3,High:2,Watch:1}[a.__attentionSeverity])||n(b.Value_Exposure_INR)-n(a.Value_Exposure_INR)||new Date(a.Required_By)-new Date(b.Required_By));
 const ruleCounts=cond.map(rule=>({rule,count:evaluated.filter(r=>r.__attention.some(b=>b.id===rule.Rule_ID)).length}));
 return {eligible:evaluated,attention,ruleCounts,totalBreaches:attention.reduce((a,r)=>a+r.__attention.length,0),valueCut,bands,cond};
}
function planAttentionSummaryHtml(M){return `<div class="po-attention-summary"><div><span>Interventions in Horizon</span><b>${M.eligible.length}</b></div><i>·</i><div class="attention"><span>Require Attention</span><b>${M.attention.length}</b></div><i>·</i><div><span>Within Governed Limits</span><b>${M.eligible.length-M.attention.length}</b></div><button class="po-attention-action" onclick="planOpenAttentionRules()"><span>View Attention Rules</span><i aria-hidden="true">↗</i></button><button class="po-attention-action" onclick="planOpenAllDueInterventions()"><span>View All Interventions</span><i aria-hidden="true">↗</i></button></div>`}

function overview(){
 const rr=scopeRows(true),K=kpis(true),G=planGateState(rr);
 if(U.selected&&!rr.some(x=>x.Intervention_ID===U.selected))U.selected='';
 const types=['Crew','Material','Tool','Vehicle','Access','Outage'];
 const counts=types.map(t=>[t,rr.filter(x=>String(x.readiness?.[t+'_Status']||'')!=='Ready').length]);
 const max=Math.max(1,...counts.map(x=>x[1]));
 const AM=planAttentionModel(rr),att=AM.attention;
 const constrained=rr.filter(r=>String(r.readiness?.Overall_Status||'')!=='Ready'||types.some(t=>String(r.readiness?.[t+'_Status']||'')!=='Ready'))
   .sort((a,b)=>n(b.Value_Exposure_INR)-n(a.Value_Exposure_INR));
 const explicit=U.selected&&rr.find(x=>x.Intervention_ID===U.selected);
 const dep=explicit||constrained[0]||att[0]||rr[0];
 const top=constrained.slice(0,5);
 const why=explicit?'Explicitly selected by you':constrained.length?'Highest Value Exposure among interventions with unresolved readiness dependencies':'No constrained intervention; highest Value Exposure in scope shown for context';
 const modeLabel=explicit?'Selected Intervention':'Priority Intervention';
 const flow=G.stages.map((s,i)=>`${i?`<div class="po-status-transition"><button class="po-exception ${G.exceptions[i-1].rows.length?'':'zero'}" onclick="planOpenException('${G.exceptions[i-1].key}')"><b>${G.exceptions[i-1].rows.length}</b><span>${esc(G.exceptions[i-1].label)}</span></button></div>`:''}<button class="po-status-stage ${s.cls}" onclick="planOpenStage('${s.key}')"><b>${s.rows.length}</b><span>${esc(s.label)}</span></button>`).join('');
 return `${head()}${toolbar('',false)}<div class="po-kpis">${kp('Plan Readiness',K.readiness.toFixed(1)+'%','100% ready ÷ interventions in scope',0)}${kp('Execution-Ready Value',money(K.value),'value exposure of 100% ready interventions',1)}${kp('Planning Constraints',K.constraints,'interventions with readiness status ≠ Ready',2)}${kp('Schedule Risk',K.risk.toFixed(1)+'%','late start or readiness below 83%',3)}${kp('Opportunity Alignment',K.alignment==null?'N/A':K.alignment.toFixed(1)+'%','planned starts aligned to site opportunity windows',4)}${kp('Plan-to-Execution Conformance',K.conformance==null?'N/A':K.conformance.toFixed(1)+'%','within-tolerance execution feedback ÷ feedback records',5)}</div>
 <div class="po-grid">
  <section class="po-card s8 po-status-card"><div class="po-status-head"><h3>Intervention Plan Status</h3><span class="po-drill-cue" title="Select any status or transition below to open its detail"><i>↗</i> Select a status below for more details</span></div><div class="po-status-flow">${flow}</div></section>
  <section class="po-card s4"><div class="po-title"><h3>Constraints by Type</h3><span>unresolved intervention constraints</span></div><div class="po-bars">${counts.map(([t,c])=>`<div class="po-bar po-bar-action" role="button" tabindex="0" onclick="planOpenConstraintType('${t}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();planOpenConstraintType('${t}')}" title="Open ${t==='Outage'?'Outage Window':t} constraints"><span>${t==='Outage'?'Outage Window':t}</span><div class="po-bar-track"><div class="po-bar-fill" style="width:${100*c/max}%"></div></div><b>${c}</b></div>`).join('')}</div></section>
  <section class="po-card s12 po-v120-priority"><div class="po-title"><h3>${modeLabel} — Dependency & Readiness</h3>${explicit?'<span><button class="po-v120-clear" onclick="planClearPrioritySelection()">× Clear selection</button></span>':''}</div>${dependencyMap(dep,{mode:modeLabel,why,top})}</section>
  <section class="po-card s12 po-attention-register"><div class="po-title"><h3>Planning Attention Register</h3></div>${planAttentionSummaryHtml(AM)}<div class="po-table-wrap"><table class="po-table"><thead><tr><th>Intervention</th><th>Site / Asset</th><th>Required Completion By</th><th>Readiness</th><th>Attention severity</th><th>Why attention</th><th>Value exposure</th><th>Status</th></tr></thead><tbody>${att.length?att.map(r=>`<tr onclick="planSelect('${r.Intervention_ID}','resources')"><td><b>${esc(r.Intervention_ID)}</b><br>${esc(r.Intervention)}</td><td>${esc(r.Plant_ID)}<br>${esc(r.Asset_Tag)}</td><td>${fmtDate(r.Required_By)}</td><td><span class="po-pill ${r.readiness.Overall_Status==='Ready'?'ready':'constraint'}">${n(r.readiness.Overall_Readiness_Pct).toFixed(0)}%</span></td><td><span class="po-attention-band ${r.__attentionSeverity.toLowerCase()}">${r.__attentionSeverity}</span></td><td><button class="po-attention-why" onclick="event.stopPropagation();planOpenAttentionWhy('${r.Intervention_ID}')">${r.__attention.length} rule${r.__attention.length===1?'':'s'} breached ↗</button><small>${esc(r.__attention.slice(0,2).map(x=>x.name).join(' · '))}${r.__attention.length>2?' · +'+(r.__attention.length-2)+' more':''}</small></td><td><button class="po-ve-link" title="Open governed Value Exposure calculation" onclick="event.stopPropagation();planOpenValueExposure('${r.Intervention_ID}',event)">${money(r.Value_Exposure_INR)} <i>↗</i></button></td><td><span class="po-pill blue">${esc(r.Planning_Status)}</span></td></tr>`).join(''):`<tr><td colspan="8"><div class="po-good">No interventions breach the governed attention rules in the selected planning horizon.</div></td></tr>`}</tbody></table></div></section>
 </div>`;
}

function planFmtDateTime(v){
 const s=String(v||'').trim();
 const m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?/);
 if(!m)return s||'—';
 return `${m[3]}-${m[2]}-${m[1]}${m[4]?' '+m[4]:''}`;
}
function planReadinessState(v){
 const s=String(v||'Review').trim();
 if(/ready\s*with\s*constraint|non[- ]?blocking|advisory/i.test(s))return 'amber';
 if(/constraint|constrained|blocked|blocking|hold|expired|unavailable|missing|risk/i.test(s))return 'red';
 if(/ready|available|approved|open|not required|satisfied|confirmed/i.test(s))return 'green';
 return 'review';
}
function planReadinessLabel(v){
 const s=String(v||'Review').trim();
 if(planReadinessState(s)==='amber')return /ready\s*with\s*constraint/i.test(s)?'Ready with Constraint':s;
 if(/^constraint$/i.test(s)||/^constrained$/i.test(s))return 'Blocked';
 return s;
}
function planExecutionGate(r){
 const st=(r&&r.readiness)||{}, dims=['Crew','Material','Tool','Vehicle','Access','Outage'];
 const evaluated=dims.map(k=>({key:k,state:planReadinessState(st[k+'_Status']),raw:String(st[k+'_Status']||'Review')}));
 const blocking=evaluated.filter(x=>x.state==='red');
 const amber=evaluated.filter(x=>x.state==='amber');
 const passed=evaluated.filter(x=>x.state==='green'||x.state==='amber');
 const pct=100*passed.length/dims.length;
 const state=blocking.length?'blocked':amber.length?'conditional':'ready';
 return {state,blocking,amber,passed,pct,sourcePct:n(st.Overall_Readiness_Pct),primary:st.Primary_Constraint||'None'};
}
function planGateClass(state){return state==='ready'?'ready':state==='conditional'?'conditional':'blocked'}
function planGateText(g){return g.state==='ready'?'Ready':g.state==='conditional'?'Ready with Constraint':'Blocked'}


function planStatusSpan(value){
 const state=planReadinessState(value), cls=state==='green'?'ready':state==='amber'?'conditional':state==='red'?'blocked':'review';
 return `<span class="po-component-status ${cls}"><b>${esc(planReadinessLabel(value))}</b></span>`;
}
function planCombinedStatus(parts){
 return `<span class="po-component-status-row">${parts.map(x=>planStatusSpan(x[1])).join('<em>/</em>')}</span>`;
}
function planSingleStatus(value){return planStatusSpan(value);}

function dependencyMap(r,meta={}){
 if(!r)return `<div class="po-alert">No intervention is due in the selected planning horizon.</div>`;
 const st=r.readiness||{},sch=r.schedule||{},gov=sheet('PLAN_Governance_Handoff').find(x=>x.Intervention_ID===r.Intervention_ID)||{};
 const planned=sch.Planned_Start||r.Planned_Start||'—';
 const primary=st.Primary_Constraint&&st.Primary_Constraint!=='None'?st.Primary_Constraint:'No unresolved constraint';
 const statusOf=k=>String(st[k+'_Status']||'Review');
 const readyPct=n(st.Overall_Readiness_Pct);
 const cls=v=>{const s=planReadinessState(v);return s==='green'?'ready':s==='amber'?'constraint':s==='red'?'risk':'constraint'};
 const displayStatus=v=>planReadinessLabel(v);
 const toolVeh=planCombinedStatus([['Tool',statusOf('Tool')],['Vehicle',statusOf('Vehicle')]]);
 const accessOut=planCombinedStatus([['Access',statusOf('Access')],['Outage',statusOf('Outage')]]);
 const nodes=[
  ['Work Order',`<span class="po-neutral-value">${esc(r.Work_Order_ID||'—')}</span>`,'Exact execution record',`planOpenSource('${r.Intervention_ID}','wo')`,'neutral'],
  ['Crew',planSingleStatus(statusOf('Crew')),'Crew & skills',`planOpenDependency('${r.Intervention_ID}','crew')`,'neutral'],
  ['Material',planSingleStatus(statusOf('Material')),'Materials & spares',`planOpenDependency('${r.Intervention_ID}','material')`,'neutral'],
  ['Tool / Vehicle',toolVeh,'Tools / vehicle',`planOpenDependency('${r.Intervention_ID}','toolvehicle')`,'neutral'],
  ['Access / Outage',accessOut,'Execution prerequisites',`planOpenDependency('${r.Intervention_ID}','accessoutage')`,'neutral'],
  ['Schedule',`<span class="po-neutral-value">${esc(fmtDate(planned))}</span>`,'Intervention Schedule',`planOpenDependency('${r.Intervention_ID}','schedule')`,'neutral'],
  ['Governance',planSingleStatus(gov.Handoff_Status||r.Planning_Status||'Review'),'Optimize & Govern',`planOpenDependency('${r.Intervention_ID}','governance')`,'neutral']
 ];
 const blockers=[['Crew',statusOf('Crew')],['Material',statusOf('Material')],['Tool',statusOf('Tool')],['Vehicle',statusOf('Vehicle')],['Access',statusOf('Access')],['Outage',statusOf('Outage')]].filter(x=>planReadinessState(x[1])==='red').map(x=>x[0]);
 const top=meta.top||[],topMax=Math.max(1,...top.map(x=>n(x.Value_Exposure_INR)));
 return `<div class="po-v120-layout"><div class="po-v120-main">
  <div class="po-v120-banner"><div><span>${esc(meta.mode||'Priority Intervention')}</span><b>${esc(r.Intervention_ID)} · ${esc(r.Asset_Tag)}</b><small>${esc(r.Intervention)}</small></div><div class="po-v120-metrics"><strong><button class="po-ve-inline" onclick="planOpenValueExposure(\'${r.Intervention_ID}\',event)" title="Open governed Value Exposure calculation">${money(r.Value_Exposure_INR)} ↗</button></strong><small>Value Exposure</small><strong>${fmtDate(r.Required_By)}</strong><small>Required Completion By</small></div></div>
  <div class="po-v120-why"><b>Why this intervention?</b> ${esc(meta.why||'Current planning context')}</div>
  <div class="po-v120-deps">${nodes.map(x=>`<button class="po-dep-node ${x[4]}" onclick="${x[3]}"><b>${esc(x[0])}</b><span class="po-dep-status-value">${x[1]}</span><small>${esc(x[2])} ↗</small></button>`).join('')}</div>
 </div><aside class="po-v120-value"><h4>Highest-value constrained interventions</h4>${top.length?`<div class="po-v120-bars">${top.map(x=>`<button class="${x.Intervention_ID===r.Intervention_ID?'active':''}" onclick="planPreviewPriority('${x.Intervention_ID}')"><span><b>${esc(x.Intervention_ID)}</b><em>${n(x.readiness?.Overall_Readiness_Pct).toFixed(0)}% ready <small class="po-v128-ready-fraction">· ${['Crew','Material','Tool','Vehicle','Access','Outage'].filter(k=>String(x.readiness?.[k+'_Status']||'')==='Ready').length}/6</small></em></span><i><u style="width:${100*n(x.Value_Exposure_INR)/topMax}%"></u></i><strong>${money(x.Value_Exposure_INR)}</strong></button>`).join('')}</div>`:'<div class="po-good">No constrained interventions in the current scope.</div>'}</aside></div>`;
}
function selectedRow(){
 const rr=rows();if(!U.selected||!rr.some(x=>x.Intervention_ID===U.selected))U.selected=rr[0]?.Intervention_ID||'';
 return rr.find(x=>x.Intervention_ID===U.selected)||rr[0];
}
function resources(){
 const r=selectedRow();if(!r)return head()+toolbar()+'<div class="po-alert">No intervention data available.</div>';
 const ints=rows();
 const req=sheet('PLAN_Requirements').filter(x=>x.Intervention_ID===r.Intervention_ID);
 const techLegacy=sheet('Crew & Skills').find(x=>x.Technician_ID===r.schedule.Technician_ID)||{};
 const techRate=sheet('PNO_Technician_Skills').find(x=>x.Technician_ID===r.schedule.Technician_ID)||{};
 const tech={...techRate,...techLegacy,Certification:techLegacy.Certification||techRate.Certification_or_Control,Certification_Expiry:techLegacy.Certification_Expiry||techRate.Valid_To,Availability:techLegacy.Availability||techRate.Availability_Status};
 const partLegacy=sheet('Spare Parts Master').find(x=>x.Part_ID===r.Required_Part_ID)||{};
 const partLog=sheet('PNO_Material_Cost_Logistics').find(x=>x.Material_ID===r.Required_Part_ID)||{};
 const part={...partLog,...partLegacy,Part_Name:partLegacy.Part_Name||partLog.Material_Description,Lead_Time_Days:partLegacy.Lead_Time_Days||partLog.Lead_Time_Days};
 const tool=sheet('PLAN_Tool_Master').find(x=>x.Tool_ID===r.Required_Tool_ID)||{};
 const veh=sheet('PLAN_Vehicle_Master').find(x=>x.Vehicle_ID===r.schedule.Vehicle_ID)||sheet('PLAN_Vehicle_Master').find(x=>x.Home_Plant_ID===r.Plant_ID&&String(x.Vehicle_Type||'')===String(r.Vehicle_Class||''))||sheet('PLAN_Vehicle_Master').find(x=>String(x.Vehicle_Type||'')===String(r.Vehicle_Class||''))||{};
 const st=r.readiness;
 const g=planExecutionGate(r);
 const c=constraintCheck(r,r.schedule.Planned_Start||r.Planned_Start);
 const dims=['Crew','Material','Tool','Vehicle','Access','Outage'];
 const readiness=`<section class="po-card po-resource-exec-card">
   <div class="po-title"><h3>Resource &amp; Execution Readiness</h3><span class="po-readiness-overall ${planGateClass(g.state)}">${planGateText(g)} · ${g.passed.length}/6 checks · ${g.pct.toFixed(0)}%</span></div>
   <div class="po-resource-readiness-grid">${dims.map(k=>{const rs=String(st[k+'_Status']||'Review'),state=planReadinessState(rs),shown=planReadinessLabel(rs),cls=state==='green'?'ready':state==='amber'?'conditional':'blocked',icon=state==='green'?'✓':'⚠';
    const primary={Crew:r.schedule.Technician_ID||'Unassigned',Material:r.Required_Part_ID||'—',Tool:r.Required_Tool_ID||'—',Vehicle:r.schedule.Vehicle_ID||r.Vehicle_Class||'Unassigned',Access:'Site access',Outage:'Outage window'}[k];
    return `<div class="po-resource-readiness-item ${cls}"><div class="po-rri-head"><b><i>${icon}</i>${k==='Outage'?'Outage Window':k}</b><strong>${esc(shown)}</strong></div><span>${esc(primary)}</span></div>`}).join('')}</div>
   <div class="po-readiness-legend"><span class="ready">✓ Ready · execute</span><span class="conditional">⚠ Ready with Constraint · non-blocking</span><span class="blocked">⚠ Blocked · cannot execute</span></div>
 </section>`;
 const planning=`<section class="po-card po-planning-record167">
   <div class="po-title"><h3>Intervention planning record</h3><span>${esc(r.Intervention_ID)}</span></div>
   <div class="po-detail-list">${[['Work order',r.Work_Order_ID],['Site / asset',r.Plant_ID+' · '+r.Asset_Tag],['Intervention',r.Intervention],['Required by',planFmtDateTime(r.Required_By)],['Duration',r.Duration_Hours+' h'],['Risk',r.Risk_Score_Pct+'%'],['Value exposure',money(r.Value_Exposure_INR)],['Source',r.Source_Sheet+' · '+r.Source_Record_ID]].map(x=>`<div class="po-detail"><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join('')}
   <button class="po-btn po-exact-wo-btn" onclick="planOpenSource('${r.Intervention_ID}','wo')"><span>Open exact Work Order</span><i aria-hidden="true">↗</i></button></div>
 </section>`;
 const evidence=`<div class="po-grid po-evidence-grid167">
   <section class="po-card s6"><div class="po-title"><h3>Crew & skills</h3></div>${detailRows([['Technician',tech.Technician_ID?tech.Technician_ID+' · '+tech.Technician_Name:'Unassigned'],['Crew',r.schedule.Crew_ID||tech.Crew_ID||'—'],['Required skill',r.Required_Skill],['Primary skill',tech.Primary_Skill||'—'],['Skill level',tech.Skill_Level||'—'],['Certification',tech.Certification||'—'],['Certification expiry',tech.Certification_Expiry?planFmtDateTime(tech.Certification_Expiry).split(' ')[0]:'—'],['Availability',tech.Availability||'—'],['Shift',tech.Default_Shift||tech.Shift||'—'],['Work days',tech.Work_Days||'—'],['OT eligible',tech.OT_Eligible||'—']])}</section>
   <section class="po-card s6"><div class="po-title"><h3>Materials & spares</h3></div>${detailRows([['Part',r.Required_Part_ID+' · '+(part.Part_Name||'')],['Required qty',r.Required_Part_Qty],['Site on-hand',st.Material_On_Hand_Qty],['Earliest receipt',st.Material_Earliest_Receipt&&st.Material_Earliest_Receipt!=='Not required'?planFmtDateTime(st.Material_Earliest_Receipt).split(' ')[0]:(st.Material_Earliest_Receipt||'Not required')],['Lead time',part.Lead_Time_Days?part.Lead_Time_Days+' days':'—'],['Status',st.Material_Status]])}</section>
   <section class="po-card s6"><div class="po-title"><h3>Tools / tackles & vehicle</h3></div>${detailRows([['Required skill',r.Required_Skill||'—'],['Tool',tool.Tool_ID?tool.Tool_ID+' · '+tool.Tool_Name:'—'],['Tool type',tool.Tool_Type||'—'],['Calibration',tool.Calibration_Status||'—'],['Calibration expiry',tool.Calibration_Expiry||'—'],['Vehicle',veh.Vehicle_ID?veh.Vehicle_ID+' · '+veh.Vehicle_Type:'No compatible site vehicle'],['Vehicle status',veh.Availability||'Constraint'],['Fuel',veh.Fuel_Type||'—'],['GHG boundary',veh.GHG_Boundary_Status||'—']])}</section>
   <section class="po-card s6"><div class="po-title"><h3>Execution prerequisites</h3></div>${detailRows([['Permit required',r.Permit_Required],['Outage required',r.Outage_Required],['Access',st.Access_Status],['Outage readiness',st.Outage_Status],['Checklist',jobFor(r).Checklist_ID||'—'],['Reference',jobFor(r).Reference||'—']])}</section>
 </div>`;
 return `${head()}${toolbar(`<select class="po-select" onchange="planSelect(this.value,'resources')">${ints.map(x=>`<option value="${x.Intervention_ID}" ${x.Intervention_ID===r.Intervention_ID?'selected':''}>${x.Intervention_ID} · ${x.Plant_ID} · ${x.Asset_Tag} · ${planFmtDateTime(x.Planned_Start).split(' ')[0]}</option>`).join('')}</select><button class="po-btn po-resource-cost-basis-btn" onclick="planOpenResourceCostBasis('people')"><span>Resource &amp; Cost Basis</span><i aria-hidden="true">↗</i></button>`)}
 <div class="po-planres169">
   <div class="po-planres-left169">${readiness}${planning}</div>
   <div class="po-planres-right169">${evidence}</div>
 </div>
 <section class="po-card po-calendar-card169"><div class="po-title po-cal172-title"><h3>Resource Calendar</h3><span class="po-cal172-horizon">${planCalendarHorizonLabel()}</span><div class="po-cal172-title-nav">${(()=>{const range=planCalendarRange(),months=[];let c=new Date(range.start.getFullYear(),range.start.getMonth(),1),last=new Date(range.finish.getFullYear(),range.finish.getMonth(),1);while(c<=last){months.push(new Date(c));c=new Date(c.getFullYear(),c.getMonth()+1,1)}if(planCalendarMonthIndex()>months.length-1)U.resourceCalendarMonth=months.length-1;const idx=planCalendarMonthIndex(),m=months[idx]||range.start;return `<span class="po-cal172-title-month">${m.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</span><button class="po-cal172-arrow" onclick="planSetResourceCalendarMonth(-1)" ${idx===0?'disabled':''} aria-label="Previous month">◀</button><button class="po-cal172-arrow" onclick="planSetResourceCalendarMonth(1)" ${idx===months.length-1?'disabled':''} aria-label="Next month">▶</button>`})()}</div></div>${calendar(r)}</section>`;
}
function feasibilityTree(r){const c=constraintCheck(r,r.schedule.Planned_Start||r.Planned_Start),steps=[['RCM window',c.rcm?.Criticality?`${c.rcm.Criticality} · RUL ${c.rcm.RUL_Days}d`:'No linked RCM','info'],...c.evidence.map(e=>[e[0],e[1],e[2]==='hard'?'fail':e[2]==='soft'?'warn':'pass']),['Execution gate',c.feasible?'Feasible':'Constrained',c.feasible?'pass':'fail']];return `<div class="po-tree104">${steps.map((x,i)=>`${i?'<span class="po-tree-arrow">→</span>':''}<div class="po-tree-step ${x[2]}"><b>${esc(x[0])}</b>${esc(x[1])}</div>`).join('')}</div>`}
function detailRows(items){return `<div class="po-detail-list">${items.map(x=>`<div class="po-detail"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('')}</div>`}
function owner(cap){const x=sheet('PLAN_Capability_Config').find(r=>r.Capability===cap);return x?`${x.Ownership} · ${x.Provider}`:'Configuration unavailable'}
function jobFor(r){return sheet('PLAN_Job_Templates').find(x=>x.Asset_Class===r.Asset_Class)||{}}
function planCalendarRange(){
 const start=U.horizon==='custom'?new Date(String(U.customFrom||'2026-09-03T08:00').replace(' ','T')):asof();
 const days=U.horizon==='custom'?Math.max(1,Math.ceil((new Date(String(U.customTo||U.customFrom||'2026-10-03T18:00').replace(' ','T'))-start)/86400000)):(Number(U.horizon)||30);
 const finish=new Date(+start+(days-1)*86400000);
 return {start,finish,days};
}
function planCalendarHorizonLabel(){
 const x=planCalendarRange();
 return `${x.days} day planning horizon · ${x.start.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}–${x.finish.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`;
}
function planCalendarMonthIndex(){
 if(!Number.isInteger(U.resourceCalendarMonth))U.resourceCalendarMonth=0;
 return U.resourceCalendarMonth;
}
function planSetResourceCalendarMonth(delta){
 const range=planCalendarRange(),months=[];let c=new Date(range.start.getFullYear(),range.start.getMonth(),1),last=new Date(range.finish.getFullYear(),range.finish.getMonth(),1);
 while(c<=last){months.push(new Date(c));c=new Date(c.getFullYear(),c.getMonth()+1,1)}
 const next=Math.max(0,Math.min(months.length-1,planCalendarMonthIndex()+delta));
 U.resourceCalendarMonth=next;
 render();
}
window.planSetResourceCalendarMonth=planSetResourceCalendarMonth;
function calendar(r){
 const range=planCalendarRange(),techId=r.schedule.Technician_ID,
   ev=sheet('PLAN_Resource_Calendar').filter(x=>x.Resource_ID===techId),
   wx=sheet('PLAN_Weather_Forecast').filter(x=>x.Plant_ID===r.Plant_ID),
   duration=n(r.Duration_Hours),days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const months=[];let cursor=new Date(range.start.getFullYear(),range.start.getMonth(),1);
 const last=new Date(range.finish.getFullYear(),range.finish.getMonth(),1);
 while(cursor<=last){months.push(new Date(cursor));cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1)}
 if(!months.length)return '';
 if(planCalendarMonthIndex()>months.length-1)U.resourceCalendarMonth=months.length-1;
 const idx=planCalendarMonthIndex(),m=months[idx],y=m.getFullYear(),mo=m.getMonth(),first=new Date(y,mo,1),lastDay=new Date(y,mo+1,0).getDate(),offset=(first.getDay()+6)%7;
 let cells=days.map(d=>`<div class="po-cal163-dow">${d}</div>`).join('');
 for(let i=0;i<offset;i++)cells+='<div class="po-cal163-empty"></div>';
 for(let d=1;d<=lastDay;d++){
   const date=new Date(y,mo,d),inRange=date>=new Date(range.start.getFullYear(),range.start.getMonth(),range.start.getDate())&&date<=new Date(range.finish.getFullYear(),range.finish.getMonth(),range.finish.getDate()),ds=iso(date);
   const e=ev.find(x=>String(x.Start).slice(0,10)===ds),w=wx.find(x=>String(x.Valid_From).slice(0,10)===ds);
   const free=e?Math.max(0,n(e.Available_Hours)-n(e.Committed_Hours)):null,total=e?n(e.Available_Hours):null;
   const unavailable=e&&String(e.Availability)==='Unavailable',partial=e&&String(e.Availability)==='Partial';
   const available=e?(unavailable?0:free):null;
   const balance=e&&duration>0?available-duration:null;
   const capacityShort=e&&duration>0&&available<duration;
   const resourceState=!e?'unknown':unavailable||capacityShort?'blocked':partial?'partial':'free';
   const resourceText=!e?'Available n/a':balance<0?`Available ${available}h · Shortfall ${Math.abs(balance)}h`:`Available ${available}h · Surplus ${balance}h`;
   const weatherCls=!w?'unknown':weatherOverallSeverity(w).toLowerCase();
   const weatherText=!w?'Forecast n/a':weatherCompactText(w);
   cells+=`<div class="po-cal163-day ${inRange?'':'outside'}">
     <div class="po-cal163-date">${d}</div>
     <div class="po-cal163-param resource ${resourceState}"><span>Resource</span><b>${esc(resourceText)}</b></div>
     <div class="po-cal163-param weather ${weatherCls}"><span>Weather</span><b>${esc(weatherText)}</b></div>
   </div>`;
 }
 return `<div class="po-cal172-nav">
   <div class="po-cal172-month">${m.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</div>
   <div class="po-cal172-arrows">
     <button class="po-cal172-arrow" onclick="planSetResourceCalendarMonth(-1)" ${idx===0?'disabled':''} aria-label="Previous month">◀</button>
     <button class="po-cal172-arrow" onclick="planSetResourceCalendarMonth(1)" ${idx===months.length-1?'disabled':''} aria-label="Next month">▶</button>
   </div>
 </div>
 <div class="po-cal163-key po-cal168-key">
   <div class="po-cal168-legend-pair">
     <div class="po-cal163-key-group"><b>Resource capacity</b><span><i class="po-dot green"></i>Available</span><span><i class="po-dot amber"></i>Partial / insufficient capacity</span><span><i class="po-dot red"></i>Unavailable</span></div>
     <div class="po-cal163-key-group"><b>Weather context</b><span><i class="po-dot blue"></i>Low</span><span><i class="po-dot amber"></i>Moderate</span><span><i class="po-dot red"></i>High</span><span>Informational only · same governed record as Intervention Schedule</span></div>
   </div>
   <div class="po-cal163-duration po-cal168-duration"><span>Selected intervention</span><b>${duration} h required</b></div>
 </div>
 <div class="po-cal164-month"><div class="po-cal163-grid">${cells}</div></div>`;
}

function planScheduleScale(scale){
 U.scheduleScale=scale||'weekly';
 render();
}
function planScheduleAxisLabels(start,days,scale){
 const out=[],end=new Date(+start+days*86400000),push=(d,label)=>{
   const pos=Math.max(0,Math.min(99.4,100*(d-start)/86400000/days));
   out.push(`<span style="left:${pos}%">${esc(label)}</span>`);
 };
 if(scale==='daily'){
   for(let d=new Date(start);d<end;d=new Date(+d+86400000))push(d,d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
 }else if(scale==='monthly'){
   push(start,start.toLocaleDateString('en-GB',{month:'short',year:'numeric'}));
   for(let d=new Date(start.getFullYear(),start.getMonth()+1,1);d<end;d=new Date(d.getFullYear(),d.getMonth()+1,1))
     push(d,d.toLocaleDateString('en-GB',{month:'short',year:'numeric'}));
 }else if(scale==='yearly'){
   push(start,String(start.getFullYear()));
   for(let d=new Date(start.getFullYear()+1,0,1);d<end;d=new Date(d.getFullYear()+1,0,1))push(d,String(d.getFullYear()));
 }else{
   push(start,start.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
   for(let d=new Date(+start+7*86400000);d<end;d=new Date(+d+7*86400000))push(d,d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
 }
 return out;
}
window.planScheduleScale=function(scale){
 U.scheduleScale=['daily','weekly','monthly','yearly'].includes(scale)?scale:'weekly';
 U.scheduleZoom=1;
 render();
 if(window.planScheduleResetScroll)window.planScheduleResetScroll();
 requestAnimationFrame(()=>{
   const card=document.querySelector('.po-sched176-card');
   const top=card?.querySelector('.po-sched191-topscroll'),bottom=card?.querySelector('.po-sched191-timeviewport'),axis=card?.querySelector('.po-sched191-axisviewport');
   if(top)top.scrollLeft=0;if(axis)axis.scrollLeft=0;if(bottom)bottom.scrollLeft=0;
 });
};
function planScheduleAxisMeta(start,rawDays,scale){
 const DAY=86400000;
 const days=Math.max(1,Number(rawDays||0)+1);
 const horizonEnd=new Date(+start+days*DAY); // exclusive edge after final visible day
 const ticks=[],boundaries=[];
 const pos=d=>Math.max(0,Math.min(100,100*((+d)-(+start))/(DAY*days)));
 const add=(s,e,html)=>{
   if(!s||!e||+e<=+s)return;
   const left=pos(s),right=pos(e),width=Math.max(0,right-left);
   ticks.push(`<span class="po-sched237-cell" style="left:${left.toFixed(6)}%;width:${width.toFixed(6)}%">${html}</span>`);
   if(left>0&&left<100)boundaries.push(left);
   if(right>0&&right<100)boundaries.push(right);
 };
 let perDayPx=16;
 if(scale==='daily'){
   perDayPx=52;
   for(let i=0;i<days;i++){
     const s=new Date(+start+i*DAY),e=new Date(Math.min(+horizonEnd,+s+DAY));
     add(s,e,`<b>${String(s.getDate()).padStart(2,'0')} ${s.toLocaleDateString('en-GB',{month:'short'})}</b><small>${s.getFullYear()}</small>`);
   }
 }else if(scale==='weekly'){
   perDayPx=16;
   let s=new Date(start),week=1;
   while(s<horizonEnd){
     const e=new Date(Math.min(+horizonEnd,+s+7*DAY)),last=new Date(+e-DAY);
     add(s,e,`<b>Week ${week}</b><small>${String(s.getDate()).padStart(2,'0')} ${s.toLocaleDateString('en-GB',{month:'short'})} – ${String(last.getDate()).padStart(2,'0')} ${last.toLocaleDateString('en-GB',{month:'short'})} ${last.getFullYear()}</small>`);
     s=e;week++;
   }
 }else if(scale==='monthly'){
   perDayPx=7;
   let s=new Date(start);
   while(s<horizonEnd){
     const e=new Date(Math.min(+horizonEnd,+new Date(s.getFullYear(),s.getMonth()+1,1)));
     add(s,e,`<b>${s.toLocaleDateString('en-GB',{month:'long'})}</b><small>${s.getFullYear()}</small>`);
     s=e;
   }
 }else if(scale==='yearly'){
   perDayPx=2.4;
   let s=new Date(start);
   while(s<horizonEnd){
     const e=new Date(Math.min(+horizonEnd,+new Date(s.getFullYear()+1,0,1)));
     add(s,e,`<b>${s.getFullYear()}</b>`);
     s=e;
   }
 }else{
   return planScheduleAxisMeta(start,rawDays,'weekly');
 }
 const uniq=[];const seen=new Set();
 boundaries.forEach(p=>{const k=p.toFixed(6);if(!seen.has(k)){seen.add(k);uniq.push(p)}});
 window.AIP_SCHED237_GRIDLINES=uniq;
 return {ticks,unitCount:days,cellPx:perDayPx,gridStepPct:0,days,boundaries:uniq};
}
function schedule(){
 const all=scopeRows();
 const baseStart=U.horizon==='custom'?new Date(U.customFrom||asof()):asof();
 const recentActual=all.map(r=>r.schedule.Actual_Start||r.Actual_Start).filter(Boolean).map(x=>new Date(String(x).replace(' ','T'))).filter(d=>Number.isFinite(+d));
 const earliestActual=recentActual.length?new Date(Math.min(...recentActual.map(d=>+d))):null;
 const start=(U.horizon!=='custom'&&earliestActual&&earliestActual<baseStart&&((baseStart-earliestActual)/86400000)<=7)?earliestActual:baseStart;
 const historyDays=Math.max(0,Math.round((baseStart-start)/86400000));
 const rawDays=(U.horizon==='custom'
   ?Math.max(1,Math.ceil((new Date(U.customTo||'2026-10-03')-start)/86400000))
   :(Number(U.horizon)||30))+historyDays;
 const changed=r=>{const sc=U.scenario[r.Intervention_ID];if(!sc?.start)return false;return String(sc.start).slice(0,10)!==String(r.schedule.Planned_Start||r.Planned_Start).slice(0,10)};
 const rr=(U.scheduleMode==='changes'?all.filter(changed):all);
 const groups=new Map();rr.forEach(r=>{if(!groups.has(r.Plant_ID))groups.set(r.Plant_ID,[]);groups.get(r.Plant_ID).push(r)});
 const scale=(U.scheduleScale==='hourly'?'daily':(U.scheduleScale||'weekly'));
 if(U.scheduleScale==='hourly')U.scheduleScale='daily';
 const meta=planScheduleAxisMeta(start,rawDays,scale);
 const displayDays=meta.days;
 const timelineWidth=Math.max(900,Math.round(meta.unitCount*meta.cellPx));
 const changes=all.filter(changed).length;
 const fixedRows=[...groups.entries()].map(([site,list])=>scheduleFixedGroup(site,list)).join('');
 const timelineRows=[...groups.entries()].map(([site,list])=>scheduleTimelineGroup(site,list,start,displayDays,meta.gridStepPct)).join('');
 return `${head()}${toolbar('')}
 <section class="po-card po-sched176-card" tabindex="0" onkeydown="if(event.key==='ArrowDown'){event.preventDefault();planScheduleMoveSelection(1)}else if(event.key==='ArrowUp'){event.preventDefault();planScheduleMoveSelection(-1)}">
   <div class="po-sched193-sticky">
     <div class="po-sched176-top">
       <div><h3>Intervention Schedule</h3></div>
       <div class="po-sched176-actions">
         <div class="po-sched176-toggle" role="group" aria-label="Schedule view"><button class="${U.scheduleMode==='schedule'?'active':''}" onclick="planScheduleMode('schedule')">Schedule</button><button class="${U.scheduleMode==='changes'?'active':''}" onclick="planScheduleMode('changes')">Schedule Changes${changes?` · ${changes}`:''}</button></div>
         <select class="po-sched180-scale" aria-label="Timeline scale" onchange="planScheduleScale(this.value)">
           <option value="daily" ${scale==='daily'?'selected':''}>Daily</option>
           <option value="weekly" ${scale==='weekly'?'selected':''}>Weekly</option>
           <option value="monthly" ${scale==='monthly'?'selected':''}>Monthly</option>
           <option value="yearly" ${scale==='yearly'?'selected':''}>Yearly</option>
         </select>
       </div>
     </div>
     <div class="po-sched181-legendline">
       <div class="po-sched176-legend po-sched204-legend">
         <span><i class="current"></i>Baseline</span><span><i class="optimized"></i>Schedule Alternative</span><span><i class="actual"></i>Actual</span><span><b class="due">◆</b> Required Completion By</span>
         <span class="po-sched204-weather-gap" aria-hidden="true"></span>
         <span class="po-sched204-weather-title">Weather Context</span>
         <span class="po-sched206-factorbox"><span class="po-sched204-wx-key"><b>☂</b> Rain</span><span class="po-sched204-wx-key"><b>⚡</b> Lightning</span><span class="po-sched204-wx-key"><b>≋</b> Gust</span><span class="po-sched204-wx-key"><b>☀</b> Heat</span></span>
         <span class="po-sched204-band low">Low</span><span class="po-sched204-band moderate">Moderate</span><span class="po-sched204-band high">High</span>
       </div>
     </div>
     ${rr.length?`
     <div class="po-sched193-topgrid">
       <div class="po-sched193-fixedspacer"></div>
       <div class="po-sched193-topbar" onscroll="planScheduleSyncScrollSafe(this,'top')">
         <div class="po-sched193-topfill" style="width:${timelineWidth}px"></div>
       </div>
     </div>
     <div class="po-sched193-axisgrid">
       <div class="po-sched193-fixedhead">Asset · Intervention</div>
       <div class="po-sched193-axisclip">
         <div class="po-sched193-axis po-sched176-axis" style="width:${timelineWidth}px;--po-grid-step:${meta.gridStepPct}%">${meta.ticks.join('')}</div>
       </div>
     </div>`:''}
   </div>
   ${rr.length?`
   <div class="po-sched193-maingrid">
     <div class="po-sched193-fixedpane">${fixedRows}</div>
     <div class="po-sched193-bottomscroll" onscroll="planScheduleSyncScrollSafe(this,'bottom')">
       <div class="po-sched193-timecanvas" style="width:${timelineWidth}px">
         <div class="po-sched193-timelineboard po-sched184-timelineboard" style="width:${timelineWidth}px;--po-grid-step:${meta.gridStepPct}%">${timelineRows}</div>
       </div>
     </div>
   </div>`:
   `<div class="po-sched176-empty">${U.scheduleMode==='changes'?'No AIP schedule changes have been applied in the current planning scope.':'No interventions in the selected planning scope.'}</div>`}
 </section>`;
}

function scheduleFixedGroup(site,list){
 const dates=list.map(r=>new Date(String(r.schedule.Planned_Start||r.Planned_Start).replace(' ','T'))).sort((a,b)=>a-b),from=dates[0],to=dates.at(-1);
 const head=`<div class="po-sched176-site"><b>${esc(site)}</b><span>${list.length} intervention${list.length===1?'':'s'}</span><small>${from?from.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}):'—'}${to&&+to!==+from?' → '+to.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}):''}</small></div>`;
 const rows=list.slice().sort((a,b)=>new Date(String(a.schedule.Planned_Start||a.Planned_Start).replace(' ','T'))-new Date(String(b.schedule.Planned_Start||b.Planned_Start).replace(' ','T'))).map(r=>scheduleFixedRow(r)).join('');
 return `<div class="po-sched184-fixedgroup">${head}${rows}</div>`;
}
function scheduleTimelineGroup(site,list,start,days,gridStepPct){
 const rows=list.slice().sort((a,b)=>new Date(String(a.schedule.Planned_Start||a.Planned_Start).replace(' ','T'))-new Date(String(b.schedule.Planned_Start||b.Planned_Start).replace(' ','T'))).map(r=>scheduleTimelineRow(r,start,days,gridStepPct)).join('');
 return `<div class="po-sched184-timegroup"><div class="po-sched184-site-line"></div>${rows}</div>`;
}
function scheduleWeatherSymbols(w){
 if(!w)return '<span class="po-sched204-wx-symbol unavailable" title="Weather unavailable">?</span>';
 const sym=(glyph,label,metric,val,raw,unit='')=>{const sev=weatherSeverity(metric,val);return `<span class="po-sched204-wx-symbol ${sev.toLowerCase()}" title="${label} ${raw}${unit} · ${sev}" aria-label="${label} ${raw}${unit} ${sev}">${glyph}</span>`};
 return sym('☂','Rain probability','rain',w.Rain_Probability_Pct,Number(w.Rain_Probability_Pct||0).toFixed(0),'%')+sym('⚡','Lightning probability','lightning',w.Lightning_Probability_Pct,Number(w.Lightning_Probability_Pct||0).toFixed(0),'%')+sym('≋','Wind gust','gust',w.Gust_kmh,Number(w.Gust_kmh||0).toFixed(0),' km/h')+sym('☀','Temperature','heat',w.Temperature_C,Number(w.Temperature_C||0).toFixed(0),'°C');
}
function scheduleElapsedLabel(startValue,endValue,fallbackHours){
 const parse=x=>x?new Date(String(x).replace(' ','T')):null;
 const s=parse(startValue),e=parse(endValue);
 let hrs=(s&&e&&Number.isFinite(+s)&&Number.isFinite(+e))?Math.max(0,(e-s)/3600000):n(fallbackHours);
 if(!Number.isFinite(hrs)) hrs=0;
 const rounded=Math.round(hrs*100)/100;
 if(rounded<24) return `${Number.isInteger(rounded)?rounded:rounded.toFixed(1)} h`;
 const days=Math.floor(rounded/24),rem=Math.round((rounded-days*24)*10)/10;
 return rem>0?`${days} d ${Number.isInteger(rem)?rem:rem.toFixed(1)} h`:`${days} d`;
}
function scheduleFixedRow(r){
 const planStart=r.schedule.Planned_Start||r.Planned_Start;
 const planEnd=r.schedule.Planned_End||r.schedule.Planned_Finish||r.Planned_Finish;
 const dur=n(r.schedule.Duration_Hours||r.Duration_Hours);
 const rs=String((r.readiness&&r.readiness.Overall_Status)||'');
 const readiness=rs==='Ready'?'Resource Ready':rs==='Constrained'?'Resource Constraint':rs==='Blocked'?'Blocked':'Pending';
 const approval=String(r.schedule.Status||r.Planning_Status||'Planned')==='Approved'?'Approved':'Approval Pending';
 const outcome=r.schedule.ERP_Execution_Status||r.ERP_Execution_Status||'Not started';
 const selected=U.selected===r.Intervention_ID?' selected':'';
 const dlabel=scheduleElapsedLabel(planStart,planEnd,dur);
 const w=weatherForIntervention(r),wsymbols=scheduleWeatherSymbols(w);
 return `<div class="po-sched176-left po-sched184-fixedrow${selected}" onclick="planScheduleSelect('${r.Intervention_ID}')"><div class="po-sched204-rowtop"><b>${esc(r.Asset_Tag)} · ${esc(r.Intervention_ID)}</b><div class="po-sched204-wx-symbols">${wsymbols}</div></div><span>${esc(r.Intervention)}</span><small>Duration ${esc(dlabel)} · ${esc(readiness)} · ${esc(approval)}${outcome&&outcome!=='Not started'?` · ${esc(outcome.replace('Completed · ',''))}`:''}</small></div>`;
}
function scheduleTimelineRow(r,start,days,gridStepPct){
 const parse=x=>x?new Date(String(x).replace(' ','T')):null,pct=d=>100*(d-start)/86400000/days;
 const span=(s,e,cls,top,label)=>{
  if(!s||!e||!Number.isFinite(+s)||!Number.isFinite(+e))return '';
  const l=pct(s),rr=pct(e);if(rr<0||l>100)return '';
  const left=Math.max(0,l),right=Math.min(100,rr),w=Math.max(.12,right-left);
  const hrs=Math.max(0,(e-s)/3600000),dlabel=scheduleElapsedLabel(s,e,hrs);
  const calc=`Finish − Start = ${Number.isInteger(hrs)?hrs:hrs.toFixed(1)} h = ${dlabel}`;
  return `<button class="po-sched198-gbar ${cls}" style="left:${left}%;width:${w}%;top:${top}px" onclick="event.stopPropagation();planScheduleSelect('${r.Intervention_ID}')" onmouseenter="planScheduleTipShow(event,'${r.Intervention_ID}','${esc(label)}','${cls}','${esc(planFmtDateTime?planFmtDateTime(s):s.toLocaleString())}','${esc(planFmtDateTime?planFmtDateTime(e):e.toLocaleString())}','${esc(calc)}')" onmousemove="planScheduleTipMove(event)" onmouseleave="planScheduleTipHide()" aria-label="${esc(label)} ${esc(r.Intervention_ID)}"></button>`
 };
 const planStart=parse(r.schedule.Planned_Start||r.Planned_Start),planEnd=parse(r.schedule.Planned_End||r.schedule.Planned_Finish||r.Planned_Finish)||new Date(+planStart+n(r.Duration_Hours)*3600000);
 const optStart=parse(r.schedule.AIP_Optimized_Start||r.AIP_Optimized_Start),optEnd=parse(r.schedule.AIP_Optimized_Finish||r.AIP_Optimized_Finish);
 const actualStart=parse(r.schedule.Actual_Start||r.Actual_Start),actualEnd=parse(r.schedule.Actual_Completion||r.Actual_Completion),req=parse(r.Required_By||r.Required_Completion_By);
 const selected=U.selected===r.Intervention_ID?' selected':'';
 const grid=(window.AIP_SCHED237_GRIDLINES||[]).map(p=>`<i class="po-sched237-gridline" style="left:${Number(p).toFixed(6)}%"></i>`).join('');
 const plannedBar=span(planStart,planEnd,'current',18,'Baseline');
 const optimizedBar=optStart&&optEnd?span(optStart,optEnd,'optimized',42,'Schedule Alternative'):'';
 const actualBar=actualStart&&actualEnd?span(actualStart,actualEnd,'actual',66,'Actual'):'';
 const effectiveFinish=actualEnd||parse(r.schedule.Approved_Finish||r.Approved_Finish)||optEnd||planEnd,gapDays=req&&effectiveFinish?Math.ceil((req-effectiveFinish)/86400000):0,gapClass=gapDays<0?'late':gapDays===0?'due':'ahead';
 const due=req&&pct(req)>=0&&pct(req)<=100?`<i class="po-sched176-due ${gapClass}" style="left:${pct(req)}%" onmouseenter="planScheduleTipShow(event,'${r.Intervention_ID}','Required Completion By','due','${esc(planFmtDateTime?planFmtDateTime(req):req.toLocaleString())}','','Deadline milestone')" onmousemove="planScheduleTipMove(event)" onmouseleave="planScheduleTipHide()">◆</i>`:'';
 return `<div class="po-sched176-timeline po-sched184-timerow${selected}" style="--po-grid-step:0%" onclick="planScheduleSelect('${r.Intervention_ID}')">${grid}${plannedBar}${optimizedBar}${actualBar}${due}</div>`;
}
function ganttRow(r,start){
 const s=U.scenario[r.Intervention_ID]?.start||r.schedule.Planned_Start||r.Planned_Start;const d=new Date(String(s).replace(' ','T'));const day=Math.max(0,Math.min(29,Math.floor((d-start)/86400000)));const width=Math.max(2.2,Math.min(8,n(r.Duration_Hours)/24*3.333));
 const req=new Date(String(r.Required_By).replace(' ','T'));const rd=Math.max(0,Math.min(29,Math.floor((req-start)/86400000)));
 const win=sheet('PLAN_Calendar').find(x=>x.Reference_ID===r.Plant_ID&&/window/i.test(String(x.Event_Type)));let wi='';if(win){const wd=Math.floor((new Date(String(win.Start).replace(' ','T'))-start)/86400000);if(wd>=0&&wd<30)wi=`<div class="po-window" style="left:${wd*3.333}%;width:3.333%"></div>`}
 return `<div class="po-grow"><div class="po-glabel" onclick="planSelect('${r.Intervention_ID}','schedule')"><b>${esc(r.Plant_ID)} · ${esc(r.Asset_Tag)}</b><span>${esc(r.Intervention_ID)} · ${esc(r.schedule.Crew_ID||'unassigned')}</span></div><div class="po-timeline">${wi}<div class="po-gmark" title="Required by ${esc(r.Required_By)}" style="left:${rd*3.333}%"></div><div class="po-gbar ${U.scenario[r.Intervention_ID]?'scenario':''}" data-int="${r.Intervention_ID}" style="left:${day*3.333}%;width:${width}%" onpointerdown="planDragStart(event,'${r.Intervention_ID}')">${esc(r.Intervention_ID)} · ${fmtDate(s)}</div></div></div>`;
}
function ganttRow104(r,start,days){
 const s=U.scenario[r.Intervention_ID]?.start||r.schedule.Planned_Start||r.Planned_Start,d=new Date(String(s).replace(' ','T')),pct=x=>Math.max(0,Math.min(100,100*x/days)),day=(d-start)/86400000,width=Math.max(.7,Math.min(8,100*n(r.Duration_Hours)/24/days)),req=new Date(String(r.Required_By).replace(' ','T')),rd=(req-start)/86400000,c=constraintCheck(r,s),cls=U.scenario[r.Intervention_ID]?'scenario':r.Planning_Status==='Approved'?'approved':r.Planning_Status==='AIP Optimized'?'optimized':'current';
 const wx=sheet('PLAN_Weather_Forecast').filter(x=>x.Plant_ID===r.Plant_ID&&x.Lightning_Risk==='High').map(x=>{const dd=(new Date(String(x.Valid_From).replace(' ','T'))-start)/86400000;return dd>=0&&dd<days?`<div class="po-weatherband" title="${x.Rain_Probability_Pct}% rain · ${x.Lightning_Risk} lightning" style="left:${pct(dd)}%;width:${Math.max(.35,100/days)}%"></div>`:''}).join('');
 const risk=n(r.Risk_Score_Pct).toFixed(1),ready=n(r.readiness.Overall_Readiness_Pct).toFixed(0);return `<div class="po-grow"><div class="po-glabel" onclick="planSelect('${r.Intervention_ID}','schedule')"><b>${esc(r.Plant_ID)} · ${esc(r.Asset_Tag)} · ${esc(r.Intervention_ID)}</b><div class="desc">${esc(r.Intervention)}</div><div class="meta"><span class="po-pill ${ready>=100?'ready':'constraint'}">${ready}% ready</span><span class="po-pill ${risk>=75?'risk':'blue'}">Risk ${risk}%</span><span class="po-pill ${r.Planning_Status==='Approved'?'ready':r.Planning_Status==='AIP Optimized'?'purple':'blue'}">${esc(r.Planning_Status||'Planned')}</span><span class="po-pill blue">${esc(r.schedule.Crew_ID||'Crew unassigned')}</span></div></div><div class="po-timeline">${wx}<div class="po-milestone" title="Required by ${esc(r.Required_By)}" style="left:${pct(rd)}%"></div><div class="po-gbar ${cls}" style="left:${pct(day)}%;width:${width}%" onpointerdown="planDragStart104(event,'${r.Intervention_ID}',${days})" title="${esc(r.Intervention)} · ${esc(s)} · ${c.feasible?'Feasible':'Blocked: '+c.hard.join('; ')}">${esc(r.Intervention_ID)} · ${fmtDate(s)} · ${esc(r.schedule.Technician_ID||'unassigned')}</div></div></div>`;
}
function constraintCheck(r,startStr){
 const date=String(startStr).slice(0,10),issues=[],soft=[],evidence=[];const st=r.readiness||{},techLegacy=sheet('Crew & Skills').find(x=>x.Technician_ID===r.schedule.Technician_ID)||{},techGov=sheet('PNO_Technician_Skills').find(x=>x.Technician_ID===r.schedule.Technician_ID)||{},tech={...techGov,...techLegacy,Certification_Expiry:techLegacy.Certification_Expiry||techGov.Valid_To},rcm=sheet('PLAN_RCM_Context').find(x=>x.Intervention_ID===r.Intervention_ID)||{};
 const re=sheet('PLAN_Resource_Calendar').find(x=>x.Resource_ID===r.schedule.Technician_ID&&String(x.Start).slice(0,10)===date),pe=sheet('PLAN_Calendar').find(x=>x.Reference_ID===r.schedule.Technician_ID&&String(x.Start).slice(0,10)===date);if(re){evidence.push(['Crew',`${re.Availability} · ${n(re.Available_Hours)-n(re.Committed_Hours)}h free`,re.Availability==='Unavailable'?'hard':re.Availability==='Partial'?'soft':'ready']);if(re.Availability==='Unavailable')issues.push(`Crew ${r.schedule.Technician_ID} unavailable: ${re.Reason}`);if(re.Availability==='Partial'&&n(re.Available_Hours)-n(re.Committed_Hours)<n(r.Duration_Hours))issues.push(`Crew capacity ${n(re.Available_Hours)-n(re.Committed_Hours)}h is below ${r.Duration_Hours}h requirement`)}else if(pe){evidence.push(['Crew',`${pe.Event_Type} · ${pe.Availability}`,pe.Availability==='Unavailable'?'hard':'soft']);if(pe.Availability==='Unavailable')issues.push(`Crew ${r.schedule.Technician_ID} unavailable: ${pe.Reason}`)}else evidence.push(['Crew',`${tech.Availability_Status||tech.Availability||'Roster available'} · governed roster`,'ready']);
 if(tech.Certification_Expiry&&tech.Certification_Expiry<date){issues.push(`Certification expired ${tech.Certification_Expiry}`);evidence.push(['Certification',`Expired ${tech.Certification_Expiry}`,'hard'])}else evidence.push(['Certification',tech.Certification_Expiry?`Valid to ${tech.Certification_Expiry}`:'No expiry evidence','ready']);
 if(st.Material_Status!=='Ready'&&(!st.Material_Earliest_Receipt||st.Material_Earliest_Receipt>date))issues.push(`Part ${r.Required_Part_ID} unavailable by ${date}`);evidence.push(['Material',st.Material_Status==='Ready'?`${r.Required_Part_ID} ready`:`${r.Required_Part_ID} · ${st.Material_Earliest_Receipt||'no receipt date'}`,st.Material_Status==='Ready'?'ready':'hard']);
 if(st.Tool_Status!=='Ready')issues.push(`Required tool ${r.Required_Tool_ID} unavailable`);evidence.push(['Tool',`${r.Required_Tool_ID} · ${st.Tool_Status}`,st.Tool_Status==='Ready'?'ready':'hard']);
 if(st.Vehicle_Status!=='Ready')issues.push(`Compatible ${r.Vehicle_Class} unavailable`);evidence.push(['Vehicle',`${r.schedule.Vehicle_ID||r.Vehicle_Class} · ${st.Vehicle_Status}`,st.Vehicle_Status==='Ready'?'ready':'hard']);
 const wx=sheet('PLAN_Weather_Forecast').find(x=>x.Plant_ID===r.Plant_ID&&String(x.Valid_From).slice(0,10)===date);if(wx){const wblock=wx.Lightning_Risk==='High'||wx.Outdoor_Electrical_Status==='Blocked'||wx.Access_Status==='Constrained';if(wblock)issues.push(`Weather gate: ${wx.Rain_Probability_Pct}% rain · ${wx.Lightning_Risk} lightning · access ${wx.Access_Status}`);else if(wx.Lightning_Risk==='Medium'||wx.Outdoor_Electrical_Status==='Constrained')soft.push(`Weather attention: ${wx.Rain_Probability_Pct}% rain · ${wx.Lightning_Risk} lightning`);evidence.push(['Weather',`${wx.Rain_Probability_Pct}% rain · ${wx.Wind_kmh} km/h · lightning ${wx.Lightning_Risk}`,wblock?'hard':wx.Lightning_Risk==='Medium'?'soft':'ready'])}else{soft.push('No operational weather forecast for proposed date');evidence.push(['Weather','Forecast unavailable','soft'])}
 if(rcm.Deferral_Tolerance_Days!=null){const lim=new Date(String(r.Required_By).replace(' ','T'));lim.setDate(lim.getDate()+n(rcm.Deferral_Tolerance_Days));if(new Date(date+'T08:00:00')>lim)issues.push(`RCM deferral tolerance exceeded (${rcm.Deferral_Tolerance_Days} day limit)`);evidence.push(['RCM',`${rcm.Criticality||''} · RUL ${rcm.RUL_Days||'—'}d · deferral ${rcm.Deferral_Tolerance_Days}d`,new Date(date+'T08:00:00')>lim?'hard':'ready'])}
 if(new Date(date)>new Date(String(r.Required_By).slice(0,10)))soft.push('Proposed date is after required-by date');const win=sheet('PLAN_Calendar').some(x=>x.Reference_ID===r.Plant_ID&&/window/i.test(String(x.Event_Type))&&String(x.Start).slice(0,10)===date);if(!win)soft.push('Not aligned to configured low-generation / outage opportunity window');
 return {hard:issues,soft,feasible:issues.length===0,evidence,weather:wx,rcm};
}
function scenarioPanel(r){const sc=U.scenario[r.Intervention_ID];if(!sc)return '';const c=constraintCheck(r,sc.start),feed=sheet('PLAN_Operational_Feed').filter(x=>x.Plant_ID===r.Plant_ID);return `<section class="po-card" style="margin-top:9px"><div class="po-title"><h3>What-if execution gate · ${esc(r.Intervention_ID)}</h3><button class="po-btn" onclick="planClearScenario('${r.Intervention_ID}')">× Close scenario</button></div><div class="po-livegrid"><div class="po-livebox"><h4>Site visual evidence</h4><div class="po-camera"><span class="camtag">SIMULATED SITE CAMERA · ${esc(r.Plant_ID)}</span><span class="stamp">${esc(sc.start)} · frame evidence</span></div><small>Demo simulation · not a live camera connection</small></div><div class="po-livebox"><h4>Weather / execution gate</h4>${c.weather?`<div class="po-liveval">${c.weather.Rain_Probability_Pct}% rain</div><small>${c.weather.Wind_kmh} km/h wind · ${c.weather.Lightning_Risk} lightning · ${c.weather.Temperature_C}°C</small><div style="margin-top:6px"><span class="po-pill ${c.feasible?'ready':'risk'}">${c.feasible?'FEASIBLE':'BLOCKED'}</span></div>`:'<div class="po-alert">Forecast unavailable</div>'}</div><div class="po-livebox"><h4>Operational feed</h4>${feed.slice(0,4).map(x=>`<div class="po-detail"><span>${esc(x.Metric)}</span><b>${esc(x.Value)} ${esc(x.Unit)}</b></div>`).join('')}<small>Evidence timestamps / freshness are governed feed records.</small></div></div>${c.hard.length?`<div class="po-alert" style="margin-top:7px"><b>Hard constraint:</b> ${esc(c.hard.join(' · '))}</div>`:`<div class="po-good" style="margin-top:7px"><b>Proposed start ${esc(sc.start)} is feasible.</b> ${esc(c.soft.join(' · '))}</div>`}<div class="po-toolbar" style="margin-top:7px"><button class="po-btn" onclick="planSetTab('resources')">Open resource evidence</button><button class="po-btn" onclick="planFindAlternative('${r.Intervention_ID}')">Find qualified alternative</button>${c.feasible?`<button class="po-btn primary" onclick="planSetTab('optimize')">Compare / Optimize</button>`:''}</div></section>`}
let drag=null;
window.planDragStart104=function(ev,id,days){ev.preventDefault();U.selected=id;const bar=ev.currentTarget,tl=bar.parentElement;window.__poDrag104={id,days,startX:ev.clientX,left:parseFloat(bar.style.left)||0,bar,tl};bar.setPointerCapture?.(ev.pointerId);bar.onpointermove=function(e){const d=window.__poDrag104;if(!d)return;const pct=(e.clientX-d.startX)/d.tl.getBoundingClientRect().width*100;d.bar.style.left=Math.max(0,Math.min(99,d.left+pct))+'%'};bar.onpointerup=function(e){const d=window.__poDrag104;if(!d)return;const pct=parseFloat(d.bar.style.left)||0,day=Math.round(pct/100*d.days),dt=new Date(+(U.horizon==='custom'?new Date(U.customFrom||asof()):asof())+day*86400000);U.scenario[d.id]={start:dt.toISOString().slice(0,10)+' 08:00',source:'User Simulation'};window.__poDrag104=null;render()}};
window.planDragStart=function(ev,id){ev.preventDefault();U.selected=id;const bar=ev.currentTarget,tl=bar.parentElement;drag={id,startX:ev.clientX,left:parseFloat(bar.style.left)||0,bar,tl};bar.setPointerCapture?.(ev.pointerId);bar.onpointermove=planDragMove;bar.onpointerup=planDragEnd}
function planDragMove(ev){if(!drag)return;const dx=ev.clientX-drag.startX,pct=dx/drag.tl.getBoundingClientRect().width*100;drag.bar.style.left=Math.max(0,Math.min(96.6,drag.left+pct))+'%'}
function planDragEnd(ev){if(!drag)return;const pct=parseFloat(drag.bar.style.left)||0,day=Math.round(pct/3.333),d=new Date(+asof()+day*86400000);const r=rows().find(x=>x.Intervention_ID===drag.id);const start=`${d.toISOString().slice(0,10)} 08:00`;U.scenario[drag.id]={start,source:'User Simulation'};drag.bar.onpointermove=null;drag.bar.onpointerup=null;drag=null;render()}
function optimize(){
 const rr=scopeRows(),sel=selectedRow(),result=U.optResult||null;
 U.optStrategies=Array.isArray(U.optStrategies)?U.optStrategies:[];U.optStrategies=U.optStrategies.filter((x,i,a)=>['Balanced','Earliest Completion','Lowest Execution Cost','Resource Efficiency','Minimum Schedule Change'].includes(x)&&a.indexOf(x)===i).slice(0,3);U.planGovernance=U.planGovernance||{status:'Draft',selected:'Baseline Plan'};
 const objectives=sheet('PNO_Optimization_Objectives').filter(x=>String(x.Governance_Status||'').toLowerCase()==='approved');
 const iface=sheet('PNO_Optimization_Interface');
 const balancedRows=objectives.filter(x=>['Earliest Completion','Lowest Execution Cost','Resource Efficiency','Minimum Schedule Change'].includes(x.Objective_Name));
 const balancedWeightTotal=balancedRows.reduce((s,x)=>s+n(x.Weight),0)||balancedRows.length||1;
 const balancedProfile=balancedRows.map(x=>`${x.Objective_Name} ${Math.round(100*n(x.Weight)/balancedWeightTotal)}%`).join(' · ');
 const strategyOrder=['Balanced','Earliest Completion','Lowest Execution Cost','Resource Efficiency','Minimum Schedule Change'];const strategyOptions=objectives.filter(x=>strategyOrder.includes(x.Objective_Name)).sort((a,b)=>strategyOrder.indexOf(a.Objective_Name)-strategyOrder.indexOf(b.Objective_Name));const selectedStrategies=U.optStrategies;
 const kpi=(label,value,unit,cls)=>`<div class="po218-kpi ${cls||''}"><span>${esc(label)}</span><b>${value==null||value===''?'—':esc(value)}</b>${unit?`<small>${esc(unit)}</small>`:''}<i><em></em><em></em><em></em><em></em><em></em></i></div>`;
 const scopeCount=rr.length;
 const feasible=result?result.feasibleCombinations:null,rejected=result?result.rejected:null;
 const candidates=result?result.candidates:null;
 const alternatives=result?.alternatives||[];
 const selectedPlanId=U.selectedAlternative||'baseline';const selectedAlt=alternatives.find(x=>x.id===selectedPlanId)||null;const recommendedName=selectedAlt?.name||'Baseline Plan';U.planGovernance.selected=recommendedName;
 const bestGeneratedAlt=(alternatives||[]).slice().sort((a,b)=>{
   const sa=Number(a?.metrics?.governedScore??a?.metrics?.score??Infinity);
   const sb=Number(b?.metrics?.governedScore??b?.metrics?.score??Infinity);
   return sa-sb;
 })[0]||null;
 const improvement=bestGeneratedAlt?.metrics?.improvementLabel||(result?'No optimizer improvement found':'—');
 const bestMetrics=bestGeneratedAlt?.metrics||{};
 const baselineMetrics=result?.baselineMetrics||{};
 const bestObjective=bestGeneratedAlt?.objective||selectedStrategies[0]||'';
 let bestOutcomeValue='—',bestOutcomeUnit='Run optimization';
 if(result){
   if(!bestGeneratedAlt){bestOutcomeValue='No alternative';bestOutcomeUnit=result.status==='No Eligible Movable Interventions'?'No movable population':'No feasible optimized plan'}
   else if(bestObjective==='Lowest Execution Cost'){
     const d=Number(bestMetrics.costDeltaINR||0);bestOutcomeValue=d<0?money(Math.abs(d)):(Math.abs(d)<1?'No reduction':money(Math.abs(d)));bestOutcomeUnit=d<0?'Lower execution cost vs baseline':(Math.abs(d)<1?'Baseline already lowest feasible cost':'Additional cost required for feasibility');
   }else if(bestObjective==='Earliest Completion'){
     const bd=baselineMetrics.completion?new Date(baselineMetrics.completion):null,ad=bestMetrics.completion?new Date(bestMetrics.completion):null,days=(bd&&ad)?(bd-ad)/86400000:0;bestOutcomeValue=days>0.01?`${Number(days.toFixed(1))} days`:'No earlier date';bestOutcomeUnit=days>0.01?'Earlier completion vs baseline':'Baseline already earliest feasible';
   }else if(bestObjective==='Resource Efficiency'){
     const pp=Number(baselineMetrics.peakResourceUtilizationPct||0)-Number(bestMetrics.peakResourceUtilizationPct||0),burden=Number(baselineMetrics.resourceBurdenScore||0)-Number(bestMetrics.resourceBurdenScore||0);bestOutcomeValue=pp>0.1?`${Number(pp.toFixed(1))} pp`:(burden>0.001?Number(burden.toFixed(2)):'No reduction');bestOutcomeUnit=pp>0.1?'Lower peak resource utilization':(burden>0.001?'Lower resource capacity burden':'No resource-loading improvement');
   }else if(bestObjective==='Minimum Schedule Change'){
     bestOutcomeValue=bestMetrics.movementLabel||'0 days';bestOutcomeUnit=Number(bestMetrics.movementHours||0)>0?'Minimum aggregate movement required':'Baseline timing retained';
   }else{
     bestOutcomeValue='Best feasible';bestOutcomeUnit='Balanced governed outcome';
   }
 }
 const optimizationScopeValue=result?`${feasible??0} / ${candidates??0}`:'—';
 const persistentOptStatus471=result?(()=>{
   let kind='success',text='';
   if(result.status==='No Eligible Movable Interventions'){
     kind='info';
     text='Optimization completed · No eligible movable interventions in the selected planning scope.';
   }else if(result.status==='Infeasible'){
     kind='info';
     text=`Optimization completed · No feasible optimized alternative generated.`;
   }else{
     const validated=result.validationStatus==='AIP Independently Validated'?' · Feasibility verified':'';
     text=`Optimization completed successfully · ${alternatives.length} unique alternative${alternatives.length===1?'':'s'} generated${validated}.`;
   }
   return `<div class="aip463-opt-status ${kind} po471-persistent-opt-status">${esc(text)}</div>`;
 })():'';
 const funnel=result?`<div class="po218-funnel">${[
   ['Interventions',result.interventions,'blue'],['Resource & Schedule Options',result.candidates,'teal'],['Constraint Exclusions',result.rejected,'red'],['Executable Options',result.feasibleCombinations,'green'],['Schedule Alternatives',alternatives.length,'purple']
 ].map((x,i)=>`${i?'<span class="po218-arr">›</span>':''}<button class="po218-stage ${x[2]}" onclick="planOptStage('${esc(x[0])}')"><span>${esc(x[0])}</span><b>${esc(x[1])}</b><i class="po218-drill">↗</i></button>`).join('')}</div>`:'<div class="po218-empty">—</div>';
 const changes=selectedAlt?.changes||[];
 const altCols=[{id:'baseline',name:'Baseline Plan',metrics:result?.baselineMetrics||{}},...alternatives];
 const metricRows=[['Plan completion','completionLabel'],['Required Completion breaches','dueBreaches'],['Resource conflicts','resourceConflicts'],['Peak resource utilization','peakResourceUtilizationLabel'],['Resource capacity burden','resourceBurdenScoreLabel'],['Constrained resource slots','constrainedResourceSlots'],['Crew hours','crewHours'],['Overtime hours','overtimeHours'],['Execution cost','executionCostLabel'],['Cost delta vs baseline','costDeltaLabel'],['Aggregate schedule movement','movementLabel'],['Forced baseline moves','forcedBaselineMoves'],['Hard constraint violations','hardViolations']];
 const ve=sel?veSummary(sel.Intervention_ID):null;
 return `${head()}<div class="po218-shell">
 <section class="po218-section optimize"><div class="po218-sectionhead"><h2>OPTIMIZE</h2></div>
  <section class="po218-panel"><div class="po218-title"><h3>Baseline Plan & Optimization</h3></div><div class="po218-controls po246-context-controls">
   <label class="po246-locked-control"><span>Planning Basis</span><span class="po246-lockedbox"><b>Baseline Plan</b><i>LOCKED</i></span></label>
   <label class="po246-locked-control"><span>Planning Horizon</span><span class="po246-lockedbox"><b>${esc(U.horizon==='custom'?'Custom':String(U.horizon)+' days')}</b><i>LOCKED</i></span></label>
   <label class="po246-locked-control"><span>Interventions in Scope</span><span class="po246-lockedbox"><b>${esc(scopeCount)}</b><i>LOCKED</i></span></label>
   <label class="po247-engine">Optimization Engine<select onchange="planSetSolver(this.value)"><option ${U.solver==='AIP Built-in Optimizer'?'selected':''}>AIP Built-in Optimizer</option><option ${U.solver==='External Optimization Solver'?'selected':''}>External Optimization Solver</option></select></label>
   <button class="po-btn po-v235-baseline-btn po247-baseline-action" onclick="planViewBaselineSchedule()"><span>View Baseline Schedule</span><span class="po-v123-mini-icon po257-baseline-icon" aria-hidden="true">↗</span></button>
   <button class="po-btn primary po247-run-action" ${(selectedStrategies.length&&!U.recommendationLocked)?'':'disabled'} onclick="AIPRunOptimizerV467(event)">Run Optimization</button>
  </div>
  <div class="po246-strategy-wrap"><div class="po246-strategy-head"><div><b>Optimization Strategies</b><span class="po250-strategy-instruction">Select at least one optimization strategy and maximum up to three per run.</span></div><strong class="po250-strategy-count">${selectedStrategies.length} of 3 selected</strong></div><div class="po246-strategy-grid">${strategyOptions.map(x=>{const checked=selectedStrategies.includes(x.Objective_Name),blocked=!checked&&selectedStrategies.length>=3;return `<label class="po246-strategy ${checked?'selected':''} ${blocked?'blocked':''}"><input type="checkbox" ${checked?'checked':''} ${blocked?'disabled':''} onchange="planToggleOptStrategy('${esc(x.Objective_Name)}',this.checked)"><span><b>${esc(x.Objective_Name)}</b></span></label>`}).join('')}</div></div>
  <div class="po673-method-strip"><div class="po673-method-copy"><b>Optimization Method:</b> Native MILP-based constraint-aware optimization evaluates feasible schedules across completion, execution cost, resource efficiency and schedule stability.</div><details class="po673-method-details"><summary>Method details <span aria-hidden="true">ⓘ</span></summary><div class="po673-method-panel"><button type="button" class="po675-method-close" aria-label="Close method details" title="Close" onclick="this.closest('details').removeAttribute('open')">×</button><b>Solver Architecture:</b> AIP uses a native Mixed-Integer Linear Programming (MILP) engine for governed maintenance scheduling. The native solver uses LP relaxation with two-phase Simplex and Branch-and-Bound for integer/binary scheduling decisions, together with constraint and solution validation. It evaluates resource capacity, skills, availability, timing, precedence and other governed scheduling constraints against the selected optimization objective. For larger or more computationally complex problems—such as multi-site routing, travel and mobilization sequencing, complex crew routing, vehicle/tool routing, highly coupled outage scheduling, or very large scheduling populations—AIP can integrate an external mathematical optimization solver through the governed solver interface where scale or complexity warrants it.</div></details></div>
  ${persistentOptStatus471}
  </section>
  <div class="po218-kpis po468-kpis">${kpi('Optimization Scope',optimizationScopeValue,result?'Executable / assessed':'','k1')}${kpi('Constraint Exclusions',rejected,result?'Hard constraints':'','k3')}${kpi('Best Outcome',bestOutcomeValue,bestOutcomeUnit,'k4 po468-best-outcome')}</div>
  <section class="po218-panel"><div class="po218-title"><h3>Schedule Alternatives</h3></div>${result?`<div class="po-table-wrap"><table class="po-table"><thead><tr><th>Measure</th>${altCols.map(a=>`<th>${esc(a.name)}</th>`).join('')}</tr></thead><tbody>${metricRows.map(m=>`<tr><td><b>${esc(m[0])}</b></td>${altCols.map(a=>`<td>${esc(a.metrics?.[m[1]]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="po218-empty">—</div>'}</section>
  <section class="po218-panel po263-value-evidence"><div class="po218-title"><h3>Evidence</h3>${sel?`<button class="po218-circle" onclick="planOpenValueExposure('${esc(sel.Intervention_ID)}',event)">↗</button>`:''}</div>${ve?`<div class="po263-value-strip"><div><span>Current Plan Exposure</span><b>${money(ve.Value_Exposure_AsOf_INR)}</b></div><div><span>Cost of Delay as of +7 days</span><b>${ve.COD_AsOf_to_Plus7D_INR!=null?money(ve.COD_AsOf_to_Plus7D_INR):'—'}</b></div><div><span>Selected Intervention</span><b>${esc(sel.Intervention_ID)}</b></div></div>`:'<div class="po218-empty">—</div>'}</section>
  <section class="po218-panel po245-recommend"><div class="po218-title"><h3>Recommended Plan</h3>${result?`<div class="po265-recommend-actions"><select class="po218-inline-select" ${U.recommendationLocked?'disabled':''} onchange="U.selectedAlternative=this.value;U.planGovernance.status='Draft';render()"><option value="baseline" ${!selectedAlt?'selected':''}>Retain Baseline</option>${alternatives.map(a=>`<option value="${esc(a.id)}" ${selectedAlt?.id===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select><button class="po-btn po265-submit-gov" ${U.recommendationLocked?'disabled':''} onclick="planSubmitRecommendationForGovernance()">Submit for Governance</button></div>`:''}</div>
   ${selectedAlt&&changes.length?`<div class="po-table-wrap po263-selected-changes"><table class="po-table"><thead><tr><th>Intervention</th><th>Baseline Start</th><th>Proposed Start</th><th>Change</th><th>Primary Reason</th><th>Resource Change</th><th></th></tr></thead><tbody>${changes.map(c=>`<tr><td><b>${esc(c.id)}</b></td><td>${esc(c.baseline)}</td><td>${esc(c.recommended)}</td><td>${esc(c.change)}</td><td>${esc(c.reason)}</td><td>${esc(c.resourceChange||'—')}</td><td><button class="po218-circle" onclick="planViewAlternative('${esc(selectedAlt.id)}','${esc(c.id)}')">↗</button></td></tr>`).join('')}</tbody></table></div>`:''}
  </section>
 </section>
 <section class="po218-section govern"><div class="po218-sectionhead"><h2>GOVERN</h2></div>
  <section class="po218-panel po263-governance"><div class="po218-title"><h3>Governance Decision</h3><span class="po263-gov-status ${String(U.planGovernance.status).toLowerCase().replaceAll(' ','-')}">${esc(U.planGovernance.status)}</span></div><div class="po218-controls po263-govern-controls">
   <label><select id="po218Decision" ${U.recommendationLocked?'':'disabled'}><option>Approve Recommended Plan</option><option>Approve with Conditions</option><option>Return for Re-optimization</option></select></label>
   <button class="po-btn primary po265-apply-decision" ${U.recommendationLocked?'':'disabled'} onclick="planGovernSelected(document.getElementById('po218Decision').value)">Apply Decision</button>
  </div></section>
  ${['Approved','Approved with Conditions'].includes(U.planGovernance.status)?`<details class="po218-panel po218-lineage"><summary>Run & Model Lineage</summary>${detailRows([['Run ID',result?.runId||'—'],['Engine',result?.solver||U.solver],['Model / Solver Version',result?.model||'—'],['Strategy Profile',result?.objectiveName||selectedStrategies.join(' · ')],['Balanced Weights',(result?.selectedStrategies||selectedStrategies).includes('Balanced')?balancedProfile:'—'],['Data Mode',result?.mode||mode()],['Validation Status',result?.validationStatus||'—'],['Request / Run Timestamp',result?.runAt?planFmtDateTime(new Date(result.runAt)):'—']])}</details>`:''}
  ${/^Approved/.test(U.planGovernance.status)?`<section class="po218-panel po218-handoff"><div class="po218-title"><h3>Approved for Execution Handoff</h3><button class="po-btn" onclick="planTrackExecution()">Track Execution <i class="po218-round">↗</i></button></div></section>`:''}
 </section></div>`;
}
function makeAlternatives(r){
 return candidateDates104(r).map((d,i)=>{const st=d.toISOString().slice(0,10)+' 08:00',c=constraintCheck(r,st);return {name:`Candidate ${i+1}`,date:d,feasible:c.feasible,value:veValueAt(r,d),readiness:c.feasible?100:n(r.readiness.Overall_Readiness_Pct)}})
}
function alternativeCompare(a){
 return `<div class="po-compare"><div class="head">Candidate</div>${a.map(x=>`<div class="head">${esc(x.name)}<br><span style="font-weight:400">${fmtDate(x.date)}</span></div>`).join('')}<div>Feasibility</div>${a.map(x=>`<div>${x.feasible?'Feasible':'Rejected'}</div>`).join('')}<div>Value exposure</div>${a.map(x=>`<div>${money(x.value)}</div>`).join('')}</div>`;
}
function candidateDates(r){return candidateDates104(r)}
function optInterventionCost(r){
 const governed=sheet('PNO_Intervention_Cost_Basis').find(x=>String(x.Intervention_ID)===String(r.Intervention_ID));if(governed&&n(governed.Total_Execution_Cost_INR)>0)return n(governed.Total_Execution_Cost_INR);
 const direct=n(r.Estimated_Cost_INR||r.Estimated_Cost);if(direct>0)return direct;
 const wo=sheet('Work Orders').find(x=>String(x.Work_Order_ID)===String(r.Work_Order_ID));if(wo)return n(wo.Estimated_Cost_INR||wo.Estimated_Cost);
 const po=sheet('PNO_Optimization').find(x=>String(x.Intervention_ID)===String(r.Intervention_ID));return n(po?.Estimated_Cost_INR);
}
function optBalancedWeights(){
 const rows=sheet('PNO_Optimization_Objectives').filter(x=>['Earliest Completion','Lowest Execution Cost','Resource Efficiency','Minimum Schedule Change'].includes(x.Objective_Name)&&String(x.Governance_Status||'').toLowerCase()==='approved');
 const total=rows.reduce((s,x)=>s+n(x.Weight),0)||rows.length||1,map={};rows.forEach(x=>map[x.Objective_Name]=n(x.Weight)/total);
 return {completion:map['Earliest Completion']||0,cost:map['Lowest Execution Cost']||0,conflicts:map['Resource Efficiency']||0,stability:map['Minimum Schedule Change']||0};
}
async function solve(input){
 const data=(input||[]).filter(Boolean),requested=(Array.isArray(U.optStrategies)?U.optStrategies:[]).filter((x,i,a)=>['Balanced','Earliest Completion','Lowest Execution Cost','Resource Efficiency','Minimum Schedule Change'].includes(x)&&a.indexOf(x)===i).slice(0,3),alternatives=[],suppressedStrategies=[];
 const dayKey=v=>{const d=new Date(String(v).replace(' ','T'));return Number.isFinite(+d)?d.toISOString().slice(0,10):String(v).slice(0,10)};
 const __resourceRows=sheet('PLAN_Resource_Calendar'),__calendarRows=sheet('PLAN_Calendar'),__weatherRows=sheet('PLAN_Weather_Forecast');
 const __resMap=new Map(),__calMap=new Map(),__wxMap=new Map(),__techMap=new Map(sheet('PNO_Technician_Skills').map(x=>[String(x.Technician_ID),x])),__legacyTechMap=new Map(sheet('Crew & Skills').map(x=>[String(x.Technician_ID),x])),__crewMap=new Map(sheet('PNO_Crew_Rates').map(x=>[String(x.Crew_ID),x])),__rcmMap=new Map(sheet('PLAN_RCM_Context').map(x=>[String(x.Intervention_ID),x]));
 __resourceRows.forEach(x=>{const k=String(x.Resource_ID)+'|'+dayKey(x.Start);if(!__resMap.has(k))__resMap.set(k,[]);__resMap.get(k).push(x)});__calendarRows.forEach(x=>{const k=String(x.Reference_ID)+'|'+dayKey(x.Start);if(!__calMap.has(k))__calMap.set(k,[]);__calMap.get(k).push(x)});__weatherRows.forEach(x=>{const k=String(x.Plant_ID)+'|'+dayKey(x.Valid_From);if(!__wxMap.has(k))__wxMap.set(k,x)});
 const techFor=r=>__techMap.get(String(r.schedule?.Technician_ID||''))||{};const crewFor=r=>__crewMap.get(String(r.schedule?.Crew_ID||''))||{};
 const fastConstraintCheck=(r,startStr)=>{const date=String(startStr).slice(0,10),issues=[],soft=[],evidence=[],st=r.readiness||{},tid=String(r.schedule?.Technician_ID||''),techLegacy=__legacyTechMap.get(tid)||{},techGov=__techMap.get(tid)||{},tech={...techGov,...techLegacy,Certification_Expiry:techLegacy.Certification_Expiry||techGov.Valid_To},rcm=__rcmMap.get(String(r.Intervention_ID))||{};const re=(__resMap.get(tid+'|'+date)||[])[0],pe=(__calMap.get(tid+'|'+date)||[])[0];if(re){evidence.push(['Crew',`${re.Availability} · ${n(re.Available_Hours)-n(re.Committed_Hours)}h free`,re.Availability==='Unavailable'?'hard':re.Availability==='Partial'?'soft':'ready']);if(re.Availability==='Unavailable')issues.push(`Crew ${tid} unavailable: ${re.Reason}`);if(re.Availability==='Partial'&&n(re.Available_Hours)-n(re.Committed_Hours)<n(r.Duration_Hours))issues.push(`Crew capacity ${n(re.Available_Hours)-n(re.Committed_Hours)}h is below ${r.Duration_Hours}h requirement`)}else if(pe){evidence.push(['Crew',`${pe.Event_Type} · ${pe.Availability}`,pe.Availability==='Unavailable'?'hard':'soft']);if(pe.Availability==='Unavailable')issues.push(`Crew ${tid} unavailable: ${pe.Reason}`)}else evidence.push(['Crew',`${tech.Availability_Status||tech.Availability||'Roster available'} · governed roster`,'ready']);if(tech.Certification_Expiry&&tech.Certification_Expiry<date){issues.push(`Certification expired ${tech.Certification_Expiry}`);evidence.push(['Certification',`Expired ${tech.Certification_Expiry}`,'hard'])}else evidence.push(['Certification',tech.Certification_Expiry?`Valid to ${tech.Certification_Expiry}`:'No expiry evidence','ready']);if(st.Material_Status!=='Ready'&&(!st.Material_Earliest_Receipt||st.Material_Earliest_Receipt>date))issues.push(`Part ${r.Required_Part_ID} unavailable by ${date}`);evidence.push(['Material',st.Material_Status==='Ready'?`${r.Required_Part_ID} ready`:`${r.Required_Part_ID} · ${st.Material_Earliest_Receipt||'no receipt date'}`,st.Material_Status==='Ready'?'ready':'hard']);if(st.Tool_Status!=='Ready')issues.push(`Required tool ${r.Required_Tool_ID} unavailable`);evidence.push(['Tool',`${r.Required_Tool_ID} · ${st.Tool_Status}`,st.Tool_Status==='Ready'?'ready':'hard']);if(st.Vehicle_Status!=='Ready')issues.push(`Compatible ${r.Vehicle_Class} unavailable`);evidence.push(['Vehicle',`${r.schedule.Vehicle_ID||r.Vehicle_Class} · ${st.Vehicle_Status}`,st.Vehicle_Status==='Ready'?'ready':'hard']);const wx=__wxMap.get(String(r.Plant_ID)+'|'+date);if(wx){const wblock=wx.Lightning_Risk==='High'||wx.Outdoor_Electrical_Status==='Blocked'||wx.Access_Status==='Constrained';if(wblock)issues.push(`Weather gate: ${wx.Rain_Probability_Pct}% rain · ${wx.Lightning_Risk} lightning · access ${wx.Access_Status}`);else if(wx.Lightning_Risk==='Medium'||wx.Outdoor_Electrical_Status==='Constrained')soft.push(`Weather attention: ${wx.Rain_Probability_Pct}% rain · ${wx.Lightning_Risk} lightning`);evidence.push(['Weather',`${wx.Rain_Probability_Pct}% rain · ${wx.Wind_kmh} km/h · lightning ${wx.Lightning_Risk}`,wblock?'hard':wx.Lightning_Risk==='Medium'?'soft':'ready'])}else{soft.push('No operational weather forecast for proposed date');evidence.push(['Weather','Forecast unavailable','soft'])}if(rcm.Deferral_Tolerance_Days!=null){const lim=new Date(String(r.Required_By).replace(' ','T'));lim.setDate(lim.getDate()+n(rcm.Deferral_Tolerance_Days));if(new Date(date+'T08:00:00')>lim)issues.push(`RCM deferral tolerance exceeded (${rcm.Deferral_Tolerance_Days} day limit)`);evidence.push(['RCM',`${rcm.Criticality||''} · RUL ${rcm.RUL_Days||'—'}d · deferral ${rcm.Deferral_Tolerance_Days}d`,new Date(date+'T08:00:00')>lim?'hard':'ready'])}if(new Date(date)>new Date(String(r.Required_By).slice(0,10)))soft.push('Proposed date is after required-by date');const win=(__calMap.get(String(r.Plant_ID)+'|'+date)||[]).some(x=>/window/i.test(String(x.Event_Type)));if(!win)soft.push('Not aligned to configured low-generation / outage opportunity window');return {hard:issues,soft,feasible:issues.length===0,evidence,weather:wx,rcm}};
 const candidateEconomics=(r,st,c)=>{
  const base=optInterventionCost(r),tech=techFor(r),crew=crewFor(r),qty=Math.max(1,n(r.Required_Crew_Qty)||1),dur=Math.max(0,n(r.Duration_Hours));
  const std=Math.max(1,n(tech.Standard_Hours_Day||crew.Standard_Hours_Day)||8),reg=Math.max(0,n(tech.Regular_Rate_INR_Hr)),ot=Math.max(reg,n(tech.Overtime_Rate_INR_Hr)||reg),hol=Math.max(reg,n(tech.Holiday_Rate_INR_Hr)||reg);
  const otHours=Math.max(0,dur-std)*qty,otPremium=otHours*Math.max(0,ot-reg);
  const dk=dayKey(st),holiday=__calendarRows.some(x=>dayKey(x.Start)===dk&&/holiday/i.test(String(x.Event_Type||''))&&(['Portfolio',r.Plant_ID,tech.Home_Site].includes(String(x.Reference_ID||''))||/regional|public/i.test(String(x.Event_Type||''))));
  const holidayHours=holiday?Math.min(dur,std)*qty:0,holidayPremium=holidayHours*Math.max(0,hol-reg);
  return {base,otHours,holidayHours,total:base+otPremium+holidayPremium,holiday};
 };
 const resourceBurden=(r,st,c)=>{
  const dk=dayKey(st),tid=String(r.schedule?.Technician_ID||''),events=__resMap.get(tid+'|'+dk)||[];
  const soft=(c.soft||[]).length;
  const load=events.length?events.reduce((m,x)=>Math.max(m,n(x.Available_Hours)>0?n(x.Committed_Hours)/n(x.Available_Hours):1),0):0;
  return {soft,load,score:soft*100+load*100,conflict:(soft>0||load>=1)?1:0};
 };
 const metricFor=(chosen)=>{
  const finishes=chosen.map(c=>new Date(+new Date(String(c.st).replace(' ','T'))+n(c.r.Duration_Hours)*3600000));
  const dueBreaches=chosen.filter(c=>new Date(+new Date(String(c.st).replace(' ','T'))+n(c.r.Duration_Hours)*3600000)>new Date(String(c.r.Required_By).replace(' ','T'))).length;
  const crewHours=chosen.reduce((s,c)=>s+n(c.r.Duration_Hours)*Math.max(1,n(c.r.Required_Crew_Qty)||1),0);
  const movementHours=chosen.reduce((s,c)=>s+Math.abs(new Date(String(c.st).replace(' ','T'))-new Date(String(c.r.schedule.Planned_Start||c.r.Planned_Start).replace(' ','T')))/3600000,0);
  const completion=finishes.length?new Date(Math.max(...finishes.map(x=>+x))):null;
  let executionCost=0,overtimeHours=0,resourceConflicts=0;
  chosen.forEach(c=>{const cc=c.c||constraintCheck(c.r,c.st),e=c.econ||candidateEconomics(c.r,c.st,cc),rb=c.rb||resourceBurden(c.r,c.st,cc);executionCost+=e.total;overtimeHours+=e.otHours;resourceConflicts+=rb.conflict});
  return {completion,completionLabel:completion?planFmtDateTime(completion):'—',dueBreaches,resourceConflicts,crewHours:Number(crewHours.toFixed(1)),overtimeHours:Number(overtimeHours.toFixed(1)),executionCost:Number(executionCost.toFixed(0)),executionCostLabel:executionCost?money(executionCost):'—',movementHours:Number(movementHours.toFixed(1)),movementLabel:movementHours?`${Number((movementHours/24).toFixed(1))} days`:'0 days',hardViolations:0};
 };
 const hardCheck=(r,st)=>{const c=fastConstraintCheck(r,st),hard=(c.hard||[]).filter(x=>!/Weather gate/i.test(String(x)));return {feasible:hard.length===0,hard,c}};
 const pool=new Map();let total=0,rejected=0,feas=0;
 for(const r of data){const base=new Date(String(r.schedule.Planned_Start||r.Planned_Start).replace(' ','T')),viable=[],__dates=candidateDates104(r);for(let __i=0;__i<__dates.length;__i++){const d=__dates[__i],st=d.toISOString().slice(0,10)+' 08:00';total++;const hc=hardCheck(r,st);if(hc.feasible){feas++;const econ=candidateEconomics(r,st,hc.c),rb=resourceBurden(r,st,hc.c);viable.push({r,st,c:hc.c,base,econ,rb})}else rejected++;if(__i%20===19)await new Promise(resolve=>setTimeout(resolve,0));}pool.set(r.Intervention_ID,viable);await new Promise(resolve=>setTimeout(resolve,0));}
 const choose=(r,name)=>{const base=new Date(String(r.schedule.Planned_Start||r.Planned_Start).replace(' ','T')),v=(pool.get(r.Intervention_ID)||[]).slice();if(!v.length)return null;
  const movement=x=>Math.abs(new Date(x.st)-base),completion=x=>+new Date(x.st)+n(r.Duration_Hours)*3600000;
  if(name==='Earliest Completion')return v.sort((a,b)=>completion(a)-completion(b)||movement(a)-movement(b))[0];
  if(name==='Lowest Execution Cost')return v.sort((a,b)=>a.econ.total-b.econ.total||movement(a)-movement(b)||completion(a)-completion(b))[0];
  if(name==='Resource Efficiency')return v.sort((a,b)=>a.rb.score-b.rb.score||movement(a)-movement(b)||completion(a)-completion(b))[0];
  if(name==='Minimum Schedule Change')return v.sort((a,b)=>movement(a)-movement(b)||completion(a)-completion(b))[0];
  if(name==='Balanced'){
   const w=optBalancedWeights(),times=v.map(x=>completion(x)),costs=v.map(x=>x.econ.total),burdens=v.map(x=>x.rb.score),moves=v.map(x=>movement(x));
   const norm=(val,arr)=>{const lo=Math.min(...arr),hi=Math.max(...arr);return hi===lo?0:(val-lo)/(hi-lo)};
   return v.map(c=>({c,score:(w.completion||.25)*norm(completion(c),times)+(w.cost||.25)*norm(c.econ.total,costs)+(w.conflicts||.25)*norm(c.rb.score,burdens)+(w.stability||.25)*norm(movement(c),moves)})).sort((a,b)=>a.score-b.score||movement(a.c)-movement(b.c))[0].c;
  }
  return v.sort((a,b)=>movement(a)-movement(b))[0];
 };
 const reasonFor=name=>name==='Earliest Completion'?'Earliest hard-feasible completion':name==='Lowest Execution Cost'?'Lowest governed execution cost':name==='Resource Efficiency'?'Lowest resource burden / conflict score':name==='Minimum Schedule Change'?'Minimum movement from baseline':'Lowest governed balanced score';
 const build=name=>{const chosen=[];data.forEach(r=>{const p=choose(r,name);if(p)chosen.push(p)});const metrics=metricFor(chosen);const changes=chosen.filter(c=>String(c.st).slice(0,16)!==String(c.r.schedule.Planned_Start||c.r.Planned_Start).slice(0,16)).map(c=>{const base=c.r.schedule.Planned_Start||c.r.Planned_Start,delta=Math.round((new Date(String(c.st).replace(' ','T'))-new Date(String(base).replace(' ','T')))/3600000);return {id:c.r.Intervention_ID,baseline:planFmtDateTime(new Date(String(base).replace(' ','T'))),recommended:planFmtDateTime(new Date(String(c.st).replace(' ','T'))),change:`${delta>0?'+':''}${delta} h`,reason:reasonFor(name),resourceChange:c.r.schedule.Crew_ID||c.r.schedule.Technician_ID||'—',st:c.st}});const basis=[{label:'Objective',value:name},{label:'Hard Constraint Violations',value:metrics.hardViolations},{label:'Required Completion Breaches',value:metrics.dueBreaches},{label:'Resource Conflicts',value:metrics.resourceConflicts},{label:'Execution Cost',value:metrics.executionCostLabel},{label:'Schedule Movement',value:metrics.movementLabel}];return {id:'ALT-'+String(alternatives.length+1).padStart(2,'0'),name:`Alternative ${alternatives.length+1} — ${name}`,objective:name,chosen,changes,metrics,basis}};
 const seenAlt=new Set();for(const x of requested){const a=build(x),sig=a.chosen.map(c=>`${c.r.Intervention_ID}:${String(c.st).slice(0,16)}`).sort().join('|');if(!sig||seenAlt.has(sig)){suppressedStrategies.push(x);await new Promise(resolve=>setTimeout(resolve,0));continue;}seenAlt.add(sig);alternatives.push(a);await new Promise(resolve=>setTimeout(resolve,0));}
 const baselineChosen=data.map(r=>{const st=r.schedule.Planned_Start||r.Planned_Start,c=constraintCheck(r,st);return {r,st,c,econ:candidateEconomics(r,st,c),rb:resourceBurden(r,st,c)}}),baselineMetrics=metricFor(baselineChosen);
 alternatives.forEach(a=>{const m=a.metrics,b=baselineMetrics;let label='No measurable improvement';if(a.objective==='Earliest Completion'&&m.completion&&b.completion){const h=(b.completion-m.completion)/3600000;label=h>0?`${Number((h/24).toFixed(1))} days earlier`:'No earlier completion'}else if(a.objective==='Lowest Execution Cost'){const saving=n(b.executionCost)-n(m.executionCost);label=saving>0?`${money(saving)} lower governed execution cost`:'Lowest feasible cost equals baseline'}else if(a.objective==='Resource Efficiency'){const d=n(b.resourceConflicts)-n(m.resourceConflicts);label=d>0?`${d} fewer resource conflicts`:'Lowest feasible resource burden selected'}else if(a.objective==='Minimum Schedule Change'){label=m.movementHours===0?'Baseline timing retained':`${Number((m.movementHours/24).toFixed(1))} movement days`}else if(a.objective==='Balanced'){const gains=[];if(n(b.dueBreaches)>n(m.dueBreaches))gains.push(`${n(b.dueBreaches)-n(m.dueBreaches)} fewer due-date breaches`);if(n(b.executionCost)>n(m.executionCost))gains.push(`${money(n(b.executionCost)-n(m.executionCost))} lower cost`);if(n(b.resourceConflicts)>n(m.resourceConflicts))gains.push(`${n(b.resourceConflicts)-n(m.resourceConflicts)} fewer conflicts`);if(n(b.movementHours)>n(m.movementHours))gains.push(`${Number(((b.movementHours-m.movementHours)/24).toFixed(1))} fewer movement days`);label=gains.slice(0,2).join(' · ')||'Lowest governed balanced score'}m.improvementLabel=label});
 const ts=new Date().toISOString(),rid='OPT-RUN-'+ts.replace(/[-:TZ.]/g,'').slice(0,17),best=alternatives[0]||null;
 return {runId:rid,status:alternatives.length?'Alternatives Available':'Infeasible',solver:U.solver==='External Optimization Solver'?'External Optimization Solver':'AIP Optimizer',interventions:data.length,candidates:total,rejected,feasibleCombinations:feas,alternatives,best,baselineMetrics,runAt:ts,model:U.solver==='External Optimization Solver'?'External solver interface':'AIP-MAINT-OPT',mode:mode(),selectedStrategies:requested.slice(),suppressedStrategies,objectiveName:requested.join(' · '),validationStatus:'AIP Validated'};
}
function optSummary(r){return `<div class="po-opt-status"><span class="po-pill ${r.status==='Optimal'?'ready':'risk'}">${esc(r.status)}</span><b>${esc(r.solver)}</b></div>${detailRows([['Optimization run',r.runId],['Model',r.model],['Data mode',r.mode],['Interventions',r.interventions],['Candidate assignments',r.candidates],['Hard rejected',r.rejected],['Feasible combinations',r.feasibleCombinations],['Run timestamp',r.runAt]])}${r.objective?`<div class="po-evidence-grid"><div class="po-evidence good"><b>Risk-lateness objective</b><span>${n(r.objective[0]).toFixed(1)}</span></div><div class="po-evidence good"><b>Lateness</b><span>${n(r.objective[1]).toFixed(1)} days</span></div><div class="po-evidence good"><b>Value exposure</b><span>${n(r.objective[2]).toFixed(1)} normalized</span></div><div class="po-evidence good"><b>Opportunity penalty</b><span>${n(r.objective[3]).toFixed(1)}</span></div></div>`:''}`;}
function findBestDate(r){for(const d of candidateDates(r)){if(constraintCheck(r,d.toISOString().slice(0,10)+' 08:00').feasible)return d}return new Date(String(r.schedule.Planned_Start||r.Planned_Start).replace(' ','T'))}
function externalSolverBanner(){const ints=sheet('PLAN_Interface_Catalogue').filter(x=>/optimization/i.test(x.Interface_Name));return `<div class="po-alert" style="margin-bottom:9px"><b>External solver interface provision selected.</b> ${ints.map(x=>x.Interface_ID+' · '+x.Status).join(' | ')}. This standalone demo does not call an external service; it exposes the governed request/response contract and requires explicit fallback selection if unavailable.</div>`}
function governanceFlow(r){
 const g=sheet('PLAN_Governance_Handoff').find(x=>x.Intervention_ID===r.Intervention_ID)||{};
 const stages=[['Recommended',g.Recommendation_Status],['Selected',g.Selection_Status],['Approved',g.Approval_Status],['Ready for ERP/EAM Handoff',g.Handoff_Status],['Acknowledgement',g.ERP_EAM_Acknowledgement]];
 return `<div class="po-flow">${stages.map((x,i)=>`${i?'<span class="po-arrow">→</span>':''}<div class="box"><b>${esc(x[0])}</b>${esc(x[1]||'Pending')}</div>`).join('')}</div>`;
}
function execution(){
 const fb=sheet('PLAN_Execution_Feedback'),packs=sheet('PLAN_Field_Packs'),r=selectedRow(),pack=packs.find(x=>x.Intervention_ID===r.Intervention_ID)||packs[0]||{};
 const vari=fb.slice(0,8);
 return `${head()}${toolbar(`<select class="po-select" onchange="planSelect(this.value,'execution')">${rows().map(x=>`<option value="${x.Intervention_ID}" ${x.Intervention_ID===r.Intervention_ID?'selected':''}>${x.Intervention_ID} · ${x.Asset_Tag}</option>`).join('')}</select>`)}
 <div class="po-grid">
  <section class="po-card s7"><div class="po-title"><h3>Execution flow</h3><span>approved → ERP/EAM scheduled → verified</span></div><div class="po-flow">${[['Approved',r.Planning_Status==='Approved'?'Completed':'Pending'],['ERP/EAM Scheduled',pack.ERP_EAM_WO_Status||'Awaiting'],['Released',pack.ERP_EAM_WO_Status==='Released'?'Completed':'Pending'],['Started','Awaiting'],['Completed','Awaiting'],['Effectiveness Verified','Awaiting']].map((x,i)=>`${i?'<span class="po-arrow">→</span>':''}<div class="box"><b>${x[0]}</b>${x[1]}</div>`).join('')}</div></section>
  <section class="po-card s5"><div class="po-title"><h3>Field readiness & execution pack</h3><span>${esc(pack.Field_Pack_ID||'No pack')}</span></div>${pack.Field_Pack_ID?detailRows([['Work order',pack.Work_Order_ID],['Checklist',pack.Checklist_ID],['Part',pack.Required_Part_ID],['Tool',pack.Required_Tool_ID],['Permit',pack.Permit_Status],['Manual',pack.Manual_Status],['AI Vision',pack.AI_Vision_Link],['Field readiness',pack.Field_Readiness]]):'<div class="po-alert">No field pack created for this intervention.</div>'}<div class="po-toolbar" style="margin-top:7px"><button class="po-btn" onclick="planOpenSource('${r.Intervention_ID}','wo')">Track Execution ↗</button><button class="po-btn" onclick="planOpenVision('${r.Asset_ID}')">AI Vision ↗</button></div></section>
  <section class="po-card s7"><div class="po-title"><h3>Plan vs actual · historical execution evidence</h3><span>${fb.length} governed feedback records</span></div><div class="po-table-wrap"><table class="po-table"><thead><tr><th>WO</th><th>Planned start</th><th>Actual start</th><th>Start variance</th><th>Duration variance</th><th>Conformance</th><th>Outcome</th></tr></thead><tbody>${vari.map(x=>`<tr><td>${esc(x.Work_Order_ID)}</td><td>${esc(x.Planned_Start)}</td><td>${esc(x.Actual_Start)}</td><td>${n(x.Date_Variance_Hours).toFixed(1)} h</td><td>${n(x.Duration_Variance_Pct).toFixed(1)}%</td><td><span class="po-pill ${x.Conformance_Status==='Within Tolerance'?'ready':'risk'}">${esc(x.Conformance_Status)}</span></td><td>${esc(x.Outcome_Status)}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="po-card s5"><div class="po-title"><h3>Execution evidence graph</h3><span>digital thread</span></div><div class="po-trace">${['Recommendation','Plan','Crew','Part','Field Inspection','AI Vision / Measurement','ERP/EAM Completion','Outcome','Reliability','Maintenance Learning'].map((x,i)=>`${i?'<span class="arrow">→</span>':''}<span class="node" onclick="planDependency('${x}')">${x}</span>`).join('')}</div></section>
 </div>`;
}
function candidateDates104(r){
 const arr=[],base=new Date(String(r.schedule.Planned_Start||r.Planned_Start).replace(' ','T')),req=new Date(String(r.Required_By).replace(' ','T')),rcm=sheet('PLAN_RCM_Context').find(x=>x.Intervention_ID===r.Intervention_ID)||{};
 const activeStart=asof(),activeEnd=planAddMonths(asof(),12),tol=Math.max(0,n(rcm.Deferral_Tolerance_Days));
 const end=new Date(Math.min(+activeEnd,+new Date(+req+tol*86400000)));
 for(let d=new Date(activeStart);d<=end;d.setDate(d.getDate()+1)){const x=new Date(d);x.setHours(8,0,0,0);arr.push(x)}
 arr.push(base,req);
 sheet('PLAN_Calendar').filter(x=>x.Reference_ID===r.Plant_ID&&/window/i.test(String(x.Event_Type))).forEach(x=>arr.push(new Date(String(x.Start).replace(' ','T'))));
 const seen=new Set();return arr.filter(d=>Number.isFinite(+d)&&d<=activeEnd).filter(d=>{const k=d.toISOString().slice(0,10);if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>a-b)
}
function causalGraph(r,result){const c=result.best?.chosen.find(x=>x.r.Intervention_ID===r.Intervention_ID)||result.best?.chosen[0],cc=c?.c||constraintCheck(r,c?.st||r.schedule.Planned_Start||r.Planned_Start),nodes=[['RCM',`${cc.rcm?.Criticality||'—'} · RUL ${cc.rcm?.RUL_Days||'—'}d`,'source'],['Weather',cc.weather?`${cc.weather.Rain_Probability_Pct}% rain · ${cc.weather.Lightning_Risk}`:'Unavailable',cc.weather?.Lightning_Risk==='High'?'hard':'ready'],['Resources',`${r.readiness.Overall_Readiness_Pct||0}% ready`,r.readiness.Overall_Status==='Ready'?'ready':'soft'],['Constraint engine',cc.feasible?'Feasible':'Blocked',cc.feasible?'ready':'hard'],['Optimizer',result.model,'opt'],['Recommended',c?.st||'No feasible assignment','opt']];return `<div class="po-reqgraph po-causal"><svg viewBox="0 0 900 260">${nodes.map((x,i)=>{const xx=20+i*145;return `${i?`<path d="M${xx-25},130 L${xx},130" stroke="#8da2af" marker-end="url(#rarr)"/>`:''}<g class="po-rnode ${x[2]}" onclick="planDependency('${esc(x[0])}')"><rect x="${xx}" y="105" width="120" height="52"></rect><text x="${xx+60}" y="124" text-anchor="middle">${esc(x[0])}</text><text class="sub" x="${xx+60}" y="142" text-anchor="middle">${esc(String(x[1]).slice(0,22))}</text></g>`}).join('')}</svg></div>`}
function render(){
 const v=document.getElementById('view-resourceplanning');if(!v)return;
 if(!['overview','resources','schedule','optimize'].includes(U.tab))U.tab='overview'; const html=U.tab==='overview'?overview():U.tab==='resources'?resources():U.tab==='schedule'?schedule():optimize();
 v.innerHTML=html;
}
window.AIPPlanningRuntime={
  runtimeNow:()=>planRuntimeNow(),
  dataMode:()=>mode(),
  fmtDateTime:(v)=>planFmtDateTime(v),
  fmtRuntimeDate:(d)=>planFmtRuntimeDate(d),
  money:(v)=>money(v),
  render:()=>render()
};
window.planSetTab=k=>{U.tab=k;render()};
window.planScheduleMode=v=>{U.scheduleMode=v==='changes'?'changes':'schedule';render()};
window.planScheduleZoom=delta=>{U.scheduleZoom=Math.max(0,Math.min(2,n(U.scheduleZoom)+n(delta)));render()};
window.planScheduleToggleSite=site=>{U.scheduleCollapsed=U.scheduleCollapsed||{};U.scheduleCollapsed[site]=!U.scheduleCollapsed[site];render()};
window.planScheduleCollapse=collapse=>{U.scheduleCollapsed=U.scheduleCollapsed||{};[...new Set(scopeRows().map(r=>r.Plant_ID))].forEach(s=>U.scheduleCollapsed[s]=!!collapse);render()};
window.planScheduleSelect=id=>{U.selected=id;render()};
window.planSetHorizon=v=>{U.horizon=v==='custom'?'custom':Number(v)||30;U.resourceCalendarMonth=0;render()};
window.planSetCustom=(k,v)=>{if(k==='from')U.customFrom=v;else U.customTo=v;U.horizon='custom';U.resourceCalendarMonth=0;render()};
window.planSetMeridiem=(k,mer)=>{const key=k==='from'?'customFrom':'customTo',fallback=k==='from'?planFmtRuntimeDate(planRuntimeNow()).replace(' ','T'):planFmtRuntimeDate(new Date(+planRuntimeNow()+30*86400000)).replace(' ','T'),v=U[key]||fallback,d=new Date(v);if(!Number.isFinite(+d))return;let h=d.getHours();if(mer==='PM'&&h<12)h+=12;if(mer==='AM'&&h>=12)h-=12;d.setHours(h);const z=n=>String(n).padStart(2,'0');U[key]=`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;U.horizon='custom';U.resourceCalendarMonth=0;render()};
window.planCloseCalendar=id=>{const el=document.getElementById(id);if(el)el.blur();if(document.activeElement&&document.activeElement.blur)document.activeElement.blur()};
window.planSetSite=v=>{U.site=v;render()};
window.planSelect=(id,tab)=>{U.selected=id;if(tab)U.tab=tab;render()};
window.planPreviewPriority=id=>{U.selected=id;U.tab='overview';render()};
window.planClearPrioritySelection=()=>{U.selected='';U.tab='overview';render()};
window.planOpenDependency=(id,kind)=>{
 const sc=document.scrollingElement||document.documentElement;
 window.AIP_PLAN_STATUS_RETURN={tab:'overview',selected:id,scrollY:sc?.scrollTop||window.scrollY||0};
 U.selected=id;
 const labels={crew:'Crew & skills',material:'Materials & spares',toolvehicle:'Tools / tackles & vehicle',accessoutage:'Execution prerequisites'};
 if(kind==='schedule'){U.tab='schedule';render();return}
 if(kind==='governance'){U.tab='optimize';render();return}
 U.tab='resources';render();
 const wanted=labels[kind];if(!wanted)return;
 setTimeout(()=>{const root=document.getElementById('view-resourceplanning');const h=[...root.querySelectorAll('h3')].find(x=>x.textContent.trim()===wanted);if(h){h.closest('.po-card')?.scrollIntoView({block:'center',behavior:'smooth'});const card=h.closest('.po-card');if(card){card.classList.add('po-v120-focus');setTimeout(()=>card.classList.remove('po-v120-focus'),1800)}}},40);
};
window.planOpenStage=key=>{const rr=scopeRows(true),G=planGateState(rr),s=G.stages.find(x=>x.key===key);if(!s)return;const rows=s.rows;planOpenDrawer('detail',`<h2>${esc(s.label)} · ${rows.length}</h2><div class="status-summary"><div class="status-mini"><span>Value exposure</span><b>${money(rows.reduce((a,r)=>a+n(r.Value_Exposure_INR),0))}</b></div></div>${tableHtml(rows,['Intervention_ID','Plant_ID','Asset_Tag','Required_By','Planning_Status'])}`);document.getElementById('planDrawer')?.classList.add('status-drawer')};
window.planOpenException=key=>{const rr=scopeRows(true),G=planGateState(rr),x=G.exceptions.find(e=>e.key===key);if(!x)return;const data=x.rows;const body=data.length?`<div class="po-table-wrap"><table class="po-table"><thead><tr><th>Intervention</th><th>Site / Asset</th><th>Required Completion By</th><th>Issue / blocker</th><th>Current status</th><th></th></tr></thead><tbody>${data.map(r=>`<tr><td><b>${esc(r.Intervention_ID)}</b><br>${esc(r.Intervention)}</td><td>${esc(r.Plant_ID)}<br>${esc(r.Asset_Tag)}</td><td>${fmtDate(r.Required_By)}</td><td><span class="po-reason">${esc(r.__planReason)}</span></td><td>${esc(r.Planning_Status)}</td><td><button class="po-btn po-open-drill" onclick="planOpenFromStatus('${r.Intervention_ID}')">Open ↗</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="po-good">No interventions are currently held at this transition.</div>';planOpenDrawer('detail',`<h2>${esc(x.label)} · ${data.length}</h2>${body}`);document.getElementById('planDrawer')?.classList.add('status-drawer')};
window.planOpenFromStatus=id=>{const sc=document.scrollingElement||document.documentElement;window.AIP_PLAN_STATUS_RETURN={tab:U.tab||'overview',selected:U.selected||null,scrollY:sc?.scrollTop||window.scrollY||0};planCloseDrawer();U.selected=id;U.tab='resources';render()};
window.planOpenConstraintType=type=>{const rr=scopeRows(true),label=type==='Outage'?'Outage Window':type,data=rr.filter(r=>String(r.readiness?.[type+'_Status']||'')!=='Ready');const body=data.length?`<div class="po-table-wrap"><table class="po-table"><thead><tr><th>Intervention</th><th>Site / Asset</th><th>Required Completion By</th><th>${esc(label)} status</th><th>Primary constraint</th><th></th></tr></thead><tbody>${data.map(r=>`<tr><td><b>${esc(r.Intervention_ID)}</b><br>${esc(r.Intervention)}</td><td>${esc(r.Plant_ID)}<br>${esc(r.Asset_Tag)}</td><td>${fmtDate(r.Required_By)}</td><td>${esc(r.readiness?.[type+'_Status']||'Review')}</td><td>${esc(String(r.readiness?.Primary_Constraint||'').replace(/\bOutage\b/g,'Outage Window'))}</td><td><button class="po-btn po-open-drill" onclick="planOpenFromStatus('${r.Intervention_ID}')">Open ↗</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="po-good">No unresolved '+esc(label)+' constraints in the current scope.</div>';planOpenDrawer('detail',`<h2>${esc(label)} Constraints · ${data.length}</h2>${body}`);document.getElementById('planDrawer')?.classList.add('status-drawer')};


window.planOpenAttentionRules=()=>{const M=planAttentionModel(scopeRows(true));const ruleRows=M.ruleCounts.map(x=>{const r=x.rule;let th=r.Threshold_Value+' '+r.Threshold_Unit;if(r.Rule_Type==='VALUE_EXPOSURE_PERCENTILE')th+=' · current cut '+money(M.valueCut);return `<tr><td><b>${esc(r.Rule_ID)}</b><br>${esc(r.Rule_Name)}</td><td>${esc(th)}</td><td>${esc(r.Evaluation_Basis)}</td><td class="num"><b>${x.count}</b></td></tr>`}).join('');planOpenDrawer('detail',`<h2 class="po-attention-drawer-title">Planning Attention Rules</h2><div class="po-table-wrap po-attention-compact-wrap"><table class="po-table po-attention-compact-table"><thead><tr><th>Governed rule</th><th>Threshold</th><th>Evaluation basis</th><th>Breaching interventions</th></tr></thead><tbody>${ruleRows}</tbody></table></div>`);};
window.planOpenAttentionWhy=id=>{const M=planAttentionModel(scopeRows(true)),r=M.eligible.find(x=>x.Intervention_ID===id);if(!r)return;const rows=r.__attention.map(b=>`<tr><td><b>${esc(b.id)}</b><br>${esc(b.name)}</td><td>${esc(b.actual)}</td><td>${esc(b.threshold)}</td><td>${esc(b.basis)}</td></tr>`).join('');planOpenDrawer('detail',`<h2>Why this intervention requires attention</h2><div class="po-attention-record-context"><b>${esc(r.Intervention_ID)} · ${esc(r.Asset_Tag)}</b><span>${esc(r.Intervention)}</span><strong class="po-attention-band ${r.__attentionSeverity.toLowerCase()}">${r.__attentionSeverity}</strong></div><div class="po-table-wrap po-attention-compact-wrap"><table class="po-table po-attention-compact-table"><thead><tr><th>Breached rule</th><th>Actual</th><th>Governed limit</th><th>Evaluation basis</th></tr></thead><tbody>${rows}</tbody></table></div>`);};
window.planFilterAllDueInterventions=(value)=>{const q=String(value||'').trim().toLowerCase();document.querySelectorAll('.po-attention-all-table tbody tr').forEach(tr=>{tr.style.display=!q||tr.textContent.toLowerCase().includes(q)?'':'none'});};
window.planOpenAllDueInterventions=()=>{const M=planAttentionModel(scopeRows(true));const body=M.eligible.slice().sort((a,b)=>new Date(a.Required_By)-new Date(b.Required_By)).map(r=>`<tr><td><b>${esc(r.Intervention_ID)}</b><br>${esc(r.Intervention)}</td><td>${esc(r.Plant_ID)}<br>${esc(r.Asset_Tag)}</td><td>${fmtDate(r.Required_By)}</td><td>${n(r.readiness?.Overall_Readiness_Pct).toFixed(0)}%</td><td>${r.__attention.length?`<button class="po-attention-why" onclick="planOpenAttentionWhy('${r.Intervention_ID}')">${r.__attentionSeverity} · ${r.__attention.length} rule${r.__attention.length===1?'':'s'} ↗</button>`:'<span class="po-pill ready">Within limits</span>'}</td><td>${money(r.Value_Exposure_INR)}</td></tr>`).join('');planOpenDrawer('detail',`<div class="po-attention-all-head"><h2 class="po-attention-drawer-title">All Interventions · Selected Planning Horizon: ${M.eligible.length}</h2><input class="po-attention-all-search" type="search" autocomplete="off" spellcheck="false" placeholder="Search all columns…" aria-label="Search all interventions" oninput="planFilterAllDueInterventions(this.value)"></div><div class="po-table-wrap po-attention-all-wrap"><table class="po-table po-attention-all-table"><thead><tr><th>Intervention</th><th>Site / Asset</th><th>Required Completion By</th><th>Readiness</th><th>Attention status</th><th>Value exposure</th></tr></thead><tbody>${body}</tbody></table></div>`);};

function veSummary(id){return sheet('VE_Exposure_Summary').find(x=>String(x.Intervention_ID)===String(id))||null}
function veComponentSource(id,comp){const a=sheet('VE_Intervention_Inputs').filter(x=>String(x.Intervention_ID)===String(id)&&String(x.Component_ID)===String(comp));return a[0]||{}}
function veValueAt(r,date){
 const s=veSummary(r?.Intervention_ID);if(!s)return n(r?.Value_Exposure_INR);
 const t=new Date(date),a=new Date(String(s.Calculation_As_Of).replace(' ','T')),req=new Date(String(s.Required_By).replace(' ','T'));
 const p7=new Date(+a+7*86400000),p14=new Date(+a+14*86400000),rq7=new Date(+req+7*86400000),rq30=new Date(+req+30*86400000);
 const pts=[[a,n(s.Value_Exposure_AsOf_INR)],[p7,n(s.VE_AsOf_Plus_7D_INR)],[p14,n(s.VE_AsOf_Plus_14D_INR)],[req,n(s.VE_At_Required_By_INR)],[rq7,n(s.VE_Required_By_Plus_7D_INR)],[rq30,n(s.VE_Required_By_Plus_30D_INR)]].sort((x,y)=>x[0]-y[0]);
 if(t<=pts[0][0])return pts[0][1];if(t>=pts.at(-1)[0])return pts.at(-1)[1];
 for(let i=1;i<pts.length;i++){if(t<=pts[i][0]){const [d0,v0]=pts[i-1],[d1,v1]=pts[i],q=(t-d0)/(d1-d0||1);return v0+(v1-v0)*q}}
 return n(s.Value_Exposure_AsOf_INR)
}
window.planOpenValueExposure=(id,ev)=>{
 try{ev?.stopPropagation?.()}catch(_){}
 const s=veSummary(id);if(!s)return planOpenDrawer('detail','<h2>Value Exposure</h2><div class="po-alert">No governed Value Exposure record is available for this intervention.</div>');
 const det=sheet('VE_Calculation_Detail').filter(x=>String(x.Intervention_ID)===String(id)&&String(x.Resolution_Point)==='AS_OF');
 const src=(c)=>veComponentSource(id,c);
 const addDays=(v,d)=>{const x=new Date(v);if(Number.isNaN(x.getTime()))return v;x.setDate(x.getDate()+d);return x;};
 const veFmt=(v)=>{const d=v instanceof Date?v:new Date(v);if(Number.isNaN(d.getTime()))return String(v||'—');const p=n=>String(n).padStart(2,'0');return `${p(d.getDate())}-${p(d.getMonth()+1)}-${String(d.getFullYear()).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}`;};
 const timeline=[
  ['As Of +7d',addDays(s.Calculation_As_Of,7),s.VE_AsOf_Plus_7D_INR],
  ['As Of +14d',addDays(s.Calculation_As_Of,14),s.VE_AsOf_Plus_14D_INR],
  ['Required Completion By',s.Required_By,s.VE_At_Required_By_INR],
  ['Required Completion By +7d',addDays(s.Required_By,7),s.VE_Required_By_Plus_7D_INR],
  ['Required Completion By +30d',addDays(s.Required_By,30),s.VE_Required_By_Plus_30D_INR]
 ];
 const body=`<h2>Value Exposure · ${esc(id)}</h2><div class="ve135-context"><span>Calculation As Of</span><b>${esc(veFmt(s.Calculation_As_Of))}</b><span>Required Completion By</span><b>${esc(veFmt(s.Required_By))}</b><span>Model</span><b>${esc(s.Model_Version||'VE-1.0')}</b></div>
 <div class="ve135-kpis"><div><span>Value Exposure As Of</span><b>${money(s.Value_Exposure_AsOf_INR)}</b></div><div><span>As Of → +7d Cost of Delay</span><b>${money(s.COD_AsOf_to_Plus7D_INR)}</b></div><div><span>As Of → Required Completion By</span><b>${money(s.COD_AsOf_to_RequiredBy_INR)}</b></div><div><span>Required Completion By → +7d</span><b>${money(s.COD_RequiredBy_to_Plus7D_INR)}</b></div></div>
 <h3>Exposure by resolution date</h3><div class="ve135-timeline">${timeline.map(x=>`<div><span>${esc(x[0])}</span><b>${money(x[2])}</b><small>${esc(veFmt(x[1]))}</small></div>`).join('')}</div>
 <h3>Component calculation · at Calculation As Of ${esc(veFmt(s.Calculation_As_Of))}</h3><div class="po-table-wrap"><table class="po-table ve135-table"><thead><tr><th>Component</th><th>Exposure</th><th>Source</th><th>Authority</th><th>Input status</th></tr></thead><tbody>${det.map(x=>{const q=src(x.Component_ID);return `<tr><td><b>${esc(x.Component_Name)}</b><br><small>${esc(x.Component_ID)}</small></td><td class="num">${money(x.Net_Exposure_INR)}</td><td>${esc(q.Source_System||'AIP calculation')}</td><td>${esc(q.Authority_Type||x.Authority||'Governed')}</td><td>${esc(q.Input_Status||x.Freshness_Status||'Current')}</td></tr>`}).join('')}</tbody></table></div>
 <div class="po-toolbar ve269-actions"><button class="po-btn" onclick="planOpenVERegistry('${esc(id)}')">Open all inputs & lineage</button><button class="po-btn" onclick="planOpenVERegistry('')">Value Exposure Input Registry</button></div>`;
 planOpenDrawer('detail',body);document.getElementById('planDrawer')?.classList.add('ve135-drawer');
};
window.planOpenVERegistry=(id='')=>{
 const ins=sheet('VE_Intervention_Inputs').filter(x=>!id||String(x.Intervention_ID)===String(id));const rates=sheet('VE_Rate_Config');
 const rows=ins.slice(0,id?120:80);const title=id?`Value Exposure Inputs & Lineage · ${esc(id)}`:'Value Exposure Input Registry';
 planOpenDrawer('detail',`<h2>${title}</h2><div class="ve135-status"><span>${ins.length} inputs</span><span>${ins.filter(x=>x.Input_Status==='Existing').length} existing/source</span><span>${ins.filter(x=>x.Input_Status==='Derived').length} derived</span><span>${ins.filter(x=>/Assumption/i.test(String(x.Input_Status))).length} governed assumptions</span><span>${ins.filter(x=>/Stale/i.test(String(x.Freshness_Status))).length} stale</span></div><div class="po-table-wrap"><table class="po-table ve135-table"><thead><tr><th>Intervention</th><th>Component</th><th>Parameter</th><th>Value / unit</th><th>Source</th><th>Authority</th><th>Status</th><th>As Of</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.Intervention_ID)}</td><td>${esc(x.Component_ID)}</td><td><b>${esc(x.Parameter_Name)}</b></td><td>${esc(x.Value)} ${esc(x.Unit)}</td><td>${esc(x.Source_System)}<br><small>${esc(x.Source_Record_ID)}</small></td><td>${esc(x.Authority_Type)}</td><td>${esc(x.Input_Status)} · ${esc(x.Freshness_Status)}</td><td>${esc(fmtDate(x.Calculation_As_Of))}</td></tr>`).join('')}</tbody></table></div><h3>Rate & factor registry · ${rates.length}</h3><div class="ve135-rate-note">Rates/factors carry source system, authority, effective dates, refresh timestamp and freshness status in Excel/Synthetic data.</div>`);document.getElementById('planDrawer')?.classList.add('ve135-drawer');
};
function valueExposureModelCard(sel){
 const inputs=sheet('VE_Intervention_Inputs'),rates=sheet('VE_Rate_Config'),cm=sheet('VE_Component_Master'),sum=veSummary(sel?.Intervention_ID);const stale=inputs.filter(x=>/Stale/i.test(String(x.Freshness_Status))).length,ass=inputs.filter(x=>/Assumption/i.test(String(x.Input_Status))).length,derived=inputs.filter(x=>x.Input_Status==='Derived').length,existing=inputs.filter(x=>x.Input_Status==='Existing').length;
 return `<section class="po-card s12 ve135-model-card"><div class="po-title"><h3>Enterprise Value Exposure Model</h3><span>VE-1.0 · Excel / Synthetic governed parity</span></div><div class="ve135-model-kpis"><div><span>Components</span><b>${cm.length}</b></div><div><span>Input records</span><b>${inputs.length}</b></div><div><span>Existing/source</span><b>${existing}</b></div><div><span>Derived</span><b>${derived}</b></div><div><span>Governed assumptions</span><b>${ass}</b></div><div><span>Stale</span><b>${stale}</b></div></div><div class="po-table-wrap"><table class="po-table ve135-model-table"><thead><tr><th>Component</th><th>Domain owner</th><th>Method</th><th>Authority</th><th>Time rule</th><th>Double-count check</th></tr></thead><tbody>${cm.map(x=>`<tr><td><b>${esc(x.Component_Name)}</b></td><td>${esc(x.Domain_Owner)}</td><td>${esc(x.Calculation_Method)}</td><td>${esc(x.Authority_Type)}</td><td>${esc(x.Time_Rule_ID)}</td><td>${esc(x.Double_Count_Check)}</td></tr>`).join('')}</tbody></table></div><div class="po-toolbar ve135-model-actions"><button class="po-btn" onclick="planOpenVERegistry('${esc(sel?.Intervention_ID||'')}')">Selected intervention inputs</button><button class="po-btn" onclick="planOpenVERegistry('')">Portfolio input registry</button>${sum?`<button class="po-btn primary" onclick="planOpenValueExposure('${esc(sel.Intervention_ID)}',event)">Open selected Value Exposure</button>`:''}<span>${rates.length} governed rates / factors</span></div></section>`;
}

window.planFilterStage=s=>window.planOpenStage?.(String(s||'').toLowerCase());
window.planShiftSelected=delta=>{const r=selectedRow();if(!r)return;const base=U.scenario[r.Intervention_ID]?.start||r.schedule.Planned_Start||r.Planned_Start;const d=new Date(String(base).replace(' ','T'));d.setDate(d.getDate()+delta);U.scenario[r.Intervention_ID]={start:d.toISOString().slice(0,10)+' 08:00',source:'User Simulation'};render()};
window.planClearScenario=id=>{delete U.scenario[id];render()};
window.planFindAlternative=id=>{const r=rows().find(x=>x.Intervention_ID===id);if(!r)return;const d=findBestDate(r);U.scenario[id]={start:d.toISOString().slice(0,10)+' 08:00',source:'AIP Feasible Alternative'};render()};
window.planViewBaselineSchedule=()=>{window.AIP_PLAN_BASELINE_RETURN={tab:'optimize',scrollY:window.scrollY||0};U.scheduleMode='schedule';U.tab='schedule';render();setTimeout(()=>document.querySelector('#view-resourceplanning')?.scrollTo?.({top:0,behavior:'smooth'}),0)};
window.planToggleOptStrategy=(name,checked)=>{
 try{
  const allowed=['Balanced','Earliest Completion','Lowest Execution Cost','Resource Efficiency','Minimum Schedule Change'];if(!allowed.includes(name))return;
  let arr=Array.isArray(U.optStrategies)?U.optStrategies.slice():[];arr=arr.filter((x,i,a)=>allowed.includes(x)&&a.indexOf(x)===i);
  if(checked&&!arr.includes(name)){if(arr.length>=3){U.optStrategyMessage='Maximum 3 strategies can be selected per run.';render();return;}arr.push(name)}
  if(!checked)arr=arr.filter(x=>x!==name);
  U.optStrategies=arr;U.optStrategyMessage=arr.length?'':'Select at least one optimization strategy.';U.optResult=null;U.selectedAlternative='baseline';U.planGovernance=U.planGovernance||{};U.planGovernance.selected='Baseline Plan';U.planGovernance.status='Draft';render();
 }catch(e){console.error('strategy selection',e)}
};
window.planRunOptimizer=()=>{
 if(U.recommendationLocked){
  alert('This recommendation is under governance. Return it for re-optimization before running the optimizer again.');
  return;
 }
 if(window.AIP_OPT_RUNNING)return;
 const selected=(Array.isArray(U.optStrategies)?U.optStrategies:[]).filter(Boolean).slice(0,3);if(!selected.length){U.optStrategyMessage='';alert('Select at least one optimization strategy before running optimization.');return;}
 const cleanup=()=>{window.AIP_OPT_RUNNING=false;document.body.classList.remove('aip-optimization-running');document.getElementById('aipOptimizationRunningOverlay')?.remove()};
 cleanup();
 window.AIP_OPT_RUNNING=true;document.body.classList.add('aip-optimization-running');
 const host=document.getElementById('view-resourceplanning');let ov=document.getElementById('aipOptimizationRunningOverlay');
 if(!ov&&host){ov=document.createElement('div');ov.id='aipOptimizationRunningOverlay';ov.className='aip-opt-running-overlay';ov.innerHTML=`<div class="aip-opt-running-card"><div class="aip-opt-spinner"></div><b>Optimization Engine is running</b><span>${selected.length} selected strateg${selected.length===1?'y':'ies'}</span></div>`;host.appendChild(ov)}
 const scoped=scopeRows();
 setTimeout(async ()=>{
  try{
   const result=await solve(scoped);
   U.optResult=result;
   U.selectedAlternative='baseline';U.planGovernance=U.planGovernance||{};U.planGovernance.selected='Baseline Plan';U.planGovernance.status='Draft';
  }catch(err){
   console.error('AIP optimization run failed',err);
  }finally{
   cleanup();
   try{render()}catch(err){console.error('AIP optimization render failed',err)}
  }
 },120);
};
window.planApplyOptimizedScenario=()=>{if(!U.optResult?.best)return;U.optResult.best.chosen.forEach(c=>U.scenario[c.r.Intervention_ID]={start:c.st,source:U.optResult.runId});U.tab='schedule';render()};
window.planOptStage=()=>{};
window.planSetSolver=v=>{U.solver=v;U.optResult=null;render()};
window.planDay=(day,id)=>{U.selected=id;const r=rows().find(x=>x.Intervention_ID===id),c=constraintCheck(r,day+' 08:00'),re=sheet('PLAN_Resource_Calendar').find(x=>x.Resource_ID===r.schedule.Technician_ID&&String(x.Start).slice(0,10)===day);planOpenDrawer('detail',`<h2>${esc(day)} · ${esc(r.Intervention_ID)}</h2><div class="po-evidence-grid">${c.evidence.map(e=>`<div class="po-evidence ${e[2]==='hard'?'risk':e[2]==='soft'?'warn':'good'}"><b>${esc(e[0])}</b><span>${esc(e[1])}</span></div>`).join('')}</div>${c.hard.length?`<h3>Blocking constraints</h3><div class="po-alert">${esc(c.hard.join(' · '))}</div>`:''}${c.soft.length?`<h3>Optimization penalties / attention</h3><div class="po-note">${esc(c.soft.join(' · '))}</div>`:''}<h3>Planner action</h3><div class="po-toolbar"><button class="po-btn" onclick="planFindAlternative('${id}')">Find feasible window</button><button class="po-btn" onclick="planSetTab('schedule');planCloseDrawer()">Open schedule</button></div>`)};
window.planDependency=x=>{const i=sheet('PLAN_Interface_Catalogue').filter(r=>[r.Source_System,r.Target_System,r.Data_Object,r.Interface_ID].some(v=>String(v).includes(x)));planOpenDrawer('detail',`<h2>Dependency evidence · ${esc(x)}</h2><div class="po-note">Relationships shown in Planning & Optimization are resolved from governed planning, source-master or interface records.</div>${i.length?tableHtml(i.slice(0,8),['Interface_ID','Interface_Name','Direction','Data_Object','Status','Last_Validated']):'<div class="po-good">Internal governed relationship. Open the selected planning record for exact lineage.</div>'}`)};
function tableHtml(data,cols){return `<div class="po-table-wrap"><table class="po-table"><thead><tr>${cols.map(c=>`<th>${esc(c.replaceAll('_',' '))}</th>`).join('')}</tr></thead><tbody>${data.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
window.planOpenDrawer=function(kind,html){
 const d=document.getElementById('planDrawer');if(!d)return;d.classList.add('open');
 if(html){d.querySelector('.body').innerHTML=html;return}
 if(kind==='operating'){
  const cfg=sheet('PLAN_Capability_Config'),sys=sheet('PLAN_System_Landscape'),ints=sheet('PLAN_Interface_Catalogue');
  d.classList.add('operating-drawer');d.querySelector('.body').innerHTML=`<h2>Planning & Execution Responsibility Matrix</h2>${tableHtml(cfg,['Capability','Ownership','Provider','Status'])}<h3>Configured system landscape</h3>${tableHtml(sys,['System_Name','System_Type','Configuration_Status','Connection_Method'])}<h3>Required interface register</h3>${tableHtml(ints,['Interface_ID','Interface_Name','Direction','Data_Object','Frequency','Status'])}`;
 }else if(kind==='optimization'){
  d.querySelector('.body').innerHTML=`<h2>Optimization Basis</h2>${tableHtml(sheet('PLAN_Optimization_Config'),['Parameter','Value','Unit','Priority','Governance_Basis'])}<div class="po-note">Built-in optimization is intentionally limited to a controlled demonstration scope in this standalone HTML. Production-scale optimization should use the same governed data contract through a backend/external solver service.</div>`;
 }
};
window.planCloseDrawer=()=>{const d=document.getElementById('planDrawer');d?.classList.remove('open','status-drawer','operating-drawer')};
window.planOpenTech=()=>{try{window.activate?.('integrations')}catch(_){document.querySelector('[data-view="integrations"]')?.click()}};

window.planOpenBlockingDependency=(id,key)=>{
 const map={Crew:'crew',Material:'material',Tool:'toolvehicle',Vehicle:'toolvehicle',Access:'accessoutage',Outage:'accessoutage'};
 window.planCloseDrawer?.();
 window.planOpenDependency(id,map[key]||'toolvehicle');
};
window.planAttemptExecution=id=>{
 const r=rows().find(x=>x.Intervention_ID===id);if(!r)return;
 const g=planExecutionGate(r);
 if(g.state==='blocked'){
  const names=g.blocking.map(x=>x.key), primary=names[0]||g.primary||'Dependency';
  planOpenDrawer('detail',`<div class="po-gate-popup blocked"><h2>Execution blocked</h2><div class="po-gate-status">⚠ ${esc(names.join(', ')||'Blocking dependency')}</div><p>This work order cannot be released or executed while a blocking dependency remains unresolved.</p><div class="po-gate-facts"><span>Intervention<b>${esc(r.Intervention_ID)}</b></span><span>Work order<b>${esc(r.Work_Order_ID||'—')}</b></span><span>Readiness checks<b>${g.passed.length}/6 passed · ${g.pct.toFixed(1)}%</b></span></div><div class="po-toolbar"><button class="po-btn po-btn-danger" onclick="planOpenBlockingDependency('${r.Intervention_ID}','${esc(primary)}')">Open Blocking Dependency ↗</button><button class="po-btn" onclick="planCloseDrawer()">Close</button></div></div>`);
  return false;
 }
 if(g.state==='conditional'){
  const names=g.amber.map(x=>x.key).join(', ');
  const ok=confirm(`Ready with Constraint — ${names||'non-blocking condition'}.\n\nExecution is permitted because no blocking dependency exists. Continue with the ERP/EAM handoff?`);
  if(!ok)return false;
 }
 window.AIP_PLAN_EXECUTION_STATE=window.AIP_PLAN_EXECUTION_STATE||{};
 window.AIP_PLAN_EXECUTION_STATE[id]={status:'Released for ERP/EAM execution',at:new Date().toISOString(),gate:g.state};
 planOpenDrawer('detail',`<div class="po-gate-popup ${g.state}"><h2>${g.state==='conditional'?'Execution permitted with constraint':'Execution permitted'}</h2><div class="po-gate-status">${g.state==='conditional'?'⚠':'✓'} ${g.state==='conditional'?'No blocking dependency · acknowledged non-blocking constraint':'All mandatory readiness checks passed'}</div><p>AIP has passed the execution gate. The governed handoff can proceed to the ERP/EAM work-order execution process.</p><div class="po-gate-facts"><span>Intervention<b>${esc(r.Intervention_ID)}</b></span><span>Work order<b>${esc(r.Work_Order_ID||'—')}</b></span><span>Gate<b>${esc(planGateText(g))}</b></span></div><div class="po-toolbar"><button class="po-btn" onclick="planOpenSource('${r.Intervention_ID}','wo')">Open ERP/EAM WO ↗</button><button class="po-btn" onclick="planCloseDrawer()">Close</button></div></div>`);
 return true;
};


window.PLAN_RESOURCE_COST_TAB=window.PLAN_RESOURCE_COST_TAB||'people';
function planCostFmt(v,unit=''){
 const x=Number(v);if(!Number.isFinite(x))return esc(v||'—');
 const z=Math.round(x).toLocaleString('en-IN');return unit==='INR'?`₹${z}`:unit==='INR_HR'?`₹${z}/h`:unit==='INR_DAY'?`₹${z}/day`:unit==='INR_KM'?`₹${z}/km`:unit==='PCT'?`${x.toFixed(0)}%`:`${z}${unit?` ${unit}`:''}`;
}
function planCostTable(rows,cols){
 return `<div class="po-table-wrap po-rcb-table-wrap"><table class="po-table po-rcb-table"><thead><tr>${cols.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${cols.map(c=>`<td>${typeof c[1]==='function'?c[1](r):esc(r[c[1]]??'—')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${cols.length}" class="po-note">No governed records in the current data mode.</td></tr>`}</tbody></table></div>`;
}
function planActualOemsFor(serviceId){
 const cls=serviceId==='EXT-INV-OEM'?['Inverter']:serviceId==='EXT-TRACKER'?['Tracker']:serviceId==='EXT-THERMO'?['Inverter','Transformer']:serviceId==='EXT-RELAY'?['Transformer']:['Transformer'];
 const oems=[...new Set(sheet('Asset Master').filter(a=>cls.includes(String(a.Asset_Class||''))).map(a=>String(a.OEM||'').trim()).filter(x=>x&&!/^generic/i.test(x)))];
 return oems.length?oems.join(' · '):'Rate not governed';
}
function planServiceClasses(serviceId){
 return serviceId==='EXT-INV-OEM'?'Inverter':serviceId==='EXT-TRACKER'?'Tracker':serviceId==='EXT-THERMO'?'Inverter · Transformer':serviceId==='EXT-RELAY'?'Transformer / protection':'Transformer / HV';
}
function planResourceCostBody(tab){
 const active=tab||window.PLAN_RESOURCE_COST_TAB||'people';window.PLAN_RESOURCE_COST_TAB=active;
 const tabs=[['people','People & Rates'],['vehicle','Vehicles & Equipment'],['material','Materials & Logistics'],['oem','OEM Services'],['site','Site Mobilization'],['rules','Cost Rules']];
 let body='';
 if(active==='people'){
   const data=sheet('PNO_Technician_Skills');
   body=planCostTable(data,[['Technician',r=>`${esc(r.Technician_ID)} · ${esc(r.Technician_Name)}`],['Crew','Crew_ID'],['Role','Role'],['Existing skill','Primary_Skill'],['Level','Skill_Level'],['Existing certification','Certification_or_Control'],['Valid to','Valid_To'],['Home site','Home_Site'],['Availability','Availability_Status'],['Shift','Default_Shift'],['Work days','Work_Days'],['Regular rate',r=>planCostFmt(r.Regular_Rate_INR_Hr,'INR_HR')],['Overtime',r=>planCostFmt(r.Overtime_Rate_INR_Hr,'INR_HR')],['Holiday',r=>planCostFmt(r.Holiday_Rate_INR_Hr,'INR_HR')],['OT eligible','OT_Eligible'],['Max OT/day',r=>`${esc(r.Max_OT_Hours_Day)} h`],['Max OT/week',r=>`${esc(r.Max_OT_Hours_Week)} h`],['Holiday work','Holiday_Work_Eligible'],['Travel','Travel_Eligible'],['Productivity',r=>Number(r.Productivity_Factor||0).toFixed(2)]]);
 }else if(active==='vehicle'){
   const vehicles=sheet('PNO_Vehicle_Mobilization');
   const equipmentRates=sheet('PNO_Equipment_Rates'),tools=new Map(sheet('PLAN_Tool_Master').map(x=>[x.Tool_ID,x]));
   const equip=equipmentRates.map(x=>({...x,_tool:tools.get(x.Equipment_ID)||{}}));
   body=`<h3>Vehicle commercial basis</h3>${planCostTable(vehicles,[['Existing vehicle class','Vehicle_Class'],['Variable rate',r=>planCostFmt(r.Variable_INR_Km,'INR_KM')],['Daily rate',r=>planCostFmt(r.Daily_Rate_INR,'INR_DAY')],['Mobilization',r=>planCostFmt(r.Mobilization_Fixed_INR,'INR')],['Included km/day','Included_Km_Day'],['Crew capacity','Crew_Capacity']])}<h3>Existing tools & equipment · rate attributes</h3>${planCostTable(equip,[['Existing tool / equipment',r=>`${esc(r.Equipment_ID)} · ${esc(r._tool.Tool_Name||r.Equipment_Name)}`],['Daily rate',r=>planCostFmt(r.Daily_Rate_INR,'INR_DAY')],['Hourly rate',r=>planCostFmt(r.Hourly_Rate_INR,'INR_HR')],['Mobilization',r=>planCostFmt(r.Mobilization_INR,'INR')],['Minimum days','Minimum_Days'],['Existing control',r=>esc(r._tool.Calibration_Status||r.Control||'—')]])}`;
 }else if(active==='material'){
   const parts=new Map(sheet('Spare Parts Master').map(x=>[x.Part_ID,x]));
   const data=sheet('PNO_Material_Cost_Logistics').map(x=>({...x,_part:parts.get(x.Material_ID)||{}}));
   body=planCostTable(data,[['Existing part',r=>`${esc(r.Material_ID)} · ${esc(r._part.Part_Name||r.Material_Description)}`],['Unit cost',r=>planCostFmt(r.Unit_Cost_INR,'INR')],['Standard freight',r=>planCostFmt(r.Standard_Freight_INR,'INR')],['Inter-site transfer',r=>planCostFmt(r.InterSite_Transfer_INR,'INR')],['Emergency expedite',r=>planCostFmt(r.Emergency_Expedite_Premium_INR,'INR')],['Receiving / handling',r=>planCostFmt(r.Receiving_Handling_INR,'INR')],['Lead time',r=>`${esc(r.Lead_Time_Days)} days`]]);
 }else if(active==='oem'){
   const data=sheet('PNO_External_Service_Rates');
   body=planCostTable(data,[['Service','Service_Name'],['Existing asset context',r=>esc(planServiceClasses(r.Service_ID))],['Applicable governed OEMs',r=>esc(planActualOemsFor(r.Service_ID))],['Day rate',r=>planCostFmt(r.Day_Rate_INR,'INR_DAY')],['Callout',r=>planCostFmt(r.Callout_INR,'INR')],['Travel allowance',r=>planCostFmt(r.Travel_Allowance_INR_Day,'INR_DAY')],['Minimum days','Minimum_Days'],['Required competency','Required_Competency']]);
 }else if(active==='site'){
   const sites=new Map(sheet('Sites').map(x=>[x.Plant_ID,x]));
   const serviceVan=sheet('PNO_Vehicle_Mobilization').find(x=>String(x.Vehicle_Class||'').toLowerCase()==='service van')||{};
   const kmRate=Number(serviceVan.Variable_INR_Km||0);
   const data=sheet('PNO_Site_Mobilization').map(x=>({...x,_site:sites.get(x.Plant_ID)||{},_vehicle:serviceVan,_derivedTravel:Number(x.Reference_Roundtrip_km||0)*kmRate}));
   body=planCostTable(data,[['Existing AIP site',r=>`${esc(r.Plant_ID)} · ${esc(r._site.Plant_Name||'')}`],['State',r=>esc(r._site.State||r.State)],['Reference round trip',r=>`${esc(r.Reference_Roundtrip_km)} km`],['Vehicle basis',r=>`${esc(r._vehicle.Vehicle_Class||'Service Van')} · ${planCostFmt(r._vehicle.Variable_INR_Km,'INR_KM')}`],['Derived travel',r=>planCostFmt(r._derivedTravel,'INR')],['Lodging / person / night',r=>planCostFmt(r.Lodging_INR_Person_Night,'INR')],['Per diem / person / day',r=>planCostFmt(r.Per_Diem_INR_Person_Day,'INR')],['Local transport / person / day',r=>planCostFmt(r.Local_Transport_INR_Person_Day,'INR')],['Work window','Normal_Work_Window']]);
 }else{
   const cfg=planCostTable(sheet('PNO_Optimization_Cost_Config'),[['Parameter','Parameter'],['Value / formula','Value_or_Formula'],['Unit / type','Unit_or_Type'],['Status','Governance_Status'],['Governance note','Governance_Note']]);
   const costs=sheet('PNO_Intervention_Cost_Basis');
   const costTable=planCostTable(costs,[['Intervention','Intervention_ID'],['Work order','Work_Order_ID'],['Site','Plant_ID'],['Asset class','Asset_Class'],['Labour',r=>planCostFmt(r.Labour_Cost_INR,'INR')],['Mobilization',r=>planCostFmt(r.Mobilization_Cost_INR,'INR')],['Vehicle',r=>planCostFmt(r.Vehicle_Cost_INR,'INR')],['Equipment',r=>planCostFmt(r.Equipment_Cost_INR,'INR')],['Material',r=>planCostFmt(r.Material_Cost_INR,'INR')],['Logistics',r=>planCostFmt(r.Logistics_Cost_INR,'INR')],['OEM / external',r=>planCostFmt(r.External_Service_Cost_INR,'INR')],['Execution cost',r=>`<b>${planCostFmt(r.Total_Execution_Cost_INR,'INR')}</b>`]]);
   body=`<h3>Governed cost rules</h3>${cfg}<h3>Intervention execution-cost build-up</h3>${costTable}`;
 }
 return `<div class="po-rcb"><div class="po-rcb-head"><div><h2>Resource &amp; Cost Basis</h2></div></div><div class="po-rcb-tabs">${tabs.map(([k,l])=>`<button class="${active===k?'active':''}" onclick="planOpenResourceCostBasis('${k}')">${l}</button>`).join('')}</div><div class="po-rcb-body">${body}</div></div>`;
}
window.planOpenResourceCostBasis=tab=>{window.PLAN_RESOURCE_COST_TAB=tab||'people';planOpenDrawer('detail',planResourceCostBody(window.PLAN_RESOURCE_COST_TAB));};
window.planTrackExecution=()=>{
 const r=selectedRow();if(!r)return;
 window.AIP_CONTEXT_NAV={source:'Planning & Optimization · Approved Plan',interventionId:r.Intervention_ID,workOrderId:r.Work_Order_ID,assetId:r.Asset_ID,plantId:r.Plant_ID,target:'workorderintelligence',executionHandoff:true};
 try{window.activate?.('workorderintelligence')}catch(_){document.querySelector('[data-view="workorderintelligence"]')?.click()}
};
window.planOpenSource=(id,type)=>{const r=rows().find(x=>x.Intervention_ID===id);window.AIP_CONTEXT_NAV={source:'Planning & Optimization',interventionId:id,workOrderId:r?.Work_Order_ID,assetId:r?.Asset_ID,plantId:r?.Plant_ID,target:type==='wo'?'workorderintelligence':'assetexplorer'};try{window.activate?.(type==='wo'?'workorderintelligence':'assetexplorer')}catch(_){document.querySelector(`[data-view="${type==='wo'?'workorderintelligence':'assetexplorer'}"]`)?.click()}};
window.planOpenVision=asset=>{window.AIP_CONTEXT_NAV={source:'Planning & Optimization',assetId:asset,target:'aivision'};try{window.activate?.('aivision')}catch(_){document.querySelector('[data-view="aivision"]')?.click()}};
window.planHelp=()=>planOpenDrawer('detail',`<h2>Planning & Optimization · F1</h2><p class="po-note">Four-tab governed workspace: Overview; Plan & Resources; Intervention Schedule; Optimize & Govern. Approved plans hand off through Track Execution to Work Order Intelligence / ERP-EAM.</p><h3>Data rule</h3><p style="font:9.5px Arial">Every displayed planning value is sourced from Excel/Synthetic records, calculated from those records, created as an explicit scenario/application-state record, or produced by the optimization engine. Scenario moves never overwrite the official plan until governed acceptance.</p><h3>Optimization</h3><p style="font:9.5px Arial">The built-in demo uses exact enumeration over a controlled five-intervention candidate scope with hard feasibility constraints and a lexicographic objective hierarchy. External solver interfaces are represented separately and are not falsely claimed as live.</p>`);
function techAugment(){
 const root=document.getElementById('view-integrations');if(!root||root.querySelector('.po-tech-landscape'))return;
 const sys=sheet('PLAN_System_Landscape'),ints=sheet('PLAN_Interface_Catalogue');
 const card=document.createElement('div');card.className='po-tech-landscape po-tech-compact';
 const sysTable=tableHtml(sys,['System_Name','System_Type','Configuration_Status','Connection_Method']);
 const intTable=tableHtml(ints,['Interface_ID','Interface_Name','Direction','Data_Object','Status']);
 card.innerHTML=`<h3>Systems & Interfaces · Planning Configuration</h3><div class="po-tech-table-block">${sysTable}</div><div class="po-tech-table-block">${intTable}</div>`;
 const head=root.querySelector('.view-head');if(head)head.insertAdjacentElement('afterend',card);else root.prepend(card);
}
function install(){
 const nav=document.querySelector('#sidebar .nav-item[data-view="resourceplanning"] span:last-child');if(nav)nav.textContent='Planning & Optimization';
 const p=document.querySelector('#sidebar .nav-item[data-view="resourceplanning"]');p?.classList.remove('aip675-planning-parent');p?.classList.add('aip-planning-optimization-parent');
 if(window.AIP_V21?.renderers){window.AIP_V21.renderers.resourceplanning=render}
 let drawer=document.getElementById('planDrawer');if(!drawer){drawer=document.createElement('aside');drawer.id='planDrawer';drawer.className='po-drawer';drawer.innerHTML='<button class="close" onclick="planCloseDrawer()">×</button><div class="body"></div>';document.body.appendChild(drawer)}
 const integ=document.getElementById('view-integrations');if(integ){new MutationObserver(()=>setTimeout(techAugment,20)).observe(integ,{childList:true,subtree:false})}
 document.addEventListener('aip:data-source-changed',()=>{U.optResult=null;if(document.getElementById('view-resourceplanning')?.classList.contains('active'))render();setTimeout(techAugment,40)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else setTimeout(install,0);
setTimeout(install,200);setTimeout(install,1000);
})();
