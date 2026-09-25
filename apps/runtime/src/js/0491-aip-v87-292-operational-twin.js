
(function(){
'use strict';
const MEDIA=[{"id":"site-aerial","title":"Utility-scale PV site aerial","asset":"SITE / BLOCK ZONES","type":"Site spatial context","status":"Watch","img":"assets/img-b71132900f1031.jpg","license":"Public domain \u00b7 NASA","source":"NASA / Topaz Solar Farm reference imagery","hotspots":[{"x":35,"y":34,"state":"warn","title":"Block B-03 yield deviation","asset":"BLOCK-B03","detail":"Expected-vs-actual residual is above governed watch threshold.","nav":"lossintelligence"},{"x":58,"y":52,"state":"ok","title":"Block B-07 normal","asset":"BLOCK-B07","detail":"Normalized yield and inverter conversion remain within governed band.","nav":"assetexplorer"},{"x":72,"y":67,"state":"critical","title":"Block B-11 inspection priority","asset":"BLOCK-B11","detail":"Condition + residual evidence suggests targeted inspection.","nav":"rootcause"}]},{"id":"floating-aerial","title":"Floating PV aerial context","asset":"SITE LAYOUT","type":"Aerial / geometry","status":"Context","img":"assets/img-df017915afda67.jpg","license":"Public domain \u00b7 government publication","source":"Cirata floating PV reference imagery","hotspots":[{"x":43,"y":40,"state":"ok","title":"PV field geometry","asset":"ARRAY-ZONE","detail":"Representative geometry layer for spatial twin mapping.","nav":"assetexplorer"},{"x":70,"y":58,"state":"warn","title":"Inspection route zone","asset":"ZONE-02","detail":"Visual route / inspection overlay can be linked to work-order evidence.","nav":"workorderintelligence"}]},{"id":"tracker","assetClass":"Tracker","title":"Solar tracker mechanism","asset":"TRACKER-T01","type":"Tracker / mechanical","status":"Healthy","img":"assets/img-c52b58c3d5eb40.jpg","license":"CC0 1.0","source":"Wikimedia Commons \u00b7 Solar trackers.jpg \u00b7 Wikideas1","hotspots":[{"x":30,"y":44,"state":"ok","title":"Drive / actuator","asset":"TRACKER-T01-DRV","detail":"Tracker angle follows expected sun position; no stow fault active.","nav":"predictive"},{"x":76,"y":48,"state":"warn","title":"Row alignment check","asset":"TRACKER-T01-ROW","detail":"Mechanical alignment can be correlated with row-yield and shading residual.","nav":"rootcause"}]},{"id":"central-inverter","assetClass":"Inverter","title":"Central inverter cabinet","asset":"INV-B03-01","type":"Inverter / power conversion","status":"Watch","img":"assets/img-b2a07aab2b8e10.jpg","license":"CC0 1.0","source":"Wikimedia Commons \u00b7 Central inverter cutout.jpg \u00b7 SayCheeeeeese","hotspots":[{"x":28,"y":31,"state":"warn","title":"DC input section","asset":"INV-B03-01/DC","detail":"DC-side residual elevated versus peer inverter cohort.","nav":"rootcause"},{"x":70,"y":62,"state":"ok","title":"AC conversion section","asset":"INV-B03-01/AC","detail":"Conversion efficiency remains within modelled efficiency curve.","nav":"assetexplorer"}]},{"id":"inverter-display","title":"Inverter local display","asset":"INV-B03-01","type":"HMI / operating evidence","status":"Watch","img":"assets/img-a36716ea28e205.jpg","license":"CC0 1.0","source":"Wikimedia Commons \u00b7 SunGen Sharon Solar 13.jpg \u00b7 SayCheeeeeese","hotspots":[{"x":49,"y":52,"state":"warn","title":"Local operating display","asset":"INV-B03-01/HMI","detail":"Local display evidence can be reconciled to SCADA status, alarm code and output.","nav":"rootcause"}]},{"id":"sma-inverter","title":"String inverter","asset":"INV-STRING-08","type":"Inverter / distributed","status":"Healthy","img":"assets/img-0d4070df75885e.jpg","license":"CC0 1.0","source":"Wikimedia Commons \u00b7 Solar Wechselrichter SMA STP 8.0.jpg \u00b7 Pedalito","hotspots":[{"x":52,"y":69,"state":"ok","title":"Operating state LEDs","asset":"INV-STRING-08/STATUS","detail":"Representative status evidence linked to inverter telemetry and work history.","nav":"predictive"}]},{"id":"ac-panel-meter","title":"PV inverter / meter / disconnect assembly","asset":"METER-POI-A","type":"Metering & AC interface","status":"Healthy","img":"assets/img-e9b5c3b9e9f91c.jpg","license":"CC0 1.0","source":"Wikimedia Commons \u00b7 Vermont Law School Solar Panel Array-4.JPG \u00b7 SayCheeeeeese","hotspots":[{"x":52,"y":48,"state":"ok","title":"Revenue / generation meter","asset":"METER-POI-A","detail":"Meter reading is the delivered-energy reconciliation point for the twin.","nav":"commercialppa"},{"x":80,"y":42,"state":"warn","title":"AC disconnect","asset":"AC-DISC-01","detail":"Switch state can constrain availability and should reconcile to outage evidence.","nav":"rootcause"}]},{"id":"substation","title":"Solar interconnection substation","asset":"SUB-132KV-01","type":"Substation / grid interface","status":"Healthy","img":"assets/img-b8b464b3ff96de.jpg","license":"Public domain \u00b7 U.S. federal government","source":"Fort Hood Public Affairs Office / Wikimedia Commons","hotspots":[{"x":41,"y":37,"state":"ok","title":"Bus / switchyard","asset":"SUB-132KV-01/BUS","detail":"Grid-interface state feeds POI availability and curtailment attribution.","nav":"lossintelligence"},{"x":66,"y":29,"state":"warn","title":"Transmission interface","asset":"POI-132KV","detail":"POI restriction is treated as curtailment, not as DC performance loss.","nav":"commercialppa"}]},{"id":"legacy-inverter","title":"Central inverter equipment view","asset":"INV-B07-02","type":"Inverter / equipment","status":"Critical","img":"assets/img-88b3cca569c67c.jpg","license":"CC0 1.0","source":"Previously rights-cleared v87_291 central inverter image","hotspots":[{"x":42,"y":41,"state":"critical","title":"Thermal / fan risk zone","asset":"INV-B07-02/FAN","detail":"Simulated hotspot: thermal rise + residual trend can feed predictive-maintenance risk.","nav":"predictive"},{"x":69,"y":66,"state":"warn","title":"AC output section","asset":"INV-B07-02/AC","detail":"Compare conversion efficiency, derating and work-order history.","nav":"workorderintelligence"}]},
{"id":"asset-transformer","title":"Power transformer","asset":"ASSET MASTER","assetClass":"Transformer","type":"Transformer / electrical","status":"Watch","img":"assets/img-208f99156ffc17.jpg","license":"CC BY-SA 4.0","source":"Wikimedia Commons · Ptrump16 · Substation transfomer.jpg","hotspots":[{"x":38,"y":44,"state":"warn","title":"Cooling / thermal zone","asset":"AUTO","detail":"Review temperature, loading, alarms and asset-health evidence.","nav":"assetexplorer"},{"x":66,"y":25,"state":"ok","title":"HV termination zone","asset":"AUTO","detail":"Representative inspection point for termination condition and thermal evidence.","nav":"rootcause"}]},
{"id":"asset-switchgear","title":"Switchgear lineup","asset":"ASSET MASTER","assetClass":"Switchgear","type":"Switchgear / protection","status":"Healthy","img":"assets/img-8224f970fed620.jpg","license":"Public domain","source":"Wikimedia Commons · P199 · Electrical switchgear.JPG","hotspots":[{"x":29,"y":50,"state":"warn","title":"Breaker / protection bay","asset":"AUTO","detail":"Review breaker state, protection events and thermal condition.","nav":"rootcause"},{"x":62,"y":47,"state":"ok","title":"Feeder section","asset":"AUTO","detail":"Representative healthy feeder / switchgear inspection point.","nav":"assetexplorer"}]},
{"id":"asset-scb","title":"Solar combiner box","asset":"ASSET MASTER","assetClass":"SCB","type":"SCB / DC collection","status":"Watch","img":"assets/img-09c5d8d056496a.jpg","license":"CC BY-SA 2.0","source":"Wikimedia Commons · CoCreatr · Solar combiner box.jpg","hotspots":[{"x":25,"y":31,"state":"warn","title":"Fuse / string termination zone","asset":"AUTO","detail":"Inspect string current imbalance, fuse condition and connector heating.","nav":"rootcause"},{"x":34,"y":21,"state":"ok","title":"DC protection zone","asset":"AUTO","detail":"Representative DC protection and surge-device inspection point.","nav":"assetexplorer"}]},
{"id":"asset-weather","title":"PV weather station / pyranometer","asset":"ASSET MASTER","assetClass":"Weather Station","type":"Weather station / irradiance","status":"Healthy","img":"assets/img-ac6ebd0fff6b75.jpg","license":"CC BY-SA 3.0","source":"Wikimedia Commons · Arthurcala · Thermopile pyranometer as part of MeteoStation.jpg","hotspots":[{"x":57,"y":17,"state":"ok","title":"Pyranometer / irradiance sensor","asset":"AUTO","detail":"POA / irradiance measurement evidence and sensor-quality context.","nav":"assetexplorer"},{"x":45,"y":15,"state":"warn","title":"Wind sensor / met mast","asset":"AUTO","detail":"Review sensor availability, calibration and weather-data quality.","nav":"rootcause"}]}
];
const ST={cloud:18,soiling:2.2,curtail:0,health:93,tempOffset:0,intervention:'Clean modules',selected:'site-aerial'};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const num=(v,d=0)=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:d};
const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function rows(sheet){
  const mode=String(window.APM_DATA_MODE||'').toLowerCase();
  if((/synthetic|demo data/.test(mode)||window.AIP_SYNTHETIC_ACTIVE===true) && window.AIP_INDEPENDENT_SYNTHETIC_DATA?.[sheet]) return window.AIP_INDEPENDENT_SYNTHETIC_DATA[sheet];
  return window.EMBEDDED_EXCEL_DATA?.[sheet]||[];
}
function get(r,names,d=''){for(const n of names){if(r&&r[n]!==undefined&&r[n]!==null&&r[n]!=='')return r[n]}return d}
function siteId(){return $('#tSite')?.value||window.AIP_TWIN_SITE||String(get(rows('Sites')[0],['Plant_ID'],'SP-01'))}
function site(){
  const id=siteId();return rows('Sites').find(r=>String(get(r,['Plant_ID']))===String(id))||rows('Sites')[0]||{};
}
function params(){
  const id=siteId();return rows('Twin Engineering Parameters').find(r=>String(get(r,['Plant_ID']))===String(id))||rows('Twin Engineering Parameters')[0]||{};
}
function configValue(key,def){
  const r=rows('Twin Configuration').find(x=>String(get(x,['Parameter','Key','Config_Key'])).toLowerCase()===String(key).toLowerCase());
  return r?num(get(r,['Value','Config_Value']),def):def;
}
function baseParams(){
  const s=site(),p=params();
  return {
    cap:num(get(s,['Capacity_MW']),120),
    dcac:num(get(p,['DC_AC_Ratio']),1.24),
    tc:num(get(p,['Module_Temp_Coeff_PctPerC']),-0.36),
    invEff:num(get(p,['Inverter_Efficiency_Pct']),98.6)/100,
    trEff:num(get(p,['Transformer_Efficiency_Pct']),98.4)/100,
    baseSoil:num(get(p,['Soiling_Base_Pct']),1.8),
    noct:num(get(p,['NOCT_C','Module_NOCT_C']),45),
    degradation:num(get(p,['Annual_Degradation_Pct','Degradation_Pct']),0.55),
    availability:num(get(s,['Availability_Pct']),98.2),
    tariff:configValue('Tariff_Rs_per_kWh',2.95)
  };
}
function solarShape(hour){
  const sunrise=6.0,sunset=18.8;
  if(hour<=sunrise||hour>=sunset)return 0;
  const x=(hour-sunrise)/(sunset-sunrise);
  return Math.pow(Math.sin(Math.PI*x),1.18);
}
function cloudTransmittance(cloudPct){
  const c=Math.max(0,Math.min(90,cloudPct))/100;
  return Math.max(.16,1-.88*Math.pow(c,1.32));
}
function inverterCurve(baseEff, load){
  const l=Math.max(.01,Math.min(1.35,load));
  const lowPenalty=l<.18?(.18-l)*.09:0;
  const highPenalty=l>1?Math.min(.012,(l-1)*.025):0;
  return Math.max(.90,Math.min(baseEff,baseEff-lowPenalty-highPenalty));
}
function calcAt(hour,assump=ST){
  const p=baseParams(),shape=solarShape(hour);
  const clearPOA=1020*shape;
  const poa=clearPOA*cloudTransmittance(assump.cloud);
  const amb=27+10*shape+assump.tempOffset;
  const moduleT=amb+((p.noct-20)/800)*poa;
  const soil=Math.max(0,Math.min(.2,assump.soiling/100));
  const tempFactor=Math.max(.80,1+(p.tc/100)*(moduleT-25));
  const degFactor=Math.max(.90,1-p.degradation/100);
  const effectivePOA=poa*(1-soil);
  const dcRaw=p.cap*p.dcac*(effectivePOA/1000)*tempFactor*degFactor;
  const preliminaryLoad=p.cap?dcRaw/p.cap:0;
  const eta=inverterCurve(p.invEff,preliminaryLoad);
  const acPreClip=dcRaw*eta;
  const clipped=Math.max(0,acPreClip-p.cap);
  const acClipped=Math.min(p.cap,acPreClip);
  const health=Math.max(60,Math.min(100,assump.health));
  const healthPenalty=health>=90?0:Math.pow((90-health)/30,1.45)*.075;
  const availability=Math.max(.82,Math.min(1,(p.availability/100)*(1-healthPenalty)));
  const acAvailable=acClipped*availability;
  const poiCap=p.cap*(1-Math.max(0,Math.min(80,assump.curtail))/100);
  const curtailed=Math.max(0,acAvailable-poiCap);
  const acPoi=Math.min(acAvailable,poiCap)*p.trEff;
  return {hour,shape,clearPOA,poa,amb,moduleT,effectivePOA,tempFactor,dcRaw,eta,acPreClip,clipped,availability,curtailed,acPoi,p};
}
function applyIntervention(a){
  const z={...a};
  if(a.intervention==='Clean modules')z.soiling=Math.min(.4,a.soiling);
  if(a.intervention==='Restore inverter'){z.health=Math.max(98,a.health);z.tempOffset=Math.min(a.tempOffset,-2)}
  if(a.intervention==='Release curtailment')z.curtail=0;
  if(a.intervention==='Cool / inspect inverter'){z.tempOffset=a.tempOffset-8;z.health=Math.min(100,a.health+2)}
  return z;
}
function integrate(assump){
  let e=0,pts=[]; const step=.25;
  for(let h=6;h<=19;h+=step){const x=calcAt(h,assump);e+=x.acPoi*step;pts.push(x.acPoi)}
  return {energy:e,pts};
}
function scenario(){
  const h=num($('#tTime')?.value,12);
  const before=calcAt(h,ST),afterAss=applyIntervention(ST),after=calcAt(h,afterAss);
  const db=integrate(ST),da=integrate(afterAss);
  const gainMW=Math.max(0,after.acPoi-before.acPoi),gainMWh=Math.max(0,da.energy-db.energy);
  return {before,after,db,da,gainMW,gainMWh,revenueL:gainMWh*before.p.tariff*1000/100000,afterAss};
}
function enhanceToolbar(){
  const view=$('#view-operationaltwin'); if(!view)return;
  const lbl=$('.tw-toolbar label',view);
  if(false&&lbl&&!$('.tw292-model-badge',view))lbl.insertAdjacentHTML('afterend','<span class="tw292-model-badge">Physics-driven solar profile</span>');
  const t=$('#tLayers',view); if(!t)return;
  // Rebind visual evidence to the richer asset-linked image twin.
  [...t.querySelectorAll('.xi-tab')].forEach(b=>{
    if(b.textContent.trim()==='Visual Evidence'){b.onclick=()=>{const t=$('#tLayers');if(t)$$('.xi-tab',t).forEach(x=>x.classList.remove('active'));b.classList.add('active');window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};window.AIP_V21.state.layer='Visual Evidence';if(typeof window.AIPRenderOperationalTwinVisualEvidence==='function')window.AIPRenderOperationalTwinVisualEvidence();}}
  });
  let sc=[...t.querySelectorAll('.xi-tab')].find(b=>b.textContent.trim()==='Scenario Lab');
  if(sc)sc.onclick=()=>activate(sc,renderScenario);
  const run=$('#tRun',view); if(run)run.onclick=()=>{const b=[...t.querySelectorAll('.xi-tab')].find(x=>x.textContent.trim()==='Scenario Lab');if(b)activate(b,renderScenario)};
  const time=$('#tTime',view);
  if(time&&!time.__v292){time.__v292=true;time.addEventListener('input',()=>{if($('.xi-tab.active',t)?.textContent.trim()==='Scenario Lab')renderScenario()})}
}
function activate(btn,fn){
  const t=$('#tLayers');if(t){$$('.xi-tab',t).forEach(x=>x.classList.remove('active'));btn?.classList.add('active')} fn();
}
function assetMasterRows(){
  const plantId=siteId();
  const modeSynth=synth();
  let imported=[],embedded=[],synthetic=[];
  try{if(typeof APM_IMPORTED_DATA!=='undefined'&&Array.isArray(APM_IMPORTED_DATA?.['Asset Master']))imported=APM_IMPORTED_DATA['Asset Master'];}catch(_){}
  try{if(typeof EMBEDDED_EXCEL_DATA!=='undefined'&&Array.isArray(EMBEDDED_EXCEL_DATA?.['Asset Master']))embedded=EMBEDDED_EXCEL_DATA['Asset Master'];}catch(_){}
  try{if(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined'&&Array.isArray(AIP_INDEPENDENT_SYNTHETIC_DATA?.['Asset Master']))synthetic=AIP_INDEPENDENT_SYNTHETIC_DATA['Asset Master'];}catch(_){}
  if(!imported.length&&Array.isArray(window.APM_IMPORTED_DATA?.['Asset Master']))imported=window.APM_IMPORTED_DATA['Asset Master'];
  if(!embedded.length&&Array.isArray(window.EMBEDDED_EXCEL_DATA?.['Asset Master']))embedded=window.EMBEDDED_EXCEL_DATA['Asset Master'];
  if(!synthetic.length&&Array.isArray(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.['Asset Master']))synthetic=window.AIP_INDEPENDENT_SYNTHETIC_DATA['Asset Master'];
  const assetSource=modeSynth?(synthetic.length?synthetic:(embedded.length?embedded:imported)):(imported.length?imported:(embedded.length?embedded:synthetic));
  const normSite=v=>{
    const x=String(v??'').trim().toUpperCase();
    const mm=x.match(/^(?:SP|SOL)[-_ ]?0*(\d+)$/);
    return mm?'SP-'+String(Number(mm[1])).padStart(2,'0'):x;
  };
  return assetSource.filter(a=>normSite(a.Plant_ID??a.Site_ID??a.Plant??a.Site)===normSite(plantId));
}
function healthStatus(score){
  const s=num(score,-1);return s<0?'No data':s<65?'Critical':s<80?'Watch':'Healthy';
}
function stateForStatus(status){return status==='Critical'?'critical':status==='Watch'?'warn':'ok'}
function templateForClass(cls){
  const map={'Inverter':'central-inverter','Tracker':'tracker','Transformer':'asset-transformer','Switchgear':'asset-switchgear','SCB':'asset-scb','Weather Station':'asset-weather'};
  return MEDIA.find(x=>x.id===map[cls])||MEDIA.find(x=>x.assetClass===cls)||MEDIA[0];
}
function visualAssets(){
  const master=assetMasterRows(), classes=['Inverter','Transformer','Switchgear','SCB','Tracker','Weather Station'];
  const aliases={
    'Inverter':['inverter'],
    'Transformer':['transformer'],
    'Switchgear':['switchgear','switch gear','rmu'],
    'SCB':['scb','combiner','string combiner'],
    'Tracker':['tracker','tracking'],
    'Weather Station':['weather station','met station','meteorological','pyranometer']
  };
  const result=[];
  classes.forEach(cls=>{
    const assets=master.filter(a=>{
      const ac=String(get(a,['Asset_Class','Asset_Type','assetClass','assetType','type'],'')).toLowerCase();
      return aliases[cls].some(x=>ac.includes(x));
    });
    if(!assets.length)return;
    // Show up to two governed examples when multiple OEMs exist; otherwise one.
    const byOem={};assets.forEach(a=>{const o=String(get(a,['OEM'],'Unknown OEM'));(byOem[o]||(byOem[o]=[])).push(a)});
    Object.entries(byOem).slice(0,2).forEach(([oem,list],oi)=>{
      const a=[...list].sort((x,y)=>num(get(x,['Health_Score']),100)-num(get(y,['Health_Score']),100))[0];
      const t=templateForClass(cls), score=num(get(a,['Health_Score']),-1), status=healthStatus(score);
      result.push({...t,
        id:`am-${String(get(a,['Asset_ID','Asset_Tag'])).replace(/[^a-zA-Z0-9_-]/g,'')}`,
        title:`${cls} · ${oem}`,
        asset:String(get(a,['Asset_Tag','Asset_ID'])),
        assetId:String(get(a,['Asset_ID'])),
        assetClass:cls,oem,model:String(get(a,['Model'],'—')),
        healthScore:score,status,
        hotspots:(t.hotspots||[]).map((h,i)=>({...h,state:i===0?stateForStatus(status):h.state,asset:String(get(a,['Asset_Tag','Asset_ID']))}))
      });
    });
  });
  return result;
}
function mediaById(id){const list=visualAssets();return list.find(x=>x.id===id)||list[0]||MEDIA[0]}
function renderHotspots(m){
  return (m.hotspots||[]).map((h,i)=>`<button class="tw292-hot ${h.state==='warn'?'warn':h.state==='ok'?'ok':''}" style="left:${h.x}%;top:${h.y}%" data-hi="${i}" title="${esc(h.title)}"></button>`).join('');
}
function evidenceMetric(m,h){
  const c=calcAt(num($('#tTime')?.value,12),ST);
  const status=m.status||healthStatus(m.healthScore);
  const confidence=Math.max(82,Math.min(98,94-(status==='Critical'?6:status==='Watch'?2:0)));
  return {asset:h?.asset||m.asset,status,power:c.acPoi,poa:c.poa,temp:c.moduleT,eff:c.eta*100,confidence};
}
function renderDetail(m,h){
  const d=evidenceMetric(m,h),box=$('#tw292Detail');if(!box)return;
  const score=Number.isFinite(+m.healthScore)&&+m.healthScore>=0?`${(+m.healthScore).toFixed(0)}/100`:'—';
  const effRow=m.assetClass==='Inverter'?`<div><span>Inverter efficiency</span><b>${d.eff.toFixed(2)}%</b></div>`:`<div><span>Delivered plant power</span><b>${d.power.toFixed(1)} MW</b></div>`;
  box.innerHTML=`<h3>${esc(h?.title||m.title)}</h3><span class="tw292-status">${esc(d.status)} · ${esc(d.asset)}</span>
  <div class="tw345-section-title">Selected asset evidence</div>
  <div class="tw292-detail-grid">
   <div><span>Asset class</span><b>${esc(m.assetClass||m.type)}</b></div><div><span>Health score</span><b>${score}</b></div>
   <div><span>OEM</span><b>${esc(m.oem||'Representative')}</b></div><div><span>Model</span><b>${esc(m.model||'—')}</b></div>
   <div><span>Health status</span><b>${esc(d.status)}</b></div><div><span>Evidence confidence</span><b>${d.confidence.toFixed(0)}%</b></div>
   <div><span>Evidence class</span><b>${esc(m.type)}</b></div><div><span>Asset ID</span><b>${esc(m.assetId||m.asset)}</b></div>
  </div>
  <div class="tw345-section-title">Operating context · selected Solar Hour</div>
  <div class="tw292-detail-grid">
   <div><span>POA irradiance</span><b>${d.poa.toFixed(0)} W/m²</b></div><div><span>Module temperature</span><b>${d.temp.toFixed(1)} °C</b></div>
   ${effRow}<div><span>Solar hour</span><b>${esc($('#tHour')?.textContent||'—')}</b></div>
  </div>
  <div class="tw292-explain">${esc(h?.detail||'Select a hotspot to bind the representative image to the governed Asset Master record and its operating context.')}</div>
  <div class="tw292-actions">
   <button class="primary" data-nav="${esc(h?.nav||'assetexplorer')}">Open linked intelligence</button>
   <button data-nav="assetexplorer">Asset Explorer</button><button data-nav="predictive">Predictive</button><button data-nav="rootcause">Root Cause</button><button data-nav="workorderintelligence">Work Orders</button>
  </div>
  <div class="tw292-license"><b>Asset Master:</b> ${esc(m.assetClass||'—')} · ${esc(m.oem||'—')} · ${esc(m.model||'—')}<br><b>Image rights:</b> ${esc(m.license)}<br><b>Image source:</b> ${esc(m.source)}<br>Representative equipment image mapped to the selected site's governed asset record; it does not claim to depict that exact physical unit unless client/O&M media is connected.</div>`;
  $$('#tw292Detail [data-nav]').forEach(b=>b.onclick=()=>{const target=b.dataset.nav;try{window.activate?.(target)}catch(_){document.querySelector(`[data-view="${target}"]`)?.click()}})
}
function bindVisual(){
  const list=visualAssets();
  if(!list.length)return;
  if(!list.some(x=>x.id===ST.selected))ST.selected=list[0].id;
  const m=mediaById(ST.selected),hero=$('#tw292Hero');if(!hero)return;
  hero.innerHTML=`<img src="${m.img}" alt="${esc(m.title)}" onerror="this.style.display='none';this.parentElement.classList.add('tw347-image-failed')">${renderHotspots(m)}<div class="tw292-hero-cap"><span>${esc(m.title)} · ${esc(m.asset)}</span><span>${esc(m.license)}</span></div>`;
  $$('.tw292-hot',hero).forEach(b=>b.onclick=()=>renderDetail(m,m.hotspots[+b.dataset.hi]));
  $$('.tw292-thumb').forEach(b=>b.classList.toggle('active',b.dataset.id===m.id));
  renderDetail(m,null);
}
function renderVisual(){
  const body=$('#twBody');if(!body)return;
  const list=visualAssets();
  if(!list.length){
    body.innerHTML=`<div class="tw292-card" style="padding:18px"><h3 style="margin:0 0 6px;color:#173f52">Interactive Visual Asset Twin</h3><div style="font:12px Arial;color:#6d828d">No governed Asset Register records were resolved for ${esc(siteId())} in the active data source.</div></div>`;
    return;
  }
  body.innerHTML=`<div class="tw292-visual-grid">
   <section class="tw292-card">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><h3 style="margin:0;font:700 14px Arial;color:#173f52">Interactive Visual Asset Twin</h3><div style="font:9px Arial;color:#6d828d;margin-top:3px">Asset Master-driven representative imagery · click an asset view, then its condition hotspots</div></div><span class="tw292-status">${list.length} governed asset views</span></div>
    <div class="tw345-legend"><span class="ok">● Healthy</span><span class="warn">● Watch</span><span class="crit">● Critical</span><span>Site: ${esc(siteId())}</span></div>
    <div class="tw292-hero" id="tw292Hero"></div>
    <div class="tw292-gallery">${list.map(m=>`<button class="tw292-thumb" data-id="${m.id}"><img src="${m.img}" alt="${esc(m.title)}" onerror="this.style.display='none';this.parentElement.classList.add('tw347-image-failed')"><div><b>${esc(m.assetClass)} · ${esc(m.oem)}</b><small>${esc(m.asset)} · Health ${Number.isFinite(+m.healthScore)?(+m.healthScore).toFixed(0):'—'} · ${esc(m.status)}</small></div></button>`).join('')}</div>
   </section>
   <aside class="tw292-card tw292-detail" id="tw292Detail"></aside>
  </div>`;
  $$('.tw292-thumb').forEach(b=>b.onclick=()=>{ST.selected=b.dataset.id;bindVisual()});bindVisual();
}
window.AIPRenderOperationalTwinVisualEvidence=renderVisual;
function traceHtml(r){
  const b=r.before;
  const items=[
   ['1','Solar geometry',`${(b.shape*100).toFixed(0)}% solar-shape factor`],
   ['2','POA after cloud',`${b.poa.toFixed(0)} W/m²`],
   ['3','Module temperature',`${b.moduleT.toFixed(1)} °C · temp factor ${(b.tempFactor*100).toFixed(1)}%`],
   ['4','DC field',`${b.dcRaw.toFixed(1)} MW`],
   ['5','Inverter curve',`${(b.eta*100).toFixed(2)}% · clipping ${b.clipped.toFixed(1)} MW`],
   ['6','Availability / health',`${(b.availability*100).toFixed(2)}%`],
   ['7','POI curtailment',`${b.curtailed.toFixed(1)} MW constrained`],
   ['8','Delivered AC',`${b.acPoi.toFixed(1)} MW`]
  ];
  return items.map(x=>`<div><i>${x[0]}</i><span>${x[1]}</span><b>${x[2]}</b></div>`).join('');
}
function renderScenario(){
 const body=$('#twBody');if(!body)return; const r=scenario(),p=r.before.p;
 body.innerHTML=`<div class="tw292-scenario">
  <section class="tw292-card">
   <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><h3 style="margin:0;font:700 14px Arial;color:#173f52">Governed Physics Scenario Lab</h3><div style="font:9px Arial;color:#6d828d;margin-top:3px">Controls recalculate the engineering chain; they are not cosmetic percentage multipliers.</div></div><span class="tw292-status">Advisory only · no plant control</span></div>
   <div class="tw292-controls" style="margin-top:10px">
    <div class="tw292-control"><label><span>Cloud cover / irradiance attenuation</span><b>${ST.cloud}%</b></label><input id="xCloud" type="range" min="0" max="80" value="${ST.cloud}"></div>
    <div class="tw292-control"><label><span>Soiling ratio loss</span><b>${ST.soiling.toFixed(1)}%</b></label><input id="xSoil" type="range" min="0" max="12" step=".2" value="${ST.soiling}"></div>
    <div class="tw292-control"><label><span>POI grid curtailment</span><b>${ST.curtail}%</b></label><input id="xCurt" type="range" min="0" max="60" value="${ST.curtail}"></div>
    <div class="tw292-control"><label><span>Asset health / availability state</span><b>${ST.health}%</b></label><input id="xHealth" type="range" min="60" max="100" value="${ST.health}"></div>
    <div class="tw292-control"><label><span>Ambient temperature offset</span><b>${ST.tempOffset>=0?'+':''}${ST.tempOffset} °C</b></label><input id="xTemp" type="range" min="-10" max="18" value="${ST.tempOffset}"></div>
    <div class="tw292-control"><label><span>Intervention to test</span><b>what-if</b></label><select id="xInt">${['Clean modules','Restore inverter','Release curtailment','Cool / inspect inverter'].map(x=>`<option ${x===ST.intervention?'selected':''}>${x}</option>`).join('')}</select></div>
   </div>
   <div class="tw292-results">
    <div><span>Delivered power · now</span><b>${r.before.acPoi.toFixed(1)} MW</b></div>
    <div><span>Post-intervention · now</span><b>${r.after.acPoi.toFixed(1)} MW</b></div>
    <div><span>Immediate recovery</span><b>+${r.gainMW.toFixed(2)} MW</b></div>
    <div><span>Integrated day energy</span><b>${r.db.energy.toFixed(1)} MWh</b></div>
    <div><span>Recoverable day energy</span><b>+${r.gainMWh.toFixed(1)} MWh</b></div>
    <div><span>Indicative revenue recovery</span><b>₹${r.revenueL.toFixed(2)} L</b></div>
   </div>
   <div class="tw292-daily" title="Quarter-hour modeled delivered-power profile">${r.db.pts.map(v=>`<i style="height:${Math.max(1,(v/p.cap)*100)}%"></i>`).join('')}</div>
   <div class="tw292-actions" style="margin-top:10px"><button class="primary" id="xRun">Recalculate & explain</button><button id="xReset">Reset governed assumptions</button><button id="xVisual">Open visual asset twin</button></div>
  </section>
  <aside class="tw292-card">
   <h3 style="margin:0 0 8px;font:700 14px Arial;color:#173f52">Physics trace · current solar hour</h3>
   <div class="tw292-trace">${traceHtml(r)}</div>
   <div class="tw292-note"><b>Model basis:</b> non-linear solar-hour geometry → POA/cloud transmittance → NOCT-style module temperature → module temperature coefficient → DC field → load-sensitive inverter efficiency & clipping → condition-linked availability → POI curtailment → transformer efficiency → delivered AC. Daily MWh is integrated at 15-minute steps; financial recovery is calculated only after physical energy recovery.</div>
  </aside>
 </div>`;
 function wire(id,fn){const e=$(id);if(e)e.oninput=()=>{fn(e);renderScenario()}}
 wire('#xCloud',e=>ST.cloud=+e.value);wire('#xSoil',e=>ST.soiling=+e.value);wire('#xCurt',e=>ST.curtail=+e.value);wire('#xHealth',e=>ST.health=+e.value);wire('#xTemp',e=>ST.tempOffset=+e.value);
 $('#xInt').onchange=e=>{ST.intervention=e.target.value;renderScenario()};
 $('#xRun').onclick=()=>{const z=scenario();window.toast?.(`Physics scenario: +${z.gainMWh.toFixed(1)} MWh / ₹${z.revenueL.toFixed(2)} L potential recovery`)};
 $('#xReset').onclick=()=>{Object.assign(ST,{cloud:18,soiling:2.2,curtail:0,health:93,tempOffset:0,intervention:'Clean modules'});renderScenario()};
 $('#xVisual').onclick=()=>{const b=[...$$('#tLayers .xi-tab')].find(x=>x.textContent.trim()==='Visual Evidence');if(b){$$('#tLayers .xi-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active')}window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};window.AIP_V21.state.layer='Visual Evidence';if(typeof window.AIPRenderOperationalTwinVisualEvidence==='function')window.AIPRenderOperationalTwinVisualEvidence();};
}
function hook(){
  if(!window.AIP_V21?.renderers?.operationaltwin)return setTimeout(hook,100);
  const orig=window.AIP_V21.renderers.operationaltwin;
  if(orig&&!orig.__v292){const w=function(){orig();setTimeout(enhanceToolbar,30)};w.__v292=true;window.AIP_V21.renderers.operationaltwin=w}
  if($('#view-operationaltwin.active'))setTimeout(enhanceToolbar,60);
}
hook();
document.addEventListener('aip:data-source-changed',()=>setTimeout(enhanceToolbar,100));
})();
