
(function(){
  'use strict';
  const ID='actionprioritization';
  const f=(id,label,val)=>`<label class="apcfg-field"><span>${label}</span><input id="${id}" type="number" min="0" max="100" value="${val}"></label>`;
  function render(){
    const v=document.getElementById('view-'+ID);if(!v)return;
    const c=aipActionPriorityConfig();
    v.innerHTML=`<div class="apcfg-page">
      <div class="apcfg-head"><div><h1>Portfolio Action Prioritization</h1></div></div>
      <div class="apcfg-body">
        <section class="apcfg-card"><h2>Priority Threshold</h2>${f('apcfgThreshold','Priority action threshold',c.priorityThreshold)}</section>
        <section class="apcfg-card"><h2>Ranking Weights</h2><div class="apcfg-grid">${f('apcfgUrgency','Operational urgency %',c.urgencyWeight)}${f('apcfgRisk','Operational risk %',c.operationalRiskWeight)}${f('apcfgImpact','Business impact %',c.businessImpactWeight)}${f('apcfgRecovery','Recoverability %',c.recoverabilityWeight)}</div><div id="apcfgValidation" class="apcfg-validation" hidden></div></section>
        <section class="apcfg-card apcfg-inputs"><h2>Governed Inputs</h2><div><b>Operational urgency</b><span>SLA breach, overdue status, time sensitivity</span></div><div><b>Operational risk</b><span>Critical work, asset risk and failure exposure</span></div><div><b>Business impact</b><span>Revenue, energy and service exposure where available</span></div><div><b>Recoverability</b><span>Ability to reduce or recover the identified exposure through action</span></div></section>
        <div class="apcfg-actions"><button class="btn" id="apcfgReset">Reset</button><button class="btn primary" id="apcfgSave">Save</button></div>
      </div>
      <div id="apcfgHelp" class="apcfg-help"><div class="apcfg-help-head"><button onclick="document.getElementById('apcfgHelp')?.classList.remove('open')">×</button></div><div class="apcfg-help-body"><h3>How ranking works</h3><p>Every evaluated action receives a 0–100 score from the four governed factors. The weights must total exactly 100%. Records at or above the Priority Threshold become Priority Actions. The Overview shows only Priority Actions above the threshold and may preview only the highest few; the complete evaluated population remains available within the drill-down.</p><h3>Role of AI and GenAI</h3><p>AI/ML-derived risk and exposure signals can feed the governed factors. The ranking itself remains deterministic and auditable. Ask AIP queries and explains the ranked population; it does not silently override the active ranking rules.</p></div></div>
    </div>`;
    const validate=(show)=>{
      const vals=['apcfgUrgency','apcfgRisk','apcfgImpact','apcfgRecovery'].map(id=>Number(document.getElementById(id)?.value));
      const total=vals.reduce((a,b)=>a+b,0),box=document.getElementById('apcfgValidation'),ok=vals.every(Number.isFinite)&&total===100;
      if(box){box.hidden=ok;box.textContent=ok?'':`Current total: ${total}% · Required total: 100%`;box.className='apcfg-validation '+(ok?'':'error')}
      if(!ok&&show)toast?.(`Portfolio Action Prioritization weights total ${total}%. They must equal exactly 100%.`);
      return ok;
    };
    ['apcfgUrgency','apcfgRisk','apcfgImpact','apcfgRecovery'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>validate(false)));
    document.getElementById('apcfgSave').onclick=()=>{
      if(!validate(true))return;
      const n={urgencyWeight:+document.getElementById('apcfgUrgency').value,operationalRiskWeight:+document.getElementById('apcfgRisk').value,businessImpactWeight:+document.getElementById('apcfgImpact').value,recoverabilityWeight:+document.getElementById('apcfgRecovery').value,priorityThreshold:+document.getElementById('apcfgThreshold').value};
      if(n.priorityThreshold<1||n.priorityThreshold>100){toast?.('Priority threshold must be between 1 and 100.');return}
      window.AIP_ACTION_PRIORITY={...AIP_ACTION_PRIORITY_DEFAULT,...n};
      try{localStorage.setItem('aipActionPrioritization',JSON.stringify(window.AIP_ACTION_PRIORITY))}catch(_){}
      toast?.('Portfolio Action Prioritization configuration saved');
      render();
    };
    document.getElementById('apcfgReset').onclick=()=>{window.AIP_ACTION_PRIORITY={...AIP_ACTION_PRIORITY_DEFAULT};try{localStorage.removeItem('aipActionPrioritization')}catch(_){}render();toast?.('Portfolio Action Prioritization reset to default')};
  }
  window.renderActionPrioritization=render;
})();
