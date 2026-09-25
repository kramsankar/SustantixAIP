
(function(){
  'use strict';
  const ID='workorderconstraintprioritization';
  let returnView='overview';

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const field=(id,label,val,min=0,max=100)=>`<label class="wocp-field"><span>${esc(label)}</span><input id="${id}" type="number" min="${min}" max="${max}" value="${val}"></label>`;
  const config=()=>typeof opsConstraintPriorityConfig==='function'?opsConstraintPriorityConfig():window.OPS_CONSTRAINT_PRIORITY;

  function ensureView(){
    let v=document.getElementById('view-'+ID);
    if(!v){
      const main=document.getElementById('main')||document.body;
      v=document.createElement('div');v.id='view-'+ID;v.className='view';main.appendChild(v);
    }
    return v;
  }

  function helpMarkup(c){
    const p=c.priorityScores,s=c.slaScores,b=c.impactBands;
    return `<div id="wocpHelp" class="wocp-help">
      <div class="wocp-help-head"><div></div><button class="wocp-close" data-wocp="help-close" title="Close Help">×</button></div>
      <div class="wocp-help-body">
        <section><h3>Purpose</h3><p>This framework ranks active constrained work orders by intervention priority. It does not change the work order's own Priority and it does not determine the constraint type.</p><div class="wocp-callout"><b>Constraint type</b> answers “What is blocking the work order?” <b>Constraint prioritization</b> answers “How quickly should that blocker be resolved?”</div></section>
        <section><h3>Overall calculation</h3><div class="wocp-formula">Constraint Priority Score = (Priority score × ${c.priorityWeight}%) + (Schedule/SLA score × ${c.slaWeight}%) + (Operational Impact score × ${c.impactWeight}%)</div><p>The three factor weights must total exactly 100%. Each component score is 0–100.</p></section>
        <section><h3>Work Order Priority mapping</h3><div class="wocp-help-grid"><span>Critical <b>${p.Critical}</b></span><span>High <b>${p.High}</b></span><span>Medium <b>${p.Medium}</b></span><span>Low <b>${p.Low}</b></span></div></section>
        <section><h3>Schedule / SLA mapping</h3><div class="wocp-help-grid"><span>Breached / overdue <b>${s.breached}</b></span><span>Open / at risk <b>${s.atRisk}</b></span><span>Normal <b>${s.normal}</b></span></div></section>
        <section><h3>Operational Impact — Energy at Risk</h3><table><thead><tr><th>Energy at Risk</th><th>Component score</th></tr></thead><tbody><tr><td>≥ ${b.highThreshold} MWh</td><td>${b.highScore}</td></tr><tr><td>≥ ${b.mediumThreshold} and &lt; ${b.highThreshold} MWh</td><td>${b.mediumScore}</td></tr><tr><td>≥ ${b.lowThreshold} and &lt; ${b.mediumThreshold} MWh</td><td>${b.lowScore}</td></tr><tr><td>&gt; ${b.minThreshold} and &lt; ${b.lowThreshold} MWh</td><td>${b.minScore}</td></tr><tr><td>≤ ${b.minThreshold} MWh</td><td>${b.zeroScore}</td></tr></tbody></table></section>
        <section><h3>Classification</h3><div class="wocp-help-bands"><span class="red"><b>Red ${c.redThreshold}–100</b></span><span class="amber"><b>Amber 0–${Math.max(0,c.redThreshold-1)}</b></span></div></section>
        <section><h3>Save and validation</h3><p>Save is allowed only when factor weights total exactly 100%, classification is contiguous, component scores are 0–100, and Energy-at-Risk thresholds descend from High to Minimum.</p></section>
      </div></div>`;
  }

  function render(){
    const v=ensureView();
    const c=config();
    if(!c){v.innerHTML='<div class="wocp-page"><div class="wocp-header"><h1>Work Order Constraint Prioritization</h1></div><div class="wocp-body"><section class="wocp-card">Configuration is not available.</section></div></div>';return;}
    const p=c.priorityScores,s=c.slaScores,b=c.impactBands,amber=Math.max(0,c.redThreshold-1);
    v.innerHTML=`<div class="wocp-page">
      <div class="wocp-header"><div><h1>Work Order Constraint Prioritization</h1></div><div class="wocp-head-actions"><button class="wocp-close" data-wocp="close" title="Close">×</button></div></div>
      <div class="wocp-body">
        <section class="wocp-card wocp-card-classification"><div class="wocp-card-head"><h2>Constraint Classification</h2></div><div class="wocp-grid two">${field('opsCpRedThreshold','Red threshold',c.redThreshold,1,100)}${field('opsCpAmberThreshold','Amber threshold',amber,0,99)}</div><div class="wocp-bands inline"><div class="red"><i></i><b>Red</b><strong>${c.redThreshold}–100</strong></div><div class="amber"><i></i><b>Amber</b><strong>0–${amber}</strong></div></div></section>
        <section class="wocp-card wocp-card-weights"><div class="wocp-card-head"><h2>Factor Weights</h2></div><div class="wocp-grid three">${field('opsCpPriorityWeight','Priority weight %',c.priorityWeight)}${field('opsCpSlaWeight','Schedule / SLA weight %',c.slaWeight)}${field('opsCpImpactWeight','Operational impact weight %',c.impactWeight)}</div><div id="wocpWeightValidation" class="wocp-weight-validation" hidden></div></section>
        <section class="wocp-card wocp-card-priority"><div class="wocp-card-head"><h2>Priority Category-to-Score Mapping</h2></div><div class="wocp-grid four">${field('opsCpPriCritical','Critical',p.Critical)}${field('opsCpPriHigh','High',p.High)}${field('opsCpPriMedium','Medium',p.Medium)}${field('opsCpPriLow','Low',p.Low)}</div></section>
        <section class="wocp-card wocp-card-sla"><div class="wocp-card-head"><h2>Schedule / SLA Category-to-Score Mapping</h2></div><div class="wocp-grid three">${field('opsCpSlaBreached','Breached / overdue',s.breached)}${field('opsCpSlaAtRisk','Open / at risk',s.atRisk)}${field('opsCpSlaNormal','Normal',s.normal)}</div></section>
        <section class="wocp-card wocp-card-impact"><div class="wocp-card-head"><h2>Operational Impact — Energy at Risk</h2></div><div class="wocp-impact-range"><b>Band</b><b>Energy at Risk Range</b><b>Component Score</b>
          <span>High</span><div class="wocp-range-edit"><span>≥</span>${field('opsCpImpactHighT','MWh',b.highThreshold,0,999999)}</div>${field('opsCpImpactHighS','Score',b.highScore)}
          <span>Medium</span><div class="wocp-range-edit"><span>≥</span>${field('opsCpImpactMedT','MWh',b.mediumThreshold,0,999999)}<em>and &lt; High</em></div>${field('opsCpImpactMedS','Score',b.mediumScore)}
          <span>Low</span><div class="wocp-range-edit"><span>≥</span>${field('opsCpImpactLowT','MWh',b.lowThreshold,0,999999)}<em>and &lt; Medium</em></div>${field('opsCpImpactLowS','Score',b.lowScore)}
          <span>Minimal</span><div class="wocp-range-edit"><span>&gt;</span>${field('opsCpImpactMinT','MWh',b.minThreshold,0,999999)}<em>and &lt; Low</em></div>${field('opsCpImpactMinS','Score',b.minScore)}
          <span>Zero impact</span><div class="wocp-range-text">≤ ${b.minThreshold} MWh</div>${field('opsCpImpactZeroS','Score',b.zeroScore)}
        </div></section>
        <div class="wocp-actions"><button class="btn" data-wocp="reset">Reset</button><button class="btn primary" data-wocp="save">Save</button></div>
      </div>${helpMarkup(c)}</div>`;
    validateFactorWeights(false);
  }

  function num(id){const el=document.getElementById(id);return el&&el.value!==''?Number(el.value):NaN;}
  function currentWeightTotal(){const a=num('opsCpPriorityWeight'),b=num('opsCpSlaWeight'),c=num('opsCpImpactWeight');return [a,b,c].every(Number.isFinite)?a+b+c:NaN;}
  function validateFactorWeights(show){
    const ids=['opsCpPriorityWeight','opsCpSlaWeight','opsCpImpactWeight'],total=currentWeightTotal(),valid=Number.isFinite(total)&&total===100;
    ids.forEach(id=>{const el=document.getElementById(id),f=el?.closest('.wocp-field');el?.classList.toggle('wocp-invalid-input',!valid);f?.classList.toggle('wocp-invalid-field',!valid);if(el)el.setAttribute('aria-invalid',valid?'false':'true');});
    const msg=document.getElementById('wocpWeightValidation');
    if(msg){if(valid){msg.hidden=true;msg.textContent='';msg.className='wocp-weight-validation';}else{msg.hidden=false;msg.textContent=Number.isFinite(total)?`Factor weights total ${total}%. Adjust the three values so the total is exactly 100%.`:'Enter valid numeric values for all three factor weights.';msg.className='wocp-weight-validation error';}}
    if(!valid&&show){const m=Number.isFinite(total)?`Factor weights total ${total}%. They must equal exactly 100% before you can continue.`:'Enter valid numeric values for all three factor weights before you can continue.';if(typeof toast==='function')toast(m);else alert(m);}
    return valid;
  }
  function readConfig(){
    const red=num('opsCpRedThreshold'),amber=num('opsCpAmberThreshold');
    const n={priorityWeight:num('opsCpPriorityWeight'),slaWeight:num('opsCpSlaWeight'),impactWeight:num('opsCpImpactWeight'),redThreshold:red,
      priorityScores:{Critical:num('opsCpPriCritical'),High:num('opsCpPriHigh'),Medium:num('opsCpPriMedium'),Low:num('opsCpPriLow')},
      slaScores:{breached:num('opsCpSlaBreached'),atRisk:num('opsCpSlaAtRisk'),normal:num('opsCpSlaNormal')},
      impactBands:{highThreshold:num('opsCpImpactHighT'),highScore:num('opsCpImpactHighS'),mediumThreshold:num('opsCpImpactMedT'),mediumScore:num('opsCpImpactMedS'),lowThreshold:num('opsCpImpactLowT'),lowScore:num('opsCpImpactLowS'),minThreshold:num('opsCpImpactMinT'),minScore:num('opsCpImpactMinS'),zeroScore:num('opsCpImpactZeroS')}};
    return {n,amber};
  }
  function save(){
    if(!validateFactorWeights(true))return false;
    const {n,amber}=readConfig(),red=n.redThreshold;
    if(!Number.isFinite(red)||red<1||red>100||!Number.isFinite(amber)||amber<0||amber>99||amber!==red-1){toast?.('Amber threshold must be exactly one point below Red threshold');return false;}
    const scores=[...Object.values(n.priorityScores),...Object.values(n.slaScores),n.impactBands.highScore,n.impactBands.mediumScore,n.impactBands.lowScore,n.impactBands.minScore,n.impactBands.zeroScore];
    if(scores.some(x=>!Number.isFinite(x)||x<0||x>100)){toast?.('All component scores must be between 0 and 100');return false;}
    const b=n.impactBands;
    if([b.highThreshold,b.mediumThreshold,b.lowThreshold,b.minThreshold].some(x=>!Number.isFinite(x))||!(b.highThreshold>b.mediumThreshold&&b.mediumThreshold>b.lowThreshold&&b.lowThreshold>=b.minThreshold&&b.minThreshold>=0)){toast?.('Operational impact thresholds must descend from High to Minimum');return false;}
    window.OPS_CONSTRAINT_PRIORITY=typeof opsConstraintPriorityMerge==='function'?opsConstraintPriorityMerge(n):n;
    try{localStorage.setItem('aipConstraintPrioritization',JSON.stringify(window.OPS_CONSTRAINT_PRIORITY));}catch(_){}
    toast?.('Work Order Constraint Prioritization configuration saved');render();return true;
  }
  function reset(){
    if(typeof opsConstraintPriorityMerge==='function')window.OPS_CONSTRAINT_PRIORITY=opsConstraintPriorityMerge({});
    try{localStorage.removeItem('aipConstraintPrioritization');}catch(_){}
    toast?.('Work Order Constraint Prioritization reset to default');render();
  }
  function close(){if(!validateFactorWeights(true))return;window.activate?.(returnView&&returnView!==ID?returnView:'overview');}

  document.addEventListener('click',function(e){
    const nav=e.target.closest?.('#sidebar .wocp-tech-nav[data-view="'+ID+'"]');
    if(nav){const active=document.querySelector('.view.active');if(active&&active.id!=='view-'+ID)returnView=active.id.replace(/^view-/,'')||'overview';return;}
    const b=e.target.closest?.('[data-wocp]');if(!b)return;
    const a=b.dataset.wocp;e.preventDefault();e.stopPropagation();
    if(a==='close'){close();return;}
    if(a==='help'){if(validateFactorWeights(true))document.getElementById('wocpHelp')?.classList.add('open');return;}
    if(a==='help-close'){document.getElementById('wocpHelp')?.classList.remove('open');return;}
    if(a==='save'){save();return;}
    if(a==='reset'){reset();return;}
  },true);
  document.addEventListener('input',function(e){if(document.getElementById('view-'+ID)?.classList.contains('active')&&e.target?.matches?.('#opsCpPriorityWeight,#opsCpSlaWeight,#opsCpImpactWeight'))validateFactorWeights(false);},true);
  document.addEventListener('change',function(e){if(document.getElementById('view-'+ID)?.classList.contains('active')&&e.target?.matches?.('#opsCpPriorityWeight,#opsCpSlaWeight,#opsCpImpactWeight'))validateFactorWeights(true);},true);
  document.addEventListener('click',function(e){
    if(!document.getElementById('view-'+ID)?.classList.contains('active'))return;
    const nav=e.target.closest?.('#sidebar .nav-item[data-view]');if(!nav||nav.dataset.view===ID)return;
    if(!validateFactorWeights(false)){e.preventDefault();e.stopImmediatePropagation();validateFactorWeights(true);}
  },true);

  window.renderWorkOrderConstraintPrioritization=render;
  window.openWorkOrderConstraintPrioritization=function(){window.activate?.(ID);};
})();
