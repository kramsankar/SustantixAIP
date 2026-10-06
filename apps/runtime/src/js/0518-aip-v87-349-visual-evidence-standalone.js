
(function(){
'use strict';

const MEDIA = {"Inverter":{"img":"assets/img-a61d06dd7a8b5d.jpg","title":"Inverter","license":"Rights-cleared representative image"},"Tracker":{"img":"assets/img-c52b58c3d5eb40.jpg","title":"Tracker","license":"Rights-cleared representative image"},"Transformer":{"img":"assets/img-208f99156ffc17.jpg","title":"Transformer","license":"CC BY-SA representative image"},"Switchgear":{"img":"assets/img-8224f970fed620.jpg","title":"Switchgear","license":"Public-domain representative image"},"SCB":{"img":"assets/img-09c5d8d056496a.jpg","title":"Solar combiner box","license":"CC BY-SA representative image"},"Weather Station":{"img":"assets/img-ac6ebd0fff6b75.jpg","title":"Weather station","license":"CC BY-SA representative image"},"PV Module":{"img":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22800%22%20height%3D%22500%22%20viewBox%3D%220%200%20800%20500%22%3E%3Crect%20width%3D%22800%22%20height%3D%22500%22%20fill%3D%22%23eef4f6%22/%3E%3Crect%20x%3D%22245%22%20y%3D%2230%22%20width%3D%22310%22%20height%3D%22390%22%20rx%3D%225%22%20fill%3D%22%238a9aa6%22/%3E%3Crect%20x%3D%22253%22%20y%3D%2238%22%20width%3D%22294%22%20height%3D%22374%22%20fill%3D%22%23132c50%22/%3E%3Crect%20x%3D%22260%22%20y%3D%2245%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M269%2045v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22330%22%20y%3D%2245%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M339%2045v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22400%22%20y%3D%2245%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M409%2045v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22470%22%20y%3D%2245%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M479%2045v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22260%22%20y%3D%22105%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M269%20105v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22330%22%20y%3D%22105%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M339%20105v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22400%22%20y%3D%22105%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M409%20105v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22470%22%20y%3D%22105%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M479%20105v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22260%22%20y%3D%22165%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M269%20165v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22330%22%20y%3D%22165%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M339%20165v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22400%22%20y%3D%22165%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M409%20165v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22470%22%20y%3D%22165%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M479%20165v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22260%22%20y%3D%22225%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M269%20225v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22330%22%20y%3D%22225%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M339%20225v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22400%22%20y%3D%22225%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M409%20225v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22470%22%20y%3D%22225%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M479%20225v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22260%22%20y%3D%22285%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M269%20285v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22330%22%20y%3D%22285%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M339%20285v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22400%22%20y%3D%22285%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M409%20285v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22470%22%20y%3D%22285%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M479%20285v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22260%22%20y%3D%22345%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M269%20345v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22330%22%20y%3D%22345%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M339%20345v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22400%22%20y%3D%22345%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M409%20345v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%22470%22%20y%3D%22345%22%20width%3D%2262%22%20height%3D%2252%22%20rx%3D%225%22%20fill%3D%22%23294a80%22%20stroke%3D%22%237293bb%22/%3E%3Cpath%20d%3D%22M479%20345v52m20-52v52m20-52v52%22%20stroke%3D%22%239eb1cb%22%20stroke-width%3D%221%22/%3E%3Ctext%20x%3D%22400%22%20y%3D%22455%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-size%3D%2220%22%20fill%3D%22%23173f57%22%3EPV%20module%20-%20illustrative%20schematic%3C/text%3E%3Ctext%20x%3D%22400%22%20y%3D%22480%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%20fill%3D%22%23526c7c%22%3ENot%20a%20site%20photograph%20or%20defect%20image%3C/text%3E%3C/svg%3E","title":"PV module schematic","license":"AIP illustrative schematic; not a site photograph"}};
const VE351_EXCEL_TELEMETRY=__AIP_DS("1939114823246efb");
const VE351_SYN_TELEMETRY=__AIP_DS("1939114823246efb")


function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function normSite(v){
  const x=String(v??'').trim().toUpperCase(),m=x.match(/^(?:SP|SOL)[-_ ]?0*(\d+)$/);
  return m?'SP-'+String(Number(m[1])).padStart(2,'0'):x;
}
function dataSheet(name){const result=__pv864_base_dataSheet(name);return window.AIP_PV864?.linkedRows(name,result)??result;}function __pv864_base_dataSheet(name){if(window.AIP891?.isUploaded())return window.AIP891.raw(name);
  let mode='';try{mode=String(APM_DATA_MODE||'').toLowerCase()}catch(_){}
  let ex={},syn={},imp={};
  try{ex=EMBEDDED_EXCEL_DATA||{}}catch(_){ex=window.EMBEDDED_EXCEL_DATA||{}}
  try{syn=AIP_INDEPENDENT_SYNTHETIC_DATA||{}}catch(_){syn=window.AIP_INDEPENDENT_SYNTHETIC_DATA||{}}
  try{imp=APM_IMPORTED_DATA||{}}catch(_){imp=window.APM_IMPORTED_DATA||{}}
  const er=Array.isArray(ex?.[name])?ex[name]:[];
  const sr=Array.isArray(syn?.[name])?syn[name]:[];
  const ir=Array.isArray(imp?.[name])?imp[name]:[];
  if(/synthetic|demo data/.test(mode)||window.AIP_SYNTHETIC_ACTIVE===true)return sr.length?sr:(er.length?er:ir);
  return ir.length?ir:(er.length?er:sr);
}
function selectedSite(){
  const s=document.querySelector('#view-operationaltwin #tSite');
  return normSite(s?.value||window.AIP_TWIN_SITE||'SP-01');
}
function solarHour(){
  const r=document.querySelector('#view-operationaltwin #tTime');
  return num(r?.value,12);
}
function assetsForSite(){
  const rows=dataSheet('Asset Master'),site=selectedSite();
  return rows.filter(a=>normSite(a.Plant_ID??a.Site_ID??a.Plant??a.Site)===site);
}
function status(score){
  const s=num(score,-1);return s<0?'No data':s<65?'Critical':s<80?'Watch':'Healthy';
}
function sclass(st){return st==='Critical'?'c':st==='Watch'?'w':'h'}
function telemetryContext(){
  const site=selectedSite(),h=solarHour();
  const hh=String(Math.floor(h)).padStart(2,'0'),mm=String(Math.round((h%1)*60)).padStart(2,'0');
  const key=site+'|'+hh+':'+mm;
  let mode='';try{mode=String(APM_DATA_MODE||'').toLowerCase()}catch(_){}
  const synthetic=/synthetic/.test(mode)||window.AIP_SYNTHETIC_ACTIVE===true;
  const source=synthetic?VE351_SYN_TELEMETRY:VE351_EXCEL_TELEMETRY;
  let a=source[key];
  if(!a){
    let best=null,bestDelta=Infinity;
    Object.keys(source).forEach(k=>{
      if(!k.startsWith(site+'|'))return;
      const tm=k.split('|')[1],p=tm.split(':').map(Number),rh=p[0]+p[1]/60,d=Math.abs(rh-h);
      if(d<bestDelta){best=source[k];bestDelta=d}
    });
    a=best;
  }
  return a?{POA_Wm2:a[0],Module_Temp_C:a[1],Actual_AC_MW:a[2],Inverter_Efficiency_Pct:a[3],Wind_Speed_ms:a[4],Ambient_Temp_C:a[5],GHI_Wm2:a[6],Cloud_Cover_Pct:a[7]}:{};
}
function siteContextExtra(){
  const rows=dataSheet('Twin Telemetry'),site=selectedSite(),h=solarHour();
  const toHour=r=>{
    const t=String(r.Timestamp||'').trim();
    const m=t.match(/(?:T|\s)(\d{2}):(\d{2})/);
    return m?+m[1]+(+m[2]/60):NaN;
  };
  let best=null,bestDelta=Infinity;
  rows.filter(r=>normSite(r.Plant_ID)===site&&String(r.Weather_Mode||'Observed')==='Observed').forEach(r=>{
    const rh=toHour(r);
    if(!Number.isFinite(rh))return;
    const d=Math.abs(rh-h);
    if(d<bestDelta){best=r;bestDelta=d;}
  });
  return best||{};
}
function views(){
  const assets=assetsForSite(),classes=['Inverter','Transformer','Switchgear','SCB','Tracker','Weather Station','PV Module'],out=[];
  classes.forEach(cls=>{
    const group=assets.filter(a=>String(a.Asset_Class||a.Asset_Type||'').toLowerCase().includes(cls.toLowerCase().replace(' station','')));
    if(!group.length)return;
    const byOem={};group.forEach(a=>{const o=String(a.OEM||a.Manufacturer||'Unknown OEM');(byOem[o]||(byOem[o]=[])).push(a)});
    Object.entries(byOem).slice(0,2).forEach(([o,list],oi)=>{
      const a=[...list].sort((x,y)=>num(x.Health_Score,100)-num(y.Health_Score,100))[0],st=status(a.Health_Score);
      out.push({cls,oem:o,model:a.Model||'—',id:a.Asset_ID||a.Asset_Tag,tag:a.Asset_Tag||a.Asset_ID,score:num(a.Health_Score,-1),st,img:MEDIA[cls]?.img||'',lic:MEDIA[cls]?.license||'Representative image',profileId:cls+'-'+(oi+1)});
    });
  });
  return out;
}
function evidenceFindings(v){
  const rows=dataSheet('Visual Evidence Registry');
  return rows.filter(r=>String(r.Evidence_Profile_ID)===String(v.profileId));
}
function findingClass(sev){return sev==='Critical'?'c':sev==='Watch'?'w':'h'}
function findingDisplay(sev){
  return sev==='Critical'?'Finding Severity: CRITICAL':sev==='Watch'?'Finding Severity: WATCH':'Reference Condition: NORMAL';
}
function findingTooltip(f){
  const state=String(f.Severity||'Healthy')==='Healthy'?'Normal Reference':String(f.Severity||'');
  return `${f.Finding_Type} · ${state} · ${f.Detection_Source} · ${f.Validation_Status}`;
}
function renderDetail(v,f){
  const box=document.querySelector('#view-operationaltwin #ve349Detail');if(!box)return;
  const t=telemetryContext(),x=t;
  const poa=Number(t.POA_Wm2),mt=Number(t.Module_Temp_C),ac=Number(t.Actual_AC_MW),eff=Number(t.Inverter_Efficiency_Pct);
  const amb=Number(x.Ambient_Temp_C),wind=Number(x.Wind_Speed_ms),ghi=Number(x.GHI_Wm2),cloud=Number(x.Cloud_Cover_Pct);
  const show=n=>Number.isFinite(n);
  let contextRows='';
  if(v.cls==='Inverter'){
    contextRows=`<div><span>POA irradiance</span><b>${show(poa)?poa.toFixed(0)+' W/m²':'—'}</b></div><div><span>Module temperature</span><b>${show(mt)?mt.toFixed(1)+' °C':'—'}</b></div><div><span>Delivered AC power</span><b>${show(ac)?ac.toFixed(1)+' MW':'—'}</b></div><div><span>Inverter efficiency</span><b>${show(eff)?eff.toFixed(2)+'%':'—'}</b></div>`;
  }else if(v.cls==='Tracker'){
    contextRows=`<div><span>POA irradiance</span><b>${show(poa)?poa.toFixed(0)+' W/m²':'—'}</b></div><div><span>Module temperature</span><b>${show(mt)?mt.toFixed(1)+' °C':'—'}</b></div><div><span>Delivered AC power</span><b>${show(ac)?ac.toFixed(1)+' MW':'—'}</b></div><div><span>Wind speed</span><b>${show(wind)?wind.toFixed(1)+' m/s':'—'}</b></div>`;
  }else if(v.cls==='Transformer'){
    contextRows=`<div><span>Delivered AC power</span><b>${show(ac)?ac.toFixed(1)+' MW':'—'}</b></div><div><span>Ambient temperature</span><b>${show(amb)?amb.toFixed(1)+' °C':'—'}</b></div><div><span>POA irradiance · site context</span><b>${show(poa)?poa.toFixed(0)+' W/m²':'—'}</b></div>`;
  }else if(v.cls==='SCB'){
    contextRows=`<div><span>POA irradiance</span><b>${show(poa)?poa.toFixed(0)+' W/m²':'—'}</b></div><div><span>Delivered plant AC power</span><b>${show(ac)?ac.toFixed(1)+' MW':'—'}</b></div><div><span>Ambient temperature</span><b>${show(amb)?amb.toFixed(1)+' °C':'—'}</b></div>`;
  }else if(v.cls==='Switchgear'){
    contextRows=`<div><span>Delivered AC power</span><b>${show(ac)?ac.toFixed(1)+' MW':'—'}</b></div><div><span>Ambient temperature</span><b>${show(amb)?amb.toFixed(1)+' °C':'—'}</b></div>`;
  }else if(v.cls==='Weather Station'){
    contextRows=`<div><span>POA irradiance</span><b>${show(poa)?poa.toFixed(0)+' W/m²':'—'}</b></div><div><span>GHI</span><b>${show(ghi)?ghi.toFixed(0)+' W/m²':'—'}</b></div><div><span>Ambient temperature</span><b>${show(amb)?amb.toFixed(1)+' °C':'—'}</b></div><div><span>Wind speed</span><b>${show(wind)?wind.toFixed(1)+' m/s':'—'}</b></div><div><span>Cloud cover</span><b>${show(cloud)?cloud.toFixed(1)+'%':'—'}</b></div>`;
  }else{
    contextRows=`<div><span>Delivered AC power</span><b>${show(ac)?ac.toFixed(1)+' MW':'—'}</b></div><div><span>POA irradiance · site context</span><b>${show(poa)?poa.toFixed(0)+' W/m²':'—'}</b></div>`;
  }

  const finding=f||evidenceFindings(v)[0]||{};
  const sev=String(finding.Severity||'Healthy');
  const conf=Number(finding.Detection_Confidence_Pct);
  box.innerHTML=`<h3 style="margin:0;color:#173f52;font:700 14px Arial">${esc(finding.Finding_Type||v.cls+' · '+v.oem)}</h3>
  <div class="ve349-section ve359-finding">Selected finding</div>
  <div class="ve349-grid">
    <div><span>${sev==='Healthy'?'Reference condition':'Finding severity'}</span><b class="ve351-text-${findingClass(sev)}">${sev==='Healthy'?'Normal':esc(sev)}</b></div>
    <div><span>Detection source</span><b>${esc(finding.Detection_Source||'—')}</b></div>
    <div><span>Measurement / observation</span><b>${esc(finding.Measurement||'—')}</b></div>
    <div><span>Severity basis</span><b>${esc(finding.Severity_Basis||'—')}</b></div>
    <div><span>Detection confidence</span><b>${Number.isFinite(conf)?conf.toFixed(0)+'%':'—'}</b></div>
    <div><span>Confidence source</span><b>${esc(finding.Confidence_Source||'—')}</b></div>
    <div><span>Validation status</span><b>${esc(finding.Validation_Status||'—')}</b></div>
    <div><span>Captured at</span><b>${esc(finding.Captured_At||'—')}</b></div>
    <div><span>Finding ID</span><b>${esc(finding.Finding_ID||'—')}</b></div>
  </div>
  <div class="ve349-section ve359-asset">Selected asset evidence</div>
  <div class="ve349-grid">
   <div><span>Asset ID / Tag</span><b>${esc(v.id)} · ${esc(v.tag)}</b></div><div><span>Asset class</span><b>${esc(v.cls)}</b></div>
   <div><span>OEM</span><b>${esc(v.oem)}</b></div><div><span>Model</span><b>${esc(v.model)}</b></div>
   <div><span>Health score</span><b>${v.score>=0?v.score.toFixed(0)+'/100':'—'}</b></div><div><span>Overall asset health status</span><b class="ve351-text-${sclass(v.st)}">${esc(v.st)}</b></div>
   <div><span>Evidence class</span><b>${esc(v.cls)} inspection</b></div>
  </div>
  <div class="ve349-section ve359-context">Operating context · selected Solar Hour</div>
  <div class="ve349-grid">${contextRows}</div>
  `;
}
function bind(v){
  const hero=document.querySelector('#view-operationaltwin #ve349Hero');if(!hero)return;
  const findings=evidenceFindings(v);
  const spots=findings.map((f,i)=>`<button class="ve349-hot ${findingClass(String(f.Severity||'Healthy'))}" style="left:${Number(f.Hotspot_X_Pct)||50}%;top:${Number(f.Hotspot_Y_Pct)||50}%" data-fi="${i}" data-tip="${esc(findingTooltip(f))}" aria-label="${esc(findingTooltip(f))}"></button>`).join('');
  hero.innerHTML=`<img src="${v.img}" alt="${esc(v.cls)}">${spots}<div class="ve349-hero-cap"><span>${esc(v.cls)} · ${esc(v.oem)} · ${esc(v.tag)}</span><span>${esc(v.lic)}</span></div>`;
  hero.querySelectorAll('.ve349-hot').forEach(b=>{
    b.onclick=()=>{const f=findings[+b.dataset.fi];if(f)renderDetail(v,f)};
  });
  document.querySelectorAll('#view-operationaltwin .ve349-thumb').forEach(b=>b.classList.toggle('active',b.dataset.id===String(v.id)));
  renderDetail(v,findings[0]);
}
function render(){
  const view=document.getElementById('view-operationaltwin');if(!view)return;
  let body=view.querySelector('#twBody');
  if(!body){
    const exp=view.querySelector('#twExperienceBody');
    if(exp){body=document.createElement('div');body.id='twBody';exp.appendChild(body)}
    else return;
  }
  const list=views();
  if(!list.length){
    body.innerHTML=`<div class="ve349-card ve349-empty"><b>Visual Evidence</b><br>No governed Asset Master records were resolved for ${esc(selectedSite())} in the active data source.</div>`;
    return;
  }
  window.__VE349_SELECTED=window.__VE349_SELECTED||String(list[0].id);
  let sel=list.find(x=>String(x.id)===String(window.__VE349_SELECTED))||list[0];
  body.innerHTML=`<div class="ve349-shell"><section class="ve349-card"><div class="ve349-head"><div><h3>Interactive Visual Asset Twin</h3><small>Asset Master-driven representative imagery · click an asset view, then a condition point</small></div><span class="ve349-count">${list.length} governed asset views</span></div><div class="ve349-legend"><span class="h">● Healthy</span><span class="w">● Watch</span><span class="c">● Critical</span><span>Site ${esc(selectedSite())}</span></div><div class="ve349-hero" id="ve349Hero"></div><div class="ve349-gallery">${list.map(v=>`<button class="ve349-thumb" data-id="${esc(v.id)}"><img src="${v.img}" alt="${esc(v.cls)}"><div><b>${esc(v.cls)} · ${esc(v.oem)}</b><small>${esc(v.tag)} · Health ${v.score>=0?v.score.toFixed(0):'—'} · ${esc(v.st)}</small></div></button>`).join('')}</div></section><aside class="ve349-card" id="ve349Detail"></aside></div>`;
  document.querySelectorAll('#view-operationaltwin .ve349-thumb').forEach(b=>b.onclick=()=>{window.__VE349_SELECTED=b.dataset.id;const v=list.find(x=>String(x.id)===String(b.dataset.id));if(v)bind(v)});
  bind(sel);
}
window.AIPRenderOperationalTwinVisualEvidenceStandalone=render;

document.addEventListener('click',function(e){
  const btn=e.target.closest?.('#view-operationaltwin #tLayers .xi-tab');
  if(!btn||btn.textContent.trim()!=='Visual Evidence')return;
  e.preventDefault();e.stopImmediatePropagation();
  const view=document.getElementById('view-operationaltwin');
  view?.querySelectorAll('#tLayers .xi-tab').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  try{window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};window.AIP_V21.state.layer='Visual Evidence'}catch(_){}
  render();
},true);

document.addEventListener('change',function(e){
  if(e.target?.matches?.('#view-operationaltwin #tSite')&&document.querySelector('#view-operationaltwin #tLayers .xi-tab.active')?.textContent.trim()==='Visual Evidence')setTimeout(render,0);
},true);
document.addEventListener('input',function(e){
  if(e.target?.matches?.('#view-operationaltwin #tTime')){
    const active=document.querySelector('#view-operationaltwin #tLayers .xi-tab.active')?.textContent.trim();
    if(active==='Visual Evidence'){
      requestAnimationFrame(()=>requestAnimationFrame(render));
      setTimeout(render,0);
    }
  }
},false);
})();
