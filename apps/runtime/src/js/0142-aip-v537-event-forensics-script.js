(function(){
const DB=__AIP_DS("faba36446348d4bc");let S={id:null,node:0,pos:0,timer:null,speed:1};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mode=()=>{let m=String(window.APM_DATA_MODE||window.DATA_MODE||'').toLowerCase();return(window.AIP_SYNTHETIC_ACTIVE===true||m.includes('synthetic')||m.includes('demo'))?'synthetic':'excel'};
const d=()=>DB[mode()]||DB.excel, list=(k,id)=>d()[k].filter(r=>r.Incident_ID===id), get=id=>d().incidents.find(r=>r.Incident_ID===id)||d().incidents[0], iv=id=>d().intervention.find(r=>r.Incident_ID===id)||{};
const money=v=>'₹'+new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(Number(v||0)/100000)+'L';
const pt=v=>{let x=Date.parse(String(v||'').replace(' ','T'));return Number.isFinite(x)?x:NaN};
function bars(c){return `<div class="er-mini" style="--c:${c}"><i style="height:4px"></i><i style="height:8px"></i><i style="height:6px"></i><i style="height:11px"></i><i style="height:7px"></i><i style="height:10px"></i></div>`}
function kpi(l,v,n,c){return `<div class="er-kpi"><label>${esc(l)}</label><strong>${v}</strong><small>${esc(n)}</small>${bars(c)}</div>`}
function cls(l){l=String(l).toLowerCase();if(l.includes('telemetry'))return'telemetry';if(l.includes('ai'))return'ai';if(l.includes('scada'))return'scada';if(l.includes('maintenance'))return'maintenance';if(l.includes('business'))return'business';if(l.includes('operation'))return'operations';return'decision'}
function render(){let v=document.getElementById('view-eventreconstruction');if(!v)return;let a=d().incidents;
let locked=window.__ER_LOCKED_INCIDENT;
if(locked&&a.some(x=>x.Incident_ID===locked))S.id=locked;
else if(!S.id||!a.some(x=>x.Incident_ID===S.id))S.id=a[0].Incident_ID;let x=get(S.id),it=iv(S.id),crit=a.filter(z=>z.Severity==='Critical').length,val=a.reduce((s,z)=>s+Number(z.Value_at_Stake_INR||0),0),opp=a.filter(z=>Number(iv(z.Incident_ID).Actionable_Window_Hours||0)>0).length;
v.innerHTML=`<div class="view-head"><div><h1>Reliability Engineering</h1></div></div>
<div class="er-kpis">${kpi('Qualified Incidents',a.length,'P1/P2 reconstruction set','#2f7d9f')}${kpi('Critical Incidents',crit,'Automatic reconstruction','#b44942')}${kpi('Value / Exposure',money(val),'Across qualified incidents','#855fa8')}${kpi('Intervention Opportunities',opp,'Actionable windows found','#2b8560')}</div>
<div class="er-incidents">${a.map(z=>`<div class="er-inc ${z.Incident_ID===x.Incident_ID?'active':''}" onclick="erSelectIncident('${z.Incident_ID}')"><em class="${z.Severity.toLowerCase()}">${esc(z.Severity)} · ${esc(z.Qualification)}</em><b>${esc(z.Incident_Type)}</b><span>${esc(z.Plant_ID)} · ${esc(z.Asset_Tag)}<br>${esc(z.Impact_Text)}</span></div>`).join('')}</div>
<div class="er-titlebar"><div><div class="er-title">${esc(x.Incident_ID)} · ${esc(x.Asset_Tag)} · ${esc(x.Incident_Type)}</div><div class="er-meta">${esc(x.Plant_Name)} · Evidence confidence ${Number(x.Evidence_Confidence_Pct||0).toFixed(2)}%</div></div><div class="er-actions"><button class="er-btn primary" onclick="erReplay()">▶ Replay</button><button class="er-btn" onclick="erPause()">Pause</button><button class="er-btn" onclick="erSpeed()">Speed <span id="erSp">${S.speed}×</span></button><button class="er-btn" onclick="erReset()">Reset</button></div></div>
<section class="er-panel er-asset-panel er-asset-panel-clean"><div id="erAssetMap" class="er-assetmap"></div></section><div class="er-grid"><div><section class="er-panel er-forensic-replay-panel"><div class="er-head er-replay-head"><h3>Forensic replay · synchronized evidence lanes</h3></div><div id="erLiveConsole" class="er-live-console er-console-t0">
  <div class="er-live-main">
    
    <div id="erLiveSnapshot" class="er-live-snapshot"></div>
    <div id="erTimeline" class="er-timeline"></div>
    <div id="erStageRibbon" class="er-stage-ribbon"></div>
  </div>
  <aside class="er-live-inspector">
    <div class="er-live-inspector-head"><b>Live Evidence Inspector</b></div>
    <div id="erLiveInspectorBody"></div>
  </aside>
</div></section><div class="er-bottom er-bottom-single"><section id="erMilestonePanel" class="er-panel er-milestone-panel er-milestone-hidden"><div class="er-head"><h3>Intervention logic & response gap</h3></div><div id="erMilestones" class="er-milestones"></div></section></div></div>
<div><section class="er-panel er-governance-panel"><div class="er-head"><h3>Evidence governance & traceability</h3></div><div class="er-gov-actions"><button class="er-gov-btn lineage" onclick="erToggleGovernance('lineage')"><b>View Lineage</b><span>Where did this evidence come from?</span></button><button class="er-gov-btn trace" onclick="erToggleGovernance('trace')"><b>Trace Across AIP →</b><span>Where did this evidence drive decisions and actions?</span></button></div><div id="erGovernanceDetail" class="er-governance-detail"></div></section><section class="er-panel" style="margin-top:8px"><div class="er-head"><h3>Impact Summary</h3></div><div id="erImpact"></div></section></div></div>
<div class="er-back" onclick="erCloseRegister()"></div><div class="er-register"><div class="er-head"><h3>Qualified Incident Register</h3><div class="er-actions"><input id="erQ" class="er-search" placeholder="Search incident, site, asset..." oninput="erRenderRegister()"><select id="erSev" class="er-select" onchange="erRenderRegister()"><option>All</option><option>Critical</option><option>High</option></select><button class="er-btn" onclick="erCloseRegister()">Close</button></div></div><div id="erReg"></div></div>`;
draw();try{window.applyMaintenanceGroupingSubtabs?.('eventreconstruction')}catch(_){}}
function timeline(){
 let e=document.getElementById('erTimeline'),all=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence),
 timed=all.filter(x=>Number.isFinite(pt(x.Timestamp))),sel=(S.selectedNode??S.node??0),
 lanes=['Telemetry','AI / Model','SCADA / Alarms','Operations','Maintenance','Decision / Governance','Business Impact'];
 if(!timed.length){e.innerHTML='<div class="er-meta" style="padding:20px">No timestamped forensic events for this incident.</div>';return}
 let ts=timed.map(x=>pt(x.Timestamp)),mn=Math.min(...ts),mx=Math.max(...ts);if(mx<=mn)mx=mn+3600000;
 let span=mx-mn, frac=x=>(pt(x.Timestamp)-mn)/span, left=f=>`calc(128px + (100% - 146px) * ${Math.max(0,Math.min(1,f))})`,
 fmt=t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),h='<div class="er-axis">';
 for(let i=0;i<5;i++){let f=i/4,t=mn+span*f;h+=`<span class="er-tick er-time-hidden" data-er-time-frac="${f}" style="left:${left(f)}">${fmt(t)}</span>`}h+='</div>';
 lanes.forEach((l,i)=>{let y=36+i*23;h+=`<div class="er-line" style="top:${y}px"></div>`});
 all.forEach((x,i)=>{if(!Number.isFinite(pt(x.Timestamp)))return;let y=36+Math.max(0,lanes.indexOf(x.Lane))*23,f=frac(x);h+=`<button class="er-node ${cls(x.Lane)} ${i===sel?'selected':''}" data-er-event-index="${i}" style="left:${left(f)};top:${y}px" onclick="erSelectNode(${i})"></button><div class="er-ntext" data-er-event-index="${i}" style="left:${left(f)};top:${y+7}px">${esc(x.Event_Label)}</div>`});
 let it=iv(S.id),maint=timed.find(x=>x.Lane==='Maintenance'),windowStart=timed.find(x=>x.Lane==='AI / Model')||timed[0];
 h+=`<div id="erReplayClock" class="er-replay-label er-clock-hidden"></div><div id="erDynamicWindow" class="er-window er-window-hidden"></div><div id="erDynamicWindowLabel" class="er-wlabel er-window-label-hidden"></div><div id="erCursor" class="er-cursor" style="left:${left(0)}"></div>`;
 let untimed=all.length-timed.length;if(untimed)h+=`<div class="er-untimed-note">${untimed} governed/post-event evidence item${untimed>1?'s':''} excluded from the time axis</div>`;
 e.innerHTML=h;e.dataset.erMin=mn;e.dataset.erMax=mx;e.dataset.erSpan=span
}
function trend(){let e=document.getElementById('erTrend'),p=(d().multi_telemetry||[]).filter(x=>x.Incident_ID===S.id);if(!p.length)p=list('telemetry',S.id);if(!p.length){p=list('timeline',S.id).map(x=>({Timestamp:x.Timestamp,Generation_Loss_MWh:Number((String(x.Detail).match(/([0-9.]+)\s*MWh/)||[])[1]||0)}))}if(!p.length){e.innerHTML='<span class="er-meta">No time-series evidence linked.</span>';return}p=p.slice().sort((a,b)=>pt(a.Timestamp)-pt(b.Timestamp));let W=520,H=100,P=20,ht=p.some(x=>x.HeatSink_Temp_C!=null),hp=p.some(x=>x.AC_Power_kW!=null),v1=p.map(x=>Number(ht?x.HeatSink_Temp_C:x.Generation_Loss_MWh||0)),v2=p.map(x=>Number(hp?x.AC_Power_kW:0));function line(v){let mn=Math.min(...v),mx=Math.max(...v);if(mx===mn)mx=mn+1;return v.map((n,i)=>`${i?'L':'M'}${P+(W-2*P)*i/Math.max(1,v.length-1)},${H-P-(H-2*P)*(n-mn)/(mx-mn)}`).join(' ')}let s=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;[25,50,75].forEach(y=>s+=`<line class="gridline" x1="${P}" y1="${y}" x2="${W-P}" y2="${y}"/>`);s+=`<path class="${ht?'temp':'loss'}" d="${line(v1)}"/>`;if(hp)s+=`<path class="power" d="${line(v2)}"/>`;s+=`<text x="20" y="9" font-size="7" fill="#6d828c">${ht?'Heat sink temperature':'Generation loss'}</text>${hp?'<text x="400" y="9" font-size="7" fill="#6d828c">AC power</text>':''}</svg>`;e.innerHTML=s}
function chain(){
 let e=document.getElementById('erChain'),r=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence).slice(0,7),
 sel=(S.selectedNode??S.node??0),cur=(S.replayNode??-1),playing=!!S.timer;
 e.innerHTML=r.map((x,i)=>`${i?'<span class="er-arr">›</span>':''}<div class="${i===sel?'selected ':''}${playing?(i<cur?'replay-done':i===cur?'replay-now':'replay-future'):''}" onclick="erSelectNode(${i})"><b>${esc(x.Event_Label)}</b><span>${esc(x.Evidence_Type)} · ${esc(x.Source_Record_ID)}</span><span>${x.Confidence_Pct!=null?Number(x.Confidence_Pct).toFixed(2)+'% confidence':''}</span></div>`).join('')
}
function response(){let e=document.getElementById('erResponse'),r=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence),first=l=>r.find(x=>x.Lane===l),ai=first('AI / Model'),ma=first('Maintenance'),de=first('Decision / Governance'),bi=first('Business Impact'),detect=ai||r[0],interpret=r.find(x=>/interpret|diagnos|reconstruct|analy/i.test((x.Event_Label||'')+' '+(x.Detail||'')))||ai||r[1]||detect,decide=de||interpret,act=ma||decide,verify=bi||r[r.length-1]||act,mins=(a,b)=>{let x=pt(a?.Timestamp),y=pt(b?.Timestamp);return Number.isFinite(x)&&Number.isFinite(y)?Math.max(0,Math.round((y-x)/60000)):null},a=[['DETECT',detect?'ok':'bad','Evidence captured',null],['INTERPRET',interpret?'ok':'bad','Evidence linked',mins(detect,interpret)],['DECIDE',de?'warn':'ok',de?'Decision evidence':'No decision gate',mins(interpret,decide)],['ACT',ma?'ok':'bad',ma?'Work response':'Action gap',mins(decide,act)],['VERIFY',bi?'warn':'ok',bi?'Impact monitored':'Evidence complete',mins(act,verify)]],g=a.slice(1).map((x,i)=>({name:a[i][0]+' → '+x[0],m:x[3]})).filter(x=>x.m!=null).sort((a,b)=>b.m-a.m)[0];e.innerHTML=a.map(x=>`<div class="er-stage ${x[1]}"><b>${x[0]}</b><strong>${x[3]!=null?x[3]+' min':'—'}</strong><span>${x[2]}</span></div>`).join('')+(g?`<div class="er-delay">Largest response interval · <b>${g.name}</b> · ${g.m} min</div>`:'')}
function inspect(i){let e=document.getElementById('erInspector');if(!e)return;let r=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence);if(!r.length)return;S.node=Math.min(i,r.length-1);let x=r[S.node];e.innerHTML=`<span class="er-pill">${esc(x.Evidence_Type)}</span><span class="er-pill">${esc(x.Lane)}</span><div class="er-etitle">${esc(x.Event_Label)}</div><div class="er-fact"><span>Evidence ID</span><b>${esc(x.Evidence_ID)}</b></div><div class="er-fact"><span>Timestamp</span><b>${esc(x.Timestamp||'Current governed state')}</b></div><div class="er-fact"><span>Source module</span><b>${esc(x.Source_Module)}</b></div><div class="er-fact"><span>Source record</span><b>${esc(x.Source_Record_ID)}</b></div><div class="er-fact"><span>Confidence</span><b>${x.Confidence_Pct!=null?Number(x.Confidence_Pct).toFixed(2)+'%':'Observed'}</b></div><div class="er-fact"><span>Detail</span><b>${esc(x.Detail)}</b></div><div class="er-actions" style="margin-top:5px"><button class="er-btn primary" onclick="erRoute('${esc(x.Source_View)}','${esc(x.Source_Record_ID)}')">Open Source Record →</button></div>`}
function lineage(){let e=document.getElementById('erLineage');if(!e)return;let r=list('lineage',S.id).sort((a,b)=>a.Lineage_Order-b.Lineage_Order);e.innerHTML=r.map((x,i)=>`<div class="er-lrow" onclick="erRoute('${esc(x.Target_View)}','${esc(x.Record_ID)}')"><div class="er-lico">${i+1}</div><div><b>${esc(x.Role)} · ${esc(x.Record_ID)}</b><span>${esc(x.Module)} · ${esc(x.Validation_Status)}</span></div></div>`).join('')}
function erTraceNodeAction(n,x,inc){
 if(!n||!n.id)return '';
 if(n.kind==='incident')return `onclick="document.getElementById('erReplay')?.scrollIntoView({block:'start',behavior:'smooth'})"`;
 if(n.kind==='source'&&String(n.view||'').toLowerCase()==='operationaltwin')return `onclick="erOpenExactAsset('${esc(inc?.Plant_ID||'')}','${esc(inc?.Asset_ID||'')}','${esc(inc?.Asset_Tag||'')}','${esc(inc?.Asset_Class||'')}')"`;
 if(n.kind==='source')return `onclick="erOpenExactEvidence('${esc(n.view||'')}','${esc(n.id)}','${esc(x?.Evidence_ID||'')}','${esc(inc?.Plant_ID||'')}','${esc(inc?.Asset_ID||'')}','${esc(inc?.Asset_Tag||'')}')"`;
 if(n.view)return `onclick="erRoute('${esc(n.view)}','${esc(n.id)}',{incident:'${esc(S.id)}',kind:'${esc(n.kind||'record')}',sourceView:'${esc(n.view)}',sourceRecord:'${esc(n.id)}',evidenceId:'${esc(x?.Evidence_ID||'')}',plantId:'${esc(inc?.Plant_ID||'')}',assetId:'${esc(inc?.Asset_ID||'')}',assetTag:'${esc(inc?.Asset_Tag||'')}',contextToken:'ERTRACE-'+Date.now()})"`;
 return '';
}
function traceability(){
 let e=document.getElementById('erTraceGraph');if(!e)return;let r=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence);if(!r.length)return;
 let x=r[Math.min(S.selectedNode??S.node??0,r.length-1)],inc=get(S.id),lin=list('lineage',S.id).sort((a,b)=>a.Lineage_Order-b.Lineage_Order),dec=lin.find(a=>/decision/i.test((a.Module||'')+' '+(a.Role||''))),gap=lin.find(a=>/response-gap/i.test(a.Role||'')),wo=lin.find(a=>/execution|work/i.test((a.Role||'')+' '+(a.Module||''))),out=lin.find(a=>/outcome|loss|impact|reliability/i.test((a.Module||'')+' '+(a.Role||'')));
 let source={k:'Originating source',id:x.Source_Record_ID||x.Evidence_ID,sub:x.Source_Module||x.Lane,view:x.Source_View,kind:'source'},right=[{k:'Reconstructed incident',id:S.id,sub:inc?.Event_Title||'Qualified incident',kind:'incident'}];
 if(dec)right.push({k:'Decision',id:dec.Record_ID,sub:dec.Module,view:dec.Target_View||'decisionintelligence',kind:'decision'});if(gap)right.push({k:'Response-gap evidence',id:gap.Record_ID,sub:gap.Module,view:gap.Target_View||'decisionintelligence',kind:'gap'});if(wo)right.push({k:'Execution',id:wo.Record_ID,sub:wo.Module,view:wo.Target_View||'workorderintelligence',kind:'execution'});if(out)right.push({k:'Outcome',id:out.Record_ID,sub:out.Module,view:out.Target_View,kind:'outcome'});
 let conclusion=right.length>2?'This evidence is traceable beyond reconstruction into governed downstream use.':'Provenance is established, but the source data does not support a complete downstream enterprise trace.';
 e.innerHTML=`<div class="er-bi-trace"><div class="er-bi-side"><em>← PROVENANCE</em><button class="er-trace-node" ${erTraceNodeAction(source,x,inc)}><small>${esc(source.k)}</small><b>${esc(source.id||'—')}</b><span>${esc(source.sub||'')}</span></button></div><span class="er-bi-arrow">←</span><button class="er-trace-node er-trace-center"><small>Selected evidence</small><b>${esc(x.Evidence_ID)}</b><span>${esc(x.Evidence_Type||x.Lane||'')}</span></button><span class="er-bi-arrow">→</span><div class="er-bi-forward"><em>TRACE ACROSS AIP →</em><div>${right.map((n,i)=>`${i?'<span class="er-trace-arrow">→</span>':''}<button class="er-trace-node" ${erTraceNodeAction(n,x,inc)}><small>${esc(n.k)}</small><b>${esc(n.id||'—')}</b><span>${esc(n.sub||'')}</span></button>`).join('')}</div></div></div><div class="er-trace-conclusion"><b>Forensic conclusion</b><span>${esc(conclusion)} ${String(x.Source_View||'').toLowerCase()==='operationaltwin'?'Operational Twin-origin evidence is inspected through the exact linked asset context instead of opening a blank Twin shell.':''}</span></div>`;
}

