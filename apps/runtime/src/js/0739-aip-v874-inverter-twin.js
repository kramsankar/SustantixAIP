
/* AIP v874 · Inverter-level twin engine (pure functions, no data). Uses AIPTwinPhysics for the shared plant physics. */
(function(root){
'use strict';
var E=root.AIPTwinPhysics;
function num(v,d){if(v===null||v===undefined||(typeof v==='string'&&v.trim()===''))return d;var x=Number(v);return Number.isFinite(x)?x:d;}
function median(a){a=a.filter(Number.isFinite).sort(function(x,y){return x-y});if(!a.length)return NaN;var m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
var CAUSES={trip:{label:'Inverter trip / outage',action:'Read the alarm log, run an insulation-resistance test on the DC side and restart only after the fault is cleared; open a corrective work order.',priority:'P1'},
  derate:{label:'Thermal derating',action:'Inspect cooling fans, air filters and heat-sink fouling; check enclosure ventilation and fan run hours.',priority:'P2'},
  strings:{label:'DC-side loss (strings / SCB)',action:'Check string-combiner currents, fuses and connectors; IV-curve trace the low strings.',priority:'P2'},
  tracker:{label:'Tracker / orientation fault',action:'Check the tracker controller and drive for this block; compare actual angle with setpoint; restore tracking.',priority:'P2'},
  conversion:{label:'Low conversion efficiency',action:'Compare efficiency trend with sister inverters; inspect IGBT modules and DC-link capacitors; raise an OEM service ticket.',priority:'P3'},
  data:{label:'Telemetry gap',action:'Restore the data-logger / fibre link and back-fill from inverter memory.',priority:'P3'},
  other:{label:'Unexplained shortfall',action:'Review against sister inverters over several days before intervening.',priority:'P3'}};

/* expected vs measured for every inverter over the operating day */
function analyse(P,plantRows,cfg,invRows,opts){
  opts=opts||{};var dt=opts.dt||0.25,deratC=num(opts.derateStartC,55),tariff=opts.tariff;
  var plantBy={};plantRows.forEach(function(r){var x=E.interval(P,r);if(x)plantBy[String(r.Timestamp)]=x});
  var rowsBy={};invRows.forEach(function(r){(rowsBy[r.Asset_ID]=rowsBy[r.Asset_ID]||[]).push(r)});
  var timeline=Object.keys(plantBy).sort();
  var out=cfg.map(function(c){
    var ac=num(c.AC_Rating_MW,NaN),dc=num(c.DC_Capacity_MWp,NaN),pdcInv=ac/P.invEff,rows=(rowsBy[c.Asset_ID]||[]).slice().sort(function(a,b){return String(a.Timestamp).localeCompare(String(b.Timestamp))});
    var inputBy={};rows.forEach(function(r){(inputBy[String(r.Timestamp)]=inputBy[String(r.Timestamp)]||[]).push(r)});
    rows=timeline.map(function(t){var a=inputBy[t]||[],r=a.length===1?Object.assign({},a[0]):{Timestamp:t,Asset_ID:c.Asset_ID};
      var bad=a.length!==1?'missing or duplicate interval':/stale|bad|invalid/i.test(String(r.Quality_Flag||''))?'stale or invalid quality':r.Data_Quality_Pct!=null&&num(r.Data_Quality_Pct,0)<80?'low data quality':r.Measurement_Timestamp&&String(r.Measurement_Timestamp)!==t?'stale timestamp':null;
      if(bad){r.AC_Power_MW=null;r.DC_Power_MW=null;r.Status='Unknown: '+bad}return r});
    var S={exp:0,act:0,gapExp:0,trip:0,derate:0,dcShort:0,conv:0,gapN:0,n:0,iv:[]},ratiosNoon=[],ratiosShoulder=[],effDiff=[],maxT=-99,alarms={};
    rows.forEach(function(r){
      var x=plantBy[String(r.Timestamp)];if(!x)return;
      var dcExp=P.pdc0>0&&x.states?dc*x.states.s5/P.pdc0:dc*x.poa/1000*x.tempFactor*x.soilingRatio*(1-P.dcLoss)*P.degrFactor,eta=E.inverterEfficiency(dcExp,pdcInv,P.invEff),acExp=Math.min(dcExp*eta,ac)*(1-x.curtailment);
      var acM=num(r.AC_Power_MW,NaN),dcM=num(r.DC_Power_MW,NaN),st=String(r.Status||''),tI=num(r.Inverter_Temp_C,NaN),rot=x.orient&&x.orient.rotation!=null?Math.abs(x.orient.rotation):null,el=x.sun.elevation;
      if(r.Alarm_Code)alarms[r.Alarm_Code]=(alarms[r.Alarm_Code]||0)+1;
      var rec={t:x.t,acExp:acExp,dcExp:dcExp,acM:acM,dcM:dcM,st:st,tI:tI,poa:x.poa,rot:rot,el:el,etaExp:eta};S.iv.push(rec);S.n++;
      if(!Number.isFinite(acM)){S.gapN++;S.gapExp+=acExp*dt;return}
      if(tI>maxT)maxT=tI;S.exp+=acExp*dt;S.act+=acM*dt;var gap=Math.max(0,acExp-acM)*dt;
      if(/trip/i.test(st)||(acM<ac*0.01&&acExp>ac*0.05)){rec.classified='trip';S.trip+=gap;return}
      if(/derat/i.test(st)||(tI>deratC+2&&acM<acExp*0.95&&acM>ac*0.6)){rec.classified='derate';S.derate+=gap;return}
      if(dcExp>ac*0.15&&Number.isFinite(dcM)&&x.curtailment<0.001){var rt=dcM/dcExp;if(el>=55)ratiosNoon.push(rt);else if(el>=12&&el<=35&&P.mounting==='tracker')ratiosShoulder.push(rt);
        if(dcM>0)effDiff.push(acM/dcM-E.inverterEfficiency(dcM,pdcInv,P.invEff));}
    });
    var rn=median(ratiosNoon),rs=median(ratiosShoulder),ed=median(effDiff);
    // attribute remaining (non-trip, non-derate) shortfall between DC side, tracker and conversion by signature
    var rem=0;S.iv.forEach(function(q){if(Number.isFinite(q.acM)&&!q.classified&&!(q.acM<num(c.AC_Rating_MW)*0.01&&q.acExp>num(c.AC_Rating_MW)*0.05))rem+=Math.max(0,q.acExp-q.acM)*dt});
    var trackerSig=Number.isFinite(rs)&&Number.isFinite(rn)&&rs<rn-0.08,dcSig=Number.isFinite(rn)&&rn<0.97,convSig=Number.isFinite(ed)&&ed<-0.008;
    var wT=trackerSig?(rn-rs):0,wD=dcSig?(1-rn):0,wC=convSig?(-ed):0,wSum=wT+wD+wC;
    if(wSum>0){S.tracker=rem*wT/wSum;S.dcShort=rem*wD/wSum;S.conv=rem*wC/wSum;S.other=0}else{S.tracker=0;S.dcShort=0;S.conv=0;S.other=rem}
    var lost=S.trip+S.derate+S.dcShort+S.tracker+S.conv+S.other,pi=S.exp>0?S.act/S.exp:NaN;
    var causes=[['trip',S.trip],['derate',S.derate],['strings',S.dcShort],['tracker',S.tracker],['conversion',S.conv],['other',S.other]].sort(function(a,b){return b[1]-a[1]});
    var primary=causes[0][1]>Math.max(0.05,0.008*S.exp)?causes[0][0]:(S.gapN?'data':null);
    var ev=[];if(S.trip>0)ev.push('offline '+Math.round(S.iv.filter(function(q){return /trip/i.test(q.st)}).length*dt*60)+' min');if(S.derate>0)ev.push('max inverter temperature '+maxT.toFixed(1)+' °C');
    if(dcSig)ev.push('DC ratio '+(rn*100).toFixed(1)+'% of expected (≈ '+Math.round((1-rn)*num(c.Strings,0))+' strings)');if(trackerSig)ev.push('DC ratio '+(rs*100).toFixed(0)+'% at low sun vs '+(rn*100).toFixed(0)+'% near noon');
    if(convSig)ev.push('efficiency '+(ed*100).toFixed(2)+' pp below curve');if(S.gapN)ev.push(S.gapN+' interval(s) without data');
    Object.keys(alarms).forEach(function(k){ev.push('alarm '+k)});
    return {cfg:c,id:c.Asset_ID,tag:String(c.Inverter_Tag||c.Asset_ID),block:String(c.Block_ID||''),ac:ac,dc:dc,exp:S.exp,act:S.act,pi:pi,lost:lost,coveragePct:timeline.length?(timeline.length-S.gapN)/timeline.length*100:0,lossBalanceError:lost-S.iv.reduce(function(a,q){return a+(Number.isFinite(q.acM)?Math.max(0,q.acExp-q.acM)*dt:0)},0),gapN:S.gapN,gapExp:S.gapExp,parts:{trip:S.trip,derate:S.derate,strings:S.dcShort,tracker:S.tracker,conversion:S.conv,other:S.other},
      primary:primary,evidence:ev,value:Number.isFinite(tariff)?lost*1000*tariff:NaN,ratioNoon:rn,ratioShoulder:rs,effDiff:ed,maxT:maxT,iv:S.iv,alarms:alarms};
  });
  /* a DC shortfall shared by the whole fleet is a site-level effect (irradiance sensor, soiling station, model bias), not a string fault on every inverter */
  var medRn=median(out.map(function(o){return o.ratioNoon}));
  if(Number.isFinite(medRn)&&medRn>0)out.forEach(function(o){if(o.parts.strings>0&&Number.isFinite(o.ratioNoon)&&o.ratioNoon/medRn>=0.97){
    o.parts.other+=o.parts.strings;o.parts.strings=0;
    var cs=[['trip',o.parts.trip],['derate',o.parts.derate],['strings',0],['tracker',o.parts.tracker],['conversion',o.parts.conversion],['other',o.parts.other]].sort(function(a,b){return b[1]-a[1]});
    o.primary=cs[0][1]>Math.max(0.05,0.008*o.exp)?cs[0][0]:(o.gapN?'data':null);
    o.evidence=o.evidence.filter(function(e){return !/strings\)$/.test(e)});o.evidence.push('shortfall shared by the whole fleet — see Physics & Losses residual');}});
  var pis=out.map(function(o){return o.pi}).filter(Number.isFinite),med=median(pis);
  out.forEach(function(o){o.relPI=Number.isFinite(o.pi)&&med>0?o.pi/med:NaN;o.flag=o.gapN>0&&!(o.primary&&o.primary!=='other'&&o.lost>=Math.max(0.05,0.008*o.exp))?'data':(o.primary&&o.primary!=='other'&&o.lost>=Math.max(0.05,0.008*o.exp))?'underperforming':(o.primary==='other'&&o.relPI<0.97?'underperforming':'ok')});
  return {inverters:out,medianPI:med};
}
/* plant revenue meter vs Σ inverter AC after governed AC and transformer losses */
function reconcile(P,plantRows,invRows,dt,cfg){
  dt=dt||0.25;var by={},gaps={},seen={};invRows.forEach(function(r){var k=String(r.Timestamp),v=num(r.AC_Power_MW,NaN);(seen[k]=seen[k]||{})[r.Asset_ID]=((seen[k]||{})[r.Asset_ID]||0)+1;if(Number.isFinite(v))by[k]=(by[k]||0)+v;else gaps[k]=(gaps[k]||0)+1});
  var meter=0,inv=0,nGap=0,worst=0,ivs=[];
  plantRows.forEach(function(r){var k=String(r.Timestamp);if(cfg)cfg.forEach(function(c){if(!seen[k]||seen[k][c.Asset_ID]!==1)gaps[k]=(gaps[k]||0)+1});var m=num(r.Actual_AC_MW,0),s=(by[k]||0)*(1-P.acLoss)*P.xfmrEff;meter+=m*dt;inv+=s*dt;if(gaps[k])nGap++;var d=m>1?(s-m)/m:0;if(!gaps[k]&&Math.abs(d)>Math.abs(worst))worst=d;ivs.push({k:k,m:m,s:s,gap:gaps[k]||0})});
  return {meter:meter,inverters:inv,diffPct:meter>0?(inv-meter)/meter*100:NaN,gapIntervals:nGap,worstNoGapPct:worst*100,intervals:ivs};
}
root.AIPInverterTwin={version:'877.1',CAUSES:CAUSES,analyse:analyse,reconcile:reconcile,median:median};
})(typeof window!=='undefined'?window:globalThis);

