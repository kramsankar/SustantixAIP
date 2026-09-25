
(function(){
'use strict';
window.AIP_DI_EXCEL=__AIP_DS("331698b54052f3e3");
window.AIP_DI_SYNTHETIC=__AIP_DS("9a3fd99c441ef0d1");
const S=window.AIP_DI_V401_STATE||(window.AIP_DI_V401_STATE={tab:'overview',stage:'map',selected:null,filters:{priority:'All',category:'All',search:''},decisionAction:{},governanceAudit:{},showPolicy:false});S.governanceAudit=S.governanceAudit||{};
S.evidenceReview=S.evidenceReview||{};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const money=n=>'₹'+(Number(n)>=10000000?(Number(n)/10000000).toFixed(2)+' Cr':Number(n)>=100000?(Number(n)/100000).toFixed(2)+' L':Number(n).toLocaleString('en-IN'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function isSyn(){return String(window.APM_DATA_MODE||'').toLowerCase().includes('synthetic')}
function payload(){return isSyn()?window.AIP_DI_SYNTHETIC:window.AIP_DI_EXCEL}
function decisions(){return payload().decisions||[]}
function selected(){
 const ds=decisions();if(!ds.length)return null;
 const active=window.AIP_DI_ACTIVE_ROW;
 if(active && ds.some(d=>d.id===active))S.selected=active;
 if(!S.selected||!ds.some(d=>d.id===S.selected))S.selected=ds[0].id;
 return ds.find(d=>d.id===S.selected)
}
function priorityPill(p){return `<span class="di401-pill ${String(p).toLowerCase()}">${esc(p)}</span>`}
function decisionLifecycleStatus(d){const g=S.governanceAudit?.[d.id];if(g?.outcome==='Rejected')return 'Rejected';if(g?.outcome==='Approved')return 'Approved';if(g?.outcome==='Returned for Review')return 'Returned for Review';if(evidenceValidated(d))return 'Awaiting Approval';return 'Under Review'}
function decisionStatusPill(d){const st=decisionLifecycleStatus(d),cls=st.toLowerCase().replace(/\s+/g,'-');return `<button class="di484-status ${cls}" data-di-status-open="${d.id}">${esc(st)} <i>↗</i></button>`}
function statusPill(s){const cls=/ready|completed|evidence ready/i.test(s)?'ready':'';return `<span class="di401-pill ${cls}">${esc(s)}</span>`}
function filtered(){const f=S.filters;return decisions().filter(d=>(f.priority==='All'||d.priority===f.priority)&&(f.category==='All'||d.category===f.category)&&(!f.search||[d.id,d.title,d.site,d.asset,d.owner,d.status,decisionLifecycleStatus(d)].join(' ').toLowerCase().includes(f.search.toLowerCase())))}
function go(view){
 if(!view||view==='decisionintelligence')return;
 if(view==='benefitsrealization'){S.tab='workspace';S.stage='outcome';render();return}
 if(view==='decisiontraceability'){S.tab='workspace';S.stage='map';render();return}
 window.AIP_DI_RETURN={decisionId:S.selected,tab:S.tab,stage:S.stage};
 if(view==='resourceplanning'&&/^(SYN-)?DEC-005$/i.test(String(S.selected||''))){
   const open=()=>{
     try{
       if(window.AIP_V21?.open)window.AIP_V21.open('resourceplanning');
       else document.querySelector('.nav-item[data-view="resourceplanning"]')?.click();
     }catch(_){}
     try{
       if(typeof window.planSelect==='function')window.planSelect('INT-001','schedule');
       else if(typeof window.planSetTab==='function')window.planSetTab('schedule');
     }catch(_){}
   };
   open();requestAnimationFrame(open);setTimeout(open,60);setTimeout(open,180);
   return true;
 }
 document.querySelector(`.nav-item[data-view="${view}"]`)?.click()
}
function summary(ds){const gross=ds.reduce((s,d)=>s+Number(d.value||0),0),critical=ds.filter(d=>d.priority==='Critical').length,ready=ds.filter(d=>d.openBlockers===0).length;return `<div class="di401-summary"><div class="di401-kpi"><span>Active Decisions</span><b>${ds.length}</b></div><div class="di401-kpi"><span>Critical Decisions</span><b>${critical}</b></div><div class="di401-kpi"><span>Gross Value at Stake</span><b>${money(gross)}</b></div><div class="di401-kpi"><span>Execution Ready</span><b>${ready}</b></div></div>`}
function tabs(){return `<div class="di401-tabs"><button class="di401-tab ${S.tab==='overview'?'active':''}" data-di-tab="overview">Decision Overview</button><button class="di401-tab ${S.tab==='workspace'?'active':''}" data-di-tab="workspace">Decision Workspace</button><button class="di401-tab ${S.tab==='assetvalue'?'active':''}" data-di-tab="assetvalue">Asset-to-Value Intelligence</button></div>`}
function header(){return `<div class="view-head"><div><h1>Decision Intelligence</h1></div></div>`}
function evidenceClass(s){return String(s||'').toLowerCase()}
function overviewRows(){
 const selectedId=window.AIP_DI_RETURN_TO_OVERVIEW_ID||S.selected||window.AIP_DI_ACTIVE_ROW||null;
 return filtered().map(d=>`<tr tabindex="-1" data-di-row-id="${d.id}" class="${selectedId===d.id?'di477-selected-context':''}"><td><button class="di401-priority-btn" data-di-priority="${d.id}" title="Open Decision Priority Policy">${priorityPill(d.priority)}<i class="di440-policy-drill" aria-hidden="true">↗</i></button></td><td><div class="di477-decision-title"><b>${esc(d.title)}</b></div><div class="di401-meta">${esc(d.id)} · ${esc(d.site)} · ${esc(d.asset)}</div></td><td><b>${money(d.value)}</b><div class="di401-meta">${esc(d.risk)}</div></td><td><button class="di440-evidence-btn" data-di-evidence-policy="${d.id}" title="Open Evidence Strength Policy"><span class="di401-pill ${evidenceClass(d.evidenceStrength)}">${esc(d.evidenceStrength)}</span><i class="di440-policy-drill" aria-hidden="true">↗</i></button></td><td>${d.openBlockers>0?`<button class="di418-blocker-pill" data-di-blockers="${d.id}"><span>${d.openBlockers} Blocker${d.openBlockers===1?'':'s'}</span><i class="di434-blocker-drill" aria-hidden="true">↗</i></button>`:`<span class="di418-ready">Ready ✓</span>`}</td><td><b class="di535-owner">${esc(d.owner)}</b><div class="di401-meta">${esc(d.due)}</div><div class="di535-lifecycle">${decisionStatusPill(d)}</div></td><td><button class="di401-action" data-di-review="${d.id}">Review →</button></td></tr>`).join('')
}
function setDecisionContext(id){
 if(!id)return;
 S.selected=id;
 window.AIP_DI_ACTIVE_ROW=id;
 window.AIP_DI_WORKSPACE_ORIGIN={from:'overview',decisionId:id};
}
function bindReviewRows(){
 $$('[data-di-review]').forEach(b=>b.onclick=()=>{
   setDecisionContext(b.dataset.diReview);
   window.AIP_DI_SELECTED_CONTEXT={decisionId:b.dataset.diReview};
   S.tab='workspace';
   S.stage='map';
   render();
 });
 $$('[data-di-row-id]').forEach(r=>{
   const id=r.dataset.diRowId;
   r.addEventListener('pointerdown',()=>{setDecisionContext(id);window.AIP_DI_SELECTED_CONTEXT={decisionId:id};window.AIP_DI_RETURN_TO_OVERVIEW_ID=id;},true);
 });
}
function refreshOverviewRows(){
 window.AIPDecisionOverviewKeyboardV416?.reset?.();
 window.AIPDecisionOverviewRowNavV417?.reset?.();
 const body=$('#di401Rows');if(body)body.innerHTML=overviewRows();
 bindReviewRows();
 bindOverviewRows();
}
function bindOverviewRows(){
 $$('#di401Rows tr').forEach(r=>r.addEventListener('click',e=>{
   if(e.target.closest('button,input,select,a'))return;
   r.focus({preventScroll:true});
 }));
}
function overview(){
 const all=decisions(),cats=[...new Set(all.map(d=>d.category))].sort();
 return `${summary(all)}<div class="di401-card"><div class="di401-toolbar"><select id="di401Priority"><option>All</option><option>Critical</option><option>High</option><option>Medium</option></select><select id="di401Category"><option>All</option>${cats.map(x=>`<option>${esc(x)}</option>`).join('')}</select><input id="di401Search" type="search" autocomplete="off" placeholder="Search decision, site, asset, owner or status"><button class="di401-action secondary" id="di401Reset">Reset</button></div><div class="di401-table-wrap"><table class="di401-table"><thead><tr><th>Priority</th><th>Decision</th><th>Value / risk</th><th>Evidence</th><th>Readiness</th><th>Owner / due / status</th><th>Action</th></tr></thead><tbody id="di401Rows">${overviewRows()}</tbody></table></div></div>`
}
function assetValue(){
 return `<div id="di401AtvHost" class="di401-atv-host"></div>`;
}
const stages=[['map','Digital Decision Map'],['alternatives','Alternatives'],['evaluation','Comparative Evaluation'],['recommendation','Recommendation'],['evidence','Evidence Review'],['governance','Governance & Approval'],['execution','Execution & Handoff'],['outcome','Outcome & Learning']];
function evidenceState(d){return S.evidenceReview[d.id]||'Not reviewed'}
function evidenceValidated(d){return evidenceState(d)==='Validated'}
function thread(){const d=selected();return `<div class="di401-thread">${stages.map(([k,l],i)=>{const locked=k==='governance'&&d&&!evidenceValidated(d);const active=S.stage===k;return `<button class="di401-node ${k} ${active?'active':''} ${locked?'locked':''}" data-di-stage="${k}" ${locked?'disabled title="Complete Evidence Review before Governance & Approval"':''}><span>${i+1}</span><b>${l}</b>${locked?'<small>Evidence gate</small>':''}</button>`}).join('')}</div>`}
function evidenceView(d){const state=evidenceState(d),validated=state==='Validated',needs=state==='Needs review';return `<div class="di445-evidence-review">
 <div class="di445-section-title"><div><h3>Evidence Review</h3></div></div>
 <div class="di401-grid">${d.evidence.map((e,i)=>`<div class="di401-evidence di445-material-evidence"><div class="di445-evidence-card-head"><span>${esc(e.type||'Evidence')}</span><b>${Number(e.quality||0)}%</b></div><h4>${esc(e.source)} · ${esc(e.record)}</h4><p>${esc(e.detail)}</p><div class="di401-actions">${e.target&&e.target!=='decisionintelligence'?`<button class="di445-source-drill" data-di-evidence-open="${i}">Open ${esc(e.record)} <i class="di451-nav-icon">↗</i></button>`:''}${e.model?'<button class="di445-model-drill" data-di-open="models">Model Registry <i class="di451-nav-icon">↗</i></button>':''}</div></div>`).join('')}</div>
 <div class="di445-validation-gate"><div><b>Evidence validation</b><span>${validated?'Validated':needs?'Needs review':'Not reviewed'}</span></div><div class="di445-validation-actions"><button class="di445-validate ${validated?'selected':''}" data-di-evidence-decision="Validated">Validate Evidence <i>✓</i></button><button class="di445-needs-review ${needs?'selected':''}" data-di-evidence-decision="Needs review">Needs Review <i>!</i></button></div></div>
 </div>`}
function priorityPolicyPanel(d){
 const p=payload().priorityPolicy||{},w=p.weights||{};
 return `<div class="ddm-panel"><div class="ddm-policy-grid"><div><div class="ddm-policy-section-head"><b>Decision Priority Policy</b><button type="button" class="ddm-policy-close" data-ddm-policy-close aria-label="Close Decision Priority Policy">×</button></div>${Object.entries(w).map(([k,v])=>`<div class="ddm-policy-row"><span>${esc(k)}</span><strong>${v}%</strong><span>${k==='Business / Financial Impact'?'Revenue, generation, warranty and commercial exposure':k==='Operational / Asset Risk'?'Failure, consequence, reliability and energy-at-risk':'Urgency / Time Criticality'===k?'RUL, deadlines, windows and time-to-impact':'Parts, permits, access, crew and approvals'}</span></div>`).join('')}</div><div><div class="ddm-policy-section-head"><b>Priority bands</b><button type="button" class="ddm-policy-close" data-ddm-policy-close aria-label="Close Priority Bands">×</button></div><div class="ddm-band">${(p.bands||[]).map(b=>`<span><b>${esc(b.priority)}</b> ${b.min}–${b.max}</span>`).join('')}</div><div style="margin-top:12px"><b>Critical overrides</b>${(p.overrides||[]).map(x=>`<div class="di401-meta" style="margin-top:6px">• ${esc(x)}</div>`).join('')}</div></div></div></div>`
}
function digitalDecisionMap(d){
 const f=d.priorityFactors||{},ev=d.evidence||[],src=ev.slice(0,3);
 const factorNames=['Business / Financial Impact','Operational / Asset Risk','Urgency / Time Criticality','Execution / Constraint Severity'];
 const positions={
   s0:[8,18],s1:[8,50],s2:[8,82],
   f0:[31,12],f1:[31,38],f2:[31,64],f3:[31,88],
   policy:[50,50],decision:[72,50],action:[92,32],outcome:[92,70]
 };
 const path=(a,b,hot='')=>{const A=positions[a],B=positions[b],x1=A[0],y1=A[1],x2=B[0],y2=B[1],mx=(x1+x2)/2;return `<path class="${hot}" d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"/>`};
 const lines=[
   path('s0','f0','hot'),path('s0','f1'),path('s1','f1','hot'),path('s1','f2'),path('s2','f2'),path('s2','f3','hot'),
   path('f0','policy'),path('f1','policy'),path('f2','policy'),path('f3','policy'),path('policy','decision','hot'),path('decision','action','hot'),path('decision','outcome')
 ].join('');
 const sourceNodes=src.map((e,i)=>`<button class="ddm-node source" style="left:${positions['s'+i][0]}%;top:${positions['s'+i][1]}%" ${e.target&&e.target!=='decisionintelligence'?`data-di-open="${e.target}"`:''}><b>${esc(e.title)}</b><small>${esc(e.source)} · ${esc(e.record)}</small></button>`).join('');
 const factorNodes=factorNames.map((n,i)=>`<button class="ddm-node factor" style="left:${positions['f'+i][0]}%;top:${positions['f'+i][1]}%" ${n==='Execution / Constraint Severity'?`data-di-blockers="${d.id}"`:`data-ddm-factor="${i}"`}><b>${esc(n)}</b><small><span class="ddm-score">${Number(f[n]||0).toFixed(1)}</span> · ${(payload().priorityPolicy?.weights||{})[n]||0}% weight</small></button>`).join('');
 const override=d.priorityOverride?`<small>${esc(d.priorityOverride)}</small>`:`<small>Weighted governed score</small>`;
 return `<div class="ddm-shell"><div class="ddm-title"><div class="ddm-pan"><button type="button" id="ddmPanLeft" aria-label="Pan map left">←</button><button type="button" id="ddmPanRight" aria-label="Pan map right">→</button></div><div class="ddm-legend"><span style="background:#e8f3ff">Source signal</span><span style="background:#fff4d8">Decision factor</span><span style="background:#eee9ff">Policy</span><span style="background:#e4f6ec">Decision</span><span style="background:#ffe8df">Action</span></div></div><div class="ddm-viewport"><div class="ddm-canvas" id="ddmCanvas"><svg class="ddm-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${sourceNodes}${factorNodes}<button class="ddm-node policy ddm-policy-drill" style="left:${positions.policy[0]}%;top:${positions.policy[1]}%" id="ddmPolicy" title="View Decision Priority Policy"><b>Decision Priority Policy <span class="ddm-drill-icon" aria-hidden="true">↗</span></b></button><div class="ddm-node decision ddm-priority-static" style="left:${positions.decision[0]}%;top:${positions.decision[1]}%"><b>${esc(d.priority)} Priority</b><span class="ddm-score ddm-priority-${String(d.priority).toLowerCase()}">${Number(d.priorityScore||0).toFixed(1)}</span>${override}</div><button class="ddm-node action" style="left:${positions.action[0]}%;top:${positions.action[1]}%" data-ddm-stage="recommendation"><b>Recommended Action</b><small>${esc(d.recommendedAction)}</small></button><button class="ddm-node outcome" style="left:${positions.outcome[0]}%;top:${positions.outcome[1]}%" data-ddm-stage="outcome"><b>Outcome / Value</b><small>${money(d.outcome?.predictedBenefit||0)} predicted benefit</small></button></div></div><div class="ddm-evidence-snapshot"><div class="ddm-evidence-head"><b>Evidence Snapshot</b></div><div class="ddm-evidence-grid">${ev.slice(0,3).map(e=>`<div class="ddm-evidence-item"><b>${esc(e.title)}</b><p>${esc(e.detail)}</p><div class="di401-meta">${esc(e.source)} · ${esc(e.record)}</div></div>`).join('')}</div></div>${S.showPriorityPolicy?priorityPolicyPanel(d):''}</div>`
}
function aipPreferredAlt(d){const a=(d?.alternatives||[]).filter(x=>x&&x.eligible!==false);return a.slice().sort((x,y)=>Number(y.score||0)-Number(x.score||0))[0]||(d?.alternatives||[])[0]||null}
function isAipPreferred(d,a){return !!a&&a===aipPreferredAlt(d)}
function decisionWorkspaceDisplayAlternatives(d){
  const src=(d?.alternatives||[]).map((a,origIdx)=>({a,origIdx}));
  if(src.length<2)return src;
  const m=String(d?.id||'').match(/(\d+)$/);
  const n=m?Number(m[1]):0;
  const shift=((n-1)%src.length+src.length)%src.length;
  return src.slice(shift).concat(src.slice(0,shift));
}
function alternativeBasisPanel(d,a,i){if(S.altBasis!==i)return '';const c=a.calculationBasis||{},src=c.sourceData||{},ga=c.governedAssumptions||{},fm=c.formulas||{};const fmt=v=>v==null?'N/A':v;return `<div class="di443-basis"><div class="di443-basis-head"><div><b>Calculation Basis · ${esc(a.name)}</b><span>${isAipPreferred(d,a)?'AIP preferred alternative':'Alternative'}</span></div><button type="button" class="di443-basis-close" data-alt-basis-close>×</button></div>
<div class="di444-section"><h5>Source Data</h5><div class="di444-kv"><span>Source exposure</span><b>${money(src.baseExposure||0)}</b><span>Failure probability</span><b>${fmt(src.failureProbabilityPct)}${src.failureProbabilityPct==null?'':'%'}</b><span>RUL</span><b>${fmt(src.rulDays)}${src.rulDays==null?'':' days'}</b><span>Model confidence</span><b>${fmt(src.modelConfidencePct)}${src.modelConfidencePct==null?'':'%'}</b><span>Energy at risk</span><b>${fmt(src.energyAtRiskMWh)}${src.energyAtRiskMWh==null?'':' MWh'}</b><span>Evidence quality</span><b>${fmt(src.evidenceQualityAvg)}</b><span>Source record</span><b>${esc(src.sourceSheet||'')} · ${esc(src.sourceRecord||'')}</b></div></div>
<div class="di444-section"><h5>Governed Assumptions</h5><div class="di444-kv"><span>Scenario class</span><b>${esc(ga.scenarioClass||'')}</b><span>Intervention effectiveness</span><b>${ga.interventionEffectivenessPct}%</b><span>Residual-risk factor</span><b>${ga.residualRiskFactorPct}%</b><span>Delay / deterioration factor</span><b>${ga.delayDeteriorationFactor}</b><span>Variable cost rate</span><b>${ga.variableCostRatePct}%</b><span>Fixed execution cost</span><b>${money(ga.fixedExecutionCostINR||0)}</b></div></div>
<div class="di444-section"><h5>Calculated Outputs</h5><div class="di443-basis-grid"><div><span>Action cost</span><b>${money(a.actionCost)}</b></div><div><span>Value protected</span><b>${money(a.valueProtected)}</b></div><div><span>Residual risk</span><b>${money(a.residualRisk)}</b></div><div><span>Net value</span><b>${money(a.netValue)}</b></div></div><div class="di444-formulas"><div><b>Action Cost</b><span>${esc(fm['Action Cost']||'')}</span></div><div><b>Value Protected</b><span>${esc(fm['Value Protected']||'')}</span></div><div><b>Residual Risk</b><span>${esc(fm['Residual Risk']||'')}</span></div><div><b>Net Value</b><span>${esc(fm['Net Value']||'')}</span></div><div><b>Evaluation</b><span>${esc(fm['Evaluation Score']||'')}</span></div></div></div>
<div class="di443-conclusion"><b>Conclusion</b><span>${isAipPreferred(d,a)?'Highest eligible governed evaluation score for this decision.':'Ranked below the AIP-preferred eligible alternative using the same contextual evidence and governed evaluation model.'}</span></div></div>`} function alternativesView(d){const best=aipPreferredAlt(d),display=decisionWorkspaceDisplayAlternatives(d);return `<div class="di401-grid di465-alt-grid">${display.map(({a,origIdx})=>{const pref=a===best;return `<div class="di465-alt-wrap ${pref?'di465-preferred-wrap':''}" data-original-alt-index="${origIdx}">${pref?'<div class="di465-pref-marker"><span>AIP Preferred</span><i>↓</i></div>':''}<div class="di401-alt"><div class="di443-alt-head"><h4>${esc(a.name)}</h4><button type="button" class="di443-basis-open" data-alt-basis="${origIdx}" title="Open calculation basis"><span>Calculation basis</span><i class="di451-nav-icon">↗</i></button></div><div class="di401-metrics"><span>Action cost</span><b>${money(a.actionCost)}</b><span>Residual risk</span><b>${money(a.residualRisk)}</b><span>Value protected</span><b>${money(a.valueProtected)}</b><span>Net value</span><b>${money(a.netValue)}</b><span>Evaluation score</span><b>${a.score} / 100</b><span>Gate</span><b>${esc(a.gate)}</b></div>${alternativeBasisPanel(d,a,origIdx)}</div></div>`}).join('')}</div>`}
function di445Radar(d){
 const alts=d.alternatives||[],dims=['Technical Outcome','Economic Outcome','Execution Readiness','Evidence Strength'];
 const keys=['technical','economic','readiness','evidence'],cx=120,cy=112,R=82;
 const pts=(vals,scale=1)=>vals.map((v,i)=>{const a=(-Math.PI/2)+(i*2*Math.PI/dims.length),r=R*(v/100)*scale;return `${(cx+Math.cos(a)*r).toFixed(1)},${(cy+Math.sin(a)*r).toFixed(1)}`}).join(' ');
 const grid=[25,50,75,100].map(g=>`<polygon points="${pts([g,g,g,g])}" class="di445-radar-grid"/>`).join('');
 const axes=dims.map((n,i)=>{const a=(-Math.PI/2)+(i*2*Math.PI/dims.length),x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R,lx=cx+Math.cos(a)*(R+24),ly=cy+Math.sin(a)*(R+24);return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="di445-radar-axis"/><text x="${lx}" y="${ly}" class="di445-radar-label" text-anchor="middle">${esc(n.replace(' Outcome','').replace(' Strength',''))}</text>`}).join('');
 const polys=alts.map((a,i)=>`<polygon points="${pts(keys.map(k=>Number(a[k]||0)))}" class="di445-radar-poly s${i}"><title>${esc(a.name)} · ${a.score}/100</title></polygon>`).join('');
 return `<svg class="di445-radar" viewBox="0 0 240 230" role="img" aria-label="Comparative radar chart of alternatives">${grid}${axes}${polys}</svg>`;
}
function evaluationView(d){
 const alts=d.alternatives||[],best=aipPreferredAlt(d);
 return `<div class="di445-eval">
   <div class="di445-section-title"><div><h3>Comparative Evaluation</h3></div></div>
   <div class="di445-eval-layout">
     <div class="di445-radar-wrap">${di445Radar(d)}<div class="di445-radar-legend">${alts.map((a,i)=>`<span class="s${i}"><i></i>${esc(a.name)}</span>`).join('')}</div></div>
     <div class="di445-score-list">${alts.map((a,i)=>`<div class="di445-score-row ${a===best?'winner':''}"><div class="di445-score-head"><b>${a===best?'AIP Preferred · ':''}${esc(a.name)}</b><span>${a.score} / 100</span></div><div class="di445-score-track"><i style="width:${Math.max(0,Math.min(100,a.score))}%"></i></div><div class="di445-score-meta"><span>${esc(a.gate)}</span><span>Tech ${a.technical} · Econ ${a.economic} · Ready ${a.readiness} · Evidence ${a.evidence}</span></div></div>`).join('')}</div>
   </div>
 </div>`;
}
function recommendationView(d){
 const alts=d.alternatives||[],ranked=alts.filter(a=>a.eligible).slice().sort((a,b)=>b.score-a.score),best=ranked[0]||alts[0],next=ranked[1]||null;
 const gap=next?Math.max(0,Number(best.score)-Number(next.score)):null;
 const gated=alts.find(a=>!a.eligible),validated=evidenceValidated(d);
 const decisive=[['Net value',money(best.netValue)],['Residual risk',money(best.residualRisk)],['Execution readiness',`${best.readiness} / 100`],['Governed score',`${best.score} / 100`]];
 return `<div class="di445-reco">
   <div class="di445-verdict"><div><span class="di445-kicker">AIP RECOMMENDATION</span><h3>${esc(best.name)}</h3></div><div class="di445-verdict-score"><b>${best.score}</b><span>/100</span></div></div>
   <div class="di445-decisive">${decisive.map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
   <div class="di445-reco-why"><div><b>Why it won</b><span>${next?`${esc(best.name)} leads the next-best eligible alternative by ${gap.toFixed(1)} points while preserving ${money(best.valueProtected)} of value.`:'It is the highest-scoring eligible alternative under the governed policy.'}</span></div>${next?`<div><b>Next-best alternative</b><span>${esc(next.name)} · ${next.score}/100</span></div>`:''}${gated?`<div><b>Gated alternative</b><span>${esc(gated.name)} · ${esc(gated.gate)}</span></div>`:''}</div>
   
 </div>`;
}
function governanceView(d){
 if(!evidenceValidated(d))return `<div class="di445-gov-blocked"><b>Evidence validation required</b><span>Governance & Approval is blocked until Evidence Review is validated for ${esc(d.id)}.</span><button class="di445-evidence-cta" data-di-stage-jump="evidence">Review Evidence <i class="di451-nav-icon">↗</i></button></div>`;
 const audit=S.governanceAudit?.[d.id]||null,action=audit?.outcome||decisionLifecycleStatus(d),gs=d.governance||[],saved=window.AIP_USER_FINAL_SELECTIONS?.[d.id],finalId=d.finalSelectedAlternativeId||d.userSelectedAlternativeId||saved?.finalSelectedAlternativeId||saved?.userSelectedAlternativeId,basis=d.selectionBasis||saved?.selectionBasis||'AIP recommendation',fidx=finalId?Math.max(0,Number((String(finalId).match(/A(\d+)$/)||[])[1]||1)-1):Math.max(0,(d.alternatives||[]).findIndex(a=>a===aipPreferredAlt(d))),finalAlt=(d.alternatives||[])[fidx]||aipPreferredAlt(d);
 const authority=(gs.find(g=>/approval authority/i.test(g.stage))?.role)||'Site / Portfolio Operations Head';
 const reviewGate=gs.find(g=>/technical|business|performance|plan/i.test(g.stage));
 const evidenceState='Validated';
 const reviewState=action==='Approved'?'Completed':action==='Rejected'?'Closed':action==='Returned for Review'?'Returned':'Ready';
 const approvalState=action==='Approved'?'Approved':action==='Rejected'?'Rejected':action==='Returned for Review'?'Returned for Review':'Pending';
 return `<div class="di445-gov">
   <div class="di445-section-title"><div><h3>Governance & Approval</h3></div><span class="di484-gov ${String(action).toLowerCase().replace(/\s+/g,'-')}">${esc(action)}</span></div>
   ${audit?`<div class="di484-audit"><div><span>Outcome</span><b>${esc(audit.outcome)}</b></div><div><span>${audit.outcome==='Rejected'?'Rejected by':audit.outcome==='Approved'?'Approved by':'Returned by'}</span><b>${esc(audit.actor)}</b></div><div><span>Authority</span><b>${esc(audit.authority)}</b></div><div><span>Timestamp</span><b>${esc(audit.timestamp)}</b></div></div>`:''}
   <div class="di485-selection">
     <div><span>Final selection</span><b>A${fidx+1} · ${esc(finalAlt?.name||d.recommendedAction)}</b></div>
     <div><span>Selection basis</span><b>${esc(basis)}</b></div>
     <div><span>Source record</span><b>${esc(d.sourceRecord||d.id)}</b></div>
   </div>
   <div class="di485-gates">
     <div class="di485-gate done"><span>1</span><div><b>Evidence Review</b><small>${evidenceState} for ${esc(d.id)}</small></div></div>
     <div class="di485-gate ${reviewState==='Ready'||reviewState==='Completed'?'ready':reviewState==='Returned'?'warn':'closed'}"><span>2</span><div><b>${esc(reviewGate?.stage||'Technical / Business Review')}</b><small>${reviewState}${reviewGate?.role?' · '+esc(reviewGate.role):''}</small></div></div>
     <div class="di485-gate ${approvalState==='Approved'?'done':approvalState==='Rejected'?'rejected':approvalState==='Returned for Review'?'warn':'pending'}"><span>3</span><div><b>Approval Authority</b><small>${esc(authority)} · ${esc(approvalState)}</small></div></div>
   </div>
   <div class="di445-gov-actions"><button class="di401-action" data-di-decision="Approved">Approve</button><button class="di401-action secondary" data-di-decision="Deferred">Return for Review</button><button class="di401-action secondary" data-di-decision="Rejected">Reject</button><button class="di401-action secondary" data-di-stage-jump="execution" ${action==='Approved'?'':'disabled'}>View Execution Handoff <i class="di451-nav-icon">↗</i></button></div>
 </div>`;
}
function executionView(d){
 const es=d.execution||[],saved=window.AIP_USER_FINAL_SELECTIONS?.[d.id],finalId=d.finalSelectedAlternativeId||d.userSelectedAlternativeId||saved?.finalSelectedAlternativeId||saved?.userSelectedAlternativeId,rec=finalId?(d.alternatives||[])[Math.max(0,Number((String(finalId).match(/A(\d+)$/)||[])[1]||1)-1)]||aipPreferredAlt(d):aipPreferredAlt(d);
 const target=e=>/work order|executed/i.test(e.source+' '+e.stage)?'workorderintelligence':/planning|scheduled/i.test(e.source+' '+e.stage)?'resourceplanning':/decision intelligence|recommended|approved/i.test(e.source+' '+e.stage)?'decisionintelligence':'assetexplorer';
 return `<div class="di445-exec">
   <div class="di445-section-title"><div><h3>Execution & Handoff</h3><span>Approved recommendation translated into source-system execution.</span></div></div>
   <div class="di445-exec-summary"><div><span>Final selected action</span><b>${esc(rec?.name||d.recommendedAction)}</b></div><div><span>Expected action cost</span><b>${money(rec?.actionCost||0)}</b></div><div><span>Expected value protected</span><b>${money(rec?.valueProtected||0)}</b></div><div><span>Site / asset</span><b>${esc(d.site)} · ${esc(d.asset)}</b></div></div>
   <div class="di445-exec-flow">${es.map((e,i)=>`<div class="di445-exec-node ${/completed|verified|realized/i.test(e.status)?'done':/not started/i.test(e.status)?'future':'current'}" data-di-exec-index="${i}" data-di-exec-stage="${esc(e.stage)}" data-di-exec-status="${esc(e.status)}" data-di-exec-source="${esc(e.source||'')}" data-di-exec-record="${esc(e.record||'')}"><div class="di445-exec-dot">${i+1}</div><b>${esc(e.stage)}</b><span>${esc(e.owner)}</span><small>${esc(e.status)}</small>${e.source&&e.source!=='Decision Source'?`<button class="di445-source-link" data-di-open="${target(e)}">${esc(e.source)}${e.record?` · ${esc(e.record)}`:''} <i class="di451-nav-icon">↗</i></button>`:''}</div>${i<es.length-1?'<div class="di445-exec-arrow">→</div>':''}`).join('')}</div>
   <div class="di445-next"><button class="di401-action" data-di-open="workorderintelligence">Work Order Intelligence <i class="di451-nav-icon">↗</i></button><button class="di401-action secondary" data-di-open="resourceplanning">Resource Planning <i class="di451-nav-icon">↗</i></button><button class="di401-action secondary" data-di-stage-jump="outcome">View Outcome & Learning <i class="di451-nav-icon">↗</i></button></div>
 </div>`;
}
function outcomeView(d){
 const o=d.outcome||{},rec=aipPreferredAlt(d),actual=o.actualBenefit;
 const pending=actual==null;
 const predicted=Number(o.predictedBenefit||rec?.netValue||0),actualN=Number(actual||0),delta=pending?null:actualN-predicted;
 return `<div class="di445-outcome">
   <div class="di445-section-title"><div><h3>Outcome & Learning</h3><span>Predicted versus observed outcome, with feedback into future decisions.</span></div>${statusPill(o.status||'Pending')}</div>
   <div class="di445-outcome-layout">
     <div class="di445-outcome-card"><span>Predicted net benefit</span><b>${money(predicted)}</b><small>Calculated from Stage-2 alternative model</small></div>
     <div class="di445-outcome-card ${pending?'pending':''}"><span>Observed actual benefit</span><b>${pending?'Pending':money(actualN)}</b><small>${pending?'Awaiting execution / measurement window':'Observed Actual from Benefits Realization'}</small></div>
     <div class="di445-outcome-card"><span>Variance</span><b>${pending?'—':money(delta)}</b><small>${pending?'Not calculated until an actual exists':'Actual minus predicted'}</small></div>
   </div>
   ${pending?`<div class="di445-await"><b>No actual outcome has been fabricated.</b><span>This decision is still ${esc(o.status||'pending')}. Actuals will appear only after execution and the measurement window is complete.</span></div>`:`<div class="di445-variance"><div><span>Predicted</span><i style="width:70%"></i><b>${money(predicted)}</b></div><div><span>Actual realized benefit</span><i style="width:${Math.max(8,Math.min(100,predicted?70*(actualN/predicted):70))}%"></i><b>${money(actualN)}</b></div></div>`}
   <div class="di445-learning"><div class="di445-learn-node"><b>Observed Outcome</b><span>Benefits / cost / downtime</span></div><div class="di445-learn-arrow">→</div><div class="di445-learn-node"><b>Assumption Calibration</b><span>Effectiveness + delay + cost rates</span></div><div class="di445-learn-arrow">→</div><div class="di445-learn-node"><b>Model & Policy Learning</b><span>Future recommendation quality</span></div></div>
   <div class="di445-next"><button class="di401-action secondary" data-di-open="models">Model Registry <i class="di451-nav-icon">↗</i></button></div>
 </div>`;
}
function stageView(d){if(S.stage==='map')return digitalDecisionMap(d);if(S.stage==='evidence')return evidenceView(d);if(S.stage==='alternatives')return alternativesView(d);if(S.stage==='evaluation')return evaluationView(d);if(S.stage==='recommendation')return recommendationView(d);if(S.stage==='governance')return governanceView(d);if(S.stage==='execution')return executionView(d);return outcomeView(d)}
function workspace(){if(window.AIP_DI_ACTIVE_ROW)S.selected=window.AIP_DI_ACTIVE_ROW;const d=selected();if(!d)return '<div class="di401-card">No decisions available.</div>';return `<div class="di401-card"><div class="di401-work-head"><div><h2>${esc(d.id)} · ${esc(d.title)}</h2><div class="di401-meta">${esc(d.site)} · ${esc(d.asset)} · <span class="di531-priority-label">Priority:</span> ${priorityPill(d.priority)} · <span class="di532-status-label">Status:</span> <button type="button" class="di532-status-button" data-di-workflow-status="${esc(d.status)}">${esc(d.status)} <i>↗</i></button></div></div></div>${thread()}<div class="di401-stage">${stageView(d)}</div></div>`}
function bind(){
 $$('.di401-tab').forEach(b=>b.onclick=()=>{
   S.tab=b.dataset.diTab;
   if(S.tab==='workspace'||S.tab==='assetvalue'){
     const ctx=window.AIP_DI_RETURN_TO_OVERVIEW_ID||window.AIP_DI_ACTIVE_ROW||window.AIP_DI_SELECTED_CONTEXT?.decisionId||S.selected;
     if(ctx){
       S.selected=ctx;
       window.AIP_DI_ACTIVE_ROW=ctx;
       window.AIP_DI_SELECTED_CONTEXT={decisionId:ctx};
     }
     if(S.tab==='workspace'&&!S.stage)S.stage='map';
   }
   render();
 });
 $('#di401Priority')?.addEventListener('change',e=>{S.filters.priority=e.target.value;refreshOverviewRows()});
 $('#di401Category')?.addEventListener('change',e=>{S.filters.category=e.target.value;refreshOverviewRows()});
 $('#di401Search')?.addEventListener('input',e=>{S.filters.search=e.target.value;refreshOverviewRows()});
 $('#di401Reset')?.addEventListener('click',()=>{S.filters={priority:'All',category:'All',search:''};if($('#di401Priority'))$('#di401Priority').value='All';if($('#di401Category'))$('#di401Category').value='All';if($('#di401Search'))$('#di401Search').value='';refreshOverviewRows()});
 bindReviewRows();
 bindOverviewRows();
 $$('[data-di-priority]').forEach(b=>b.onclick=()=>{setDecisionContext(b.dataset.diPriority);S.tab='workspace';S.stage='map';render()});
 $$('[data-di-status-open]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();setDecisionContext(b.dataset.diStatusOpen);S.tab='workspace';S.stage='governance';render()});
 $('#ddmPolicy')?.addEventListener('click',()=>{if(!S.showPriorityPolicy){S.showPriorityPolicy=true;render();}});
 $$('[data-ddm-policy-close]').forEach(b=>b.addEventListener('click',e=>{
   e.preventDefault();
   e.stopPropagation();
   S.showPriorityPolicy=false;
   render();
 }));
 $$('[data-alt-basis]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();S.altBasis=Number(b.dataset.altBasis);render();}));$$('[data-alt-basis-close]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();S.altBasis=null;render();}));
 $$('[data-di-sim-alt]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const d=selected(),i=Number(b.dataset.diSimAlt),a=d?.alternatives?.[i];if(!d||!a)return;window.AIP_SCENARIO_CONTEXT={origin:'Decision Intelligence',decisionId:d.id,decision:d,alternative:a,alternativeIndex:i,returnStage:'alternatives',authority:'v87_460'};window.AIP_DI_RETURN={decisionId:d.id,tab:'workspace',stage:'alternatives'};try{if(window.AIP_V21?.renderers&&typeof window.AIPRenderScenarioAnalysis453==='function'){window.AIP_V21.renderers.scenariosimulator2=window.AIPRenderScenarioAnalysis453;window.AIP_V21.renderers.scenariosimulator=window.AIPRenderScenarioAnalysis453}if(typeof renderFns!=='undefined'&&typeof window.AIPRenderScenarioAnalysis453==='function'){renderFns.scenariosimulator2=window.AIPRenderScenarioAnalysis453;renderFns.scenariosimulator=window.AIPRenderScenarioAnalysis453}/* IMPORTANT: do not force navigation here. The global activate(force=true) path intentionally rejects navigation for 6 seconds after a recent user navigation, which made Test Alternative intermittent. */if(typeof window.activate==='function')window.activate('scenariosimulator2',false);else window.AIP_V21?.open?.('scenariosimulator2');requestAnimationFrame(()=>{try{const v=document.getElementById('view-scenariosimulator2');if(v&&!v.classList.contains('active')){document.querySelector('.view.active')?.classList.remove('active');v.classList.add('active');document.querySelector('.nav-item.active')?.classList.remove('active');document.querySelector('.nav-item[data-view="scenariosimulator2"]')?.classList.add('active')}window.AIPRenderScenarioAnalysis453?.()}catch(err){console.error('v87_459 alternative scenario render failed',err)}})}catch(err){console.error('v87_459 Test Alternative navigation failed',err)}});
 const vp=$('.ddm-viewport'),cv=$('#ddmCanvas'),pl=$('#ddmPanLeft'),pr=$('#ddmPanRight');
 if(vp&&cv&&pl&&pr){
   let offset=0;
   const updatePan=()=>{
     const max=Math.max(0,cv.scrollWidth-vp.clientWidth);
     offset=Math.max(0,Math.min(offset,max));
     cv.style.transform=`translateX(${-offset}px)`;
     pl.disabled=offset<=0;
     pr.disabled=offset>=max;
   };
   pl.addEventListener('click',()=>{offset-=Math.max(120,vp.clientWidth*.35);updatePan()});
   pr.addEventListener('click',()=>{offset+=Math.max(120,vp.clientWidth*.35);updatePan()});
   setTimeout(updatePan,0);
 }
 $$('[data-ddm-stage]').forEach(b=>b.onclick=()=>{S.stage=b.dataset.ddmStage;render()});
 $$('[data-di-stage]').forEach(b=>b.onclick=()=>{const d=selected(),target=b.dataset.diStage;if(target==='governance'&&!evidenceValidated(d)){S.stage='evidence';toast?.('Complete Evidence Review before Governance & Approval');}else S.stage=target;render()});
 $$('[data-di-stage-jump]').forEach(b=>b.onclick=()=>{const d=selected(),target=b.dataset.diStageJump;if(target==='governance'&&!evidenceValidated(d)){S.stage='evidence';toast?.('Complete Evidence Review before Governance & Approval');}else S.stage=target;render()});
 $$('[data-di-evidence-decision]').forEach(b=>b.onclick=()=>{const d=selected();if(!d)return;S.evidenceReview[d.id]=b.dataset.diEvidenceDecision;render()});
 $$('[data-di-evidence-open]').forEach(b=>b.onclick=()=>{const d=selected(),e=d?.evidence?.[Number(b.dataset.diEvidenceOpen)];if(!e)return;window.AIP_DI_EVIDENCE_CONTEXT={decisionId:d.id,source:e.source,record:e.record,target:e.target};go(e.target)});
 $$('[data-di-open]').forEach(b=>b.onclick=()=>go(b.dataset.diOpen));

 $$('[data-di-workflow-status]').forEach(b=>b.onclick=()=>{
   const d=selected();if(!d)return;
   const s=String(d.status||'').toLowerCase();
   if(/planning|required|parts|constraint|scheduled|execution|in progress|awaiting part/.test(s))S.stage='execution';
   else if(/evidence|review/.test(s))S.stage='evidence';
   else if(/approval|approved|rejected|returned/.test(s))S.stage='governance';
   else if(/completed|closed|realized|verified/.test(s))S.stage='outcome';
   else S.stage='map';
   render();
 });

 $('#di401PolicyBtn')?.addEventListener('click',()=>{S.showPolicy=!S.showPolicy;render()});

 $$('[data-di-decision]').forEach(b=>b.onclick=()=>{const d=selected();if(!d)return;const raw=b.dataset.diDecision,outcome=raw==='Deferred'?'Returned for Review':raw,authority=(d.governance||[]).find(g=>/approval authority/i.test(g.stage))?.role||'Authorized Approver',timestamp=new Date().toLocaleString('en-IN');S.decisionAction[d.id]=outcome;S.governanceAudit[d.id]={outcome,actor:authority,authority,timestamp};if(outcome==='Returned for Review'){S.evidenceReview[d.id]='Needs review';S.stage='evidence'}else S.stage='governance';render()});
}
function render(){
 const v=document.getElementById('view-decisionintelligence');if(!v)return;
 if(window.AIP_DI_RETURN){S.selected=window.AIP_DI_RETURN.decisionId||S.selected;S.tab=window.AIP_DI_RETURN.tab||S.tab;S.stage=window.AIP_DI_RETURN.stage||S.stage;window.AIP_DI_RETURN=null}
 if(S.tab==='workspace' && !S.stage)S.stage='map';
 const content=S.tab==='overview'?overview():(S.tab==='workspace'?workspace():assetValue());
 v.innerHTML=header()+tabs()+content;
 if(S.tab==='overview'){if($('#di401Priority'))$('#di401Priority').value=S.filters.priority;if($('#di401Category'))$('#di401Category').value=S.filters.category;if($('#di401Search'))$('#di401Search').value=S.filters.search}
 bind();
 if(S.tab==='assetvalue'){
   const host=$('#di401AtvHost');
   if(host&&typeof window.AIPRenderAssetToValueIntelligence==='function')window.AIPRenderAssetToValueIntelligence(host,selected());
 }
}
window.renderDecisionIntelligenceV401=render;
window.renderDecisionIntelligence=render;
try{if(typeof renderFns!=='undefined')renderFns.decisionintelligence=render}catch(_e){}
document.addEventListener('aip:data-source-changed',()=>{if(document.getElementById('view-decisionintelligence')?.classList.contains('active'))render()});
setTimeout(()=>{try{if(typeof renderFns!=='undefined')renderFns.decisionintelligence=render}catch(_e){}},100);
})();