function governanceDetail(kind){
 let e=document.getElementById('erGovernanceDetail');if(!e)return;let r=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence),idx=Math.max(0,Math.min(S.selectedNode??S.node??0,r.length-1)),x=r[idx],inc=get(S.id),lin=list('lineage',S.id).sort((a,b)=>a.Lineage_Order-b.Lineage_Order),bl=(d().trace_blockers||[]).filter(a=>a.Incident_ID===S.id);
 const node=(tone,label,id,sub,extra='')=>`<div class="er-gov-node-static ${tone}"><em>${esc(label)}</em><b>${esc(id||'—')}</b><span>${esc(sub||'')}</span>${extra}</div>`;
 if(kind==='lineage'){
  let source={id:x?.Source_Record_ID||x?.Evidence_ID,sub:x?.Source_Module||x?.Lane};
  e.innerHTML=`<div class="er-gov-title"><b>View Lineage</b></div><div class="er-gov-flow er-gov-flow-static">${node('source','Originating Source',source.id,source.sub)}<span class="er-gov-arrow">→</span>${node('evidence','Reconstruction Evidence',x?.Evidence_ID,'Event Reconstruction')}<span class="er-gov-arrow">→</span>${node('incident','Incident',S.id,inc?.Event_Title||'Qualified incident')}</div>`;
 }else{
  let dec=lin.find(a=>/^Decision Record$/i.test(a.Role||''))||lin.find(a=>/decision/i.test((a.Module||'')+' '+(a.Role||''))),gap=lin.find(a=>/response-gap/i.test(a.Role||'')),wo=lin.find(a=>/^Execution Record$/i.test(a.Role||''))||lin.find(a=>/Work Order Intelligence/i.test(a.Module||'')),out=lin.find(a=>/outcome|reliability/i.test((a.Module||'')+' '+(a.Role||'')));
  let nodes=[node('selected','Selected Evidence',x?.Evidence_ID,x?.Evidence_Type),node('incident','Incident',S.id,inc?.Event_Title||'Qualified incident')];
  if(dec)nodes.push(node('decision','Decision',dec.Record_ID,dec.Module));
  if(bl.length){let li=`<div class="er-blocker-list">${bl.map(b=>`<i class="${b.Primary_Response_Gap==='Yes'?'primary':''}"><u>${esc(b.Blocker_ID)}</u><span>${esc(b.Blocker)}</span></i>`).join('')}</div>`;nodes.push(node('blockers',`Execution Blockers · ${bl.length}`,'',dec?.Record_ID||inc?.Decision_ID||'',li));}
  if(gap){let pg=bl.find(b=>b.Primary_Response_Gap==='Yes'),label=pg?.Blocker||gap.Record_ID;nodes.push(node('gap','Primary Response Gap',gap.Record_ID,label));}
  if(wo)nodes.push(node('execution','Execution Record',wo.Record_ID,wo.Module));
  if(out)nodes.push(node('outcome','Outcome',out.Record_ID,out.Module));
  e.innerHTML=`<div class="er-gov-title"><b>Trace Across AIP</b></div><div class="er-gov-flow er-gov-flow-static">${nodes.map((n,i)=>`${i?'<span class="er-gov-arrow">→</span>':''}${n}`).join('')}</div>`;
 }
}
window.erToggleGovernance=kind=>{let e=document.getElementById('erGovernanceDetail');if(!e)return;if(e.dataset.open===kind){e.innerHTML='';e.dataset.open='';return}e.dataset.open=kind;governanceDetail(kind)};

