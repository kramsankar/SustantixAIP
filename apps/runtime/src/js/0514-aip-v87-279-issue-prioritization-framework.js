
(function(){
'use strict';
const ID='issueprioritization';
const DEFAULTS=[
 {criterion:'Severity',direction:'Descending',rule:'Critical → High → Medium → Low. Severity is inherited from governed source-domain logic.'},
 {criterion:'Value at Risk',direction:'Descending',rule:'Higher value ranks first within the same severity.'},
 {criterion:'Recoverable Value',direction:'Descending',rule:'Higher recoverable value ranks first when preceding criteria are equal.'},
 {criterion:'Confidence',direction:'Descending',rule:'Higher confidence is used as the final tie-breaker.'}
];
function getCfg(){try{return JSON.parse(localStorage.getItem('aipIssuePrioritization')||'null')||{rules:DEFAULTS,topN:5}}catch(_){return {rules:DEFAULTS,topN:5}}}
function ensure(){
 const main=document.querySelector('#main')||document.querySelector('main'); if(!main)return;
 if(!document.getElementById('view-'+ID)){const v=document.createElement('section');v.id='view-'+ID;v.className='view';main.appendChild(v)}
 if(!document.querySelector('#sidebar .ipf-tech-nav')){
   const heads=[...document.querySelectorAll('#sidebar .x-nav-head,#sidebar .nav-section-title,#sidebar .nav-group-title')];
   const h=heads.find(x=>/operational foundations/i.test(x.textContent||''));
   const group=h?.closest('.x-nav-group,.nav-group,.sidebar-section')||document.querySelector('#sidebar');
   if(group){const body=group.querySelector('.x-nav-body,.nav-body,.nav-items')||group;const n=document.createElement('div');n.className='nav-item ipf-tech-nav';n.dataset.view=ID;n.innerHTML='<span style="width:18px;text-align:center">◆</span><span>Issue Prioritization Framework</span>';body.appendChild(n)}
 }
}
function render(){
 ensure(); const v=document.getElementById('view-'+ID); if(!v)return; const c=getCfg();
 v.innerHTML=`<div class="ipf-page"><div class="ipf-head"><h1>Issue Prioritization Framework</h1><button class="ipf-btn" id="ipfClose">Close</button></div>
 <div class="ipf-card"><h2>Ranking Precedence</h2><div class="ipf-note" style="margin-bottom:8px">Governed hierarchical ranking used by Operational Impact Graph. This is not a weighted score.</div>
 <table class="ipf-table"><thead><tr><th>Precedence</th><th>Criterion</th><th>Direction</th><th>Rule</th></tr></thead><tbody>${c.rules.map((r,i)=>`<tr><td>${i+1}</td><td><select class="ipf-select ipf-criterion" data-i="${i}">${['Severity','Value at Risk','Recoverable Value','Confidence'].map(x=>`<option ${x===r.criterion?'selected':''}>${x}</option>`).join('')}</select></td><td><select class="ipf-select ipf-direction" data-i="${i}"><option ${r.direction==='Descending'?'selected':''}>Descending</option><option ${r.direction==='Ascending'?'selected':''}>Ascending</option></select></td><td>${r.rule}</td></tr>`).join('')}</tbody></table></div>
 <div class="ipf-card"><h2>Display Rule</h2><div style="display:grid;grid-template-columns:220px 120px;gap:10px;align-items:center"><span class="ipf-note">Top issues shown on Operational Impact Graph</span><input id="ipfTopN" class="ipf-input" type="number" min="1" max="20" value="${c.topN}"></div></div>
 <div id="ipfSaveStatus" class="ipf-save-status" hidden></div><div class="ipf-actions"><button class="ipf-btn" id="ipfReset">Reset Defaults</button><button class="ipf-btn primary" id="ipfSave">Save Configuration</button></div></div>`;
 document.getElementById('ipfSave').onclick=()=>{
 const rules=c.rules.map((r,i)=>({...r,criterion:document.querySelector(`.ipf-criterion[data-i="${i}"]`).value,direction:document.querySelector(`.ipf-direction[data-i="${i}"]`).value}));
 const topN=Math.max(1,Math.min(20,Number(document.getElementById('ipfTopN').value)||5));
 const saved={rules,topN,revision:Date.now()};
 localStorage.setItem('aipIssuePrioritization',JSON.stringify(saved));
 window.AIP_ISSUE_PRIORITY_CONFIG=saved;

 // Commit to Operational Impact Graph immediately, while this framework remains open.
 let applied=false;
 try{applied=window.refreshOperationalImpactGraph?.()===true}catch(_){}

 // Fallback: if another render cycle is in progress, retry on the next two frames.
 if(!applied){
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
     try{window.refreshOperationalImpactGraph?.()}catch(_){}
   }));
 }

 const msg=document.getElementById('ipfSaveStatus');
 if(msg){
   msg.textContent=`Saved · Top ${topN} applied to Operational Impact Graph`;
   msg.hidden=false;
 }
 toast?.(`Issue Prioritization Framework saved · Top ${topN} applied`);
};
 document.getElementById('ipfReset').onclick=()=>{localStorage.removeItem('aipIssuePrioritization');window.AIP_ISSUE_PRIORITY_CONFIG={rules:DEFAULTS,topN:5};toast?.('Issue Prioritization Framework reset');window.activate?.('contextgraph');setTimeout(()=>{try{renderGraph()}catch(_){}},0)};
 document.getElementById('ipfClose').onclick=()=>{window.activate?.('contextgraph');requestAnimationFrame(()=>{try{window.refreshOperationalImpactGraph?.()}catch(_){}})};
}
function open(){
 ensure();
 document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
 document.querySelectorAll('#sidebar .nav-item').forEach(n=>n.classList.remove('active'));
 document.getElementById('view-'+ID)?.classList.add('active');
 document.querySelector('#sidebar .ipf-tech-nav')?.classList.add('active');
 render();document.querySelector('#main')?.scrollTo(0,0);
}
window.openIssuePrioritizationFramework=open;
window.renderIssuePrioritizationFramework=render;
document.addEventListener('click',e=>{const n=e.target.closest?.('#sidebar .ipf-tech-nav');if(n){e.preventDefault();e.stopPropagation();open()}},true);
setTimeout(ensure,0);
})();
