
(function(){
'use strict';
const EXCEL=__AIP_DS("5b9c72d2c4074494");
const SYNTH=__AIP_DS("3d3bf6fab6e3113e");
function installData(){window.EMBEDDED_EXCEL_DATA=window.EMBEDDED_EXCEL_DATA||{};Object.assign(window.EMBEDDED_EXCEL_DATA,EXCEL);window.AIP_INDEPENDENT_SYNTHETIC_DATA=window.AIP_INDEPENDENT_SYNTHETIC_DATA||{};Object.assign(window.AIP_INDEPENDENT_SYNTHETIC_DATA,SYNTH);}
installData();
const oldIntegrations=window.EMBEDDED_EXCEL_DATA?.Integrations;if(Array.isArray(oldIntegrations)){oldIntegrations.forEach(r=>{if(r.System_Name==='Weather API'){r.System_Name='Solar Resource & Weather Intelligence';r.Purpose='Plant met context + specialist irradiance/weather nowcast and 72 h forecast';}})}
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const n=(v,d=0)=>{const x=Number(v);return Number.isFinite(x)?x:d};
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
function synth(){const m=String(window.APM_DATA_MODE||'').toLowerCase();return window.AIP_SYNTHETIC_ACTIVE===true||/synthetic|demo data/.test(m)}
function rows(k){return (synth()?window.AIP_INDEPENDENT_SYNTHETIC_DATA:window.EMBEDDED_EXCEL_DATA)?.[k]||[]}
function pid(){return $('#tSite')?.value||window.AIP_TWIN_SITE||rows('Twin Engineering Parameters')[0]?.Plant_ID||'SP-01'}
function solarWindow(){
 const p=rows('Twin Engineering Parameters').find(x=>String(x.Plant_ID)===String(pid()))||{};
 const parse=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);return m?+m[1]+(+m[2]/60):NaN};
 let start=parse(p.Solar_Window_Start_Local),end=parse(p.Solar_Window_End_Local);
 if(!Number.isFinite(start))start=6;if(!Number.isFinite(end))end=19;
 return {start,end,source:String(p.Solar_Window_Source||'Solar Resource & Weather Intelligence'),method:String(p.Solar_Window_Method||'Site-derived')};
}
function profile(mode='Observed'){
 const w=solarWindow();
 return rows('Twin Telemetry').filter(r=>String(r.Plant_ID)===String(pid())&&String(r.Weather_Mode)===mode&&hourOf(r)>=w.start-.001&&hourOf(r)<=w.end+.001);
}
function hourOf(r){const s=String(r.Timestamp||'');const m=s.match(/ (\d\d):(\d\d)/);return m?+m[1]+(+m[2]/60):0}
function current(){const a=profile('Observed');if(!a.length)return {};const h=n($('#tTime')?.value,12);return a.reduce((best,r)=>Math.abs(hourOf(r)-h)<Math.abs(hourOf(best)-h)?r:best,a[0])}
function fmtHour(h){let hh=Math.floor(h),mm=Math.round((h-hh)*60);if(mm===60){hh++;mm=0}return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0')}
function operatingDayContext(){
 const a=profile('Observed'),raw=String(a[0]?.Timestamp||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return 'Operating Day · Observed';
 const [y,m,d]=raw.split('-').map(Number),label=new Date(y,m-1,d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
 const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const state=raw===today?'Observed':raw<today?'Historical':'Forecast';
 return `Operating Day · ${label} · ${state}`;
}
function updateSolarSliderFill(range){
 if(!range)return;
 const min=Number(range.min),max=Number(range.max),val=Number(range.value);
 const pct=((val-min)/Math.max(.001,max-min))*100;
 range.style.setProperty('--ot341-fill',Math.max(0,Math.min(100,pct)).toFixed(2)+'%');
}
function syncSolarWindowUI(view){
 view=view||$('#view-operationaltwin');if(!view)return;
 const sw=solarWindow(),range=$('#tTime',view),rangeText=$('.ot299-time-range',view),hour=$('#tHour',view);
 if(range){
   range.min=sw.start;range.max=sw.end;range.step=.25;
   let tv=+range.value;if(!Number.isFinite(tv))tv=12;
   tv=Math.max(sw.start,Math.min(sw.end,tv));range.value=tv;
   window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};
   window.AIP_V21.state.time=tv;
   if(hour)hour.textContent=fmtHour(tv);
   updateSolarSliderFill(range);
 }
 if(rangeText){
   rangeText.textContent=`Solar Window · ${fmtHour(sw.start)}–${fmtHour(sw.end)} · Site-derived`;
   rangeText.title=`${sw.source} · ${sw.method}`;
 }
 const dayBadge=$('#ot325OperatingDay',view);
 if(dayBadge)dayBadge.textContent='Data Operating Day · '+operatingDayContext()+' · Latest telemetry';
}
function kpis(r){const arr=[['Weather-adjusted expected',n(r.Weather_Adjusted_Expected_AC_MW).toFixed(1)+' MW','physics + weather','#1687b1'],['Delivered AC power',n(r.Actual_AC_MW).toFixed(1)+' MW','plant / POI','#20a36a'],['Performance ratio',n(r.PR_Pct).toFixed(1)+'%','irradiance normalized','#7e57c2'],['Weather impact',n(r.Weather_Loss_MW).toFixed(1)+' MW','clear-sky gap','#e7a328'],['Plant / operational gap',n(r.Plant_Operational_Loss_MW).toFixed(1)+' MW','weather expected → delivered','#d65353']];return `<div class="ot297-kpis">${arr.map(x=>`<div class="ot297-kpi" style="--bar:${x[3]}"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('')}</div>`}
function path(a,key,W,H,pad,max){return a.map((r,i)=>{const x=pad+i/(Math.max(1,a.length-1))*(W-pad*1.35),y=H-pad-n(r[key])/max*(H-pad*1.75);return(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' ')}
function liveSVG(a,cur){const W=820,H=260,p=38,max=Math.max(1,...a.flatMap(r=>[n(r.ClearSky_AC_Potential_MW),n(r.Weather_Adjusted_Expected_AC_MW),n(r.Actual_AC_MW)]))*1.08;const grid=[0,.25,.5,.75,1].map(q=>{const y=H-p-q*(H-p*1.75);return `<line x1="${p}" y1="${y}" x2="${W-18}" y2="${y}" stroke="#e2eaee"/><text x="4" y="${y+3}" font-size="8" fill="#78909c">${(max*q).toFixed(0)} MW</text>`}).join('');const ticks=[6,8,10,12,14,16,18].map(h=>{let idx=a.reduce((bi,r,i)=>Math.abs(hourOf(r)-h)<Math.abs(hourOf(a[bi])-h)?i:bi,0),x=p+idx/(a.length-1)*(W-p*1.35);return `<text x="${x}" y="${H-8}" text-anchor="middle" font-size="8" fill="#78909c">${String(h).padStart(2,'0')}:00</text>`}).join('');const ci=a.indexOf(cur),mx=p+ci/(Math.max(1,a.length-1))*(W-p*1.35);return `<svg class="ot297-chart" viewBox="0 0 ${W} ${H}" aria-label="Solar and weather operating profile">${grid}<path d="${path(a,'ClearSky_AC_Potential_MW',W,H,p,max)}" fill="none" stroke="#f59e0b" stroke-width="2.6" stroke-dasharray="8 5"/><path d="${path(a,'Weather_Adjusted_Expected_AC_MW',W,H,p,max)}" fill="none" stroke="#1687b1" stroke-width="3"/><path d="${path(a,'Actual_AC_MW',W,H,p,max)}" fill="none" stroke="#16a34a" stroke-width="3"/><line x1="${mx}" y1="22" x2="${mx}" y2="${H-p}" stroke="#c026d3" stroke-width="2.5"/><circle cx="${mx}" cy="${H-p-n(cur.Actual_AC_MW)/max*(H-p*1.75)}" r="5.5" fill="#c026d3"/><text x="${Math.min(W-85,mx+6)}" y="18" class="ot297-marker-label">${fmtHour(hourOf(cur))}</text>${ticks}</svg>`}
function prSVG(a,cur){const W=820,H=70,p=30,min=55,max=95,xy=(i,v)=>[p+i/(a.length-1)*(W-p*1.35),H-16-(Math.max(min,Math.min(max,v))-min)/(max-min)*(H-28)];let d=a.map((r,i)=>{let [x,y]=xy(i,n(r.PR_Pct));return(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' '),ci=a.indexOf(cur),[x,y]=xy(ci,n(cur.PR_Pct));return `<svg class="ot297-chart" viewBox="0 0 ${W} ${H}"><line x1="${p}" y1="${H-16}" x2="${W-18}" y2="${H-16}" stroke="#e2eaee"/><path d="${d}" fill="none" stroke="#7e57c2" stroke-width="2"/><line x1="${x}" y1="8" x2="${x}" y2="${H-16}" stroke="#c026d3" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="3.5" fill="#7e57c2"/><text x="4" y="16" font-size="8" fill="#78909c">PR %</text></svg>`}
function sourceStrip(r){return `<div class="ot297-source"><span class="ot297-dot"></span><b>Solar Resource & Weather Intelligence</b></div>`}
function renderLive(){const body=$('#twBody'),a=profile('Observed'),r=current();if(!body||!a.length)return;const topHour=$('#tHour');if(topHour)topHour.textContent=fmtHour(hourOf(r));$('#tKpis').innerHTML='';body.innerHTML=sourceStrip(r)+`<div class="ot297-live"><section class="ot297-card"><div class="ot311-livehead"><h3>Solar & Weather Operating Profile</h3><div class="ot311-pr"><span>Performance Ratio</span><b>${n(r.PR_Pct).toFixed(1)}%</b><small>at ${fmtHour(hourOf(r))}</small></div></div><div class="ot297-weather"><div><span>POA irradiance</span><b>${n(r.POA_Wm2).toFixed(0)} W/m²</b></div><div><span>Cloud cover</span><b>${n(r.Cloud_Cover_Pct).toFixed(1)}%</b></div><div><span>Ambient temperature</span><b>${n(r.Ambient_Temp_C).toFixed(1)} °C</b></div><div><span>Module temperature</span><b>${n(r.Module_Temp_C).toFixed(1)} °C</b></div><div><span>Wind speed</span><b>${n(r.Wind_Speed_ms).toFixed(1)} m/s</b></div></div>${liveSVG(a,r)}<div class="ot297-legend"><span><i class="lg-clear"></i>Clear-sky AC potential · dashed</span><span><i class="lg-weather"></i>Weather-adjusted expected AC</span><span><i class="lg-delivered"></i>Delivered AC</span><span><i class="lg-hour"></i>Selected solar hour</span></div><div class="ot297-prstrip"><h4>Performance Ratio</h4>${prSVG(a,r)}</div></section><aside class="ot297-card"><h3>Causal Decomposition — ${fmtHour(hourOf(r))}</h3><div class="ot297-causal" style="margin-top:9px"><div class="ot297-good"><span>Clear-sky AC potential</span><b>${n(r.ClearSky_AC_Potential_MW).toFixed(1)} MW</b></div><div class="ot297-gap"><span>Weather / resource impact</span><b>−${n(r.Weather_Loss_MW).toFixed(1)} MW</b></div><div><span>Weather-adjusted expected</span><b>${n(r.Weather_Adjusted_Expected_AC_MW).toFixed(1)} MW</b></div><div class="ot297-gap plant"><span>Plant / operational impact</span><b>−${n(r.Plant_Operational_Loss_MW).toFixed(1)} MW</b></div><div class="ot297-good"><span>Delivered at POI</span><b>${n(r.Actual_AC_MW).toFixed(1)} MW</b></div></div></aside></div>`}

function renderAssetCondition(){
 const body=$('#twBody');if(!body)return;
 $('#tKpis').innerHTML='';
 const plantId=pid();
 const assetSource=(()=>{
   const modeSynth=synth();
   let imported=[],embedded=[],synthetic=[];
   try{if(typeof APM_IMPORTED_DATA!=='undefined'&&Array.isArray(APM_IMPORTED_DATA?.['Asset Master']))imported=APM_IMPORTED_DATA['Asset Master'];}catch(_){}
   try{if(typeof EMBEDDED_EXCEL_DATA!=='undefined'&&Array.isArray(EMBEDDED_EXCEL_DATA?.['Asset Master']))embedded=EMBEDDED_EXCEL_DATA['Asset Master'];}catch(_){}
   try{if(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined'&&Array.isArray(AIP_INDEPENDENT_SYNTHETIC_DATA?.['Asset Master']))synthetic=AIP_INDEPENDENT_SYNTHETIC_DATA['Asset Master'];}catch(_){}
   if(!imported.length&&Array.isArray(window.APM_IMPORTED_DATA?.['Asset Master']))imported=window.APM_IMPORTED_DATA['Asset Master'];
   if(!embedded.length&&Array.isArray(window.EMBEDDED_EXCEL_DATA?.['Asset Master']))embedded=window.EMBEDDED_EXCEL_DATA['Asset Master'];
   if(!synthetic.length&&Array.isArray(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.['Asset Master']))synthetic=window.AIP_INDEPENDENT_SYNTHETIC_DATA['Asset Master'];
   return modeSynth?(synthetic.length?synthetic:(embedded.length?embedded:imported)):(imported.length?imported:(embedded.length?embedded:synthetic));
 })();
 const normSite=v=>{const x=String(v??'').trim().toUpperCase();const mm=x.match(/^(?:SP|SOL)[-_ ]?0*(\d+)$/);return mm?'SP-'+String(Number(mm[1])).padStart(2,'0'):x};
 const siteAssets=assetSource.filter(a=>normSite(a.Plant_ID??a.Site_ID??a.Plant??a.Site)===normSite(plantId));
 const plant=rows('Twin Engineering Parameters').find(x=>normSite(x.Plant_ID)===normSite(plantId))||{};
 const plantName=String(plant.Plant_Name||plantId);
 const classes=[...new Set(siteAssets.map(a=>String(a.Asset_Class||'Unclassified')).filter(Boolean))].sort();
 const activeClass=String(window.AIP_OT_ASSET_CLASS_FILTER||'All');
 const shown=activeClass==='All'?siteAssets:siteAssets.filter(a=>String(a.Asset_Class||'Unclassified')===activeClass);
 const healthStatus=h=>{
   try{
     const s=window.AIPHealthModel?.status?.(h);
     if(s&&s.label)return s;
   }catch(_){}
   const v=n(h,0);
   return {key:v>=80?'healthy':v>=65?'watch':'critical',label:v>=80?'Healthy':v>=65?'Watch':'Critical'};
 };
 const navContext=(a,target)=>{
   const ctx={
     source:'Operational Twin · Asset Condition',
     originView:'operationaltwin',
     originTwinTab:'Asset Condition',
     originSolarHour:+($('#tTime')?.value||window.AIP_V21?.state?.time||12),
     assetId:String(a.Asset_ID||''),
     tag:String(a.Asset_Tag||a.Asset_ID||''),
     siteId:String(a.Plant_ID||plantId),
     site:plantName,
     assetClass:String(a.Asset_Class||''),
     target,
     timestamp:Date.now()
   };
   window.AIP_CONTEXT_NAV=ctx;
   window.AIP_SELECTED_ASSET_CONTEXT={...(window.AIP_SELECTED_ASSET_CONTEXT||{}),...ctx};
   try{sessionStorage.setItem('aip.context.nav',JSON.stringify(ctx))}catch(_){}
   return ctx;
 };
 const openAsset=a=>{
   navContext(a,'assetexplorer');
   try{window.activate?.('assetexplorer',true)}catch(_){document.querySelector('[data-view="assetexplorer"]')?.click()}
   const apply=()=>{try{window.AIPAssetExplorerController?.selectAsset?.(String(a.Asset_ID||''));}catch(_){}};
   requestAnimationFrame(apply);setTimeout(apply,80);setTimeout(apply,220);
 };
 const openHealth=a=>{
   navContext(a,'assethealthmodel');
   try{window.activate?.('assethealthmodel',true)}catch(_){document.querySelector('[data-view="assethealthmodel"]')?.click()}
 };
 body.innerHTML=`<section class="ot297-card ot324-condition" data-ot324-assets="${siteAssets.length}">
   <div class="ot324-head">
     <div><h3>Asset Condition — ${esc(plantName)}</h3><div class="ot321-asset-scope">${siteAssets.length} registered assets · ${classes.length} asset classes · selected site ${esc(plantId)}</div></div>
     <label class="ot324-filter"><span>Asset Class</span><select id="ot324AssetClass"><option value="All">All (${siteAssets.length})</option>${classes.map(c=>`<option value="${esc(c)}" ${c===activeClass?'selected':''}>${esc(c)} (${siteAssets.filter(a=>String(a.Asset_Class||'Unclassified')===c).length})</option>`).join('')}</select></label>
   </div>
   <div class="table-scroll ot324-tablewrap"><table class="xi-table tw-table ot324-table"><thead><tr>
     <th>Asset ID / Tag</th><th>Class</th><th>Health Score</th><th>Health Status</th><th>Operating Status</th>
   </tr></thead><tbody>${shown.length?shown.map(a=>{
     const h=n(a.Health_Score??a.Asset_Health_Score,0),hs=healthStatus(h),id=String(a.Asset_ID||''),tag=String(a.Asset_Tag||id),op=String(a.Operating_Status||'Not recorded');
     return `<tr data-ot324-asset="${esc(id)}">
       <td><button type="button" class="ot324-link ot324-asset-link" title="Open this asset in Asset Explorer"><b>${esc(tag)}</b><small>${esc(id)}</small><span class="ot324-arrow" aria-hidden="true">↗</span></button></td>
       <td>${esc(String(a.Asset_Class||'Unclassified'))}</td>
       <td><button type="button" class="ot324-link ot324-health-link" title="Open governed Asset Health Scoring Framework"><span class="tw-health ${esc(hs.key||'unknown')}">${h.toFixed(0)}</span><span class="ot324-arrow" aria-hidden="true">↗</span></button></td>
       <td><span class="ot324-status ${esc(hs.key||'unknown')}">${esc(hs.label||'No data')}</span></td>
       <td>${esc(op)}</td>
     </tr>`;
   }).join(''):`<tr><td colspan="5">No asset records available for ${esc(plantName)}.</td></tr>`}</tbody></table></div>
 </section>`;
 const sel=$('#ot324AssetClass',body);if(sel)sel.onchange=e=>{window.AIP_OT_ASSET_CLASS_FILTER=e.target.value;renderAssetCondition()};
 body.querySelectorAll('[data-ot324-asset]').forEach(tr=>{
   const a=siteAssets.find(x=>String(x.Asset_ID||'')===String(tr.dataset.ot324Asset));
   if(!a)return;
   tr.querySelector('.ot324-asset-link')?.addEventListener('click',()=>openAsset(a));
   tr.querySelector('.ot324-health-link')?.addEventListener('click',()=>openHealth(a));
 });
}
function lossRec(){return rows('Twin Loss Model').find(x=>String(x.Plant_ID)===String(pid()))||{}}
function lossSeries(){
 const L=lossRec(),a=profile('Observed').slice().sort((x,y)=>hourOf(x)-hourOf(y)),dt=.25;
 const cats=[
  {key:'weather',label:'Weather / resource',field:'Weather_Resource_Loss_MWh',color:'#1565c0',w:r=>Math.max(.001,n(r.Weather_Loss_MW))},
  {key:'temp',label:'Temperature',field:'Temperature_Loss_MWh',color:'#e53935',w:r=>Math.max(.001,(n(r.Module_Temp_C)-25)*Math.max(0,n(r.POA_Wm2))/1000)},
  {key:'soil',label:'Soiling',field:'Soiling_Loss_MWh',color:'#43a047',w:r=>Math.max(.001,(1-n(r.Soiling_Ratio,1))*Math.max(0,n(r.POA_Wm2))/1000)},
  {key:'shade',label:'Shading / mismatch',field:'Shading_Loss_MWh',color:'#8e24aa',w:r=>{const h=hourOf(r),edge=Math.max(0,1-Math.abs(h-12.5)/6.5);return Math.max(.001,(1-edge)*Math.max(0,n(r.POA_Wm2))/1000)}},
  {key:'clip',label:'Clipping',field:'Clipping_Loss_MWh',color:'#fb8c00',w:r=>Math.max(.001,Math.max(0,n(r.Expected_DC_MW)-n(r.ClearSky_AC_Potential_MW)))},
  {key:'curt',label:'Curtailment',field:'Curtailment_Loss_MWh',color:'#00acc1',w:r=>Math.max(.001,n(r.Curtailment_Pct)*Math.max(0,n(r.Weather_Adjusted_Expected_AC_MW))/100)},
  {key:'avail',label:'Availability / condition',field:'Availability_Loss_MWh',color:'#3949ab',w:r=>Math.max(.001,(100-n(r.Availability_Pct,100))*Math.max(0,n(r.Weather_Adjusted_Expected_AC_MW))/100 + (100-n(r.Asset_Health_Score,100))*Math.max(0,n(r.Weather_Adjusted_Expected_AC_MW))/900)},
  {key:'degr',label:'Degradation',field:'Degradation_Loss_MWh',color:'#6d4c41',w:r=>Math.max(.001,Math.max(0,n(r.Weather_Adjusted_Expected_AC_MW)))},
  {key:'xac',label:'Transformer / AC',field:'Transformer_AC_Loss_MWh',color:'#00897b',w:r=>Math.max(.001,Math.max(0,n(r.Weather_Adjusted_Expected_AC_MW)))},
  {key:'resid',label:'Residual',field:'Residual_Loss_MWh',color:'#c0ca33',w:r=>Math.max(.001,Math.max(0,n(r.Plant_Operational_Loss_MW)))}
 ];
 const weights={};
 cats.forEach(c=>{const raw=a.map(r=>c.w(r));const sum=raw.reduce((s,v)=>s+v,0)||1;const total=n(L[c.field]);weights[c.key]=raw.map(v=>total*v/sum)});
 const norm=(field,total)=>{const raw=a.map(r=>Math.max(0,n(r[field]))*dt),sum=raw.reduce((s,v)=>s+v,0)||1;return raw.map(v=>n(total)*v/sum)};
 const gross=norm('ClearSky_AC_Potential_MW',L.Gross_Expected_MWh);
 const weatherExpected=norm('Weather_Adjusted_Expected_AC_MW',L.Weather_Adjusted_Expected_MWh);
 const actual=norm('Actual_AC_MW',L.Actual_MWh);
 return {L,a,dt,cats,weights,gross,weatherExpected,actual}
}
function lossAtSelected(){
 const z=lossSeries(),h=n($('#tTime')?.value,12),idx=Math.max(0,z.a.reduce((best,r,i)=>Math.abs(hourOf(r)-h)<Math.abs(hourOf(z.a[best])-h)?i:best,0));
 const sumTo=v=>v.slice(0,idx+1).reduce((s,x)=>s+x,0);
 const vals={};z.cats.forEach(c=>vals[c.key]=sumTo(z.weights[c.key]));
 return {...z,idx,hour:hourOf(z.a[idx]||{}),vals,grossCum:sumTo(z.gross),weatherCum:sumTo(z.weatherExpected),actualCum:sumTo(z.actual)}
}
function lossProfileSVG(z){
 const W=820,H=225,p=40,dt=z.dt||.25;
 const principal=[
  {key:'weather',label:'Weather / resource',color:'#1565c0'},
  {key:'temp',label:'Temperature',color:'#e53935'},
  {key:'soil',label:'Soiling',color:'#43a047'},
  {key:'avail',label:'Availability / condition',color:'#3949ab'},
  {key:'curt',label:'Curtailment',color:'#00acc1'},
  {key:'other',label:'Other governed losses',color:'#6d4c41'}
 ];
 const otherKeys=['shade','clip','degr','xac','resid'];
 const series=principal.map(c=>({ ...c, v:c.key==='other'?z.a.map((_,i)=>otherKeys.reduce((s,k)=>s+n(z.weights[k]?.[i]),0)/dt):z.weights[c.key].map(v=>v/dt)}));
 const max=Math.max(1,...series.flatMap(s=>s.v))*1.10,span=W-p-18;
 const visibleSeries=series.filter(s=>Math.max(...s.v) >= max*.012);
 const xy=(i,v)=>[p+i/Math.max(1,z.a.length-1)*span,H-p-v/max*(H-p-24)];
 const grid=[0,.25,.5,.75,1].map(q=>{const y=H-p-q*(H-p-24);return `<line x1="${p}" y1="${y}" x2="${W-18}" y2="${y}" stroke="#e2eaee"/><text x="3" y="${y+3}" font-size="8" fill="#78909c">${(max*q).toFixed(1)}</text>`}).join('');
 const lines=series.map(s=>{const d=s.v.map((v,i)=>{const [x,y]=xy(i,v);return(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' ');return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.key==='weather'?2.6:2}"/>`}).join('');
 const ticks=[6,8,10,12,14,16,18].map(h=>{let i=z.a.reduce((b,r,j)=>Math.abs(hourOf(r)-h)<Math.abs(hourOf(z.a[b])-h)?j:b,0),x=p+i/Math.max(1,z.a.length-1)*span;return `<text x="${x}" y="${H-8}" text-anchor="middle" font-size="8" fill="#78909c">${String(h).padStart(2,'0')}:00</text>`}).join('');
 const mx=p+z.idx/Math.max(1,z.a.length-1)*span;
 return `<svg class="ot297-chart" viewBox="0 0 ${W} ${H}" aria-label="Intraday loss profile"><text x="4" y="12" font-size="8" fill="#78909c">MW loss</text>${grid}${lines}<line x1="${mx}" y1="18" x2="${mx}" y2="${H-p}" stroke="#c026d3" stroke-width="2.3"/><text x="${Math.min(W-80,mx+5)}" y="17" class="ot297-marker-label">${fmtHour(z.hour)}</text>${ticks}</svg>`
}
function renderLoss(){
 const body=$('#twBody'),z=lossAtSelected(),L=z.L,r=current();if(!body||!z.a.length)return;
 const topHour=$('#tHour');if(topHour)topHour.textContent=fmtHour(z.hour);
 $('#tKpis').innerHTML='';
 const mx=Math.max(.01,...z.cats.map(c=>n(z.vals[c.key])));
 const recoveryKeys=['soil','curt','avail','resid'];
 const fullRecoveryDrivers=Math.max(.001,z.cats.filter(c=>recoveryKeys.includes(c.key)).reduce((s,c)=>s+n(L[c.field]),0));
 const cumRecoveryDrivers=z.cats.filter(c=>recoveryKeys.includes(c.key)).reduce((s,c)=>s+n(z.vals[c.key]),0);
 const recoverableCum=n(L.Recoverable_MWh)*(cumRecoveryDrivers/fullRecoveryDrivers);
 body.innerHTML=`<section class="ot297-card"><h3>Physics & Loss Reconciliation — through ${fmtHour(z.hour)}</h3><div class="ot303-recon-note">15-minute operational telemetry · cumulative from start of solar day to selected Solar Hour</div><div class="ot297-waterfall"><div><b>${z.grossCum.toFixed(1)}</b><span>Clear-sky reference MWh</span></div><em>→</em><div><b>${z.weatherCum.toFixed(1)}</b><span>Weather-adjusted expected MWh</span></div><em>→</em><div><b>${z.actualCum.toFixed(1)}</b><span>Delivered MWh</span></div></div><div class="ot305-losstitle">Loss Attribution — through ${fmtHour(z.hour)}</div>${z.cats.map(c=>`<div class="ot297-lossrow"><span>${c.label}</span><div><i style="width:${n(z.vals[c.key])<=0?0:Math.max(1,n(z.vals[c.key])/mx*100)}%;background:${c.color}"></i></div><b>${n(z.vals[c.key]).toFixed(1)} MWh</b></div>`).join('')}<div class="ot305-recover"><div><div class="label">Recoverable Energy</div><div class="sub ot319-recover-copy"><strong>Controllable loss energy</strong> <span class="ot319-emphasis">estimated recoverable</span> through operational or maintenance intervention · through ${fmtHour(z.hour)}</div><div class="ot314-lineage ot319-lineage">Feeds Recoverable Generation → Recoverable Revenue Opportunity</div><button type="button" class="ot315-route ot319-route" id="ot315RecoveryImpact">View Recovery Impact →</button></div><div class="value">${recoverableCum.toFixed(1)} MWh</div></div><div class="ot303-losschart"><h4>Intraday Loss Profile</h4><div class="ot303-sub">15-minute loss rate across the solar day · marker follows Solar Hour</div>${lossProfileSVG(z)}<div class="ot303-losslegend">${(()=>{const dt=z.dt||.25,otherKeys=['shade','clip','degr','xac','resid'],principal=[{key:'weather',label:'Weather / resource',color:'#1565c0'},{key:'temp',label:'Temperature',color:'#e53935'},{key:'soil',label:'Soiling',color:'#43a047'},{key:'avail',label:'Availability / condition',color:'#3949ab'},{key:'curt',label:'Curtailment',color:'#00acc1'},{key:'other',label:'Other governed losses',color:'#6d4c41'}],ss=principal.map(c=>({...c,v:c.key==='other'?z.a.map((_,i)=>otherKeys.reduce((s,k)=>s+n(z.weights[k]?.[i]),0)/dt):z.weights[c.key].map(v=>v/dt)})),mm=Math.max(1,...ss.flatMap(s=>s.v))*1.10;return ss.filter(s=>Math.max(...s.v)>=mm*.012).map(s=>`<span><i style="--c:${s.color}"></i>${s.label}</span>`).join('')})()}<span class="marker"><i></i>Selected solar hour</span></div></div></section>`;
 const impact=$('#ot315RecoveryImpact');
 if(impact)impact.onclick=()=>{
   const plantId=pid();
   const p=rows('Twin Engineering Parameters').find(x=>String(x.Plant_ID)===String(plantId))||{};
   const plantName=String(p.Plant_Name||plantId);
   window.AIP_CONTEXT_NAV={source:'Operational Twin',target:'portfoliobenchmarking',metric:'Recoverable Energy',plantId,plantName,originView:'operationaltwin',originTwinTab:'Physics & Losses',originSolarHour:+($('#tTime')?.value||window.AIP_V21?.state?.time||12),timestamp:Date.now()};
   window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};window.AIP_V21.state.layer='Physics & Losses';window.AIP_V21.state.time=+($('#tTime')?.value||window.AIP_V21.state.time||12);
   window.PORTFOLIO_PERFORMANCE_TAB='loss';
   try{
     if(typeof window.activate==='function')window.activate('portfoliobenchmarking');
     else if(typeof activate==='function')activate('portfoliobenchmarking');
   }catch(_){}
   setTimeout(()=>{
     try{
       if(typeof window.AIPPortfolioToLoss==='function')window.AIPPortfolioToLoss(plantId,plantName,'Operational Twin');
       else if(typeof window.setPortfolioPerformanceTab==='function')window.setPortfolioPerformanceTab('loss');
       else if(typeof setPortfolioPerformanceTab==='function')setPortfolioPerformanceTab('loss');
     }catch(_){}
   },90);
 };
}
let horizon=24;
function forecast(){const all=rows('Twin Telemetry').filter(r=>String(r.Plant_ID)===String(pid())&&String(r.Weather_Mode)==='Forecast').sort((a,b)=>String(a.Timestamp).localeCompare(String(b.Timestamp)));if(!all.length)return[];const st=new Date(String(all[0].Timestamp).replace(' ','T')),en=new Date(st.getTime()+horizon*3600000);return all.filter(r=>{const d=new Date(String(r.Timestamp).replace(' ','T'));return d>=st&&d<en})}
function forecastGov(){return rows('Twin Forecast Governance').find(r=>String(r.Plant_ID)===String(pid())&&n(r.Horizon_Hours)===horizon)||{}}
function forecastSVG(a){
  const W=820,H=255,p=38;
  if(!Array.isArray(a)||!a.length){
    return `<svg class="ot297-chart" viewBox="0 0 ${W} ${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="12" fill="#78909c">No forecast records available</text></svg>`;
  }
  const series=['ClearSky_AC_Potential_MW','Weather_Adjusted_Expected_AC_MW','Actual_AC_MW'];
  const max=Math.max(1,...a.flatMap(r=>series.map(k=>n(r[k],0))))*1.08;
  const x=i=>p+(i/Math.max(1,a.length-1))*(W-p-18);
  const y=v=>(H-p)-(n(v,0)/max)*(H-p*1.75);
  const makePath=k=>a.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(r[k]).toFixed(1)}`).join(' ');
  const grid=[0,.5,1].map(q=>{
    const yy=(H-p)-q*(H-p*1.75);
    return `<line x1="${p}" y1="${yy}" x2="${W-18}" y2="${yy}" stroke="#e2eaee"/><text x="4" y="${yy+3}" font-size="8" fill="#78909c">${(max*q).toFixed(0)} MW</text>`;
  }).join('');
  const step=horizon<=24?6:12;
  const ticks=a.map((_,i)=>i).filter(i=>i%step===0||i===a.length-1).map(i=>`<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="8" fill="#78909c">+${i+1}h</text>`).join('');
  return `<svg class="ot297-chart" viewBox="0 0 ${W} ${H}">${grid}<path d="${makePath('ClearSky_AC_Potential_MW')}" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="8 5"/><path d="${makePath('Weather_Adjusted_Expected_AC_MW')}" fill="none" stroke="#2563eb" stroke-width="2.7"/><path d="${makePath('Actual_AC_MW')}" fill="none" stroke="#16a34a" stroke-width="2.7"/>${ticks}</svg>`;
}
function renderPredict(){const body=$('#twBody'),a=forecast(),g=forecastGov();if(!body)return;const kpis=$('#tKpis');if(kpis)kpis.innerHTML='';const e=n(g.Forecast_Delivered_MWh),w=n(g.Weather_Adjusted_Baseline_MWh),risk=n(g.Operational_Energy_At_Risk_MWh),cloud=n(g.Average_Forecast_Cloud_Pct_Daylight),conf=n(g.Prediction_Confidence_Pct);body.innerHTML=`<div class="ot361-horizon"><span>Forecast horizon</span>${[24,48,72].map(h=>`<button class="${h===horizon?'active':''}" data-h="${h}">${h} h</button>`).join('')}</div><div class="ot297-forecast"><section class="ot297-card"><h3>${horizon}-hour physics + weather production outlook</h3><div class="ot297-mini-grid"><div class="ot297-mini"><span>Forecast delivered energy</span><b>${e.toFixed(1)} MWh</b><small>true elapsed ${horizon} h window</small></div><div class="ot297-mini"><span>Weather-adjusted baseline</span><b>${w.toFixed(1)} MWh</b><small>physics + forecast weather</small></div><div class="ot297-mini"><span>Operational energy at risk</span><b>${risk.toFixed(1)} MWh</b><small>baseline - predicted delivery</small></div><div class="ot297-mini"><span>Prediction confidence</span><b>${conf.toFixed(1)}%</b><small>governed composite score</small></div></div>${window.AIPOperationalTwinForecastSVG(a)}<div class="ot297-legend"><span><i class="lg-clear"></i>Clear-sky reference</span><span><i class="lg-weather"></i>Weather-adjusted expected</span><span><i class="lg-delivered"></i>Predicted delivered</span></div></section><aside class="ot297-card ot361-side"><h3>Prediction inputs & basis</h3><div class="ot361-group"><b>Resource & weather</b><div><span>Average forecast cloud · daylight</span><strong>${cloud.toFixed(1)}%</strong></div><div><span>Peak forecast POA</span><strong>${n(g.Peak_POA_Wm2).toFixed(0)} W/m²</strong></div><div><span>Average ambient temperature</span><strong>${n(g.Average_Ambient_Temp_C_Daylight).toFixed(1)} °C</strong></div><div><span>Average wind speed</span><strong>${n(g.Average_Wind_Speed_ms_Daylight).toFixed(1)} m/s</strong></div></div><div class="ot361-group"><b>Plant physics</b><div><span>Clear-sky reference energy</span><strong>${n(g.Clear_Sky_Reference_MWh).toFixed(1)} MWh</strong></div><div><span>Average inverter efficiency</span><strong>${n(g.Average_Inverter_Efficiency_Pct_Daylight).toFixed(2)}%</strong></div><div><span>Average soiling</span><strong>${n(g.Average_Soiling_Pct_Daylight).toFixed(1)}%</strong></div><div><span>Average curtailment</span><strong>${n(g.Average_Curtailment_Pct_Daylight).toFixed(1)}%</strong></div></div><div class="ot361-group"><b>Asset condition</b><div><span>Assets in scope</span><strong>${n(g.Asset_Count).toFixed(0)}</strong></div><div><span>Critical / Watch assets</span><strong>${n(g.Critical_Assets).toFixed(0)} / ${n(g.Watch_Assets).toFixed(0)}</strong></div><div><span>Average asset health</span><strong>${n(g.Average_Asset_Health_Score).toFixed(1)}/100</strong></div><div><span>Forecast availability</span><strong>${n(g.Average_Availability_Pct_Daylight).toFixed(2)}%</strong></div></div><div class="ot361-group"><b>Prediction confidence basis</b><div><span>Weather forecast quality</span><strong>${n(g.Weather_Forecast_Quality_Pct).toFixed(1)}%</strong></div><div><span>Physics model fit</span><strong>${n(g.Physics_Model_Fit_Pct).toFixed(1)}%</strong></div><div><span>Data completeness</span><strong>${n(g.Data_Completeness_Pct).toFixed(1)}%</strong></div><div><span>Asset-state reliability</span><strong>${n(g.Asset_State_Reliability_Pct).toFixed(1)}%</strong></div></div><div class="ot361-control"><b>Operational Control Boundary</b><span>Observe → predict → diagnose → recommend</span><small>No direct write commands from this Twin to SCADA, PPC, inverters, trackers or switchgear.</small></div><button class="primary" id="otToScenario">Simulate Mitigation</button></aside></div>`;$$('.ot361-horizon button').forEach(b=>b.onclick=()=>{horizon=n(b.dataset.h,24);renderPredict()});const toScenario=$('#otToScenario');if(toScenario)toScenario.onclick=()=>activateTab('Scenario Lab')}
window.AIPRenderOperationalTwinPredictiveOutlook=renderPredict;
window.AIPOperationalTwinForecastSVG=forecastSVG;
window.AIPOperationalTwinForecast=forecast;
window.AIPOperationalTwinForecastGov=forecastGov;
const SC={cloudDelta:0,soilingDelta:0,curtailDelta:0,healthDelta:0,tempDelta:0,intervention:'Clean modules'};
function scen(){const r=current(),p=rows('Twin Engineering Parameters').find(x=>String(x.Plant_ID)===String(pid()))||{},base=n(r.Actual_AC_MW),we=n(r.Weather_Adjusted_Expected_AC_MW),cloudFactor=Math.max(.35,1-SC.cloudDelta/100),soil=Math.max(0,1-(n(p.Soiling_Base_Pct)+SC.soilingDelta)/100),health=Math.max(.65,Math.min(1,(n(r.Asset_Health_Score)+SC.healthDelta)/100)),curt=Math.max(0,1-(n(r.Curtailment_Pct)+SC.curtailDelta)/100),temp=Math.max(.82,1-Math.max(0,SC.tempDelta)*Math.abs(n(p.Module_Temp_Coeff_PctPerC,-.36))/100);let scenario=we*cloudFactor*soil*health*curt*temp;let post=scenario;if(SC.intervention==='Clean modules')post=we*cloudFactor*health*curt*temp;if(SC.intervention==='Restore inverter')post=we*cloudFactor*soil*Math.max(.98,health)*curt*temp;if(SC.intervention==='Release curtailment')post=we*cloudFactor*soil*health*temp;if(SC.intervention==='Cool / inspect inverter')post=scenario/Math.max(.82,temp)*Math.min(1,temp+.035);post=Math.max(0,post);return {r,scenario,post,gain:Math.max(0,post-scenario),energy:Math.max(0,post-scenario)*5.1}}
function renderScenario(){const body=$('#twBody'),z=scen(),r=z.r;if(!body)return;$('#tKpis').innerHTML='';body.innerHTML=`<div class="ot297-scenario"><section class="ot297-card"><h3>Governed Scenario Lab · reference case versus what-if case</h3><div class="ot297-controls"><div class="ot297-control"><label><span>Cloud attenuation delta</span><b>${SC.cloudDelta>=0?'+':''}${SC.cloudDelta}%</b></label><input id="scCloud" type="range" min="-20" max="45" value="${SC.cloudDelta}"></div><div class="ot297-control"><label><span>Soiling loss delta</span><b>${SC.soilingDelta>=0?'+':''}${SC.soilingDelta.toFixed(1)}%</b></label><input id="scSoil" type="range" min="-3" max="8" step="0.2" value="${SC.soilingDelta}"></div><div class="ot297-control"><label><span>POI curtailment delta</span><b>${SC.curtailDelta>=0?'+':''}${SC.curtailDelta}%</b></label><input id="scCurt" type="range" min="0" max="40" value="${SC.curtailDelta}"></div><div class="ot297-control"><label><span>Asset health delta</span><b>${SC.healthDelta>=0?'+':''}${SC.healthDelta}</b></label><input id="scHealth" type="range" min="-30" max="10" value="${SC.healthDelta}"></div><div class="ot297-control"><label><span>Temperature stress delta</span><b>${SC.tempDelta>=0?'+':''}${SC.tempDelta} °C</b></label><input id="scTemp" type="range" min="-8" max="15" value="${SC.tempDelta}"></div><div class="ot297-control"><label><span>Intervention to test</span><b>what-if</b></label><select id="scInt">${['Clean modules','Restore inverter','Release curtailment','Cool / inspect inverter'].map(x=>`<option ${x===SC.intervention?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="ot297-results"><div><span>Reference delivered</span><b>${n(r.Actual_AC_MW).toFixed(1)} MW</b></div><div><span>Scenario before action</span><b>${z.scenario.toFixed(1)} MW</b></div><div><span>Post-intervention</span><b>${z.post.toFixed(1)} MW</b></div><div><span>Immediate recovery</span><b>+${z.gain.toFixed(2)} MW</b></div><div><span>Indicative day recovery</span><b>+${z.energy.toFixed(1)} MWh</b></div><div><span>Control action</span><b>ADVISORY ONLY</b></div></div><div class="ot297-actions"><button class="primary" id="scReset">Reset to reference</button><button id="scPred">Compare prediction</button></div></section><aside class="ot297-card"><h3>Reference state inherited from twin</h3><div class="ot297-causal" style="margin-top:9px"><div><span>Current cloud cover</span><b>${n(r.Cloud_Cover_Pct).toFixed(1)}%</b></div><div><span>Current soiling</span><b>${(100*(1-n(r.Soiling_Ratio,1))).toFixed(1)}%</b></div><div><span>Current asset health</span><b>${n(r.Asset_Health_Score).toFixed(0)}/100</b></div><div><span>Current curtailment</span><b>${n(r.Curtailment_Pct).toFixed(1)}%</b></div><div><span>Current module temperature</span><b>${n(r.Module_Temp_C).toFixed(1)} °C</b></div></div></aside></div>`;[['#scCloud','cloudDelta'],['#scSoil','soilingDelta'],['#scCurt','curtailDelta'],['#scHealth','healthDelta'],['#scTemp','tempDelta']].forEach(([id,k])=>{$(id).oninput=e=>{SC[k]=+e.target.value;renderScenario()}});$('#scInt').onchange=e=>{SC.intervention=e.target.value;renderScenario()};$('#scReset').onclick=()=>{Object.assign(SC,{cloudDelta:0,soilingDelta:0,curtailDelta:0,healthDelta:0,tempDelta:0,intervention:'Clean modules'});renderScenario()};$('#scPred').onclick=()=>activateTab('Generation Forecast')}
let handlers={};
function otCanonicalLayer(name){return name==='Generation Forecast'?'Predictive Outlook':name}
function otDisplayLayer(name){return name==='Predictive Outlook'?'Generation Forecast':name}
function otLayerButton(name,view){const display=otDisplayLayer(otCanonicalLayer(name));return [...$$('#tLayers .xi-tab',view||document)].find(x=>x.textContent.trim()===display)}
function activateTab(name){
 const canonical=otCanonicalLayer(name),b=otLayerButton(canonical,$('#view-operationaltwin'));
 if(!b)return;
 $$('#tLayers .xi-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');
 window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};window.AIP_V21.state.layer=canonical;
 if(canonical==='Live Plant')renderLive();
 else if(canonical==='Physics & Losses')renderLoss();
 else if(canonical==='Asset Condition')renderAssetCondition();
 else if(canonical==='Visual Evidence'){if(typeof window.AIPRenderOperationalTwinVisualEvidence==='function')window.AIPRenderOperationalTwinVisualEvidence();else{$('#twBody').innerHTML='<div class="tw292-card" style="padding:18px"><h3>Visual Evidence</h3><div class="xi-muted">Visual Evidence renderer is unavailable.</div></div>'}}
 else if(canonical==='Predictive Outlook'){if(typeof window.AIPRenderGenerationForecast==='function')window.AIPRenderGenerationForecast();else renderPredict()}
 else if(canonical==='Scenario Lab')renderScenario();
}
window.AIPActivateOperationalTwinLayer=activateTab;
function customize(){const view=$('#view-operationaltwin');if(!view||!$('#twExperienceBody',view)||!$('#tLayers',view))return;
 const nav=window.AIP_CONTEXT_NAV;
 if(nav&&nav.originView==='operationaltwin'&&nav.originTwinTab){
   window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};
   window.AIP_V21.state.layer=nav.originTwinTab;
   if(Number.isFinite(+nav.originSolarHour))window.AIP_V21.state.time=+nav.originSolarHour;
 }const tabs=$$('#tLayers .xi-tab',view);let t=$('#tLayers',view);$$('#tLayers .xi-tab',view).forEach(b=>{const nm=b.textContent.trim();if(['Live Plant','Physics & Losses','Asset Condition','Visual Evidence','Generation Forecast','Scenario Lab'].includes(nm))b.onclick=()=>activateTab(nm)});
 const toolbar=$('.tw-toolbar',view),timeLabel=$('#tHour',view)?.closest('label'),range=$('#tTime',view);
 syncSolarWindowUI(view);
 let dayBadge=$('#ot325OperatingDay',view);
 if(toolbar&&timeLabel){
   if(!dayBadge){dayBadge=document.createElement('span');dayBadge.id='ot325OperatingDay';dayBadge.className='ot325-operating-day';timeLabel.insertAdjacentElement('afterend',dayBadge)}
   dayBadge.textContent=operatingDayContext();
   let controls=$('.ot326-time-row',toolbar);
   if(!controls){
     controls=document.createElement('div');controls.className='ot326-time-row';
     const tabs=$('#tLayers',toolbar);
     if(tabs)tabs.insertAdjacentElement('afterend',controls);else toolbar.appendChild(controls);
   }
   if(timeLabel.parentElement!==controls)controls.appendChild(timeLabel);
   if(dayBadge.parentElement!==controls)controls.appendChild(dayBadge);
   if(range&&range.parentElement!==controls)controls.appendChild(range);
 }const time=$('#tTime',view);if(time){const sw=solarWindow();time.min=sw.start;time.max=sw.end;time.step=.25;time.value=Math.max(sw.start,Math.min(sw.end,window.AIP_V21.state.time||12));const topHour=$('#tHour',view);if(topHour)topHour.textContent=fmtHour(+time.value);updateSolarSliderFill(time);time.oninput=()=>{window.AIP_V21.state.time=+time.value;const h=$('#tHour',view);if(h)h.textContent=fmtHour(+time.value);updateSolarSliderFill(time);const active=$('#tLayers .xi-tab.active',view)?.textContent.trim();if(active==='Live Plant')renderLive();else if(active==='Scenario Lab')renderScenario();else if(active==='Physics & Losses')renderLoss();else if(active==='Visual Evidence'&&typeof window.AIPRenderOperationalTwinVisualEvidence==='function')window.AIPRenderOperationalTwinVisualEvidence();else if(active==='Generation Forecast'&&typeof window.AIPRenderGenerationForecast==='function')window.AIPRenderGenerationForecast();requestAnimationFrame(()=>updateSolarSliderFill(time))}}const run=$('#tRun',view);if(run){run.remove()}const site=$('#tSite',view);if(site)site.onchange=e=>{const active=$('#tLayers .xi-tab.active',view)?.textContent.trim()||window.AIP_V21?.state?.layer||'Live Plant';window.AIP_TWIN_SITE=e.target.value;window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};window.AIP_V21.state.layer=otCanonicalLayer(active);syncSolarWindowUI(view);activateTab(active);syncSolarWindowUI(view);requestAnimationFrame(()=>syncSolarWindowUI(view));};const badge=$('.tw292-model-badge',view);if(badge)badge.remove();let active=$('#tLayers .xi-tab.active',view)?.textContent.trim();const navRestore=window.AIP_CONTEXT_NAV;if(navRestore&&navRestore.originView==='operationaltwin'&&navRestore.originTwinTab){active=navRestore.originTwinTab;const tm=$('#tTime',view);if(tm&&Number.isFinite(+navRestore.originSolarHour)){tm.value=+navRestore.originSolarHour;window.AIP_V21.state.time=+navRestore.originSolarHour}const restoreTab=otLayerButton(active,view);if(restoreTab){$$('#tLayers .xi-tab',view).forEach(x=>x.classList.remove('active'));restoreTab.classList.add('active')}delete window.AIP_CONTEXT_NAV.originTwinTab;delete window.AIP_CONTEXT_NAV.originSolarHour;}if(!active)return;activateTab(otDisplayLayer(active))}