function milestoneRender(now){
 let e=document.getElementById('erMilestones'),panel=document.getElementById('erMilestonePanel');if(!e)return;
 let it=iv(S.id);if(!it){e.innerHTML='';return}
 let ms=[
  ['Incident Start',it.Incident_Start,'First relevant reconstructed observation'],
  ['Detection',it.Detection_Time,it.Detection_Event||'Detection established'],
  ['Actionable From',it.Actionable_From,it.Actionable_Event||'Evidence sufficient to act'],
  ['Intervention Deadline',it.Intervention_Deadline,it.Deadline_Event||'Intervention point'],
  ['Outcome',it.Outcome_Time,it.Outcome_Event||'Outcome / impact established']
 ];
 let first=pt(it.Incident_Start),n=Number.isFinite(now)?now:-Infinity,outcome=pt(it.Outcome_Time),started=Number.isFinite(now)&&Number.isFinite(first)&&now>=first,complete=Number.isFinite(now)&&Number.isFinite(outcome)&&now>=outcome;if(panel){panel.classList.toggle('er-milestone-hidden',!started)}if(!started){e.innerHTML='';return}
 e.innerHTML=`<div class="erm-flow">${ms.map((x,i)=>{
   let t=pt(x[1]),state=!Number.isFinite(now)?'future':t<n?'done':Math.abs(t-n)<120000?'current':'future';
   return `${i?'<span class="erm-arrow">→</span>':''}<div class="erm ${state}"><em>${esc(x[0])}</em><b>${state==='future'?'—':new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</b><span>${state==='future'?'Pending':esc(x[2])}</span></div>`}).join('')}</div>
 ${complete?`<div class="erm-summary er-summary-reveal"><div class="er-summary-card er-summary-1"><span>Total incident span</span><b>${Number(it.Incident_Span_Hours||0).toFixed(2)} h</b><small>${esc(it.Incident_Start)} → ${esc(it.Outcome_Time)}</small></div><div class="actionable er-summary-card er-summary-2"><span>Actionable intervention window</span><b>${it.Actionable_Window_Hours==null?'Not quantifiable':Number(it.Actionable_Window_Hours).toFixed(2)+' h'}</b><small>${it.Actionable_Window_Hours==null?'Source timestamps insufficient':esc(it.Actionable_From)+' → '+esc(it.Intervention_Deadline)}</small></div><div class="er-summary-card er-summary-3"><span>Primary response gap</span><b>${esc(it.Response_Gap||'—')}</b></div></div>`:''}`;
}
function impact(){
 let e=document.getElementById('erImpact'),x=get(S.id),it=iv(S.id),av=Number(it.Avoidable_Value_INR||0),ae=it.Avoidable_Energy_MWh,frac=Number(it.Avoidable_Value_Fraction||0);
 e.innerHTML=`<div class="er-impact"><div class="er-ibox actual"><b>Current exposure</b><strong>${money(x.Value_at_Stake_INR)}</strong></div><div class="er-ibox avoid"><b>Potentially avoidable</b><strong>${money(av)}</strong></div></div><div class="er-impact-calc-action"><button class="er-btn er-calc-btn" onclick="erToggleImpactCalc()">View Calculation</button></div><div id="erImpactCalc" class="er-impact-calc"></div>`;
}
window.erToggleImpactCalc=()=>{
 let e=document.getElementById('erImpactCalc');if(!e)return;
 if(e.dataset.open==='1'){e.innerHTML='';e.dataset.open='';return}
 let x=get(S.id),it=iv(S.id),frac=Number(it.Avoidable_Value_Fraction||0),av=Number(it.Avoidable_Value_INR||0),energy=x.Energy_at_Risk_MWh,ae=it.Avoidable_Energy_MWh;
 e.dataset.open='1';
 e.innerHTML=`<div class="er-calc-grid">
   <div class="er-calc-row source"><span>Current Exposure</span><b>${money(x.Value_at_Stake_INR)}</b><small>Governed source value · ${esc(it.Exposure_Source_Sheet||'Source')} · ${esc(it.Exposure_Source_Record_ID||'—')}</small></div>
   <div class="er-calc-op">×</div>
   <div class="er-calc-row factor"><span>Avoidable Value Fraction</span><b>${(frac*100).toFixed(2)}%</b><small>Event Reconstruction Policy · derived indicator</small></div>
   <div class="er-calc-op">=</div>
   <div class="er-calc-row result"><span>Potentially Avoidable</span><b>${money(av)}</b><small>${money(x.Value_at_Stake_INR)} × ${(frac*100).toFixed(2)}%</small></div>
 </div>${energy!=null?`<div class="er-calc-energy"><span>Energy bridge</span><b>${Number(energy).toFixed(2)} MWh × ${(frac*100).toFixed(2)}% = ${Number(ae||0).toFixed(2)} MWh potentially avoidable</b></div>`:''}`;
};





function assetmap(){
  let e=document.getElementById('erAssetMap');if(!e)return;
  let a=(d().asset_links||[]).filter(x=>x.Incident_ID===S.id).sort((x,y)=>x.Order-y.Order);
  if(!a.length){e.innerHTML='';return}
  e.innerHTML=a.map((x,i)=>{
    let prev=i?a[i-1]:null;
    let arrow=prev?`<button class="er-asset-arrow er-path-btn" title="${esc(prev.Asset_Tag)} → ${esc(x.Asset_Tag)}" onclick="erOpenRelationshipPath('${esc(x.Plant_ID)}','${esc(prev.Asset_ID)}','${esc(prev.Asset_Tag)}','${esc(x.Asset_ID)}','${esc(x.Asset_Tag)}','${esc(x.Relationship_Type)}')">→</button>`:'';
    return `${arrow}<button class="er-asset ${x.Evidence_Role==='Directly implicated'?'direct':'affected'}" title="Open ${esc(x.Asset_Tag)}" onclick="erOpenExactAsset('${esc(x.Plant_ID)}','${esc(x.Asset_ID)}','${esc(x.Asset_Tag)}','${esc(x.Asset_Class)}')"><b>${esc(x.Asset_Tag)}</b><span>${esc(x.Asset_Class)} · ${esc(x.Role)}</span><small>${esc(x.Physics_Basis)}</small><em>${esc(x.Evidence_Role)}</em></button>`;
  }).join('');
}

function liveInspector(i){
 let box=document.getElementById('erLiveInspectorBody');if(!box)return;
 let r=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence);if(!r.length){box.innerHTML='';return}
 let x=r[Math.max(0,Math.min(i,r.length-1))],tone=cls(x.Lane);
 box.closest('.er-live-inspector')?.setAttribute('data-er-tone',tone);
 box.innerHTML=`<div class="erli-lane erli-${tone}">${esc(x.Lane)}</div>
 <div class="erli-title erli-title-${tone}">${esc(x.Event_Label)}</div>
 <div class="erli-row"><span>Time</span><b>${esc(x.Timestamp||'Governed state')}</b></div>
 <div class="erli-row"><span>Evidence</span><b class="erli-link" onclick="erOpenExactEvidence('${esc(x.Source_View)}','${esc(x.Source_Record_ID)}','${esc(x.Evidence_ID)}','${esc(get(S.id)?.Plant_ID||'')}','${esc(get(S.id)?.Asset_ID||'')}','${esc(get(S.id)?.Asset_Tag||'')}')">${esc(x.Evidence_ID)}</b></div>
 <div class="erli-row"><span>Type</span><b>${esc(x.Evidence_Type)}</b></div>
 <div class="erli-row"><span>Source</span><b>${esc(x.Source_Module)}</b></div>
 <div class="erli-row"><span>Record</span><b class="erli-link" onclick="erOpenExactEvidence('${esc(x.Source_View)}','${esc(x.Source_Record_ID)}','${esc(x.Evidence_ID)}','${esc(get(S.id)?.Plant_ID||'')}','${esc(get(S.id)?.Asset_ID||'')}','${esc(get(S.id)?.Asset_Tag||'')}')">${esc(x.Source_Record_ID)}</b></div>
 <div class="erli-row"><span>Confidence</span><b>${x.Confidence_Pct!=null?Number(x.Confidence_Pct).toFixed(2)+'%':'Observed'}</b></div>
 <div class="erli-detail erli-detail-${tone}">${esc(x.Detail)}</div>`;
}
function stageRibbon(i){
 let box=document.getElementById('erStageRibbon');if(!box)return;
 let r=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence),cur=Math.max(-1,Math.min(i,r.length-1));
 box.innerHTML=r.filter((x,j)=>j<=cur).map((x,j)=>`<div class="ersr ${j<cur?'done':'current'} er-stage-${cls(x.Lane)}" data-er-stage-index="${j}"><i>${j<cur?'✓':'●'}</i><b>${esc((x.Lane||'').replace(' / ','/'))}</b><span>${esc(x.Event_Label)}</span></div>`).join('');
 let current=box.querySelector('.ersr.current');
 if(current){requestAnimationFrame(()=>{try{current.scrollIntoView({behavior:'smooth',inline:'end',block:'nearest'})}catch(_){}})}
}

