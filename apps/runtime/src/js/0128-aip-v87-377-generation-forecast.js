
window.GF377_EXCEL_15M=__AIP_DS("4d8dc1e52249131a");
window.GF377_SYNTH_15M=__AIP_DS("b8f387af41a409cd");
window.GF377_EXCEL_RUNS=__AIP_DS("ba0aec516a564767");
window.GF377_SYNTH_RUNS=__AIP_DS("77f19f7b26a6cd1e");
window.GF377_EXCEL_SNAP=__AIP_DS("2783ee48f6337fa9");
window.GF377_SYNTH_SNAP=__AIP_DS("1396d45bd35c48d8");
(function(){
'use strict';
(function ensureForecastModelRegistry(){
  const row={Model_ID:'MDL-SFRC-011',Model_Name:'Solar Forecast Residual Correction',Capability:'Generation Forecast',Model_Type:'Gradient-Boosted Residual Regression',Version:'1.0.0',Deployment_Status:'Production',Approval_Status:'Approved',Precision:'',Recall:'',F1_Score:'',Last_Validated:'2026-08-20',Next_Review:'2026-11-20',Risk_Class:'Medium',Intended_Use:'Residual correction only; physics/weather forecast remains primary baseline'};
  [window.EMBEDDED_EXCEL_DATA,window.AIP_INDEPENDENT_SYNTHETIC_DATA].forEach(d=>{if(d&&Array.isArray(d['AI Model Registry'])&&!d['AI Model Registry'].some(x=>String(x.Model_ID)===row.Model_ID))d['AI Model Registry'].push({...row});});
})();
let H=24,SEL=0,RUN=null;
const N=(v,d=0)=>{v=+v;return Number.isFinite(v)?v:d};
const E=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function mode(){try{return String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:(window.APM_DATA_MODE||'Excel')).toLowerCase()}catch(_ ){return 'excel'}}
function isSyn(){return /synthetic/.test(mode())}
function data(){return isSyn()?window.GF377_SYNTH_15M:window.GF377_EXCEL_15M}
function runs(){return isSyn()?window.GF377_SYNTH_RUNS:window.GF377_EXCEL_RUNS}
function snaps(){return isSyn()?window.GF377_SYN_SNAP||window.GF377_SYNTH_SNAP:window.GF377_EXCEL_SNAP}
function site(){return document.querySelector('#view-operationaltwin #tSite')?.value||'SP-01'}
function parse(t){return new Date(String(t).replace(' ','T')).getTime()}
function ftime(t){return new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false})}
function frun(t){return String(t).slice(11,16)}
function siteRuns(){return runs().filter(r=>r.Plant_ID===site()).sort((a,b)=>parse(a.Forecast_Run_Timestamp)-parse(b.Forecast_Run_Timestamp))}
function selectedRun(){const rs=siteRuns();if(!rs.length)return null;if(!RUN||!rs.some(r=>r.Forecast_Run_Timestamp===RUN))RUN=rs[rs.length-1].Forecast_Run_Timestamp;return rs.find(r=>r.Forecast_Run_Timestamp===RUN)||rs[rs.length-1]}
function physics(r,run){const poa=N(r.Forecast_POA_Wm2)*(1+N(run?.POA_Adjustment_Pct)/100),amb=N(r.Ambient_Temp_C),wind=N(r.Wind_Speed_ms),noct=N(r.NOCT_C,45),cap=N(r.AC_Capacity_MW),dcac=N(r.DC_AC_Ratio,1.2),tc=N(r.Module_Temp_Coeff_PctPerC,-.35),soil=N(r.Soiling_Pct),conv=(1-N(r.Base_DC_Loss_Pct)/100)*(1-N(r.Base_AC_Loss_Pct)/100)*(N(r.Transformer_Efficiency_Pct,100)/100)*(N(r.Inverter_Efficiency_Pct,100)/100)*(1-soil/100),mod=amb+(poa/800)*(noct-20)/(1+.08*Math.max(0,wind)),tf=Math.max(.82,Math.min(1.04,1+(tc/100)*(mod-25))),dc=cap*dcac*(poa/1000),weather=Math.min(cap,dc*tf*conv),av=Math.max(0,Math.min(100,N(r.Availability_Pct)+N(run?.Availability_Delta_PctPt))),cu=Math.max(0,Math.min(100,N(r.Curtailment_Pct)+N(run?.Curtailment_Delta_PctPt))),der=Math.max(0,Math.min(3,(80-N(r.Asset_Health_Score))*0.04)),afterAv=weather*av/100,afterCu=afterAv*(1-cu/100),afterAsset=afterCu*(1-der/100),mlPct=Math.max(-8,Math.min(5,N(r.ML_Residual_Pct)+N(run?.ML_Residual_Delta_PctPt))),ml=afterAsset*mlPct/100,del=Math.max(0,afterAsset+ml),unc=Math.min(12,2.5+(N(r.Lead_Hours)/168)*5.5)/100;return {...r,Forecast_POA_Wm2:poa,Module_Temp_C:mod,Weather_Adjusted_Physics_MW:weather,Availability_Pct:av,Curtailment_Pct:cu,Asset_Derate_Pct:der,After_Availability_MW:afterAv,After_Curtailment_MW:afterCu,After_Asset_State_MW:afterAsset,ML_Residual_Pct:mlPct,ML_Residual_Correction_MW:ml,Forecast_Delivered_MW:del,Forecast_Lower_MW:del*(1-unc),Forecast_Upper_MW:del*(1+unc)}}
function series(){const run=selectedRun();if(!run)return[];const all=data().filter(r=>r.Plant_ID===site()&&N(r.Lead_Hours)<=H+.0001);if(!all.length)return[];const latest=siteRuns().slice(-1)[0],shift=parse(run.Forecast_Run_Timestamp)-parse(latest.Forecast_Run_Timestamp);return all.map(r=>{const q=physics(r,run);q.time=parse(r.Interval_Start)+shift;return q})}
function sums(a){const dt=.25,day=a.filter(r=>N(r.ClearSky_AC_Potential_MW)>1),sum=k=>a.reduce((s,r)=>s+N(typeof k==='function'?k(r):r[k])*dt,0),avg=k=>day.length?day.reduce((s,r)=>s+N(r[k]),0)/day.length:0,clear=sum('ClearSky_AC_Potential_MW'),weather=sum('Weather_Adjusted_Physics_MW'),del=sum('Forecast_Delivered_MW');return {clear,weather,del,weatherImpact:clear-weather,operImpact:weather-del,cloud:avg('Cloud_Cover_Pct'),poa:day.length?Math.max(...day.map(r=>N(r.Forecast_POA_Wm2))):0,amb:avg('Ambient_Temp_C'),wind:avg('Wind_Speed_ms'),availability:avg('Availability_Pct'),health:avg('Asset_Health_Score'),curtRisk:day.length?day.filter(r=>N(r.Curtailment_Pct)>0).length/day.length*100:0,curtMWh:sum(r=>N(r.After_Availability_MW)-N(r.After_Curtailment_MW))}}
function chart(a){const W=850,Hh=286,l=42,r=16,t=18,b=34,max=Math.max(1,...a.flatMap(q=>[N(q.ClearSky_AC_Potential_MW),N(q.Weather_Adjusted_Physics_MW),N(q.Forecast_Delivered_MW),N(q.Forecast_Upper_MW)]))*1.07,x=i=>l+i/Math.max(1,a.length-1)*(W-l-r),y=v=>Hh-b-N(v)/max*(Hh-b-t),path=k=>a.map((q,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(q[k]).toFixed(1)).join(' '),up=a.map((q,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(q.Forecast_Upper_MW).toFixed(1)).join(' '),lo=[...a].reverse().map((q,ri)=>{const i=a.length-1-ri;return 'L'+x(i).toFixed(1)+','+y(q.Forecast_Lower_MW).toFixed(1)}).join(' '),grid=[0,.25,.5,.75,1].map(q=>{const yy=Hh-b-q*(Hh-b-t);return `<line x1="${l}" y1="${yy}" x2="${W-r}" y2="${yy}" stroke="#e6edf0"/><text x="4" y="${yy+3}" font-size="8" fill="#78909c">${(max*q).toFixed(0)}</text>`}).join(''),every=H<=24?16:H<=48?32:H<=72?48:96,ticks=a.map((q,i)=>i%every===0?`<text x="${x(i)}" y="${Hh-10}" text-anchor="middle" font-size="8" fill="#78909c">${ftime(q.time)}</text>`:'').join('');return `<div class="gf377-chartwrap"><svg id="gf377Chart" class="gf377-chart" viewBox="0 0 ${W} ${Hh}"><text x="4" y="12" font-size="8" fill="#78909c">MW</text>${grid}<path d="${up}${lo}Z" fill="#16a34a" opacity=".10"/><path d="${path('ClearSky_AC_Potential_MW')}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="7 5"/><path d="${path('Weather_Adjusted_Physics_MW')}" fill="none" stroke="#2563eb" stroke-width="2.4"/><path d="${path('Forecast_Delivered_MW')}" fill="none" stroke="#16a34a" stroke-width="2.8"/><line id="gf377Cursor" x1="${x(SEL)}" x2="${x(SEL)}" y1="${t}" y2="${Hh-b}" stroke="#8d4aa3" stroke-width="1.6"/><circle id="gf377Dot" cx="${x(SEL)}" cy="${y(a[SEL]?.Forecast_Delivered_MW||0)}" r="4" fill="#8d4aa3" stroke="#fff" stroke-width="2"/><rect id="gf377Hit" x="${l}" y="${t}" width="${W-l-r}" height="${Hh-b-t}" fill="transparent"/></svg><div class="gf377-tooltip" id="gf377Tip"></div></div>`}
function formation(q){if(!q)return'';const av=N(q.Weather_Adjusted_Physics_MW)-N(q.After_Availability_MW),cu=N(q.After_Availability_MW)-N(q.After_Curtailment_MW),asset=N(q.After_Curtailment_MW)-N(q.After_Asset_State_MW),endT=new Date(Number(q.time)+15*60000);return `<h3>Forecast Formation · ${ftime(q.time)}–${ftime(endT)}</h3><div class="gf377-formrows"><div class="gf377-formrow"><span>Forecast POA</span><b>${N(q.Forecast_POA_Wm2).toFixed(0)} W/m²</b></div><div class="gf377-formrow"><span>Module temperature</span><b>${N(q.Module_Temp_C).toFixed(1)} °C</b></div><div class="gf377-formrow"><span>Clear-sky AC potential</span><b>${N(q.ClearSky_AC_Potential_MW).toFixed(1)} MW</b></div><div class="gf377-formrow"><span>Weather-adjusted physics</span><b>${N(q.Weather_Adjusted_Physics_MW).toFixed(1)} MW</b></div><div class="gf377-formrow"><span>Availability impact</span><b>−${Math.max(0,av).toFixed(1)} MW</b></div><div class="gf377-formrow"><span>Curtailment impact</span><b>−${Math.max(0,cu).toFixed(1)} MW</b></div><div class="gf377-formrow"><span>Asset-state impact</span><b>−${Math.max(0,asset).toFixed(1)} MW</b></div><div class="gf377-formrow ml"><span>ML residual correction <button class="gf377-model-link" id="gf377ModelLink">Governed model ↗</button></span><b>${N(q.ML_Residual_Correction_MW)>=0?'+':''}${N(q.ML_Residual_Correction_MW).toFixed(1)} MW</b></div><div class="gf377-formrow emph"><span>Forecast delivered AC power</span><b>${N(q.Forecast_Delivered_MW).toFixed(1)} MW</b></div><div class="gf377-formrow emph"><span>15-min delivered energy</span><b>${(N(q.Forecast_Delivered_MW)*0.25).toFixed(2)} MWh</b></div></div><div class="gf377-actions"><button id="gf377Scenario">Simulate Mitigation</button></div>`}
function driverInfo(id,a){const day=a.filter(r=>N(r.ClearSky_AC_Potential_MW)>1),avg=k=>day.length?day.reduce((s,r)=>s+N(r[k]),0)/day.length:0,min=k=>day.length?Math.min(...day.map(r=>N(r[k]))):0,max=k=>day.length?Math.max(...day.map(r=>N(r[k]))):0,cfg={cloud:['Forecast cloud cover','Cloud_Cover_Pct','%','Weather / NWP → irradiance forecast'],poa:['POA irradiance','Forecast_POA_Wm2','W/m²','Weather / NWP → PV physics'],ambient:['Ambient temperature','Ambient_Temp_C','°C','Weather / NWP → module temperature'],wind:['Wind speed','Wind_Speed_ms','m/s','Weather / NWP → module cooling'],availability:['Forecast availability','Availability_Pct','%','Asset state → delivered forecast'],curtailment:['Curtailment','Curtailment_Pct','%','Grid/PPA constraint → delivered forecast']}[id];if(!cfg)return null;return {title:cfg[0],avg:avg(cfg[1]),min:min(cfg[1]),max:max(cfg[1]),unit:cfg[2],path:cfg[3],key:cfg[1]}}
function feed(run){const snap=snaps().find(s=>s.Plant_ID===site()&&s.Forecast_Run_Timestamp===run.Forecast_Run_Timestamp)||{};return `<div class="gf377-feedpanel"><div class="gf377-feedhead"><div><h3>Forecast Input Stream · Run ${frun(run.Forecast_Run_Timestamp)}</h3><div class="sub">${E(site())} · observation window ${frun(run.Observation_Window_Start)}–${frun(run.Observation_Window_End)}</div></div><button class="gf377-feedclose" id="gf377FeedClose">× Close</button></div><div class="gf377-feedgrid"><div class="gf377-feedcard"><h4>SCADA / PLANT</h4><div class="gf377-feedrow"><span>AC power</span><b>${N(snap.SCADA_AC_Power_MW).toFixed(2)} MW</b></div><div class="gf377-feedrow"><span>Availability</span><b>${N(snap.Availability_Pct).toFixed(2)}%</b></div><div class="gf377-feedrow"><span>Timestamp</span><b>${frun(snap.SCADA_Timestamp||run.Observation_Window_End)}</b></div></div><div class="gf377-feedcard"><h4>WEATHER / NWP</h4><div class="gf377-feedrow"><span>POA</span><b>${N(snap.Observed_POA_Wm2).toFixed(0)} W/m²</b></div><div class="gf377-feedrow"><span>Ambient</span><b>${N(snap.Ambient_Temp_C).toFixed(1)} °C</b></div><div class="gf377-feedrow"><span>Wind</span><b>${N(snap.Wind_Speed_ms).toFixed(2)} m/s</b></div><div class="gf377-feedrow"><span>Timestamp</span><b>${frun(snap.Weather_Timestamp||run.Observation_Window_End)}</b></div></div><div class="gf377-feedcard"><h4>ASSET STATE</h4><div class="gf377-feedrow"><span>Health</span><b>${N(snap.Asset_Health_Score).toFixed(1)} / 100</b></div><div class="gf377-feedrow"><span>Soiling</span><b>${N(snap.Soiling_Pct).toFixed(1)}%</b></div><div class="gf377-feedrow"><span>Timestamp</span><b>${frun(snap.Asset_State_Timestamp||run.Observation_Window_End)}</b></div></div><div class="gf377-feedcard"><h4>GRID / PPA</h4><div class="gf377-feedrow"><span>Curtailment</span><b>${N(snap.Curtailment_Pct).toFixed(2)}%</b></div><div class="gf377-feedrow"><span>Run status</span><b>${E(run.Run_Status)}</b></div><div class="gf377-feedrow"><span>Timestamp</span><b>${frun(snap.Grid_Timestamp||run.Observation_Window_End)}</b></div></div></div><div class="gf377-feedcycle"><b style="font:800 8px Arial;color:#dce7ed">15-minute forecast cycle</b><div class="bar"></div><div class="labels"><span>Source capture</span><span>15-min features</span><span>Physics + ML</span><span>Forecast stored</span></div></div></div>`}
function render(){const view=document.getElementById('view-operationaltwin');if(!view)return;let body=view.querySelector('#twBody');if(!body)return;const a=series(),run=selectedRun();if(!a.length||!run){body.innerHTML='<div style="padding:15px">No 15-minute forecast data available.</div>';return}SEL=Math.min(SEL,a.length-1);const z=sums(a),rs=siteRuns(),latest=rs[rs.length-1],historical=run.Forecast_Run_Timestamp!==latest.Forecast_Run_Timestamp,curtSub=z.curtRisk?`${z.curtMWh.toFixed(1)} MWh expected`:'No curtailment forecast';body.innerHTML=`<div class="gf377-shell"><div class="gf377-top"><span class="title">Generation Forecast</span><span class="hlabel">Forecast horizon</span>${[[24,'24 h'],[48,'48 h'],[72,'72 h'],[168,'7 Days']].map(x=>`<button data-gfh="${x[0]}" class="${H===x[0]?'active':''}">${x[1]}</button>`).join('')}</div><div class="gf377-runbar"><div class="gf377-runitem"><span>Forecast run</span><select id="gf377Run">${rs.slice(-4).map(r=>`<option value="${E(r.Forecast_Run_Timestamp)}" ${r.Forecast_Run_Timestamp===run.Forecast_Run_Timestamp?'selected':''}>${frun(r.Forecast_Run_Timestamp)}${r.Forecast_Run_Timestamp===latest.Forecast_Run_Timestamp?' · Latest':''}</option>`).join('')}</select></div><div class="gf377-runitem"><span>Input window</span><b>${frun(run.Observation_Window_Start)}–${frun(run.Observation_Window_End)}</b></div><div class="gf377-runitem"><span>Resolution</span><b>${run.Resolution_Minutes} min</b></div><div class="gf377-runitem"><span>Next scheduled run</span><b>${frun(run.Next_Scheduled_Run)}</b></div><div class="gf377-runitem gf377-current"><span>Status</span><b><i class="gf377-dot"></i>${historical?'Historical run':'Current'}</b></div><button class="gf377-inputbtn" id="gf377ViewInputs">View Forecast Inputs ↗</button></div><div class="gf377-journey"><div class="gf377-step"><span>Clear-Sky AC Potential</span><b>${z.clear.toFixed(1)} MWh</b></div><div class="gf377-step weatherimpact"><span>Forecast Weather Impact</span><b>−${z.weatherImpact.toFixed(1)} MWh</b></div><div class="gf377-step"><span>Weather-Adjusted Generation</span><b>${z.weather.toFixed(1)} MWh</b></div><div class="gf377-step operimpact"><span>Asset / Grid / ML Impact</span><b>−${z.operImpact.toFixed(1)} MWh</b></div><div class="gf377-step final"><span>Forecast Delivered Energy</span><b>${z.del.toFixed(1)} MWh</b></div></div><div class="gf377-drivers"><button class="gf377-driver" data-driver="cloud" title="Inspect forecast input source"><i class="gf377-drill">ⓘ</i><span class="label">Forecast cloud cover</span><b>${z.cloud.toFixed(1)}%</b><small>daylight average</small></button><button class="gf377-driver" data-driver="poa" title="Inspect forecast input source"><i class="gf377-drill">ⓘ</i><span class="label">POA irradiance</span><b>${z.poa.toFixed(0)} W/m²</b><small>forecast peak</small></button><button class="gf377-driver" data-driver="ambient" title="Inspect forecast input source"><i class="gf377-drill">ⓘ</i><span class="label">Ambient temperature</span><b>${z.amb.toFixed(1)} °C</b><small>daylight average</small></button><button class="gf377-driver" data-driver="wind" title="Inspect forecast input source"><i class="gf377-drill">ⓘ</i><span class="label">Wind speed</span><b>${z.wind.toFixed(1)} m/s</b><small>daylight average</small></button><button class="gf377-driver" data-driver="availability" title="Inspect forecast availability basis"><i class="gf377-drill">ⓘ</i><span class="label">Forecast availability</span><b>${z.availability.toFixed(2)}%</b><small>15-min forecast average</small></button><button class="gf377-driver" data-driver="curtailment" title="Open Commercial & PPA"><i class="gf377-drill">↗</i><span class="label">Curtailment risk</span><b>${z.curtRisk.toFixed(1)}%</b><small>${curtSub}</small></button></div><div class="gf377-main"><section class="gf377-chartpanel"><h3>${H===168?'7-day':H+'-hour'} generation forecast profile</h3>${chart(a)}<div class="gf377-legend"><span><i style="--c:#f59e0b"></i>Clear-sky AC</span><span><i style="--c:#2563eb"></i>Weather-adjusted physics</span><span><i style="--c:#16a34a"></i>Delivered forecast</span><span>Shaded = forecast range</span></div></section><aside class="gf377-formpanel" id="gf377Formation">${formation(a[SEL])}</aside></div></div>`;bind(a,run)}
function setGFReturnContext(){
  window.AIP_RETURN_CONTEXT={
    view:'operationaltwin',
    twinLayer:'Predictive Outlook',
    displayLayer:'Generation Forecast',
    site:(document.querySelector('#view-operationaltwin #tSite')?.value||window.AIP_TWIN_SITE||''),
    source:(window.APM_DATA_MODE||'')
  };
}
function bind(a,run){document.querySelectorAll('#view-operationaltwin [data-gfh]').forEach(b=>b.addEventListener('click',()=>{H=N(b.dataset.gfh,24);SEL=0;render()}));document.querySelector('#gf377Run')?.addEventListener('change',e=>{RUN=e.target.value;SEL=0;render()});document.querySelector('#gf377ViewInputs')?.addEventListener('click',()=>openForecastInputs(run));document.querySelectorAll('#view-operationaltwin [data-driver]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.driver;if(['cloud','poa','ambient','wind'].includes(id)){openForecastInputs(run,'weather',id);return}if(id==='availability'){openForecastInputs(run,'availability','availability');return}if(id==='curtailment'){setGFReturnContext();window.openRevenueCommercialTab?.('commercialppa');return}}));wireFormation();const svg=document.querySelector('#gf377Chart'),hit=document.querySelector('#gf377Hit'),tip=document.querySelector('#gf377Tip');if(!svg||!hit)return;const choose=e=>{const rect=svg.getBoundingClientRect(),vx=(e.clientX-rect.left)/Math.max(1,rect.width)*850,left=42,right=16,idx=Math.round((vx-left)/Math.max(1,850-left-right)*(a.length-1));SEL=Math.max(0,Math.min(a.length-1,idx));const form=document.querySelector('#gf377Formation');if(form){form.innerHTML=formation(a[SEL]);wireFormation()}const q=a[SEL],max=Math.max(1,...a.flatMap(x=>[N(x.ClearSky_AC_Potential_MW),N(x.Weather_Adjusted_Physics_MW),N(x.Forecast_Upper_MW)]))*1.07,x=left+SEL/Math.max(1,a.length-1)*(850-left-right),y=286-34-N(q.Forecast_Delivered_MW)/max*(286-34-18),cur=document.querySelector('#gf377Cursor'),dot=document.querySelector('#gf377Dot');if(cur){cur.setAttribute('x1',x);cur.setAttribute('x2',x)}if(dot){dot.setAttribute('cx',x);dot.setAttribute('cy',y)}if(tip){tip.innerHTML=`<b>${ftime(q.time)} · Delivered ${N(q.Forecast_Delivered_MW).toFixed(1)} MW</b><br><span class="muted">POA</span> ${N(q.Forecast_POA_Wm2).toFixed(0)} W/m² · <span class="muted">Cloud</span> ${N(q.Cloud_Cover_Pct).toFixed(0)}%<br><span class="muted">Weather physics</span> ${N(q.Weather_Adjusted_Physics_MW).toFixed(1)} MW · <span class="muted">ML</span> ${N(q.ML_Residual_Correction_MW)>=0?'+':''}${N(q.ML_Residual_Correction_MW).toFixed(1)} MW`;tip.style.display='block';tip.style.left=Math.max(4,Math.min(rect.width-190,e.clientX-rect.left+8))+'px';tip.style.top=Math.max(3,e.clientY-rect.top-66)+'px'}};hit.addEventListener('mousemove',choose);hit.addEventListener('click',choose);hit.addEventListener('mouseleave',()=>{if(tip)tip.style.display='none'})}
function wireFormation(){
  const modelLink=document.querySelector('#gf377ModelLink');
  if(modelLink){
    modelLink.onclick=()=>{
      setGFReturnContext();
      const target=document.querySelector('.nav-item[data-view="models"]');
      if(target)target.click();
    };
  }
  const scenario=document.querySelector('#gf377Scenario');
  if(scenario){
    scenario.onclick=()=>{
      window.AIP_GF_SCENARIO_ORIGIN={
        site:(document.querySelector('#view-operationaltwin #tSite')?.value||window.AIP_TWIN_SITE||'')
      };
      if(typeof window.AIPActivateOperationalTwinLayer==='function'){
        window.AIPActivateOperationalTwinLayer('Scenario Lab');
        return;
      }
      const tab=[...document.querySelectorAll('#view-operationaltwin #tLayers .xi-tab')].find(x=>x.textContent.trim()==='Scenario Lab');
      if(tab&&typeof tab.onclick==='function')tab.onclick();
      else if(tab)tab.click();
    };
  }
}
function openForecastInputs(run,section,field){
  let f=document.getElementById('gf377Feed');
  if(!f){f=document.createElement('div');f.id='gf377Feed';document.body.appendChild(f)}
  f.innerHTML=feed(run);
  f.classList.add('open');
  document.body.classList.add('gf377-feed-open');
  const panel=f.querySelector('.gf377-feedpanel');

  if(panel&&section==='weather'){
    const cards=[...panel.querySelectorAll('.gf377-feedcard')];
    const weather=cards.find(c=>/WEATHER \/ NWP/i.test(c.querySelector('h4')?.textContent||''));
    if(weather){
      weather.style.outline='2px solid #5bc0de';
      weather.style.outlineOffset='2px';
      const label={cloud:'Cloud cover / NWP',poa:'POA irradiance',ambient:'Ambient temperature',wind:'Wind speed'}[field];
      if(label){
        const note=document.createElement('div');
        note.style.cssText='margin:8px 0 0;padding:7px 9px;border-radius:7px;background:#123746;color:#dff6ff;font:700 9px Arial';
        note.textContent='Focused input: '+label+' · source values are read from the selected Excel/Synthetic forecast dataset';
        weather.appendChild(note);
      }
    }
  }

  if(panel&&section==='availability'){
    const a=series();
    const base=a.length?N(a[0].Availability_Pct):0;
    const forecast=a.length?sums(a).availability:base;
    const grid=panel.querySelector('.gf377-feedgrid');
    if(grid){
      const card=document.createElement('div');
      card.className='gf377-feedcard';
      card.style.outline='2px solid #7c3aed';
      card.style.outlineOffset='2px';
      card.innerHTML=`<h4>AVAILABILITY FORECAST BASIS</h4>
        <div class="gf377-feedrow"><span>15-min source availability</span><b>${base.toFixed(2)}%</b></div>
        <div class="gf377-feedrow"><span>Selected-horizon average</span><b>${forecast.toFixed(2)}%</b></div>
        <div class="gf377-feedrow"><span>Source</span><b>${isSyn()?'Synthetic':'Excel'} · Generation Forecast 15m</b></div>
        <div style="margin-top:8px;padding:7px 9px;border-radius:7px;background:#24183b;color:#eadcff;font:700 9px Arial">No separate planned-outage or predicted-unavailability component is shown because the current dataset does not provide those fields.</div>`;
      grid.appendChild(card);
    }
  }

  f.querySelector('#gf377FeedClose')?.addEventListener('click',closeFeed);
  f.addEventListener('click',e=>{if(e.target===f)closeFeed()},{once:true});
}
function closeFeed(){const f=document.getElementById('gf377Feed');f?.classList.remove('open');document.body.classList.remove('gf377-feed-open')}
document.addEventListener('change',e=>{if(e.target?.matches?.('#view-operationaltwin #tSite')){RUN=null;SEL=0;if(document.querySelector('#view-operationaltwin #tLayers .xi-tab.active')?.textContent.trim()==='Generation Forecast')setTimeout(render,0)}},false);
window.AIPRenderGenerationForecast=render;
window.AIPRenderOperationalTwinPredictiveOutlook=render;
})();
