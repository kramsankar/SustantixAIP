(function(){
const CUSTOM=new Set(['contextgraph','operationaltwin','twinfoundation','decisionworkspace','scenariosimulator2','eventreconstruction','resourceplanning','apiconnectors','weatherconfiguration','dataquality','securityaudit','reliabilityrisk']);
const S={site:'Rajasthan Solar Park',layer:'All',time:12,scenario:{weather:0,crew:100,spares:100,failure:42,tariff:3.15},decisions:[{id:'D-208',title:'Advance inverter fan replacement',asset:'INV-RJ-042',risk:18.6,conf:88,ready:92,status:'Awaiting Review',evidence:['Thermal rise +7.8°C','Repeat alarm pattern','Estimated RUL 9 days','Fan kit FK-22 available']},{id:'D-209',title:'Transfer tracker actuator stock',asset:'MH-03 → GJ-02',risk:7.4,conf:84,ready:84,status:'Awaiting Review',evidence:['GJ-02 stockout forecast 6 days','MH-03 excess stock 4 units','Crew window tomorrow 11:00']},{id:'D-210',title:'Submit module warranty claim',asset:'MOD-GJ-B14',risk:7.4,conf:80,ready:73,status:'Evidence Gap',evidence:['Thermal image hotspot','IV curve deviation','Serial mapping incomplete']}],play:0};
const $=(q,r=document)=>r.querySelector(q), $$=(q,r=document)=>[...r.querySelectorAll(q)], fmt=n=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:1}).format(n), money=n=>'₹'+fmt(n)+' L';
function toast(t){let x=$('.toast-x');if(!x){x=document.createElement('div');x.className='toast-x';document.body.append(x)}x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1800)}
function head(k,t,tools='',showLegacyHelp=true){return `<div class="xi-head"><div><div class="xi-eyebrow">${k}</div><h1>${t}</h1></div><div class="xi-tools">${tools}${showLegacyHelp?`<button class="xi-btn" onclick="toast('F1 contextual help opened')">F1 Help</button>`:''}</div></div>`}
const kpi=(l,v,s='')=>`<div class="xi-kpi"><span>${l}</span><b>${v}</b><small class="xi-muted">${s}</small></div>`;
const cgKpiEsc=v=>String(v??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const cgKpiDisplay=v=>{
  const raw=String(v??'').trim();
  const m=raw.match(/^([^0-9+\-]*)([+\-]?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if(!m)return `<span class="aip-kpi-number">${cgKpiEsc(raw)}</span>`;
  return `${m[1]?`<span class="aip-kpi-prefix">${cgKpiEsc(m[1].trim())}</span>`:''}<span class="aip-kpi-number">${cgKpiEsc(m[2])}</span>${m[3]?`<span class="aip-kpi-unit">${cgKpiEsc(m[3].trim())}</span>`:''}`;
};
const cgKpiBars=()=>'<span class="aip-kpi-master-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
const cgKpi=(label,value,index)=>`<div class="xi-kpi aip-kpi-master cg-portfolio-kpi" data-aip-kpi-index="${index%8}"><span class="kpi-label" data-kpi-label>${cgKpiEsc(label)}</span><b class="kpi-value" data-kpi-value>${cgKpiEsc(value)}</b><span class="aip-kpi-display-label">${cgKpiEsc(label)}</span><span class="aip-kpi-display-value">${cgKpiDisplay(value)}</span>${cgKpiBars()}</div>`;

function data(){let e=window.EMBEDDED_EXCEL_DATA||{};return {plants:e['Plants']||window.PLANTS||[],assets:e['Asset Master']||window.ASSETS||[],alerts:e['AI Alerts & RUL']||window.ALERTS||[]}}
function openDrawer(html){let b=$('.xi-backdrop'),d=$('.xi-drawer');if(!b){b=document.createElement('div');b.className='xi-backdrop';d=document.createElement('aside');d.className='xi-drawer';document.body.append(b,d);b.onclick=closeDrawer}d.innerHTML=`<button class="xi-btn" onclick="closeDrawer()">Close</button>${html}`;b.classList.add('open');d.classList.add('open')} window.closeDrawer=()=>{$('.xi-backdrop')?.classList.remove('open');$('.xi-drawer')?.classList.remove('open')};


function contextGraphActiveRows(sheet){
 const mode=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'').toLowerCase();

 if(mode==='demo data'||/synthetic/.test(mode)||window.AIP_SYNTHETIC_ACTIVE===true){
   const syn=(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined'&&AIP_INDEPENDENT_SYNTHETIC_DATA)||{};
   return Array.isArray(syn[sheet])?syn[sheet]:[];
 }

 if(mode==='excel demo data'||/bundled excel/.test(mode)){
   const ex=(typeof EMBEDDED_EXCEL_DATA!=='undefined'&&EMBEDDED_EXCEL_DATA)||{};
   return Array.isArray(ex[sheet])?ex[sheet]:[];
 }

 const imported=(typeof APM_IMPORTED_DATA!=='undefined'&&APM_IMPORTED_DATA)||{};
 if(Array.isArray(imported[sheet]))return imported[sheet];

 const ex=(typeof EMBEDDED_EXCEL_DATA!=='undefined'&&EMBEDDED_EXCEL_DATA)||{};
 return Array.isArray(ex[sheet])?ex[sheet]:[];
}
function cgVal(r,keys){for(const k of keys){if(r&&r[k]!=null&&String(r[k]).trim()!=='')return r[k]}return ''}
function cgNum(v){const n=Number(v);return Number.isFinite(n)?n:0}
function cgMoney(v){
 const n=cgNum(v),a=Math.abs(n);
 if(a>=1e7)return '₹'+(n/1e7).toLocaleString('en-IN',{maximumFractionDigits:2})+' Cr';
 if(a>=1e5)return '₹'+(n/1e5).toLocaleString('en-IN',{maximumFractionDigits:2})+' L';
 return '₹'+Math.round(n).toLocaleString('en-IN');
}
function cgEsc(v){return String(v??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function buildEnterpriseContext(){
 const specs=[
  {sheet:'Sites',type:'Site',prefix:'SITE',id:['Plant_ID','Site_ID','id'],label:['Plant_Name','Site_Name','name'],plant:['Plant_ID','Site_ID','id']},
  {sheet:'Asset Master',type:'Asset',prefix:'AST',id:['Asset_ID','id'],label:['Asset_Tag','tag','Asset_ID','id'],plant:['Plant_ID','plant']},
  {sheet:'AI Alerts & RUL',type:'Alert',prefix:'ALT',id:['Alert_ID','id'],label:['Alert_ID','Component','component'],plant:['Plant_ID','plant'],asset:['Asset_ID','asset']},
  {sheet:'Work Orders',type:'Work Order',prefix:'WO',id:['Work_Order_ID','WO_ID','id'],label:['Work_Order_ID','WO_ID','id'],plant:['Plant_ID','plant'],asset:['Asset_ID','asset'],source:['Source_Record_ID','Source','source']},
  {sheet:'Generation Loss Attribution',type:'Generation Loss',prefix:'LOSS',id:['Loss_ID','Plant_ID','id'],label:['Loss_ID','Plant_ID','id'],plant:['Plant_ID','plant']},
  {sheet:'Commercial & PPA',type:'PPA',prefix:'PPA',id:['PPA_ID','id'],label:['PPA_ID','Offtaker','id'],plant:['Plant_ID','plant']},
  {sheet:'ESG Monthly',type:'ESG',prefix:'ESG',id:['ESG_ID','Month','month'],label:['Month','month'],plant:['Plant_ID','plant']},
  {sheet:'Management Actions',type:'Action',prefix:'ACT',id:['Action_ID','id'],label:['Action_ID','Recommended_Action','title'],plant:['Plant_ID','plant'],asset:['Asset_ID','asset'],source:['Source_Record_ID','source']}
 ];
 const entities=[], byId=new Map(), rawIndex=new Map();
 const add=(e)=>{if(byId.has(e.id))return;entities.push(e);byId.set(e.id,e);if(e.rawId)rawIndex.set(String(e.rawId),e.id)};
 specs.forEach(sp=>{
   contextGraphActiveRows(sp.sheet).forEach((r,i)=>{
     const rawId=String(cgVal(r,sp.id)||i),plant=String(cgVal(r,sp.plant)||''),asset=String(cgVal(r,sp.asset||[])||''),source=String(cgVal(r,sp.source||[])||'');
     const label=String(cgVal(r,sp.label)||rawId);
     add({id:sp.prefix+':'+rawId,rawId,type:sp.type,label,plant,asset,source,sheet:sp.sheet,row:r});
   });
 });
 const relationships=[],seen=new Set();
 const edge=(a,b,kind)=>{if(!a||!b||a===b)return;const k=a+'|'+b+'|'+kind;if(seen.has(k))return;seen.add(k);relationships.push({a,b,kind})};
 const siteByPlant=new Map(entities.filter(e=>e.type==='Site').map(e=>[String(e.plant||e.rawId),e.id]));
 const assetByRaw=new Map(entities.filter(e=>e.type==='Asset').map(e=>[String(e.rawId),e.id]));
 entities.forEach(e=>{
   if(e.type!=='Site'&&e.plant)edge(siteByPlant.get(e.plant),e.id,'site context');
   if(e.asset)edge(assetByRaw.get(e.asset),e.id,'asset context');
   if(e.source)edge(rawIndex.get(e.source),e.id,'source evidence');
 });
 const connected=new Set();relationships.forEach(x=>{connected.add(x.a);connected.add(x.b)});
 const orphans=entities.filter(e=>!connected.has(e.id)).length;
 const completeness=entities.length?((entities.length-orphans)/entities.length*100):0;
 return {entities,relationships,orphans,completeness,mode:String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'Synthetic data')};
}

function contextIssueRegistry(){
 const explicit=contextGraphActiveRows('Context Issue Registry');
 if(explicit&&explicit.length){
   return explicit.map(r=>({
     id:String(r.Context_Issue_ID||''),
     origin:String(r.Origin_Domain||''),
     plant:String(r.Plant_ID||''),
     site:String(r.Plant_Name||r.Plant_ID||''),
     issue:String(r.Issue||''),
     priority:String(r.Priority||'Medium'),
     confidence:cgNum(r.Confidence_Pct),
     value:cgNum(r.Value_at_Risk_INR),
     recoverable:cgNum(r.Recoverable_Value_INR),
     domains:String(r.Impact_Domains||'').split('|').map(x=>x.trim()).filter(Boolean),
     recommended:String(r.Recommended_Decision||'Review context'),
     target:String(r.Target_Module||'overview'),
     why:[
       r.Why_1_Label?{type:String(r.Why_1_Type||'Evidence'),label:String(r.Why_1_Label)}:null,
       r.Why_2_Label?{type:String(r.Why_2_Type||'Evidence'),label:String(r.Why_2_Label)}:null,
       r.Why_3_Label?{type:String(r.Why_3_Type||'Evidence'),label:String(r.Why_3_Label)}:null
     ].filter(Boolean),
     impact:[
       r.Impact_1_Label?{type:String(r.Impact_1_Type||'Impact'),label:String(r.Impact_1_Label)}:null,
       r.Impact_2_Label?{type:String(r.Impact_2_Type||'Impact'),label:String(r.Impact_2_Label)}:null,
       r.Impact_3_Label?{type:String(r.Impact_3_Type||'Impact'),label:String(r.Impact_3_Label)}:null
     ].filter(Boolean),
     sourceSheet:String(r.Source_Sheet||'Context Issue Registry'),
     sourceRecord:String(r.Source_Record_ID||''),
     businessLabel:String(r.Operational_Issue_Label||r.Business_Issue_Label||r.Issue||''),
     assetId:String(r.Why_2_Type||'')==='Asset'?String(r.Why_2_Label||''):''
   }));
 }
 const sites=contextGraphActiveRows('Sites'), alerts=contextGraphActiveRows('AI Alerts & RUL'),
       wos=contextGraphActiveRows('Work Orders'), loss=contextGraphActiveRows('Generation Loss Attribution'),
       ppa=contextGraphActiveRows('Commercial & PPA'), actions=contextGraphActiveRows('Management Actions'),
       esg=contextGraphActiveRows('ESG Monthly'), assets=contextGraphActiveRows('Asset Master');

 const siteName=new Map(sites.map(s=>[String(cgVal(s,['Plant_ID','Site_ID','id'])),String(cgVal(s,['Plant_Name','Site_Name','name'])||cgVal(s,['Plant_ID','Site_ID','id']))]));
 const assetById=new Map(assets.map(r=>[String(cgVal(r,['Asset_ID','id'])),r]));
 const ppaByPlant=new Map(ppa.map(r=>[String(cgVal(r,['Plant_ID'])),r]));
 const lossByPlant=new Map(loss.map(r=>[String(cgVal(r,['Plant_ID'])),r]));
 const wosByPlant=new Map(), actionsByPlant=new Map(), esgByPlant=new Map();
 wos.forEach(r=>{const p=String(cgVal(r,['Plant_ID']));if(!wosByPlant.has(p))wosByPlant.set(p,[]);wosByPlant.get(p).push(r)});
 actions.forEach(r=>{const p=String(cgVal(r,['Plant_ID']));if(!actionsByPlant.has(p))actionsByPlant.set(p,[]);actionsByPlant.get(p).push(r)});
 esg.forEach(r=>{const p=String(cgVal(r,['Plant_ID']));if(!esgByPlant.has(p))esgByPlant.set(p,[]);esgByPlant.get(p).push(r)});

 const issues=[];
 const add=i=>{i.domains=[...new Set(i.domains||[])];i.value=cgNum(i.value);i.recoverable=cgNum(i.recoverable);i.confidence=Math.max(0,Math.min(100,cgNum(i.confidence)||80));issues.push(i)};

 alerts.forEach(a=>{
   const pid=String(cgVal(a,['Plant_ID'])), aid=String(cgVal(a,['Asset_ID']));
   const risk=cgNum(cgVal(a,['Risk_Score']))||cgNum(cgVal(a,['Risk_Score_Pct']))/100;
   if(risk<.6)return;
   const l=lossByPlant.get(pid)||{}, p=ppaByPlant.get(pid)||{}, asset=assetById.get(aid)||{};
   const tariff=cgNum(cgVal(p,['PPA_Tariff_INR_kWh'])), total=cgNum(cgVal(l,['Total_Loss_MWh'])), rec=cgNum(cgVal(l,['Recoverable_Loss_MWh']));
   const value=Math.max(cgNum(cgVal(a,['Financial_Impact_INR'])), total*1000*tariff*(.25+.35*risk));
   const recoverable=Math.min(value,Math.max(0,rec*1000*tariff));
   const wo=(wosByPlant.get(pid)||[]).find(w=>String(cgVal(w,['Asset_ID']))===aid)||null;
   const act=(actionsByPlant.get(pid)||[]).find(x=>String(cgVal(x,['Asset_ID']))===aid)||null;
   add({id:'CTX-R-'+String(cgVal(a,['Alert_ID','id'])||aid||pid),origin:'Reliability',plant:pid,site:siteName.get(pid)||pid,
     issue:String(cgVal(a,['Component','Evidence_Summary'])||'Asset reliability risk'),priority:risk>=.8?'Critical':'High',
     confidence:cgNum(cgVal(a,['Confidence_Pct']))||85,value,recoverable,
     domains:['Reliability','Generation',...(wo?['Maintenance']:[]),...(value>0?['Commercial / PPA']:[])],
     recommended:act?String(cgVal(act,['Recommended_Action'])):(wo?`Advance ${cgVal(wo,['Work_Order_ID','WO_ID','id'])}`:'Review predictive evidence'),
     target:wo?'workorderintelligence':'predictive',
     workOrderId:wo?String(cgVal(wo,['Work_Order_ID','WO_ID','id'])||''):'',
      why:[{type:'Alert',label:String(cgVal(a,['Alert_ID'])||'Predictive alert')},{type:'Asset',label:String(cgVal(asset,['Asset_Tag','Asset_ID'])||aid)},{type:'Evidence',label:String(cgVal(a,['Evidence_Summary'])||'Model risk evidence')}],
     impact:[{type:'Generation',label:total?total.toFixed(1)+' MWh loss':'Generation exposure'},{type:'Commercial',label:value?cgMoney(value)+' at risk':'Business exposure'},{type:'Maintenance',label:wo?String(cgVal(wo,['Work_Order_ID','WO_ID','id'])):'Intervention required'}]});
 });

 loss.forEach(r=>{
   const pid=String(cgVal(r,['Plant_ID'])), total=cgNum(cgVal(r,['Total_Loss_MWh'])), rec=cgNum(cgVal(r,['Recoverable_Loss_MWh']));
   if(total<=0)return;
   const record=String(cgVal(r,['Loss_Record_ID','Loss_ID','id'])||pid);
   const period=String(cgVal(r,['Month','month'])||'').slice(0,7);
   const p=ppaByPlant.get(pid)||{}, tariff=cgNum(cgVal(p,['PPA_Tariff_INR_kWh'])), value=total*1000*tariff, recoverable=rec*1000*tariff;
   const wo=(wosByPlant.get(pid)||[])[0]||null;
   add({id:'CTX-G-'+record,origin:'Generation',plant:pid,site:siteName.get(pid)||pid,issue:'Generation loss / underperformance',
     priority:recoverable>=1500000?'Critical':recoverable>=500000?'High':'Medium',confidence:95,value,recoverable,
     domains:['Generation',...(wo?['Maintenance']:[]),...(value>0?['Commercial / PPA']:[])],
     recommended:wo?`Review ${cgVal(wo,['Work_Order_ID','WO_ID','id'])} and highest recoverable loss drivers for the selected loss period`:'Review highest recoverable loss drivers for the selected loss period',
     target:'lossintelligence',
     sourceRecord:record,
     businessLabel:`Generation loss / underperformance — ${record}`,
     why:[
       {type:'Loss record',label:record},
       {type:'Period',label:period},
       {type:'Attributed loss',label:total.toFixed(1)+' MWh'},
       {type:'Primary loss driver',label:(()=>{
          const d=[
            ['Inverter',cgNum(cgVal(r,['Inverter_Loss_MWh']))],
            ['Soiling',cgNum(cgVal(r,['Soiling_Loss_MWh']))],
            ['Module degradation',cgNum(cgVal(r,['Module_Degradation_Loss_MWh']))],
            ['Tracker',cgNum(cgVal(r,['Tracker_Loss_MWh']))],
            ['DC string',cgNum(cgVal(r,['DC_String_Loss_MWh']))],
            ['Transformer',cgNum(cgVal(r,['Transformer_Loss_MWh']))],
            ['Grid outage',cgNum(cgVal(r,['Grid_Outage_Loss_MWh']))],
            ['Curtailment',cgNum(cgVal(r,['Curtailment_Loss_MWh']))],
            ['Planned maintenance',cgNum(cgVal(r,['Planned_Maintenance_Loss_MWh']))],
            ['Unexplained',cgNum(cgVal(r,['Unexplained_Loss_MWh']))]
          ].sort((a,b)=>b[1]-a[1])[0];
          return d&&d[1]>0?`${d[0]} · ${d[1].toFixed(1)} MWh`:'Not available';
       })()}
     ],
     impact:[{type:'Recoverable generation',label:rec.toFixed(1)+' MWh'},{type:'Revenue exposure',label:cgMoney(value)},{type:'Recoverable value',label:cgMoney(recoverable)}]});
 });

 wos.forEach(w=>{
   const pid=String(cgVal(w,['Plant_ID'])), status=String(cgVal(w,['Status','Execution_Status'])).toLowerCase(), pr=String(cgVal(w,['Priority'])).toLowerCase();
   if(status==='closed'||status==='completed')return;
   if(!['critical','high'].includes(pr)&&!/(awaiting|pending|overdue|part|permit)/i.test(status))return;
   const l=lossByPlant.get(pid)||{}, p=ppaByPlant.get(pid)||{}, tariff=cgNum(cgVal(p,['PPA_Tariff_INR_kWh']));
   const recVal=cgNum(cgVal(l,['Recoverable_Loss_MWh']))*1000*tariff, value=Math.max(cgNum(cgVal(w,['Estimated_Cost_INR'])),recVal);
   add({id:'CTX-M-'+String(cgVal(w,['Work_Order_ID','WO_ID','id'])||pid),origin:'Maintenance',plant:pid,site:siteName.get(pid)||pid,issue:'Maintenance execution constraint',
     priority:pr==='critical'?'Critical':'High',confidence:92,value,recoverable:recVal,
     domains:['Maintenance',...(recVal>0?['Generation','Commercial / PPA']:[])],
     recommended:`Resolve ${String(cgVal(w,['Work_Order_ID','WO_ID','id'])||'work order')} constraint`,target:'workorderintelligence',
     workOrderId:String(cgVal(w,['Work_Order_ID','WO_ID','id'])||''),
      why:[{type:'Work Order',label:String(cgVal(w,['Work_Order_ID','WO_ID','id']))},{type:'Status',label:String(cgVal(w,['Status','Execution_Status']))}],
     impact:[{type:'Generation',label:recVal?cgMoney(recVal)+' recoverable exposure':'Operational delay'},{type:'Decision',label:'Execution action required'}]});
 });

 ppa.forEach(r=>{
   const pid=String(cgVal(r,['Plant_ID'])), shortfall=cgNum(cgVal(r,['Shortfall_Energy_MWh'])), pen=cgNum(cgVal(r,['Availability_Penalty_INR'])), comp=cgNum(cgVal(r,['Curtailment_Compensation_INR'])), t=cgNum(cgVal(r,['PPA_Tariff_INR_kWh']));
   const gross=shortfall*1000*t+pen, net=Math.max(0,gross-comp);
   if(net<=0)return;
   add({id:'CTX-C-'+String(cgVal(r,['PPA_ID','id'])||pid),origin:'Commercial / PPA',plant:pid,site:siteName.get(pid)||pid,issue:'PPA / commercial exposure',
     priority:net>=2000000?'Critical':net>=500000?'High':'Medium',confidence:96,value:net,recoverable:Math.max(0,comp),
     domains:['Commercial / PPA',...(shortfall>0?['Generation']:[])],recommended:'Review PPA treatment, compensation eligibility and supporting evidence',target:'commercialppa',
     why:[{type:'PPA',label:String(cgVal(r,['PPA_ID','Offtaker'])||'PPA')},{type:'Shortfall',label:shortfall.toFixed(1)+' MWh'}],
     impact:[{type:'Gross impact',label:cgMoney(gross)},{type:'Compensation',label:cgMoney(comp)},{type:'Net exposure',label:cgMoney(net)}]});
 });

 esgByPlant.forEach((rows,pid)=>{
   if(!rows.length)return;
   const latest=[...rows].sort((a,b)=>String(cgVal(a,['Month','month'])).localeCompare(String(cgVal(b,['Month','month'])))).at(-1)||{};
   const overdue=cgNum(cgVal(latest,['Compliance_Actions_Overdue'])), water=cgNum(cgVal(latest,['Water_Intensity_kL_MWh'])), inj=cgNum(cgVal(latest,['Lost_Time_Injuries']));
   if(overdue<=0&&inj<=0&&water<=0.02)return;
   const score=overdue*2+inj*3+(water>0.02?1:0);
   add({id:'CTX-E-'+pid,origin:'ESG',plant:pid,site:siteName.get(pid)||pid,issue:'ESG / sustainability exception',
     priority:score>=4?'Critical':score>=2?'High':'Medium',confidence:90,value:0,recoverable:0,domains:['ESG'],
     recommended:'Review ESG exception and corrective action',target:'esgoverview',
     why:[{type:'ESG record',label:String(cgVal(latest,['Month','month'])||'Latest period')},{type:'Exception',label:`Overdue ${overdue} · LTI ${inj} · Water ${water.toFixed(3)}`}],
     impact:[{type:'ESG',label:'Governance / sustainability action required'}]});
 });

 issues.forEach(i=>{i.assetId=i.assetId||((i.why||[]).find(x=>x.type==='Asset')||{}).label||'';i.sourceRecord=i.sourceRecord||((i.why||[])[0]||{}).label||'';i.businessLabel=i.issue+(i.assetId?' — '+i.assetId:(i.sourceRecord?' — '+i.sourceRecord:''));});
 return issues;
}
function cgHydrateIssueExact(issue){
 if(!issue||issue.origin!=='Generation')return issue;
 const record=String(issue.sourceRecord||((issue.why||[]).find(x=>x.type==='Loss record')||{}).label||'');
 const r=contextGraphActiveRows('Generation Loss Attribution').find(x=>String(cgVal(x,['Loss_Record_ID','Loss_ID','id']))===record);
 if(!r)return issue;
 const pid=String(cgVal(r,['Plant_ID'])), total=cgNum(cgVal(r,['Total_Loss_MWh'])), rec=cgNum(cgVal(r,['Recoverable_Loss_MWh']));
 const period=String(cgVal(r,['Month','month'])||'').slice(0,7);
 const p=contextGraphActiveRows('Commercial & PPA').find(x=>String(cgVal(x,['Plant_ID']))===pid)||{}, tariff=cgNum(cgVal(p,['PPA_Tariff_INR_kWh']));
 const ds=[['Inverter',cgNum(cgVal(r,['Inverter_Loss_MWh']))],['Soiling',cgNum(cgVal(r,['Soiling_Loss_MWh']))],['Module degradation',cgNum(cgVal(r,['Module_Degradation_Loss_MWh']))],['Tracker',cgNum(cgVal(r,['Tracker_Loss_MWh']))],['DC string',cgNum(cgVal(r,['DC_String_Loss_MWh']))],['Transformer',cgNum(cgVal(r,['Transformer_Loss_MWh']))],['Grid outage',cgNum(cgVal(r,['Grid_Outage_Loss_MWh']))],['Curtailment',cgNum(cgVal(r,['Curtailment_Loss_MWh']))],['Planned maintenance',cgNum(cgVal(r,['Planned_Maintenance_Loss_MWh']))],['Unexplained',cgNum(cgVal(r,['Unexplained_Loss_MWh']))]].sort((a,b)=>b[1]-a[1]);
 const driver=ds[0]&&ds[0][1]>0?`${ds[0][0]} · ${ds[0][1].toFixed(1)} MWh`:'Not available';
 return {...issue,plant:pid,value:total*1000*tariff,recoverable:rec*1000*tariff,
  why:[{type:'Period',label:period},{type:'Total generation loss',label:total.toFixed(1)+' MWh'},{type:'Primary loss driver',label:driver}],
  impact:[{type:'Total generation loss',label:total.toFixed(1)+' MWh'},{type:'Recoverable generation',label:rec.toFixed(1)+' MWh'},{type:'Revenue exposure',label:cgMoney(total*1000*tariff)},{type:'Recoverable value',label:cgMoney(rec*1000*tariff)}]};
}
function cgIssuePath(issue,mode){
 if(!issue)return [];
 const palette={'Reliability':'#8b3a3a','Alert':'#d97706','Asset':'#0f766e','Evidence':'#64748b','Generation':'#2563eb','Total generation loss':'#2563eb','Asset Health':'#0f766e','Attributed loss':'#2563eb','Loss record':'#2563eb','Recoverable generation':'#16a34a','Maintenance':'#7c3aed','Work Order':'#7c3aed','Status':'#a16207','Decision':'#7c3aed','Commercial':'#be185d','Commercial / PPA':'#be185d','PPA':'#be185d','Shortfall':'#ea580c','Gross impact':'#be185d','Compensation':'#16a34a','Net exposure':'#b91c1c','Revenue exposure':'#b91c1c','Recoverable value':'#16a34a','ESG':'#15803d','ESG record':'#15803d','Exception':'#ca8a04'};
 let src=mode==='why'?(issue.why||[]):mode==='impact'?(issue.impact||[]):[...(issue.why||[]),...(issue.impact||[])];
 if(issue.origin==='Reliability'){
  const ev=(issue.why||[]).find(x=>x.type==='Evidence'), hm=ev&&String(ev.label||'').match(/\bHealth\s+(\d+(?:\.\d+)?)\/100\b/i);
  const health=hm?[{type:'Asset Health',label:`Health ${hm[1]}/100`}]:[];
  src=mode==='why'?health:mode==='impact'?(issue.impact||[]):[...health,...(issue.impact||[])];
 }
 return src.map((x,i)=>({id:'PATH:'+i,type:x.type,label:x.label,x:85+i*(610/Math.max(1,src.length-1)),y:205-(i%2?50:0),c:palette[x.type]||palette[issue.origin]||'#607d8b'}));
}
function cgOverviewNodes(issues,siteSel,domain,siteLabel){
 const palette={'Reliability':'#8b3a3a','Generation':'#2563eb','Maintenance':'#7c3aed','Commercial / PPA':'#be185d','ESG':'#15803d'};
 const cats=['Reliability','Generation','Maintenance','Commercial / PPA','ESG'].filter(c=>domain==='All'||c===domain);
 const center={id:'OV:C',type:'Scope',label:siteSel==='ALL'?'Portfolio':(siteLabel||siteSel),x:390,y:190,c:'#315f73'};
 const nodes=[center];
 cats.forEach((c,i)=>{
   const count=issues.filter(x=>x.domains.includes(c)).length;
   if(!count)return;
   const angle=(Math.PI*2*i/Math.max(1,cats.length))-Math.PI/2;
   nodes.push({id:'OV:'+c,type:c,label:`${c} · ${count}`,x:390+Math.cos(angle)*220,y:190+Math.sin(angle)*125,c:palette[c]||'#607d8b'});
 });
 return nodes;
}
function cgSupportingEvidence(issue){
 if(!issue)return [];
 const why=issue.why||[];
 return why
   .filter(x=>{
     if(issue.origin==='Reliability') return x.type==='Alert'||x.type==='Evidence';
     return !(issue.origin==='Generation' && x.type==='Loss record');
   })
   .map(x=>{
     let label=String(x.label||'');
     let type=String(x.type||'Evidence');
     if(type==='Evidence' && /\bHealth\s+\d+(?:\.\d+)?\/100\b/i.test(label)){
       label=label.replace(/\bHealth\s+(\d+(?:\.\d+)?)\/100\b/i,'Asset health $1/100 · governed Asset Health Scoring Framework');
     }
     if(issue.origin==='Generation' && type==='Attributed loss') type='Attributed generation loss';
     return {type,label};
   });
}
function contextGraphSourceSignature(){
 const mode=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'');
 const loss=contextGraphActiveRows('Generation Loss Attribution');
 const alerts=contextGraphActiveRows('AI Alerts & RUL');
 const ppa=contextGraphActiveRows('Commercial & PPA');
 const lossTotal=loss.reduce((a,r)=>a+cgNum(cgVal(r,['Total_Loss_MWh'])),0);
 const riskTotal=alerts.reduce((a,r)=>a+cgNum(cgVal(r,['Risk_Score'])),0);
 const ppaTotal=ppa.reduce((a,r)=>a+cgNum(cgVal(r,['Shortfall_Energy_MWh'])),0);
 return `${mode}|${loss.length}|${lossTotal.toFixed(1)}|${alerts.length}|${riskTotal.toFixed(3)}|${ppa.length}|${ppaTotal.toFixed(1)}`;
}
window.AIPContextGraphSourceSignature=contextGraphSourceSignature;

function renderGraph(){
 const host=$('#view-contextgraph');if(!host)return;
 const signature=contextGraphSourceSignature();
 if(window.__AIP_CG_SOURCE_SIGNATURE && window.__AIP_CG_SOURCE_SIGNATURE!==signature){
   window.AIP_CONTEXT_GRAPH_ISSUE='';
   window.AIP_CG_TRACE='all';
 }
 window.__AIP_CG_SOURCE_SIGNATURE=signature;
 const model=buildEnterpriseContext(),registry=contextIssueRegistry(),sites=contextGraphActiveRows('Sites').map(s=>({
   id:String(cgVal(s,['Plant_ID','Site_ID','id'])),
   name:String(cgVal(s,['Plant_Name','Site_Name','name'])||cgVal(s,['Plant_ID','Site_ID','id']))
 }));
 const siteSel=window.AIP_CG_SITE||'ALL',category=window.AIP_CG_LENS||'All',traceMode=window.AIP_CG_TRACE||'all';
 const issues=registry.filter(x=>(siteSel==='ALL'||x.plant===siteSel)&&(category==='All'||x.domains.includes(category)));
 const priorityRank={Critical:4,High:3,Medium:2,Low:1};
 let issuePriorityCfg={rules:[],topN:5};
 try{
   issuePriorityCfg=window.AIP_ISSUE_PRIORITY_CONFIG||JSON.parse(localStorage.getItem('aipIssuePrioritization')||'null')||issuePriorityCfg;
 }catch(_){}
 const topN=Math.max(1,Math.min(20,Number(issuePriorityCfg.topN)||5));
 const rankedIssues=[...issues].sort((a,b)=>
   (priorityRank[b.priority]||0)-(priorityRank[a.priority]||0) ||
   cgNum(b.value)-cgNum(a.value) ||
   cgNum(b.recoverable)-cgNum(a.recoverable) ||
   cgNum(b.confidence)-cgNum(a.confidence) ||
   String(a.id).localeCompare(String(b.id))
 );
 const requested=window.AIP_CONTEXT_GRAPH_ISSUE||'';
 const selectedRaw=requested?issues.find(x=>x.id===requested)||null:null;
 const selected=cgHydrateIssueExact(selectedRaw);

 // Filtered summary uses the largest connected financial exposure per site.
 // This avoids counting the same site-level economic consequence repeatedly
 // just because it is connected to Reliability, Generation and Maintenance.
 const perSite=new Map();
 issues.forEach(x=>{
   const prev=perSite.get(x.plant)||{value:0,recoverable:0};
   prev.value=Math.max(prev.value,cgNum(x.value));
   prev.recoverable=Math.max(prev.recoverable,cgNum(x.recoverable));
   perSite.set(x.plant,prev);
 });
 const financial=[...perSite.values()];
 const critical=issues.filter(x=>x.priority==='Critical').length;
 const totalValue=financial.reduce((s,x)=>s+x.value,0);
 const totalRec=financial.reduce((s,x)=>s+x.recoverable,0);
 const actions=issues.filter(x=>x.recommended).length;
 const covered=new Set(registry.map(x=>x.plant)).size;
 const siteObj=sites.find(x=>x.id===siteSel);
 const issueLocation=selected?(()=>{
   const code=typeof portfolioSiteCode==='function'?portfolioSiteCode(selected.plant,selected.site):selected.plant;
   const asset=String(selected.assetId||'').replace(new RegExp('^'+String(code).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[-·\\s]*','i'),'');
   return `${selected.site} · ${code}${asset?' · '+asset:''}`;
 })():'';

 host.innerHTML=`<div class="f1-help-top-right"></div><div class="page-head"><div><h1>Operational Impact Graph</h1></div></div>
 <div class="cg259-filters">
   <label><span>Site</span><select id="cgSite" class="xi-select"><option value="ALL">All Sites</option>${sites.map(s=>`<option value="${cgEsc(s.id)}" ${siteSel===s.id?'selected':''}>${cgEsc(typeof portfolioSiteCode==='function'?portfolioSiteCode(s.id,s.name):s.id)} · ${cgEsc(s.name)}</option>`).join('')}</select></label>
   <label><span>Impact Category</span><select id="cgLens" class="xi-select">${['All','Reliability','Generation','Maintenance','Commercial / PPA','ESG'].map(x=>`<option ${category===x?'selected':''}>${x}</option>`).join('')}</select></label>
   <label><span>Operational Issue</span><select id="cgIssueSelect" class="xi-select"><option value="">${issues.length?'Select an Operational Issue':'No qualifying issues'}</option>${issues.map(x=>`<option value="${cgEsc(x.id)}" ${selected&&x.id===selected.id?'selected':''}>${cgEsc(x.businessLabel||x.issue+(x.assetId?' — '+x.assetId:(x.sourceRecord?' — '+x.sourceRecord:'')))}</option>`).join('')}</select></label>
   <div class="cg259-trace-actions"><button class="xi-btn ${selected&&traceMode==='why'?'primary':''}" id="cgTraceWhy" ${selected?'':'disabled'}>Trace Cause</button><button class="xi-btn ${selected&&traceMode==='impact'?'primary':''}" id="cgTraceImpact" ${selected?'':'disabled'}>Trace Impact</button><button class="xi-btn ${selected&&traceMode==='all'?'primary':''}" id="cgTraceAll" ${selected?'':'disabled'}>Full Impact Path</button></div>
 </div>
 <div class="cg256-coverage">${sites.length} sites monitored · ${covered} sites with material issues · ${registry.length} operational issues · ${registry.filter(x=>x.priority==='Critical').length} critical</div>
 <div class="xi-kpis cg-portfolio-kpis">${cgKpi('Critical Issues',fmt(critical),0)}${cgKpi('Value at Risk',cgMoney(totalValue),1)}${cgKpi('Recoverable Value',cgMoney(totalRec),2)}${cgKpi('Actions Required',fmt(actions),3)}</div>
 <div class="cg255-layout">
  <div class="xi-card cg255-left">
   <div class="cg255-section-head"><div><h3>${selected?(traceMode==='why'?'Cause & Evidence':traceMode==='impact'?'Operational & Commercial Impact':'Full Impact Path'):(siteSel==='ALL'?'Portfolio Impact Coverage':'Site Impact Coverage')}</h3>${!selected?`<span class="cg266-impact-note">Counts show operational issues connected to each impact category. One issue can affect multiple categories, so category counts can overlap.</span>`:''}</div></div>
   ${selected?`<div class="cg263-location cg276-location"><b>${cgEsc(issueLocation)}</b></div>`:''}
   <div class="graph-wrap"><svg viewBox="0 0 780 360" id="gSvg"></svg></div>
   <div class="cg256-issue-head cg282-priority-head">
  <div class="cg282-left-group">
    <b>Top Priority Issues</b>
    <span class="cg282-count">(Top ${Math.min(topN,rankedIssues.length)} of ${rankedIssues.length})</span>
    <button class="cg282-action cg282-viewall" id="cgViewAllIssues">View All</button>
  </div>
  <button class="cg282-action cg282-rules" id="cgPriorityRules">Priority Rules</button>
</div>
<div id="cgPriorityRulesPanel" class="cg278-rules-panel" hidden>
  <div class="cg278-panel-head"><b>Issue Prioritization Rules</b><button class="cg278-close" id="cgCloseRules">×</button></div>
  <div class="cg278-rule-note">Hierarchical precedence — not a weighted score.</div>
  <button class="cg279-framework-link" id="cgOpenPriorityFramework">Open Issue Prioritization Framework →</button>
  <table class="cg278-rule-table">
    <thead><tr><th>Precedence</th><th>Criterion</th><th>Rule</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Severity</td><td>Critical → High → Medium → Low. Severity is inherited from governed source-domain logic.</td></tr>
      <tr><td>2</td><td>Value at Risk</td><td>Higher value ranks first within the same severity.</td></tr>
      <tr><td>3</td><td>Recoverable Value</td><td>Higher recoverable value ranks first when preceding criteria are equal.</td></tr>
      <tr><td>4</td><td>Confidence</td><td>Higher confidence is used as the final tie-breaker.</td></tr>
    </tbody>
  </table>
</div>
<div id="cgAllIssuesPanel" class="cg278-all-panel" hidden>
  <div class="cg278-panel-head"><b>All Ranked Issues</b><button class="cg278-close" id="cgCloseAll">×</button></div>
  <div class="cg278-all-list">${rankedIssues.map((x,i)=>`<button data-cg-issue="${cgEsc(x.id)}"><span>${i+1}</span><b>${cgEsc(x.businessLabel||x.issue)}</b></button>`).join('')||'<div class="xi-muted">No qualifying issues.</div>'}</div>
</div>
   <div class="cg255-issue-list cg269-priority-list">${rankedIssues.slice(0,topN).map((x,i)=>`<button data-cg-issue="${cgEsc(x.id)}" class="${selected&&x.id===selected.id?'active':''}"><span>${i+1}</span><div><b>${cgEsc(x.businessLabel||x.issue)}</b></div></button>`).join('')||'<div class="xi-muted">No qualifying issues for the selected Site and Impact Category.</div>'}</div>
  </div>
  <div class="xi-card cg255-right">
   <h3>Selected Issue</h3>
   ${selected?`<div class="cg255-context-card">
    <div class="cg255-metrics"><div><span>Issue value at risk</span><b>${cgMoney(selected.value)}</b></div><div><span>Issue recoverable value</span><b>${cgMoney(selected.recoverable)}</b></div><div><span>Priority</span><b>${cgEsc(selected.priority)}</b></div><div><span>Confidence</span><b>${selected.confidence.toFixed(1)}%</b></div></div>
    <div class="cg255-reco"><small>Recommended Action</small><strong>${cgEsc(selected.recommended)}</strong></div>
    <div class="cg255-actions"><button data-cg-route="${cgEsc(selected.target)}" class="xi-btn primary">${selected.target==='commercialppa'?'Review Commercial Exposure':selected.target==='workorderintelligence'?'Open Work Order':selected.target==='lossintelligence'?'Investigate Generation Loss':selected.target==='esgoverview'?'Review ESG Impact':'Investigate Issue'}</button></div>
   </div>`:`<div class="cg263-empty"><b>${siteSel==='ALL'?'Portfolio context':'Site context'}</b><span>Select an Operational Issue to see its causal path, financial impact, supporting evidence and recommended action.</span></div>`}
   <hr><h3>Supporting Evidence</h3><div class="cg256-evidence">${selected?cgSupportingEvidence(selected).map(x=>`<div><span>${cgEsc(x.type)}</span><b>${cgEsc(x.label)}</b></div>`).join(''):'<span class="xi-muted">Supporting evidence appears after an Operational Issue is selected.</span>'}</div>
  </div>
 </div>`;

 const svg=$('#gSvg');
 if(svg){
   if(selected){
     const nodes=cgIssuePath(selected,traceMode);
     svg.innerHTML=nodes.slice(0,-1).map((n,i)=>{const b=nodes[i+1];return `<line class="graph-edge ${traceMode==='impact'?'hot':''}" x1="${n.x}" y1="${n.y}" x2="${b.x}" y2="${b.y}"/>`}).join('')+
       nodes.map(n=>`<g class="graph-node"><circle cx="${n.x}" cy="${n.y}" r="24" fill="${n.c}"/><text x="${n.x}" y="${n.y+42}" text-anchor="middle">${cgEsc(String(n.label).slice(0,32))}</text></g>`).join('');
   }else{
     const nodes=cgOverviewNodes(issues,siteSel,category,siteObj?siteObj.name:''),center=nodes[0];
     svg.innerHTML=nodes.slice(1).map(n=>`<line class="graph-edge" x1="${center.x}" y1="${center.y}" x2="${n.x}" y2="${n.y}"/>`).join('')+
       nodes.map(n=>`<g class="graph-node"><circle cx="${n.x}" cy="${n.y}" r="${n.id==='OV:C'?30:24}" fill="${n.c}"/><text x="${n.x}" y="${n.y+42}" text-anchor="middle">${cgEsc(n.label)}</text></g>`).join('');
   }
 }
 const rerender=()=>renderGraph();
 $('#cgSite').onchange=e=>{
   window.AIP_CG_SITE=e.target.value||'ALL';
   window.AIP_CONTEXT_GRAPH_ISSUE='';
   window.AIP_CG_TRACE='all';
   rerender();
 };
 $('#cgLens').onchange=e=>{
   window.AIP_CG_LENS=e.target.value||'All';
   window.AIP_CONTEXT_GRAPH_ISSUE='';
   window.AIP_CG_TRACE='all';
   rerender();
 };
 $('#cgIssueSelect').onchange=e=>{window.AIP_CONTEXT_GRAPH_ISSUE=e.target.value;window.AIP_CG_TRACE='all';rerender()};
 $$('#view-contextgraph [data-cg-issue]').forEach(b=>b.onclick=()=>{window.AIP_CONTEXT_GRAPH_ISSUE=b.dataset.cgIssue;window.AIP_CG_TRACE='all';rerender()});
 $('#cgTraceWhy').onclick=()=>{if(!selected)return;window.AIP_CG_TRACE='why';rerender()};
 $('#cgTraceImpact').onclick=()=>{if(!selected)return;window.AIP_CG_TRACE='impact';rerender()};
 $('#cgTraceAll').onclick=()=>{if(!selected)return;window.AIP_CG_TRACE='all';rerender()};
 const rulesPanel=$('#cgPriorityRulesPanel'), allPanel=$('#cgAllIssuesPanel');
 if($('#cgPriorityRules'))$('#cgPriorityRules').onclick=()=>{try{renderGraph()}catch(_){};setTimeout(()=>{const rp=$('#cgPriorityRulesPanel'),ap=$('#cgAllIssuesPanel');if(rp)rp.hidden=false;if(ap)ap.hidden=true},0)};
 if($('#cgCloseRules'))$('#cgCloseRules').onclick=()=>{rulesPanel.hidden=true;try{window.refreshOperationalImpactGraph?.()}catch(_){}};
 if($('#cgViewAllIssues'))$('#cgViewAllIssues').onclick=()=>{allPanel.hidden=false;rulesPanel.hidden=true};
 if($('#cgCloseAll'))$('#cgCloseAll').onclick=()=>{allPanel.hidden=true};
 if($('#cgOpenPriorityFramework'))$('#cgOpenPriorityFramework').onclick=()=>{window.openIssuePrioritizationFramework?.()};
 $$('#view-contextgraph #cgAllIssuesPanel [data-cg-issue]').forEach(b=>b.onclick=()=>{window.AIP_CONTEXT_GRAPH_ISSUE=b.dataset.cgIssue;window.AIP_CG_TRACE='all';rerender()});
 const route=()=>{if(!selected)return;
    if(selected.target==='workorderintelligence'){
      const woId=String(selected.workOrderId||((selected.why||[]).find(x=>x.type==='Work Order')||{}).label||'').trim();
      if(!woId){try{window.toast?.('No governed Work Order is linked to this Operational Issue.')}catch(_){};return;}
      window.AIP_CG_WO_RETURN={
        issueId:selected.id||'',
        site:window.AIP_CG_SITE||'ALL',
        lens:window.AIP_CG_LENS||'All',
        trace:window.AIP_CG_TRACE||'all',
        workOrderId:woId
      };
      window.AIP_WO_DESIRED_TAB='ledger';
      try{if(typeof window.activate==='function')window.activate('workorderintelligence');else if(typeof activate==='function')activate('workorderintelligence')}catch(_){}
      if(typeof window.AIP_CG_FOCUS_EXACT_WO==='function')window.AIP_CG_FOCUS_EXACT_WO(woId);
      return;
    }
    try{if(typeof window.activate==='function')window.activate(selected.target);else if(typeof activate==='function')activate(selected.target)}catch(_){}
  };
 $$('#view-contextgraph [data-cg-route]').forEach(b=>b.onclick=route);
}

window.refreshOperationalImpactGraph=function(){
  try{
    renderGraph();
    return true;
  }catch(e){
    console.error('Operational Impact Graph refresh failed',e);
    return false;
  }
};

function twinModeKey(){let m='';try{m=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:(window.APM_DATA_MODE||''))}catch(_){m=String(window.APM_DATA_MODE||'')}return /excel|upload/i.test(m)?'excel':'synthetic'}
const TWIN_SYN={
 engineering:[
 {Plant_ID:'SP-01',DC_AC_Ratio:1.25,Module_Temp_Coeff_PctPerC:-0.36,NOCT_C:45,Base_DC_Loss_Pct:.60,Base_AC_Loss_Pct:.65,Transformer_Efficiency_Pct:98.3,Inverter_Efficiency_Pct:98.6,Annual_Degradation_Pct:.72,Soiling_Base_Pct:1.8,POA_Reference_Wm2:1000,Model_Version:'SYN-EPM-2026.08'},
 {Plant_ID:'SP-02',DC_AC_Ratio:1.22,Module_Temp_Coeff_PctPerC:-0.35,NOCT_C:44,Base_DC_Loss_Pct:.58,Base_AC_Loss_Pct:.62,Transformer_Efficiency_Pct:98.5,Inverter_Efficiency_Pct:98.7,Annual_Degradation_Pct:.68,Soiling_Base_Pct:1.5,POA_Reference_Wm2:1000,Model_Version:'SYN-EPM-2026.08'}],
 loss:[
 {Plant_ID:'SP-01',Gross_Expected_MWh:642,Temperature_Loss_MWh:12.8,Soiling_Loss_MWh:11.6,Shading_Loss_MWh:4.0,Clipping_Loss_MWh:6.5,Curtailment_Loss_MWh:7.1,Availability_Loss_MWh:8.6,Degradation_Loss_MWh:3.8,Transformer_AC_Loss_MWh:2.7,Residual_Loss_MWh:2.3,Actual_MWh:582.6,Recoverable_MWh:27.1,Model_Confidence_Pct:95.2,Model_Version:'SYN-EPM-2026.08'},
 {Plant_ID:'SP-02',Gross_Expected_MWh:508,Temperature_Loss_MWh:9.7,Soiling_Loss_MWh:7.5,Shading_Loss_MWh:3.1,Clipping_Loss_MWh:5.1,Curtailment_Loss_MWh:2.2,Availability_Loss_MWh:5.5,Degradation_Loss_MWh:3.0,Transformer_AC_Loss_MWh:2.1,Residual_Loss_MWh:1.7,Actual_MWh:468.1,Recoverable_MWh:19.6,Model_Confidence_Pct:94.4,Model_Version:'SYN-EPM-2026.08'}]
};
function twinRows(sheet){let r=contextGraphActiveRows(sheet)||[];if(twinModeKey()==='excel')return r; if(sheet==='Twin Engineering Parameters')return TWIN_SYN.engineering; if(sheet==='Twin Loss Model')return TWIN_SYN.loss; return r}
function twinSite(){let pid=window.AIP_TWIN_SITE||String(cgVal(contextGraphActiveRows('Sites')[0]||{},['Plant_ID']));return contextGraphActiveRows('Sites').find(x=>String(cgVal(x,['Plant_ID']))===pid)||contextGraphActiveRows('Sites')[0]||{}}
function twinParams(pid){return twinRows('Twin Engineering Parameters').find(r=>String(cgVal(r,['Plant_ID']))===pid)||twinRows('Twin Engineering Parameters')[0]||{}}
function twinLoss(pid){return twinRows('Twin Loss Model').find(r=>String(cgVal(r,['Plant_ID']))===pid)||twinRows('Twin Loss Model')[0]||{}}
function twinCalc(){
 const site=twinSite(),pid=String(cgVal(site,['Plant_ID'])),cap=cgNum(cgVal(site,['Capacity_MW']))||120,p=twinParams(pid),L=twinLoss(pid),hour=+S.time;
 const sun=Math.max(0,Math.sin(Math.PI*(hour-6)/14)),poa=Math.max(0,(930+S.scenario.weather*5)*sun),amb=29+8*sun,moduleT=amb+(poa/800)*20;
 const ratio=cgNum(cgVal(p,['DC_AC_Ratio']))||1.24,tc=cgNum(cgVal(p,['Module_Temp_Coeff_PctPerC']))||-.36,inv=(cgNum(cgVal(p,['Inverter_Efficiency_Pct']))||98.6)/100,tr=(cgNum(cgVal(p,['Transformer_Efficiency_Pct']))||98.4)/100,soil=(cgNum(cgVal(p,['Soiling_Base_Pct']))||1.8)/100;
 const tf=Math.max(.84,1+(tc/100)*(moduleT-25)),dc=cap*ratio*(poa/1000)*tf*(1-soil),clip=Math.max(0,dc*inv-cap),expected=Math.max(0,Math.min(cap,dc*inv)*tr),health=(cgNum(cgVal(site,['Health_Score']))||82),condition=Math.max(.90,.985-(100-health)*.0015),actual=expected*condition;
 const pr=poa>50?100*actual/(cap*(poa/1000)):0,avail=cgNum(cgVal(site,['Availability_Pct']))||98.2,gross=cgNum(cgVal(L,['Gross_Expected_MWh']))||cap*5.3,actualDay=cgNum(cgVal(L,['Actual_MWh']))||gross*.91,recoverable=cgNum(cgVal(L,['Recoverable_MWh']))||gross*.04,confidence=cgNum(cgVal(L,['Model_Confidence_Pct']))||94.5;
 const tariff=2.95,riskL=recoverable*1000*tariff/1e5*(2-(S.scenario.crew+S.scenario.spares)/200);
 return {site,pid,cap,poa,amb,moduleT,dc,expected,actual,clip,pr,avail,gross,actualDay,recoverable,confidence,riskL,L,model:String(cgVal(p,['Model_Version'])||cgVal(L,['Model_Version'])||'EPM-2026.08')};
}
function twinSvg(c){let blocks=Array.from({length:12},(_,i)=>{let x=40+(i%4)*142,y=82+Math.floor(i/4)*86,state=(i===0?'critical':i===6?'watch':'healthy'),fill=state==='critical'?'#ef5350':state==='watch'?'#ffb74d':'#36b37e';return `<g class="tw-asset ${state}" data-block="${i+1}" transform="translate(${x} ${y})"><rect x="0" y="0" rx="6" width="118" height="58" fill="#0c5a7e" stroke="${fill}" stroke-width="3"/><g stroke="#71c6e8" stroke-width="1">${[10,28,46,64,82,100].map(xx=>`<line x1="${xx}" y1="7" x2="${xx}" y2="51"/>`).join('')}${[19,35].map(yy=>`<line x1="6" y1="${yy}" x2="112" y2="${yy}"/>`).join('')}</g><circle cx="108" cy="9" r="5" fill="${fill}"/><text x="8" y="74" font-size="10" fill="#355363">Block ${i+1}</text></g>`}).join('');return `<svg viewBox="0 0 760 410" class="tw-plant-svg" aria-label="Interactive solar plant twin"><defs><linearGradient id="twsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7f6ff"/><stop offset="1" stop-color="#f7fbf8"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect x="0" y="0" width="760" height="410" rx="16" fill="url(#twsky)"/><text x="32" y="34" font-size="14" font-weight="700" fill="#21485b">${cgEsc(String(cgVal(c.site,['Plant_Name'])||c.pid))} · live physics layer</text>${blocks}<g transform="translate(620 94)"><rect x="0" y="0" width="92" height="72" rx="9" fill="#fff" stroke="#5f86a0"/><text x="46" y="30" text-anchor="middle" font-size="11" font-weight="700" fill="#244b5d">33/132 kV</text><text x="46" y="48" text-anchor="middle" font-size="10" fill="#607d8b">Transformer</text></g><g transform="translate(620 220)"><path d="M45 0 L10 92 M45 0 L80 92 M23 46 H67 M14 72 H76" stroke="#526d82" stroke-width="4" fill="none"/><text x="45" y="112" text-anchor="middle" font-size="10" fill="#355363">Grid / POI</text></g><path d="M585 196 H648 V173" stroke="#16a085" stroke-width="5" stroke-dasharray="12 7" class="tw-flow" filter="url(#glow)"/><path d="M665 166 V216" stroke="#16a085" stroke-width="5" stroke-dasharray="12 7" class="tw-flow"/><text x="600" y="385" font-size="10" fill="#607d8b">Click any block for asset evidence · animated line = AC power flow</text></svg>`}
function twinLossBars(c){let L=c.L,names=[['Temperature','Temperature_Loss_MWh','#ff8a65'],['Soiling','Soiling_Loss_MWh','#ffca28'],['Shading','Shading_Loss_MWh','#8d6e63'],['Clipping','Clipping_Loss_MWh','#7e57c2'],['Curtailment','Curtailment_Loss_MWh','#42a5f5'],['Availability','Availability_Loss_MWh','#ef5350'],['Degradation','Degradation_Loss_MWh','#78909c'],['Residual','Residual_Loss_MWh','#ab47bc']];let vals=names.map(x=>cgNum(cgVal(L,[x[1]]))||0),mx=Math.max(...vals,1);return names.map((x,i)=>`<div class="tw-loss-row"><span>${x[0]}</span><div><i style="width:${Math.max(2,vals[i]/mx*100)}%;background:${x[2]}"></i></div><b>${vals[i].toFixed(1)} MWh</b></div>`).join('')}
function renderTwin(){
 let v=$('#view-operationaltwin'),sites=contextGraphActiveRows('Sites').map(s=>({id:String(cgVal(s,['Plant_ID'])),name:String(cgVal(s,['Plant_Name'])||cgVal(s,['Plant_ID']))}));
 if(!window.AIP_TWIN_SITE||!sites.some(s=>s.id===window.AIP_TWIN_SITE))window.AIP_TWIN_SITE=sites[0]?.id||'';
 const exp=window.AIP_TWIN_EXPERIENCE||'native';
 const extConnected=localStorage.getItem('aip.extTwin.connectionStatus')==='Connected';
 const selector=`<div class="tw293-switch" id="twExperience"><button class="${exp==='native'?'active':''}" data-twexp="native"><span class="tw293-mode-dot ${exp==='native'?'green':'red'}"></span>Native Twin</button><button class="${exp==='external'?'active':''}" data-twexp="external"><span class="tw293-mode-dot ${(exp==='external'&&extConnected)?'green':'red'}"></span>External Twin</button></div>`;
 v.innerHTML=`<div class="f1-help-top-right"></div>`+head('ENTERPRISE INTELLIGENCE · PHYSICS-INFORMED OPERATIONAL TWIN','Operational Twin',`<div class="ot311-sitepick"><span class="ot311-site-label">Site</span><select id="tSite" class="xi-select" aria-label="Select site">${sites.map(x=>`<option value="${cgEsc(x.id)}" ${x.id===window.AIP_TWIN_SITE?'selected':''}>${cgEsc(x.name)}</option>`).join('')}</select><span id="gf483SiteCode" class="gf483-sitecode">Site code · ${cgEsc(window.AIP_TWIN_SITE||sites[0]?.id||'')}</span></div>`,false)+selector+`<div id="twExperienceBody"></div>`;
 const body=$('#twExperienceBody');
 function renderExperience(){
   const mode=window.AIP_TWIN_EXPERIENCE||'native';
   const connectedNow=localStorage.getItem('aip.extTwin.connectionStatus')==='Connected';
   $$('#twExperience button').forEach(b=>{const selected=b.dataset.twexp===mode;b.classList.toggle('active',selected);const d=b.querySelector('.tw293-mode-dot');if(d){const green=(b.dataset.twexp==='native'&&selected)||(b.dataset.twexp==='external'&&selected&&connectedNow);d.classList.toggle('green',green);d.classList.toggle('red',!green)}});
   if(mode==='external'){
     body.innerHTML=connectedNow?`<div class="tw293-ext-state"><section class="tw293-disconnected"><div class="tw293-plug" style="color:#238a50;background:#e7f6ed">✓</div><span class="tw293-state-pill"><i style="background:#27a45d"></i> EXTERNAL TWIN · CONNECTED</span><div class="tw293-actions"><button class="xi-btn primary" id="tw293Configure">Configure External Twin</button></div></section><aside class="tw293-ext-side"><div class="xi-card"><h3>Connection architecture</h3><div class="tw293-list"><div><span>Source context</span><b>Existing AIP integrations</b></div><div><span>Asset mapping</span><b>Canonical AIP IDs ↔ external entity IDs</b></div><div><span>Exchange</span><b>API / event / governed file pattern</b></div><div><span>External context</span><b>Hierarchy, geometry, state, simulation result</b></div><div><span>Control boundary</span><b>Read / advisory; no plant control path</b></div></div></div></aside></div>`:`<div class="tw293-ext-state"><section class="tw293-disconnected"><div class="tw293-plug">⌁</div><span class="tw293-state-pill"><i style="background:#d43d3d"></i> EXTERNAL TWIN · NOT CONNECTED</span><div class="tw293-actions"><button class="xi-btn primary" id="tw293Configure">Configure External Twin</button></div></section><aside class="tw293-ext-side"><div class="xi-card"><h3>Connection architecture</h3><div class="tw293-list"><div><span>Source context</span><b>Existing AIP integrations</b></div><div><span>Asset mapping</span><b>Canonical AIP IDs ↔ external entity IDs</b></div><div><span>Exchange</span><b>API / event / governed file pattern</b></div><div><span>External context</span><b>Hierarchy, geometry, state, simulation result</b></div><div><span>Control boundary</span><b>Read / advisory; no plant control path</b></div></div></div></aside></div>`;
     $('#tw293Configure').onclick=()=>{try{if(typeof activate==='function')activate('integrations');else if(typeof openView==='function')openView('integrations')}catch(_){};setTimeout(()=>document.getElementById('externalTwinConnector')?.scrollIntoView({behavior:'smooth',block:'start'}),120)};
   }else{
     // Native Twin always opens on the operational Live Plant layer. Visual evidence is shown only when explicitly selected.
     S.layer='Live Plant';
     body.innerHTML=`<div id="tKpis" class="xi-kpis"></div><div class="tw-toolbar"><div class="xi-tabs" id="tLayers">${['Live Plant','Physics & Losses','Asset Condition','Visual Evidence'].map((x,i)=>`<button class="xi-tab ${((S.layer||'Live Plant')===x)?'active':''}">${x}</button>`).join('')}</div><label>Solar hour <b id="tHour">12:00</b> <span class="ot299-time-range">Solar Window · Site-derived</span></label><input id="tTime" class="xi-range" type="range" min="6" max="19" step="0.25" value="${S.time||12}"><button class="xi-btn primary" id="tRun">Simulate intervention</button></div><div id="twBody"></div>`;
     updateTwin();
     $('#tTime').oninput=()=>{S.time=+$('#tTime').value;updateTwin()};
     $$('#tLayers .xi-tab').forEach(b=>b.onclick=()=>{$$('#tLayers .xi-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');S.layer=b.textContent;updateTwin()});
     $('#tRun').onclick=()=>{S.scenario.crew=100;S.scenario.spares=100;toast('Advisory intervention simulated — no plant control issued');updateTwin(true)};
   }
 }
 $$('#twExperience button').forEach(b=>b.onclick=()=>{const prev=window.AIP_TWIN_EXPERIENCE||'native';window.AIP_TWIN_EXPERIENCE=b.dataset.twexp;if(b.dataset.twexp==='native'&&prev==='external'){const rr=window.AIP_V21?.renderers?.operationaltwin;if(rr)rr();else renderExperience()}else renderExperience()});
 $('#tSite').onchange=e=>{window.AIP_TWIN_SITE=e.target.value;const sc=document.getElementById('gf483SiteCode');if(sc)sc.textContent='Site code · '+e.target.value;if((window.AIP_TWIN_EXPERIENCE||'native')==='native')updateTwin()};
 renderExperience();
}
function updateTwin(sim=false){let c=twinCalc();$('#tHour').textContent=S.time+':00';$('#tKpis').innerHTML=kpi('Expected AC power',c.expected.toFixed(1)+' MW','Physics model')+kpi('Actual AC power',c.actual.toFixed(1)+' MW','Observed / simulated')+kpi('Performance ratio',c.pr.toFixed(1)+'%','Irradiance normalized')+kpi('Recoverable loss',c.recoverable.toFixed(1)+' MWh','Current loss model')+kpi('Model confidence',c.confidence.toFixed(1)+'%','Version '+c.model);let layer=S.layer||'Live Plant',body=$('#twBody');if(layer==='Live Plant'){body.innerHTML=`<div class="tw-grid"><section class="xi-card tw-main"><div class="tw-statebar"><span><i class="ok"></i> ${c.avail.toFixed(1)}% availability</span><span>POA <b>${c.poa.toFixed(0)} W/m²</b></span><span>Module <b>${c.moduleT.toFixed(1)} °C</b></span><span>DC <b>${c.dc.toFixed(1)} MW</b></span></div>${twinSvg(c)}</section><aside class="xi-card tw-side"><h3>Physics chain</h3><div class="tw-chain"><div>☀ <b>POA</b><span>${c.poa.toFixed(0)} W/m²</span></div><em>→</em><div>▦ <b>DC field</b><span>${c.dc.toFixed(1)} MW</span></div><em>→</em><div>⚡ <b>Inverter</b><span>${c.expected.toFixed(1)} MW exp.</span></div><em>→</em><div>▣ <b>Transformer</b><span>${(cgNum(cgVal(c.p,['Transformer_Efficiency_Pct']))||98.4).toFixed(1)}%</span></div><em>→</em><div>⌁ <b>POI</b><span>${c.actual.toFixed(1)} MW actual</span></div></div><div class="tw-alert"><b>AI / physics deviation</b><span>${(c.expected-c.actual).toFixed(2)} MW below expected</span><small>Primary evidence: asset health + expected-performance residual</small></div></aside></div>`;body.querySelectorAll('.tw-asset').forEach(g=>g.onclick=()=>{body.querySelectorAll('.tw-asset').forEach(x=>x.classList.remove('selected'));g.classList.add('selected');toast(`Block ${g.dataset.block}: contextual asset evidence opened`)});}else if(layer==='Physics & Losses'){body.innerHTML=`<div class="tw-grid"><section class="xi-card tw-main"><h3>Expected → actual energy reconciliation</h3><div class="tw-waterfall"><div><b>${c.gross.toFixed(1)}</b><span>Gross expected MWh</span></div><strong>−</strong><div><b>${(c.gross-c.actualDay).toFixed(1)}</b><span>Attributed losses</span></div><strong>=</strong><div class="actual"><b>${c.actualDay.toFixed(1)}</b><span>Actual MWh</span></div></div><div class="tw-losses">${twinLossBars(c)}</div></section><aside class="xi-card tw-side"><h3>Model provenance</h3><dl class="tw-dl"><dt>Model version</dt><dd>${cgEsc(c.model)}</dd><dt>Physics core</dt><dd>POA → temperature → DC → inverter → transformer → AC</dd><dt>DC/AC ratio</dt><dd>${(cgNum(cgVal(c.p,['DC_AC_Ratio']))||1.24).toFixed(2)}</dd><dt>Temp coefficient</dt><dd>${(cgNum(cgVal(c.p,['Module_Temp_Coeff_PctPerC']))||-.36).toFixed(2)} %/°C</dd><dt>Residual threshold</dt><dd>3.0%</dd><dt>Control boundary</dt><dd>Advisory only</dd></dl><button class="xi-btn" onclick="openView('twinfoundation')">Open Twin Model & Physics</button></aside></div>`;}else if(layer==='Asset Condition'){let assets=contextGraphActiveRows('Asset Master').filter(a=>String(cgVal(a,['Plant_ID']))===c.pid).slice(0,12);body.innerHTML=`<div class="xi-card"><h3>Equipment cohort condition — click a row to investigate</h3><table class="xi-table tw-table"><thead><tr><th>Asset</th><th>Class</th><th>Health</th><th>Operating state</th><th>Expected behavior</th><th>Residual / risk</th><th>Action</th></tr></thead><tbody>${assets.map((a,i)=>{let h=cgNum(cgVal(a,['Health_Score']))||80,st=h<65?'Critical':h<80?'Watch':'Healthy';return `<tr><td>${cgEsc(String(cgVal(a,['Asset_Tag'])||cgVal(a,['Asset_ID'])))}</td><td>${cgEsc(String(cgVal(a,['Asset_Class'])||''))}</td><td><span class="tw-health ${st.toLowerCase()}">${h.toFixed(0)}</span></td><td>${st}</td><td>${i%3===0?'Below EPM band':'Within EPM band'}</td><td>${i%3===0?'High residual':'Normal residual'}</td><td><button class="xi-btn" onclick="toast('Asset investigation opened')">Investigate</button></td></tr>`}).join('')}</tbody></table></div>`;}else{body.innerHTML=`<div class="tw-evidence-grid"><section class="xi-card"><h3>Aerial / site evidence</h3><div class="tw-media safe"><svg viewBox="0 0 520 250"><rect width="520" height="250" fill="#dff2dd"/><path d="M0 195 Q130 150 260 190 T520 170 V250 H0Z" fill="#b4d6a4"/>${Array.from({length:18},(_,i)=>`<rect x="${25+(i%6)*80}" y="${45+Math.floor(i/6)*48}" width="62" height="29" rx="2" fill="#126080" stroke="#76c6e6"/>`).join('')}<path d="M450 25 L475 68 L425 68 Z" fill="#607d8b"/><text x="16" y="235" font-size="11" fill="#345">Rights-safe twin illustration · replace with client-owned drone imagery</text></svg></div><p class="xi-muted">Interactive hotspot mapping is ready. Real site media will only be activated when ownership/licence is recorded in Twin Media Registry.</p></section><section class="xi-card"><h3>Thermal / inspection evidence</h3><div class="tw-media thermal"><div class="tw-thermal-grid">${Array.from({length:48},(_,i)=>`<i class="${i===17||i===18?'hot':i%7===0?'warm':''}" title="Module group ${i+1}"></i>`).join('')}</div></div><div class="tw-alert"><b>Visual evidence gate</b><span>No unlicensed external imagery embedded</span><small>Client / O&M / generated assets require provenance status before distribution.</small></div></section></div>`;}}
function renderTwinFoundation(){
 const v=$('#view-twinfoundation');
 const rows=twinRows('Twin Engineering Parameters');
 const sites=contextGraphActiveRows('Sites')||[];
 const siteIds=[...new Set((sites.length?sites:rows).map(r=>String(cgVal(r,['Plant_ID','Site_ID']))).filter(Boolean))];
 if(!window.AIP_TWIN_FOUNDATION_SITE||!siteIds.includes(window.AIP_TWIN_FOUNDATION_SITE)){
   window.AIP_TWIN_FOUNDATION_SITE=siteIds.includes(window.AIP_TWIN_SITE)?window.AIP_TWIN_SITE:(siteIds[0]||'');
 }
 const source=twinModeKey()==='excel'?'Excel':'Synthetic';
 const versions=[...new Set(rows.map(r=>String(cgVal(r,['Model_Version'])||'')).filter(Boolean))];
 const versionText=versions.length===1?versions[0]:(versions.length?versions.join(', '):'Governed per site');

 v.innerHTML=head('TECHNOLOGY FOUNDATION · GOVERNED TWIN CORE','Twin Model & Physics',``,false)+
 `<div class="tw317-intro tw321-intro"><b>Physics-informed expected-performance model using governed engineering parameters.</b></div>`+
 `<div class="tw317-chain tw323-chain" aria-label="Expected-performance model chain">
   <button class="tw317-stage" data-stage="poa"><span>1</span><b>POA</b><small>Plane-of-array irradiance</small><em>Irradiance model</em><i>↗</i></button><strong>→</strong>
   <button class="tw317-stage" data-stage="tcell"><span>2</span><b>Tcell</b><small>Module operating temperature</small><em>Thermal model</em><i>↗</i></button><strong>→</strong>
   <button class="tw317-stage" data-stage="pdc"><span>3</span><b>Pdc</b><small>Expected DC field output</small><em>DC performance model</em><i>↗</i></button><strong>→</strong>
   <button class="tw317-stage" data-stage="pac"><span>4</span><b>Pac / POI</b><small>Expected AC output</small><em>AC conversion model</em><i>↗</i></button>
 </div>`+
 `<div class="tw317-layout"><section class="xi-card"><div class="tw317-card-head"><h3>Governed model parameters</h3><span>Fleet model definition</span></div>
 <table class="xi-table tw317-param-table tw323-param-table"><thead><tr><th>Parameter</th><th>Purpose</th><th>Unit</th><th>Applied at</th></tr></thead><tbody>
   <tr><td>POA irradiance inputs</td><td>Irradiance incident on the PV array</td><td>W/m²</td><td>POA</td></tr>
   <tr><td>NOCT / thermal behaviour</td><td>Module operating-temperature response</td><td>°C</td><td>Tcell</td></tr>
   <tr><td>DC/AC ratio</td><td>Installed DC sizing relative to AC capacity</td><td>ratio</td><td>Pdc</td></tr>
   <tr><td>Module temperature coefficient</td><td>DC power temperature derating</td><td>%/°C</td><td>Pdc</td></tr>
   <tr><td>Soiling loss</td><td>Expected DC field loss from soiling</td><td>%</td><td>Pdc</td></tr>
   <tr><td>Inverter conversion efficiency</td><td>DC-to-AC conversion and clipping basis</td><td>%</td><td>Pac / POI</td></tr>
   <tr><td>Transformer efficiency</td><td>Step-up transformer conversion loss</td><td>%</td><td>Pac / POI</td></tr>
   <tr><td>Annual degradation</td><td>Long-term expected-performance adjustment</td><td>%/year</td><td>Expected performance</td></tr>
 </tbody></table></section>
 <aside class="xi-card tw317-govern"><h3>Model governance</h3>
   <div><span>Model version</span><b>${cgEsc(versionText)}</b></div>
   <div><span>Parameter source</span><b>Twin Engineering Parameters</b></div>
   <div><span>Loss evidence</span><b>Twin Loss Model</b></div>
   <div><span>Active data source</span><b>${source}</b></div>
   <div><span>Auditability</span><b>Version + governed input lineage</b></div>
 </aside></div>`+
 `<div id="tw317Drill" class="tw317-drill" hidden></div>`;

 function selected(){
   const pid=window.AIP_TWIN_FOUNDATION_SITE||siteIds[0]||'';
   const p=rows.find(r=>String(cgVal(r,['Plant_ID','Site_ID']))===pid)||rows[0]||{};
   const site=sites.find(r=>String(cgVal(r,['Plant_ID','Site_ID']))===pid)||{};
   const L=twinLoss(pid)||{};
   const cap=cgNum(cgVal(site,['Capacity_MW']))||120;
   const hour=Number.isFinite(+S.time)?+S.time:12;
   const sun=Math.max(0,Math.sin(Math.PI*(hour-6)/14));
   const poa=Math.max(0,(930+S.scenario.weather*5)*sun);
   const amb=29+8*sun;
   const noct=cgNum(cgVal(p,['NOCT_C']))||45;
   const moduleT=amb+(poa/800)*20;
   const ratio=cgNum(cgVal(p,['DC_AC_Ratio']))||1.24;
   const tc=cgNum(cgVal(p,['Module_Temp_Coeff_PctPerC']))||-.36;
   const inv=(cgNum(cgVal(p,['Inverter_Efficiency_Pct']))||98.6)/100;
   const tr=(cgNum(cgVal(p,['Transformer_Efficiency_Pct']))||98.4)/100;
   const soil=(cgNum(cgVal(p,['Soiling_Base_Pct']))||1.8)/100;
   const degradation=(cgNum(cgVal(p,['Annual_Degradation_Pct']))||0);
   const tf=Math.max(.84,1+(tc/100)*(moduleT-25));
   const dc=cap*ratio*(poa/1000)*tf*(1-soil);
   const acInv=Math.min(cap,dc*inv);
   const pac=Math.max(0,acInv*tr);
   const clip=Math.max(0,dc*inv-cap);
   const model=String(cgVal(p,['Model_Version'])||cgVal(L,['Model_Version'])||'EPM-2026.08');
   const siteName=String(cgVal(site,['Plant_Name'])||pid||'Selected site');
   return {pid,p,site,L,cap,hour,sun,poa,amb,noct,moduleT,ratio,tc,inv,tr,soil,degradation,tf,dc,pac,clip,model,siteName};
 }
 function opts(pid){return siteIds.map(id=>{const st=sites.find(x=>String(cgVal(x,['Plant_ID','Site_ID']))===id)||{};const nm=String(cgVal(st,['Plant_Name'])||id);return `<option value="${cgEsc(id)}" ${id===pid?'selected':''}>${cgEsc(id)} · ${cgEsc(nm)}</option>`}).join('')}
 function line(label,value,unit,src){return `<tr><td>${label}</td><td><b>${value}</b>${unit?` <span>${unit}</span>`:''}</td><td>${src}</td></tr>`}
 let activeStage='';
 function openStage(stage){
   activeStage=stage;
   const c=selected();
   let title='',formula='',purpose='',output='',items=[];
   if(stage==='poa'){
     title='POA · Plane-of-array irradiance';
     purpose='';
     formula='POA = max(0, (930 + weather adjustment × 5) × sin(π × (hour − 6) / 14))';
     output=`${c.poa.toFixed(0)} W/m²`;
     items=[line('Solar hour',c.hour.toFixed(2),'hour','Operational Twin scenario state'),line('Solar profile factor',c.sun.toFixed(4),'','Physics function'),line('Weather adjustment',Number(S.scenario.weather||0).toFixed(2),'index','Scenario / active context'),line('Calculated POA',c.poa.toFixed(0),'W/m²','Calculated')];
   }else if(stage==='tcell'){
     title='Tcell · Module temperature';
     purpose='';
     formula='Ambient = 29 + 8 × solar factor; Tcell = Ambient + (POA / 800) × 20';
     output=`${c.moduleT.toFixed(1)} °C`;
     items=[line('POA',c.poa.toFixed(0),'W/m²','Calculated POA stage'),line('Ambient temperature',c.amb.toFixed(1),'°C','Physics function'),line('Governed NOCT',c.noct.toFixed(1),'°C','Twin Engineering Parameters'),line('Calculated Tcell',c.moduleT.toFixed(1),'°C','Calculated')];
   }else if(stage==='pdc'){
     title='Pdc · DC field output';
     purpose='';
     formula='Pdc = Capacity × DC/AC ratio × (POA / 1000) × temperature factor × (1 − soiling)';
     output=`${c.dc.toFixed(1)} MW`;
     items=[line('Site capacity',c.cap.toFixed(2),'MW AC','Sites'),line('DC/AC ratio',c.ratio.toFixed(2),'ratio','Twin Engineering Parameters'),line('Temperature coefficient',c.tc.toFixed(2),'%/°C','Twin Engineering Parameters'),line('Temperature factor',c.tf.toFixed(4),'','Calculated from Tcell'),line('Soiling base',(c.soil*100).toFixed(2),'%','Twin Engineering Parameters'),line('Calculated Pdc',c.dc.toFixed(1),'MW','Calculated')];
   }else{
     title='Pac / POI · Expected AC output';
     purpose='';
     formula='Pac = min(Site capacity, Pdc × inverter efficiency) × transformer efficiency';
     output=`${c.pac.toFixed(1)} MW`;
     items=[line('Pdc',c.dc.toFixed(1),'MW','Calculated Pdc stage'),line('Inverter efficiency',(c.inv*100).toFixed(2),'%','Twin Engineering Parameters'),line('Inverter clipping',c.clip.toFixed(2),'MW','Calculated'),line('Transformer efficiency',(c.tr*100).toFixed(2),'%','Twin Engineering Parameters'),line('Calculated Pac / POI',c.pac.toFixed(1),'MW','Calculated')];
   }
   const d=$('#tw317Drill');
   d.hidden=false;
   d.innerHTML=`<div class="tw317-drill-head"><div><h3>${title}</h3></div><button id="tw317Close" type="button">×</button></div>
   <div class="tw323-example-head tw326-example-onebox">
     <span class="tw326-example-caption">Application example · Current modeled operating condition</span>
     <label>Site <select id="tw323Site" class="xi-select" aria-label="Select site application example">${opts(c.pid)}</select></label>
     <div class="tw326-example-output"><span>Calculated output</span><b>${output}</b></div>
   </div>
   <div class="tw317-formula"><span>Calculation used by current Operational Twin</span><code>${formula}</code></div>
   <table class="xi-table"><thead><tr><th>Input / result</th><th>Current value</th><th>Lineage</th></tr></thead><tbody>${items.join('')}</tbody></table>`;
   $('#tw317Close').onclick=()=>{d.hidden=true;d.innerHTML='';activeStage=''};
   $('#tw323Site').onchange=e=>{window.AIP_TWIN_FOUNDATION_SITE=e.target.value;openStage(activeStage)};
   d.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 $$('#view-twinfoundation .tw317-stage').forEach(b=>b.onclick=()=>openStage(b.dataset.stage));
 window.AIP_V323_AUDIT={release:'v323',baseline:'v322',scope:'Twin Model & Physics foundation/site separation',mainFoundationSiteNeutral:true,siteSpecificValuesMovedToDrill:true,explicitSiteSelectorInDrill:true,governedParameterDefinitions:true,operationalTwinCalculationReused:true,calculationLogicChanged:false,excelChanged:false,syntheticChanged:false,startupChanged:false,loginChanged:false,navigationChanged:false};
}
function decisionScore(d){return Math.round(d.risk*2+d.conf*.35+d.ready*.3)}
function renderDecision(){
 const src=contextGraphActiveRows('Decision Intelligence');
 if(src&&src.length){
   S.decisions=src.slice(0,12).map((r,i)=>({
     id:String(cgVal(r,['Decision_ID','id'])||('D-'+(i+1))),
     title:String(cgVal(r,['Title','Recommended_Action'])||'Operational decision'),
     asset:String(cgVal(r,['Source_Record_ID','Asset_ID'])||cgVal(r,['Source_Sheet'])||'Portfolio'),
     risk:Math.max(.1,cgNum(cgVal(r,['Impact_Value_INR']))/1e5),
     conf:Math.round(cgNum(cgVal(r,['Confidence_Pct']))||80),
     ready:Math.max(55,Math.min(98,Math.round((cgNum(cgVal(r,['Confidence_Pct']))||80)-4+(i%5)*3))),
     status:String(cgVal(r,['Status'])||'Awaiting Review'),
     evidence:[String(cgVal(r,['Rationale'])||'Source intelligence'),String(cgVal(r,['Calculation_Basis'])||'Governed calculation')]
   }));
 }
 let v=$('#view-decisionworkspace');v.innerHTML=head('ENTERPRISE INTELLIGENCE · EXPLAINABLE HUMAN-GOVERNED ACTIONS','Decision Workspace',`<select id="dStatus" class="xi-select"><option>All</option><option>Awaiting Review</option><option>Evidence Gap</option><option>Approved</option><option>Deferred</option></select><button class="xi-btn primary" id="dRecalc">Recalculate priority</button>`)+`<div class="xi-kpis" id="dKpis"></div><div class="xi-grid aip-workspace-decision-layout"><div class="xi-card s12 aip-workspace-ranked-queue"><h3>Ranked decision queue</h3><div class="aip-workspace-queue-scroll"><table class="xi-table" id="dTable"></table></div></div><div class="xi-card s12 aip-workspace-scoring-policy"><h3>Scoring policy</h3><label>Value / risk <b>35%</b></label><div class="scorebar"><i style="width:35%"></i></div><label>Urgency <b>20%</b></label><div class="scorebar"><i style="width:20%"></i></div><label>Confidence <b>20%</b></label><div class="scorebar"><i style="width:20%"></i></div><label>Execution readiness <b>25%</b></label><div class="scorebar"><i style="width:25%"></i></div><p class="xi-muted">Priority is recalculated from evidence and operational constraints. It is a recommendation, not autonomous execution.</p></div></div>`;updateDecisions();$('#dStatus').onchange=updateDecisions;$('#dRecalc').onclick=()=>{S.decisions.forEach(d=>d.conf=Math.min(99,d.conf+Math.round(Math.random()*3)));updateDecisions();toast('Priority scores recalculated')}}
function updateDecisions(){let f=$('#dStatus')?.value||'All',arr=S.decisions.filter(d=>f==='All'||d.status===f).sort((a,b)=>decisionScore(b)-decisionScore(a));$('#dKpis').innerHTML=kpi('Awaiting review',S.decisions.filter(d=>d.status==='Awaiting Review').length,'Human approval required')+kpi('Risk if deferred',money(S.decisions.reduce((s,d)=>s+d.risk,0)),'Across active decisions')+kpi('Average confidence',(S.decisions.reduce((s,d)=>s+d.conf,0)/S.decisions.length).toFixed(1)+'%','Evidence-weighted')+kpi('Execution ready',S.decisions.filter(d=>d.ready>=80).length,'Prerequisites satisfied');$('#dTable').innerHTML=`<thead><tr><th>Priority</th><th>Decision</th><th>Risk if deferred</th><th>Confidence</th><th>Readiness</th><th>Status</th></tr></thead><tbody>${arr.map((d,i)=>`<tr data-id="${d.id}"><td><b>${i+1}</b><br><span class="xi-muted">Score ${decisionScore(d)}</span></td><td><button class="xi-btn" onclick="openDecision('${d.id}')">${d.title}</button><br><span class="xi-muted">${d.asset}</span></td><td>${money(d.risk)}</td><td>${d.conf}%</td><td>${d.ready}%</td><td><span class="xi-pill">${d.status}</span></td></tr>`).join('')}</tbody>`}
window.openDecision=id=>{let d=S.decisions.find(x=>x.id===id);openDrawer(`<h2>${d.title}</h2><span class="xi-pill">${d.status}</span><p><b>Asset / scope:</b> ${d.asset}</p><h3>Evidence</h3><ul>${d.evidence.map(x=>`<li>${x}</li>`).join('')}</ul><h3>Alternatives</h3><table class="xi-table"><tr><td>Act now</td><td>Protect ${money(d.risk)}</td></tr><tr><td>Defer 7 days</td><td>+18% failure exposure</td></tr><tr><td>Monitor only</td><td>Requires daily inspection</td></tr></table><h3>Decision rationale</h3><textarea id="dRationale" class="xi-input" style="width:100%;height:75px" placeholder="Record rationale"></textarea><div class="xi-tools" style="margin-top:10px"><button class="xi-btn primary" onclick="decisionAction('${id}','Approved')">Approve</button><button class="xi-btn" onclick="decisionAction('${id}','Deferred')">Defer</button><button class="xi-btn" onclick="decisionAction('${id}','Evidence Gap')">Request evidence</button></div>`)};window.decisionAction=(id,status)=>{let d=S.decisions.find(x=>x.id===id);d.status=status;closeDrawer();updateDecisions();toast('Decision '+status.toLowerCase())};
function scenCalc(){let x=S.scenario;let p=x.failure/100,delay=(100-x.crew)/20+(100-x.spares)/16,loss=42.4*(1+x.weather/100)*p,rev=loss*x.tariff*10,risk=rev+delay*1.8;return {p,delay,loss,rev,risk}}
function renderScenario(){
 const alerts=contextGraphActiveRows('AI Alerts & RUL'), ppa=contextGraphActiveRows('Commercial & PPA'), crews=contextGraphActiveRows('Crew & Skills'), inv=contextGraphActiveRows('Inventory Balance');
 const avgRisk=alerts.length?alerts.reduce((a,r)=>a+cgNum(cgVal(r,['Risk_Score'])),0)/alerts.length:.55;
 const avgTariff=ppa.length?ppa.reduce((a,r)=>a+cgNum(cgVal(r,['PPA_Tariff_INR_kWh'])),0)/ppa.length:2.8;
 const crewReady=crews.length?Math.round(100*crews.filter(r=>/available/i.test(String(cgVal(r,['Availability'])))).length/crews.length):80;
 const spareReady=inv.length?Math.round(100*inv.filter(r=>!/stockout|critical/i.test(String(cgVal(r,['Stock_Status'])))).length/inv.length):75;
 S.scenario.failure=Math.max(5,Math.min(90,Math.round(avgRisk*100)));S.scenario.tariff=+avgTariff.toFixed(2);S.scenario.crew=Math.max(30,crewReady);S.scenario.spares=Math.max(30,spareReady);
 let v=$('#view-scenariosimulator2');v.innerHTML=head('ENTERPRISE INTELLIGENCE · CONTEXTUAL SCENARIO INTELLIGENCE','Scenario Analysis',`<button class="xi-btn" id="sSave">Save scenario</button><button class="xi-btn primary" id="sCompare">Compare alternatives</button>`)+`<div class="xi-grid"><div class="xi-card s4"><h3>Scenario assumptions</h3>${[['failure','Failure probability',5,90,'%'],['weather','Weather adjustment',-25,20,'%'],['crew','Crew readiness',30,100,'%'],['spares','Spares readiness',30,100,'%']].map(x=>`<label>${x[1]} <b id="sv-${x[0]}"></b></label><input id="s-${x[0]}" class="xi-range" type="range" min="${x[2]}" max="${x[3]}" value="${S.scenario[x[0]]}">`).join('')}<label>Tariff ₹/kWh</label><input id="s-tariff" class="xi-input" type="number" step=".05" value="${S.scenario.tariff}"></div><div class="xi-card s8"><div id="sKpis" class="xi-kpis"></div><h3>Alternative comparison</h3><table class="xi-table" id="sTable"></table><div class="xi-muted" id="sExplain"></div></div></div>`;['failure','weather','crew','spares'].forEach(k=>$('#s-'+k).oninput=e=>{S.scenario[k]=+e.target.value;updateScenario()});$('#s-tariff').oninput=e=>{S.scenario.tariff=+e.target.value;updateScenario()};$('#sSave').onclick=()=>toast('Scenario saved to workspace');$('#sCompare').onclick=()=>{S.scenario.failure=Math.max(5,S.scenario.failure-12);$('#s-failure').value=S.scenario.failure;updateScenario();toast('Intervention alternative applied')};updateScenario()}
function updateScenario(){let c=scenCalc();['failure','weather','crew','spares'].forEach(k=>$('#sv-'+k).textContent=S.scenario[k]+'%');$('#sKpis').innerHTML=kpi('Generation at risk',c.loss.toFixed(1)+' MWh','Selected horizon')+kpi('Revenue exposure',money(c.rev),'Tariff-adjusted')+kpi('Expected delay',c.delay.toFixed(1)+' days','Crew and spare constraints')+kpi('Composite risk',money(c.risk),'Scenario outcome');$('#sTable').innerHTML=`<thead><tr><th>Alternative</th><th>Expected loss</th><th>Cost / exposure</th><th>Execution</th></tr></thead><tbody><tr><td>Act in next window</td><td>${(c.loss*.28).toFixed(1)} MWh</td><td>${money(c.risk*.34)}</td><td>Recommended</td></tr><tr><td>Defer 7 days</td><td>${(c.loss*1.18).toFixed(1)} MWh</td><td>${money(c.risk*1.24)}</td><td>Higher risk</td></tr><tr><td>Monitor only</td><td>${(c.loss*.86).toFixed(1)} MWh</td><td>${money(c.risk*.93)}</td><td>Daily evidence needed</td></tr></tbody>`;$('#sExplain').innerHTML=`The model combines failure probability, expected generation, tariff, crew readiness and spare availability. Calculations update immediately as assumptions change.`}
const events=[['08:12','Telemetry','Cooling fan current variance','Early degradation signal'],['09:04','Telemetry','Internal temperature +7.8°C','Thermal stress increasing'],['10:16','SCADA','Power derating','Generation impact begins'],['10:24','Operator','Alarm acknowledged','Remote review initiated'],['11:05','History','Prior repair pattern matched','Fan assembly probable cause'],['11:22','Decision','Action generated','Replace fan before peak window']];
function renderEvent(){
 const ev=contextGraphActiveRows('Event Log').slice().sort((a,b)=>String(cgVal(a,['Event_Date_Time'])).localeCompare(String(cgVal(b,['Event_Date_Time'])))).slice(0,8);
 if(ev.length){
   events.splice(0,events.length,...ev.map(r=>[
     String(cgVal(r,['Event_Date_Time'])).slice(11,16)||'--:--',
     String(cgVal(r,['Source_System','Event_Type'])||'Event'),
     String(cgVal(r,['Event_Type','Alarm_Code'])||'Operational event'),
     `${String(cgVal(r,['Severity'])||'')} · ${cgNum(cgVal(r,['Generation_Loss_MWh'])).toFixed(2)} MWh · ${cgMoney(cgNum(cgVal(r,['Revenue_Impact_INR'])))}`
   ]));
 }
 let v=$('#view-eventreconstruction');v.innerHTML=head('MAINTENANCE INTELLIGENCE · CHRONOLOGICAL EVIDENCE CHAIN','Event Reconstruction',`<select class="xi-select"><option>INC-042 · INV-RJ-042</option><option>INC-037 · TRK-MH-118</option></select><button class="xi-btn primary" id="ePlay">Play reconstruction</button>`)+`<div class="xi-grid"><div class="xi-card s7"><div class="timeline" id="eTimeline"></div></div><div class="xi-card s5"><h3>Evidence inspector</h3><div id="eDetail" class="xi-muted">Select or play an event.</div><h3 style="margin-top:15px">Reconstruction result</h3><p><b>Probable initiating condition:</b> cooling fan bearing degradation.</p><p><b>Contributing factors:</b> ambient heat and repeated temporary reset.</p><p><b>Business effect:</b> 0.14 GWh generation at risk.</p><p><b>Confidence:</b> 88.4%</p></div></div>`;drawEvents();$('#ePlay').onclick=()=>{clearInterval(S.play);let i=0;S.play=setInterval(()=>{selectEvent(i++);if(i>=events.length)clearInterval(S.play)},650)}}
function drawEvents(){let t=$('#eTimeline');t.innerHTML=events.map((e,i)=>`<div class="tl-item" data-i="${i}"><b>${e[0]} · ${e[1]}</b><div>${e[2]}</div><span class="xi-muted">${e[3]}</span></div>`).join('');$$('.tl-item',t).forEach(x=>x.onclick=()=>selectEvent(+x.dataset.i))}
function selectEvent(i){$$('.tl-item').forEach((x,j)=>x.classList.toggle('active',j===i));let e=events[i];$('#eDetail').innerHTML=`<span class="xi-pill">${e[1]}</span><h3>${e[0]} · ${e[2]}</h3><p>${e[3]}</p><p><b>Source system:</b> ${e[1]==='Telemetry'?'SCADA historian':e[1]==='Operator'?'Operations log':'AIP evidence service'}</p><button class="xi-btn" onclick="toast('Source evidence opened')">Open source evidence</button>`}
function renderPlan(){let w=contextGraphActiveRows('Work Orders').filter(r=>!/closed|completed/i.test(String(cgVal(r,['Status'])))).sort((a,b)=>({Critical:4,High:3,Medium:2,Low:1}[String(cgVal(b,['Priority']))]||0)-({Critical:4,High:3,Medium:2,Low:1}[String(cgVal(a,['Priority']))]||0)).slice(0,3);let tasks=w.map((r,i)=>[String(i+1),String(cgVal(r,['Description','Asset_Tag'])||'Maintenance intervention'),String(cgVal(r,['Assigned_Crew'])||'Crew pending'),String(cgVal(r,['Asset_Tag'])||cgVal(r,['Asset_ID'])||'Asset'),String(cgVal(r,['SLA_Due'])||'Next window'),String(cgVal(r,['Priority'])||'Medium')]);if(!tasks.length)tasks=[['1','No open interventions','—','—','—','—']];let v=$('#view-resourceplanning');v.innerHTML=head('PLANNING & EXECUTION · CONSTRAINT-AWARE RECOMMENDED PLAN','Resource Planning & Allocation',`<button class="xi-btn" id="pAlt">Generate alternative</button><button class="xi-btn primary" id="pAccept">Accept recommended plan</button>`)+`<div class="xi-kpis" id="pKpis"></div><div class="xi-grid"><div class="xi-card s8"><h3>Recommended plan · drag to reprioritize</h3><div id="pRows">${tasks.map(r=>`<div class="plan-row drag" draggable="true">${r.map(x=>`<div>${x}</div>`).join('')}</div>`).join('')}</div></div><div class="xi-card s4"><h3>Constraints</h3><label>Crew availability <b id="pcv">86%</b></label><input id="pc" class="xi-range" type="range" min="40" max="100" value="86"><label>Spare readiness <b id="psv">79%</b></label><input id="ps" class="xi-range" type="range" min="40" max="100" value="79"><label>Travel capacity <b id="ptv">72%</b></label><input id="pt" class="xi-range" type="range" min="40" max="100" value="72"><div id="pExplain" class="xi-muted"></div></div></div>`;updatePlan();['pc','ps','pt'].forEach(id=>$('#'+id).oninput=updatePlan);let drag;$$('.plan-row').forEach(x=>{x.ondragstart=()=>drag=x;x.ondragover=e=>e.preventDefault();x.ondrop=e=>{e.preventDefault();if(drag!==x)x.parentNode.insertBefore(drag,x);toast('Plan priority updated')}});$('#pAlt').onclick=()=>{let rows=$$('#pRows .plan-row');rows[0].parentNode.append(rows[0]);toast('Alternative plan generated')};$('#pAccept').onclick=()=>toast('Plan accepted and routed for approval')}
function updatePlan(){let c=+$('#pc').value,s=+$('#ps').value,t=+$('#pt').value,ready=(c+s+t)/3;$('#pcv').textContent=c+'%';$('#psv').textContent=s+'%';$('#ptv').textContent=t+'%';$('#pKpis').innerHTML=kpi('Ready interventions',Math.round(18*ready/100),'Constraint adjusted')+kpi('Crew constrained',c<75?'7':'4','Skills and availability')+kpi('Spares constrained',s<75?'6':'3','Stock and lead time')+kpi('Value protected',money(48.2*ready/100),'Recommended plan');$('#pExplain').innerHTML=`Overall execution readiness is <b>${ready.toFixed(1)}%</b>. The plan considers skills, inventory, travel and operational windows.`}
function renderConnector(){
 let v=$('#view-apiconnectors');
 const ce=(value)=>String(value==null?'':value).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]||c));
 const rows=(typeof INTEGRATIONS!=='undefined'&&Array.isArray(INTEGRATIONS)?INTEGRATIONS:[]);
 const fallback=[
  {key:'scada',name:'SCADA',full:'Plant SCADA / RTU network',status:'Connected',freq:'5 sec streaming',latency:'180 ms',lastSync:'just now',throughput:'41,200 tags/min'},
  {key:'historian',name:'Historian',full:'Time-series historian',status:'Connected',freq:'5 min batch/query',latency:'310 ms',lastSync:'2 min ago',throughput:'6.8M rows/day'},
  {key:'erp',name:'ERP',full:'SAP S/4HANA · finance, procurement and asset cost',status:'Connected',freq:'Nightly / governed delta',latency:'1.2 s',lastSync:'6 hr ago',throughput:'3 batch jobs/night'},
  {key:'apm',name:'EAM',full:'IBM Maximo · work orders, PM plans and failure history',status:'Connected',freq:'Bi-directional near real time',latency:'510 ms',lastSync:'1 min ago',throughput:'98 records/hr'},
  {key:'cmms',name:'CMMS',full:'Work-order lifecycle system',status:'Connected',freq:'Event driven / webhook',latency:'290 ms',lastSync:'38 sec ago',throughput:'212 events/day'},
  {key:'gis',name:'GIS',full:'Site layout & geospatial context',status:'Degraded',freq:'Daily',latency:'2.1 s',lastSync:'1 day ago',throughput:'—'},
  {key:'docmgmt',name:'Document Mgmt',full:'O&M manuals, warranty docs, as-builts',status:'Connected',freq:'On demand',latency:'420 ms',lastSync:'12 min ago',throughput:'—'},
  {key:'weather',name:'Weather API',full:'Governed external weather provider layer',status:'Configured',freq:'Daily + hourly near-term',latency:'—',lastSync:'staged demo',throughput:'12 sites/load'}
 ];
 const data=rows.length?rows:fallback;
 const cards=data.map((r,i)=>`<button type="button" class="tf832-connector api209-card" data-apiidx="${i}"><div class="top"><b>${ce(r.name||r.key)}</b><span class="tf832-status ${String(r.status||'Configured').toLowerCase()}">${ce(r.status||'Configured')}</span></div><p>${ce(r.full||'Enterprise connector')}</p><div class="tf832-link">${ce(r.freq||'Governed cadence')}</div></button>`).join('');
 v.innerHTML=head('TECHNOLOGY FOUNDATION · MANAGED ENTERPRISE CONNECTIVITY','API & Connector Management',`<button class="xi-btn primary" id="cTestAll">Test all connections</button>`)+`
 <div class="xi-grid">
  <section class="xi-card s8"><div class="tf832-head"><div><h3>Enterprise connector catalogue</h3><p>Operational and enterprise systems connect through the shared AIP integration fabric. Weather is one connector domain; its provider-specific configuration is managed separately under Weather Integration & Planning Rules.</p></div><span class="tf832-badge">SHARED INTEGRATION FABRIC</span></div><div class="tf832-grid api209-grid">${cards}</div></section>
  <section class="xi-card s4"><h3>Selected connector</h3><div id="api209Detail"></div><div class="tw293-actions"><button class="xi-btn" id="api209Test">Test selected</button></div><h3 style="margin-top:12px">Activity log</h3><div class="log" id="cLog">[06-09-2026 00:30] Connector catalogue loaded\n[06-09-2026 00:29] Integration governance validation passed</div></section>
 </div>`;
 let selected=0;
 function show(){const r=data[selected]||data[0]||{};const d=[['System',r.name||r.key||'Connector'],['Purpose',r.full||'Enterprise integration'],['Status',r.status||'Configured'],['Cadence',r.freq||'Governed cadence'],['Latency',r.latency||'—'],['Last sync',r.lastSync||'—'],['Throughput',r.throughput||'—']];$('#api209Detail').innerHTML=`<div class="po-detail-list">${d.map(x=>`<div class="po-detail"><span>${ce(x[0])}</span><b>${ce(x[1])}</b></div>`).join('')}</div>`;document.querySelectorAll('.api209-card').forEach((b,i)=>b.classList.toggle('selected',i===selected));}
 document.querySelectorAll('.api209-card').forEach((b,i)=>b.onclick=()=>{selected=i;show()});show();
 $('#api209Test').onclick=()=>{const r=data[selected]||{};const log=$('#cLog');log.textContent=`[${new Date().toLocaleTimeString()}] ${r.name||'Connector'}: connection test passed\n`+log.textContent;toast((r.name||'Connector')+' passed')};
 $('#cTestAll').onclick=()=>{data.forEach((r,i)=>setTimeout(()=>{const log=$('#cLog');log.textContent=`[${new Date().toLocaleTimeString()}] ${r.name||'Connector'}: connection test passed\n`+log.textContent},i*120));toast('Enterprise connector tests initiated')};
}

function renderWeatherConnector(){
 let v=$('#view-weatherconfiguration');
 const wxEsc=(value)=>String(value==null?'':value).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c});
 const wxDetailRows=(items)=>`<div class="po-detail-list">${items.map(x=>`<div class="po-detail"><span>${wxEsc(x[0])}</span><b>${wxEsc(x[1])}</b></div>`).join('')}</div>`;
 const providers=[
  {id:'METEOMATICS',name:'Meteomatics',role:'Primary enterprise forecast',source:'Commercial global weather API',iface:'REST API',mode:'Hybrid API + batch',cadence:'Daily + hourly near-term',auth:'API credential / vault',payload:'JSON',target:'AIP Weather Staging',priority:'1',status:'Active'},
  {id:'TOMORROW',name:'Tomorrow.io',role:'Alternate enterprise forecast',source:'Commercial global weather API',iface:'REST API',mode:'API pull',cadence:'Hourly / on demand',auth:'API key / vault',payload:'JSON',target:'AIP Weather Staging',priority:'2',status:'Standby'},
  {id:'GOOGLEWX',name:'Google Weather API',role:'Alternate operational forecast',source:'Commercial global weather API',iface:'REST API',mode:'API pull',cadence:'Hourly / on demand',auth:'API key / service account',payload:'JSON',target:'AIP Weather Staging',priority:'3',status:'Standby'},
  {id:'IMD',name:'India Meteorological Department (IMD)',role:'India authoritative weather source',source:'Government / authoritative India',iface:'REST API / governed batch',mode:'API or batch',cadence:'Configured by available feed',auth:'Credential / approved access',payload:'JSON / CSV',target:'AIP Weather Staging',priority:'4',status:'Configured'},
  {id:'MOSDAC',name:'ISRO MOSDAC',role:'India satellite / observation evidence',source:'Government satellite data',iface:'API / scheduled download',mode:'Batch / scheduled pull',cadence:'Daily / source availability',auth:'Approved access / token',payload:'NetCDF / HDF / CSV',target:'Satellite Observation Staging',priority:'5',status:'Configured'},
  {id:'NASAPOWER',name:'NASA POWER',role:'Solar / meteorological reference',source:'Public scientific reference',iface:'REST API',mode:'Batch / on demand',cadence:'Daily / reference refresh',auth:'Public / governed service access',payload:'JSON / CSV',target:'Climate & Solar Reference Staging',priority:'6',status:'Configured'}
 ];
 const defaults=providers[0];
 const cfgKey='aip.wx.connector.v202';
 let cfg={...defaults,environment:'Demo · governed synthetic payload',protocol:'HTTPS',endpointMode:'Provider endpoint template',fallback:'Tomorrow.io',activation:'Enabled'};
 try{cfg={...cfg,...JSON.parse(localStorage.getItem(cfgKey)||'{}')}}catch(e){}
 const opt=(arr,val)=>arr.map(x=>`<option${x===val?' selected':''}>${x}</option>`).join('');
 const providerOptions=providers.map(p=>`<option value="${p.id}"${p.id===cfg.id?' selected':''}>${p.name}</option>`).join('');
 v.innerHTML=head('TECHNOLOGY FOUNDATION · WEATHER INTEGRATION & GOVERNANCE','Weather Integration & Planning Rules',`<button class="xi-btn" id="wxResetCfg">Reset weather connector</button><button class="xi-btn primary" id="wxSaveCfg">Save configuration</button>`)+`
 <div class="xi-grid">
  <div class="xi-card s12 wx202-catalogue"><div class="wx202-title-row"><div><h3>Weather provider catalogue</h3><small>Approved source types are normalized into AIP weather staging. The demo does not call live external endpoints.</small></div><span class="xi-pill">Provider-agnostic</span></div>
   <div class="wx202-provider-grid">${providers.map(p=>`<button type="button" class="wx202-provider-card ${p.id===cfg.id?'selected':''}" data-provider="${p.id}"><b>${p.name}</b><span>${p.role}</span><em>${p.iface}</em><i>Priority ${p.priority} · ${p.status}</i></button>`).join('')}</div>
  </div>
  <div class="xi-card s8"><div class="wx202-title-row"><div><h3>Weather integration configuration</h3><small>Editable connector settings used by the active governed weather interface.</small></div><span class="xi-pill" id="wxCfgState">${cfg.activation}</span></div>
   <div class="wx202-form">
    <label>Weather provider<select id="wxProvider">${providerOptions}</select></label>
    <label>Provider role<select id="wxRole">${opt(['Primary enterprise forecast','Alternate enterprise forecast','Alternate operational forecast','India authoritative weather source','India satellite / observation evidence','Solar / meteorological reference'],cfg.role)}</select></label>
    <label>Interface type<select id="wxIface">${opt(['REST API','REST API / governed batch','API / scheduled download','SFTP / batch file','Scheduled HTTPS download'],cfg.iface)}</select></label>
    <label>Ingestion mode<select id="wxMode">${opt(['API pull','Batch','Hybrid API + batch','API or batch','Batch / scheduled pull','Batch / on demand'],cfg.mode)}</select></label>
    <label>Refresh cadence<select id="wxCadence">${opt(['Near real time','Hourly','3-hourly','6-hourly','Daily','Daily + hourly near-term','Hourly / on demand','Daily / source availability','Daily / reference refresh','Configured by available feed'],cfg.cadence)}</select></label>
    <label>Authentication<select id="wxAuth">${opt(['API credential / vault','API key / vault','API key / service account','OAuth 2.0','Service account','Credential / approved access','Approved access / token','Public / governed service access'],cfg.auth)}</select></label>
    <label>Payload format<select id="wxPayload">${opt(['JSON','JSON / CSV','CSV','XML','NetCDF / HDF / CSV','GeoTIFF'],cfg.payload)}</select></label>
    <label>Transport<select id="wxProtocol">${opt(['HTTPS','SFTP','HTTPS + SFTP'],cfg.protocol)}</select></label>
    <label>Environment<select id="wxEnvironment">${opt(['Demo · governed synthetic payload','Sandbox / Test','UAT','Production'],cfg.environment)}</select></label>
    <label>Provider priority<select id="wxPriority">${opt(['1','2','3','4','5','6'],String(cfg.priority))}</select></label>
    <label>Fallback provider<select id="wxFallback">${opt(['None','Meteomatics','Tomorrow.io','Google Weather API','India Meteorological Department (IMD)','ISRO MOSDAC','NASA POWER'],cfg.fallback)}</select></label>
    <label>Activation<select id="wxActivation">${opt(['Enabled','Standby','Disabled'],cfg.activation)}</select></label>
    <label class="span2">AIP target dataset<select id="wxTarget">${opt(['AIP Weather Staging','Satellite Observation Staging','Climate & Solar Reference Staging'],cfg.target)}</select></label>
    <label class="span2">Endpoint / delivery profile<select id="wxEndpointMode">${opt(['Provider endpoint template','Customer-managed endpoint','Approved batch landing zone','Demo synthetic connector contract'],cfg.endpointMode)}</select></label>
   </div>
   <div class="wx202-flow"><span>External Provider</span><b>→</b><span>AIP Weather Staging</span><b>→</b><span>Weather Planning Rules</span><b>→</b><span>Low / Moderate / High</span><b>→</b><span>Planning screens</span></div>
   <div class="wx202-note">Weather remains informational in Planning & Optimization. Connector configuration and rule changes do not automatically reschedule interventions or alter resource-capacity calculations.</div>
  </div>
  <div class="xi-card s4"><h3>Active connector state</h3><div id="wxActiveSummary">${wxDetailRows([['Provider',cfg.name],['Role',cfg.role],['Interface',cfg.iface],['Ingestion',cfg.mode],['Cadence',cfg.cadence],['Target',cfg.target],['Priority',cfg.priority],['Fallback',cfg.fallback],['Environment',cfg.environment],['Status',cfg.activation]])}</div><div class="tw293-actions"><button class="xi-btn" id="wxTest">Test configuration</button></div><h3 style="margin-top:12px">Activity log</h3><div class="log" id="cLog">[05-09-2026 06:00] Weather staging refresh completed\n[05-09-2026 05:59] Forecast payload validation passed\n[05-09-2026 05:58] Connector configuration validation passed</div></div>
  <section class="xi-card s12 po-wx-config"><div class="po-wx-config-title"><div><h3>Weather Planning Rules</h3><small>Raw provider values are normalized first, then classified here. Threshold changes recalculate the weather severity shown in Plan & Resources and Intervention Schedule.</small></div><span class="xi-pill">Governed · WX-RULES-v1</span></div>${weatherRulesTable()}</section>
 </div>`;
 function collect(){
  const p=providers.find(x=>x.id===$('#wxProvider').value)||providers[0];
  return {...p,role:$('#wxRole').value,iface:$('#wxIface').value,mode:$('#wxMode').value,cadence:$('#wxCadence').value,auth:$('#wxAuth').value,payload:$('#wxPayload').value,protocol:$('#wxProtocol').value,environment:$('#wxEnvironment').value,priority:$('#wxPriority').value,fallback:$('#wxFallback').value,activation:$('#wxActivation').value,target:$('#wxTarget').value,endpointMode:$('#wxEndpointMode').value};
 }
 function applyProvider(id){
   const p=providers.find(x=>x.id===id)||providers[0];
   $('#wxProvider').value=p.id; $('#wxRole').value=p.role; $('#wxIface').value=p.iface; $('#wxMode').value=p.mode; $('#wxCadence').value=p.cadence; $('#wxAuth').value=p.auth; $('#wxPayload').value=p.payload; $('#wxTarget').value=p.target; $('#wxPriority').value=p.priority;
   document.querySelectorAll('.wx202-provider-card').forEach(x=>x.classList.toggle('selected',x.dataset.provider===p.id));
 }
 document.querySelectorAll('.wx202-provider-card').forEach(b=>b.onclick=()=>applyProvider(b.dataset.provider));
 $('#wxProvider').onchange=()=>applyProvider($('#wxProvider').value);
 $('#wxSaveCfg').onclick=()=>{const x=collect();localStorage.setItem(cfgKey,JSON.stringify(x));toast('Weather connector configuration saved');renderWeatherConnector()};
 $('#wxResetCfg').onclick=()=>{localStorage.removeItem(cfgKey);toast('Weather connector reset to governed default');renderWeatherConnector()};
 $('#wxTest').onclick=()=>{const x=collect(),log=$('#cLog');log.textContent=`[${new Date().toLocaleTimeString()}] ${x.name}: configuration test passed · ${x.iface} · ${x.mode}\n`+log.textContent;toast(x.name+' configuration passed')};
}
function renderDQ(){let src=contextGraphActiveRows('Data Quality Checks');let rules=src.length?src.slice(0,4).map((r,i)=>[String(cgVal(r,['Check'])||('Rule '+(i+1))),Math.max(0,Math.min(100,cgNum(cgVal(r,['Result']))||95)),String(cgVal(r,['Status'])||'Healthy'),Math.max(0,Math.round(100-(cgNum(cgVal(r,['Result']))||95))) ]):[['Asset master completeness',97.8,'Healthy',18],['Telemetry freshness',99.2,'Healthy',7],['Work-order linkage',91.6,'Watch',63],['Warranty serial mapping',86.4,'Improve',128]];let v=$('#view-dataquality');v.innerHTML=head('TECHNOLOGY FOUNDATION · TRUSTED DATA OPERATIONS','Data Quality & Observability',`<button class="xi-btn" id="dqRun">Run quality checks</button><button class="xi-btn primary" id="dqExport">Export exceptions</button>`)+`<div class="xi-kpis">${kpi('Quality score','93.7%','Across active domains')}${kpi('Open exceptions','216','Prioritized by impact')}${kpi('Freshness SLA','99.2%','Telemetry feeds')}${kpi('Lineage coverage','94.1%','Field-level')}</div><div class="xi-grid"><div class="xi-card s8"><h3>Quality rules</h3><table class="xi-table"><thead><tr><th>Rule</th><th>Score</th><th>Status</th><th>Exceptions</th></tr></thead><tbody>${rules.map((r,i)=>`<tr onclick="openDQ(${i})" style="cursor:pointer"><td>${r[0]}</td><td>${r[1]}%</td><td><span class="xi-pill">${r[2]}</span></td><td>${r[3]}</td></tr>`).join('')}</tbody></table></div><div class="xi-card s4"><h3>Observability stream</h3><div class="log" id="dqLog">12:44 Telemetry freshness check passed\n12:43 3 work-order linkage exceptions added\n12:40 Asset-master completeness improved +0.2%</div></div></div>`;$('#dqRun').onclick=()=>{rules.forEach(r=>r[1]=Math.min(100,r[1]+.1));$('#dqLog').textContent=`${new Date().toLocaleTimeString()} Quality checks completed\n`+$('#dqLog').textContent;toast('Quality checks completed')};$('#dqExport').onclick=()=>toast('Exception report prepared')}
window.openDQ=i=>openDrawer(`<h2>Data-quality investigation</h2><span class="xi-pill">Rule ${i+1}</span><p><b>Sample exception:</b> WO-8841 is not linked to a failure-mode record.</p><p><b>Business impact:</b> decision confidence reduced by 4.2 points.</p><h3>Lineage</h3><p>SAP Work Order → Integration Mapping → Context Graph → Decision Workspace</p><button class="xi-btn primary" onclick="toast('Remediation assigned')">Assign remediation</button>`);
function renderSecurity(){let v=$('#view-securityaudit');v.innerHTML=head('TECHNOLOGY FOUNDATION · CONTROLLED ACCESS AND TRACEABILITY','Security, Roles & Audit',`<button class="xi-btn primary" onclick="toast('New role workflow opened')">Create role</button>`)+`<div class="xi-kpis">${kpi('Active users','64','Across 7 roles')}${kpi('Privileged roles','4','Quarterly review')}${kpi('Audit events','1,842','Last 30 days')}${kpi('Open exceptions','3','No critical issues')}</div><div class="xi-grid"><div class="xi-card s7"><h3>Role and authority matrix</h3><table class="xi-table"><thead><tr><th>Role</th><th>Scope</th><th>Decision authority</th></tr></thead><tbody><tr><td>Portfolio Executive</td><td>All sites and financial impact</td><td>Approve above ₹10 lakh</td></tr><tr><td>Reliability Engineer</td><td>Asset and model evidence</td><td>Recommend</td></tr><tr><td>Maintenance Planner</td><td>Plans, crews and spares</td><td>Create / update</td></tr><tr><td>Platform Administrator</td><td>Integration, models and audit</td><td>Admin</td></tr></tbody></table></div><div class="xi-card s5"><h3>Audit explorer</h3><select class="xi-select"><option>All event types</option><option>Decision actions</option><option>Data changes</option><option>Access events</option></select><div class="log" style="margin-top:9px">12:41 D-208 evidence viewed by r.engineer\n12:34 Connector config changed by platform.admin\n12:22 Scenario S-104 saved by planner.03\n11:58 Model confidence threshold updated</div></div></div>`}
const ORR_DATA={
 synthetic:{index:76.4,priorDelta:2.8,residualFactor:.69,downtimeAvoided:11.6,risks:[
{id:'OR-S01',site:'Surya Nagar Solar Park',asset:'INV-001',risk:'Central inverter cooling degradation',category:'Asset reliability',likelihood:5,impact:5,exposure:38,trend:'Rising',gap:'Critical spare unavailable',action:'Replace fan assemblies and stage one complete cooling kit',owner:'Reliability Lead',due:'12 Aug 2026',progress:62,status:'In progress',source:'Predictive Maintenance'},
{id:'OR-S02',site:'Aravali Solar Park',asset:'TR-01',risk:'Main transformer insulation degradation',category:'Single-point failure',likelihood:4,impact:5,exposure:62,trend:'Rising',gap:'No backup transformer agreement',action:'Approve emergency transformer-sharing agreement and oil diagnostics',owner:'Asset Director',due:'18 Aug 2026',progress:35,status:'Approval required',source:'Reliability Engineering'},
{id:'OR-S03',site:'Kaveri Solar Park',asset:'TRK-B04',risk:'Tracker common-mode gearbox defect',category:'Common-mode failure',likelihood:4,impact:3,exposure:19,trend:'Stable',gap:'Campaign crew capacity constrained',action:'Launch block replacement campaign during low-irradiance window',owner:'O&M Manager',due:'24 Aug 2026',progress:48,status:'Scheduled',source:'RCM Framework'},
{id:'OR-S04',site:'Vindhya Solar Park',asset:'SCB-118',risk:'Combiner thermal hotspot escalation',category:'Safety and continuity',likelihood:3,impact:5,exposure:27,trend:'Rising',gap:'Thermal inspection interval too long',action:'Advance thermal inspection and replace affected connectors',owner:'HSE Lead',due:'09 Aug 2026',progress:75,status:'In progress',source:'AI Vision'},
{id:'OR-S05',site:'Desert Bloom Solar Park',asset:'GRID-01',risk:'Grid evacuation dependency',category:'External dependency',likelihood:3,impact:4,exposure:31,trend:'Stable',gap:'Limited alternate evacuation readiness',action:'Validate contingency curtailment and restoration protocol',owner:'Grid Operations',due:'30 Aug 2026',progress:22,status:'Open',source:'Operational Twin'},
{id:'OR-S06',site:'Narmada Solar Park',asset:'INV-014',risk:'Long OEM response and repair lead time',category:'Recovery readiness',likelihood:2,impact:4,exposure:14,trend:'Improving',gap:'Specialist crew mobilisation > 48 hours',action:'Establish regional specialist support roster',owner:'Resource Planner',due:'05 Sep 2026',progress:54,status:'In progress',source:'Resource Planning & Allocation'},
{id:'OR-S07',site:'Surya Nagar Solar Park',asset:'FIRE-Z03',risk:'DC connector fire propagation exposure',category:'Safety and continuity',likelihood:2,impact:5,exposure:44,trend:'Improving',gap:'Zone isolation drill overdue',action:'Complete isolation drill and targeted connector replacement',owner:'Site Head',due:'14 Aug 2026',progress:81,status:'In progress',source:'HSE & Compliance'},
{id:'OR-S08',site:'Kaveri Solar Park',asset:'SPARES',risk:'Inverter control-card stockout',category:'Recovery readiness',likelihood:4,impact:2,exposure:12,trend:'Rising',gap:'Stock below governed minimum',action:'Rebalance two control cards from low-risk sites',owner:'Inventory Manager',due:'08 Aug 2026',progress:40,status:'Open',source:'Spares Planning & Inventory'}]},
 excel:{index:82.1,priorDelta:1.4,residualFactor:.61,downtimeAvoided:8.3,risks:[
{id:'OR-X01',site:'Surya Nagar Solar Park',asset:'INV-006',risk:'Recurring inverter thermal derating',category:'Asset reliability',likelihood:4,impact:4,exposure:29,trend:'Improving',gap:'Cooling-kit stock below minimum',action:'Reserve cooling kit and complete fan-current validation',owner:'Reliability Lead',due:'11 Aug 2026',progress:78,status:'In progress',source:'Predictive Maintenance'},
{id:'OR-X02',site:'Aravali Solar Park',asset:'TR-02',risk:'Transformer oil quality deterioration',category:'Single-point failure',likelihood:3,impact:5,exposure:47,trend:'Stable',gap:'Backup transformer mobilisation > 72 hours',action:'Complete dissolved-gas analysis and secure standby logistics',owner:'Asset Director',due:'21 Aug 2026',progress:58,status:'Scheduled',source:'Reliability Engineering'},
{id:'OR-X03',site:'Vindhya Solar Park',asset:'SCB-044',risk:'Repeated combiner connector heating',category:'Safety and continuity',likelihood:3,impact:4,exposure:21,trend:'Rising',gap:'Inspection backlog at affected block',action:'Close thermal-inspection backlog and replace suspect connectors',owner:'HSE Lead',due:'10 Aug 2026',progress:66,status:'In progress',source:'AI Vision'},
{id:'OR-X04',site:'Narmada Solar Park',asset:'INV-022',risk:'OEM specialist response delay',category:'Recovery readiness',likelihood:2,impact:3,exposure:11,trend:'Improving',gap:'Regional specialist coverage incomplete',action:'Activate regional support roster and remote-diagnostic protocol',owner:'Resource Planner',due:'28 Aug 2026',progress:72,status:'In progress',source:'Resource Planning & Allocation'},
{id:'OR-X05',site:'Kaveri Solar Park',asset:'TRK-C11',risk:'Tracker actuator repeat failure cluster',category:'Common-mode failure',likelihood:3,impact:3,exposure:16,trend:'Stable',gap:'Campaign window not yet approved',action:'Approve grouped actuator replacement during low-generation window',owner:'O&M Manager',due:'26 Aug 2026',progress:44,status:'Approval required',source:'RCM Framework'},
{id:'OR-X06',site:'Desert Bloom Solar Park',asset:'GRID-01',risk:'Grid-restoration dependency',category:'External dependency',likelihood:2,impact:4,exposure:24,trend:'Stable',gap:'Restoration drill evidence incomplete',action:'Run joint restoration drill and close evidence gaps',owner:'Grid Operations',due:'02 Sep 2026',progress:51,status:'Open',source:'Operational Twin'}]}
};
let ORR_STATE={likelihood:0,impact:0,selected:'',gap:'All',modeKey:''};
function orrModeKey(){let m='';try{m=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:(window.APM_DATA_MODE||''))}catch(_){m=String(window.APM_DATA_MODE||'')}return /excel|upload/i.test(m)?'excel':'synthetic'}
function orrDataset(){return ORR_DATA[orrModeKey()]}
function orrRisks(){return orrDataset().risks}
function orrEnsureState(){let key=orrModeKey(),risks=orrRisks();if(ORR_STATE.modeKey!==key){ORR_STATE.modeKey=key;ORR_STATE.likelihood=0;ORR_STATE.impact=0;ORR_STATE.gap='All';ORR_STATE.selected=risks[0]?.id||''}if(!risks.some(r=>r.id===ORR_STATE.selected))ORR_STATE.selected=risks[0]?.id||''}
function orrBand(r){let s=r.likelihood*r.impact;return s>=20?'Critical':s>=12?'High':s>=6?'Moderate':'Low'}
function orrFiltered(){let risks=orrRisks();return risks.filter(r=>(!ORR_STATE.likelihood||r.likelihood===ORR_STATE.likelihood)&&(!ORR_STATE.impact||r.impact===ORR_STATE.impact)&&(ORR_STATE.gap==='All'||r.gap===ORR_STATE.gap))}
function orrSetCell(l,i){ORR_STATE.likelihood=l;ORR_STATE.impact=i;renderRisk()}
function orrClear(){ORR_STATE.likelihood=0;ORR_STATE.impact=0;ORR_STATE.gap='All';renderRisk()}
function orrSelect(id){ORR_STATE.selected=id;renderRisk()}
function orrGap(g){ORR_STATE.gap=g;ORR_STATE.likelihood=0;ORR_STATE.impact=0;renderRisk()}
function orrOpenSource(){let r=orrRisks().find(x=>x.id===ORR_STATE.selected);let map={'Predictive Maintenance':'predictive','Reliability Engineering':'reliabilityengineering','RCM Framework':'rcm','AI Vision':'aivision','Operational Twin':'operationaltwin','Resource Planning & Allocation':'resourceplanning','HSE & Compliance':'hseclimate','Spares Planning & Inventory':'spares'};if(r&&map[r.source]) openView(map[r.source]);}
function renderRisk(){
 orrEnsureState();
 let v=$('#view-reliabilityrisk'),dataset=orrDataset(),risks=orrRisks();
 let rows=orrFiltered();
 let selected=risks.find(x=>x.id===ORR_STATE.selected)||risks[0];
 let exposure=risks.reduce((a,r)=>a+r.exposure,0), residual=Math.round(exposure*dataset.residualFactor), reduction=Math.round((1-residual/exposure)*1000)/10;
 let critical=risks.filter(r=>orrBand(r)==='Critical').length, readiness=Math.round(risks.reduce((a,r)=>a+r.progress,0)/risks.length);
 let gaps=[...new Set(risks.map(r=>r.gap))];
 let matrix=''; for(let impact=5;impact>=1;impact--){for(let likelihood=1;likelihood<=5;likelihood++){let count=risks.filter(r=>r.likelihood===likelihood&&r.impact===impact).length;let score=likelihood*impact;let cls=score>=20?'orr-critical':score>=12?'orr-high':score>=6?'orr-medium':'orr-low';let active=ORR_STATE.likelihood===likelihood&&ORR_STATE.impact===impact?' active':'';matrix+=`<button class="orr-cell ${cls}${active}" onclick="orrSetCell(${likelihood},${impact})" title="Likelihood ${likelihood}, impact ${impact}"><span>${count||''}</span><small>${score}</small></button>`}}
 v.innerHTML=head('','Operational Risk & Resilience',`<button class="xi-btn" onclick="orrClear()">Reset analysis</button><button class="xi-btn primary" onclick="document.getElementById('orr-actions').scrollIntoView({behavior:'smooth'})">View mitigation actions</button>`)+
 `<div class="xi-kpis orr-kpis">${kpi('Operational resilience index',dataset.index.toFixed(1),'↑ '+dataset.priorDelta.toFixed(1)+' points vs prior quarter')}${kpi('Critical operational risks',String(critical),'Likelihood × consequence')}${kpi('Gross exposure','₹'+exposure+' lakh','Probability-weighted')}${kpi('Risk reduction outlook',reduction.toFixed(1)+'%','After approved actions')}${kpi('Execution readiness',readiness+'%','Mitigation progress')}</div>
 <div class="orr-layout">
  <section class="xi-card orr-matrix-card"><div class="orr-section-head"><h3>Interactive risk matrix</h3><span>${rows.length} risk${rows.length===1?'':'s'} in current view</span></div><div class="orr-axis-label impact">CONSEQUENCE →</div><div class="orr-matrix">${matrix}</div><div class="orr-axis-label likelihood">LIKELIHOOD →</div><div class="orr-legend"><span><i class="orr-low"></i>Low</span><span><i class="orr-medium"></i>Moderate</span><span><i class="orr-high"></i>High</span><span><i class="orr-critical"></i>Critical</span></div></section>
  <section class="xi-card orr-outlook"><div class="orr-section-head"><h3>Risk reduction outlook</h3><span>₹ lakh</span></div><div class="orr-gauge"><div class="orr-gauge-value">${reduction.toFixed(1)}%</div><div class="orr-gauge-label">exposure reduction</div></div><div class="orr-bars"><div><label>Current exposure <b>₹${exposure}L</b></label><span><i style="width:100%"></i></span></div><div><label>After approved actions <b>₹${residual}L</b></label><span><i style="width:${Math.round(residual/exposure*100)}%"></i></span></div></div><div class="orr-mini-metrics"><div><b>₹${exposure-residual}L</b><span>Exposure addressed</span></div><div><b>${dataset.downtimeAvoided.toFixed(1)} days</b><span>Downtime avoided</span></div></div></section>
 </div>
 <div class="xi-grid">
  <section class="xi-card s8"><div class="orr-section-head"><h3>Top operational risks</h3><span>Click a row to inspect and act</span></div><div class="orr-table-wrap"><table class="orr-table"><thead><tr><th>Risk</th><th>Site / asset</th><th>Band</th><th>Exposure</th><th>Trend</th><th>Status</th></tr></thead><tbody>${rows.slice().sort((a,b)=>b.likelihood*b.impact-a.likelihood*a.impact).map(r=>`<tr class="${selected.id===r.id?'selected':''}" onclick="orrSelect('${r.id}')"><td><b>${r.risk}</b><small>${r.category}</small></td><td>${r.site}<small>${r.asset}</small></td><td><span class="orr-pill ${orrBand(r).toLowerCase()}">${orrBand(r)}</span></td><td>₹${r.exposure}L</td><td><span class="orr-trend ${r.trend.toLowerCase()}">${r.trend==='Rising'?'↑':r.trend==='Improving'?'↓':'→'} ${r.trend}</span></td><td>${r.status}</td></tr>`).join('')||'<tr><td colspan="6" class="xi-muted">No risks match this matrix cell or resilience-gap filter.</td></tr>'}</tbody></table></div></section>
  <section class="xi-card s4 orr-detail"><div class="orr-section-head"><h3>Selected risk</h3><span>${selected.id}</span></div><h2>${selected.risk}</h2><div class="orr-detail-grid"><div><span>Likelihood</span><b>${selected.likelihood}/5</b></div><div><span>Consequence</span><b>${selected.impact}/5</b></div><div><span>Exposure</span><b>₹${selected.exposure}L</b></div><div><span>Trend</span><b>${selected.trend}</b></div></div><div class="orr-evidence"><span>Resilience gap</span><b>${selected.gap}</b></div><div class="orr-evidence"><span>Recommended mitigation</span><b>${selected.action}</b></div><button class="xi-btn primary orr-full" onclick="orrOpenSource()">Open source analysis · ${selected.source}</button></section>
 </div>
 <div class="xi-grid" id="orr-actions">
  <section class="xi-card s4"><div class="orr-section-head"><h3>Resilience gaps</h3><span>Filter risks</span></div><div class="orr-gap-list"><button class="${ORR_STATE.gap==='All'?'active':''}" onclick="orrGap('All')"><b>All gaps</b><span>${risks.length}</span></button>${gaps.map(g=>`<button class="${ORR_STATE.gap===g?'active':''}" onclick="orrGap(${JSON.stringify(g)})"><b>${g}</b><span>${risks.filter(r=>r.gap===g).length}</span></button>`).join('')}</div></section>
  <section class="xi-card s8"><div class="orr-section-head"><h3>Priority mitigation actions</h3><span>Execution-linked, not a duplicate work-order list</span></div><div class="orr-actions">${risks.slice().sort((a,b)=>b.exposure-a.exposure).slice(0,5).map(r=>`<article onclick="orrSelect('${r.id}')"><div class="orr-action-top"><b>${r.action}</b><span>${r.progress}%</span></div><div class="orr-progress"><i style="width:${r.progress}%"></i></div><div class="orr-action-meta"><span>${r.owner}</span><span>Due ${r.due}</span><span>${r.status}</span><span>₹${r.exposure}L exposure</span></div></article>`).join('')}</div></section>
 </div>`;
}
const R={contextgraph:renderGraph,operationaltwin:renderTwin,twinfoundation:renderTwinFoundation,decisionworkspace:renderDecision,scenariosimulator2:renderScenario,eventreconstruction:renderEvent,resourceplanning:renderPlan,apiconnectors:renderConnector,weatherconfiguration:renderWeatherConnector,dataquality:function(){return window.renderDQ()},securityaudit:renderSecurity,reliabilityrisk:renderRisk};
const SOURCE_DEPENDENT_CUSTOM=new Set(['contextgraph','operationaltwin','decisionworkspace','scenariosimulator2','eventreconstruction','resourceplanning','dataquality','reliabilityrisk']);
document.addEventListener('aip:data-source-changed',function(){
 const active=document.querySelector('.view.active[id^="view-"]')?.id.replace('view-','');
 if(active&&SOURCE_DEPENDENT_CUSTOM.has(active)&&typeof R[active]==='function'){
   if(active==='contextgraph') window.AIP_CONTEXT_GRAPH_ISSUE='';
   requestAnimationFrame(()=>{try{R[active]()}catch(e){console.error('Source refresh failed',active,e)}});
 }
});
function open(view){$$('.view').forEach(x=>x.classList.remove('active'));$$('#sidebar .nav-item').forEach(x=>x.classList.remove('active'));let n=$(`#sidebar .nav-item[data-view="${view}"]`),v=$('#view-'+view);n?.classList.add('active');let g=n?.closest('.x-nav-group');g?.classList.add('open');g?.querySelector('.x-nav-head')?.setAttribute('aria-expanded','true');if(g)g.querySelector('.x-nav-icon').textContent='−';v?.classList.add('active');try{R[view]?.()}catch(e){console.error(e);if(v)v.innerHTML=head('RECOVERY','Screen error')+'<div class="xi-card">'+e.message+'</div>'}$('#main')?.scrollTo(0,0)}
document.addEventListener('click',e=>{let h=e.target.closest('.x-nav-head');if(h){let g=h.closest('.x-nav-group'),o=g.classList.toggle('open');h.setAttribute('aria-expanded',o);$('.x-nav-icon',h).textContent=o?'−':'+';return}let n=e.target.closest('#sidebar .nav-item[data-view]');if(!n)return;let view=n.dataset.view;if(CUSTOM.has(view)){e.preventDefault();e.stopImmediatePropagation();open(view)}else{n.closest('.x-nav-group')?.classList.add('open');setTimeout(()=>$$('#sidebar .nav-item').forEach(x=>x.classList.toggle('active',x===n)),0)}},true);window.toast=toast;window.AIP_V21={open,state:S,renderers:R};})();