function replayBlankState(){
 let console=document.getElementById('erLiveConsole');if(console){console.classList.add('er-console-t0');delete console.dataset.erSignalEstablished;}
 let live=document.getElementById('erLiveSnapshot');if(live)live.innerHTML='';
 let insp=document.getElementById('erLiveInspectorBody');if(insp){insp.closest('.er-live-inspector')?.removeAttribute('data-er-tone');insp.innerHTML='';}
 let ribbon=document.getElementById('erStageRibbon');if(ribbon)ribbon.innerHTML='';
 let mp=document.getElementById('erMilestonePanel');if(mp)mp.classList.add('er-milestone-hidden');
 document.querySelectorAll('#erTimeline .er-tick').forEach(t=>{t.classList.add('er-time-hidden');t.classList.remove('er-time-visible')});
 let w=document.getElementById('erDynamicWindow'),wl=document.getElementById('erDynamicWindowLabel');
 if(w)w.classList.add('er-window-hidden');if(wl){wl.classList.add('er-window-label-hidden');wl.textContent=''}
 let c=document.getElementById('erCursor');if(c)c.style.visibility='hidden';
 let clock=document.getElementById('erReplayClock');if(clock){clock.classList.add('er-clock-hidden');clock.innerHTML=''}
 let t=document.getElementById('erTimeline');if(t){t.scrollLeft=0}
}
function replaySnapshot(i){
 let box=document.getElementById('erLiveSnapshot');if(!box)return;
 let rows=(d().replay_snapshots||[]).filter(x=>x.Incident_ID===S.id).sort((a,b)=>a.Sequence-b.Sequence);
 let x=rows.find(r=>Number(r.Sequence)===Number(i+1))||rows[Math.max(0,Math.min(i,rows.length-1))];
 if(!x){box.innerHTML='';return}
 let cards=[
  ['SCB current',x.SCB_Current_Index_Pct,'%','#2b789b'],
  ['Inverter AC power',x.Inverter_AC_Power_Index_Pct,'%','#347ea1'],
  ['Heat-sink temp',x.HeatSink_Temp_C,'°C','#b74c49'],
  ['Transformer loading',x.Transformer_Loading_Index_Pct,'%','#775bb4'],
  ['Block export',x.Export_Index_Pct,'%','#27825b'],
  ['Cumulative exposure',x.Cumulative_Exposure_Pct,'%','#d18a16']
 ];
 box.innerHTML=cards.map(c=>`<div class="er-live-card" style="--live:${c[3]}"><span>${c[0]}</span><b>${Number(c[1]??0).toFixed(2)}${c[2]}</b><i><u style="width:${Math.max(3,Math.min(100,Number(c[1]??0)))}%"></u></i></div>`).join('');
 box.dataset.event=x.Current_Event||'';
}
function replayStatus(i,now){}
function replayAssetHighlight(i){
 let r=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence),x=r[Math.max(0,Math.min(i,r.length-1))],cards=[...document.querySelectorAll('#erAssetMap .er-asset')];
 cards.forEach(c=>c.classList.remove('replay-active'));
 if(!x||!cards.length)return;
 let hay=((x.Detail||'')+' '+(x.Source_Record_ID||'')+' '+(x.Event_Label||'')).toLowerCase(),match=cards.find(c=>hay.includes((c.querySelector('b')?.textContent||'').toLowerCase()));
 if(!match){
   if(x.Lane==='Telemetry'||x.Lane==='AI / Model'||x.Lane==='SCADA / Alarms')match=cards[0]||cards[1];
   else if(x.Lane==='Maintenance'||x.Lane==='Decision / Governance')match=cards[1]||cards[0];
   else if(x.Lane==='Business Impact')match=cards[cards.length-1];
 }
 if(match)match.classList.add('replay-active')
}

