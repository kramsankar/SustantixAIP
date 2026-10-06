
(function(){
  const POLICY_ROWS=[
    {id:'GR-001',control:'Data freshness & validation',domain:'Data',state:'Partially configured',source:'Data Quality Checks',behaviour:'Stale or invalid context can block an action.',gap:'Data-quality results are not yet injected into every guarded action.'},
    {id:'GR-002',control:'Safety / permit / certification hard stop',domain:'Safety',state:'Partially configured',source:'Planning readiness / crew / prerequisite data',behaviour:'Crew release can be blocked when invalid certification or permit context is supplied.',gap:'Runtime linkage is not universal across maintenance actions.'},
    {id:'GR-003',control:'Consequential action approval',domain:'Authority',state:'Partially configured',source:'Approval Workflow / planning governance',behaviour:'Selected high-impact actions route to human approval.',gap:'No single governed enterprise approval matrix is sourced into Guardrails.'},
    {id:'GR-004',control:'Model intended-use boundary',domain:'Model',state:'Partially configured',source:'AI Model Registry',behaviour:'Registry identifies capability, source and configuration state.',gap:'Approved intended-use and review-expiry metadata are incomplete.'},
    {id:'GR-005',control:'Model health, drift & review expiry',domain:'Model',state:'Not configured',source:'Not present',behaviour:'No reliable runtime hard stop can be asserted.',gap:'Dedicated model-operations evidence is absent.'},
    {id:'GR-006',control:'External intelligence validation',domain:'Solar IPP external data',state:'Not configured',source:'AI Model Registry — external capabilities',behaviour:'No external source-health enforcement today.',gap:'Required for weather, satellite/geospatial, OEM diagnostic and market/grid forecast integrations.'},
    {id:'GR-007',control:'Optimization acceptance gate',domain:'Planning & Optimization',state:'Not configured',source:'PNO governance / policy / scheduling rules',behaviour:'Optimized maintenance plans are not yet subject to a single runtime acceptance gate.',gap:'Wire solver status, solution ID, input snapshot, feasibility and hard-constraint evidence into the AIP optimization handoff.'},
    {id:'GR-008',control:'Assistant grounding & execution boundary',domain:'Assistant',state:'Partially configured',source:'Asset Intelligence Studio runtime',behaviour:'Ungrounded output can be blocked when grounding context is supplied.',gap:'Grounding and provenance are not yet governed configuration data.'},
    {id:'GR-009',control:'Override evidence',domain:'Governance',state:'Partially configured',source:'Runtime guardrail decision record',behaviour:'Decision and reason can be recorded in the browser session.',gap:'Persistent override reason, approver, evidence and outcome are not yet governed.'},
    {id:'GR-010',control:'Guardrail decision persistence',domain:'Audit',state:'Partially configured',source:'Browser runtime decision log',behaviour:'Current-session evaluations can be recorded.',gap:'Persistent enterprise audit storage is not configured.'}
  ];
  const TABS=[
    ['controls','Policy & Autonomy'],
    ['hardstops','Hard Stops'],
    ['evidence','Evidence & Model Use'],
    ['approvals','Approvals & Overrides'],
    ['monitoring','Monitoring'],
    ['log','Decision Log']
  ];
  let active='controls';
  const esc=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function decisions(){
    try{
      const live=window.AIPGuardrails?.state?.events;
      if(Array.isArray(live)) return live;
      if(Array.isArray(window.AIP_GUARDRAIL_DECISIONS)) return window.AIP_GUARDRAIL_DECISIONS;
      return (window.EMBEDDED_EXCEL_DATA||{})['AI Guardrail Decisions']||[];
    }catch(e){return []}
  }
  function stateClass(s){return /not configured/i.test(s)?'missing':/partial/i.test(s)?'partial':'config'}
  function pill(s){return `<span class="aig40-pill ${stateClass(s)}">${esc(s)}</span>`}
  function decisionPill(s){const c=/block/i.test(s)?'block':/approval/i.test(s)?'approval':/review/i.test(s)?'review':'allow';return `<span class="aig40-pill ${c}">${esc(s||'Allow')}</span>`}
  function controlTable(rows=POLICY_ROWS){
    return `<div class="aig40-tablewrap"><table class="aig40-table"><thead><tr><th>Control</th><th>Domain</th><th>State</th><th>Current evidence</th><th>Current behaviour / gap</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.control)}</b></td><td>${esc(r.domain)}</td><td>${pill(r.state)}</td><td>${esc(r.source)}</td><td>${esc(r.behaviour)}${r.gap?`<div class="aig40-muted" style="margin-top:3px">${esc(r.gap)}</div>`:''}</td></tr>`).join('')}</tbody></table></div>`
  }
  function guidance(){
    const priority=POLICY_ROWS.filter(r=>r.state==='Not configured');
    return `<div class="aig40-panel"><h3>Priority control gaps</h3><div class="aig40-guidance">${priority.map(r=>`<div class="aig40-guide"><b>${esc(r.control)}</b>${esc(r.gap)}<div class="aig40-muted" style="margin-top:4px"><strong>Action:</strong> ${r.id==='GR-005'?'Connect model validation, performance/drift and review status.':r.id==='GR-006'?'Configure source identity, timestamp, quality, availability, permitted use and fallback.':r.id==='GR-007'?'Connect solver status, solution ID, input snapshot, feasibility and hard-constraint evidence.':'Complete required evidence and runtime linkage.'}</div></div>`).join('')||'<div class="aig40-empty">No unconfigured priority controls.</div>'}</div></div>`
  }
  function controls(){
    return `<div class="aig40-grid"><div class="aig40-panel"><h3>Guardrail control status</h3>${controlTable()}</div>${guidance()}</div>`
  }
  function hardstops(){
    const cards=[
      ['Data stale / invalid','Partially configured','Data Quality Checks','Block only when stale or invalid context is supplied to the evaluator.'],
      ['Certification invalid','Partially configured','Crew / planning readiness','Blocks crew assignment/release when certification-invalid context is supplied.'],
      ['Permit / access not ready','Partially configured','Execution prerequisites','Blocks crew release when permit-not-ready context is supplied.'],
      ['Model degraded / unapproved','Not configured','Model-operations evidence absent','Required before model health can become a reliable hard stop.'],
      ['Optimization infeasible / hard constraint violated','Not configured','PNO governance / solver result','Must block acceptance of an optimized plan when solver or governed constraints fail.'],
      ['External source stale / unavailable','Not configured','External capabilities not integrated','Must prevent external model/data output from being treated as current evidence.']
    ];
    return `<div class="aig40-panel"><h3>Hard stops</h3><div class="aig40-hard">${cards.map(c=>`<div class="aig40-control"><div class="head"><h4>${esc(c[0])}</h4>${pill(c[1])}</div><div class="aig40-muted">${esc(c[3])}</div><div class="source">Evidence: ${esc(c[2])}</div></div>`).join('')}</div></div>`
  }
  function evidence(){
    const rows=POLICY_ROWS.filter(r=>['Data','Model','Solar IPP external data','Assistant','Planning & Optimization'].includes(r.domain));
    return `<div class="aig40-grid"><div class="aig40-panel"><h3>Evidence & model-use controls</h3>${controlTable(rows)}</div><div class="aig40-panel"><h3>Decision-use boundary</h3><div class="aig40-control"><h4>Recommend / draft</h4><div class="aig40-muted">Permitted when no configured hard stop is triggered. Execution remains downstream-governed.</div></div><div class="aig40-control" style="margin-top:7px"><h4>Execute / commit / close</h4><div class="aig40-muted">Requires the applicable safety, authority, transactional and evidence controls. No blanket autonomous authority is asserted.</div></div><div class="aig40-control" style="margin-top:7px"><h4>External intelligence</h4><div class="aig40-muted">Treat as non-operational until provider, freshness, quality, intended use and fallback controls are configured.</div></div></div></div>`
  }
  function approvals(){
    const rows=POLICY_ROWS.filter(r=>['Authority','Governance','Audit'].includes(r.domain));
    return `<div class="aig40-grid"><div class="aig40-panel"><h3>Approval & override controls</h3>${controlTable(rows)}</div><div class="aig40-panel"><h3>Required override evidence</h3><div class="aig40-tablewrap"><table class="aig40-table" style="min-width:0"><tbody><tr><td>Original AI/model recommendation</td><td>Required</td></tr><tr><td>Human decision</td><td>Required</td></tr><tr><td>Reason</td><td>Required</td></tr><tr><td>Supporting evidence</td><td>Required when available</td></tr><tr><td>Accountable approver</td><td>Required for governed approval</td></tr><tr><td>Subsequent outcome</td><td>Required for learning when measurable</td></tr></tbody></table></div><div class="aig40-muted" style="margin-top:7px">Persistent enterprise storage for these fields is not configured yet.</div></div></div>`
  }
  function monitoring(){
    const ds=decisions(), approval=ds.filter(d=>/approval/i.test(String(d.Decision||d.decision||d.Outcome||''))).length, review=ds.filter(d=>/review/i.test(String(d.Decision||d.decision||d.Outcome||''))).length, blocked=ds.filter(d=>/block/i.test(String(d.Decision||d.decision||d.Outcome||''))).length;
    return `<div class="aig40-grid"><div class="aig40-panel"><h3>Recorded guardrail outcomes</h3>${ds.length?`<div class="aig40-kpis" style="margin:0"><div class="aig40-kpi"><div class="l">Evaluated</div><div class="n">${ds.length}</div></div><div class="aig40-kpi"><div class="l">Approval</div><div class="n">${approval}</div></div><div class="aig40-kpi"><div class="l">Manual review</div><div class="n">${review}</div></div><div class="aig40-kpi"><div class="l">Blocked</div><div class="n">${blocked}</div></div></div>`:'<div class="aig40-empty">No guardrail decisions recorded in this browser session or governed decision dataset.</div>'}</div>${guidance()}</div>`
  }
  function log(){
    const ds=decisions().slice(0,100);
    return `<div class="aig40-panel"><h3>Guardrail Decision Log</h3><div class="aig40-log-note">Current runtime records are browser-session evidence. The Excel decision sheet is intentionally empty until actual governed decisions are captured.</div>${ds.length?`<div class="aig40-tablewrap"><table class="aig40-table"><thead><tr><th>Timestamp</th><th>Capability</th><th>Action</th><th>Decision</th><th>Policy</th><th>Reason</th></tr></thead><tbody>${ds.map(d=>`<tr><td>${esc(d.time||d.Timestamp||'')}</td><td>${esc(d.capability||d.Capability||'')}</td><td>${esc(d.action||d.Action||'')}</td><td>${decisionPill(d.decision||d.Decision||d.Outcome)}</td><td>${esc(d.policy||d.Policy||'')}</td><td>${esc(d.reason||d.Reason||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="aig40-empty">No guardrail decisions recorded.</div>'}</div>`
  }
  function content(){return active==='controls'?controls():active==='hardstops'?hardstops():active==='evidence'?evidence():active==='approvals'?approvals():active==='monitoring'?monitoring():log()}
  function render(){
    const v=document.getElementById('view-guardrails'); if(!v)return;
    const ds=decisions(), approval=ds.filter(d=>/approval/i.test(String(d.Decision||d.decision||d.Outcome||''))).length, review=ds.filter(d=>/review/i.test(String(d.Decision||d.decision||d.Outcome||''))).length, blocked=ds.filter(d=>/block/i.test(String(d.Decision||d.decision||d.Outcome||''))).length;
    const configured=POLICY_ROWS.filter(r=>r.state==='Configured').length, partial=POLICY_ROWS.filter(r=>r.state==='Partially configured').length, missing=POLICY_ROWS.filter(r=>r.state==='Not configured').length;
    v.innerHTML=`<div class="view-head"><div><h1>AI Guardrails</h1><div class="aig40-muted">Solar IPP · AI/model-assisted maintenance, planning, commercial and sustainability decisions</div></div></div>
      <div class="aig40-statusline"><span class="aig40-state"><b>${configured}</b> Configured</span><span class="aig40-state partial"><b>${partial}</b> Partially configured</span><span class="aig40-state missing"><b>${missing}</b> Not configured</span></div>
      <div class="aig40-kpis"><div class="aig40-kpi"><div class="l">Actions evaluated</div><div class="n">${ds.length}</div></div><div class="aig40-kpi"><div class="l">Approval required</div><div class="n">${approval}</div></div><div class="aig40-kpi"><div class="l">Manual review</div><div class="n">${review}</div></div><div class="aig40-kpi"><div class="l">Blocked actions</div><div class="n">${blocked}</div></div></div>
      <div class="aig40-tabs">${TABS.map(t=>`<button class="aig40-tab ${active===t[0]?'active':''}" onclick="window.aig40Tab('${t[0]}')">${t[1]}</button>`).join('')}</div>
      <div id="aig40-content">${content()}</div>`;
    try{window.ensureF1HelpEverywhere&&window.ensureF1HelpEverywhere(v)}catch(e){}
  }
  window.aig40Tab=function(t){active=t;render()}
  window.renderAIGuardrails=render;
  window.AIP_GUARDRAIL_POLICY_CATALOG=POLICY_ROWS;
  try{
    if(typeof V2_HELP!=='undefined')V2_HELP.guardrails={
      title:'AI Guardrails',
      what:'Governed controls that determine whether an AI/model-assisted action may proceed, needs approval or review, or must be blocked.',
      metrics:[
        {name:'Configured',desc:'Control and required evidence are operationally available.'},
        {name:'Partially configured',desc:'Control or evidence exists, but runtime linkage is incomplete.'},
        {name:'Not configured',desc:'Required control is identified but cannot yet be asserted as operational.'},
        {name:'Decision Log',desc:'Shows only actual recorded evaluations; no seeded historical figures are used.'}
      ],
      interact:'Use the six sections to review actual control readiness, hard stops, model-use boundaries, approvals/overrides, recorded outcomes and decision evidence.',
      tip:'Not configured is an intentional governance state, not a demo failure. It prevents unsupported claims of protection.',
      spec:'Evidence/context → applicable control → Allow / Approval / Manual Review / Block → recorded decision.'
    };
  }catch(e){}
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{if(document.getElementById('view-guardrails')?.classList.contains('active'))render()},650)});
})();
