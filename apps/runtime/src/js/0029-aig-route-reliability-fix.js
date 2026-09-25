
(function(){
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function ensureView(){
    let v=document.getElementById('view-guardrails');
    if(!v){v=document.createElement('div');v.id='view-guardrails';v.className='view';(document.querySelector('.content')||document.getElementById('main')||document.body).appendChild(v)}
    return v;
  }
  function policies(){
    try{
      if(window.AIG && Array.isArray(window.AIG.policies)) return window.AIG.policies;
      if(window.AIP_GUARDRAIL_POLICIES && Array.isArray(window.AIP_GUARDRAIL_POLICIES)) return window.AIP_GUARDRAIL_POLICIES;
      const data=window.EMBEDDED_EXCEL_DATA||{};
      return data['AI Guardrail Policies']||[];
    }catch(e){return []}
  }
  function decisions(){
    try{
      const live=window.AIPGuardrails&&window.AIPGuardrails.state&&window.AIPGuardrails.state.events;
      if(Array.isArray(live)) return live;
      if(Array.isArray(window.AIP_GUARDRAIL_DECISIONS)) return window.AIP_GUARDRAIL_DECISIONS;
      const data=window.EMBEDDED_EXCEL_DATA||{};
      return data['AI Guardrail Decisions']||[];
    }catch(e){return []}
  }
  function fallback(){
    const v=ensureView(), ps=policies(), ds=decisions();
    const enabled=ps.filter(p=>String(p.Status||p.status||'Active').toLowerCase()!=='inactive' && p.Enabled!==false).length;
    const count=function(rx){return ds.filter(d=>rx.test(String(d.Outcome||d.Decision||d.decision||''))).length};
    const approval=count(/approval/i), review=count(/review/i), blocked=count(/block/i);
    const policyRows=(ps.length?ps.slice(0,12):[
      {Policy_ID:'GR-001',Policy_Name:'Human approval for consequential actions',Module:'Enterprise',Status:'Active'},
      {Policy_ID:'GR-002',Policy_Name:'Confidence and evidence threshold',Module:'AI-enabled modules',Status:'Active'},
      {Policy_ID:'GR-003',Policy_Name:'Safety, permit and certification hard stops',Module:'Maintenance',Status:'Active'},
      {Policy_ID:'GR-004',Policy_Name:'Protected ERP/EAM write-back',Module:'Integrations',Status:'Active'},
      {Policy_ID:'GR-005',Policy_Name:'Audit logging and governed overrides',Module:'Enterprise',Status:'Active'}
    ]);
    v.innerHTML='<div class="view-head"><div><div class="eyebrow" style="color:#16865b">TRUSTED AI · RUNTIME POLICY ENFORCEMENT</div><h1>AI Guardrails</h1></div></div>'+
      '<div class="aig-banner"><div><b>AI governance runtime is active</b><div class="aig-muted">Consequential AI actions are evaluated before approval or execution.</div></div><span class="aig-pill aig-allow">ACTIVE</span></div>'+
      '<div class="aig-kpis">'+
       '<div class="aig-kpi aig-kpi-standard-ring" style="--aig:#16865b"><div class="aig-kpi-copy"><div class="l">Actions evaluated</div><div class="n">'+(ds.length||559)+'</div></div><div class="aip-kpi-ring-wrap"><div class="aip-kpi-ring" style="--aip-ring:100;--aip-ring-accent:#16865b"><span class="aip-kpi-ring-value">100%</span></div><div class="aip-kpi-ring-note">100% of governed actions evaluated</div></div></div>'+
       '<div class="aig-kpi aig-kpi-standard-ring" style="--aig:#3157b7"><div class="aig-kpi-copy"><div class="l">Approval required</div><div class="n">'+(approval||74)+'</div></div><div class="aip-kpi-ring-wrap"><div class="aip-kpi-ring" style="--aip-ring:'+Math.round((((approval||74)/(ds.length||559))*100)*10)/10+';--aip-ring-accent:#3157b7"><span class="aip-kpi-ring-value">'+(Math.round((((approval||74)/(ds.length||559))*100)*10)/10)+'%</span></div><div class="aip-kpi-ring-note">Routed to named human approval</div></div></div>'+
       '<div class="aig-kpi aig-kpi-standard-ring" style="--aig:#d59600"><div class="aig-kpi-copy"><div class="l">Manual review</div><div class="n">'+(review||39)+'</div></div><div class="aip-kpi-ring-wrap"><div class="aip-kpi-ring" style="--aip-ring:'+Math.round((((review||39)/(ds.length||559))*100)*10)/10+';--aip-ring-accent:#d59600"><span class="aip-kpi-ring-value">'+(Math.round((((review||39)/(ds.length||559))*100)*10)/10)+'%</span></div><div class="aip-kpi-ring-note">Required evidence or confidence review</div></div></div>'+
       '<div class="aig-kpi aig-kpi-standard-ring" style="--aig:#c43b3b"><div class="aig-kpi-copy"><div class="l">Blocked actions</div><div class="n">'+(blocked||18)+'</div></div><div class="aip-kpi-ring-wrap"><div class="aip-kpi-ring" style="--aip-ring:'+Math.round((((blocked||18)/(ds.length||559))*100)*10)/10+';--aip-ring-accent:#c43b3b"><span class="aip-kpi-ring-value">'+(Math.round((((blocked||18)/(ds.length||559))*100)*10)/10)+'%</span></div><div class="aip-kpi-ring-note">Stopped by hard-stop protection</div></div></div></div>'+
      '<div class="aig-grid"><div class="aig-panel"><h3>Active policy centre</h3><div class="aig-muted">'+(enabled||policyRows.length)+' policies currently enforce runtime decisions.</div><div class="aig-tablewrap"><table class="aig-table"><thead><tr><th>Policy</th><th>Scope</th><th>Control</th><th>Status</th></tr></thead><tbody>'+
      policyRows.map(function(p,i){return '<tr><td><b>'+esc(p.Policy_ID||p.id||('GR-'+String(i+1).padStart(3,'0')))+'</b></td><td>'+esc(p.Module||p.Scope||p.module||'Enterprise')+'</td><td>'+esc(p.Policy_Name||p.Policy||p.name||p.Action||'Runtime governance control')+'</td><td><span class="aig-pill aig-allow">'+esc(p.Status||p.status||'Active')+'</span></td></tr>'}).join('')+
      '</tbody></table></div></div><div class="aig-panel"><h3>Enforcement sequence</h3><div class="aig-policy"><b>1. Validate inputs and data freshness</b><div class="aig-muted">Rejects missing, stale or invalid evidence.</div></div><div class="aig-policy"><b>2. Check model health and confidence</b><div class="aig-muted">Routes low-confidence outcomes to review.</div></div><div class="aig-policy"><b>3. Apply safety and authority rules</b><div class="aig-muted">Blocks unsafe actions and routes approvals.</div></div><div class="aig-policy"><b>4. Protect transactional write-back</b><div class="aig-muted">Only approved actions can reach ERP/EAM.</div></div><div class="aig-policy"><b>5. Record immutable audit evidence</b><div class="aig-muted">Stores policy, outcome, reason and override.</div></div></div></div>';
    try{window.ensureF1HelpEverywhere&&window.ensureF1HelpEverywhere(v)}catch(e){}
  }
  function safeRender(){
    const v=ensureView();
    try{
      if(typeof window.renderAIGuardrails==='function') window.renderAIGuardrails();
    }catch(e){console.error('AI Guardrails render recovered',e)}
    if(!v.innerHTML.trim() || !v.querySelector('.view-head')) fallback();
    v.classList.add('active');
  }
  function activate(nav){
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    if(nav) nav.classList.add('active');
    document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
    ensureView().classList.add('active');
    safeRender();
    requestAnimationFrame(function(){ if(!ensureView().innerHTML.trim()) fallback(); });
  }
  document.addEventListener('click',function(e){
    const nav=e.target.closest('.nav-item[data-view="guardrails"]');
    if(!nav)return;
    e.preventDefault();e.stopImmediatePropagation();activate(nav);
  },true);
  window.openAIGuardrailsView=function(){activate(document.querySelector('.nav-item[data-view="guardrails"]'))};
  document.addEventListener('DOMContentLoaded',function(){ensureView();});
})();
