
(function(){
 'use strict';
 window.__AIP_V801_FINAL_STRATEGY_REASONING__=true;
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const NAMES={preventive:'Preventive',predictive:'Predictive',corrective:'Corrective',riskbased:'Risk-Based',adaptive:'Adaptive'};
 const n=v=>{const x=Number(v);return Number.isFinite(x)?x:NaN};
 const fmt=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mode(){try{if(window.AIP_SYNTHETIC_ACTIVE===true)return 'Synthetic'}catch(_){};return /synthetic/i.test(String(window.APM_DATA_MODE||window.DATA_SOURCE_MODE||''))?'Synthetic':'Excel'}
 function importedRows(){
   try{if(typeof APM_IMPORTED_DATA!=='undefined'&&Array.isArray(APM_IMPORTED_DATA?.['Strategy Reasoning Evidence'])&&APM_IMPORTED_DATA['Strategy Reasoning Evidence'].length)return APM_IMPORTED_DATA['Strategy Reasoning Evidence']}catch(_){}
   try{if(Array.isArray(window.APM_IMPORTED_DATA?.['Strategy Reasoning Evidence'])&&window.APM_IMPORTED_DATA['Strategy Reasoning Evidence'].length)return window.APM_IMPORTED_DATA['Strategy Reasoning Evidence']}catch(_){}
   try{if(typeof EMBEDDED_EXCEL_DATA!=='undefined'&&Array.isArray(EMBEDDED_EXCEL_DATA?.['Strategy Reasoning Evidence'])&&EMBEDDED_EXCEL_DATA['Strategy Reasoning Evidence'].length)return EMBEDDED_EXCEL_DATA['Strategy Reasoning Evidence']}catch(_){}
   return window.AIP_STRATEGY_REASONING_EXCEL||[];
 }
 function allRows(){
   if(mode()==='Synthetic'){
     try{const x=AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData?.['Strategy Reasoning Evidence'];if(Array.isArray(x)&&x.length)return x}catch(_){}
     return window.AIP_STRATEGY_REASONING_SYNTHETIC||[];
   }
   return importedRows();
 }
 function scoped(view){
   const root=document.getElementById('view-'+view),ws=root?.querySelector('.ms686-workspace');
   if(!ws)return {rows:[],asset:'All',site:'All',root,ws};
   const asset=ws.querySelector('.ms686-asset')?.value||root.dataset.ms686asset||'All';
   const site=ws.querySelector('.ms686-site')?.value||root.dataset.ms686site||'All';
   let rows=allRows().filter(r=>String(r.Strategy_Type||'')===NAMES[view]);
   if(site!=='All')rows=rows.filter(r=>String(r.Plant_ID||'')===site);
   if(asset!=='All')rows=rows.filter(r=>String(r.Asset_ID||'')===asset);
   return {rows,asset,site,root,ws};
 }
 function finite(v, fallback){const x=Number(v);return Number.isFinite(x)?x:fallback}
 function suitabilityDesc(a,b){return finite(b.Suitability_Pct,-Infinity)-finite(a.Suitability_Pct,-Infinity)}
 function pickDefault(view,rows){
   if(!rows.length)return null;
   const a=[...rows];
   if(view==='preventive'){
     const withDue=a.filter(r=>Number.isFinite(Number(r.Days_To_Due)));
     if(withDue.length){
       const overdue=withDue.filter(r=>Number(r.Days_To_Due)<0);
       if(overdue.length)return overdue.sort((x,y)=>Number(x.Days_To_Due)-Number(y.Days_To_Due)||suitabilityDesc(x,y))[0];
       return withDue.sort((x,y)=>Number(x.Days_To_Due)-Number(y.Days_To_Due)||suitabilityDesc(x,y))[0];
     }
   }
   if(view==='predictive')return a.sort((x,y)=>finite(y.Alert_Risk_Score,-Infinity)-finite(x.Alert_Risk_Score,-Infinity)||finite(x.RUL_Days,Infinity)-finite(y.RUL_Days,Infinity)||finite(y.Confidence_Pct,-Infinity)-finite(x.Confidence_Pct,-Infinity)||suitabilityDesc(x,y))[0];
   if(view==='corrective')return a.sort((x,y)=>finite(y.Severity_1_5,-Infinity)-finite(x.Severity_1_5,-Infinity)||suitabilityDesc(x,y))[0];
   if(view==='riskbased'){
     const pr={P1:4,P2:3,P3:2,P4:1};
     return a.sort((x,y)=>finite(y.Composite_Risk,-Infinity)-finite(x.Composite_Risk,-Infinity)||(pr[String(y.Priority_Tier||'').toUpperCase()]||0)-(pr[String(x.Priority_Tier||'').toUpperCase()]||0)||suitabilityDesc(x,y))[0];
   }
   if(view==='adaptive')return a.sort((x,y)=>finite(y.Risk_Change_Pct,-Infinity)-finite(x.Risk_Change_Pct,-Infinity)||Math.abs(finite(y.Recommended_Interval_Days,0)-finite(y.Current_Interval_Days,0))-Math.abs(finite(x.Recommended_Interval_Days,0)-finite(x.Current_Interval_Days,0))||suitabilityDesc(x,y))[0];
   return a.sort(suitabilityDesc)[0];
 }
 function selectedCase(view,sc){
   if(sc.asset!=='All'&&sc.rows.length)return sc.rows[0];
   return pickDefault(view,sc.rows);
 }
 function selectionBasis(view,r,sc){
   if(sc.asset!=='All')return 'Exact selected asset / component context';
   if(view==='preventive'){
     const d=Number(r?.Days_To_Due);if(Number.isFinite(d))return d<0?`Most overdue PM obligation · ${Math.abs(Math.round(d))} days overdue`:`Nearest due PM obligation · ${Math.round(d)} days to due`;
     return 'Highest Preventive strategy suitability · fallback';
   }
   if(view==='predictive')return 'Highest alert risk · shortest failure horizon and confidence used as tie-breakers';
   if(view==='corrective')return 'Highest severity corrective requirement · strategy suitability used as tie-breaker';
   if(view==='riskbased')return 'Highest composite risk · governed priority tier used as tie-breaker';
   if(view==='adaptive')return 'Largest adverse risk change · interval-adjustment need used as tie-breaker';
   return 'Highest strategy suitability · fallback';
 }
 function node(key,label,value,sub,role='dynamic'){return {key,label,value,sub,role}}
 function nodes(view,r){
   if(!r)return [];
   if(view==='preventive')return [
    node('scope','Asset / Class',r.Asset_Tag||r.Asset_ID||'—',r.Asset_Class||'—','context'),
    node('policy','RCM / Maintenance Policy',r.RCM_ID||'Policy linked',r.Policy_Basis||'Governed policy','context'),
    node('interval','Interval Due',Number.isFinite(Number(r.Days_To_Due))?`${fmt(r.Days_To_Due,0)} days`:'—',r.Interval_Status||'—'),
    node('suitability','Preventive Suitability',`${fmt(r.Suitability_Pct,1)}%`,'Strategy fit for this case'),
    node('recommendation','Scheduled Strategy',r.Recommendation||'Review',r.Proposed_Strategy||'Preventive','action')];
   if(view==='predictive')return [
    node('condition','Condition Evidence',r.Alert_ID||r.Primary_Source_ID||'—',r.Primary_Source_Dataset||'Predictive evidence','context'),
    node('risk','Alert Risk / Confidence',`${fmt(r.Alert_Risk_Score,2)} · ${fmt(r.Confidence_Pct,0)}%`,'risk score · evidence confidence'),
    node('rul','Failure Horizon',`${fmt(r.RUL_Days,0)} days`,'Remaining useful life'),
    node('consequence','Consequence',Number.isFinite(Number(r.Energy_Impact_MWh))?`${fmt(r.Energy_Impact_MWh,2)} MWh`:'Linked impact',r.Functional_Impact||'Functional consequence'),
    node('window','Intervention Window',`${fmt(r.Intervention_Window_Days,0)} days`,'Governed planning window'),
    node('suitability','Predictive Suitability',`${fmt(r.Suitability_Pct,1)}%`,'Strategy fit for this case'),
    node('recommendation','Predictive Action',r.Recommendation||'Review',r.Urgency_State||'','action')];
   if(view==='corrective')return [
    node('failure','Failure / Defect',r.Work_Order_ID||r.Primary_Source_ID||'—',r.Failure_Mode||'Corrective evidence','context'),
    node('impact','Functional Impact',r.Functional_Impact||'—','Restoration consequence'),
    node('severity','Severity / Urgency',Number.isFinite(Number(r.Severity_1_5))?`${fmt(r.Severity_1_5,0)} / 5`:'—',r.Urgency_State||''),
    node('repair','Repair Requirement',r.Work_Order_ID||'WO linked',r.Work_Order_ID?'Open exact work order':'Corrective action required'),
    node('suitability','Corrective Suitability',`${fmt(r.Suitability_Pct,1)}%`,'Strategy fit for this case'),
    node('recommendation','Corrective Action',r.Recommendation||'Review',r.Urgency_State||'','action')];
   if(view==='riskbased')return [
    node('criticality','Asset Criticality',r.Asset_Class||'—',r.RCM_ID||'RCM-linked class','context'),
    node('energy','Energy Impact',`${fmt(r.Energy_Impact_MWh,2)} MWh`,'Selected risk case'),
    node('safety','Safety Risk',`${fmt(r.Safety_Risk_1_25,0)} / 25`,'Likelihood × severity'),
    node('access','Accessibility',`${fmt(r.Accessibility_1_10,2)} / 10`,'Intervention accessibility'),
    node('composite','Composite Risk',`${fmt(finite(r.Composite_Risk,0)*100,1)}%`,'Energy + safety + accessibility'),
    node('priority','Priority Tier',r.Priority_Tier||'—','Governed queue tier'),
    node('suitability','Risk-Based Suitability',`${fmt(r.Suitability_Pct,1)}%`,'Strategy fit for this case'),
    node('recommendation','Risk Treatment',r.Recommendation||'Review','Governed recommendation','action')];
   return [
    node('current','Current Strategy',r.Current_Strategy||'—',r.RCM_ID||'Current governed policy','context'),
    node('condition','Baseline → Current Risk',`${fmt(r.Baseline_Risk_Score,2)} → ${fmt(r.Current_Risk_Score,2)}`,'Persisted baseline and current risk'),
    node('change','Context / Risk Change',`${fmt(r.Risk_Change_Pct,1)} pp`,'Current − baseline'),
    node('interval','Interval / Trigger Adjustment',`${fmt(r.Current_Interval_Days,0)} → ${fmt(r.Recommended_Interval_Days,0)} d`,'Current → recommended interval'),
    node('suitability','Adaptive Suitability',`${fmt(r.Suitability_Pct,1)}%`,'Strategy fit for this case'),
    node('recommendation','Adjusted Strategy',r.Proposed_Strategy||r.Recommendation||'Review',r.Recommendation||'','action')];
 }
 function externalTarget(view,key,r){
   if(!r)return '';
   if(view==='preventive'&&key==='policy'&&r.RCM_ID)return 'rcm';
   if(view==='predictive'&&key==='recommendation'&&r.Work_Order_ID)return 'wo';
   if(view==='corrective'&&['failure','repair','recommendation'].includes(key)&&r.Work_Order_ID)return 'wo';
   if(view==='riskbased'&&['criticality','recommendation'].includes(key)&&r.RCM_ID)return 'rcm';
   if(view==='adaptive'&&['current','recommendation'].includes(key)&&r.RCM_ID)return 'rcm';
   return '';
 }
 function nodeHtml(view,x,r){
   const target=externalTarget(view,x.key,r),mark=target?'↗':'↓';
   const roleClass=x.role==='context'?'ms800-context-node':x.role==='action'?'ms800-dynamic-node ms800-action-node':'ms800-dynamic-node';
   return `<div class="ms791-node ${roleClass} ${target?'has-external':'pin-only'}" onclick="ms791Pin('${view}','${esc(x.key)}')"><span class="ms791-go" aria-hidden="true">${mark}</span><small>${esc(x.label)}</small><b>${esc(x.value)}</b><em>${esc(x.sub||'')}</em></div>`;
 }
 function commonFields(view,r,sc){
   const base=[
    ['Reasoning record',r.Reasoning_ID||'—'],
    ['Asset',`${r.Asset_Tag||r.Asset_ID||'—'}${r.Asset_Class?` · ${r.Asset_Class}`:''}`],
    ['Primary source',`${r.Primary_Source_Dataset||'—'}${r.Primary_Source_ID?` · ${r.Primary_Source_ID}`:''}`],
    ['Failure mode',r.Failure_Mode||'—'],
    ['Selection basis',selectionBasis(view,r,sc),'selection']
   ];
   if(view==='corrective'&&r.Work_Order_ID)base.push(['Work order',r.Work_Order_ID]);
   if(view==='adaptive'&&r.RCM_ID)base.push(['RCM policy',r.RCM_ID]);
   return base;
 }
 function stepFields(view,key,r){
   const map={
    preventive:{scope:[['Asset class',r.Asset_Class||'—'],['Current strategy',r.Current_Strategy||'—']],policy:[['RCM policy',r.RCM_ID||'—'],['Policy basis',r.Policy_Basis||'—']],interval:[['Interval',r.Maintenance_Interval_Days?`${r.Maintenance_Interval_Days} days`:'—'],['Last maintenance',r.Last_Maintenance_Date||'—'],['Next due',r.Next_Due_Date||'—'],['Days to due',r.Days_To_Due==null?'—':`${r.Days_To_Due} days`],['Interval status',r.Interval_Status||'—']],suitability:[['Preventive suitability',`${fmt(r.Suitability_Pct,1)}%`],['Meaning','Fit of Preventive strategy for this governed case']],recommendation:[['Recommendation',r.Recommendation||'—'],['Proposed strategy',r.Proposed_Strategy||'—']]},
    predictive:{condition:[['Alert',r.Alert_ID||'—'],['Confidence',r.Confidence_Pct==null?'—':`${fmt(r.Confidence_Pct,0)}%`]],risk:[['Alert risk',fmt(r.Alert_Risk_Score,3)],['Confidence',r.Confidence_Pct==null?'—':`${fmt(r.Confidence_Pct,0)}%`]],rul:[['Remaining useful life',r.RUL_Days==null?'—':`${fmt(r.RUL_Days,0)} days`]],consequence:[['Energy impact',r.Energy_Impact_MWh==null?'—':`${fmt(r.Energy_Impact_MWh,2)} MWh`],['Functional impact',r.Functional_Impact||'—']],window:[['Intervention window',r.Intervention_Window_Days==null?'—':`${fmt(r.Intervention_Window_Days,0)} days`],['Rule','50% of RUL · minimum 1 day']],suitability:[['Predictive suitability',`${fmt(r.Suitability_Pct,1)}%`],['Meaning','Fit of Predictive strategy for this governed case']],recommendation:[['Recommendation',r.Recommendation||'—'],['Urgency',r.Urgency_State||'—'],['Work order',r.Work_Order_ID||'—']]},
    corrective:{failure:[['Failure / defect',r.Failure_Mode||'—'],['Corrective evidence',r.Primary_Source_ID||r.Work_Order_ID||'—']],impact:[['Functional impact',r.Functional_Impact||'—']],severity:[['Severity',r.Severity_1_5==null?'—':`${fmt(r.Severity_1_5,0)} / 5`],['Urgency',r.Urgency_State||'—']],repair:[['Repair requirement',r.Work_Order_ID?'Existing corrective work order':'Corrective action required'],['Work order',r.Work_Order_ID||'—']],suitability:[['Corrective suitability',`${fmt(r.Suitability_Pct,1)}%`],['Meaning','Fit of Corrective strategy for this governed case']],recommendation:[['Recommendation',r.Recommendation||'—']]},
    riskbased:{criticality:[['Asset class',r.Asset_Class||'—'],['RCM policy',r.RCM_ID||'—']],energy:[['Energy impact',`${fmt(r.Energy_Impact_MWh,2)} MWh`]],safety:[['Safety risk',`${fmt(r.Safety_Risk_1_25,0)} / 25`],['Severity',r.Severity_1_5==null?'—':`${fmt(r.Severity_1_5,0)} / 5`]],access:[['Accessibility',`${fmt(r.Accessibility_1_10,2)} / 10`]],composite:[['Composite risk',`${fmt(finite(r.Composite_Risk,0)*100,2)}%`],['Priority',r.Priority_Tier||'—']],priority:[['Priority tier',r.Priority_Tier||'—']],suitability:[['Risk-Based suitability',`${fmt(r.Suitability_Pct,1)}%`],['Meaning','Fit of Risk-Based strategy for this governed case']],recommendation:[['Risk treatment',r.Recommendation||'—']]},
    adaptive:{current:[['Current strategy',r.Current_Strategy||'—']],condition:[['Baseline risk',fmt(r.Baseline_Risk_Score,3)],['Current risk',fmt(r.Current_Risk_Score,3)]],change:[['Risk change',`${fmt(r.Risk_Change_Pct,1)} pp`]],interval:[['Current interval',`${fmt(r.Current_Interval_Days,0)} days`],['Recommended interval',`${fmt(r.Recommended_Interval_Days,0)} days`]],suitability:[['Adaptive suitability',`${fmt(r.Suitability_Pct,1)}%`],['Meaning','Fit of Adaptive strategy for this governed case']],recommendation:[['Proposed strategy',r.Proposed_Strategy||'—'],['Recommendation',r.Recommendation||'—']]}
   };
   return map[view]?.[key]||[];
 }
 window.ms791RenderGraph=function(view){
   if(!VIEWS.includes(view))return;
   const sc=scoped(view);if(!sc.ws)return;
   const card=[...sc.ws.querySelectorAll('.ms686-card')].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''));
   if(!card)return;
   const head=card.querySelector(':scope>.ms686-head'),sub=head?.querySelector('.ms686-sub');if(sub){sub.textContent='';sub.style.display='none'}
   let host=card.querySelector(':scope>.ms791-host');
   if(!host){card.querySelector(':scope>.ms686-active-note')?.remove();card.querySelector(':scope>.ms686-kg')?.remove();host=document.createElement('div');host.className='ms791-host';head?.insertAdjacentElement('afterend',host)}
   const r=selectedCase(view,sc);
   const sig=[mode(),view,sc.site,sc.asset,sc.rows.length,r?.Reasoning_ID||''].join('|');if(host.dataset.ms800sig===sig)return;host.dataset.ms800sig=sig;
   if(!r){host.innerHTML=`<div class="ms791-empty">No governed Strategy Reasoning Evidence records are available for the current ${NAMES[view]} scope.</div>`;return}
   host.dataset.ms800reasoning=r.Reasoning_ID||'';
   const ns=nodes(view,r);
   host.innerHTML=`<div class="ms791-chain">${ns.map((x,i)=>nodeHtml(view,x,r)+(i<ns.length-1?'<span class="ms791-arrow">→</span>':'')).join('')}</div><div class="ms791-pin" id="ms791Pin-${view}"></div>`;
 }
 window.ms791Pin=function(view,key){
   const sc=scoped(view),box=document.getElementById('ms791Pin-'+view);if(!box)return;
   const r=selectedCase(view,sc);if(!r)return;
   const common=commonFields(view,r,sc),specific=stepFields(view,key,r),selectedNode=nodes(view,r).find(x=>x.key===key),target=externalTarget(view,key,r),actions=[];
   if(target==='wo'&&r.Work_Order_ID)actions.push(`<button class="ms791-open-wo" onclick="ms791OpenWO('${esc(r.Work_Order_ID)}','${view}')">Open Work Order ↗</button>`);
   if(target==='rcm'&&r.RCM_ID)actions.push(`<button class="ms791-open-rcm" onclick="ms791OpenRCM('${esc(r.RCM_ID)}','${view}')">Review RCM Policy ↗</button>`);
   const cells=arr=>arr.map(x=>`<div class="ms791-pin-cell${x[2]==='selection'?' ms800-selection-basis':''}"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('');
   box.className='ms791-pin open';
   box.innerHTML=`<div class="ms800-pin-top"><button class="ms791-pin-close" onclick="this.closest('.ms791-pin').classList.remove('open')">×</button></div><div class="ms799-context"><div class="ms799-section-title">Common Record Context</div><div class="ms791-pin-grid ms799-common-grid">${cells(common)}</div></div><div class="ms799-step"><div class="ms799-section-title">Selected Reasoning Step · ${esc(selectedNode?.label||key)}</div><div class="ms791-pin-grid ms799-step-grid">${specific.length?cells(specific):''}</div></div>${actions.length?`<div class="ms791-pin-actions">${actions.join('')}</div>`:''}`;
 }
 window.AIP_STRATEGY_REASONING_SELECTION={pickDefault,selectionBasis,selectedCase};
 // Repaint all existing strategy workspaces once with the governed v87_801 selection rule.
 const repaint=()=>VIEWS.forEach(v=>{try{window.ms791RenderGraph(v)}catch(_){}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(repaint,120),{once:true});else setTimeout(repaint,120);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(repaint,100));
})();