function replayReveal(i){
 const nodes=[...document.querySelectorAll('#erTimeline .er-node[data-er-event-index]')];
 const labels=[...document.querySelectorAll('#erTimeline .er-ntext[data-er-event-index]')];
 nodes.forEach(n=>{
   const idx=Number(n.dataset.erEventIndex);
   n.classList.toggle('replay-visible',idx<=i);
   n.classList.toggle('replay-future-hidden',idx>i);
 });
 labels.forEach(n=>{
   const idx=Number(n.dataset.erEventIndex);
   n.classList.toggle('replay-visible',idx<=i);
   n.classList.toggle('replay-future-hidden',idx>i);
   n.classList.toggle('replay-current-label',idx===i);
 });
}


function replayRevealTimeAxis(f){
 document.querySelectorAll('#erTimeline .er-tick[data-er-time-frac]').forEach(t=>{
   let tf=Number(t.dataset.erTimeFrac||0),show=Number.isFinite(f)&&f>0&&tf<=f+0.001;
   t.classList.toggle('er-time-visible',show);t.classList.toggle('er-time-hidden',!show);
 });
}
function replayWindowUpdate(now,mn,mx){
 let it=iv(S.id),s=pt(it?.Actionable_From),e=pt(it?.Intervention_Deadline);
 let box=document.getElementById('erDynamicWindow'),lab=document.getElementById('erDynamicWindowLabel');
 if(!box||!lab)return;
 if(!Number.isFinite(s)||!Number.isFinite(e)||e<=s||!Number.isFinite(now)||now<e){
   box.classList.add('er-window-hidden');box.style.width='0';
   lab.classList.add('er-window-label-hidden');lab.textContent='';return;
 }
 let span=Math.max(1,mx-mn),left=f=>`calc(22px + (100% - 40px) * ${Math.max(0,Math.min(1,f))})`,wf=(s-mn)/span,ef=(e-mn)/span;
 box.classList.remove('er-window-hidden');box.style.left=left(wf);box.style.width=`calc((100% - 40px) * ${Math.max(0,ef-wf)})`;
 let hours=(e-s)/3600000;lab.classList.remove('er-window-label-hidden');lab.style.left=left(Math.min(.76,wf+.03));lab.textContent=`Actionable Intervention Window · ${hours.toFixed(2)} h`;
}
function replayAutoPan(){
 let t=document.getElementById('erTimeline');if(!t)return;
 let c=document.getElementById('erCursor');if(!c)return;
 try{
   const cr=c.getBoundingClientRect(),tr=t.getBoundingClientRect();
   const rel=(cr.left-tr.left)+t.scrollLeft;
   const target=Math.max(0,rel-t.clientWidth*.62);
   t.scrollTo({left:target,behavior:'smooth'});
 }catch(_){}
}

