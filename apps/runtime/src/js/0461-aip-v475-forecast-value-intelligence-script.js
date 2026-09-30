
(function(){'use strict';
const P=__AIP_DS("2a0d881f921e7101"); window.AIP_V475=P;
window.GF377_EXCEL_15M=P.forecast;
window.GF377_SYNTH_15M=P.forecast.map(r=>Object.assign({},r,{Data_Source:'Synthetic',Source_Mode:'Synthetic demo'}));
function objs(h,rows){return rows.map(r=>Object.fromEntries(h.map((x,i)=>[x,r[i]])))}
const PERF=objs(P.perfH,P.perf), RUNS=objs(P.runH,P.runs), COMM=objs(P.commH,P.comm), OUT=objs(P.outH,P.out), GOV=objs(P.govH,P.gov);
function pushData(name,arr){[window.EMBEDDED_EXCEL_DATA,window.AIP_INDEPENDENT_SYNTHETIC_DATA].forEach(d=>{if(d)d[name]=arr.map(x=>Object.assign({},x))})}
pushData('FCST_Run',RUNS);pushData('FCST_Interval',P.forecast);pushData('FCST_Model_Performance',PERF);pushData('FCST_Model_Governance',GOV);pushData('FCST_Commercial_Exposure',COMM);pushData('PLAN_Outcome_Validation',OUT);
[window.EMBEDDED_EXCEL_DATA,window.AIP_INDEPENDENT_SYNTHETIC_DATA].forEach(d=>{if(!d)return;d['Data Quality Checks']=Array.isArray(d['Data Quality Checks'])?d['Data Quality Checks']:[];P.dq.forEach(r=>{if(!d['Data Quality Checks'].some(x=>String(x.Rule_ID)===String(r[0])))d['Data Quality Checks'].push(Object.fromEntries(['Rule_ID','Check','Domain','Population','Required_Fields','Rule_Type','Threshold','KPI_Use','Runtime_Basis','Governance_Status'].map((h,i)=>[h,r[i]])))})});
function money(v){return '₹'+Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0})}
function go(view,after){
 let moved=false;
 try{
   if(typeof window.activate==='function'){window.activate(view,false);moved=!!document.getElementById('view-'+view)?.classList.contains('active')}
   else if(typeof activate==='function'){activate(view,false);moved=!!document.getElementById('view-'+view)?.classList.contains('active')}
 }catch(_){}
 if(!moved){
   const b=document.querySelector(`.nav-item[data-view="${view}"],[data-view="${view}"]`);
   if(b){try{b.click();moved=true}catch(_){}}
 }
 if(!moved){
   const v=document.getElementById('view-'+view);
   if(v){
     document.querySelector('.view.active')?.classList.remove('active');
     v.classList.add('active');
     moved=true;
   }
 }
 if(after)setTimeout(after,120);
 return moved;
}
function node(label,value,sub,view,after){return `<button type="button" class="atv475-node" data-go="${view}"><span>${label}</span><b>${value}</b><small>${sub}</small><i class="go">↗</i></button>`}
function renderATV(host,decision){
 if(!host)return;
 const state=window.AIP_DI_V401_STATE||{};
 const payload=String(window.APM_DATA_MODE||'').toLowerCase().includes('synthetic')?window.AIP_DI_SYNTHETIC:window.AIP_DI_EXCEL;
 const ds=payload?.decisions||[];
 const selectedId=decision?.id||state.selected||window.AIP_DI_SELECTED_CONTEXT?.decisionId||window.AIP_DI_ACTIVE_ROW||null;
 const d=decision||ds.find(x=>x.id===selectedId)||ds[0]||null;
 host.innerHTML='';
 if(!d){
   host.innerHTML='<div class="atv526-empty">Select a decision in Decision Overview to open its Asset-to-Value lineage.</div>';
   return;
 }
 const escATV=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const fmtPct=n=>Number.isFinite(Number(n))?Number(n).toFixed(1)+'%':'—';
 const firstEvidence=(d.evidence||[])[0]||{};
 const firstModel=(d.evidence||[]).find(e=>e.model)||{};
 const audit=state.governanceAudit?.[d.id]||{};
 const lifecycle=audit.outcome||d.status||'Under Review';
 const currentExec=(d.execution||[]).find(x=>!/^Completed$/i.test(String(x.status||'')))||(d.execution||[]).slice(-1)[0]||{};
 const outcome=d.outcome||{};
 const outcomeValue=(outcome.actualBenefit!==null&&outcome.actualBenefit!==undefined&&outcome.actualBenefit!==''&&Number.isFinite(Number(outcome.actualBenefit)))?money(outcome.actualBenefit):String(outcome.status||'Pending');
 const sourceInputs=d.sourceInputs||{};
 const contextDetail=[d.site,d.siteId].filter(Boolean).join(' · ');
 const evidenceTarget=/^(SYN-)?DEC-005$/i.test(String(d.id||''))?'resourceplanning':(firstEvidence.target||d.targetView||'decisionintelligence');

 function categoryStage(){
   const cat=String(d.category||'').toLowerCase();
   if(cat==='warranty')return {
     title:'Warranty / Claim Evidence',
     value:firstEvidence.title||'Claim package',
     detail:firstEvidence.detail||d.calculationBasis||'Warranty evidence linked',
     target:evidenceTarget
   };
   if(cat==='reliability')return {
     title:'Risk & Condition',
     value:reliabilityCtx?`${reliabilityCtx.riskLabel} · ${reliabilityCtx.riskRecord}`:(Number.isFinite(Number(sourceInputs.failure_probability_pct))?fmtPct(sourceInputs.failure_probability_pct):(firstEvidence.title||'Reliability evidence')),
     detail:reliabilityCtx?(reliabilityCtx.riskView==='predictive'?'Open the exact governed predictive alert supporting this reliability decision.':'Open the exact governed asset condition record; no predictive alert is fabricated for this transformer decision.'):(firstEvidence.detail||d.risk||'Reliability evidence linked'),
     target:reliabilityCtx?reliabilityCtx.riskView:evidenceTarget
   };
   if(cat==='performance')return {title:'Performance / Loss Basis',value:firstEvidence.title||'Performance evidence',detail:firstEvidence.detail||d.calculationBasis||d.risk,target:evidenceTarget};
   if(cat==='inventory')return {title:'Spare Availability / Risk Basis',value:firstEvidence.title||'Inventory evidence',detail:firstEvidence.detail||d.calculationBasis||d.risk,target:evidenceTarget};
   if(cat==='maintenance')return {title:'Maintenance Opportunity',value:firstEvidence.title||'Maintenance evidence',detail:firstEvidence.detail||d.calculationBasis||d.risk,target:/^(SYN-)?DEC-005$/i.test(String(d.id||''))?'resourceplanning':evidenceTarget};
   if(cat==='esg')return {title:'Sustainability Evidence',value:/water|cleaning/i.test(String(d.sourceSheet||firstEvidence.source||''))?`Historical cleaning activity · ${String(d.sourceRecord||firstEvidence.record||'')}`:(firstEvidence.title||'ESG evidence'),detail:/water|cleaning/i.test(String(d.sourceSheet||firstEvidence.source||''))?'Completed/past cleaning performance used as evidence for this new decision. It is not the execution status of the decision.':(firstEvidence.detail||d.calculationBasis||d.risk),target:/water|cleaning/i.test(String(d.sourceSheet||firstEvidence.source||''))?'sustainabilityintelligence':evidenceTarget};
   if(cat==='commercial')return {title:'Commercial / PPA Basis',value:firstEvidence.title||'Commercial evidence',detail:firstEvidence.detail||d.calculationBasis||d.risk,target:evidenceTarget};
   return {title:'Decision Evidence',value:firstEvidence.title||d.sourceSheet||'Evidence',detail:firstEvidence.detail||d.calculationBasis||d.risk,target:evidenceTarget};
 }
 const reliabilityCtx=(()=>{
   const id=String(d.id||'').replace(/^SYN-/,'');
   const m={
     'DEC-001':{riskView:'predictive',riskRecord:'ALT-0001',riskLabel:'Predictive risk & condition',wo:'WO-00001',plan:'INT-001'},
     'DEC-007':{riskView:'predictive',riskRecord:'ALT-0011',riskLabel:'Predictive risk & condition',wo:'WO-00011',plan:'INT-003'},
     'DEC-009':{riskView:'predictive',riskRecord:'ALT-0017',riskLabel:'Predictive risk & condition',wo:'WO-00017',plan:'INT-017'},
     'DEC-010':{riskView:'assetexplorer',riskRecord:'SP-07-TRF-002',riskLabel:'Asset condition',wo:'WO-00053',plan:'INT-012'}
   };
   return m[id]||null;
 })();
 const maintenanceExecCtx=String(d.id||'').replace(/^SYN-/,'')==='DEC-005'?{wo:'WO-00001',plan:'INT-001'}:null;
 const executedStage=(d.execution||[]).find(x=>String(x.stage||'').toLowerCase()==='executed')||{};
 const stage3=categoryStage();

 const businessNode=(n,title,value,detail,view='',record='',navigable=true)=>`<button class="atv525-bnode" type="button"${navigable&&view?` data-go="${escATV(view)}" data-source="${escATV(title)}" data-record="${escATV(record)}"`:' data-terminal="true"'}><span class="atv525-step">${n}</span>${navigable&&view?'<span class="atv525-nav" aria-hidden="true">↗</span>':''}<span class="atv525-title">${escATV(title)}</span><b>${escATV(value||'—')}</b><small>${escATV(detail||'—')}</small></button>`;
 const traceTarget=(source,fallback='')=>{
   const s=String(source||'').toLowerCase();
   if(s==='work orders')return 'workorderintelligence';
   if(s.includes('inventory'))return 'spares';
   if(s.includes('warranty'))return 'maintenancelearning';
   if(s.includes('commercial')||s.includes('ppa'))return 'commercialppa';
   if(s.includes('generation loss'))return 'lossintelligence';
   if(s.includes('water')||s.includes('cleaning'))return 'sustainabilityintelligence';
   if(s.includes('outage bundling'))return 'resourceplanning';
   if(s.includes('ai alerts')||s.includes('rul'))return 'predictive';
   if(s==='sites')return 'executiveperformance';
   return fallback||'';
 };
 const traceWOStatus=record=>{
   const id=String(record||'').replace(/^SYN-/,'');
   const stores=[window.EMBEDDED_EXCEL_DATA,window.APM_IMPORTED_DATA,window.AIP_V5_EXCEL_RUNTIME_DATA,window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData,window.AIP_INDEPENDENT_SYNTHETIC_DATA];
   for(const st of stores){
     const rows=st?.['Work Orders'];if(!Array.isArray(rows))continue;
     const w=rows.find(x=>String(x.Work_Order_ID||'').replace(/^SYN-/,'')===id);
     if(w)return String(w.Status||'');
   }
   return '';
 };
 const traceDetail=(e)=>{
   let detail=String(e?.detail||e?.source||'');
   const rec=String(e?.record||'');
   if(String(e?.source||'').toLowerCase()==='work orders'&&rec){
     const live=traceWOStatus(rec);
     if(live){
       if(/status\s+[^·]+/i.test(detail))detail=detail.replace(/status\s+[^·]+/i,`status ${live}`);
       else detail=`${detail}${detail?' · ':''}current status ${live}`;
     }
   }
   return detail;
 };
 const lineageNode=(kind,title,detail,meta='',view='',source='',record='',navMode='record')=>`<div class="atv525-lnode atv525-${escATV(kind)}"${view?` data-lineage-go="${escATV(view)}" data-source="${escATV(source||title)}" data-record="${escATV(record||meta)}" data-nav-mode="${escATV(navMode)}" role="button" tabindex="0"`:''}><span class="atv525-lkind">${escATV(kind)}</span><b>${escATV(title)}</b><small>${escATV(detail||'—')}</small>${meta?`<em>${escATV(meta)}</em>`:''}${view?'<span class="atv525-lnav" aria-hidden="true">↗</span>':''}</div>`;
 const canonicalId=String(d.id||'').replace(/^SYN-/,'');
 const reliabilityTrace={
   'DEC-001':{riskView:'predictive',riskRecord:'ALT-0001',riskTitle:'Failure-risk signal'},
   'DEC-007':{riskView:'predictive',riskRecord:'ALT-0011',riskTitle:'Failure-risk signal'},
   'DEC-009':{riskView:'predictive',riskRecord:'ALT-0017',riskTitle:'Failure-risk signal'},
   'DEC-010':{riskView:'assetexplorer',riskRecord:'SP-07-TRF-002',riskTitle:'Asset condition'}
 }[canonicalId]||null;
 const primaryTarget=traceTarget(d.sourceSheet,d.targetView||'');
 const primaryMode=String(d.sourceSheet||'').toLowerCase()==='work orders'?'wo-ledger':'record';
 const primaryNode=lineageNode('data','Primary Source',`${d.sourceSheet||'Decision source'} · ${d.sourceRecord||'—'}`,d.calculationBasis||d.rationale||'',primaryTarget,d.sourceSheet||'Decision source',d.sourceRecord||'',primaryMode);
 const evidenceNodes=(d.evidence||[]).map((e,i)=>{
   let rec=String(e.record||'');
   let source=String(e.source||e.type||'Evidence');
   let target=traceTarget(source,e.target||'');
   let title=e.title||e.type||`Evidence ${i+1}`;
   let detail=traceDetail(e);
   if(reliabilityTrace && /failure-risk|asset condition/i.test(String(title))){
     rec=reliabilityTrace.riskRecord;target=reliabilityTrace.riskView;
     if(canonicalId==='DEC-010')title='Asset condition evidence';
     source=canonicalId==='DEC-010'?'Asset Condition':(source||'AI Alerts & RUL');
   }
   /* Never send a work-order ID into Predictive as if it were an alert/model-run record. */
   if(target==='predictive' && /^((SYN-)?WO-)/i.test(rec)){
     target='workorderintelligence';
   }
   const isWO=target==='workorderintelligence'||/^((SYN-)?WO-)/i.test(rec);
   const mode=isWO?(/constraint|parts pending|approval|permit|blocker/i.test(`${title} ${detail}`)?'wo-exception':'wo-ledger'):'record';
   const q=Number(e.quality);
   const meta=[rec,(Number.isFinite(q)?`Quality ${q.toFixed(0)}%`:'' )].filter(Boolean).join(' · ');
   return lineageNode('data',title,detail,meta,target,source,rec,mode);
 });
 const traceAlertModel=record=>{
   const id=String(record||'').replace(/^SYN-/,'');
   const stores=[window.EMBEDDED_EXCEL_DATA,window.APM_IMPORTED_DATA,window.AIP_V5_EXCEL_RUNTIME_DATA,window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData,window.AIP_INDEPENDENT_SYNTHETIC_DATA];
   for(const st of stores){
     const rows=st?.['AI Alerts & RUL'];if(!Array.isArray(rows))continue;
     const a=rows.find(x=>String(x.Alert_ID||'').replace(/^SYN-/,'')===id);
     if(a?.Model)return String(a.Model);
   }
   return '';
 };
 const exactAlertRecords=[...(d.evidence||[]).map(e=>String(e.record||'')).filter(x=>/^((SYN-)?ALT-)/i.test(x)),reliabilityTrace?.riskRecord||''].filter(x=>/^((SYN-)?ALT-)/i.test(x));
 const exactAlertModels=exactAlertRecords.map(traceAlertModel).filter(Boolean);
 const declaredModels=(d.evidence||[]).map(e=>String(e.model||'').trim()).filter(m=>m&&!/^Predictive maintenance model$/i.test(m));
 const modelNames=[...new Set([...declaredModels,...exactAlertModels])];
 const logicLabel=canonicalId==='DEC-010'?'Asset Condition / Analytical Basis':(modelNames.length?'Model / Analytical Basis':'Rule / Calculation Basis');
 const logicDetail=canonicalId==='DEC-010'?(d.calculationBasis||d.rationale||d.risk||'Governed asset-condition assessment'):(modelNames.length?`${modelNames.join(' · ')}${d.calculationBasis?` · ${d.calculationBasis}`:''}`:(d.calculationBasis||d.rationale||d.risk||'Governed decision logic'));
 let logicTarget='',logicRecord='',logicSource='Decision Logic';
 if(modelNames.length){
   const modelEvidence=(d.evidence||[]).find(e=>e.model)||{};
   if(reliabilityTrace){logicTarget=reliabilityTrace.riskView;logicRecord=reliabilityTrace.riskRecord;logicSource=canonicalId==='DEC-010'?'Asset Condition':'AI Alerts & RUL'}
   else if(modelEvidence.record && !/^((SYN-)?WO-)/i.test(String(modelEvidence.record))){logicTarget=traceTarget(modelEvidence.source,modelEvidence.target||'');logicRecord=modelEvidence.record;logicSource=modelEvidence.source||'Model evidence'}
   else if(modelEvidence.record){logicTarget='workorderintelligence';logicRecord=modelEvidence.record;logicSource='Work Orders'}
 }
 const logicNode=lineageNode(modelNames.length?'model':'logic',logicLabel,logicDetail,modelNames.length?modelNames.join(' · '):'Governed calculation',logicTarget,logicSource,logicRecord,logicTarget==='workorderintelligence'?'wo-ledger':'record');
 const executed=(d.execution||[]).find(x=>String(x.stage||'').toLowerCase()==='executed')||{};
 const currentPending=(d.execution||[]).find(x=>!/^Completed$/i.test(String(x.status||'')))||(d.execution||[]).slice(-1)[0]||{};
 let executionRecord=String(executed.record||'');
 let executionSource=String(executed.source||'');
 let executionTarget='';
 let executionMode='record';
 if(executionRecord){
   executionTarget=traceTarget(executionSource,/^((SYN-)?WO-)/i.test(executionRecord)?'workorderintelligence':'');
   if(executionTarget==='workorderintelligence')executionMode='wo-ledger';
 }else if(String(d.sourceSheet||'').toLowerCase()==='work orders' && d.sourceRecord){
   executionRecord=d.sourceRecord;executionSource='Work Orders';executionTarget='workorderintelligence';executionMode='wo-ledger';
 }else{
   executionRecord=d.id;executionSource='Decision Intelligence';executionTarget='__execution__';
 }
 const executionStatus=String(executed.status||'').toLowerCase()==='completed'?`Executed · Completed${executionRecord&&/^((SYN-)?WO-)/i.test(executionRecord)?` · ${executionRecord}`:''}`:(currentPending.stage?`${currentPending.stage} · ${currentPending.status||'Pending'}`:(d.status||'Pending handoff'));
 const outcomeRecord=String(outcome.benefitsRecord||'');
 const outcomeTarget=outcomeRecord?'benefitsrealization':'';
 const traceNodes=[
   lineageNode('data','Decision Context',`${d.site||d.siteId||'—'} · ${d.asset||'—'}`,d.id),
   primaryNode,
   ...evidenceNodes,
   logicNode,
   lineageNode('value','Decision Value',d.impact||money(d.value||0),`${money(d.value||0)} · ${d.calculationBasis||'Governed value basis'}`,'decisionintelligence','Decision Intelligence',d.id,'record'),
   lineageNode('decision','Governed Decision',d.recommendedAction||d.title,`${lifecycle} · ${d.owner||'Owner'}`,'__governance__','Decision Intelligence',d.id,'record'),
   lineageNode('execution','Execution / Handoff',executionStatus,executionRecord||'Decision execution state',executionTarget,executionSource,executionRecord,executionMode),
   lineageNode('outcome','Outcome / Benefit',outcome.status||'Pending',outcomeValue,outcomeTarget,'Benefits Realization',outcomeRecord,'record')
 ];
 const div=document.createElement('div');
 div.className='atv475 atv525 atv526';
 window.AIP_ATV_MODE_BY_DECISION=window.AIP_ATV_MODE_BY_DECISION||{};
 const returnCtxMode=(window.AIP_ATV_RETURN_CONTEXT&&String(window.AIP_ATV_RETURN_CONTEXT.decisionId||'')===String(d.id||''))?String(window.AIP_ATV_RETURN_CONTEXT.mode||''):'';
 const savedMode=String(window.AIP_ATV_MODE_BY_DECISION[String(d.id||'')]||'');
 const returnMode=(returnCtxMode==='lineage'||returnCtxMode==='business')?returnCtxMode:((savedMode==='lineage'||savedMode==='business')?savedMode:'business');
 window.AIP_ATV_MODE_BY_DECISION[String(d.id||'')]=returnMode;
 div.dataset.mode=returnMode==='lineage'?'lineage':'business';
 div.innerHTML=`<div class="atv475-head atv530-head-clean atv533-head"><div class="atv533-decision-id"><b>${escATV(d.id)}</b></div><div class="atv475-toggle"><button class="${returnMode==='lineage'?'':'active'}" data-atvm="business">Value Pathway</button><button class="${returnMode==='lineage'?'active':''}" data-atvm="lineage">Decision Trace</button></div></div>
 <div class="atv525-business">
   <div class="atv525-flow">
    ${businessNode(1,'Selected Asset / Context',d.asset||d.siteId||'—',contextDetail,'','',false)}
    ${businessNode(2,'Source Evidence',/^(SYN-)?DEC-(006|014)$/i.test(String(d.id||''))?'Historical Cleaning Performance':(d.sourceSheet||'Decision source'),/^(SYN-)?DEC-(006|014)$/i.test(String(d.id||''))?`${d.sourceRecord||'—'} · completed/past activity used as decision evidence`:(d.sourceRecord||'—'),/^(SYN-)?DEC-005$/i.test(String(d.id||''))?'resourceplanning':(/^(SYN-)?DEC-(006|014)$/i.test(String(d.id||''))?'sustainabilityintelligence':(d.targetView||evidenceTarget)),d.sourceRecord,Boolean(d.targetView||evidenceTarget||/^(SYN-)?DEC-(006|014)$/i.test(String(d.id||'')))).replace('data-source="Source Evidence"',`data-source="${escATV(d.sourceSheet||'Decision source')}"`)}
    ${businessNode(3,stage3.title,stage3.value,stage3.detail,stage3.target,reliabilityCtx?.riskRecord||firstEvidence.record||d.sourceRecord,true)}
    ${businessNode(4,'Value at Stake',money(d.value||0),d.impact||d.calculationBasis||'Governed decision value','decisionintelligence',d.id,false)}
    ${businessNode(5,'Recommended Decision',d.recommendedAction||d.title||'Review decision',d.rationale||d.risk||'Decision rationale',String(d.category||'').toLowerCase()==='inventory'?'spares':'decisionintelligence',String(d.category||'').toLowerCase()==='inventory'?(d.sourceRecord||d.id):d.id,String(d.category||'').toLowerCase()==='inventory')}
    ${businessNode(6,'Governance & Readiness',lifecycle,`${Number(d.openBlockers||0)} blocker${Number(d.openBlockers||0)===1?'':'s'} · ${d.owner||'Owner'}`,
      /^(SYN-)?DEC-(012|013)$/i.test(String(d.id||''))?'__governance__':'decisionintelligence',
      d.id,
      /^(SYN-)?DEC-(012|013)$/i.test(String(d.id||'')))}
    ${businessNode(
      7,
      'Execution / Handoff',
      (reliabilityCtx||maintenanceExecCtx)?`Executed · ${executedStage.status||'Not Started'}`:(currentExec.stage?`${currentExec.stage} · ${currentExec.status||'Pending'}`:(d.targetView||'Pending handoff')),
      (reliabilityCtx||maintenanceExecCtx)?`Work Orders · ${(reliabilityCtx||maintenanceExecCtx).wo}`:(currentExec.record?`${currentExec.source||'Execution'} · ${currentExec.record}`:
        (/^(SYN-)?DEC-(006|014)$/i.test(String(d.id||''))?'No downstream work order yet · open execution status':(currentExec.source||'Execution path linked'))),
      (reliabilityCtx||maintenanceExecCtx)?'workorderintelligence':
        (String(d.category||'').toLowerCase()==='inventory'?'spares':
          (/^(SYN-)?DEC-(006|012|013|014)$/i.test(String(d.id||''))?'__execution__':
            (currentExec.record&&currentExec.source==='Work Orders'?'workorderintelligence':(d.targetView||'')))),
      (reliabilityCtx||maintenanceExecCtx)?(reliabilityCtx||maintenanceExecCtx).wo:
        (String(d.category||'').toLowerCase()==='inventory'?(d.sourceRecord||currentExec.record):
          (/^(SYN-)?DEC-(006|012|013|014)$/i.test(String(d.id||''))?d.id:(currentExec.record||d.sourceRecord))),
      Boolean((reliabilityCtx||maintenanceExecCtx)?.wo||currentExec.record||d.targetView||/^(SYN-)?DEC-(006|012|013|014)$/i.test(String(d.id||'')))
    )}
    ${businessNode(8,'Outcome / Value',outcomeValue,outcome.status||'Outcome pending',outcome.benefitsRecord?'benefitsrealization':'',outcome.benefitsRecord||'',Boolean(outcome.benefitsRecord))}
   </div>
 </div>
 <div class="atv525-lineage">
   <div class="atv525-lineage-intro atv527-lineage-intro atv598-trace-title"><b>Decision ${escATV(String(d.id||'').replace(/^(SYN-)?DEC-/i,''))}</b></div>
   <div class="atv526-graph" aria-label="Decision-specific evidence, logic and governed record trace">
      ${traceNodes.join('')}
   </div>
   <div class="atv525-lineage-key"><span><i class="data"></i>Source / evidence</span><span><i class="model"></i>Model / analytical basis</span><span><i class="value"></i>Value / decision</span><span><i class="outcome"></i>Execution / outcome</span></div>
 </div>`;
 host.appendChild(div);

 const establishReturn=()=>{
   window.AIP_DI_ACTIVE_ROW=d.id;
   window.AIP_DI_SELECTED_CONTEXT={decisionId:d.id};
   window.AIP_ATV_MODE_BY_DECISION=window.AIP_ATV_MODE_BY_DECISION||{};
   window.AIP_ATV_MODE_BY_DECISION[String(d.id||'')]=div.dataset.mode==='lineage'?'lineage':'business';
   window.AIP_ATV_RETURN_CONTEXT={decisionId:d.id,mode:window.AIP_ATV_MODE_BY_DECISION[String(d.id||'')],tab:'assetvalue',ts:Date.now()};
   window.AIP_DI_RETURN={decisionId:d.id,tab:'assetvalue',stage:state.stage||'map',atvMode:window.AIP_ATV_RETURN_CONTEXT.mode};
 };
 const escCss=v=>{try{return CSS.escape(String(v))}catch(_){return String(v).replace(/["\\]/g,'\\$&')}};
 const clearTargetContext=(root)=>{
   if(!root)return;
   root.querySelectorAll('.atv528-exact-target,.atv527-exact-target').forEach(x=>x.classList.remove('atv528-exact-target','atv527-exact-target'));
   root.querySelectorAll('.atv528-context-banner').forEach(x=>x.remove());
 };
 const markTarget=(root,node,label)=>{
   if(!root||!node)return false;
   clearTargetContext(root);
   node.classList.add('atv528-exact-target');
   const banner=document.createElement('div');
   banner.className='atv528-context-banner';
   banner.innerHTML=`<span>${escATV(label||'Selected decision context')}</span><button type="button" aria-label="Clear selected context" title="Clear selected context">×</button>`;
   banner.querySelector('button').onclick=()=>{
     clearTargetContext(root);
     try{
       if(window.AIP_DI_EVIDENCE_CONTEXT?.target===root.id.replace('view-',''))window.AIP_DI_EVIDENCE_CONTEXT=null;
       if(window.AIP_ATV_TARGET_CONTEXT?.target===root.id.replace('view-',''))window.AIP_ATV_TARGET_CONTEXT=null;
     }catch(_){}
     const q=root.querySelector('#wo12-search,[type="search"]');
     if(q&&q.id==='wo12-search'){q.value='';q.dispatchEvent(new Event('input',{bubbles:true}))}
   };
   const tabs=root.querySelector('.ops-tabs,.tabs,.subtabs,.aip-maint-subtabs');
   const head=root.querySelector('.view-head,.xi-head,.panel-title');
   if(tabs)tabs.insertAdjacentElement('afterend',banner);
   else if(head)head.insertAdjacentElement('afterend',banner);
   else root.prepend(banner);
   node.scrollIntoView?.({behavior:'auto',block:'center'});
   return true;
 };
 const focusGenericRecord=(vw,record,attempt=0)=>{
   if(!record)return false;
   const root=document.getElementById('view-'+vw);
   if(!root){if(attempt<14)setTimeout(()=>focusGenericRecord(vw,record,attempt+1),100);return false}
   const nodes=[...root.querySelectorAll('tr,[data-id],[data-record-id],[data-record],[data-wo-id],.card,.ops-exception,.panel,.row')];
   const rec=String(record);
   const exact=nodes.find(el=>{
     const attrs=[el.getAttribute?.('data-id'),el.getAttribute?.('data-record-id'),el.getAttribute?.('data-record'),el.getAttribute?.('data-wo-id'),el.getAttribute?.('data-loss-record')].filter(Boolean).map(String);
     if(attrs.includes(rec))return true;
     const txt=String(el.textContent||'').replace(/\s+/g,' ').trim();
     return new RegExp(`(^|[^A-Za-z0-9_-])${rec.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^A-Za-z0-9_-]|$)`).test(txt);
   });
   if(!exact){if(attempt<14)setTimeout(()=>focusGenericRecord(vw,record,attempt+1),120);return false}
   return markTarget(root,exact,`${d.id} · ${record}`);
 };
 const focusWO=(wo,mode='wo-ledger',attempt=0)=>{
   if(!wo)return false;
   const root=document.getElementById('view-workorderintelligence');
   if(!root){if(attempt<16)setTimeout(()=>focusWO(wo,mode,attempt+1),100);return false}
   if(mode==='wo-exception'){
     window.AIP_WO_DESIRED_TAB='exceptions';
     try{window.OPS_WO&&(window.OPS_WO.tab='exceptions')}catch(_){}
     try{window.renderWorkOrderIntelligence?.()}catch(_){}
     const tab=root.querySelector('.ops-tab[data-wo12-tab="exceptions"]')||[...root.querySelectorAll('.ops-tab')].find(b=>/Approvals\s*&\s*Exceptions/i.test(b.textContent||''));
     if(tab&&!tab.classList.contains('active')){try{tab.click()}catch(_){}}
     const card=root.querySelector(`.ops-exception[data-wo-id="${escCss(wo)}"]`);
     if(!card){if(attempt<16)setTimeout(()=>focusWO(wo,mode,attempt+1),120);return false}
     return markTarget(root,card,`${d.id} · ${wo} · Approvals & Constraints`);
   }
   window.AIP_WO_DESIRED_TAB='ledger';
   try{window.OPS_WO&&(window.OPS_WO.tab='ledger')}catch(_){}
   try{window.renderWorkOrderIntelligence?.()}catch(_){}
   const tab=root.querySelector('.ops-tab[data-wo12-tab="ledger"]');
   if(tab&&!tab.classList.contains('active')){try{tab.click()}catch(_){}}
   const status=root.querySelector('#wo12-status-filter');if(status&&status.value!=='All'){status.value='All';status.dispatchEvent(new Event('change',{bubbles:true}))}
   const search=root.querySelector('#wo12-search');if(search){search.value=String(wo);search.dispatchEvent(new Event('input',{bubbles:true}))}
   const row=root.querySelector(`#wo12-table tbody tr[data-wo12-id="${escCss(wo)}"]`);
   if(!row){if(attempt<16)setTimeout(()=>focusWO(wo,mode,attempt+1),120);return false}
   row.hidden=false;
   return markTarget(root,row,`${d.id} · Work Order ${wo}`);
 };
 const inferWOMode=(source,record,detail='')=>{
   const isWO=String(source||'').toLowerCase()==='work orders'||/^SYN-WO-|^WO-/i.test(String(record||''));
   if(!isWO)return '';
   return /constraint|parts pending|approval/i.test(String(detail||''))?'wo-exception':'wo-ledger';
 };

 const governedSourceTarget=(source,fallback='')=>{
   const s=String(source||'').toLowerCase();
   if(s==='work orders')return 'workorderintelligence';
   if(s.includes('inventory'))return 'spares';
   if(s.includes('warranty'))return 'maintenancelearning';
   if(s.includes('commercial')||s.includes('ppa'))return 'commercialppa';
   if(s.includes('generation loss'))return 'lossintelligence';
   if(s.includes('water')||s.includes('cleaning'))return 'sustainabilityintelligence';
   if(s.includes('outage bundling'))return 'resourceplanning';
   if(s.includes('ai alerts')||s.includes('rul'))return 'predictive';
   return fallback||'';
 };

 const openTarget=(vw,source,record,mode='',detail='')=>{
   if(!vw)return;
   establishReturn();
   if(vw==='maintenancelearning'&&/warranty/i.test(String(source||''))){
     const claimId=record||d.sourceRecord||'';
     const wctx={decisionId:d.id,claimId,record:claimId,source:source||d.sourceSheet,asset:d.asset,siteId:d.siteId,site:d.site,returnTab:'assetvalue',navMode:'warranty-claim'};
     window.AIP_WARRANTY_CONTEXT=wctx;
     window.AIP_DI_EVIDENCE_CONTEXT={...wctx,target:'maintenancelearning'};
     window.AIP_ATV_TARGET_CONTEXT={decisionId:d.id,target:'maintenancelearning',record:claimId,navMode:'warranty-claim',at:Date.now()};
     window.AIP_WARRANTY_NAV_PENDING=true;
     window.__ml534WarrantySearch='';
     window.__ml534WarrantyStatus='All';
     window.__ml534SelectedClaim=claimId;
     if(window.AIP856_MLR_STATE)window.AIP856_MLR_STATE.tab='warranty';
     if(typeof window.AIPOpenWarrantyClaims==='function'){
       window.AIPOpenWarrantyClaims(wctx);
       return;
     }
   }
   const navMode=mode||inferWOMode(source,record,detail)||'record';
   const targetRecord=record||d.sourceRecord||'';

   if(vw==='__governance__'||vw==='__execution__'||vw==='decisionintelligence'){
     if(/^(SYN-)?DEC-(012|013)$/i.test(String(d.id||''))&&(vw==='__governance__'||vw==='__execution__')){
       window.AIP_DI_V589_CONTEXT={active:true,decisionId:d.id,ppaRecord:d.sourceRecord||'',stage:vw==='__governance__'?'governance':'execution'};
     }
     const S=window.AIP_DI_V401_STATE;
     if(S){
       S.selected=d.id;
       S.tab='workspace';
       S.stage=vw==='__governance__'?'governance':vw==='__execution__'?'execution':'map';
     }
     window.AIP_DI_ACTIVE_ROW=d.id;
     window.AIP_DI_SELECTED_CONTEXT={decisionId:d.id};
     window.AIP_DI_RETURN=null;
     try{window.renderDecisionIntelligenceV401?.()}catch(_){try{window.renderDecisionIntelligence?.()}catch(__){}}
     return;
   }

   window.AIP_DI_EVIDENCE_CONTEXT={decisionId:d.id,source:source||d.sourceSheet,record:targetRecord,target:vw,siteId:d.siteId,site:d.site,asset:d.asset,navMode};
   window.AIP_ATV_TARGET_CONTEXT={decisionId:d.id,target:vw,record:targetRecord,navMode,at:Date.now()};

   if(vw==='workorderintelligence'){
     window.AIP_WO_DESIRED_TAB=navMode==='wo-exception'?'exceptions':'ledger';
     try{window.OPS_WO&&(window.OPS_WO.tab=window.AIP_WO_DESIRED_TAB)}catch(_){}
   }

   /* Asset-to-Value predictive evidence: establish one exact contextual selection. */
   if(vw==='predictive' && targetRecord){
     try{
       P754_SELECTED_CLASS='All';
       P771_THRESHOLD_DAYS='All';
       P758_PREDICTION_SEARCH='';
       P754_CONTEXT_ALERT=String(targetRecord);
       P754_ALLOW_EMPTY_SELECTION=false;
       P754_SELECTED_ALERT=String(targetRecord);
       P766_PREDICTION_PINNED=true;
     }catch(_){}
     const moved=go(vw);
     if(!moved)return;
     try{renderPredictive()}catch(_){}
     requestAnimationFrame(()=>{
       const row=document.querySelector(`#view-predictive tr[data-p754-alert="${escCss(String(targetRecord))}"]`);
       row?.scrollIntoView?.({behavior:'auto',block:'center'});
       p754BindRegisterScroll?.();
     });
     return;
   }

   if(vw==='commercialppa'&&/^(SYN-)?DEC-(012|013)$/i.test(String(d.id||''))&&/commercial|ppa/i.test(String(source||d.sourceSheet||detail||''))){
     window.AIP_DI_EVIDENCE_CONTEXT={decisionId:d.id,source:source||d.sourceSheet||'Commercial & PPA',record:targetRecord||d.sourceRecord,target:'commercialppa',siteId:d.siteId,site:d.site,asset:d.asset,navMode:'commercial-ppa-record'};
     window.AIP_ATV_TARGET_CONTEXT={decisionId:d.id,target:'commercialppa',record:targetRecord||d.sourceRecord,navMode:'commercial-ppa-record',at:Date.now()};
     if(typeof window.AIPOpenCommercialPPARecord==='function'){
       window.AIPOpenCommercialPPARecord({decisionId:d.id,record:targetRecord||d.sourceRecord,source:'Commercial & PPA',siteId:d.siteId});
       return;
     }
   }

   if(vw==='sustainabilityintelligence'&&/^(SYN-)?DEC-(006|014)$/i.test(String(d.id||''))&&/water|cleaning/i.test(String(source||d.sourceSheet||''))){
     window.AIP_DI_EVIDENCE_CONTEXT={decisionId:d.id,source:source||d.sourceSheet||'Water & Cleaning',record:targetRecord||d.sourceRecord,target:'sustainabilityintelligence',siteId:d.siteId,site:d.site,asset:d.asset,navMode:'sustainability-water-record'};
     window.AIP_ATV_TARGET_CONTEXT={decisionId:d.id,target:'sustainabilityintelligence',record:targetRecord||d.sourceRecord,navMode:'sustainability-water-record',at:Date.now()};
     if(typeof window.AIPOpenSustainabilityWaterRecord==='function'){
       window.AIPOpenSustainabilityWaterRecord({decisionId:d.id,record:targetRecord||d.sourceRecord,source:'Water & Cleaning'});
       return;
     }
   }

   if(vw==='resourceplanning'&&/^(SYN-)?DEC-005$/i.test(String(d.id||''))){
     window.AIP_DI_EVIDENCE_CONTEXT={decisionId:d.id,source:source||'Outage Bundling',record:targetRecord||'VIS-001',target:'resourceplanning',siteId:d.siteId,site:d.site,asset:d.asset,navMode:'planning-intervention'};
     window.AIP_ATV_TARGET_CONTEXT={decisionId:d.id,target:'resourceplanning',record:'INT-001',sourceRecord:targetRecord||'VIS-001',navMode:'planning-intervention',at:Date.now()};
     window.AIP_DEC005_PLAN_CONTEXT={decisionId:d.id,sourceRecord:targetRecord||'VIS-001',interventionId:'INT-001',workOrderId:'WO-00001',assetTag:'SP-01-INV-001',active:true};
     const openPlan=()=>{
       try{
         if(window.AIP_V21?.open)window.AIP_V21.open('resourceplanning');
         else document.querySelector('.nav-item[data-view="resourceplanning"]')?.click();
       }catch(_){}
       try{
         if(typeof window.planSelect==='function')window.planSelect('INT-001','schedule');
         else if(typeof window.planSetTab==='function'){window.planSetTab('schedule');setTimeout(()=>window.planScheduleSelect?.('INT-001'),0)}
       }catch(_){}
       const root=document.getElementById('view-resourceplanning');
       if(root){
         root.classList.add('aip-v583-dec005-context');
         const row=[...root.querySelectorAll('.po-sched184-fixedrow')].find(x=>/INT-001/.test(x.textContent||''));
         row?.classList.add('aip-v583-dec005-target');
         row?.scrollIntoView?.({block:'center',behavior:'auto'});
       }
     };
     openPlan();requestAnimationFrame(openPlan);setTimeout(openPlan,60);setTimeout(openPlan,180);setTimeout(openPlan,400);
     return;
   }

   const moved=go(vw);
   if(!moved)return;
   if(vw==='maintenancelearning'&&/warranty/i.test(String(source||'')))return;

   if(!targetRecord)return;
   if(vw==='lossintelligence'){
     const focusLoss=(attempt=0)=>{
       const root=document.getElementById('view-lossintelligence');
       if(!root){if(attempt<14)setTimeout(()=>focusLoss(attempt+1),100);return false}
       try{renderLossIntelligence?.()}catch(_){}
       const row=root.querySelector(`#site-loss-ranking-table tbody tr[data-loss-record="${escCss(String(targetRecord))}"]`);
       if(!row){if(attempt<14)setTimeout(()=>focusLoss(attempt+1),120);return false}
       row.hidden=false;
       const marked=markTarget(root,row,`${d.id} · Generation Loss Attribution · ${targetRecord}`);
       const banner=root.querySelector('.atv528-context-banner');
       const rankingCard=row.closest('.card');
       const rankingTitle=rankingCard?.querySelector('.panel-title');
       const rankingTable=rankingCard?.querySelector('#site-loss-ranking-table');
       if(banner&&rankingCard){
         if(rankingTable)rankingCard.insertBefore(banner,rankingTable);
         else if(rankingTitle)rankingTitle.insertAdjacentElement('afterend',banner);
         else rankingCard.insertBefore(banner,rankingCard.firstChild);
         banner.classList.add('v562-loss-ranking-context');
       }
       return marked;
     };
     [0,80,180,360].forEach((ms,i)=>setTimeout(()=>focusLoss(i),ms));
     return;
   }
   if(vw==='workorderintelligence'){
     [20,70,150,280,500,850,1200,1700].forEach((ms,i)=>setTimeout(()=>focusWO(targetRecord,navMode,i),ms));
   }else{
     [40,120,260,500,850,1200,1700].forEach((ms,i)=>setTimeout(()=>focusGenericRecord(vw,targetRecord,i),ms));
   }
 };
 div.querySelectorAll('[data-atvm]').forEach(b=>b.onclick=()=>{
   div.dataset.mode=b.dataset.atvm;
   window.AIP_ATV_MODE_BY_DECISION=window.AIP_ATV_MODE_BY_DECISION||{};
   window.AIP_ATV_MODE_BY_DECISION[String(d.id||'')]=b.dataset.atvm==='lineage'?'lineage':'business';
   div.querySelectorAll('[data-atvm]').forEach(x=>x.classList.toggle('active',x===b));
 });
 div.querySelectorAll('.atv525-bnode[data-go]').forEach(b=>b.onclick=()=>{
   const rec=b.dataset.record||d.sourceRecord;
   const detail=`${b.querySelector('.atv525-title')?.textContent||''} ${b.querySelector('small')?.textContent||''}`;
   const title=String(b.querySelector('.atv525-title')?.textContent||'').trim();
   const source=b.dataset.source||d.sourceSheet||'';
   const target=title==='Source Evidence'?governedSourceTarget(source,b.dataset.go):b.dataset.go;
   const mode=(target==='workorderintelligence')?inferWOMode(source,rec,detail):'record';
   openTarget(target,source,rec,mode,detail);
 });
 const openLineage=n=>openTarget(n.dataset.lineageGo,n.dataset.source,n.dataset.record,n.dataset.navMode||'record',`${n.querySelector('b')?.textContent||''} ${n.querySelector('small')?.textContent||''}`);
 div.querySelectorAll('[data-lineage-go]').forEach(n=>{
   n.onclick=()=>openLineage(n);
   n.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openLineage(n)}};
 });
 if(window.AIP_ATV_RETURN_CONTEXT&&String(window.AIP_ATV_RETURN_CONTEXT.decisionId||'')===String(d.id||'')){
   window.AIP_ATV_RETURN_CONTEXT=null;
 }
}
window.AIPRenderAssetToValueIntelligence=renderATV;
function injectGF(){const shell=document.querySelector('#view-operationaltwin .gf377-shell');if(!shell||shell.querySelector('.gf475-performance'))return;const site=document.querySelector('#view-operationaltwin #tSite')?.value||'SP-01';const h=Number(document.querySelector('#view-operationaltwin [data-gfh].active')?.dataset.gfh||24);const p=PERF.find(x=>x.Plant_ID===site&&Number(x.Horizon_Hours)===h)||PERF.find(x=>x.Plant_ID==='PORTFOLIO'&&Number(x.Horizon_Hours)===h)||{};const r=RUNS.find(x=>x.Plant_ID===site&&Number(x.Horizon_Hours)===h)||{};const c=COMM.find(x=>x.Forecast_Run_ID===r.Forecast_Run_ID)||{};const d=document.createElement('section');d.className='gf475-performance';d.innerHTML=`<div class="gf476-headrow"><div class="gf475-title"><div><h3>Forecast Performance & Calibration</h3><small>Physics baseline → residual ML → calibrated forecast</small></div></div><div class="gf476-explore"><button class="gf476-nav" data-fd="runsvalidation">Runs & Validation <i>↗</i></button><button class="gf476-nav" data-fd="modelgovernance">Model & Governance <i>↗</i></button><button class="gf476-nav" data-fd="commercial">Commercial Exposure <i>↗</i></button></div></div><div class="gf475-kpis">${kpi('Physics Forecast Error',Number(p.Physics_nMAE_Pct||0).toFixed(2)+'%','Normalized forecast error')}${kpi('Hybrid Forecast Error',Number(p.Hybrid_nMAE_Pct||0).toFixed(2)+'%','Normalized forecast error after ML correction')}${kpi('Forecast Accuracy Gain',Number(p.Improvement_vs_Physics_Pct||0).toFixed(1)+'%','Error reduction versus physics baseline')}${kpi('Forecast Range Reliability',Number(p.Interval_Coverage_Pct||0).toFixed(1)+'%','Share of actuals inside calibrated 80% band')}</div><div class="gf476-help"><b>Normalized Forecast Error</b> = the average absolute difference between forecast and actual generation, expressed as a percentage so plants and forecast horizons can be compared consistently.</div><div class="gf475-table"><table><thead><tr><th style="text-align:left">Forecast Run</th><th style="text-align:right">Physics MWh</th><th style="text-align:right">Hybrid MWh</th><th style="text-align:right">Energy at Risk</th><th style="text-align:right">Forward ₹ Exposure</th><th style="text-align:right">Data Trust</th><th style="text-align:left">Model</th></tr></thead><tbody><tr><td style="text-align:left">${r.Forecast_Run_ID||'—'}</td><td class="num">${Number(r.Physics_Forecast_MWh||0).toFixed(2)}</td><td class="num">${Number(r.Hybrid_Forecast_MWh||0).toFixed(2)}</td><td class="num">${Number(r.Operational_Energy_At_Risk_MWh||0).toFixed(2)}</td><td class="num">${money(c.Forward_Revenue_Exposure_INR)}</td><td class="num">${Number(r.Data_Trust_Pct||0).toFixed(2)}%</td><td style="text-align:left">MDL-SFRC-012</td></tr></tbody></table></div>`;shell.appendChild(d);d.querySelectorAll('[data-fd]').forEach(b=>b.addEventListener('click',()=>openForecastDrillCombined(b.dataset.fd,site,h)))}

function openForecastDrillCombined(kind,site,h){
 if(kind==='runsvalidation'){
   openForecastDrill('runs',site,h);
   setTimeout(()=>{
     const m=document.getElementById('gf476-modal'),body=m?.querySelector('.gf476-body');
     if(!body)return;
     const first=body.innerHTML;
     openForecastDrill('validation',site,h);
     const second=m.querySelector('.gf476-body')?.innerHTML||'';
     m.querySelector('h3').textContent='Runs & Validation';
     m.querySelector('.gf476-body').innerHTML=
       '<section class="gf492-drillsection"><h4>Forecast Runs</h4>'+first+'</section>'+
       '<section class="gf492-drillsection"><h4>Validation & Calibration</h4>'+second+'</section>';
     window.AIPNormalizeForecastDrillTables?.(m);
   },0);
   return;
 }
 if(kind==='modelgovernance'){
   openForecastDrill('performance',site,h);
   setTimeout(()=>{
     const m=document.getElementById('gf476-modal'),body=m?.querySelector('.gf476-body');
     if(!body)return;
     const first=body.innerHTML;
     openForecastDrill('governance',site,h);
     const second=m.querySelector('.gf476-body')?.innerHTML||'';
     m.querySelector('h3').textContent='Model & Governance';
     m.querySelector('.gf476-body').innerHTML=
       '<section class="gf492-drillsection"><h4>Model Performance</h4>'+first+'</section>'+
       '<section class="gf492-drillsection"><h4>Model Governance</h4>'+second+'</section>';
     window.AIPNormalizeForecastDrillTables?.(m);
   },0);
   return;
 }
 openForecastDrill(kind,site,h);
}
function openForecastDrill(kind,site,h){let m=document.getElementById('gf476-modal');if(!m){m=document.createElement('div');m.id='gf476-modal';m.className='gf476-modal';m.innerHTML='<div class="gf476-panel"><div class="gf476-panelhead"><h3></h3><button class="gf476-close" aria-label="Close">×</button></div><div class="gf476-body"></div></div>';document.body.appendChild(m);m.querySelector('.gf476-close').onclick=()=>m.classList.remove('open');m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')})}const title=m.querySelector('h3'),body=m.querySelector('.gf476-body');const tbl=(cols,rows,rightIdx=[])=>'<div class="gf476-gridtable"><table><thead><tr>'+cols.map((c,i)=>'<th class="'+(rightIdx.includes(i)?'num':'txt')+'">'+c+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map((v,i)=>'<td class="'+(rightIdx.includes(i)?'num':'txt')+'">'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';if(kind==='runs'){title.textContent='Forecast Runs';const rr=RUNS.filter(x=>x.Plant_ID===site);body.innerHTML='<p>Governed forecast executions for the selected plant. Each run carries model versions, horizon, data trust and source mode.</p>'+tbl(['Run','Forecast Horizon (hours)','Physics MWh','Hybrid MWh','Energy at Risk MWh','Data Trust %','Status'],rr.map(x=>[x.Forecast_Run_ID,Number(x.Horizon_Hours),Number(x.Physics_Forecast_MWh).toFixed(2),Number(x.Hybrid_Forecast_MWh).toFixed(2),Number(x.Operational_Energy_At_Risk_MWh).toFixed(2),Number(x.Data_Trust_Pct).toFixed(2),x.Run_Status]),[1,2,3,4,5]);}else if(kind==='validation'){title.textContent='Forecast Validation & Calibration';const rr=PERF.filter(x=>x.Plant_ID===site);body.innerHTML='<p>This is the summary of the interval-level forecast-versus-actual validation dataset.</p>'+tbl(['Forecast Horizon (hours)','Samples','Physics Error %','Hybrid Error %','MAE MW','RMSE MW','Bias MW','Band Reliability %'],rr.map(x=>[Number(x.Horizon_Hours),Number(x.Sample_Count),Number(x.Physics_nMAE_Pct).toFixed(2),Number(x.Hybrid_nMAE_Pct).toFixed(2),Number(x.Hybrid_MAE_MW).toFixed(3),Number(x.Hybrid_RMSE_MW).toFixed(3),Number(x.Bias_MW).toFixed(3),Number(x.Interval_Coverage_Pct).toFixed(1)]),[0,1,2,3,4,5,6,7])+'<div class="gf476-note">MAE = average absolute MW error. RMSE gives more weight to larger misses. Bias shows whether the forecast tends to over- or under-predict.</div>';}else if(kind==='performance'){title.textContent='Model Performance';const rr=PERF.filter(x=>x.Plant_ID===site||x.Plant_ID==='PORTFOLIO');body.innerHTML=tbl(['Scope','Plant','Forecast Horizon (hours)','Samples','Physics Error %','Hybrid Error %','Accuracy Gain %','Range Reliability %'],rr.map(x=>[x.Scope,x.Plant_ID,Number(x.Horizon_Hours),Number(x.Sample_Count),Number(x.Physics_nMAE_Pct).toFixed(2),Number(x.Hybrid_nMAE_Pct).toFixed(2),Number(x.Improvement_vs_Physics_Pct).toFixed(1),Number(x.Interval_Coverage_Pct).toFixed(1)]),[2,3,4,5,6,7]);}else if(kind==='governance'){title.textContent='Forecast Model Governance';body.innerHTML=tbl(['Model','Type','Version','Owner','Algorithm','Primary Metric','Result','Approval'],GOV.map(x=>[x.Model_Name,x.Model_Type,x.Version,x.Owner_Foundation,x.Algorithm,x.Primary_Metric,x.Validation_Result,x.Approval_Status]));}else{title.textContent='Forward Commercial Exposure';const rr=COMM.filter(x=>x.Plant_ID===site);body.innerHTML='<p>The commercial view uses the same Forecast Run ID and governed tariff as the generation forecast.</p>'+tbl(['Exposure','Forecast Horizon (hours)','Hybrid MWh','Shortfall MWh','Tariff ₹/kWh','Forward Exposure'],rr.map(x=>[x.Exposure_ID,Number(x.Horizon_Hours),Number(x.Hybrid_Delivered_MWh).toFixed(2),Number(x.Forecast_Shortfall_MWh).toFixed(2),Number(x.Tariff_INR_per_kWh).toFixed(2),money(x.Forward_Revenue_Exposure_INR)]),[1,2,3,4,5]);}m.classList.add('open')}
function kpi(l,v,s){return `<div class="gf475-kpi"><span>${l}</span><b>${v}</b><small>${s}</small><div class="gf475-bars"><i></i><i></i><i></i><i></i><i></i></div></div>`}
function injectRC(){const v=document.getElementById('view-revenuecommercial');if(!v||v.querySelector('.rc475'))return;const head=v.querySelector('.view-head,.xi-head');if(!head)return;const horizons=[24,48,72,168];const rows=horizons.map(h=>{const rr=COMM.filter(x=>Number(x.Horizon_Hours)===h);return{Horizon_Hours:h,Site_Count:new Set(rr.map(x=>String(x.Plant_ID))).size,Forecast_Shortfall_MWh:rr.reduce((a,x)=>a+Number(x.Forecast_Shortfall_MWh||0),0),Forward_Revenue_Exposure_INR:rr.reduce((a,x)=>a+Number(x.Forward_Revenue_Exposure_INR||0),0)}});const d=document.createElement('div');d.className='rc475';d.innerHTML=`<h3>Forward Forecast Commercial Exposure</h3><div class="rc475-grid">${rows.map(x=>`<div class="rc475-card"><span>Next ${Number(x.Horizon_Hours)===168?'7 days':x.Horizon_Hours+' h'} · Portfolio</span><b>${money(x.Forward_Revenue_Exposure_INR)}</b><small>${Number(x.Forecast_Shortfall_MWh||0).toFixed(2)} MWh portfolio forecast shortfall · governed site tariffs · ${x.Site_Count} sites</small></div>`).join('')}</div>`;head.insertAdjacentElement('afterend',d)}
function enhance(){injectGF();injectRC()}
const oldGF=window.AIPRenderGenerationForecast;if(typeof oldGF==='function')window.AIPRenderGenerationForecast=function(){const z=oldGF.apply(this,arguments);setTimeout(injectGF,0);return z};
/* v524: Asset-to-Value is now a native Decision Intelligence third tab and renders only on demand.
   Forecast performance injection remains directly hooked into AIPRenderGenerationForecast. */
window.AIPEnsureSiteForecastPerformance=injectGF;
window.AIPEnhanceForecastValueIntelligence=enhance;
setTimeout(enhance,250);
window.AIP_V475_AUDIT={release:'v498',baseline:'v497',scope:'Forecast/Data Hardening + Asset-to-Value Intelligence',forecastModel:'real gradient-boosted residual regression trained on synthetic demo history',productionClaim:false,newGovernedSheets:['FCST_Run','FCST_Interval','FCST_Actual','FCST_Validation','FCST_Model_Performance','FCST_Model_Governance','FCST_Commercial_Exposure','PLAN_Outcome_Validation','FCST_DQ_Rules'],excelSyntheticParity:true};
})();
