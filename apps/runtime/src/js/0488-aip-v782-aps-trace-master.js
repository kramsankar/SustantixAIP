
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function pct(v,w){return (Number(v||0)*Number(w||0)/100).toFixed(2)}
function selectedAction(all){const id=String(window.AIP_APS_SELECTED_ID||'');return all.find(a=>String(a.id)===id)||all[0]||null}
function traceHTML(a,c,rank,totalPriority){
 if(!a)return '<section id="apcfgTrace" class="apcfg-card"><h2>APS Calculation & Evidence</h2><div class="apcfg-empty">No evaluated action is available.</div></section>';
 const sum=(Number(a.urgency)*c.urgencyWeight+Number(a.operationalRisk)*c.operationalRiskWeight+Number(a.businessImpact)*c.businessImpactWeight+Number(a.recoverability)*c.recoverabilityWeight)/100;
 const evidence=[
   ['Authoritative record',a.id+' · '+a.type],['Source domain',a.category],['Entity / site',(a.entity||'—')+(a.site?' · '+a.site:'')],['Inclusion trigger',a.inclusionTrigger||('APS ≥ '+c.priorityThreshold)],
   ['Exposure',Number(a.exposureINR||0)>0?'₹'+Number(a.exposureINR).toLocaleString('en-IN'):'—'],['Energy at risk',Number(a.energyAtRiskMWh||0)>0?Number(a.energyAtRiskMWh).toFixed(2)+' MWh':'—'],['Current rank',rank+' of '+totalPriority+' qualifying actions'],['Status',a.band+' · '+a.score+'/100']
 ];
 return '<section id="apcfgTrace" class="apcfg-card"><div class="apcfg-trace-head"><div><h2>APS Calculation & Evidence · '+esc(a.id)+'</h2><div class="apcfg-trace-sub">Deterministic governed calculation from the current action population</div></div><div><div class="apcfg-trace-score">'+esc(a.score)+'/100</div><div class="apcfg-trace-sub">'+esc(a.band)+' · threshold '+esc(c.priorityThreshold)+'</div></div></div>'+ 
 '<div class="apcfg-formula">APS = ('+a.urgency+' × '+c.urgencyWeight+'%) + ('+a.operationalRisk+' × '+c.operationalRiskWeight+'%) + ('+a.businessImpact+' × '+c.businessImpactWeight+'%) + ('+a.recoverability+' × '+c.recoverabilityWeight+'%) = '+sum.toFixed(2)+' → '+a.score+'</div>'+ 
 '<div class="apcfg-components">'+[
   ['Urgency',a.urgency,c.urgencyWeight],['Operational / risk criticality',a.operationalRisk,c.operationalRiskWeight],['Business / consequence impact',a.businessImpact,c.businessImpactWeight],['Recoverability',a.recoverability,c.recoverabilityWeight]
 ].map(x=>'<div class="apcfg-comp"><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'/100</b><span>Weight '+esc(x[2])+'% · contribution '+pct(x[1],x[2])+'</span></div>').join('')+'</div>'+ 
 '<div class="apcfg-evidence">'+evidence.map(x=>'<div><b>'+esc(x[0])+'</b>'+esc(x[1])+'</div>').join('')+'</div></section>';
}
function rankingHTML(all,priority,c){
 const selected=String(window.AIP_APS_SELECTED_ID||'');
 return '<section class="apcfg-card"><h2>Current APS Ranking</h2><div class="apcfg-trace-sub">All evaluated cross-domain candidates. Qualifying Attention Now records are APS ≥ '+esc(c.priorityThreshold)+'. Home previews only the highest four qualifying records; it does not force category variety.</div><div class="apcfg-rank-wrap"><table class="apcfg-rank"><thead><tr><th>#</th><th>Record</th><th>Domain</th><th>Type</th><th class="num">APS</th><th>Band</th><th>Trigger</th></tr></thead><tbody>'+all.map((a,i)=>'<tr class="'+(String(a.id)===selected?'selected':'')+'"><td>'+(i+1)+'</td><td><button class="aps-link" data-aps-select="'+esc(a.id)+'">'+esc(a.id)+'</button></td><td class="domain">'+esc(a.category)+'</td><td>'+esc(a.type)+'</td><td class="num"><b>'+esc(a.score)+'</b></td><td>'+esc(a.band)+'</td><td>'+esc(a.inclusionTrigger||'')+'</td></tr>').join('')+'</tbody></table></div><div class="apcfg-trace-sub" style="margin-top:7px">'+priority.length+' of '+all.length+' evaluated actions currently qualify for Attention Now.</div></section>';
}
function render(){
 const v=document.getElementById('view-actionprioritization');if(!v)return;
 const c=aipActionPriorityConfig(),r=aipPriorityActions(),all=r.all||[],priority=r.priority||[];
 if(!window.AIP_APS_SELECTED_ID&&priority[0])window.AIP_APS_SELECTED_ID=priority[0].id;
 const a=selectedAction(all),rank=Math.max(1,priority.findIndex(x=>a&&String(x.id)===String(a.id))+1);
 const f=(id,label,val)=>'<label class="apcfg-field"><span>'+label+'</span><input id="'+id+'" type="number" min="0" max="100" value="'+val+'"></label>';
 v.innerHTML='<div class="apcfg-page"><div class="apcfg-head"><div><h1>Portfolio Action Prioritization</h1><div class="apcfg-trace-sub">Governed Attention Priority Score (APS), cross-domain ranking and evidence trace</div></div>'+(window.AIP_APS_RETURN_TO_HOME?'<button class="apcfg-backhome" id="apcfgBackHome">← Home Cockpit</button>':'')+'</div><div class="apcfg-body"></div></div>';
 const body=v.querySelector('.apcfg-body');
 body.innerHTML=traceHTML(a,c,rank,priority.length)+rankingHTML(all,priority,c)+
 '<section class="apcfg-card"><h2>Priority Threshold</h2>'+f('apcfgThreshold','Priority action threshold',c.priorityThreshold)+'</section>'+ 
 '<section class="apcfg-card"><h2>Ranking Weights</h2><div class="apcfg-grid">'+f('apcfgUrgency','Operational urgency %',c.urgencyWeight)+f('apcfgRisk','Operational risk %',c.operationalRiskWeight)+f('apcfgImpact','Business impact %',c.businessImpactWeight)+f('apcfgRecovery','Recoverability %',c.recoverabilityWeight)+'</div><div id="apcfgValidation" class="apcfg-validation" hidden></div></section>'+ 
 '<section class="apcfg-card apcfg-inputs"><h2>Governed Inputs</h2><div><b>Operational urgency</b><span>SLA breach, overdue status and time-to-impact</span></div><div><b>Operational / risk criticality</b><span>Asset, reliability and HSE risk signals</span></div><div><b>Business / consequence impact</b><span>Value, energy, downtime and service exposure where authoritative data exists</span></div><div><b>Recoverability</b><span>Ability to mitigate or recover the exposure through action</span></div></section>'+ 
 '<div class="apcfg-actions"><button class="btn" id="apcfgReset">Reset</button><button class="btn primary" id="apcfgSave">Save</button></div>';
 const validate=(show)=>{const vals=['apcfgUrgency','apcfgRisk','apcfgImpact','apcfgRecovery'].map(id=>Number(document.getElementById(id)?.value));const total=vals.reduce((a,b)=>a+b,0),box=document.getElementById('apcfgValidation'),ok=vals.every(Number.isFinite)&&total===100;if(box){box.hidden=ok;box.textContent=ok?'':'Current total: '+total+'% · Required total: 100%';box.className='apcfg-validation '+(ok?'':'error')}if(!ok&&show)toast?.('Portfolio Action Prioritization weights total '+total+'%. They must equal exactly 100%.');return ok};
 ['apcfgUrgency','apcfgRisk','apcfgImpact','apcfgRecovery'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>validate(false)));
 document.getElementById('apcfgSave').onclick=()=>{if(!validate(true))return;const n={urgencyWeight:+document.getElementById('apcfgUrgency').value,operationalRiskWeight:+document.getElementById('apcfgRisk').value,businessImpactWeight:+document.getElementById('apcfgImpact').value,recoverabilityWeight:+document.getElementById('apcfgRecovery').value,priorityThreshold:+document.getElementById('apcfgThreshold').value};if(n.priorityThreshold<1||n.priorityThreshold>100){toast?.('Priority threshold must be between 1 and 100.');return}window.AIP_ACTION_PRIORITY={...AIP_ACTION_PRIORITY_DEFAULT,...n};try{localStorage.setItem('aipActionPrioritization',JSON.stringify(window.AIP_ACTION_PRIORITY))}catch(_){}toast?.('Portfolio Action Prioritization configuration saved');render()};
 document.getElementById('apcfgReset').onclick=()=>{window.AIP_ACTION_PRIORITY={...AIP_ACTION_PRIORITY_DEFAULT};try{localStorage.removeItem('aipActionPrioritization')}catch(_){}render();toast?.('Portfolio Action Prioritization reset to default')};
 document.getElementById('apcfgBackHome')?.addEventListener('click',()=>{window.AIP_APS_RETURN_TO_HOME=false;try{window.AIPShowHome?.()}catch(_){}});
 v.querySelectorAll('[data-aps-select]').forEach(b=>b.addEventListener('click',()=>{window.AIP_APS_SELECTED_ID=b.getAttribute('data-aps-select');render();document.getElementById('apcfgTrace')?.scrollIntoView({block:'start'})}));
}
window.renderActionPrioritization=render;
})();