function revealLiveConsole(){
 let console=document.getElementById('erLiveConsole');if(console)console.classList.remove('er-console-t0');
 let c=document.getElementById('erCursor');if(c)c.style.visibility='visible';
}

function erAcquisitionFX(i,x){
 const root=document.getElementById('erLiveConsole');if(!root)return;
 const lane=cls(x?.Lane||''),firstLock=!root.dataset.erSignalEstablished;
 if(!firstLock)return;
 root.dataset.erSignalEstablished='1';
 root.classList.remove('er-signal-acquire','er-acquire-telemetry','er-acquire-ai','er-acquire-scada','er-acquire-operations','er-acquire-maintenance','er-acquire-decision','er-acquire-business');
 void root.offsetWidth;
 root.classList.add('er-signal-acquire','er-acquire-'+lane);
 const snap=document.getElementById('erLiveSnapshot'),insp=document.querySelector('#erInspector .er-live-inspector'),ribbon=document.getElementById('erStageRibbon');
 [snap,insp,ribbon].forEach(el=>{if(!el)return;el.classList.remove('er-signal-lock');void el.offsetWidth;el.classList.add('er-signal-lock')});
 const current=[...document.querySelectorAll('#erTimeline .er-node')].find(n=>n.classList.contains('replay-current'));
 if(current){current.classList.remove('er-node-lock');void current.offsetWidth;current.classList.add('er-node-lock')}
 setTimeout(()=>root.classList.remove('er-signal-acquire','er-acquire-'+lane),520);
}
function replayState(i,now){
 revealLiveConsole();
 S.replayNode=i;
 replayReveal(i);
 liveInspector(i);
 stageRibbon(i);
 replayStatus(i,now);
 replaySnapshot(i);
 replayAssetHighlight(i);
 milestoneRender(now);
 replayAutoPan();
 let r=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence),x=r[Math.max(0,Math.min(i,r.length-1))],
 lane=x?.Lane||'',stageIndex=lane==='Business Impact'?4:lane==='Maintenance'?3:lane==='Decision / Governance'?2:lane==='Operations'?1:(lane==='SCADA / Alarms'||lane==='AI / Model'||lane==='Telemetry')?0:0,
 stages=[...document.querySelectorAll('#erResponse .er-stage')];
 stages.forEach((s,j)=>{s.classList.toggle('replay-complete',j<stageIndex);s.classList.toggle('replay-current-stage',j===stageIndex)});
 erAcquisitionFX(i,x);
}
function draw(){assetmap();timeline();replayReveal(-1);replayBlankState();milestoneRender();impact()}
window.erSelectIncident=id=>{
  const a=d().incidents;
  if(!a.some(x=>x.Incident_ID===id))return false;
  window.__ER_LOCKED_INCIDENT=id;
  S.id=id;S.node=0;S.selectedNode=0;S.pos=0;erPause();render();return true
};window.erSelectNode=i=>{revealLiveConsole();S.selectedNode=i;S.node=i;timeline();replayReveal(i);liveInspector(i);stageRibbon(i);replaySnapshot(i);let g=document.getElementById('erGovernanceDetail');if(g?.dataset.open)governanceDetail(g.dataset.open)};window.erPause=()=>{if(S.timer){clearInterval(S.timer);S.timer=null}};window.erReset=()=>{erPause();S.pos=0;S.node=0;S.selectedNode=0;S.replayNode=-1;draw();let c=document.getElementById('erReplayClock');if(c){c.textContent='';c.classList.add('er-clock-hidden')}};window.erSpeed=()=>{S.speed=S.speed===1?5:S.speed===5?20:1;let e=document.getElementById('erSp');if(e)e.textContent=S.speed+'×'};window.erReplay=()=>{erPause();timeline();replayReveal(-1);replayBlankState();milestoneRender();let all=list('timeline',S.id).sort((a,b)=>a.Sequence-b.Sequence),timed=all.filter(x=>Number.isFinite(pt(x.Timestamp)));if(!timed.length)return;let ts=timed.map(x=>pt(x.Timestamp)),firstEvent=Math.min(...ts),mx=Math.max(...ts);if(mx<=firstEvent)mx=firstEvent+3600000;let eventSpan=mx-firstEvent,mn=firstEvent-Math.max(60000,eventSpan*.05),span=mx-mn,spanHours=span/3600000,baseSeconds=Math.max(30,Math.min(90,spanHours*20)),totalSeconds=baseSeconds/Math.max(1,S.speed||1),tickMs=100,steps=Math.max(1,Math.round(totalSeconds*1000/tickMs)),step=0,last=-1,left=f=>`calc(128px + (100% - 146px) * ${Math.max(0,Math.min(1,f))})`,fmt=t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),elapsed=ms=>{let z=Math.max(0,Math.round(ms/60000)),h=Math.floor(z/60),mm=z%60;return`+${h}h ${String(mm).padStart(2,'0')}m`};S.pos=0;S.replayNode=-1;S.timer=setInterval(()=>{step++;let f=Math.min(1,step/steps),now=mn+span*f;S.pos=f;let nearest=-1;all.forEach((x,i)=>{if(Number.isFinite(pt(x.Timestamp))&&pt(x.Timestamp)<=now)nearest=i});let c=document.getElementById('erCursor');if(c){c.style.left=left(f);if(nearest>=0){c.style.visibility='visible';replayAutoPan()}else{c.style.visibility='hidden'}}if(nearest>=0)replayRevealTimeAxis(f);replayWindowUpdate(now,mn,mx);let clock=document.getElementById('erReplayClock');if(clock){if(nearest>=0){clock.classList.remove('er-clock-hidden');clock.innerHTML=`<span class="er-clock-title">Incident time</span><span class="er-clock-time">${fmt(now)}</span><span class="er-clock-duration">${elapsed(now-mn)}</span>`}else{clock.classList.add('er-clock-hidden');clock.innerHTML=''}};S.node=nearest;let timedIndex=-1,count=-1;for(let i=0;i<all.length;i++){if(Number.isFinite(pt(all[i].Timestamp)))count++;if(i===S.node){timedIndex=count;break}}document.querySelectorAll('#erTimeline .er-node').forEach((n,j)=>{n.classList.toggle('replay-current',j===timedIndex);n.classList.toggle('replay-complete',j<timedIndex)});if(nearest>=0&&nearest!==last){last=nearest;revealLiveConsole();replayState(nearest,now)}if(f>=1){if(nearest>=0)replayState(nearest,now);erPause()}},tickMs)};window.erTrace=()=>{let p=document.getElementById('erTracePanel');if(!p)return;traceability();p.scrollIntoView({behavior:'smooth',block:'center'});p.classList.remove('er-trace-flash');void p.offsetWidth;p.classList.add('er-trace-flash');setTimeout(()=>p.classList.remove('er-trace-flash'),1800)};
window.erOpenRegister=()=>{document.querySelector('.er-register')?.classList.add('open');document.querySelector('.er-back')?.classList.add('open');erRenderRegister()};window.erCloseRegister=()=>{document.querySelector('.er-register')?.classList.remove('open');document.querySelector('.er-back')?.classList.remove('open')};
window.erSyncRegisterScroll=()=>{
 const top=document.getElementById('erRegTopScroll'),body=document.getElementById('erRegTableScroll'),spacer=document.getElementById('erRegTopSpacer'),table=body?.querySelector('.er-table');
 if(!top||!body||!spacer||!table)return;
 const syncWidth=()=>{spacer.style.width=Math.max(table.scrollWidth,body.clientWidth)+'px';top.style.display=table.scrollWidth>body.clientWidth+2?'block':'none'};
 syncWidth();
 let lock=false;
 top.onscroll=()=>{if(lock)return;lock=true;body.scrollLeft=top.scrollLeft;lock=false};
 body.onscroll=()=>{if(lock)return;lock=true;top.scrollLeft=body.scrollLeft;lock=false};
 if(typeof ResizeObserver!=='undefined'){try{new ResizeObserver(syncWidth).observe(body)}catch(_){}}
};
window.erRenderRegister=()=>{
 let b=document.getElementById('erReg');if(!b)return;
 let q=String(document.getElementById('erQ')?.value||'').toLowerCase(),
     sev=document.getElementById('erSev')?.value||'All',
     a=d().incidents.filter(x=>(sev==='All'||x.Severity===sev)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));
 b.innerHTML=`<div id="erRegTopScroll" class="er-reg-topscroll" aria-label="Scroll Qualified Incident Register horizontally"><div id="erRegTopSpacer" class="er-reg-topscroll-spacer"></div></div><div id="erRegTableScroll" class="er-reg-table-scroll"><table class="er-table"><thead><tr><th>Incident</th><th>Site / Asset</th><th>Event</th><th>Severity</th><th>Priority</th><th>Impact</th><th>Status</th></tr></thead><tbody>${a.map(x=>`<tr class="${x.Incident_ID===S.id?'orl-exact-target':''}" onclick="erSelectIncident('${esc(x.Incident_ID)}');erCloseRegister()"><td>${esc(x.Incident_ID)}</td><td>${esc(x.Plant_ID)} · ${esc(x.Asset_Tag)}</td><td>${esc(x.Incident_Type)}</td><td>${esc(x.Severity)}</td><td>${esc(x.Qualification)}</td><td>${esc(x.Impact_Text)}</td><td>${esc(x.Status)}</td></tr>`).join('')}</tbody></table></div>`;
 requestAnimationFrame(()=>window.erSyncRegisterScroll?.());
};
window.erClearContext=function(){
  try{
    document.querySelectorAll('.er-context-banner').forEach(n=>n.remove());
    document.querySelectorAll('.er-context-highlight').forEach(n=>n.classList.remove('er-context-highlight'));
    window.AIP_EVENT_FORENSICS_CONTEXT=null;
  }catch(_){}
};

