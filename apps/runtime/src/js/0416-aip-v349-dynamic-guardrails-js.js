
(function(){
'use strict';

const DEFS=[
 {id:'GR-001',control:'Data freshness & validation',domain:'Data'},
 {id:'GR-002',control:'Safety / permit / certification hard stop',domain:'Safety'},
 {id:'GR-003',control:'Consequential action approval',domain:'Authority'},
 {id:'GR-004',control:'Model intended-use boundary',domain:'Model'},
 {id:'GR-005',control:'Model health, drift & review expiry',domain:'Model'},
 {id:'GR-006',control:'External intelligence validation',domain:'Solar IPP external data'},
 {id:'GR-007',control:'Optimization acceptance gate',domain:'Solar IPP planning'},
 {id:'GR-008',control:'Assistant grounding & execution boundary',domain:'Assistant'},
 {id:'GR-009',control:'Override evidence',domain:'Governance'},
 {id:'GR-010',control:'Guardrail decision persistence',domain:'Audit'}
];
const TABS=[
 ['controls','Policy & Autonomy'],
 ['hardstops','Hard Stops'],
 ['evidence','Evidence & Model Use'],
 ['approvals','Approvals & Overrides'],
 ['log','Decision Log']
];
let active='controls';
const esc=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function searchableTable(label,tableHtml,id){
  const sid='aig54-search-'+id;
  return `<div class="aig54-tablehead"><h3>${label}</h3><input id="${sid}" class="aig54-search" type="text" placeholder="Search all columns…" aria-label="Search ${esc(label)}" oninput="window.aig54Filter('${sid}',this.value)"></div>${tableHtml}`;
}

const arr=v=>Array.isArray(v)?v:[];
function currentStore(){
  const mode=String(window.APM_DATA_MODE||'').toLowerCase();
  if(mode.includes('excel') && window.APM_IMPORTED_DATA && Object.keys(window.APM_IMPORTED_DATA).length) return window.APM_IMPORTED_DATA;
  try{const s=window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData;if(s&&Object.keys(s).length)return s}catch(e){}
  try{if(typeof EMBEDDED_EXCEL_DATA!=='undefined')return EMBEDDED_EXCEL_DATA}catch(e){}
  return window.APM_IMPORTED_DATA||{};
}
function rows(name){return arr(currentStore()?.[name])}
function nonblank(r){return r&&Object.values(r).some(v=>v!==null&&v!==undefined&&String(v).trim()!=='')}
function hasRows(name){return rows(name).some(nonblank)}
function textOf(o){return Object.values(o||{}).filter(v=>v!=null).join(' | ')}
function keysText(o){return Object.keys(o||{}).join(' | ')}
function liveDecisions(){return arr(window.AIPGuardrails?.state?.events)}
function governedDecisions(){return arr(window.AIP_GUARDRAIL_DECISIONS).filter(nonblank).concat(rows('AI Guardrail Decisions').filter(nonblank))}
function decisions(){
  const seen=new Set(), out=[];
  [...liveDecisions(),...governedDecisions()].forEach(d=>{
    const k=[d.time||d.Timestamp,d.capability||d.Capability,d.action||d.Action,d.decision||d.Decision||d.Outcome,d.reason||d.Reason].join('|');
    if(!seen.has(k)){seen.add(k);out.push(d)}
  });
  return out;
}
function decText(d){return [d.decision,d.Decision,d.Outcome,d.policy,d.Policy,d.reason,d.Reason,d.action,d.Action].filter(Boolean).join(' | ')}
function observed(rx){return decisions().some(d=>rx.test(decText(d)))}
function modelRows(){
  if(!Array.isArray(window.AIP_MODEL_VALUE_CHAIN)||!window.AIP_MODEL_VALUE_CHAIN.length){
    try{window.renderModels?.()}catch(e){}
  }
  return arr(window.AIP_MODEL_VALUE_CHAIN);
}
function state(hasSource,hasRuntime){
  return hasSource&&hasRuntime?'Configured':(hasSource||hasRuntime)?'Partially configured':'Not configured';
}
function pill(s){
  const c=/not configured/i.test(s)?'missing':/partial/i.test(s)?'partial':'config';
  return `<span class="aig49-pill ${c}">${esc(s)}</span>`;
}
function decisionPill(s){
  const c=/block/i.test(s)?'block':/approval/i.test(s)?'approval':/review/i.test(s)?'review':'allow';
  return `<span class="aig49-pill ${c}">${esc(s||'Allow')}</span>`;
}
function result(id,st,evidence,behaviour,gap){
  const d=DEFS.find(x=>x.id===id);
  return {...d,state:st,evidence,behaviour,gap};
}
function evaluateControls(){
  const ds=decisions();
  const models=modelRows();
  const external=models.filter(m=>String(m.execution).toLowerCase()==='external');
  const externalActive=external.filter(m=>String(m.state).toLowerCase()==='active');
  const externalHealthComplete=externalActive.length>0 && externalActive.every(m=>{
    const k=(keysText(m)+' '+textOf(m)).toLowerCase();
    return /provider|source.?id|endpoint/.test(k)&&/fresh|timestamp/.test(k)&&/quality|health/.test(k)&&/fallback/.test(k);
  });

  const dqSource=hasRows('Data Quality Checks');
  const dqRuntime=observed(/model\/data hard stop|source data failed freshness|stale data|invalid data/i);

  const safetySource=hasRows('PLAN_Readiness')||hasRows('PNO_Resources')||hasRows('PLAN_Requirements');
  const safetyRuntime=observed(/crew safety hard stop|certification is invalid|permit or site-access|permit.*not.*ready/i);

  const approvalSource=hasRows('PNO_Governance')||hasRows('PLAN_Governance_Handoff');
  const approvalRuntime=ds.some(d=>/approval/i.test(String(d.decision||d.Decision||d.Outcome||'')));

  const modelSource=models.length>0;
  const modelRuntime=observed(/associated ai model is degraded|model.*unapproved|model\/data hard stop/i);

  const healthEvidence=models.some(m=>/drift|review.?expiry|validation.?status|performance.?status|health.?status/i.test(keysText(m)));
  const healthRuntime=observed(/model.*degraded|model.*unapproved|review.*expired|drift/i);

  const optimizerSource=hasRows('PNO_Optimization') && (hasRows('PNO_Optimization_Interface')||hasRows('PLAN_Optimization_Config'));
  const optObjs=[...rows('PNO_Optimization'),...rows('PNO_Optimization_Interface'),...rows('PNO_Governance')];
  const optText=optObjs.map(o=>keysText(o)+' '+textOf(o)).join(' | ').toLowerCase();
  const optEvidence=(
    /solver.?status/.test(optText)&&/solution.?id/.test(optText)&&/input.?snapshot/.test(optText)&&
    /feasib/.test(optText)&&/hard.?constraint/.test(optText)
  ) || !!window.AIP_OPTIMIZATION_ACCEPTANCE_EVIDENCE;
  const optRuntime=observed(/optimization.*(infeasible|hard constraint|acceptance)|solver.*(block|reject)/i);

  const assistantSource=models.some(m=>m.id==='EXT-LLM-019') || !!document.getElementById('view-dataexplorer');
  const assistantRuntime=observed(/assistant output is not grounded|grounding and disclosure|ungrounded/i);

  const overrideRows=ds.filter(d=>/override/i.test(decText(d))||d.Override_By||d.overrideBy);
  const overrideComplete=overrideRows.some(d=>
    (d.Override_By||d.overrideBy) && (d.Override_Reason||d.overrideReason||d.reason||d.Reason) &&
    (d.Evidence_Reference||d.evidenceReference) && (d.Outcome||d.outcome)
  );
  const overrideSupport=!!window.AIPGuardrails || rows('AI Guardrail Decisions')!==undefined;

  let persistentEnterprise=false;
  const governed=governedDecisions();
  if(governed.length){
    persistentEnterprise=governed.some(d=>/enterprise|persistent|database|api|eam|erp/i.test(
      [d.Persistence_Mode,d.Storage_Mode,d.Record_ID,d.Decision_ID,d.Source_System].filter(Boolean).join(' ')
    ));
  }
  const browserPersistence=!!window.AIPGuardrails?.state && (()=>{try{return !!window.localStorage}catch(e){return false}})();

  const c=[];
  c.push(result('GR-001',state(dqSource,dqRuntime),
    `${dqSource?rows('Data Quality Checks').filter(nonblank).length+' data-quality records':'No data-quality dataset'}${dqRuntime?' · runtime freshness/validation enforcement observed':''}`,
    'Evaluates stale/invalid context before consequential action.',
    dqSource&&!dqRuntime?'Data-quality evidence exists; no recorded runtime enforcement yet.':!dqSource?'Data-quality evidence is not available in the current data source.':''));

  c.push(result('GR-002',state(safetySource,safetyRuntime),
    `${safetySource?'Planning/resource readiness evidence available':'No planning readiness evidence'}${safetyRuntime?' · permit/certification hard stop observed':''}`,
    'Evaluates permit and mandatory certification context for crew release/assignment.',
    safetySource&&!safetyRuntime?'Readiness evidence exists; no recorded permit/certification enforcement yet.':!safetySource?'Required planning/crew evidence is unavailable.':''));

  c.push(result('GR-003',state(approvalSource,approvalRuntime),
    `${approvalSource?'Planning governance/approval evidence available':'No governed approval source'}${approvalRuntime?' · approval routing observed':''}`,
    'Routes applicable high-impact actions to human approval.',
    approvalSource&&!approvalRuntime?'Approval/governance data exists; no recorded guardrail approval outcome yet.':!approvalSource?'No governed approval source is available.':''));

  c.push(result('GR-004',state(modelSource,modelRuntime),
    `${modelSource?models.length+' registry capabilities available':'Model registry unavailable'}${modelRuntime?' · model-status enforcement observed':''}`,
    'Uses model configuration/status context to constrain model-assisted action.',
    modelSource&&!modelRuntime?'Registry exists; runtime model-status enforcement has not yet been evidenced.':!modelSource?'Model registry evidence is unavailable.':''));

  c.push(result('GR-005',state(healthEvidence,healthRuntime),
    `${healthEvidence?'Model health/drift/review metadata detected':'No model health/drift/review metadata'}${healthRuntime?' · model-health enforcement observed':''}`,
    'Requires model health, drift and review-expiry evidence before reliable operational use.',
    !healthEvidence?'Dedicated model health/drift/review evidence is absent.':!healthRuntime?'Health metadata exists; runtime enforcement has not yet been evidenced.':''));

  let extState='Not configured';
  if(externalActive.length>0) extState=externalHealthComplete?'Configured':'Partially configured';
  c.push(result('GR-006',extState,
    `${external.length} external capabilities · ${externalActive.length} configured${externalHealthComplete?' · source-health fields complete':''}`,
    'Validates external intelligence before it is accepted as operational evidence.',
    externalActive.length===0?'No external capability is currently configured.':!externalHealthComplete?'Configured external capability lacks complete provider/freshness/quality/fallback evidence.':''));

  const optState=optEvidence&&(optRuntime||optimizerSource)?'Configured':optimizerSource||optRuntime?'Partially configured':'Not configured';
  c.push(result('GR-007',optState,
    `${optimizerSource?'Optimization/interface data available':'Optimization acceptance source unavailable'}${optEvidence?' · solver/solution/snapshot/feasibility/hard-constraint evidence complete':''}${optRuntime?' · acceptance enforcement observed':''}`,
    'Accepts an optimized plan only when solver result, feasibility and governed hard constraints are evidenced.',
    !optimizerSource?'Optimization evidence is unavailable.':!optEvidence?'Optimization exists, but the complete acceptance evidence contract is not present.':!optRuntime?'Acceptance evidence exists; no recorded enforcement event yet.':''));

  c.push(result('GR-008',state(assistantSource,assistantRuntime),
    `${assistantSource?'Assistant/runtime boundary present':'Assistant runtime unavailable'}${assistantRuntime?' · grounding enforcement observed':''}`,
    'Blocks ungrounded assistant output when grounding context is supplied.',
    assistantSource&&!assistantRuntime?'Grounding control exists; no recorded grounding block yet.':!assistantSource?'Assistant runtime evidence is unavailable.':''));

  c.push(result('GR-009',overrideComplete?'Configured':overrideSupport?'Partially configured':'Not configured',
    overrideRows.length?`${overrideRows.length} override-related decision record(s)${overrideComplete?' with complete approver/reason/evidence/outcome':''}`:'Decision log supports reason/evidence fields; no complete override record observed',
    'Retains the human override decision and supporting governance evidence.',
    overrideComplete?'':'A complete override record requires approver, reason, supporting evidence and outcome.'));

  c.push(result('GR-010',persistentEnterprise?'Configured':browserPersistence||governed.length?'Partially configured':'Not configured',
    `${browserPersistence?'Browser-session decision persistence available':''}${governed.length?` · ${governed.length} governed decision record(s) loaded`:''}${persistentEnterprise?' · enterprise persistence evidence detected':''}` || 'No persistence evidence',
    'Retains guardrail decisions beyond the individual evaluation.',
    persistentEnterprise?'':'Current evidence does not prove an enterprise persistent audit store.'));

  return c;
}
function controlTable(list){
  return `<div class="aig49-tablewrap"><table class="aig49-table"><thead><tr><th>Control</th><th>Domain</th><th>State</th><th>Current evidence</th><th>Current behaviour / gap</th></tr></thead><tbody>${
    list.map(r=>`<tr><td><b>${esc(r.control)}</b></td><td>${esc(r.domain)}</td><td>${pill(r.state)}</td><td>${esc(r.evidence)}</td><td>${esc(r.behaviour)}${r.gap?`<div class="aig49-muted" style="margin-top:3px">${esc(r.gap)}</div>`:''}</td></tr>`).join('')
  }</tbody></table></div>`;
}
function guidance(cs){
  const gaps=cs.filter(r=>r.state!=='Configured');
  return `<div class="aig49-panel"><h3>Open control gaps</h3><div class="aig49-guidance">${
    gaps.map(r=>`<div class="aig49-guide"><b>${esc(r.control)} · ${esc(r.state)}</b>${esc(r.gap||'Additional runtime evidence is required before this control can be asserted as configured.')}</div>`).join('')
    || '<div class="aig49-empty">All guardrail controls have configured evidence.</div>'
  }</div></div>`;
}
function controls(cs){return `<div class="aig49-panel aig50-wide">${searchableTable('Guardrail control status',controlTable(cs),'policy')}</div>`}
function hardstops(cs){
  const map=[
    ['Data stale / invalid','GR-001'],
    ['Certification / permit not ready','GR-002'],
    ['Model degraded / review invalid','GR-005'],
    ['External source invalid / unavailable','GR-006'],
    ['Optimization infeasible / hard constraint violated','GR-007']
  ];
  return `<div class="aig49-panel"><h3>Hard stops</h3><div class="aig49-hard">${
    map.map(([name,id])=>{const r=cs.find(x=>x.id===id);return `<div class="aig49-control"><div class="head"><h4>${esc(name)}</h4>${pill(r.state)}</div><div class="aig49-muted">${esc(r.behaviour)}</div><div class="aig49-source">Evidence: ${esc(r.evidence)}</div></div>`}).join('')
  }</div></div>`;
}
function evidence(cs){
  const ids=['GR-001','GR-004','GR-005','GR-006','GR-007','GR-008'];
  return `<div class="aig49-panel">${searchableTable('Evidence & model-use controls',controlTable(cs.filter(r=>ids.includes(r.id))),'evidence')}</div>`;
}
function approvals(cs){
  const ids=['GR-003','GR-009','GR-010'];
  const ovs=decisions().filter(d=>/override/i.test(decText(d))||d.Override_By||d.overrideBy);
  return `<div class="aig51-stack">
    <div class="aig49-panel aig51-full">${searchableTable('Approval & override controls',controlTable(cs.filter(r=>ids.includes(r.id))),'approvals')}</div>
    <div class="aig49-panel aig51-full"><h3>Observed override evidence</h3>${
      ovs.length?`<div class="aig49-tablewrap aig51-wrap"><table class="aig49-table aig51-table"><thead><tr><th>Action</th><th>Approver</th><th>Reason</th><th>Evidence</th><th>Outcome</th></tr></thead><tbody>${
        ovs.map(d=>`<tr><td>${esc(d.action||d.Action||'')}</td><td>${esc(d.Override_By||d.overrideBy||'Not recorded')}</td><td>${esc(d.Override_Reason||d.overrideReason||d.reason||d.Reason||'Not recorded')}</td><td>${esc(d.Evidence_Reference||d.evidenceReference||'Not recorded')}</td><td>${esc(d.Outcome||d.outcome||'Not recorded')}</td></tr>`).join('')
      }</tbody></table></div>`:'<div class="aig49-empty">No override decision has been recorded.</div>'
    }</div>
  </div>`;
}
function log(){
  const ds=decisions().slice(0,100);
  return `<div class="aig49-panel"><div class="aig54-tablehead"><h3>Guardrail Decision Log</h3><input id="aig54-search-log" class="aig54-search" type="text" placeholder="Search all columns…" aria-label="Search Guardrail Decision Log" oninput="window.aig54Filter('aig54-search-log',this.value)"></div><div class="aig49-log-note">Only actual runtime or loaded governed decision records are shown.</div>${
    ds.length?`<div class="aig49-tablewrap"><table class="aig49-table"><thead><tr><th>Decision ID</th><th>Timestamp</th><th>Capability</th><th>Action</th><th>Decision</th><th>Policy</th><th>Reason</th></tr></thead><tbody>${
      ds.map(d=>`<tr data-aig-decision-id="${esc(d.Decision_ID||d.id||'')}"><td><b>${esc(d.Decision_ID||d.id||'')}</b></td><td>${esc(d.time||d.Timestamp||d.Decision_Timestamp||'')}</td><td>${esc(d.capability||d.Capability||d.Module||'')}</td><td>${esc(d.action||d.Action||'')}</td><td>${decisionPill(d.decision||d.Decision||d.Outcome)}</td><td>${esc(d.policy||d.Policy||'')}</td><td>${esc(d.reason||d.Reason||'')}</td></tr>`).join('')
    }</tbody></table></div>`:'<div class="aig49-empty">No guardrail decisions recorded.</div>'
  }</div>`;
}
function kpi(label,value,idx){
  return `<div class="aig49-kpi" data-aig49-kpi="${idx}"><div class="label">${esc(label)}</div><div class="value">${Number(value||0).toLocaleString('en-IN')}</div><span class="aig49-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div>`;
}
function content(cs){
  return active==='controls'?controls(cs):active==='hardstops'?hardstops(cs):active==='evidence'?evidence(cs):active==='approvals'?approvals(cs):log();
}
function render(){
  const v=document.getElementById('view-guardrails'); if(!v)return;
  const cs=evaluateControls(), ds=decisions();
  const approval=ds.filter(d=>/approval/i.test(String(d.decision||d.Decision||d.Outcome||''))).length;
  const review=ds.filter(d=>/review/i.test(String(d.decision||d.Decision||d.Outcome||''))).length;
  const blocked=ds.filter(d=>/block/i.test(String(d.decision||d.Decision||d.Outcome||''))).length;
  const configured=cs.filter(r=>r.state==='Configured').length;
  const partial=cs.filter(r=>r.state==='Partially configured').length;
  const missing=cs.filter(r=>r.state==='Not configured').length;
  v.dataset.fullCoverage='1';
  v.innerHTML=`<div class="view-head"><div><h1>AI Guardrails</h1></div></div>
    <div class="aig49-kpis">${kpi('Actions evaluated',ds.length,1)}${kpi('Approval required',approval,2)}${kpi('Manual review',review,3)}${kpi('Blocked actions',blocked,4)}</div>
    <div class="aig49-tabs">${TABS.map(t=>`<button class="aig49-tab ${active===t[0]?'active':''}" onclick="window.aig49Tab('${t[0]}')">${t[1]}</button>`).join('')}</div>
    <div id="aig49-content">${content(cs)}</div>`;
  try{window.ensureF1HelpEverywhere?.(v)}catch(e){}
}
window.aig49Tab=function(t){active=t;render()};
window.renderAIGuardrails=render;
window.AIP_GUARDRAIL_DYNAMIC_CONTROLS=()=>evaluateControls();
try{
 if(typeof V2_HELP!=='undefined')V2_HELP.guardrails={
  title:'AI Guardrails',
  what:'Evidence-derived controls for AI/model-assisted Solar IPP decisions. The control catalogue stays visible; each state is recalculated from current AIP configuration, data and recorded enforcement evidence.',
  metrics:[
   {name:'Configured',desc:'Required source/configuration and operational evidence are present for the control.'},
   {name:'Partially configured',desc:'Some required source, configuration or runtime evidence is present, but the control is incomplete.'},
   {name:'Not configured',desc:'The control remains required, but the evidence needed to assert it as operational is absent.'},
   {name:'Actions evaluated',desc:'Actual guardrail decision records only; no seeded history.'}
  ],
  interact:'Use Policy & Autonomy, Hard Stops, Evidence & Model Use, Approvals & Overrides and Decision Log. Monitoring is represented by the four live outcome KPIs and is not repeated as a separate tab.',
  tip:'Changing AIP data/configuration or recording new guardrail outcomes can change control states and counts automatically.',
  spec:'Current AIP evidence/configuration + runtime enforcement evidence → dynamic control state → Allow / Approval / Manual Review / Block → decision record.'
 };
}catch(e){}
document.addEventListener('apm:datasource-refreshed',()=>{if(document.getElementById('view-guardrails')?.classList.contains('active'))render()});
window.addEventListener('storage',e=>{if(e.key==='aipGuardrailEventsV25'&&document.getElementById('view-guardrails')?.classList.contains('active'))render()});
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(document.getElementById('view-guardrails')?.classList.contains('active'))render()},900));
})();
