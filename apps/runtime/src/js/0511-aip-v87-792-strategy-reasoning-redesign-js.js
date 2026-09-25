
window.AIP_STRATEGY_REASONING_EXCEL=__AIP_DS("53fb1e622e68c9f0");
window.AIP_STRATEGY_REASONING_SYNTHETIC=__AIP_DS("df4becd2dff2ec55");
(function(){
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const NAMES={preventive:'Preventive',predictive:'Predictive',corrective:'Corrective',riskbased:'Risk-Based',adaptive:'Adaptive'};
 const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const n=(v,d=0)=>{const x=Number(v);return Number.isFinite(x)?x:d};
 const fmt=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
 function mode(){
   try{if(window.AIP_SYNTHETIC_ACTIVE===true)return 'Synthetic';}catch(_){}
   const s=String(window.APM_DATA_MODE||window.DATA_SOURCE_MODE||'');
   return /synthetic/i.test(s)?'Synthetic':'Excel';
 }
 function importedRows(){
   try{if(typeof APM_IMPORTED_DATA!=='undefined'&&Array.isArray(APM_IMPORTED_DATA?.['Strategy Reasoning Evidence'])&&APM_IMPORTED_DATA['Strategy Reasoning Evidence'].length)return APM_IMPORTED_DATA['Strategy Reasoning Evidence'];}catch(_){}
   try{if(Array.isArray(window.APM_IMPORTED_DATA?.['Strategy Reasoning Evidence'])&&window.APM_IMPORTED_DATA['Strategy Reasoning Evidence'].length)return window.APM_IMPORTED_DATA['Strategy Reasoning Evidence'];}catch(_){}
   try{if(typeof EMBEDDED_EXCEL_DATA!=='undefined'&&Array.isArray(EMBEDDED_EXCEL_DATA?.['Strategy Reasoning Evidence'])&&EMBEDDED_EXCEL_DATA['Strategy Reasoning Evidence'].length)return EMBEDDED_EXCEL_DATA['Strategy Reasoning Evidence'];}catch(_){}
   return window.AIP_STRATEGY_REASONING_EXCEL||[];
 }
 function allRows(){
   if(mode()==='Synthetic'){
     try{const x=AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData?.['Strategy Reasoning Evidence'];if(Array.isArray(x)&&x.length)return x;}catch(_){}
     return window.AIP_STRATEGY_REASONING_SYNTHETIC||[];
   }
   return importedRows();
 }
 function activeView(){
   const x=VIEWS.find(v=>document.getElementById('view-'+v)?.classList.contains('active'));
   if(x)return x;
   const a=document.querySelector('#main>.view.active[id^="view-"]');return a?String(a.id).replace('view-',''):'';
 }
 function scoped(view){
   const root=document.getElementById('view-'+view),ws=root?.querySelector('.ms686-workspace');
   if(!ws)return {rows:[],asset:'All',site:'All'};
   const asset=ws.querySelector('.ms686-asset')?.value||root.dataset.ms686asset||'All';
   const site=ws.querySelector('.ms686-site')?.value||root.dataset.ms686site||'All';
   let rows=allRows().filter(r=>String(r.Strategy_Type||'')===NAMES[view]);
   if(site!=='All')rows=rows.filter(r=>String(r.Plant_ID||'')===site);
   if(asset!=='All')rows=rows.filter(r=>String(r.Asset_ID||'')===asset);
   return {rows,asset,site,root,ws};
 }
 function avg(rows,k){const a=rows.map(r=>Number(r[k])).filter(Number.isFinite);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}
 function med(rows,k){const a=rows.map(r=>Number(r[k])).filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
 function max(rows,k){const a=rows.map(r=>Number(r[k])).filter(Number.isFinite);return a.length?Math.max(...a):null}
 function sum(rows,k){return rows.map(r=>Number(r[k])).filter(Number.isFinite).reduce((s,x)=>s+x,0)}
 function topText(rows,k,fallback='—'){const m=new Map();rows.forEach(r=>{const x=String(r[k]||'').trim();if(x)m.set(x,(m.get(x)||0)+1)});return [...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||fallback}
 function exact(sc){return sc.asset!=='All'&&sc.rows.length?sc.rows[0]:null}
 function vExactOrAgg(sc,key,agg,formatter){
   const e=exact(sc),x=e?e[key]:agg(sc.rows,key);return formatter?formatter(x):String(x??'—')
 }
 function node(key,label,value,sub,cls,tip,action=true){return {key,label,value,sub,cls,tip,action}}
 function nodes(view,sc){
   const rows=sc.rows,e=exact(sc),cnt=rows.length;
   if(view==='preventive')return [
     node('scope','Asset / Class',e?`${e.Asset_Tag}`:`${cnt} qualified assets`,e?e.Asset_Class:'Preventive evidence population','blue','Asset/component scope with persisted preventive evidence and exact Asset_ID linkage.'),
     node('policy','RCM / Maintenance Policy',e?(e.RCM_ID||'Policy linked'):`${new Set(rows.map(r=>r.RCM_ID).filter(Boolean)).size} linked policies`,e?(e.Policy_Basis||'Governed policy'):'RCM / maintenance policy coverage','teal','Governed policy basis. Hover shows context; click pins source IDs and the selected failure mode.'),
     node('interval','Interval Due',e?`${fmt(e.Days_To_Due,0)} days`:`${rows.filter(r=>n(r.Days_To_Due,999)<0).length} overdue`,e?(e.Interval_Status||'—'):`${rows.filter(r=>n(r.Days_To_Due,999)>=0&&n(r.Days_To_Due,999)<=30).length} due ≤30d`,'amber','Calendar interval evidence derived from last maintenance, interval and next due date.'),
     node('suitability','Preventive Suitability',`${fmt(avg(rows,'Suitability_Pct'),1)}%`,e?'Selected record':'Average current scope','green','Analytical strategy-fit score from governed Strategy Assessment; it is not an ML probability.'),
     node('recommendation','Scheduled Strategy',e?(e.Recommendation||'Review'):topText(rows,'Recommendation','Review'),e?(e.Proposed_Strategy||'Preventive'):'Dominant governed recommendation','deep','Governed strategy recommendation after evidence review. ERP/EAM remains execution system of record.')
   ];
   if(view==='predictive')return [
     node('condition','Condition Evidence',e?(e.Alert_ID||e.Primary_Source_ID):`${cnt} linked records`,e?'AI Alerts & RUL':'Qualified predictive evidence','purple','Condition/predictive evidence indicates whether degradation is occurring.'),
     node('risk','Alert Risk / Confidence',e?`${fmt(e.Alert_Risk_Score,2)} · ${fmt(e.Confidence_Pct,0)}%`:`${fmt(max(rows,'Alert_Risk_Score'),2)} max · ${fmt(avg(rows,'Confidence_Pct'),0)}% avg`,'risk score · evidence confidence','maroon','Alert risk and model/evidence confidence are kept separate from consequence.'),
     node('rul','Failure Horizon',e?`${fmt(e.RUL_Days,0)} days`:`${fmt(med(rows,'RUL_Days'),0)} days median`,'Remaining useful life','amber','RUL/failure horizon from persisted predictive evidence.'),
     node('consequence','Consequence',e?(Number.isFinite(Number(e.Energy_Impact_MWh))?`${fmt(e.Energy_Impact_MWh,2)} MWh`:'Linked impact'):`${fmt(sum(rows,'Energy_Impact_MWh'),2)} MWh`,'Energy impact / functional consequence','blue','Consequence answers what is at stake if the predicted degradation progresses.'),
     node('window','Intervention Window',e?`${fmt(e.Intervention_Window_Days,0)} days`:`${fmt(med(rows,'Intervention_Window_Days'),0)} days median`,'Governed planning window','teal','Demo rule: intervention window = 50% of RUL, minimum one day; formula is persisted in Excel.'),
     node('suitability','Predictive Suitability',`${fmt(avg(rows,'Suitability_Pct'),1)}%`,e?'Selected record':'Average current scope','green','Analytical predictive strategy-fit score, not an ML probability.'),
     node('recommendation','Predictive Action',e?(e.Recommendation||'Review'):topText(rows,'Recommendation','Review'),e?(e.Urgency_State||''):'Dominant recommendation','deep','Contextual maintenance recommendation based on governed evidence.')
   ];
   if(view==='corrective')return [
     node('failure','Failure / Defect',e?(e.Work_Order_ID||e.Primary_Source_ID):`${cnt} corrective WOs`,e?(e.Failure_Mode||'Corrective evidence'):'Maintenance_Type = Corrective','maroon','Exact corrective work-order evidence; no predictive work orders are substituted.'),
     node('impact','Functional Impact',e?(e.Functional_Impact||'—'):topText(rows,'Functional_Impact','Mixed impact'),'Restoration consequence','blue','Functional consequence of the failure/defect for the asset class.'),
     node('severity','Severity / Urgency',e?`${fmt(e.Severity_1_5,0)} / 5`:`${fmt(max(rows,'Severity_1_5'),0)} / 5 max`,e?(e.Urgency_State||''):`${rows.filter(r=>n(r.Severity_1_5)>=4).length} high/critical`,'amber','Severity is derived from governed WO priority; urgency describes the repair response state.'),
     node('repair','Repair Requirement',e?(e.Work_Order_ID||'WO linked'):`${cnt} exact WOs`,e?'Open exact work order':'Corrective source population','teal','Repair requirement is anchored to exact Work_Order_ID.'),
     node('suitability','Corrective Suitability',`${fmt(avg(rows,'Suitability_Pct'),1)}%`,e?'Selected record':'Average current scope','green','Analytical fit for corrective/run-to-failure treatment under current evidence.'),
     node('recommendation','Corrective Action',e?(e.Recommendation||'Review'):topText(rows,'Recommendation','Review'),e?(e.Urgency_State||''):'Dominant recommendation','deep','Governed corrective action; execution remains in Work Order Intelligence / ERP-EAM.')
   ];
   if(view==='riskbased')return [
     node('criticality','Asset Criticality',e?e.Asset_Class:`${cnt} risk records`,e?(e.RCM_ID||'RCM-linked class'):'Qualified Risk Queue population','blue','Asset-class criticality and RCM context for the governed Risk Queue record.'),
     node('energy','Energy Impact',e?`${fmt(e.Energy_Impact_MWh,2)} MWh`:`${fmt(sum(rows,'Energy_Impact_MWh'),2)} MWh`,e?'Selected risk record':'Current-scope total','amber','Energy impact is sourced from the governed Risk Queue calculation.'),
     node('safety','Safety Risk',e?`${fmt(e.Safety_Risk_1_25,0)} / 25`:`${fmt(max(rows,'Safety_Risk_1_25'),0)} / 25 max`,'Likelihood × severity','maroon','Safety risk rating is the governed 1–25 rating used by Risk-Based Maintenance.'),
     node('access','Accessibility',e?`${fmt(e.Accessibility_1_10,2)} / 10`:`${fmt(avg(rows,'Accessibility_1_10'),2)} / 10 avg`,'Intervention accessibility','purple','Accessibility is a governed 1–10 prioritization input.'),
     node('composite','Composite Risk',e?`${fmt(n(e.Composite_Risk)*100,1)}%`:`${fmt(max(rows,'Composite_Risk')*100,1)}% max`,'Energy + safety + accessibility','maroon','Composite Risk uses the governed normalized Risk Queue formula; click to pin exact inputs.'),
     node('priority','Priority Tier',e?(e.Priority_Tier||'—'):topText(rows,'Priority_Tier','—'),e?'Selected queue tier':'Dominant current-scope tier','teal','P1/P2/P3/P4 is assigned from governed Composite Risk thresholds.'),
     node('suitability','Risk-Based Suitability',`${fmt(avg(rows,'Suitability_Pct'),1)}%`,e?'Selected record':'Average current scope','green','Analytical fit of Risk-Based maintenance for the selected evidence.'),
     node('recommendation','Risk Treatment',e?(e.Recommendation||'Review'):topText(rows,'Recommendation','Review'),e?'Governed recommendation':'Dominant recommendation','deep','Maintenance treatment recommendation; RCM remains policy authority.')
   ];
   return [
     node('current','Current Strategy',e?(e.Current_Strategy||'—'):topText(rows,'Current_Strategy','—'),e?'Selected record':'Dominant current strategy','blue','Current maintenance strategy before contextual reassessment.'),
     node('condition','Baseline → Current Risk',e?`${fmt(e.Baseline_Risk_Score,2)} → ${fmt(e.Current_Risk_Score,2)}`:`${fmt(avg(rows,'Baseline_Risk_Score'),2)} → ${fmt(avg(rows,'Current_Risk_Score'),2)}`,'Persisted baseline and current risk','purple','Adaptive reasoning compares a persisted demo baseline with current governed condition/risk evidence.'),
     node('change','Context / Risk Change',e?`${fmt(e.Risk_Change_Pct,1)} pp`:`${fmt(avg(rows,'Risk_Change_Pct'),1)} pp avg`,'Current − baseline','amber','Risk change is formula-derived from persisted baseline and current risk inputs.'),
     node('interval','Interval / Trigger Adjustment',e?`${fmt(e.Current_Interval_Days,0)} → ${fmt(e.Recommended_Interval_Days,0)} d`:`${fmt(avg(rows,'Current_Interval_Days'),0)} → ${fmt(avg(rows,'Recommended_Interval_Days'),0)} d`,'Current → recommended interval','teal','Recommended interval uses the explicit adaptive rule persisted in the companion dataset.'),
     node('suitability','Adaptive Suitability',`${fmt(avg(rows,'Suitability_Pct'),1)}%`,e?'Selected record':'Average current scope','green','Analytical fit for varying interval/trigger based on changing evidence.'),
     node('recommendation','Adjusted Strategy',e?(e.Proposed_Strategy||e.Recommendation):topText(rows,'Proposed_Strategy','Review'),e?(e.Recommendation||''):'Dominant proposed strategy','deep','Proposed adjustment is advisory; ERP/EAM execution requires governed handoff.')
   ];
 }
 function externalTarget(view,key,r){
   if(!r)return '';
   if(view==='preventive' && key==='policy' && r.RCM_ID)return 'rcm';
   if(view==='predictive' && key==='recommendation' && r.Work_Order_ID)return 'wo';
   if(view==='corrective' && ['failure','repair','recommendation'].includes(key) && r.Work_Order_ID)return 'wo';
   if(view==='riskbased' && ['criticality','recommendation'].includes(key) && r.RCM_ID)return 'rcm';
   if(view==='adaptive' && ['current','recommendation'].includes(key) && r.RCM_ID)return 'rcm';
   return '';
 }
 function nodeHtml(view,node,i,sc){
   const r=exact(sc),target=r?externalTarget(view,node.key,r):'';
   const mark=target?'↗':'↓';
   const title=target?(target==='wo'?'Exact governed Work Order drill-down available':'Exact governed RCM Policy drill-down available'):'Click to pin governed reasoning detail';
   return `<div class="ms791-node ${node.cls} ${target?'has-external':'pin-only'}" onclick="ms791Pin('${view}','${esc(node.key)}')"><span class="ms791-go" aria-hidden="true">${mark}</span><small>${esc(node.label)}</small><b>${esc(node.value)}</b><em>${esc(node.sub||'')}</em></div>`;
 }
 window.ms791RenderGraph=function renderGraph(view){
   const sc=scoped(view);if(!sc.ws)return;
   const cards=[...sc.ws.querySelectorAll('.ms686-card')],card=cards.find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''));
   if(!card)return;
   const head=card.querySelector(':scope>.ms686-head'),sub=head?.querySelector('.ms686-sub');
   if(sub){sub.textContent='';sub.style.display='none';}
   let host=card.querySelector(':scope>.ms791-host');
   if(!host){card.querySelector(':scope>.ms686-active-note')?.remove();card.querySelector(':scope>.ms686-kg')?.remove();host=document.createElement('div');host.className='ms791-host';head?.insertAdjacentElement('afterend',host)}
   const sig=[mode(),view,sc.site,sc.asset,sc.rows.length,sc.rows[0]?.Reasoning_ID||'',sc.rows[sc.rows.length-1]?.Reasoning_ID||''].join('|');
   if(host.dataset.ms791sig===sig)return;
   host.dataset.ms791sig=sig;
   if(!sc.rows.length){host.innerHTML=`<div class="ms791-empty">No governed Strategy Reasoning Evidence records are available for the current ${NAMES[view]} scope.</div>`;return}
   const ns=nodes(view,sc);
   host.innerHTML=`<div class="ms791-chain">${ns.map((x,i)=>nodeHtml(view,x,i,sc)+(i<ns.length-1?'<span class="ms791-arrow">→</span>':'')).join('')}</div><div class="ms791-pin" id="ms791Pin-${view}"></div>`;
 }
 function commonFields(view,r){
   const base=[
     ['Reasoning record',r.Reasoning_ID||'—'],
     ['Asset',`${r.Asset_Tag||r.Asset_ID||'—'}${r.Asset_Class?` · ${r.Asset_Class}`:''}`],
     ['Primary source',`${r.Primary_Source_Dataset||'—'}${r.Primary_Source_ID?` · ${r.Primary_Source_ID}`:''}`],
     ['Failure mode',r.Failure_Mode||'—']
   ];
   /* Common means invariant for the selected reasoning chain, not globally common
      across the strategy tab. Keep strategy-specific references only when they are
      true record context and do not duplicate the selected-step evidence. */
   if(view==='corrective'&&r.Work_Order_ID)base.push(['Work order',r.Work_Order_ID]);
   if(view==='adaptive'&&r.RCM_ID)base.push(['RCM policy',r.RCM_ID]);
   return base;
 }
 function stepFields(view,key,r){
   const map={
    preventive:{asset:[['Asset class',r.Asset_Class||'—'],['Current strategy',r.Current_Strategy||'—']],policy:[['RCM policy',r.RCM_ID||'—'],['Policy basis',r.Policy_Basis||'—']],interval:[['Interval',r.Maintenance_Interval_Days?`${r.Maintenance_Interval_Days} days`:'—'],['Last maintenance',r.Last_Maintenance_Date||'—'],['Next due',r.Next_Due_Date||'—'],['Days to due',r.Days_To_Due==null?'—':`${r.Days_To_Due} days`],['Interval status',r.Interval_Status||'—']],suitability:[['Preventive suitability',`${fmt(r.Suitability_Pct,1)}%`]],recommendation:[['Recommendation',r.Recommendation||'—'],['Proposed strategy',r.Proposed_Strategy||'—']]},
    predictive:{condition:[['Alert',r.Alert_ID||'—'],['Confidence',r.Confidence_Pct==null?'—':`${fmt(r.Confidence_Pct,0)}%`]],risk:[['Alert risk',fmt(r.Alert_Risk_Score,3)],['Confidence',r.Confidence_Pct==null?'—':`${fmt(r.Confidence_Pct,0)}%`]],rul:[['Remaining useful life',r.RUL_Days==null?'—':`${fmt(r.RUL_Days,0)} days`]],consequence:[['Energy impact',r.Energy_Impact_MWh==null?'—':`${fmt(r.Energy_Impact_MWh,2)} MWh`],['Functional impact',r.Functional_Impact||'—']],window:[['Intervention window',r.Intervention_Window_Days==null?'—':`${fmt(r.Intervention_Window_Days,0)} days`],['Rule','50% of RUL · minimum 1 day']],suitability:[['Predictive suitability',`${fmt(r.Suitability_Pct,1)}%`]],recommendation:[['Recommendation',r.Recommendation||'—'],['Urgency',r.Urgency_State||'—'],['Work order',r.Work_Order_ID||'—']]},
    corrective:{failure:[['Failure / defect',r.Failure_Mode||'—'],['Corrective evidence',r.Primary_Source_ID||r.Work_Order_ID||'—']],impact:[['Functional impact',r.Functional_Impact||'—']],severity:[['Severity',r.Severity_1_5==null?'—':`${fmt(r.Severity_1_5,0)} / 5`],['Urgency',r.Urgency_State||'—']],repair:[['Repair requirement',r.Work_Order_ID?'Existing corrective work order':'Corrective action required'],['Work order',r.Work_Order_ID||'—']],suitability:[['Corrective suitability',`${fmt(r.Suitability_Pct,1)}%`]],recommendation:[['Recommendation',r.Recommendation||'—']]},
    riskbased:{criticality:[['Asset class',r.Asset_Class||'—'],['RCM policy',r.RCM_ID||'—']],energy:[['Energy impact',`${fmt(r.Energy_Impact_MWh,2)} MWh`]],safety:[['Safety risk',`${fmt(r.Safety_Risk_1_25,0)} / 25`],['Severity',r.Severity_1_5==null?'—':`${fmt(r.Severity_1_5,0)} / 5`]],access:[['Accessibility',`${fmt(r.Accessibility_1_10,2)} / 10`]],composite:[['Composite risk',`${fmt(n(r.Composite_Risk)*100,2)}%`],['Priority',r.Priority_Tier||'—']],priority:[['Priority tier',r.Priority_Tier||'—']],suitability:[['Risk-Based suitability',`${fmt(r.Suitability_Pct,1)}%`]],recommendation:[['Risk treatment',r.Recommendation||'—']]},
    adaptive:{current:[['Current strategy',r.Current_Strategy||'—']],condition:[['Baseline risk',fmt(r.Baseline_Risk_Score,3)],['Current risk',fmt(r.Current_Risk_Score,3)]],change:[['Risk change',`${fmt(r.Risk_Change_Pct,1)} pp`]],interval:[['Current interval',`${fmt(r.Current_Interval_Days,0)} days`],['Recommended interval',`${fmt(r.Recommended_Interval_Days,0)} days`]],suitability:[['Adaptive suitability',`${fmt(r.Suitability_Pct,1)}%`]],recommendation:[['Proposed strategy',r.Proposed_Strategy||'—'],['Recommendation',r.Recommendation||'—']]}
   };
   return map[view]?.[key]||[];
 }
 window.ms791Pin=function(view,key){
   const sc=scoped(view),box=document.getElementById('ms791Pin-'+view);if(!box)return;
   const r=exact(sc)||[...sc.rows].sort((a,b)=>n(b.Suitability_Pct)-n(a.Suitability_Pct))[0];
   if(!r)return;
   const aggregate=sc.asset==='All';
   const common=commonFields(view,r),specific=stepFields(view,key,r);
   const selectedNode=(nodes(view,sc)||[]).find(x=>x.key===key);
   const actions=[];
   const target=!aggregate?externalTarget(view,key,r):'';
   if(target==='wo'&&r.Work_Order_ID)actions.push(`<button class="ms791-open-wo" onclick="ms791OpenWO('${esc(r.Work_Order_ID)}','${view}')">Open Work Order ↗</button>`);
   if(target==='rcm'&&r.RCM_ID)actions.push(`<button class="ms791-open-rcm" onclick="ms791OpenRCM('${esc(r.RCM_ID)}','${view}')">Review RCM Policy ↗</button>`);
   const cells=arr=>arr.map(x=>`<div class="ms791-pin-cell"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('');
   box.className='ms791-pin open';
   box.innerHTML=`<div class="ms791-pin-head"><div><h4>Governed reasoning detail</h4><p></p></div><button class="ms791-pin-close" onclick="this.closest('.ms791-pin').classList.remove('open')">×</button></div><div class="ms799-context"><div class="ms799-section-title">Common Record Context</div><div class="ms791-pin-grid ms799-common-grid">${cells(common)}</div></div><div class="ms799-step"><div class="ms799-section-title">Selected Reasoning Step · ${esc(selectedNode?.label||key)}</div><div class="ms791-pin-grid ms799-step-grid">${specific.length?cells(specific):'<div class="ms799-no-extra">No additional governed fields are required for this step; its displayed value is derived from the common record context.</div>'}</div></div>${actions.length?`<div class="ms791-pin-actions">${actions.join('')}</div>`:''}`;
 }
 window.ms791OpenWO=function(id,origin){
   if(!id)return;window.AIP_STRATEGY_REASONING_RETURN={view:origin,asset:scoped(origin).asset,site:scoped(origin).site};
   try{window.AIP_HISTORY_NAV?.record(origin)}catch(_){}
   window.AIP_WO_DESIRED_TAB='ledger';
   try{activate('workorderintelligence')}catch(_){document.querySelector('.nav-item[data-view="workorderintelligence"]')?.click()}
   const focus=()=>{const root=document.getElementById('view-workorderintelligence');if(!root)return;const ledger=root.querySelector('.ops-tab[data-wo12-tab="ledger"]');if(ledger&&!ledger.classList.contains('active'))ledger.click();const input=document.getElementById('wo12-search');if(input){input.value=id;input.dispatchEvent(new Event('input',{bubbles:true}));}const row=[...root.querySelectorAll('tr[data-wo12-id]')].find(x=>x.getAttribute('data-wo12-id')===id);if(row){row.classList.add('corr773-context-row');row.scrollIntoView({block:'center'})}};[50,120,250,450].forEach(t=>setTimeout(focus,t));
 }
 window.ms791OpenRCM=function(id,origin){
   if(!id)return;window.AIP_STRATEGY_REASONING_RETURN={view:origin,asset:scoped(origin).asset,site:scoped(origin).site};
   window.RCM650_SELECTED=id;
   try{window.AIP_HISTORY_NAV?.record(origin)}catch(_){}
   try{activate('rcm')}catch(_){document.querySelector('.nav-item[data-view="rcm"]')?.click()}
   setTimeout(()=>{try{if(typeof renderRCM==='function')renderRCM()}catch(_){}},50);
 }
 function refresh(view){if(VIEWS.includes(view))requestAnimationFrame(()=>requestAnimationFrame(()=>renderGraph(view)))}
 let pending=0;function refreshActive(){clearTimeout(pending);pending=setTimeout(()=>{const v=activeView();if(v)refresh(v)},25)}
 document.addEventListener('change',e=>{if(e.target?.closest?.('.ms686-workspace')&&e.target.matches('select'))refreshActive()},true);
 document.addEventListener('click',e=>{if(e.target?.closest?.('.aip-maint-subtabs,[data-view]'))refreshActive()},true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(()=>VIEWS.forEach(refresh),80));
 function initialReasoningPaint(){
   VIEWS.forEach(v=>refresh(v));
 }
 /* v87_796 PERFORMANCE: event-driven only. A body-wide MutationObserver here
    caused renderGraph -> DOM mutation -> observer -> renderGraph feedback loops. */
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initialReasoningPaint,80),{once:true});
 else setTimeout(initialReasoningPaint,80)
})();