window.erOpenExactAsset=(plantId,assetId,assetTag,assetClass)=>{
  window.erClearContext?.();
  const ctx={incident:S.id,kind:'asset',plantId,assetId,assetTag,assetClass,sourceView:'assetexplorer',sourceRecord:assetId,contextToken:'ER-'+Date.now()};
  window.AIP_EVENT_FORENSICS_CONTEXT=ctx;
  window.AIP_SELECTED_ASSET_CONTEXT={assetId,tag:assetTag,siteId:plantId,site:plantId,assetClass,target:'assetexplorer',source:'Event Reconstruction',recordId:assetId,contextToken:ctx.contextToken};
  window.AIP_ASSET_EXPLORER_SELECTED_ID=assetId;
  try{if(typeof window.activate==='function')window.activate('assetexplorer');else document.querySelector('#sidebar .nav-item[data-view="assetexplorer"]')?.click()}catch(_){}
  let tries=0;
  const apply=()=>{
    const root=document.getElementById('view-assetexplorer');
    if(!root||!root.classList.contains('active')){if(tries++<28)setTimeout(apply,90);return}
    const ctl=window.AIPAssetExplorerController;
    let ok=false;
    try{ok=!!ctl?.selectAsset?.(assetId)}catch(_){}
    const exactState=()=>String(window.AIPAssetExplorerController?.getState?.().assetId||window.AIP_ASSET_EXPLORER_SELECTED_ID||'')===String(assetId);
    if(!ok||!exactState()){
      const row=root.querySelector(`[data-ax-id="${CSS.escape(String(assetId))}"]`);
      if(row){try{row.click()}catch(_){}}
    }
    if(exactState()){
      window.AIP_ASSET_EXPLORER_SELECTED_ID=assetId;
      window.AIP_SELECTED_ASSET_CONTEXT={assetId,tag:assetTag,siteId:plantId,site:plantId,assetClass,target:'assetexplorer',source:'Event Reconstruction',recordId:assetId,contextToken:ctx.contextToken};
      root.querySelectorAll('.er-context-highlight').forEach(n=>n.classList.remove('er-context-highlight'));
      const row=root.querySelector(`[data-ax-id="${CSS.escape(String(assetId))}"]`);
      if(row){row.classList.add('er-context-highlight');try{row.scrollIntoView({block:'center',behavior:'auto'})}catch(_){}}
      return;
    }
    if(tries++<28)setTimeout(apply,90);
  };
  setTimeout(apply,70);
};

