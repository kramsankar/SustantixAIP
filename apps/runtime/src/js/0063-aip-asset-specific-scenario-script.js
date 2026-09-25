
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const money=v=>{const n=Math.round(num(v));if(Math.abs(n)>=10000000)return '₹'+(n/10000000).toFixed(2)+' Cr';if(Math.abs(n)>=100000)return '₹'+(n/100000).toFixed(2)+' lakh';return '₹'+n.toLocaleString('en-IN')};
const mode=()=>{try{return String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:(window.APM_DATA_MODE||'Current data'))}catch(_){return 'Current data'}};
const isSynthetic=()=>/demo data|synthetic/i.test(mode())&&!/excel/i.test(mode());
const sourceLabel=()=>isSynthetic()?'Synthetic data set':(/uploaded/i.test(mode())?'Uploaded Excel data':'Bundled Excel data');
let assetMode=true;
let focusRef=null;
let currentContext=null;
let originalRenderer=null;
let userOverrides={};
let assumptions={tariff:4.5,derating:6,deferDays:30,repairCost:650000,replacementCost:4200000,downtimeRate:0.85};
function globalArray(name){try{const v=eval(name);return Array.isArray(v)?v:[]}catch(_){return []}}
function importedRows(sheet){try{const d=(typeof APM_IMPORTED_DATA!=='undefined'&&APM_IMPORTED_DATA)||window.APM_IMPORTED_DATA||{};return Array.isArray(d[sheet])?d[sheet]:[]}catch(_){return []}}
function activeRows(sheet){
 const maps={
  'Asset Master':['ASSET_REGISTRY'],'Graph Asset Selector':['ASSET_REGISTRY'],'Asset Explorer View':['ASSET_REGISTRY'],'Assets':['ASSET_REGISTRY'],'Asset Registry':['ASSET_REGISTRY'],
  'AI Alerts & RUL':['AI_ALERTS','RISK_QUEUE'],'AI Alerts':['AI_ALERTS','RISK_QUEUE'],'Predictions':['AI_ALERTS','RISK_QUEUE'],'Predictive Maintenance':['AI_ALERTS','RISK_QUEUE'],
  'Work Orders':['ALL_WOS'],'Work_Orders':['ALL_WOS'],
  'Event Reconstruction':['EVENT_LOG'],'Event Log':['EVENT_LOG'],'Event_Log':['EVENT_LOG'],'Events':['EVENT_LOG'],'Root Cause':['EVENT_LOG'],
  'AI Vision Findings':['VISION_FINDINGS'],'AI Vision':['VISION_FINDINGS'],'AI_Vision':['VISION_FINDINGS'],'Vision Findings':['VISION_FINDINGS'],
  'Warranty Claim Opportunities':['WARRANTY_CLAIMS'],'Warranty Claims':['WARRANTY_CLAIMS'],'Warranty_Claims':['WARRANTY_CLAIMS'],'Warranty Register':['WARRANTY_REGISTER'],
  'Prescriptive Actions':['PRESCRIPTIVE_ACTIONS'],'Prescriptive Maintenance':['PRESCRIPTIVE_ACTIONS'],
  'Sites':['PLANTS']
 };
 const rows=[];
 const names=maps[sheet]||[];names.forEach(n=>rows.push(...globalArray(n)));
 if(!isSynthetic()){
   rows.push(...importedRows(sheet));
   try{if(Array.isArray(window.EXCEL_DATA?.[sheet]))rows.push(...window.EXCEL_DATA[sheet])}catch(_){}
   try{if(Array.isArray(window.WORKBOOK_DATA?.[sheet]))rows.push(...window.WORKBOOK_DATA[sheet])}catch(_){}
   try{if(Array.isArray(window.ACTIVE_DATASET?.[sheet]))rows.push(...window.ACTIVE_DATASET[sheet])}catch(_){}
   try{if(typeof EMBEDDED_EXCEL_DATA!=='undefined'&&Array.isArray(EMBEDDED_EXCEL_DATA?.[sheet]))rows.push(...EMBEDDED_EXCEL_DATA[sheet])}catch(_){}
 }
 const seen=new Set(),out=[];
 for(const r of rows){
   if(!r||typeof r!=='object')continue;
   const id=value(r,'Work_Order_ID','WO_ID','Alert_ID','Event_ID','Finding_ID','Claim_ID','Warranty_ID','Action_ID','Asset_ID','Asset_Tag','assetId','tag','id');
   const key=norm(id)+'|'+JSON.stringify(r).slice(0,180);
   if(seen.has(key))continue;seen.add(key);out.push(r);
 }
 return out;
}
function value(r,...keys){for(const k of keys){if(r&&r[k]!=null&&String(r[k]).trim()!=='')return r[k]}return ''}
function assetIdentity(r){return {id:norm(value(r,'Asset_ID','Asset Id','assetId','id','asset_id')),tag:norm(value(r,'Asset_Tag','Asset Tag','Tag','tag','asset','Asset','assetTag','asset_tag'))}}
function findAsset(ref){
 const aid=norm(ref?.assetId||ref?.id),tag=norm(ref?.tag||ref?.assetTag);
 const pools=['Graph Asset Selector','Asset Explorer View','Asset Master','Assets','Asset Registry'];
 for(const sh of pools){for(const r of activeRows(sh)){const x=assetIdentity(r);if((aid&&x.id===aid)||(tag&&x.tag===tag))return r}}
 return null;
}
function linked(sheetNames,ref){
 const aid=norm(ref?.assetId||ref?.id),tag=norm(ref?.tag||ref?.assetTag),out=[],seen=new Set();
 for(const sh of sheetNames){for(const r of activeRows(sh)){
  const x=assetIdentity(r);if(!((aid&&x.id===aid)||(tag&&x.tag===tag)))continue;
  const key=sh+'|'+norm(value(r,'Work_Order_ID','WO_ID','Alert_ID','Event_ID','Finding_ID','Claim_ID','id'))+'|'+JSON.stringify(r).slice(0,80);
  if(!seen.has(key)){seen.add(key);out.push(r)}
 }}
 return out;
}
function siteName(asset,raw){
 const direct=raw?.site||raw?.plantName||value(asset,'Plant_Name','Site','siteName');if(direct)return direct;
 const pid=value(asset,'Plant_ID','plant','plantId','plant_id');
 const p=activeRows('Sites').find(x=>String(value(x,'Plant_ID','id','plantId'))===String(pid));
 return value(p,'Plant_Name','name')||pid||'Selected site';
}
function buildContext(ref){
 const asset=findAsset(ref);
 if(!asset)return {missing:true,assetId:ref?.assetId||'',tag:ref?.tag||ref?.assetTag||ref?.assetId||'',source:sourceLabel()};
 const resolved={assetId:value(asset,'Asset_ID','assetId','id','asset_id')||ref?.assetId,tag:value(asset,'Asset_Tag','tag','Asset','assetTag','asset_tag')||ref?.tag};
 const alerts=linked(['AI Alerts & RUL','AI Alerts','Predictions','Predictive Maintenance'],resolved),wos=linked(['Work Orders','Work_Orders'],resolved),events=linked(['Event Reconstruction','Event Log','Event_Log','Events','Root Cause'],resolved),visions=linked(['AI Vision Findings','AI Vision','AI_Vision','Vision Findings'],resolved),warranty=linked(['Warranty Claim Opportunities','Warranty Claims','Warranty_Claims','Warranty Register'],resolved),actions=linked(['Prescriptive Actions','Prescriptive Maintenance'],resolved);
 const alert=alerts[0]||{};
 const health=clamp(num(value(asset,'Health_Score','Health','healthScore','health'),72),0,100);
 let rawRisk=value(alert,'Failure_Risk_Pct','Risk_Score','Failure_Probability_Pct','failureRisk','riskScore','risk');
 let risk=num(rawRisk,Math.max(10,100-health));if(risk>0&&risk<=1)risk*=100;risk=clamp(risk,0,99);
 const rul=Math.max(1,num(value(alert,'RUL_Days','Remaining_Useful_Life_Days','rulDays','rul'),Math.round(120-risk)));
 const capacity=Math.max(.25,num(value(asset,'Capacity_MW','Rated_Capacity_MW','Capacity','capacityMW','capacity','ratedMW'),1.25));
 const install=num(value(asset,'Install_Year','Commissioning_Year','installYear'),2020);
 const age=Math.max(1,new Date().getFullYear()-install);
 const cls=value(asset,'Asset_Class','Asset Type','Asset_Type','assetClass','type','cls')||'Asset';
 return {...resolved,asset,alerts,wos,events,visions,warranty,actions,health,risk,rul,capacity,age,site:siteName(asset,ref),assetClass:cls,source:sourceLabel(),missing:false};
}
function defaultsFor(c){
 const action=linked(['Prescriptive Actions','Prescriptive Maintenance'],c)[0]||{};
 const tariff=num(value(action,'Tariff_INR_kWh','Tariff','tariff'),isSynthetic()?4.15:4.50);
 const derating=clamp(num(value(c.alerts[0]||{},'Derating_Pct','Estimated_Derating_Pct','derating'),Math.max(2,Math.min(15,(100-c.health)*.18))),0,35);
 const repair=Math.max(50000,num(value(action,'Action_Cost_INR','Cost_Now_INR','costNow','cost'),c.capacity*(isSynthetic()?420000:510000)));
 const replacement=Math.max(repair*2.5,num(value(c.asset,'Replacement_Cost_INR','replacementCost'),c.capacity*(isSynthetic()?2600000:3100000)));
 return {tariff,derating,deferDays:isSynthetic()?21:30,repairCost:Math.round(repair),replacementCost:Math.round(replacement),downtimeRate:isSynthetic()?.78:.85};
}
function resetAssumptions(c){assumptions={...defaultsFor(c),...userOverrides}}
function scenarioOptions(c){
 const action=c.actions?.[0]||{};
 const prescribed=String(value(action,'Recommended_Action','Recommended Action','recommendedAction','action','recommendation')||'').trim();
 const trace=window.AIPDecisionTrace.evaluate({assetId:c.assetId,tag:c.tag,assetClass:c.assetClass,health:c.health,risk:c.risk,rul:c.rul,confidence:num(value(c.alerts[0]||{},'Confidence_Pct','confidencePct','confidence'),75),capacity:c.capacity,alerts:c.alerts,workOrders:c.wos,events:c.events,vision:c.visions,warranty:c.warranty,prescribedAction:prescribed,tariff:assumptions.tariff,derating:assumptions.derating,repairCost:assumptions.repairCost,replacementCost:assumptions.replacementCost});
 const result={options:trace.options,recommended:0,dailyMWh:c.capacity*5.2,diagnosis:trace.diagnosis,decisionStatus:trace.decisionStatus,rankingBasis:trace.rankingBasis,trace:trace.trace};
 window.AIP_LAST_ASSET_SCENARIO={assetId:c.assetId,tag:c.tag,site:c.site,assetClass:c.assetClass,source:c.source,diagnosis:trace.diagnosis,best:trace.best,options:trace.options,decisionStatus:trace.decisionStatus,trace:trace.trace,generatedAt:new Date().toISOString()};
 try{localStorage.setItem('aip.lastAssetScenario',JSON.stringify(window.AIP_LAST_ASSET_SCENARIO))}catch(_){}
 return result;
}
function missingView(c){
 const v=$('#view-scenariosimulator2');if(!v)return;
 v.innerHTML=`<div class="view-head"><div><div class="eyebrow" style="color:var(--teal)">ASSET-SPECIFIC WHAT-IF ANALYSIS</div><h1>Scenario Analysis · ${esc(c.tag||c.assetId||'Selected asset')}</h1></div></div><div class="asx-focus-banner"><div>Focused asset unavailable in ${esc(c.source)}<small>The previous source values have been cleared. No stale scenario has been retained.</small></div><button class="asx-btn" id="asxPortfolio">Show portfolio scenarios</button></div><div class="asx-card"><h3>Asset not found</h3><div class="asx-sub">${esc(c.tag||c.assetId)} is not present in the active ${esc(c.source)}. Select an asset from Asset Explorer or return to portfolio scenarios.</div></div>`;
 $('#asxPortfolio',v).onclick=showPortfolio;
}
function showPortfolio(){assetMode=false;window.AIP_SELECTED_ASSET_CONTEXT=null;originalRenderer&&originalRenderer();const host=$('#view-scenariosimulator2');if(host){const b=document.createElement('div');b.className='asx-focus-banner';b.innerHTML='<div>Portfolio scenario mode<small>No asset is currently selected.</small></div><button class="asx-btn primary" id="asxReturn">Return to selected asset</button>';host.prepend(b);$('#asxReturn',host).onclick=()=>{assetMode=true;window.AIP_SELECTED_ASSET_CONTEXT={...focusRef};renderAssetScenario(true)}}}
function renderAssetScenario(reset=false){
 const v=$('#view-scenariosimulator2');if(!v)return;
 const raw=focusRef||window.AIP_SELECTED_ASSET_CONTEXT;
 if(!raw){assetMode=false;return originalRenderer&&originalRenderer()}
 focusRef={assetId:raw.assetId||raw.id||'',tag:raw.tag||raw.assetTag||'',site:raw.site||raw.plantName||'',assetClass:raw.assetClass||''};
 currentContext=buildContext(focusRef);if(currentContext.missing)return missingView(currentContext);
 if(reset)resetAssumptions(currentContext);
 const c=currentContext,m=scenarioOptions(c),best=m.options[m.recommended];
 v.innerHTML=`<div class="view-head"><div><div class="eyebrow" style="color:var(--teal)">ASSET-SPECIFIC WHAT-IF ANALYSIS</div><h1>Scenario Analysis · ${esc(c.tag)}</h1></div></div>
 <div class="asx-focus-banner"><div>Focused asset: <b>${esc(c.tag)}</b> · ${esc(c.assetClass)} · ${esc(c.site)}<small>Source: ${esc(c.source)}. All values and alternatives were recalculated from the active dataset.</small></div><button class="asx-btn" id="asxPortfolio">Show portfolio scenarios</button></div>
 
 <div class="asx-grid"><div><div class="asx-card"><h3>Asset scenario assumptions</h3><div class="asx-sub">Defaults are regenerated from ${esc(c.source)}. Manual edits remain only until the data source changes.</div>${[['Tariff (₹/kWh)','tariff',assumptions.tariff,.05],['Current derating (%)','derating',assumptions.derating,.5],['Deferral period (days)','deferDays',assumptions.deferDays,1],['Repair cost (₹)','repairCost',assumptions.repairCost,10000],['Replacement cost (₹)','replacementCost',assumptions.replacementCost,50000]].map(x=>`<div class="asx-control"><label>${x[0]}</label><input type="number" data-asx-input="${x[1]}" step="${x[3]}" value="${x[2]}"></div>`).join('')}<div class="asx-evidence"><b>Evidence used · ${esc(c.source)}</b><br>Asset master: ${esc(c.assetId||c.tag)} · Prediction records: ${c.alerts.length} · Work orders: ${c.wos.length} · Events: ${c.events.length} · AI Vision: ${c.visions.length} · Warranty: ${c.warranty.length}</div></div></div>
 <div><div class="asx-card asx-diagnosis"><h3>Evidence-based diagnosis</h3><div class="asx-diagnosis-title">${esc(m.diagnosis.label)} <span>${m.diagnosis.confidence.toFixed(1)}% confidence</span></div><div class="asx-sub">${m.diagnosis.basis.map(x=>esc(x)).join(" · ")}</div><div class="asx-decision-chain"><b>Decision chain</b><span>Evidence</span><i>→</i><span>Diagnosis</span><i>→</i><span>Feasible actions</span><i>→</i><span>Scenario ranking</span><i>→</i><span>Enterprise approval</span></div></div><div class="asx-card"><h3>Asset-specific alternatives</h3><div class="asx-sub">Alternatives are generated from the diagnosed failure mechanism, then scored using technical outcome, economic exposure and execution feasibility.</div><div class="asx-options">${m.options.map((o,i)=>`<div class="asx-option ${i===m.recommended?'recommended':''}">${i===m.recommended?'<span class="asx-rec">SCENARIO-RANKED</span>':''}<h4>${esc(o.name)}</h4>${[['Health after action',o.healthAfter.toFixed(0)+'%'],['Failure probability',o.risk.toFixed(1)+'%'],['Expected downtime',o.downtime.toFixed(1)+' h'],['Lost generation',o.lostMWh.toFixed(1)+' MWh'],['Total exposure',money(o.total)],['Remaining life',o.life.toFixed(1)+' yr'],['Technical score',o.technicalScore.toFixed(1)+'/100'],['Economic score',o.economicScore.toFixed(1)+'/100'],['Execution readiness',o.executionScore.toFixed(1)+'/100'],['Evidence confidence',o.evidenceScore.toFixed(1)+'/100'],['Eligibility',o.eligible?'Eligible':'Excluded'],['Overall rank score',o.decisionScore.toFixed(1)+'/100']].map(z=>`<div class="asx-metric"><span>${z[0]}</span><b>${z[1]}</b></div>`).join('')}</div>`).join('')}</div><div class="asx-table-wrap"><table class="asx-table"><thead><tr><th>Alternative</th><th>Health after</th><th>Failure risk</th><th>Downtime</th><th>Lost generation</th><th>Direct cost</th><th>Total exposure</th></tr></thead><tbody>${m.options.map((o,i)=>`<tr class="${i===m.recommended?'recommended':''}"><td>${esc(o.name)}</td><td>${o.healthAfter.toFixed(0)}%</td><td>${o.risk.toFixed(1)}%</td><td>${o.downtime.toFixed(1)} h</td><td>${o.lostMWh.toFixed(1)} MWh</td><td>${money(o.cost)}</td><td>${money(o.total)}</td></tr>`).join('')}</tbody></table></div><div class="asx-rationale"><b>Scenario-ranked technical action for ${esc(c.tag)}:</b> ${esc(best.name)} ranks highest at ${best.decisionScore.toFixed(1)}/100. It reduces failure probability from ${c.risk.toFixed(0)}% to ${best.risk.toFixed(1)}%, with modeled exposure of ${money(best.total)}. <br><strong>Ranking basis:</strong> ${esc(m.rankingBasis)}.<br><strong>Enterprise decision status:</strong> ${esc(m.decisionStatus)}.</div><details class="asx-trace"><summary>Recommendation calculation trace</summary><div class="asx-trace-grid"><div><span>Diagnosis</span><b>${esc(m.diagnosis.label)}</b></div><div><span>Selected action type</span><b>${esc(best.type)}</b></div><div><span>Winning score</span><b>${best.decisionScore.toFixed(1)}/100</b></div><div><span>Engine</span><b>Governed RCM Engine v3.0</b></div></div><table class="asx-table"><thead><tr><th>Rank</th><th>Alternative</th><th>Technical</th><th>Economic</th><th>Execution</th><th>Evidence</th><th>Eligibility / gate</th><th>Final score</th></tr></thead><tbody>${m.options.map((o,i)=>`<tr class="${i===0?'recommended':''}"><td>${i+1}</td><td>${esc(o.name)}</td><td>${o.technicalScore.toFixed(1)}</td><td>${o.economicScore.toFixed(1)}</td><td>${o.executionScore.toFixed(1)}</td><td>${o.evidenceScore.toFixed(1)}</td><td>${o.eligible?'Eligible':esc((o.gates||[]).join('; '))}</td><td><b>${o.decisionScore.toFixed(1)}</b></td></tr>`).join('')}</tbody></table></details><div class="asx-mode-note">This is a technical-economic scenario result, not an approved enterprise decision. Decision Intelligence determines portfolio priority, timing, budget, crew, spares, outage-window and approval readiness before execution. No work order or source-system record is changed here.</div></div></div></div></div>`;
 $('#asxPortfolio',v).onclick=showPortfolio;
 v.querySelectorAll('[data-asx-input]').forEach(inp=>inp.onchange=()=>{const k=inp.dataset.asxInput;assumptions[k]=num(inp.value,assumptions[k]);userOverrides[k]=assumptions[k];renderAssetScenario(false)});
}
function refreshForSourceChange(){
 if(!focusRef&&window.AIP_SELECTED_ASSET_CONTEXT)focusRef={...window.AIP_SELECTED_ASSET_CONTEXT};
 currentContext=null;userOverrides={};
 if(assetMode&&focusRef){window.AIP_SELECTED_ASSET_CONTEXT={...focusRef};renderAssetScenario(true)}
}
function install(){if(!window.AIP_V21||!window.AIP_V21.renderers){setTimeout(install,100);return}if(!originalRenderer)originalRenderer=window.AIP_V21.renderers.scenariosimulator2;window.AIP_V21.renderers.scenariosimulator2=function(){if(assetMode&&(focusRef||window.AIP_SELECTED_ASSET_CONTEXT))renderAssetScenario(false);else originalRenderer&&originalRenderer()}}
document.addEventListener('click',function(e){const tile=e.target.closest('#view-assetexplorer .ax-capability[data-ax-cap="scenariosimulator2"]');if(!tile)return;assetMode=true;const raw=window.AIP_SELECTED_ASSET_CONTEXT;if(raw){focusRef={assetId:raw.assetId||'',tag:raw.tag||'',site:raw.site||'',assetClass:raw.assetClass||''};userOverrides={};renderAssetScenario(true)}},true);
document.addEventListener('aip:data-source-changed',refreshForSourceChange);
install();
})();
