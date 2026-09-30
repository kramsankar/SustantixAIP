
(function(){
const FINAL_SCREEN_HELP = __AIP_DS("82651ec5d7e8a281");
const ACTIVE_VIEW_HELP_KEY = {"view-overview":"overview","view-decisionintelligence":"decisionintelligence","view-financialimpact":"financialimpact","view-scenariosimulator":"scenariosimulator","view-decisiontraceability":"decisiontraceability","view-closedloopexecution":"closedloopexecution","view-benefitsrealization":"benefitsrealization","view-reliabilityengineering":"reliabilityengineering","view-portfoliobenchmarking":"portfoliobenchmarking","view-aigovernance":"aigovernance","view-aivision":"aivision","view-workorderintelligence":"workorderintelligence","view-corrective":"corrective","view-preventive":"preventive","view-adaptive":"adaptive","view-predictive":"predictive","view-prescriptive":"prescriptive","view-riskbased":"riskbased","view-rcm":"rcm","view-opportunistic":"opportunistic","view-approval":"approval","view-maintenancelearning":"maintenancelearning","view-spares":"spares","view-inventory":"inventory","view-warrantyrecovery":"warrantyrecovery","view-crewscheduling":"crewscheduling","view-esgoverview":"esgoverview","view-carbonwater":"carbonwater","view-circularity":"circularity","view-hseclimate":"hseclimate","view-executiveperformance":"executiveperformance","view-rootcause":"rootcause","view-assetrelationships":"assetrelationships","view-lossintelligence":"lossintelligence","view-siteperformance":"siteperformance","view-commercialppa":"commercialppa","view-managementactions":"managementactions","view-models":"models","view-integrations":"integrations","view-climateintelligence":"climateintelligence","view-dataexplorer":"dataexplorer","view-datamanagement":"datamanagement"};
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function activeHelpKey(requested){const active=document.querySelector('.view.active[id]');return (active&&ACTIVE_VIEW_HELP_KEY[active.id])||requested;}
function finalOpenHelp(requested){
 const key=activeHelpKey(requested);
 const tag=document.getElementById('helpTag'),title=document.getElementById('helpTitle'),body=document.getElementById('helpBody'),overlay=document.getElementById('helpOverlay'); if(!tag||!title||!body||!overlay)return;
 const h=FINAL_SCREEN_HELP[key];
 if(!h){
   const legacy = (typeof V2_HELP!=='undefined'&&V2_HELP[key]) || (typeof HELP_CONTENT!=='undefined'&&HELP_CONTENT[key]) || {};
   const legacyTitle = legacy.title || key;
   const legacyWhat = legacy.what || legacy.purpose || 'No description available yet for this screen.';
   const legacyKpis = (typeof KPI_FORMULA_HELP!=='undefined'&&KPI_FORMULA_HELP[key]) || [];
   tag.textContent='F1 Help · '+key.toUpperCase(); title.textContent=legacyTitle;
   let y=`<div class="help-section" style="color:#a15c00;background:#fff6e5;border:1px solid #f0dca0;border-radius:6px;padding:10px 12px"><b>Not yet audited.</b> This screen's help has not been verified against its live calculation code. The description and any formulas below may reflect intended behaviour rather than the exact current implementation — confirm against the source before relying on it.</div>`;
   y+=`<div class="help-section"><h4>Purpose and scope</h4><p>${esc(legacyWhat)}</p></div>`;
   if(legacyKpis.length){y+=`<div class="help-section"><h4>KPI definitions (unverified)</h4><div class="help-metrics">${legacyKpis.map(m=>`<div class="help-metric"><b>${esc(m.name)}</b><span><strong>Formula:</strong> ${esc(m.formula)}<br><strong>Unit:</strong> ${esc(m.unit)}</span></div>`).join('')}</div></div>`;}
   body.innerHTML=y; overlay.classList.add('open'); document.querySelectorAll('.f1-btn').forEach(b=>b.classList.remove('active')); const bb=document.querySelector('.view.active .f1-btn'); if(bb)bb.classList.add('active');
   return;
 }
 tag.textContent='F1 Help · '+key.toUpperCase(); title.textContent=h.title;
 let x=`<div class="help-section"><h4>Purpose and scope</h4><p>${h.purpose}</p></div>`;
 if(h.kpis&&h.kpis.length){x+=`<div class="help-section"><h4>KPI cards displayed on this screen — definitions and exact formulas</h4><p>Only the headline KPI cards actually displayed on <b>${esc(h.title)}</b> are documented below. Table columns, chart measures and KPIs from other screens are deliberately excluded.</p><div class="help-metrics">${h.kpis.map(m=>`<div class="help-metric"><b>${esc(m.name)}</b><span><strong>Formula / derivation:</strong> ${esc(m.formula)}<br><strong>Unit:</strong> ${esc(m.unit)}<br><strong>Scope / period:</strong> ${esc(m.scope)}<br><strong>Inclusion, exclusion and aggregation:</strong> ${esc(m.rules)}<br><strong>Interpretation:</strong> ${esc(m.meaning)}</span></div>`).join('')}</div></div>`;}
 else{x+=`<div class="help-section"><h4>KPI cards displayed on this screen</h4><p><b>No headline KPI cards are displayed on this screen.</b> The help therefore explains only the controls, tables, charts or workflow that are actually present.</p></div>`;}
 if(h.glossary&&h.glossary.length){x+=`<div class="help-section"><h4>Terminology on this screen</h4><div class="help-metrics">${h.glossary.map(g=>`<div class="help-metric"><b>${esc(g.term)}</b><span>${esc(g.def)}</span></div>`).join('')}</div></div>`;}
 x+=`<div class="help-section"><h4>How to use this screen</h4><p>${h.use}</p></div>`;
 if(h.visuals)x+=`<div class="help-section"><h4>Charts, tables and controls</h4><p>${h.visuals}</p></div>`;
 if(h.data)x+=`<div class="help-section"><h4>Data used by this screen</h4><p>${h.data}</p></div>`;
 if(h.limits)x+=`<div class="help-tip">💡 ${h.limits}</div>`;
 x+=`<div class="help-spec"><b>F1 validation rule:</b> Fixed screen-specific mapping from AIP_v1(13).html; hidden elements, inactive views, table fields and KPIs from other screens are not included.</div>`;
 body.innerHTML=x; overlay.classList.add('open'); document.querySelectorAll('.f1-btn').forEach(b=>b.classList.remove('active')); const b=document.querySelector('.view.active .f1-btn'); if(b)b.classList.add('active');
}
window.openHelp=finalOpenHelp;
})();
