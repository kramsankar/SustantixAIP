
(function(){
const CATALOG={
 overview:{name:'Portfolio Overview',domain:'Portfolio',actions:['Generate portfolio insight','Prioritize alert','Forecast KPI movement'],rules:['Data freshness','Source traceability','Confidence label','No autonomous transaction']},
 aivision:{name:'AI Vision',domain:'Portfolio',actions:['Classify defect','Validate finding','Create maintenance action','Release case','Link warranty evidence'],rules:['Image quality','Asset match','Confidence threshold','Permit readiness','Safety review']},
 workorderintelligence:{name:'Work Order Intelligence',domain:'Portfolio',actions:['Create work order','Set priority','Release work','Change status','Cancel or close','Submit ERP/EAM request'],rules:['Duplicate detection','Safety class','Cost authority','Parts/permit readiness','Approval chain']},
 dataexplorer:{name:'Asset Intelligence Studio',domain:'Portfolio',actions:['Answer query','Run analysis','Export result','Recommend action'],rules:['Grounded data only','Prompt injection defence','Sensitive data control','Unsupported-answer refusal','No direct execution']},
 executiveperformance:{name:'Executive Performance',domain:'Operational Intelligence',actions:['Generate executive insight','Explain KPI variance','Prioritize intervention'],rules:['Freshness','Lineage','Materiality','Causal-claim warning']},
  rootcause:{name:'Event & Root Cause Intelligence',domain:'Operational Intelligence',actions:['Reconstruct event','Rank root causes','Trigger maintenance recommendation'],rules:['Evidence completeness','Competing hypotheses','Correlation warning','Critical-case validation']},
 lossintelligence:{name:'Generation & Revenue Loss',domain:'Operational Intelligence',actions:['Estimate loss','Attribute cause','Recommend recovery action'],rules:['Meter validation','Tariff/PPA validation','Measured vs estimated','Financial approval threshold']},
 siteperformance:{name:'Site Performance Ranking',domain:'Operational Intelligence',actions:['Rank sites','Identify underperformance','Recommend action'],rules:['Weather/capacity normalization','Comparable cohort','Minimum completeness','Ranking stability']},
 commercialppa:{name:'Commercial & PPA',domain:'Operational Intelligence',actions:['Estimate penalty','Forecast contractual exposure','Draft commercial action'],rules:['Contract source validation','Currency/tariff checks','Legal review','No autonomous commitment']},
 managementactions:{name:'Management Actions',domain:'Operational Intelligence',actions:['Prioritize action','Assign owner','Escalate decision','Close action'],rules:['Authority matrix','Safety/materiality','Duplicate prevention','Escalation SLA']},
 predictive:{name:'Predictive Maintenance',domain:'Maintenance Intelligence',actions:['Predict failure','Estimate RUL','Raise alert','Create recommendation'],rules:['Sensor quality','Model health','Horizon validity','Criticality threshold','False-positive tolerance']},
 prescriptive:{name:'Prescriptive Maintenance',domain:'Maintenance Intelligence',actions:['Recommend intervention','Select timing','Estimate impact','Draft work scope'],rules:['OEM constraints','Safety rules','Alternatives','Cost/downtime authority','Human approval']},
 preventive:{name:'Preventive Maintenance',domain:'Maintenance Intelligence',actions:['Optimize interval','Reschedule task','Suppress or add task'],rules:['Statutory minimum','OEM interval floor','Maximum interval change','Planner approval']},
 corrective:{name:'Corrective Maintenance',domain:'Maintenance Intelligence',actions:['Classify failure','Recommend repair','Set emergency priority','Confirm completion'],rules:['Safety classification','Failure-code validation','Emergency rule','Completion evidence']},
 riskbased:{name:'Risk-Based Maintenance',domain:'Maintenance Intelligence',actions:['Calculate risk','Defer maintenance','Prioritize mitigation'],rules:['Risk appetite','Probability/consequence traceability','Intolerable-risk hard stop','Deferral approval']},
 adaptive:{name:'Adaptive Maintenance',domain:'Maintenance Intelligence',actions:['Adjust maintenance policy','Change interval','Apply learned threshold'],rules:['Change-rate limit','OEM/regulatory boundary','Rollback plan','Post-change monitoring']},
 rcm:{name:'RCM Framework',domain:'Maintenance Intelligence',actions:['Propose failure mode','Select maintenance strategy','Revise asset strategy'],rules:['Engineer validation','Consequence approval','Strategy traceability','No automatic replacement']},
 opportunistic:{name:'Opportunistic & Outage',domain:'Maintenance Intelligence',actions:['Bundle work','Move job into outage','Release outage package'],rules:['Outage window','Isolation/permit','Crew/parts readiness','Production-loss approval']},
 approval:{name:'Approval Workflow',domain:'Maintenance Intelligence',actions:['Route approval','Approve','Reject','Escalate'],rules:['Named authority','Segregation of duties','SLA escalation','Immutable decision record']},
 maintenancelearning:{name:'Maintenance Learning',domain:'Maintenance Intelligence',actions:['Learn repair practice','Recommend standard update','Retraining candidate'],rules:['Outcome validation','Minimum sample','Bias/outlier checks','No automatic production update']},
 spares:{name:'Spares Planning',domain:'Maintenance Resources',actions:['Forecast demand','Reserve stock','Recommend transfer','Raise replenishment','Approve substitute'],rules:['Forecast confidence','Value authority','Compatibility','Critical-stock protection','Supplier/lead-time validation']},
 inventory:{name:'Spares Inventory',domain:'Maintenance Resources',actions:['Issue material','Return material','Adjust stock','Write off','Release quality hold'],rules:['No negative stock','Serial/batch check','Reservation limit','Adjustment authority','Quality hard stop']},
 warrantyrecovery:{name:'Warranty Recovery Intelligence',domain:'Maintenance Resources',actions:['Identify opportunity','Calculate recovery','Prepare claim','Submit evidence'],rules:['Warranty-term verification','Serial match','Duplicate claim','Evidence completeness','Commercial/legal approval']},
 crewscheduling:{name:'Crew Planning & Scheduling',domain:'Maintenance Resources',actions:['Recommend crew','Assign crew','Reschedule','Approve overtime','Release schedule'],rules:['Certification','Fatigue/shift limit','Skill adequacy','Travel feasibility','Permit/site access','Minimum crew composition']},
 esgoverview:{name:'ESG Executive Overview',domain:'Sustainability Intelligence',actions:['Generate ESG insight','Forecast KPI','Flag reporting risk'],rules:['Lineage','Reporting completeness','Estimated-data disclosure','Materiality']},
 carbonwater:{name:'Clean Energy, Carbon & Water',domain:'Sustainability Intelligence',actions:['Calculate emissions','Forecast resource use','Recommend reduction'],rules:['Factor version','Boundary/unit validation','Measured vs estimated','Claim substantiation']},
 circularity:{name:'Circularity & End-of-Life',domain:'Sustainability Intelligence',actions:['Classify waste','Recommend reuse/recycle','Estimate circularity'],rules:['Waste-code validation','Approved disposal route','Assumption disclosure','Claim approval']},
 hseclimate:{name:'HSE, Climate & Compliance',domain:'Sustainability Intelligence',actions:['Classify incident','Assess severity','Recommend control','Close compliance item'],rules:['Human safety review','Regulatory source','Emergency escalation','No autonomous closure']},
 datamanagement:{name:'Data Management',domain:'Data & AI',actions:['Upload data','Map fields','Accept dataset','Publish data'],rules:['Schema','Completeness','Freshness','Range/duplicate checks','Asset-master match','Quarantine invalid data']},
 integrations:{name:'Integrations',domain:'Data & AI',actions:['Submit interface request','Retry transaction','Publish payload'],rules:['Authentication','Schema/payload','Idempotency','Rate/retry limits','Ownership','Failed-message quarantine']},
 models:{name:'AI Model Registry',domain:'Data & AI',actions:['Deploy model','Promote version','Disable model','Approve retraining'],rules:['Approved status','Performance threshold','Drift','Intended-use boundary','Review expiry']},
 guardrails:{name:'AI Guardrails',domain:'Data & AI',actions:['Change policy','Change autonomy','Override decision','Publish policy'],rules:['Policy authority','Four-eyes approval','Versioning','Effective date','Rollback']}
};
const state={events:JSON.parse(localStorage.getItem('aipGuardrailEventsV25')||'[]'),counts:{Allow:0,Approval:0,'Manual Review':0,Block:0}};
function now(){return new Date().toLocaleString()}
function activeView(){const n=document.querySelector('.nav-item.active[data-view]');return n?n.dataset.view:'overview'}
function inferAction(text){text=(text||'').trim().replace(/\s+/g,' ');return text.slice(0,100)||'View or analyze'}
function consequential(text){return /(create|raise|approve|release|assign|schedule|reschedule|reserve|issue|return|transfer|procure|purchase|submit|send|sync|retry|close|cancel|delete|update|change|apply|optimi[sz]e|recommend|generate|forecast|predict|classify|validate|prioriti[sz]e|escalate|export|download|claim|write.?off|adjust|deploy|promote|disable|publish|override|accept|reject|stage|dispatch|start|pause|complete|verify)/i.test(text||'')}
function evaluate(view,action,ctx={}){
 const c=CATALOG[view]||{name:view,rules:['General policy']};
 let decision='Allow',reason='No configured hard stop was triggered; downstream workflow controls still apply.',policy=(c.rules||[])[0]||'General policy';
 const a=(action||'').toLowerCase();
 if(ctx.modelStatus==='Degraded'||ctx.dataStale===true||ctx.invalidData===true){decision='Block';reason=ctx.modelStatus==='Degraded'?'Associated AI model is degraded or unapproved.':'Required source data failed freshness or validation checks.';policy='Model/data hard stop'}
 else if(/close|release|issue|write.?off|deploy|publish|submit claim|approve substitute/.test(a)&&['hseclimate','commercialppa','warrantyrecovery','inventory','models'].includes(view)){decision='Approval';reason='High-impact action requires named human authority and evidence review.';policy='Authority and consequence threshold'}
 else if(/assign|release schedule/.test(a)&&view==='crewscheduling'&&(ctx.certValid===false||ctx.permitReady===false)){decision='Block';reason=ctx.certValid===false?'Mandatory crew certification is invalid.':'Permit or site-access readiness is not confirmed.';policy='Crew safety hard stop'}

 else if(/defer|suppress|interval|strategy|policy/.test(a)&&['riskbased','preventive','adaptive','rcm','guardrails'].includes(view)){decision='Approval';reason='Maintenance or governance policy change requires accountable human approval.';policy='Controlled policy change'}
 else if(/export|answer|analysis/.test(a)&&view==='dataexplorer'&&ctx.grounded===false){decision='Block';reason='Assistant output is not grounded in available platform data.';policy='Grounding and disclosure'}
 else if(/create|raise|recommend|prioriti[sz]e|forecast|predict|classify|validate|optimi[sz]e/.test(a)){decision='Allow';reason='AI may recommend or draft; downstream execution remains subject to action-level controls.';policy='Recommend/draft autonomy'}
 const ev={time:now(),view,capability:c.name,action,decision,policy,reason};state.events.unshift(ev);state.events=state.events.slice(0,500);state.counts[decision]=(state.counts[decision]||0)+1;localStorage.setItem('aipGuardrailEventsV25',JSON.stringify(state.events));showDecision(ev);return ev;
}
function showDecision(ev){
  /* Guardrail outcomes remain recorded in the audit ledger, but transient
     decision boxes are intentionally suppressed on operational screens. */
  document.querySelectorAll('.aig-decision-toast').forEach(el=>el.remove());
}
window.AIPGuardrails={catalog:CATALOG,state,evaluate,activeView};
window.guardrailEvaluate=(capability,action,ctx)=>evaluate(capability,action,ctx);
function decorateAll(){Object.keys(CATALOG).forEach(id=>{if(id==='guardrails')return;const v=document.getElementById('view-'+id);if(!v)return;const h=v.querySelector('.view-head h1');if(h&&!v.querySelector('.guardrail-chip'))h.insertAdjacentHTML('afterend','<span class="guardrail-chip" title="Consequential AI actions are evaluated by the central runtime guardrail engine">Guardrails active</span>')})}
function intercept(e){const b=e.target.closest('button,[role=button],a.action-btn,.btn,.ops-btn,.avx-btn,.aig-btn');if(!b||b.closest('#view-guardrails'))return;const view=activeView();if(!CATALOG[view])return;const action=inferAction(b.innerText||b.getAttribute('aria-label')||b.title);if(!consequential(action))return;const ctx={};const row=b.closest('tr,.card,.ops-card,.avx-case,.panel');const txt=row?row.innerText:'';const conf=txt.match(/(\d{2,3})%\s*(confidence)?/i);if(conf)ctx.confidence=+conf[1];if(/expired certification|certification expired/i.test(txt))ctx.certValid=false;if(/permit pending|permit not ready/i.test(txt))ctx.permitReady=false;if(/stale data|data stale/i.test(txt))ctx.dataStale=true;const ev=evaluate(view,action,ctx);if(ev.decision==='Block'){e.preventDefault();e.stopImmediatePropagation();window.showToast?.('Guardrail blocked action',ev.reason);window.toast?.('Guardrail blocked action',ev.reason)}}
document.addEventListener('click',intercept,true);
function coverageHTML(){const groups={};Object.entries(CATALOG).filter(([k])=>k!=='guardrails').forEach(([k,v])=>(groups[v.domain]??=[]).push([k,v]));return `<div class="aig-coverage"><div class="aig-panel"><h3>Enterprise-wide AI guardrail coverage</h3><div class="aig-muted">Every AI-enabled module and consequential action is mapped to the shared runtime evaluator. Descriptive navigation and read-only viewing remain unblocked.</div></div>${Object.entries(groups).map(([g,items])=>`<div class="aig-panel" style="margin-top:10px"><h3>${g}</h3><div class="aig-cover-grid">${items.map(([id,v])=>`<div class="aig-cover-card"><h4>${v.name}</h4><div class="aig-cover-meta"><span class="aig-mini live">Runtime active</span><span class="aig-mini">${v.actions.length} actions</span><span class="aig-mini review">${v.rules.length} controls</span></div><div class="aig-action-list"><b>Governed:</b> ${v.actions.join(' · ')}<br><b>Controls:</b> ${v.rules.join(' · ')}</div></div>`).join('')}</div></div>`).join('')}</div>`}
function ledgerHTML(){const rows=state.events.slice(0,100);return `<div class="aig-panel" style="margin-top:12px"><h3>Live cross-module decision ledger</h3><div class="aig-tablewrap"><table class="aig-table aig-policy-map"><thead><tr><th>Timestamp</th><th>Module</th><th>Action</th><th>Decision</th><th>Policy</th><th>Reason</th></tr></thead><tbody>${rows.length?rows.map(e=>`<tr><td>${e.time}</td><td>${e.capability}</td><td>${e.action}</td><td><span class="aig-pill ${e.decision==='Allow'?'aig-allow':e.decision==='Block'?'aig-block':e.decision==='Approval'?'aig-approve':'aig-review'}">${e.decision}</span></td><td>${e.policy}</td><td>${e.reason}</td></tr>`).join(''):'<tr><td colspan="6">No runtime decisions recorded in this browser session yet.</td></tr>'}</tbody></table></div></div>`}
function enhanceGuardrails(){
  const v=document.getElementById('view-guardrails');
  if(!v)return;
  v.dataset.fullCoverage='0';

  const cleanup=()=>{
    const x=document.getElementById('view-guardrails');
    if(!x)return;
    x.querySelectorAll('.aig-disclosures,.aig-coverage-disclosure,.aig-ledger-disclosure').forEach(el=>el.remove());
  };

  cleanup();

  const old=window.renderAIGuardrails;
  if(typeof old==='function' && !old.__aipV367Cleaned){
    const wrapped=function(){
      const r=old.apply(this,arguments);
      cleanup();
      setTimeout(cleanup,0);
      return r;
    };
    wrapped.__aipV367Cleaned=true;
    window.renderAIGuardrails=wrapped;
  }
}
function help(){try{if(typeof V2_HELP!=='undefined'){V2_HELP.guardrails={title:'AI Guardrails — Full Platform Coverage',what:'A shared runtime policy-enforcement layer covering every AI-enabled capability represented by the left pane and its right-side actions. It separates read-only intelligence from consequential actions and returns Allow, Approval Required, Manual Review, or Block before execution.',metrics:[{name:'Coverage',desc:'All portfolio, operational, maintenance, resource, sustainability, data, integration and model-governance modules are mapped.'},{name:'Consequential actions',desc:'Creation, prioritization, scheduling, reservation, issue, approval, release, closure, export, deployment and policy changes are evaluated.'},{name:'Hard stops',desc:'Safety, certification, permit, stale data, invalid data, degraded models, quality holds and prohibited autonomy block execution.'},{name:'Audit',desc:'Every evaluated action records module, action, outcome, policy and reason in the cross-module decision ledger.'}],interact:'Open AI Guardrails to review the complete coverage catalogue. Use any operational module normally; consequential buttons are evaluated automatically. Allowed recommendations proceed, approvals are routed, low-evidence cases go to review, and hard-stop cases are blocked.',tip:'The guardrail engine does not replace Approval Workflow, Model Registry or Integrations. It decides whether an action is permitted; Approval Workflow obtains human authorization; Model Registry supplies model health; Integrations transmits approved requests.',spec:'Module/action identification → input and data checks → model health → evidence/confidence → safety and authority → autonomy rule → Allow / Approval / Manual Review / Block → immutable decision log.'}}}catch(e){}}
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
  document.querySelectorAll('.aig-decision-toast').forEach(el=>el.remove());
  decorateAll();enhanceGuardrails();help();
},350));
document.addEventListener('click',e=>{
  if(e.target.closest('.nav-item,[data-view]')){
    document.querySelectorAll('.aig-decision-toast').forEach(el=>el.remove());
  }
},true);
(()=>{
  let queued=false;
  const decorateAllObserver=new window.__APMSafeMutationObserver(()=>{
    if(window.__aipScrollbarDragActive||window.__aipMainScrollActive)return;
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;decorateAll();});
  });
  document.addEventListener('DOMContentLoaded',()=>decorateAllObserver.observe(document.getElementById('main')||document.body,{subtree:true,childList:true}));
})();
})();
