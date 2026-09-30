
(function(){
'use strict';
window.__AIP_V831_ENGINEERING_KNOWLEDGE__=true;
window.AIP_ENG_V831=__AIP_DS("6557c769367ca1c7");
const E=window.AIP_ENG_V831;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mode(){try{if(window.AIP_SYNTHETIC_ACTIVE===true)return 'Synthetic'}catch(_){}return /synthetic/i.test(String(window.APM_DATA_MODE||window.DATA_SOURCE_MODE||''))?'Synthetic':'Excel'}
function rows(name,fallback){
 if(mode()==='Synthetic'){try{const x=window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData?.[name];if(Array.isArray(x)&&x.length)return x}catch(_){}}
 try{const x=window.APM_IMPORTED_DATA?.[name];if(Array.isArray(x)&&x.length)return x}catch(_){}
 try{const x=window.EMBEDDED_EXCEL_DATA?.[name];if(Array.isArray(x)&&x.length)return x}catch(_){}
 return fallback||[];
}
function reg(){return rows('Engineering Model Registry',E.registry)}
function checks(){return rows('Engineering Model Checks',E.checks)}
function apps(){return rows('Engineering Model Applicability',E.applicability)}
function evals(){return rows('CBM Engineering Evaluation',E.evaluation)}
function sources(){return rows('Engineering Model Sources',E.sources)}
function flows(){return rows('Strategy Governance Flow',E.strategyFlow)}
window.AIP_ENG_SELECTED_MODEL=window.AIP_ENG_SELECTED_MODEL||'ENG-TRK-POS-001';
window.aip831OpenEngineeringModel=function(id,cbmId){
 window.AIP_ENG_SELECTED_MODEL=id||window.AIP_ENG_SELECTED_MODEL;
 if(cbmId)window.AIP_ENG_FROM_CBM=cbmId;
 window.AR_ACTIVE_TAB='engineering';
 try{activate('assetrelationships')}catch(_){document.querySelector('.nav-item[data-view="assetrelationships"]')?.click()}
 const go=()=>{try{renderAssetRelationships(window.AIP_CONTEXT_NAV||null)}catch(_){}setTimeout(()=>{decorateEngineering();window.renderAIP831Engineering?.()},20)};
 setTimeout(go,35);
};
window.aip831OpenCBM=function(id){
 if(!id)return;
 try{activate('conditionbased')}catch(_){try{activate('predictive')}catch(__){}}
 let n=0;const t=setInterval(()=>{n++;try{window.cbm818Select?.(id);const r=document.querySelector('#view-conditionbased tr[data-cbm-current="true"]');if(r){r.scrollIntoView({block:'center'});clearInterval(t)}}catch(_){}if(n>18)clearInterval(t)},80);
};
window.aip831PhysicsFitBox=function(a){
 const modelId=a.Engineering_Model_ID||apps().find(x=>String(x.CBM_Assessment_ID)===String(a.CBM_Assessment_ID))?.Engineering_Model_ID||'';
 const model=reg().find(x=>String(x.Model_ID)===String(modelId));
 const er=evals().filter(x=>String(x.CBM_Assessment_ID)===String(a.CBM_Assessment_ID)).sort((x,y)=>Number(x.Sequence)-Number(y.Sequence));
 const pct=Number(a.Engineering_Physics_Fit_Pct);
 const checksHtml=er.map(x=>`<div class="cbm831-check"><b>${esc(x.Check_Name)} · ${esc(x.Result||'')}</b><span>${Number(x.Check_Score_Pct).toFixed(1)}%</span></div>`).join('');
 return `<div class="cbm830-evidence-box cbm831-fit-box"><button class="cbm831-fit-toggle" type="button" onclick="this.nextElementSibling.classList.toggle('open')"><span>Engineering / physics fit</span><b>${Number.isFinite(pct)?pct.toFixed(1):'N/A'}${Number.isFinite(pct)?'%':''}</b><small>${model?esc(model.Model_ID+' · '+model.Model_Name):'Model basis unavailable'} · Basis ▾</small></button><div class="cbm831-fit-basis"><div class="cbm831-model-line"><b>Applicable model:</b> ${esc(modelId||'N/A')}${model?` · ${esc(model.Physics_Domain)} · Rev ${esc(model.Revision)}`:''}</div>${checksHtml||'<div class="cbm831-model-line">No governed model-check evaluation is available.</div>'}${a.Verification_Method?`<div class="cbm831-verification"><b>Verification method</b><br>${esc(a.Verification_Method)}</div>`:''}<div class="cbm831-fit-actions">${modelId?`<button type="button" onclick="aip831OpenEngineeringModel('${esc(modelId)}','${esc(a.CBM_Assessment_ID)}')">Open engineering model</button>`:''}</div></div></div>`;
};
function strategyName(view){return view==='conditionbased'?'Condition-Based':view==='riskbased'?'Risk-Based':view.charAt(0).toUpperCase()+view.slice(1)}
function ensureGov(view){
 const root=document.getElementById('view-'+view);if(!root)return;
 root.querySelector(':scope>.aip675-strategy-chain')?.setAttribute('aria-hidden','true');
 if(root.querySelector(':scope>.aip831-strategy-gov'))return;
 const flow=flows().find(x=>String(x.Strategy_Type)===strategyName(view))||null;if(!flow)return;
 const holder=document.createElement('div');holder.className='aip831-strategy-gov';
 holder.innerHTML=`<button type="button" class="aip831-gov-btn">Strategy Governance ▾</button>`;
 const panel=document.createElement('div');panel.className='aip831-gov-panel';
 panel.innerHTML=`<div class="aip831-gov-chain"><div class="aip831-gov-node"><span>Engineering authority</span><b>${esc(flow.Engineering_Authority)}</b></div><div class="aip831-gov-node"><span>Strategy</span><b>${esc(flow.Strategy)}</b></div><div class="aip831-gov-node"><span>Trigger / decision rule</span><b>${esc(flow.Trigger_or_Decision_Rule)}</b></div><div class="aip831-gov-node"><span>AIP handoff</span><b>${esc(flow.AIP_Recommendation_or_Handoff)}</b></div><div class="aip831-gov-node"><span>Execution governance</span><b>${esc(flow.Execution_Governance)}</b></div></div>`;
 holder.querySelector('button').onclick=()=>panel.classList.toggle('open');
 const tabs=root.querySelector(':scope>.aip-maint-subtabs'),head=root.querySelector(':scope>.view-head');
 if(tabs){tabs.insertAdjacentElement('afterend',panel);tabs.insertAdjacentElement('afterend',holder)}else if(head){head.insertAdjacentElement('afterend',panel);head.insertAdjacentElement('afterend',holder)}else{root.prepend(panel);root.prepend(holder)}
}
window.AIP831EnsureStrategyGovernance=ensureGov;
function decorateAllGov(){['preventive','conditionbased','predictive','corrective','riskbased','adaptive'].forEach(ensureGov)}
function modelListHtml(models){
 return models.map(m=>`<button class="aip831-model-row ${String(m.Model_ID)===String(window.AIP_ENG_SELECTED_MODEL)?'active':''}" onclick="AIP_ENG_SELECTED_MODEL='${esc(m.Model_ID)}';renderAIP831Engineering()"><b>${esc(m.Model_ID)} · ${esc(m.Model_Name)}</b><span>${esc(m.Asset_Class)} · ${esc(m.Failure_Mode)}</span></button>`).join('');
}
window.renderAIP831Engineering=function renderEngineering(){
 const pane=document.querySelector('#view-assetrelationships [data-ar-pane="engineering"]');if(!pane)return;
 const models=reg();if(!models.length){pane.innerHTML='<div class="ai3-panel">No engineering models available.</div>';return}
 let sel=models.find(x=>String(x.Model_ID)===String(window.AIP_ENG_SELECTED_MODEL))||models[0];window.AIP_ENG_SELECTED_MODEL=sel.Model_ID;
 const cs=checks().filter(x=>String(x.Model_ID)===String(sel.Model_ID)).sort((a,b)=>Number(a.Sequence)-Number(b.Sequence));
 const ap=apps().filter(x=>String(x.Engineering_Model_ID)===String(sel.Model_ID));
 const src=sources().find(x=>String(x.Model_ID)===String(sel.Model_ID));
 const classes=[...new Set(models.map(x=>x.Asset_Class))].sort();
 pane.innerHTML=`<div class="aip831-eng-top"><aside class="aip831-model-list"><div class="aip831-model-tools"><input id="aip831ModelSearch" placeholder="Search models…" oninput="aip831FilterModels()"><select id="aip831ModelClass" onchange="aip831FilterModels()"><option value="">All classes</option>${classes.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="aip831-model-scroll" id="aip831ModelRows">${modelListHtml(models)}</div></aside><main class="aip831-eng-main"><div class="aip831-model-head"><div><h3>${esc(sel.Model_ID)} · ${esc(sel.Model_Name)}</h3><p>${esc(sel.Physics_Domain)} · ${esc(sel.Model_Type)} · Reference ${esc(sel.Reference_ID)} · RCM ${esc(sel.RCM_ID)} · Revision ${esc(sel.Revision)}</p></div><span class="aip831-model-badge">${esc(sel.Status)}</span></div><div class="aip831-graph"><div class="aip831-graph-node"><small>Asset class</small><b>${esc(sel.Asset_Class)}</b></div><div class="aip831-graph-node"><small>Component</small><b>${esc(sel.Component)}</b></div><div class="aip831-graph-node"><small>Failure mode</small><b>${esc(sel.Failure_Mode)}</b></div><div class="aip831-graph-node"><small>Engineering model</small><b>${esc(sel.Model_ID)}</b></div><div class="aip831-graph-node"><small>Model checks</small><b>${cs.length} governed checks</b></div><div class="aip831-graph-node"><small>CBM applicability</small><b>${ap.length} linked assessments</b></div></div><div class="aip831-check-grid">${cs.map(c=>`<div class="aip831-check-card"><header><b>${esc(c.Sequence+'. '+c.Check_Name)}</b><em>${Number(c.Weight_Pct).toFixed(0)}%</em></header><p><b>Evidence:</b> ${esc(c.Required_Signal_or_Evidence)}</p><p>${esc(c.Engineering_Relationship)}</p></div>`).join('')}</div><div class="aip831-lineage"><div><span>Design / source authority</span><b>${esc(src?.Source_Authority||sel.Source_Authority)}</b></div><div><span>PLM / OEM processing</span><b>${esc(src?.PLM_OEM_Processing||'Governed source mapping')}</b></div><div><span>Engineering registry</span><b>${esc(sel.Registry_Owner||'AIP Engineering Knowledge Registry')}</b></div><div><span>Knowledge graph link</span><b>Asset → component → failure mode → model → evidence</b></div><div><span>CBM use</span><b>Model-specific check evaluation produces Engineering / Physics Fit</b></div></div><div class="aip831-eng-actions">${ap[0]?`<button onclick="aip831OpenCBM('${esc(ap[0].CBM_Assessment_ID)}')">Open linked CBM ${esc(ap[0].CBM_Assessment_ID)} ↗</button>`:''}<button class="secondary" onclick="AR_ACTIVE_TAB='explorer';renderAssetRelationships()">Open relationship explorer ↗</button></div></main></div>`;
};
window.aip831FilterModels=function(){
 const q=String(document.getElementById('aip831ModelSearch')?.value||'').toLowerCase(),cl=String(document.getElementById('aip831ModelClass')?.value||'');
 const ms=reg().filter(m=>(!cl||m.Asset_Class===cl)&&(!q||Object.values(m).some(v=>String(v??'').toLowerCase().includes(q))));
 const box=document.getElementById('aip831ModelRows');if(box)box.innerHTML=modelListHtml(ms);
};
function decorateEngineering(){
 const root=document.getElementById('view-assetrelationships');if(!root)return;
 const tabs=root.querySelector('.ar-tabs');if(!tabs)return;
 let btn=tabs.querySelector('[data-ar-tab="engineering"]');
 if(!btn){btn=document.createElement('button');btn.className='ar-tab';btn.dataset.arTab='engineering';btn.textContent='Engineering Models';tabs.appendChild(btn);btn.onclick=()=>{window.AR_ACTIVE_TAB='engineering';root.querySelectorAll('[data-ar-tab]').forEach(x=>x.classList.toggle('active',x===btn));root.querySelectorAll('[data-ar-pane]').forEach(x=>x.classList.toggle('active',x.dataset.arPane==='engineering'));window.renderAIP831Engineering?.()}}
 let pane=root.querySelector('[data-ar-pane="engineering"]');
 if(!pane){pane=document.createElement('section');pane.className='ar-pane aip831-eng-pane';pane.dataset.arPane='engineering';tabs.insertAdjacentElement('afterend',pane)}
 if(window.AR_ACTIVE_TAB==='engineering'){root.querySelectorAll('[data-ar-tab]').forEach(x=>x.classList.toggle('active',x.dataset.arTab==='engineering'));root.querySelectorAll('[data-ar-pane]').forEach(x=>x.classList.toggle('active',x.dataset.arPane==='engineering'));window.renderAIP831Engineering?.()}
}
const mo=new MutationObserver(ms=>{let gov=false,eng=false;for(const m of ms){const t=m.target.nodeType===1?m.target:m.target.parentElement;if(t?.closest?.('#view-conditionbased,#view-preventive,#view-predictive,#view-corrective,#view-riskbased,#view-adaptive'))gov=true;if(t?.closest?.('#view-assetrelationships'))eng=true}if(gov)requestAnimationFrame(decorateAllGov);if(eng)requestAnimationFrame(decorateEngineering)});
function boot(){decorateAllGov();decorateEngineering()}
/* v87_855 performance: body-wide v831 observer disabled; navigation/data events recreate governance/engineering UI on demand. */
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80));else setTimeout(boot,80);
document.addEventListener('click',e=>{if(e.target.closest?.('.aip-maint-subtabs,[data-view="assetrelationships"]'))setTimeout(boot,40)},true);
window.addEventListener('aip:data-source-changed',()=>setTimeout(boot,80));
window.AIP_V831_AUDIT={release:'v87_831',baseline:'v87_830',businessDataChanged:true,changes:['Engineering Knowledge Registry','Model-specific Physics Fit basis','Engineering Models graphical tab','PLM/OEM source processing lineage','Compact expandable Strategy Governance across all Maintenance Strategy tabs']};
window.AIP_CURRENT_BUILD='v87_831';
})();