/* AIP v874 · Operational Twin › Inverters tab. Every value computed in the browser from the active data source. */
(function(){
'use strict';
var E=window.AIPTwinPhysics,I=window.AIPInverterTwin;if(!E||!I)return;
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var n=function(v,d){if(v===null||v===undefined||v==='')return d===undefined?NaN:d;var x=Number(v);return Number.isFinite(x)?x:(d===undefined?NaN:d)};
var esc=function(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var fmt=function(v,d){return Number.isFinite(v)?v.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—'};
var f0=function(v){return fmt(v,0)},f1=function(v){return fmt(v,1)},f2=function(v){return fmt(v,2)},f3=function(v){return fmt(v,3)};
var hhmm=E.hhmm,VIEW='fleet',SEL=null;
function synth(){return window.AIP_SYNTHETIC_ACTIVE===true||/synthetic/i.test(String(window.APM_DATA_MODE||''))}
function R(k){if(window.AIP891?.isUploaded())return window.AIP891.raw(k);var st=[];try{if(typeof APM_IMPORTED_DATA!=='undefined')st.push(APM_IMPORTED_DATA)}catch(_){}
  try{st.push(synth()?(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined'?AIP_INDEPENDENT_SYNTHETIC_DATA:null):(typeof EMBEDDED_EXCEL_DATA!=='undefined'?EMBEDDED_EXCEL_DATA:null))}catch(_){}
  st.push(synth()?window.AIP_INDEPENDENT_SYNTHETIC_DATA:window.EMBEDDED_EXCEL_DATA);
  if(synth()){try{if(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined')st.push(AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData)}catch(_){}}
  for(var i=0;i<st.length;i++){var a=st[i]&&st[i][k];if(Array.isArray(a)&&a.length)return a}
  if(k==='Sites'){try{if(typeof PLANTS!=='undefined'&&PLANTS.length)return PLANTS.map(function(p){return {Plant_ID:p.id,Plant_Name:p.name,Capacity_MW:p.mw,Inverter_Count:p.inverters,Tracker_Rows:p.trackerRows,Commission_Year:p.commission}})}catch(_){}}
  return []}
function modeLabel(){var m='';try{m=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'')}catch(_){}return synth()?'Synthetic dataset':(m||'Excel dataset')}
function same(a,b){return String(a==null?'':a).trim()===String(b==null?'':b).trim()}
function pid(){var s=$('#view-operationaltwin #tSite');return (s&&s.value)||window.AIP_TWIN_SITE||'SP-01'}
function selHour(){var t=$('#view-operationaltwin #tTime');return n(t&&t.value,12)}
var CACHE={};
function model(id){
  var p=R('Twin Engineering Parameters').find(function(x){return same(x.Plant_ID,id)});if(!p)return {error:'No Twin Engineering Parameters row for '+id};
  var site=R('Sites').find(function(x){return same(x.Plant_ID,id)})||null;
  var tel=R('Twin Telemetry').filter(function(r){return same(r.Plant_ID,id)&&String(r.Weather_Mode||'Observed')==='Observed'&&E.parseStamp(r.Timestamp)});
  if(!tel.length)return {error:'No observed Twin Telemetry for '+id};
  var date=tel.map(function(r){return E.parseStamp(r.Timestamp).date}).sort().pop();tel=tel.filter(function(r){return E.parseStamp(r.Timestamp).date===date});
  var cfg=R('Inverter Configuration').filter(function(c){return same(c.Plant_ID,id)});
  var it=R('Inverter Telemetry').filter(function(r){return same(r.Plant_ID,id)&&String(r.Timestamp).slice(0,10)===date});
  if(!cfg.length)return {error:'The active data source has no Inverter Configuration / Inverter Telemetry rows for '+id};
  var key=[synth()?'S':'X',id,date,tel.length,cfg.length,it.length,n(tel[tel.length-1].Actual_AC_MW)].join('|');/* Recompute from active values; row-count keys cannot detect edits. */
  var P=E.plantParams(p,site,+date.slice(0,4)),miss=E.missingParams(P);if(miss.length)return {error:'Missing governed parameter(s): '+miss.join(', ')};
  var ppa=R('Commercial & PPA').find(function(x){return same(x.Plant_ID,id)})||{},tariff=n(ppa.PPA_Tariff_INR_kWh);
  var A=I.analyse(P,tel,cfg,it,{dt:0.25,derateStartC:n(p.Inverter_Derate_Start_C,60),tariff:tariff}),Rc=I.reconcile(P,tel,it,0.25,cfg);
  var m={key:key,id:id,name:String(p.Plant_Name||id),P:P,p:p,site:site,tel:tel,cfg:cfg,it:it,date:date,A:A,Rc:Rc,tariff:tariff};CACHE[id]=m;return m;
}
var BARS='<span class="aip-kpi-master-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
function kpis(items){return '<div class="grid g4 aip-maintenance-master-kpis t872-kpis">'+items.map(function(x,i){var v=esc(x[1]),u=x[2]?'<span class="aip-kpi-unit">'+esc(x[2])+'</span>':'';
  return '<div class="aip-kpi-master" data-aip-kpi-index="'+(i%8)+'" title="'+esc(x[3]||x[0])+'" style="height:92px!important;min-height:92px!important;max-height:92px!important;padding:7px 10px 6px!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;gap:3px!important;overflow:hidden!important;"><span class="kpi-label" data-kpi-label>'+esc(x[0])+'</span><b class="kpi-value" data-kpi-value>'+v+'</b><span class="aip-kpi-display-label" style="position:static!important;display:block!important;flex:0 0 auto!important;width:100%!important;min-height:13px!important;margin:0!important;padding:0!important;text-align:left!important;">'+esc(x[0])+'</span><span class="aip-kpi-display-value" style="position:static!important;display:flex!important;flex:0 0 29px!important;width:100%!important;height:29px!important;min-height:29px!important;margin:0!important;padding:0!important;align-items:center!important;justify-content:flex-start!important;line-height:29px!important;overflow:hidden!important;"><span class="aip-kpi-number">'+v+'</span>'+u+'</span>'+BARS+'</div>'}).join('')+'</div>'}
function chip(k,t){return '<span class="t872-chip '+k+'">'+esc(t)+'</span>'}
function table(head,rows,num){num=num||[];return '<div class="t872-tablewrap"><table class="t872-table"><thead><tr>'+head.map(function(h,i){return '<th'+(num.indexOf(i)>=0?' class="num"':'')+'>'+h+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(c,i){return '<td'+(num.indexOf(i)>=0?' class="num"':'')+'>'+c+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>'}
function lineage(m){return '<div class="ot297-source t872-lineage"><span class="ot297-dot"></span><b>Inverter twin</b><span>computed in this browser from the active data source · '+esc(modeLabel())+'</span><span class="t872-sep">·</span><span>'+esc(m.name)+' · '+m.cfg.length+' inverters · '+esc(m.P.mounting==='tracker'?'single-axis trackers':'fixed tilt')+' · operating day '+esc(m.date)+'</span></div>'}
function tone(o){if(o.flag==='data')return 'grey';if(!Number.isFinite(o.relPI))return 'grey';if(o.flag==='underperforming'&&(o.parts.trip>0||o.relPI<0.9))return 'red';if(o.flag==='underperforming')return 'amber';return 'green'}
function causeLabel(k){return k&&I.CAUSES[k]?I.CAUSES[k].label:'—'}
function inrL(v){return Number.isFinite(v)?'₹'+fmt(v/1e5,2)+' lakh':'—'}

function fleetView(m){window.AIP891Inverters=m;
  var A=m.A,inv=A.inverters,under=inv.filter(function(o){return o.flag==='underperforming'}),lost=under.reduce(function(s,o){return s+o.lost},0);
  var blocks={};inv.forEach(function(o){(blocks[o.block]=blocks[o.block]||[]).push(o)});
  var grid=Object.keys(blocks).sort().map(function(b){return '<div class="t874-block"><div class="t874-bh">Block '+esc(b.replace(/^B/,''))+'</div><div class="t874-tiles">'+blocks[b].map(function(o){
    return '<button type="button" class="t874-tile '+tone(o)+(SEL===o.id?' sel':'')+'" data-inv="'+esc(o.id)+'" title="'+esc(o.tag+' · performance '+f1(o.pi*100)+'% · '+(o.primary?causeLabel(o.primary):'no finding'))+'"><b>'+esc(o.tag.replace(/^.*INV-/,''))+'</b><span>'+(Number.isFinite(o.pi)?f1(o.pi*100)+'%':'no data')+'</span></button>'}).join('')+'</div></div>'}).join('');
  return kpis([['Inverters monitored',f0(inv.length),'',m.cfg.length+' in Inverter Configuration'],['Median performance index',f1(A.medianPI*100),'%','Measured ÷ expected AC energy, operating day'],['Underperforming inverters',f0(under.length),''],['Lost energy · underperformers',f2(lost),'MWh',Number.isFinite(m.tariff)?inrL(lost*1000*m.tariff)+' at PPA tariff':'']])+
   '<!--/kpis--><section class="ot297-card"><div class="t872-head"><div><h3>Inverter fleet — performance index, operating day</h3><div class="t872-subline">Each tile compares the inverter\'s measured AC energy with the energy its own DC block should have produced under the same measured irradiance, temperature and soiling (same physics chain as Physics & Losses). Select a tile to open its trace.</div></div></div>'+
   '<div class="t874-legend">'+chip('ok','≥ 98.5% of fleet median')+chip('warn','Underperforming')+chip('bad','Trip or < 90%')+chip('muted','Telemetry gap')+'</div><div class="t874-grid">'+grid+'</div></section>';
}
function traceView(m){
  var inv=m.A.inverters,o=inv.find(function(x){return x.id===SEL})||inv.slice().sort(function(a,b){return b.lost-a.lost})[0];if(!o)return '<section class="ot297-card">No inverter.</section>';SEL=o.id;
  if(!o.iv.length)return '<section class="ot297-card">No aligned telemetry intervals for this inverter.</section>';var W=820,H=240,p=38,t=$('#view-operationaltwin #tTime'),w={min:n(t&&t.min,6),max:n(t&&t.max,19)},xs=function(h){return p+Math.max(0,Math.min(1,(h-w.min)/Math.max(.01,w.max-w.min)))*(W-p*1.35)};
  var pts=o.iv.filter(function(q){return q.t.hour>=w.min-.01&&q.t.hour<=w.max+.01}),mx=Math.max(o.ac,Math.max.apply(null,pts.map(function(q){return Math.max(q.acExp,Number.isFinite(q.acM)?q.acM:0)})))*1.1,ys=function(v){return H-p-v/mx*(H-p*1.6)};
  var path=function(k,c,dash){var d='',pen=false;pts.forEach(function(q){var v=q[k];if(!Number.isFinite(v)){pen=false;return}d+=(pen?'L':'M')+xs(q.t.hour).toFixed(1)+' '+ys(v).toFixed(1);pen=true});return '<path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="2.4"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>'};
  var gaps=pts.filter(function(q){return !Number.isFinite(q.acM)}).map(function(q){return '<rect x="'+(xs(q.t.hour)-4)+'" y="24" width="8" height="'+(H-p-24)+'" fill="#cfd8dc" opacity=".6"/>'}).join('');
  var trips=pts.filter(function(q){return /trip|derat/i.test(q.st)}).map(function(q){return '<rect x="'+(xs(q.t.hour)-4)+'" y="24" width="8" height="'+(H-p-24)+'" fill="'+(/trip/i.test(q.st)?'#f8d7d7':'#fdebc8')+'" opacity=".8"/>'}).join('');
  var h=selHour(),q0=pts.reduce(function(b,q){return Math.abs(q.t.hour-h)<Math.abs(b.t.hour-h)?q:b},pts[0]);
  var grid=[0,.5,1].map(function(qq){var v=mx/1.1*qq;return '<line x1="'+p+'" y1="'+ys(v)+'" x2="'+(W-18)+'" y2="'+ys(v)+'" stroke="#e2eaee"/><text x="4" y="'+(ys(v)+3)+'" font-size="8" fill="#78909c">'+f2(v)+' MW</text>'}).join('');
  var ticks='';for(var hh=Math.ceil(w.min);hh<=Math.floor(w.max);hh+=2)ticks+='<text x="'+xs(hh)+'" y="'+(H-8)+'" text-anchor="middle" font-size="8" fill="#78909c">'+String(hh).padStart(2,'0')+':00</text>';
  var svg='<svg class="ot297-chart" viewBox="0 0 '+W+' '+H+'" aria-label="Inverter expected versus measured">'+gaps+trips+grid+'<line x1="'+p+'" y1="'+ys(o.ac)+'" x2="'+(W-18)+'" y2="'+ys(o.ac)+'" stroke="#9fb3bd" stroke-dasharray="2 4"/>'+path('acExp','#1687b1','7 4')+path('acM','#16a34a')+'<line x1="'+xs(q0.t.hour)+'" y1="20" x2="'+xs(q0.t.hour)+'" y2="'+(H-p)+'" stroke="#c026d3" stroke-width="2"/><text x="'+Math.min(W-80,xs(q0.t.hour)+5)+'" y="16" class="ot297-marker-label">'+hhmm(q0.t.minute)+'</text>'+ticks+'</svg>';
  var parts=Object.keys(o.parts).filter(function(k){return o.parts[k]>0.0005}).map(function(k){return [esc(I.CAUSES[k==='strings'?'strings':k]?I.CAUSES[k].label:k),f3(o.parts[k])+' MWh',o.exp>0?f1(o.parts[k]/o.exp*100)+'%':'—']});
  if(o.gapN)parts.push(['Telemetry gap (energy not measured)',f3(o.gapExp)+' MWh expected',o.gapN+' interval(s)']);
  var c=o.cfg,side='<h3>'+esc(o.tag)+' · '+hhmm(q0.t.minute)+'</h3><div class="ot297-causal" style="margin-top:9px">'+
    '<div><span>Expected / measured AC</span><b>'+f3(q0.acExp)+' / '+(Number.isFinite(q0.acM)?f3(q0.acM):'no data')+' MW</b></div>'+
    '<div><span>Expected / measured DC</span><b>'+f3(q0.dcExp)+' / '+(Number.isFinite(q0.dcM)?f3(q0.dcM):'no data')+' MW</b></div>'+
    '<div><span>Status · inverter temperature</span><b>'+esc(q0.st||'—')+' · '+(Number.isFinite(q0.tI)?f1(q0.tI)+' °C':'—')+'</b></div>'+
    '<div><span>Configuration</span><b>'+f3(n(c.AC_Rating_MW))+' MW AC · '+f3(n(c.DC_Capacity_MWp))+' MWp · '+f0(n(c.Strings))+' strings</b><small class="t872-small">Block '+esc(c.Block_ID)+' · tracker '+esc(c.Tracker_Asset_ID||'—')+' · '+f0(n(c.SCB_Count))+' SCBs</small></div>'+
    '<div class="'+(o.flag==='underperforming'?'ot297-gap plant':'ot297-good')+'"><span>Diagnosis</span><b>'+(o.primary?esc(causeLabel(o.primary)):'No finding')+'</b><small class="t872-small">'+esc(o.evidence.join(' · ')||'Measured output tracks the expected output')+'</small></div></div>'+
    (o.primary&&I.CAUSES[o.primary]?'<div class="t872-note warn"><b>Recommended action ('+I.CAUSES[o.primary].priority+'):</b> '+esc(I.CAUSES[o.primary].action)+'</div>':'')+
    '<div class="t874-actions"><button type="button" class="t872-link" data-asset="'+esc(o.id)+'">Open in Asset Explorer →</button></div>';
  var opts=m.A.inverters.slice().sort(function(a,b){return a.tag.localeCompare(b.tag)}).map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===o.id?' selected':'')+'>'+esc(x.tag)+(x.flag!=='ok'?' · '+causeLabel(x.primary):'')+'</option>'}).join('');
  window.AIP891InverterTrace={m,o};return kpis([['Performance index',f1(o.pi*100),'%','Fleet median '+f1(m.A.medianPI*100)+'%'],['Expected energy',f2(o.exp),'MWh'],['Measured energy',f2(o.act),'MWh'],['Lost energy',f2(o.lost),'MWh',inrL(o.value)]])+
   '<!--/kpis--><div class="ot297-live"><section class="ot297-card"><div class="t872-head"><div><h3>Inverter trace</h3><div class="t872-subline">Expected AC (blue dashed) from this inverter\'s DC block through temperature, soiling, DC losses, degradation and the part-load efficiency curve, against measured AC (green). Red bands: tripped; amber: derated; grey: no data. The Solar Hour slider moves the marker.</div></div><select id="t874Pick" class="t874-pick">'+opts+'</select></div>'+svg+
   '<div class="ot297-legend"><span><i class="lg-weather" style="border-top-style:dashed"></i>Expected AC</span><span><i class="lg-delivered"></i>Measured AC</span><span><i class="lg-hour"></i>Selected solar hour</span></div><h4 class="t872-h4">Where the energy went</h4>'+table(['Cause','Energy','% of expected'],parts.length?parts:[['No material loss','—','—']],[1,2])+'</section><aside class="ot297-card">'+side+'</aside></div>';
}
function underView(m){
  var inv=m.A.inverters.filter(function(o){return o.flag!=='ok'}).sort(function(a,b){return (b.value||b.lost)-(a.value||a.lost)});
  var total=inv.reduce(function(s,o){return s+o.lost},0),pri={P1:0,P2:0,P3:0};inv.forEach(function(o){var c=I.CAUSES[o.primary];if(c)pri[c.priority]++});
  var rows=inv.map(function(o,i){var c=I.CAUSES[o.primary]||{};return [String(i+1),'<b>'+esc(o.tag)+'</b><br><span class="t872-muted">Block '+esc(o.block)+'</span>',Number.isFinite(o.pi)?f1(o.pi*100)+'%':'—',f2(o.lost),Number.isFinite(o.value)?'₹'+fmt(o.value/1e5,2):'—',esc(causeLabel(o.primary)),esc(o.evidence.join(' · ')),esc(c.action||''),chip(c.priority==='P1'?'bad':c.priority==='P2'?'warn':'info',c.priority||'—'),'<button type="button" class="t872-link" data-open="'+esc(o.id)+'">Trace →</button>']});
  window.AIP891InverterFindings={m,rows:inv.map(o=>({...o,Priority:I.CAUSES[o.primary]?.priority}))};return kpis([['Findings',f0(inv.length),'inverters'],['Priority P1 / P2 / P3',pri.P1+' / '+pri.P2+' / '+pri.P3,''],['Lost energy today',f2(total),'MWh'],['Lost value today',Number.isFinite(m.tariff)?fmt(total*m.tariff*1000/1e5,2):'—','₹ lakh','At PPA tariff ₹'+f2(m.tariff)+'/kWh (Commercial & PPA)']])+
   '<!--/kpis--><section class="ot297-card"><div class="t872-head"><div><h3>Underperforming inverters — recommended actions</h3><div class="t872-subline">Ranked by lost value. Causes are assigned from the signature in the data: offline intervals (trip), temperature-limited plateau (derate), uniform DC shortfall (strings/SCB), DC shortfall concentrated at low sun (tracker), AC/DC efficiency below the curve (conversion). Probable causes require engineering review. Use Finding actions to assign an owner, create an RCA case and draft work order, and verify recovery. Nothing is sent to SCADA.</div></div><button type="button" class="t874-btn" id="t874Csv">Export recommendations (CSV)</button></div>'+
   (rows.length?table(['#','Inverter','Performance','Lost MWh','Lost ₹ lakh','Diagnosis','Evidence','Recommended action','Priority',''],rows,[2,3,4]):'<div class="t872-note">No underperforming inverters for this operating day.</div>')+'</section>';
}
function checksView(m){
  var Rc=m.Rc,P=m.P,cfg=m.cfg,sumAC=cfg.reduce(function(s,c){return s+n(c.AC_Rating_MW,0)},0),sumDC=cfg.reduce(function(s,c){return s+n(c.DC_Capacity_MWp,0)},0);
  var am=R('Asset Master').filter(function(a){return same(a.Plant_ID,m.id)&&a.Asset_Class==='Inverter'}),amAC=am.reduce(function(s,a){return s+n(a.Rated_Capacity_MW,0)},0),ids=new Set(am.map(function(a){return a.Asset_ID}));
  var orphan=cfg.filter(function(c){return !ids.has(c.Asset_ID)}).length,siteN=m.site?n(m.site.Inverter_Count):NaN,trk=cfg.filter(function(c){return c.Tracker_Asset_ID}).length;
  var st=function(ok,warn){return chip(ok?'ok':warn?'warn':'bad',ok?'Pass':warn?'Review':'Fail')};
  var rows=[
    ['Plant meter vs Σ inverters','Σ inverter AC after governed AC loss and transformer = '+f1(Rc.inverters)+' MWh vs revenue meter '+f1(Rc.meter)+' MWh ('+f2(Rc.diffPct)+'%)',Rc.gapIntervals?Rc.gapIntervals+' interval(s) with missing inverter data explain the gap; worst gap-free interval '+f2(Rc.worstNoGapPct)+'%':'Worst interval '+f2(Rc.worstNoGapPct)+'%',st(Math.abs(Rc.worstNoGapPct)<1,Math.abs(Rc.diffPct)<3)],
    ['Inverter count','Sites '+f0(siteN)+' · Inverter Configuration '+cfg.length+' · Asset Master '+am.length,'Every inverter needs one record in each',st(siteN===cfg.length&&cfg.length===am.length,false)],
    ['AC capacity','Σ inverter AC '+f1(sumAC)+' MW (Asset Master '+f1(amAC)+' MW) vs plant '+f1(P.acMW)+' MW','',st(Math.abs(sumAC-P.acMW)<=P.acMW*0.01&&Math.abs(amAC-P.acMW)<=P.acMW*0.01,Math.abs(sumAC-P.acMW)<=P.acMW*0.05)],
    ['DC capacity','Σ inverter DC '+f1(sumDC)+' MWp vs plant '+f1(P.pdc0)+' MWp (AC × DC/AC)','',st(Math.abs(sumDC-P.pdc0)<=P.pdc0*0.01,Math.abs(sumDC-P.pdc0)<=P.pdc0*0.05)],
    ['Asset links',orphan?orphan+' configuration row(s) without an Asset Master inverter':'All inverters link to Asset Master','',st(!orphan,false)],
    ['Mounting',P.mounting==='tracker'?'Single-axis trackers · axis '+f0(P.axisAz)+'° · ±'+f0(P.maxAngle)+'° · GCR '+f2(P.gcr)+(P.backtrack?' · backtracking':''):'Fixed tilt '+f1(P.tilt)+'°',trk+' of '+cfg.length+' inverters mapped to a tracker asset',st(P.mounting!=='tracker'||trk===cfg.length,true)],
    ['Telemetry completeness',m.A.inverters.reduce(function(a,o){return a+o.gapN},0)+' missing readings of '+m.it.length,'',st(!m.A.inverters.some(function(o){return o.gapN}),true)]];
  window.AIP891Inverters=m;return kpis([['Meter reconciliation',f2(Rc.diffPct),'%','Σ inverters vs revenue meter'],['Inverters in model',f0(cfg.length),''],['Missing readings',f0(m.A.inverters.reduce(function(a,o){return a+o.gapN},0)),''],['Tracker mapping',f0(trk)+' / '+f0(cfg.length),'']])+
   '<!--/kpis--><section class="ot297-card"><h3>Inverter data checks — '+esc(m.name)+'</h3><div class="t872-subline">Computed at run time from the active data source.</div>'+table(['Check','Finding','Detail','Status'],rows)+'</section>';
}
var SUBS=[['actions','Finding actions'],['fleet','Fleet'],['trace','Inverter Trace'],['under','Underperformers'],['checks','Data Checks']];
function render(){
  var v=$('#view-operationaltwin'),body=v&&$('#twBody',v);if(!body)return false;v.classList.add('t874-inv-active');var tk=$('#tKpis',v);if(tk)tk.innerHTML='';
  var m;try{m=model(pid())}catch(e){console.error('[AIP v874 inverters]',e);m={error:String(e&&e.message||e)}}
  if(m.error){body.innerHTML='<section class="ot297-card"><h3>Inverter twin cannot run for this site</h3><div class="t872-note warn">'+esc(m.error)+'.</div></section>';return true}
  var inner=VIEW==='actions'&&window.AIPWorkflow877?window.AIPWorkflow877.panel(m):VIEW==='trace'?traceView(m):VIEW==='under'?underView(m):VIEW==='checks'?checksView(m):fleetView(m);
  var cut=inner.indexOf('<!--/kpis-->');
  body.innerHTML=lineage(m)+'<div class="t873-bar"><div class="t872-seg" role="tablist">'+SUBS.map(function(s){return '<button type="button" data-iv="'+s[0]+'" class="'+(VIEW===s[0]?'active':'')+'">'+s[1]+'</button>'}).join('')+'</div></div>'+inner.slice(0,cut)+inner.slice(cut+12);
  $$('.t872-seg button[data-iv]',body).forEach(function(b){b.onclick=function(){VIEW=b.dataset.iv;render()}});
  $$('[data-inv]',body).forEach(function(b){b.onclick=function(){SEL=b.dataset.inv;VIEW='trace';render()}});
  $$('[data-open]',body).forEach(function(b){b.onclick=function(){SEL=b.dataset.open;VIEW='trace';render()}});
  var pk=$('#t874Pick',body);if(pk)pk.onchange=function(){SEL=pk.value;render()};
  $$('[data-asset]',body).forEach(function(b){b.onclick=function(){openAsset(b.dataset.asset,m.id)}});
  if(window.AIPWorkflow877)window.AIPWorkflow877.bind(body,m);var csv=$('#t874Csv',body);if(csv)csv.onclick=function(){exportCsv(m)};
  return true;
}
function openAsset(assetId,plantId){
  var a=R('Asset Master').find(function(x){return same(x.Asset_ID,assetId)})||{};
  var ctx={assetId:assetId,Asset_ID:assetId,assetTag:String(a.Asset_Tag||''),tag:String(a.Asset_Tag||''),plantId:plantId,Plant_ID:plantId,siteId:plantId,assetClass:'Inverter',Asset_Class:'Inverter',source:'Operational Twin · Inverters',target:'assetexplorer',contextToken:'TWIN-INV-'+Date.now()};
  window.AIP_CONTEXT_NAV=ctx;window.AIP_SELECTED_ASSET_CONTEXT=ctx;window.AIP_ASSET_EXPLORER_PENDING_CONTEXT=ctx;
  try{if(typeof window.activate==='function')window.activate('assetexplorer')}catch(_){}
  var tries=0,go=function(){tries++;try{if(window.AIPAssetExplorerController&&window.AIPAssetExplorerController.navigateContext&&window.AIPAssetExplorerController.navigateContext(ctx)===true)return}catch(_){}if(tries<8)requestAnimationFrame(go)};requestAnimationFrame(go);
}
function exportCsv(m){
  var rows=[['Plant_ID','Operating_Day','Asset_ID','Inverter_Tag','Block','Performance_Index_Pct','Lost_MWh','Lost_INR','Diagnosis','Evidence','Recommended_Action','Priority']];
  m.A.inverters.filter(function(o){return o.flag!=='ok'}).sort(function(a,b){return b.lost-a.lost}).forEach(function(o){var c=I.CAUSES[o.primary]||{};rows.push([m.id,m.date,o.id,o.tag,o.block,(o.pi*100).toFixed(2),o.lost.toFixed(3),Number.isFinite(o.value)?Math.round(o.value):'',causeLabel(o.primary),o.evidence.join('; '),c.action||'',c.priority||''])});
  var txt=rows.map(function(r){return r.map(function(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')}).join('\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv'}));a.download='AIP_inverter_recommendations_'+m.id+'_'+m.date+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
}
function isActive(){var b=$('#view-operationaltwin #tLayers .t874-tab');return !!(b&&b.classList.contains('active'))}
function activate(){var v=$('#view-operationaltwin');if(!v)return;$$('#tLayers .xi-tab',v).forEach(function(x){x.classList.remove('active')});var b=$('#tLayers .t874-tab',v);if(b)b.classList.add('active');v.classList.remove('t873-bess-active');
  window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};window.AIP_V21.state.layer='Inverters';render()}
function ensureTab(){
  var v=$('#view-operationaltwin'),t=v&&$('#tLayers',v);if(!t)return;var b=$('.t874-tab',t);
  if(!b){b=document.createElement('button');b.type='button';b.className='xi-tab t874-tab';b.textContent='Inverters';var ref=$$('.xi-tab',t).find(function(x){return x.textContent.trim()==='Asset Condition'});if(ref)t.insertBefore(b,ref);else t.appendChild(b)}
  b.onclick=function(e){if(e)e.preventDefault();activate()};
  if(window.AIP_V21&&window.AIP_V21.state&&window.AIP_V21.state.layer==='Inverters'&&!isActive())activate();else if(isActive())render();else v.classList.remove('t874-inv-active');
}
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('#view-operationaltwin #tLayers .xi-tab');if(t&&!t.classList.contains('t874-tab')&&!t.classList.contains('t875-cr-tab')){var v=$('#view-operationaltwin');if(v)v.classList.remove('t874-inv-active')}},true);
document.addEventListener('change',function(e){if(e.target&&e.target.matches&&e.target.matches('#view-operationaltwin #tSite')&&isActive()){SEL=null;setTimeout(activate,60);setTimeout(function(){if(isActive())render()},260)}},false);
document.addEventListener('input',function(e){if(e.target&&e.target.id==='tTime'&&isActive()&&VIEW==='trace')render()},false);
document.addEventListener('aip:data-source-changed',function(){CACHE={};setTimeout(ensureTab,400)});
function hook(){var Rr=window.AIP_V21&&window.AIP_V21.renderers;if(!Rr||typeof Rr.operationaltwin!=='function')return setTimeout(hook,100);var prior=Rr.operationaltwin;if(prior.__v874)return;
  var w=function(){var out=prior.apply(this,arguments);setTimeout(ensureTab,0);setTimeout(ensureTab,220);return out};w.__v874=true;Rr.operationaltwin=w;if($('#view-operationaltwin.active'))setTimeout(ensureTab,220)}
hook();
window.AIP_INV874={version:I.version,render:render,model:function(id){return model(id||pid())},activate:activate,open:function(id){SEL=id;VIEW='trace';activate()},causeLabel:causeLabel,tone:tone};

})();