function hook(){if(!window.AIP_V21?.renderers?.operationaltwin)return setTimeout(hook,80);const legacy=window.AIP_V21.renderers.operationaltwin;if(legacy.__v299)return;const wrapped=function(){
 const v=$('#view-operationaltwin');
 const preserved=otCanonicalLayer((v&&$('#tLayers .xi-tab.active',v)?.textContent.trim())||window.AIP_V21?.state?.layer||'Live Plant');
 if(v)v.classList.add('aip-ot-upgrading');
 installData();
 legacy();
 window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};
 window.AIP_V21.state.layer=preserved;
 customize();
 if(v)v.classList.remove('aip-ot-upgrading');
 setTimeout(()=>{
   window.AIP_V21.state.layer=preserved;
   customize();
 },90)
};wrapped.__v299=true;window.AIP_V21.renderers.operationaltwin=wrapped;if($('#view-operationaltwin.active'))wrapped()}
hook();
document.addEventListener('aip:data-source-changed',()=>{
  const view=$('#view-operationaltwin');
  const preserved=otCanonicalLayer((view&&$('#tLayers .xi-tab.active',view)?.textContent.trim())||window.AIP_V21?.state?.layer||'Live Plant');
  window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};
  window.AIP_V21.state.layer=preserved;
  setTimeout(()=>{
    customize();
    const v=$('#view-operationaltwin');if(!v)return;
    const b=otLayerButton(preserved,v);
    if(b){$$('#tLayers .xi-tab',v).forEach(x=>x.classList.remove('active'));b.classList.add('active')}
    window.AIP_V21.state.layer=preserved;
    if(preserved==='Visual Evidence'&&typeof window.AIPRenderOperationalTwinVisualEvidenceStandalone==='function'){
      window.AIPRenderOperationalTwinVisualEvidenceStandalone();
    }else if(preserved==='Predictive Outlook'&&typeof window.AIPRenderGenerationForecast==='function'){
      window.AIPRenderGenerationForecast();
    }else if(b&&typeof b.onclick==='function'){
      b.onclick();
    }
  },180);
});
})();
