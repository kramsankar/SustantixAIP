(function(){
'use strict';
const A=window.AIP891={},D=window.AIP891_DATA||{},HELP=window.AIP891_HELP||{};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=x=>x!==null&&x!==undefined&&String(x).trim()!==''&&Number.isFinite(Number(x));
const n=x=>numeric(x)?Number(x):null;
const sum=(r,k)=>r.reduce((s,x)=>s+(n(x[k])??0),0);
const fmt=(x,d=2)=>typeof x==='string'?esc(x):x===null||!Number.isFinite(x)?'Not calculated':x.toLocaleString('en-IN',{maximumFractionDigits:d});
const norm=x=>String(x||'').toLowerCase().replace(/₂/g,'2').replace(/[^a-z0-9]+/g,' ').trim();
const clone=x=>JSON.parse(JSON.stringify(x));
const state={site:'All',period:'All',seen:new Map(),modal:null,focus:null};
A.mode=()=>{try{return String(APM_DATA_MODE)}catch(_){return String(window.APM_DATA_MODE||'Unavailable')}};
const synthetic=()=>A.mode()==='Demo data'||/synthetic/i.test(A.mode());
const bundled=()=>A.mode()==='Excel demo data';
function imported(){try{return APM_IMPORTED_DATA||{}}catch(_){return window.APM_IMPORTED_DATA||{}}}
function flatten(d){return {...(d?.platformSyntheticData||{}),...(d||{})}}
function selected(){
 if(synthetic()){
  let d;try{d=AIP_INDEPENDENT_SYNTHETIC_DATA}catch(_){d=window.AIP_INDEPENDENT_SYNTHETIC_DATA}
  return {...(window.AIP891_SYN_SUS||{}),...flatten(d),SUS_Emission_Factor_Config:flatten(d).SUS_Emission_Factor_Config||D.SUS_Emission_Factor_Config||[]};
 }
 return bundled()?{...D,...flatten(imported())}:imported();
}
A.raw=k=>{const r=selected()[k];return Array.isArray(r)?r:[]};
A.isUploaded=()=>!synthetic()&&!bundled();
A.source=k=>({mode:A.mode(),sheet:k,exists:Array.isArray(selected()[k]),rows:A.raw(k).length,provenance:A.isUploaded()&&window.AIP891_UPLOAD_SHEETS&&!window.AIP891_UPLOAD_SHEETS.includes(k)?'Retained from previous dataset; not part of the last upload':A.mode()});
function dateKey(r){return String(r.Date||r.Activity_Date||r.Cleaning_Date||r.Created_Date||r.Observation_Date||r.Period||'').slice(0,10)}
A.rows=(k,scope=false)=>{
 let r=A.raw(k);
 if(scope){if(state.site!=='All')r=r.filter(x=>String(x.Plant_ID)===state.site);if(state.period!=='All')r=r.filter(x=>String(x.Period||dateKey(x).slice(0,7))===state.period)}
 return r;
};
A.susRows=k=>A.rows(k,true);
function unique(rows,key){const seen=new Set(),dupes=[];return {rows:rows.filter(r=>{const id=key?String(r[key]??''):JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k])=>!k.startsWith('__'))));if(seen.has(id)){dupes.push(id);return false}seen.add(id);return true}),duplicates:dupes}}
function periods(r){return [...new Set(r.map(x=>x.Period||dateKey(x).slice(0,7)).filter(Boolean))].join(', ')||'Period not supplied'}
function factor(r){
 const cfg=A.raw('SUS_Emission_Factor_Config');
 const dated=/^\d{4}-\d{2}-\d{2}/.test(String(r.Date||r.Activity_Date||''))?String(r.Date||r.Activity_Date).slice(0,10):null;
 const f=cfg.filter(x=>String(x.Status).toLowerCase()==='active'&&numeric(x.Value)&&n(x.Value)>=0&&/tco2e\/mwh/i.test(String(x.Unit).replace(/₂/g,'2'))&&(!dated||(!x.Effective_From||dated>=String(x.Effective_From).slice(0,10))&&(!x.Effective_To||dated<=String(x.Effective_To).slice(0,10))));
 return f.length===1?f[0]:null;
}
A.carbon=(scoped=false)=>{
 const gen=unique(A.rows('SUS_Generation',scoped).filter(r=>r.Plant_ID!=='PORTFOLIO'),null);const keys=gen.rows.map(r=>[r.Plant_ID,r.Period||r.Date].join('|')),conflict=new Set(keys).size!==keys.length;
 const rows=gen.rows.map(r=>{const f=factor(r),v=n(r.Net_MWh);return {...r,Factor_ID:f?.Factor_ID||'',Factor_Value:f?.Value??null,Avoided_tCO2e:v!==null&&f?v*n(f.Value):null,Calculation_Status:v===null?'Net generation missing':!f?'One valid active grid factor required':'Calculated',Factor_Period_Note:r.Date?'Dated record':'Aggregate period: verify factor covers the reporting boundary'}});
 return {value:!conflict&&rows.length&&rows.every(r=>r.Avoided_tCO2e!==null)?sum(rows,'Avoided_tCO2e'):null,rows,net:rows.length?sum(rows,'Net_MWh'):null,factor:rows.length?factor(rows[0]):null,duplicates:gen.duplicates,conflictingGrain:conflict};
};
A.revenue=()=>{
 const rates=A.raw('VE_Rate_Config'),gen=A.raw('SUS_Generation').filter(r=>r.Plant_ID!=='PORTFOLIO');
 const rows=gen.map(r=>{const matches=rates.filter(q=>q.Rate_Type==='PPA Tariff'&&q.Applies_To===r.Plant_ID&&numeric(q.Rate_or_Value)&&String(q.Unit).toLowerCase()==='inr/kwh'&&(!r.Date||(!q.Effective_From||String(r.Date).slice(0,10)>=String(q.Effective_From).slice(0,10))&&(!q.Effective_To||String(r.Date).slice(0,10)<=String(q.Effective_To).slice(0,10))));const q=matches.length===1?matches[0]:null,v=n(r.Lost_MWh);return {...r,Tariff_Rate_ID:q?.Rate_ID||'',Tariff_INR_per_kWh:q?.Rate_or_Value??null,Tariff_Effective_From:q?.Effective_From||'',Tariff_Effective_To:q?.Effective_To||'',Tariff_Source:q?.Source_Object||'',Revenue_Exposure_INR:q&&v!==null?v*n(q.Rate_or_Value)*1000:null,Calculation_Status:q&&v!==null?'Calculated; compensation not included':'Generation loss or unique tariff missing'}});
 return {value:rows.length&&rows.every(r=>r.Revenue_Exposure_INR!==null)?sum(rows,'Revenue_Exposure_INR'):null,rows};
};
A.resolveFactor=r=>{
 const date=String(r.Activity_Date||r.Date||'').slice(0,10);
 const factors=A.raw('SUS_Emission_Factor_Config').filter(f=>f.Factor_ID===r.Factor_ID&&String(f.Status).toLowerCase()==='active'&&n(f.Value)!==null&&n(f.Value)>=0&&(!date||((!f.Effective_From||date>=String(f.Effective_From).slice(0,10))&&(!f.Effective_To||date<=String(f.Effective_To).slice(0,10)))));
 return factors.length===1?factors[0]:null;
};
A.asOf=()=>A.raw('Twin Telemetry').map(r=>String(r.Timestamp||'').slice(0,10)).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort().at(-1)||null;
A.performance=()=>{
 const eng=new Map(A.raw('Twin Engineering Parameters').map(r=>[r.Plant_ID,r])),by=new Map(),seen=new Set();
 for(const r of A.raw('Twin Telemetry')){
  const e=eng.get(r.Plant_ID),dt=n(e?.Telemetry_Interval_Min),dc=n(e?.AC_Capacity_MW)*n(e?.DC_AC_Ratio),poa=n(r.POA_Wm2),ac=n(r.Actual_AC_MW),key=r.Plant_ID+'|'+r.Timestamp;
  if(!e||!dt||!dc||poa===null||ac===null||poa<0||ac<0||seen.has(key))continue;seen.add(key);
  let b=by.get(r.Plant_ID);if(!b){b={Plant_ID:r.Plant_ID,Actual_MWh:0,Reference_MWh:0,Intervals:0,From:r.Timestamp,To:r.Timestamp};by.set(r.Plant_ID,b)}
  b.Actual_MWh+=ac*dt/60;b.Reference_MWh+=dc*poa/1000*dt/60;b.Intervals++;if(r.Timestamp<b.From)b.From=r.Timestamp;if(r.Timestamp>b.To)b.To=r.Timestamp;
 }
 const rows=[...by.values()].map(r=>({...r,PR_Pct:r.Reference_MWh>0?100*r.Actual_MWh/r.Reference_MWh:null}));const ref=sum(rows,'Reference_MWh');
 return {rows,value:ref>0?100*sum(rows,'Actual_MWh')/ref:null};
};
A.ghg=scope=>A.susRows('SUS_GHG_Activity').filter(r=>!scope||r.GHG_Scope===scope).map(r=>{
 let value=null,reason='Unique active factor not supplied',factor=A.resolveFactor(r),f=n(factor?.Value),unit=String(factor?.Unit||'').toLowerCase().replace(/₂/g,'2');
 if(n(r.Activity_Value)!==null&&f!==null&&r.Factor_ID){
  const denominator=unit.split('/')[1];if(denominator===String(r.Activity_Unit).toLowerCase()){if(unit.startsWith('tco2e/'))value=n(r.Activity_Value)*f;else if(unit.startsWith('kgco2e/'))value=n(r.Activity_Value)*f/1000;}
  reason=value===null?'Factor units do not match activity units':'Activity × explicitly linked factor';
 }
 return {...r,Factor_Value:factor?.Value??null,Factor_Unit:factor?.Unit||'',Factor_Source:factor?.Source_Reference||'',Calculated_tCO2e:value,Calculation_Status:reason+(factor&&!r.Date&&!r.Activity_Date?' — aggregate period; confirm effective-date boundary':'')};
});
function evidence(title,sheet,rows,formula,unit,value,extra={}){return {title,sheet,rows,formula,unit,value,period:periods(rows),...extra}}
const defs=[];
function def(names,fn,views){defs.push({names:names.map(norm),fn,views})}
const overview=()=>window.AIP891Overview||{plants:[],workOrders:[],actions:[],config:{}};
def(['Priority Actions'],()=>{const d=overview();return evidence('Priority Actions','Runtime action queue; source IDs retained',d.actions,'Count of actions meeting the configured priority threshold '+d.config.priorityThreshold+'/100. Review component scores and sourceView on each record.','actions',d.actions.length,{note:'This is the same action population used to render the overview; source IDs link back to operational records.'})},['overview','portfoliointelligence','home']);
def(['Critical Interventions'],()=>{const r=overview().workOrders.filter(x=>x.priority==='Critical'&&!['Closed','Completed'].includes(x.status));return evidence('Critical Interventions','Work Orders runtime projection',r,'COUNT(priority = Critical and status not Closed or Completed)','orders',r.length)},['overview','portfoliointelligence','home']);
def(['Lowest-Performing Site'],()=>{const p=[...overview().plants].sort((a,b)=>a.pr-b.pr),r=p.length?[p[0]]:[];return evidence('Lowest-Performing Site','Sites runtime projection',r,'MIN(site PR). This identifies the lowest PR, not the smallest generation total.','% PR',r.length?n(r[0].pr):null)},['overview','portfoliointelligence','home']);
[['Availability','availability']].forEach(([label,key])=>def([label],(card)=>{if(label==='Availability'&&card?.closest('[data-pp-panel=performance]')){const r=window.AIP891PortfolioPerformance||[];return evidence(label,'Executive Portfolio Summary',r,'Arithmetic mean of Availability_Actual_Pct in latest reporting period','%',r.length?sum(r,'Availability_Actual_Pct')/r.length:null)}const r=overview().plants;return evidence(label,'Sites runtime projection',r,'Arithmetic mean of site '+key+' values, as implemented in the overview. This is not capacity-weighted.','%',r.length?sum(r,key)/r.length:null)},['overview','portfoliointelligence','home']));
def(['Portfolio PR'],()=>{const p=A.performance();return evidence('Portfolio PR','Twin Telemetry + Twin Engineering Parameters',p.rows,'100 × SUM(Actual_AC_MW × interval hours) / SUM(DC MW × POA_Wm2 / 1000 × interval hours). Matched valid intervals; ratio of totals.','%',p.value,{note:'Demonstration telemetry. Source interval convention: interval-start average. Gaps are excluded, not filled. Reporting range is in contributing records.'})},['overview','portfoliointelligence','home']);
def(['CO2 avoided','CO2 avoided annualized'],()=>{const c=A.carbon();return evidence('CO₂ avoided','SUS_Generation + SUS_Emission_Factor_Config',c.rows,'Sum(Net_MWh × configured grid emission factor); exclude PORTFOLIO summary rows.','tCO₂e',c.value,{note:'Avoided grid emissions are reported separately from organisational Scope 1 and Scope 2. Aggregate reporting periods require factor-boundary verification.'})});
def(['Generation loss value (YTD)'],()=>{const c=A.revenue();return evidence('Generation loss value (YTD)','SUS_Generation + VE_Rate_Config',c.rows,'Sum(Lost_MWh × site PPA tariff INR/kWh × 1,000). No unsupported compensation or probability multiplier.','INR',c.value,{note:'Historical generation-loss exposure using the configured unique site tariff. Aggregate YTD losses cannot be allocated across tariff changes without dated loss records; confirm tariff applicability to the reporting boundary. This is not a forward probabilistic forecast.'})},['overview','portfoliointelligence','home']);
def(['Net solar generation'],()=>{const r=A.susRows('SUS_Generation');return evidence('Net solar generation','SUS_Generation',r,'SUM(Net_MWh) / 1,000','GWh',r.length?sum(r,'Net_MWh')/1000:null)});
def(['Generation recovered'],()=>{const r=A.susRows('SUS_Water_Cleaning');return evidence('Generation recovered','SUS_Water_Cleaning',r,'SUM(MWh_Recovered). Cleaning register evidence only; not all portfolio recovery.','MWh',r.length?sum(r,'MWh_Recovered'):null)});
def(['Cleaning Water Consumed'],()=>{const r=A.susRows('SUS_Water_Cleaning');return evidence('Cleaning Water Consumed','SUS_Water_Cleaning',r,'SUM(Water_m3)','m³',r.length?sum(r,'Water_m3'):null)});
def(['Cleaning Water Consumed Generated MWh','Cleaning Water Consumed / Generated MWh'],()=>{const r=A.susRows('SUS_Water_Cleaning'),g=A.susRows('SUS_Generation'),net=sum(g,'Net_MWh');return evidence('Cleaning water intensity','SUS_Water_Cleaning + SUS_Generation',[...r,...g],'SUM(Water_m3) × 1,000 / SUM(Net_MWh). Match reporting boundaries before comparison.','L/MWh',r.length&&net>0?sum(r,'Water_m3')*1000/net:null,{note:'Cleaning events are dated; generation is a YTD aggregate. This is a reporting-boundary intensity, not a matched daily consumption rate.'})});
['Scope 1','Scope 2'].forEach(scope=>{
 def([scope+' source activities'],()=>{const r=A.ghg(scope);return evidence(scope+' source activities','SUS_GHG_Activity',r,'COUNT(activity rows where GHG_Scope = '+scope+'). Records are activities, not tonnes of emissions.','records',A.source('SUS_GHG_Activity').exists?r.length:null)});
 def([scope+' emissions'],()=>{const r=A.ghg(scope),valid=r.filter(x=>x.Calculated_tCO2e!==null);return evidence(scope+' emissions','SUS_GHG_Activity',r,'SUM(Activity_Value × explicitly linked factor), with kgCO₂e converted to tonnes.','tCO₂e',r.length&&valid.length===r.length?sum(valid,'Calculated_tCO2e'):null,{note:`${valid.length} of ${r.length} activities have calculable emissions. Incomplete totals are not presented as zero.`})});
});
def(['Activity-factor coverage'],()=>{const r=A.ghg().filter(x=>['Scope 1','Scope 2'].includes(x.GHG_Scope)),valid=r.filter(x=>x.Calculated_tCO2e!==null);return evidence('Activity-factor coverage','SUS_GHG_Activity',r,'100 × Scope 1/2 activities with explicitly linked compatible factors / all Scope 1/2 activities','%',r.length?100*valid.length/r.length:null)});
const hse=[['Total HSE Events',()=>true],['Recordable Events',x=>x.Event_Type==='Recordable'],['Near Misses',x=>x.Event_Type==='Near Miss'],['Open / In Review',x=>!/^Closed$/i.test(x.Status||'')],['High Severity',x=>/^High$/i.test(x.Severity||'')]];
hse.forEach(([name,f])=>def([name],()=>{const r=A.susRows('SUS_HSE_Events').filter(f);return evidence(name,'SUS_HSE_Events',r,'Count of event records satisfying '+name+'. Definition follows Event_Type / Status / Severity.','events',A.source('SUS_HSE_Events').exists?r.length:null)},['sustainabilityintelligence']));
def(['Hours Worked'],()=>{const r=A.susRows('SUS_HSE_Hours');return evidence('Hours Worked','SUS_HSE_Hours',r,'SUM(Hours_Worked), employee and contractor records.','hours',r.length?sum(r,'Hours_Worked'):null)},['sustainabilityintelligence']);
[['TRIR','Recordable'],['Near-Miss Frequency','Near Miss']].forEach(([name,type])=>def([name],()=>{const ev=A.susRows('SUS_HSE_Events').filter(x=>x.Event_Type===type),h=A.susRows('SUS_HSE_Hours'),den=sum(h,'Hours_Worked');return evidence(name,'SUS_HSE_Events + SUS_HSE_Hours',[...ev,...h],`${ev.length} ${type} events × 200,000 / ${fmt(den)} worked hours. Reporting periods must match.`,'per 200,000 hours',den>0?ev.length*200000/den:null)}));
def(['Open Work Orders'],()=>{const r=overview().workOrders.filter(x=>!['Closed','Completed'].includes(x.status));return evidence('Open Work Orders','Work Orders runtime projection',r,'COUNT(status not Closed or Completed). Matches the current overview counting rule.','orders',r.length)},['overview','portfoliointelligence','home']);
def(['Assets approaching EOL'],()=>{const r=A.susRows('SUS_Circularity_EOL').filter(x=>String(x.EOL_Flag).toLowerCase()==='yes');return evidence('Assets approaching EOL','SUS_Circularity_EOL',r,'COUNT(EOL_Flag = Yes). Rows represent assets or cohorts; do not sum unit quantities as record counts.','records',A.source('SUS_Circularity_EOL').exists?r.length:null)});
def(['EOL replacement exposure'],()=>{const r=A.susRows('SUS_Circularity_EOL').filter(x=>String(x.EOL_Flag).toLowerCase()==='yes');return evidence('EOL replacement exposure','SUS_Circularity_EOL',r,'SUM(Replacement_Exposure_INR) for EOL_Flag = Yes. Estimated planning cost, not an approved purchase.','INR',r.length?sum(r,'Replacement_Exposure_INR'):null)});
def(['Recovery pathway coverage'],()=>{const r=A.susRows('SUS_Circularity_EOL').filter(x=>String(x.EOL_Flag).toLowerCase()==='yes'),c=r.filter(x=>String(x.Pathway_Status||x.Regulatory_Status||'').toLowerCase()==='confirmed');return evidence('Recovery pathway coverage','SUS_Circularity_EOL',r,'100 × confirmed recovery pathways / approaching-EOL records. A confirmed pathway is not a completed recycling outcome.','%',r.length?c.length/r.length*100:null)});
def(['Critical actions overdue'],()=>{const today=new Date().toISOString().slice(0,10),r=A.raw('Work Orders').filter(x=>x.Priority==='Critical'&&!/closed|completed|cancelled/i.test(x.Status||'')&&String(x.SLA_Due||'').slice(0,10)<today&&x.SLA_Due);return evidence('Critical actions overdue','Work Orders',r,'COUNT(Critical, open work orders with SLA_Due before today)','orders',r.length)});
function descriptor(label,view,card){
 if(view==='workorderintelligence'&&['overdue actions','ready to schedule'].includes(norm(label))){
  const isOverdue=norm(label)==='overdue actions',now=Date.now(),all=typeof opsWOs==='function'?opsWOs():[],r=all.filter(x=>isOverdue?window.AIPWorkOrder915.overdue(x,now):window.AIPWorkOrder915.ready(x));
  return evidence(label,'Work Orders',r,isOverdue?'Count open work orders whose SLA / due date is before the current time; use an explicit overdue flag only if no valid due date exists.':'Count open work orders with parts and permits Ready or explicitly Not Required, and no assigned crew.','WOs',r.length,{period:'As of '+new Date(now).toLocaleString('en-GB'),note:'Completed, closed, cancelled, rejected and verified orders are excluded. Ledger search does not change the module-wide KPI population.'});
 }
const d=defs.find(x=>x.names.includes(norm(label))&&(!x.views||x.views.includes(view)));return d?d.fn(card):null}
const SHEETS={overview:['Sites','Work Orders','AI Alerts & RUL'],portfoliointelligence:['Sites','Commercial & PPA','SUS_Generation'],assetexplorer:['Asset Master'],assetrelationships:['Asset Relationships'],revenuecommercial:['Commercial & PPA','PORT_Revenue_Risk_Calc'],commercialppa:['Commercial & PPA'],predictive:['AI Alerts & RUL','Work Orders'],preventive:['PM Plans','Work Orders'],corrective:['Work Orders'],conditionbased:['CBM Assessments'],riskbased:['Risk-Based Assessments'],workorderintelligence:['Work Orders'],resourceplanning:['Crew Assignments','Interventions'],spares:['MSI_ERP_Spares','MSI_Spare_Requirements'],rootcause:['Event Root Cause Cases','Event Root Cause Evidence'],reliabilityengineering:['Reliability_Life_History'],maintenancelearning:['Maintenance Learning','Maintenance Learning Outcomes'],sustainabilityintelligence:['SUS_Generation','SUS_GHG_Activity'],sustainabilitymodelgovernance:['SUS_Model_Governance','SUS_Emission_Factor_Config'],models:['Engineering Model Registry'],dataquality:['Data Quality Checks'],decisionintelligence:['Decision Intelligence'],operationaltwin:['Twin Engineering Parameters','Twin Telemetry'],benefitsrealization:['Benefits Realization']};
const CARDS='.cppa-summary-card,.di401-kpi,.po-kpi,.card:has(> .kpi-label):has(> .kpi-value),.aip-kpi-master,.portfolio-kpi,.ops-kpi,.rigour-kpi,.xi-kpi,.vision-kpi,.ai3-kpi,.aig-kpi,.home-strip-card,.gf377-kpi,.t872-kpi,.t873-kpi,.t874-kpi,.msi-kpi,.sus8-kpi,.ax-kpi,.cr-kpi,.card.enhanced-kpi,.kpi-card,.metric-card,.stat-card,.sx-kpi,.avx-kpi,.dm-kpi,.aigsp-metric,.api-stat,.cb-stat,.mdp-stat,.ad-stat,.inv-tile,.executive-revenue-kpi,[data-kpi-card]';
const LABEL='.wo213-label,.cppa-summary-label,.aip-kpi-display-label,[data-kpi-label],.kpi-label,.metric-label,.stat-label,.vision-kpi-label,.ops-kpi-label,.ax-kpi-label,.home-strip-label,.sus8-klabel,.label,.lbl,.lab,.l,h4,:scope > span:first-child';
const VALUE='.wo213-value,.cppa-summary-value,.aip-kpi-display-value,[data-kpi-value],.kpi-value,.metric-value,.stat-value,.vision-kpi-value,.ops-kpi-value,.home-strip-value,.sus8-kvalue,.ax865-kpi-value,.value,.val,.n,:scope > b';
function visible(el){return !!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'}
function labelOf(el){return (el.querySelector(LABEL)?.textContent||'').replace(/\s+/g,' ').trim()}
function viewOf(el){if(el.closest('#t875CR'))return 'operationalcontrolroom';return el.closest('.view')?.id?.replace(/^view-/,'')||'home'}
function documented(view,label){const a=HELP[view]||HELP[view==='portfoliointelligence'?'overview':'']||[];return a.find(x=>norm(x.name)===norm(label))}
function context(card){const v=card.closest('.view');return [...(v?.querySelectorAll('select,input[type=search],input[type=date]')||[])].filter(visible).map(x=>({control:x.getAttribute('aria-label')||x.id||'Screen filter',value:x.tagName==='SELECT'?x.selectedOptions[0]?.textContent:x.value})).filter(x=>x.value)}
function tablesFor(card){const v=card.closest('.view');return [...(v?.querySelectorAll('table')||[])].filter(visible).map(t=>({title:t.closest('.card,.sus8-card')?.querySelector('h3')?.textContent||'Current screen table',headers:[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim()),rows:[...t.querySelectorAll('tbody tr')].filter(visible).map(tr=>Object.fromEntries([...tr.cells].map((td,i)=>[(t.querySelectorAll('thead th')[i]?.textContent||'Column '+(i+1)).trim(),td.textContent.trim()]))) })).filter(t=>t.rows.length)}
function quality(rows){const ids=new Map(),issues=[];rows.forEach((r,i)=>{const field=Object.keys(r).find(k=>/(?:Record|Activity|Event|Risk|Calculation|Work_Order|EOL_Record)_ID$/.test(k));if(field){const id=String(r[field]);if(ids.has(id))issues.push({record:id,issue:'Duplicate identifier; inspect grain before aggregation'});ids.set(id,i)}if(r.Plant_ID&&A.raw('Sites').length&&!A.raw('Sites').some(p=>p.Plant_ID===r.Plant_ID))issues.push({record:r[field]||i+1,issue:'Plant_ID not found in selected Sites'})});return issues}
function makeTable(rows,limit=100){if(!rows.length)return '<p>No records available for this selection.</p>';rows=rows.map(r=>r.__sourceRow?{Worksheet_Row:r.__sourceRow,...r}:r);const cols=[...new Set(rows.flatMap(Object.keys))].filter(k=>!k.startsWith('__'));return `<div class="a891-table"><table><thead><tr>${cols.map(k=>'<th>'+esc(k)+'</th>').join('')}</tr></thead><tbody>${rows.slice(0,limit).map(r=>'<tr>'+cols.map(k=>'<td>'+(k==='Asset_ID'&&r[k]?'<button type="button" data-a891-asset="'+esc(r[k])+'">'+esc(r[k])+'</button>':esc(r[k]==null?'Not supplied':typeof r[k]==='object'?JSON.stringify(r[k]):r[k]))+'</td>').join('')+'</tr>').join('')}</tbody></table></div>${rows.length>limit?`<p>Showing first ${limit} of ${rows.length} records. Search to narrow the list or export all records.</p>`:''}`}
function download(name,rows){const cols=[...new Set(rows.flatMap(Object.keys))],q=x=>'"'+String(x??'').replace(/"/g,'""')+'"',safe=x=>typeof x==='string'&&/^[=+@\-]/.test(x)?"'"+x:x;const s=[cols.map(q).join(','),...rows.map(r=>cols.map(k=>q(safe(r[k]&&typeof r[k]==='object'?JSON.stringify(r[k]):r[k]))).join(','))].join('\r\n');const u=URL.createObjectURL(new Blob(['\ufeff'+s],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function close(){if(state.modal){state.modal.close();state.modal.remove();state.modal=null}state.focus?.focus({preventScroll:true})}
A.open=function(card){
 const label=labelOf(card),view=viewOf(card),value=card.querySelector(VALUE)?.textContent?.trim()||'',d=descriptor(label,view,card),h=documented(view,label),ctx=context(card),tables=tablesFor(card);
 let records=d?.rows||[],source=d?.sheet||'',status=d?'Calculation basis available':'Source mapping requires verification';
 if(!d&&tables.length){records=tables[0].rows;source=tables[0].title;status='Displayed table context — not verified as the exact KPI population'}
 const issues=quality(records);close();state.focus=document.activeElement;
 const dialog=document.createElement('dialog');dialog.className='a891-dialog';dialog.setAttribute('aria-label',label+' calculation and records');state.modal=dialog;
 dialog.innerHTML=`<header><div><h2>${esc(label)}</h2><p>${esc(value)} · ${esc(A.mode())}</p></div><button data-close aria-label="Close and return to source">Close ×</button></header><section><dl><dt>Reconciliation</dt><dd>${esc(compare(value,d))}</dd><dt>Calculation status</dt><dd>${esc(d?.value===null?'Not calculated — required inputs missing or not compatible':status)}</dd><dt>Calculation / documented definition</dt><dd>${esc(d?.formula||h?.formula||'This card has no verified calculation mapping yet. Do not treat its displayed value as reconciled.')}</dd><dt>Unit and period</dt><dd>${esc(d?.unit||h?.unit||'As displayed')} · ${esc(d?.period||h?.scope||'Period not explicitly supplied')}</dd><dt>Source</dt><dd>${esc(source||'Exact source not verified')}${d?' · '+records.length+' contributing records':''}</dd>${d?`<dt>Recalculated value</dt><dd>${fmt(d.value)} ${esc(d.unit)}</dd>`:''}<dt>Assumptions / exclusions</dt><dd>${esc(d?.note||h?.rules||'No additional assumptions have been introduced.')}</dd></dl>${ctx.length?'<h3>Screen controls at entry</h3>'+makeTable(ctx):''}${!d?'<p class="a891-caution">The existing screen value is preserved. The records below are context, not a claimed reconciliation. Existing drill-down actions remain available after closing this panel.</p>':''}${issues.length?'<h3>Record checks</h3>'+makeTable(issues):''}<h3>${d?'Contributing records':'Available screen records'}</h3><div class="a891-tools"><input type="search" aria-label="Search supporting records" placeholder="Search supporting records…"><button data-export>Export records</button></div><div data-records>${makeTable(records)}</div>${!d&&(SHEETS[view]||[]).length?'<details><summary>Selected dataset worksheets for this area</summary>'+SHEETS[view].map(k=>`<button class="a891-sheet" data-sheet="${esc(k)}">${esc(k)} · ${A.raw(k).length} records</button>`).join('')+'</details>':''}</section><footer><button data-close>Return to source</button></footer>`;
 document.body.appendChild(dialog);dialog.showModal();dialog.addEventListener('click',e=>{const b=e.target.closest('[data-a891-asset]');if(!b)return;const id=b.dataset.a891Asset;const assets=A.raw('Asset Master').filter(x=>x.Asset_ID===id||x.Asset_Tag===id),wos=A.raw('Work Orders').filter(x=>x.Asset_ID===id||assets.some(a=>x.Asset_Tag===a.Asset_Tag));let panel=dialog.querySelector('[data-asset-context]');if(!panel){panel=document.createElement('div');panel.dataset.assetContext='';dialog.querySelector('section').prepend(panel)}panel.innerHTML='<h3>Asset evidence: '+esc(id)+'</h3>'+(assets.length?makeTable(assets)+'<h3>Linked work orders</h3>'+makeTable(wos):'<p>No matching Asset Master record in the selected source. The source identifier has been preserved for correction.</p>');panel.scrollIntoView({block:'nearest'});});dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.querySelector('input[type=search]').oninput=e=>{dialog.querySelector('[data-records]').innerHTML=makeTable(records.filter(r=>JSON.stringify(r).toLowerCase().includes(e.target.value.toLowerCase())))};dialog.querySelector('[data-export]').onclick=()=>download('AIP_v891_'+norm(label).replaceAll(' ','_')+'.csv',records);dialog.querySelectorAll('[data-sheet]').forEach(b=>b.onclick=()=>{records=A.raw(b.dataset.sheet);dialog.querySelector('[data-records]').innerHTML=makeTable(records);dialog.querySelector('input[type=search]').value=''});
};
A.openRecords=function(title,sheet,rows,formula){const tmp=document.createElement('div');tmp.innerHTML=`<span class="aip-kpi-display-label">${esc(title)}</span>`;const entry={names:[norm(title)],fn:()=>evidence(title,sheet,rows,formula,'records',rows.length)};defs.unshift(entry);A.open(tmp);defs.shift()};
function compare(display,d){
 if(!display)return 'Record inspection';if(!d)return 'Source mapping outstanding';
 if(d.value===null||!Number.isFinite(d.value)&&typeof d.value!=='string')return /not calculated|not measured|n\/a|not available|—/i.test(display)?'Missing input shown explicitly':'Review: displayed value has no complete calculation';
 if(typeof d.value==='string')return 'Range / non-scalar calculation';
 const clean=String(display).replace(/,/g,'').replace(/−/g,'-'),m=clean.match(/[-+]?\d+(?:\.\d+)?/);if(!m)return 'Display not numeric';
 let scale=1;if(d.unit==='INR'){if(/cr\b/i.test(clean))scale=1e7;else if(/lakh|\bL\b/.test(clean))scale=1e5;else if(/\dk(?:\b|$)/i.test(clean))scale=1e3}
 const decimals=m[0].split('.')[1]?.length||0,tolerance=.50001*Math.pow(10,-decimals)*scale;
 return Math.abs(Number(m[0])*scale-d.value)<=tolerance?'Display consistency only — not independent validation':'Review: display and calculation differ';
}
function a894Style(el,values){if(!el)return;for(const [k,v] of Object.entries(values)){if(el.style.getPropertyValue(k)!==v||el.style.getPropertyPriority(k)!=='important')el.style.setProperty(k,v,'important')}}
function a894Layout(card){window.AIPTAM895?.apply(card)}
function scan(){
 new Set([...document.querySelectorAll('.view.active,#t875CR,#aipHomeOverlay')].filter(visible).flatMap(view=>[...view.querySelectorAll(CARDS)])).forEach(card=>{if(!visible(card)||card.closest('.a891-added')||!card.querySelector(VALUE)?.textContent?.trim())return;a894Layout(card);const label=labelOf(card);if(!label)return;const view=viewOf(card),d=descriptor(label,view,card),h=documented(view,label);const tab=card.closest('[data-pp-panel]')?.dataset.ppPanel||document.querySelector('#'+(card.closest('.view')?.id||'none')+' [data-bv].active, #'+(card.closest('.view')?.id||'none')+' [data-iv].active, #'+(card.closest('.view')?.id||'none')+' [data-fv].active')?.textContent?.trim()||'';state.seen.set(view+'|'+tab+'|'+label,{screen:view,tab,KPI:label,value:card.querySelector(VALUE)?.textContent?.trim()||'',trace:d?'calculation and contributing records':h?'documented formula; source mapping outstanding':'source mapping outstanding',source:d?.sheet||'',unit:d?.unit||h?.unit||'',period:d?.period||h?.scope||'',recalculated:d?.value??null,reconciliation:compare(card.querySelector(VALUE)?.textContent?.trim()||'',d),formula:d?.formula||h?.formula||''});
 const nativeIcons=[...card.querySelectorAll(':scope > .ov527-kpi-drill-icon,:scope > .v510-kpi-drill-badge,:scope > .v231-drill-icon,:scope > .home-lite-nav')];
 if(nativeIcons.length){card.querySelector(':scope > .a891-info')?.remove();nativeIcons.forEach((el,i)=>{el.classList.add('a894-drill');a894Style(el,{top:'8px',right:'8px',bottom:'auto',left:'auto',display:i?'none':'inline-flex',width:'20px',height:'20px',background:'#173f57',color:'#fff'});});return}
 if(card.querySelector(':scope > .a891-info'))return;const b=document.createElement('button');b.type='button';b.className='a891-info a894-drill';b.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 14L14 6M9 6h5v5"/></svg>';
b.setAttribute('aria-label','View basis: '+label);b.title='View calculation and supporting records';b.onclick=e=>{e.preventDefault();e.stopPropagation();A.open(card)};card.appendChild(b);
 });
}
A.inventory=()=>[...state.seen.values()];
A.audit=()=>{
 const out=[],sites=new Set(A.raw('Sites').map(x=>x.Plant_ID)),assets=new Set(A.raw('Asset Master').flatMap(x=>[x.Asset_ID,x.Asset_Tag]).filter(Boolean));
 const rules={SUS_Generation:['Plant_ID','Net_MWh'],SUS_GHG_Activity:['Activity_ID','GHG_Scope','Activity_Value','Activity_Unit'],SUS_Climate_Asset_Risk:['Risk_ID','Plant_ID','Asset_ID'],SUS_HSE_Events:['Event_ID','Date','Plant_ID'],SUS_HSE_Hours:['Plant_ID','Hours_Worked'],SUS_Circularity_EOL:['EOL_Record_ID','Asset_ID','Quantity'],SUS_PV_Array_Master:['PV_Array_ID','Plant_ID'],SUS_Water_Cleaning:['Cleaning_Event_ID','Water_m3','Date'],SUS_Emission_Factor_Config:['Factor_ID','Status']};
 for(const [sheet,fields] of Object.entries(rules)){
  const rows=A.raw(sheet);if(!A.source(sheet).exists){out.push({sheet,record:'—',field:'worksheet',issue:'Missing from selected dataset'});continue}
  const seen=new Set();rows.forEach((row,i)=>{
   const id=row.Activity_ID||row.Risk_ID||row.Event_ID||row.EOL_Record_ID||row.Cleaning_Event_ID||row.Factor_ID||row.PV_Array_ID||row.Plant_ID||'row '+(i+2);
   for(const field of fields)if(row[field]===null||row[field]===undefined||String(row[field]).trim()==='')out.push({sheet,row:i+2,record:id,field,issue:'Required input missing'});
   if(row.Plant_ID&&sites.size&&!sites.has(row.Plant_ID))out.push({sheet,row:i+2,record:id,field:'Plant_ID',issue:'Reference not found in selected Sites'});
   if(row.Asset_ID&&assets.size&&!assets.has(row.Asset_ID))out.push({sheet,row:i+2,record:id,field:'Asset_ID',issue:'Asset reference not found in selected Asset Master; verify asset, tag or cohort mapping'});
   if(sheet==='SUS_GHG_Activity'&&(!A.resolveFactor(row)||A.ghg().find(x=>x.Activity_ID===row.Activity_ID)?.Calculated_tCO2e===null))out.push({sheet,row:i+2,record:id,field:'Factor_ID / central factor resolution',issue:'Operational emissions cannot be calculated'});
   if(fields[0].endsWith('_ID')&&fields[0]!=='Plant_ID'){const key=row[fields[0]];if(key&&seen.has(key))out.push({sheet,row:i+2,record:id,field:fields[0],issue:'Duplicate identifier'});if(key)seen.add(key)}
  });
 }
 return out;
};
def(['Data Exceptions','Sustainability Data Exceptions'],()=>evidence('Sustainability source exceptions','Sustainability worksheets',A.audit(),'Count of failed field/reference checks. One record can have multiple exceptions.','exceptions',A.audit().length),['home','dataquality']);
A.register=def;A.descriptor=descriptor;A.format=fmt;A.escape=esc;A.table=makeTable;A.state=state;A.scan=scan;A.evidence=evidence;A.sum=sum;
const extendedSheets=new Set();
try{for(const [name,shape] of Object.entries(window.AIP891_SCHEMA||{})){if(!APM_SHEET_RULES[name]&&shape.columns?.length){APM_SHEET_RULES[name]={required:[shape.columns[0]],key:shape.key||shape.columns,group:'Supporting data'};extendedSheets.add(name)}}}catch(_){}
A.auditImport=(data,result)=>{const warnings=result.errors.filter(x=>extendedSheets.has(x.sheet));A.importFindings=warnings;const errors=result.errors.filter(x=>!extendedSheets.has(x.sheet));return {...result,errors,valid:errors.length===0,supportingDataFindings:warnings}};
function bindSource(){
 const d=imported();window.APM_DATA_MODE=A.mode();window.APM_IMPORTED_DATA=d;if(bundled()){for(const [k,v] of Object.entries(D)){if(k.startsWith('SUS_')||k.startsWith('RCM ')||k==='PORT_Revenue_Risk_Calc'||k==='Asset Master')d[k]=clone(v)}}
 window.aipPortfolioCo2AvoidedT12=()=>A.carbon().value;
 window.aipPortfolioRevenueAtRisk=()=>A.revenue().value;
 window.aipPortfolioRevenueAtRiskRows=()=>A.revenue().rows.map(r=>({row:r,sh:r.Lost_MWh,tar:r.Tariff_INR_per_kWh,pen:0,rec:0,gross:r.Revenue_Exposure_INR,net:r.Revenue_Exposure_INR,audit:r.Calculation_Status,rateId:r.Tariff_Rate_ID}));
}
A.bindSource=bindSource;
bindSource();
let timer;function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;scan();A.enhance?.()},150)}
document.addEventListener('click',schedule);document.addEventListener('change',schedule);document.addEventListener('input',schedule);
let settledTimer;function settleKpis(){clearTimeout(settledTimer);settledTimer=setTimeout(()=>{scan();A.enhance?.()},500)}document.addEventListener('click',settleKpis);document.addEventListener('change',settleKpis);window.addEventListener('resize',settleKpis);window.addEventListener('aip:runtime-ready',settleKpis);
['aip:data-source-changed','apm:datasource-refreshed'].forEach(ev=>document.addEventListener(ev,()=>{state.site='All';state.period='All';bindSource();schedule()}));
window.addEventListener('aip:runtime-ready',()=>{bindSource();try{window.renderOverview?.()}catch(_){}schedule()});
const root=document.getElementById('main');if(root)new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(x=>x.nodeType===1&&!x.classList.contains('a891-info')&&!x.closest?.('.a891-added'))))schedule()}).observe(root,{childList:true,subtree:true});
schedule();window.AIP_CURRENT_BUILD='v904';
})();