window.erOpenRelationshipPath=(plantId,fromId,fromTag,toId,toTag,relationshipType)=>{
  window.erClearContext?.();
  const ctx={incident:S.id,kind:'relationship',plantId,fromAssetId:fromId,fromAssetTag:fromTag,toAssetId:toId,toAssetTag:toTag,relationshipType,assetId:toId,tag:toTag,sourceView:'assetrelationships',sourceRecord:`${fromTag} ${relationshipType} ${toTag}`,contextToken:'ERREL-'+Date.now()};
  window.AIP_EVENT_FORENSICS_CONTEXT=ctx;
  window.AIP_PENDING_RELATIONSHIP_CONTEXT={assetId:toId,tag:toTag,site:plantId,siteId:plantId,contextToken:ctx.contextToken};
  window.AIP_RELATIONSHIP_FOCUS_ASSET=toId;
  window.AIP_RELATIONSHIP_PATH_CONTEXT={fromAssetId:fromId,fromTag,toAssetId:toId,toTag,relationshipType,incident:S.id,contextToken:ctx.contextToken};
  try{if(typeof window.activate==='function')window.activate('assetrelationships',true);else document.querySelector('#sidebar .nav-item[data-view="assetrelationships"]')?.click()}catch(_){}
  let tries=0;
  const apply=()=>{
    const root=document.getElementById('view-assetrelationships');if(!root){if(tries++<20)setTimeout(apply,90);return}
    try{
      if(typeof window.AIPApplyRelationshipContextExact==='function'){
        window.AIPApplyRelationshipContextExact({assetId:toId,tag:toTag,siteId:plantId,site:plantId,contextToken:ctx.contextToken},0);
      }else{
        window.AIP_RELATIONSHIP_FOCUS_ASSET=toId;window.renderAssetRelationships?.();
      }
    }catch(_){}
    root.dataset.erRelationshipFrom=fromId;root.dataset.erRelationshipTo=toId;root.dataset.erRelationshipType=relationshipType;
    setTimeout(()=>{
      const nodes=[...root.querySelectorAll('[data-asset-id],[data-id],[data-record-id],text,g')];
      const f=nodes.find(n=>String(n.textContent||n.dataset?.assetId||n.dataset?.id||'').includes(fromTag));
      const t=nodes.find(n=>String(n.textContent||n.dataset?.assetId||n.dataset?.id||'').includes(toTag));
      [f,t].filter(Boolean).forEach(n=>n.classList?.add?.('er-context-highlight'));
    },160);
  };
  setTimeout(apply,80);
};

window.erOpenExactEvidence=(view,record,evidenceId,plantId,assetId,assetTag)=>{
  window.erClearContext?.();
  const ctx={incident:S.id,kind:'evidence',plantId,assetId,assetTag,sourceView:view,sourceRecord:record,evidenceId,contextToken:'EREV-'+Date.now()};
  window.AIP_EVENT_FORENSICS_CONTEXT=ctx;
  window.AIP_SELECTED_EVENT_CONTEXT={incident:S.id,assetId,tag:assetTag,siteId:plantId,sourceView:view,sourceRecord:record,evidenceId,contextToken:ctx.contextToken};
  if(assetId)window.AIP_SELECTED_ASSET_CONTEXT={assetId,tag:assetTag,siteId:plantId,target:view,source:'Event Reconstruction',recordId:record,contextToken:ctx.contextToken};
  window.erRoute(view,record,ctx);
};
window.erRoute=(view,record,exactCtx)=>{
  window.erClearContext();
  const ctx=exactCtx||{incident:S.id,kind:'record',sourceView:view,sourceRecord:record,contextToken:'ERREC-'+Date.now()};
  window.AIP_EVENT_FORENSICS_CONTEXT=ctx;
  try{
    const grouped=['rootcause','reliabilityengineering','rcm','aivision','eventreconstruction'];
    if(grouped.includes(view)){
      const tab=document.querySelector(`[data-aip-maint-nav="${view}"]`);
      if(tab){tab.click();}
      else if(typeof window.activate==='function'){window.activate(view);}
      else if(window.AIP_V21&&typeof window.AIP_V21.open==='function'){window.AIP_V21.open(view);}
    }else if(typeof window.activate==='function'){
      window.activate(view);
    }else{
      document.querySelector(`#sidebar .nav-item[data-view="${view}"]`)?.click();
    }
  }catch(e){}
  setTimeout(()=>{
    let root=document.getElementById('view-'+view);if(!root)return;
    root.querySelectorAll(':scope > .er-context-banner').forEach(n=>n.remove());
    let b=document.createElement('div');
    b.className='er-context-banner';
    b.dataset.erContext='true';
    b.innerHTML=`<span>Context from Event Reconstruction · Incident <b>${esc(ctx.incident)}</b> · Record <b>${esc(record)}</b></span><button type="button" class="er-context-clear" title="Clear forensic context" onclick="erClearContext()">×</button>`;
    root.prepend(b);
    let x=[...root.querySelectorAll('tr,button,[data-id],[data-record-id]')].find(n=>String(n.textContent||'').includes(record));
    if(x){
      x.classList.add('er-context-highlight');
      try{x.scrollIntoView({block:'center'})}catch(e){}
    }
  },220);
};
window.renderEventReconstructionForensicsV537=render;if(window.AIP_V21?.renderers)window.AIP_V21.renderers.eventreconstruction=render;document.addEventListener('aip:data-source-changed',()=>{let a=document.querySelector('.view.active[id^="view-"]')?.id.replace('view-','');if(a==='eventreconstruction')setTimeout(render,0)});
})();