
/* AIP v876 · Generation forecast engine (pure functions, no data). Forecast weather → the same physics chain as the
   Operational Twin (AIPTwinPhysics), then known asset state, planned outages, curtailment, and BESS dispatch at the POI.
   The residual (ML) correction is deliberately NOT applied: no model has been trained on this plant's forecast-vs-actual history. */
(function(root){
'use strict';
var E=root.AIPTwinPhysics;
function num(v,d){if(v===null||v===undefined||(typeof v==='string'&&v.trim()===''))return d;var x=Number(v);return Number.isFinite(x)?x:d;}
function clamp(x,a,b){return x<a?a:x>b?b:x;}
function ms(ts){var t=E.parseStamp(ts);return t?Date.UTC(t.y,t.mo-1,t.d,Math.floor(t.minute/60),t.minute%60):NaN;}
function hhmmFromMs(m){var d=new Date(m);return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');}
function stampFromMs(m){var d=new Date(m);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')+' '+hhmmFromMs(m);}
/* parse "09:30–15:30 (solar)" or "02:00–04:30; 11:00–13:30" into minute ranges */
function windows(txt){return String(txt||'').split(';').map(function(w){var m=w.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);return m?[+m[1]*60+ +m[2],+m[3]*60+ +m[4]]:null}).filter(Boolean);}
function inWin(min,ws){return ws.some(function(w){return w[1]<w[0]?(min>=w[0]||min<w[1]):min>=w[0]&&min<w[1]});}

/* persistent asset-state loss carried into the forecast from the inverter twin (faults that do not clear by themselves) */
function assetState(invModel){
  if(!invModel||invModel.error)return {frac:0,items:[],basis:'Inverter twin unavailable'};
  var persistent={strings:1,tracker:1,conversion:1},exp=0,lost=0,items=[];
  invModel.A.inverters.forEach(function(o){exp+=o.exp;if(o.flag==='underperforming'&&persistent[o.primary]){var l=o.parts[o.primary]||o.lost;lost+=l;items.push({tag:o.tag,cause:o.primary,frac:o.exp>0?l/o.exp:0})}
    else if(o.flag==='underperforming'&&o.primary==='derate')items.push({tag:o.tag,cause:'derate',frac:0,note:'recurs only in hot hours — flagged, not subtracted'})});
  return {frac:exp>0?lost/exp:0,items:items,basis:'Operating day '+invModel.date+' · persistent faults (strings, tracker, conversion) until repaired'};
}
function outageMW(outages,plantId,t){var s=0,list=[];outages.forEach(function(o){if(String(o.Plant_ID)!==String(plantId)||/cancel|reject|completed/i.test(String(o.Status||'')))return;var a=ms(o.Start),b=ms(o.End);if(t>=a&&t<b){s+=num(o.Capacity_Out_MW,0);list.push(o)}});return {mw:s,list:list};}

/* forecast series for one run */
function series(P,weather,run,opts){
  opts=opts||{};var rev=num(run&&run.Weather_Revision_Pct,0)/100,soil0=clamp(num(opts.soilingRatio,1),0.5,1),soilRate=num(opts.soilingRatePerDay,0)/100,asset=opts.asset||{frac:0},set=opts.settings||{};
  var base=num(set.Uncertainty_Base_Pct,4),perDay=num(set.Uncertainty_per_Lead_Day_Pct,1.5),cloudK=num(set.Uncertainty_Cloud_Coeff_Pct,12);
  var runMs=ms(run&&run.Forecast_Run_Timestamp),rows=weather.slice().sort(function(a,b){return ms(a.Interval_Start)-ms(b.Interval_Start)});
  return rows.map(function(w){
    var tm=ms(w.Interval_Start),lead=num(w.Lead_Hours,(tm-runMs)/3.6e6),kc=clamp(num(w.Clear_Sky_Index,1)*(1+rev),0,1.1);
    // clear-sky POA for this plant geometry (tracker or fixed), from the shared engine
    var probe=E.interval(P,{Timestamp:w.Interval_Start,POA_Wm2:0,Actual_AC_MW:0});
    var poa=probe?probe.clearSky.poa*kc:0,sr=clamp(soil0-soilRate*Math.max(0,lead)/24,0.5,1);
    var o=outageMW(opts.outages||[],P.plantId,tm),avail=clamp(1-o.mw/P.acMW,0,1),curt=clamp(num(w.Forecast_Curtailment_Pct,0),0,100);
    var x=E.interval(P,{Timestamp:w.Interval_Start,POA_Wm2:poa,Ambient_Temp_C:num(w.Ambient_Temp_C,30),Wind_Speed_ms:num(w.Wind_Speed_ms,2),Soiling_Ratio:sr,Availability_Pct:100,Curtailment_Pct:0,Actual_AC_MW:0});
    if(!x)return null;
    var clear=x.clearSkyPOI,weatherMW=x.expectedPOI,afterAsset=weatherMW*(1-asset.frac),afterOut=afterAsset*avail,delivered=afterOut*(1-curt/100);
    var cloudFrac=clamp(num(w.Cloud_Cover_Pct,0)/100,0,1),band=(base+perDay*Math.max(0,lead)/24+cloudK*cloudFrac*(1-cloudFrac)*2)/100;
    return {t:tm,ts:w.Interval_Start,lead:lead,kc:kc,cloud:num(w.Cloud_Cover_Pct,NaN),ta:num(w.Ambient_Temp_C,NaN),ws:num(w.Wind_Speed_ms,NaN),poa:poa,poaCs:probe?probe.clearSky.poa:0,tModule:x.tUsed,sun:x.sun,orient:x.orient,soiling:sr,
      clear:clear,weather:weatherMW,asset:weatherMW-afterAsset,outage:afterAsset-afterOut,outages:o.list,curtail:afterOut-delivered,curtPct:curt,ml:0,delivered:delivered,lower:delivered*(1-band),upper:Math.min(P.acMW,delivered*(1+band)),band:band,x:x};
  }).filter(Boolean);
}
/* BESS dispatch on top of the PV forecast (governed windows, efficiencies, SoC limits) → net export at the POI */
function bessDispatch(S,B,startSoC,opts){
  opts=opts||{};if(!B||!Number.isFinite(startSoC))return {unavailable:true,reason:'No time-aligned BESS state of charge'};
  var P=B.P,B8=root.AIPBessPhysics,cw=windows(P.com.Charge_Window),dw=windows(P.com.Discharge_Window),pvOnly=/PV/i.test(P.chargingSource)&&!/Grid/i.test(P.chargingSource);
  var energy=startSoC/100*P.full,dt=0.25,tot={chg:0,dis:0,aux:0,gridCurtail:0,importOver:0,unavailable:false};
  var prev=0,site=opts.site||{},exportLimit=num(site.Export_Limit_MW,NaN),importLimit=num(site.Import_Limit_MW,NaN);
  S.forEach(function(q){
    var d=new Date(q.t),min=d.getUTCHours()*60+d.getUTCMinutes(),pc=0,pd=0,aux=Math.max(0,num(opts.auxMW,0));
    if(inWin(min,cw)){pc=P.mw;if(pvOnly)pc=Math.min(pc,Math.max(0,q.delivered-aux));else if(Number.isFinite(importLimit))pc=Math.min(pc,Math.max(0,q.delivered-aux+importLimit));}
    else if(inWin(min,dw)){pd=P.mw;if(Number.isFinite(exportLimit))pd=Math.min(pd,Math.max(0,exportLimit-q.delivered+aux));}
    if(pc===0&&Number.isFinite(importLimit))pd=Math.max(pd,Math.max(0,aux-q.delivered-importLimit));
    var step=B8.dispatchStep(P,energy,dt,pc,pd,{availableMW:opts.availableMW,cellTemp:opts.cellTemp,previousPower:prev});
    energy=step.energy;prev=step.discharge-step.charge;
    q.bessCharge=step.charge;q.bessDischarge=step.discharge;q.bessAux=aux;
    var rawNet=q.delivered-step.charge+step.discharge-aux;
    q.gridCurtail=Number.isFinite(exportLimit)?Math.max(0,rawNet-exportLimit):0;
    q.net=rawNet-q.gridCurtail;q.soc=step.soc;
    if(Number.isFinite(importLimit)&&q.net < -importLimit)tot.importOver++;
    tot.gridCurtail+=q.gridCurtail*dt;tot.aux+=aux*dt;tot.chg+=step.charge*dt;tot.dis+=step.discharge*dt;
  });
  if(tot.importOver){tot.unavailable=true;tot.reason=tot.importOver+' interval(s) exceed the governed import limit after auxiliary supply and SoC constraints';}
  return tot;
}

function sums(S){var dt=0.25,s={clear:0,weather:0,asset:0,outage:0,curtail:0,delivered:0,lower:0,upper:0,net:0,chg:0,dis:0,peak:0,cloud:0,n:0,ta:0,ws:0,poaPk:0};
  S.forEach(function(q){s.clear+=q.clear*dt;s.weather+=q.weather*dt;s.asset+=q.asset*dt;s.outage+=q.outage*dt;s.curtail+=q.curtail*dt;s.delivered+=q.delivered*dt;s.lower+=q.lower*dt;s.upper+=q.upper*dt;
    s.net+=(q.net!=null?q.net:q.delivered)*dt;s.chg+=(q.bessCharge||0)*dt;s.dis+=(q.bessDischarge||0)*dt;if(q.delivered>s.peak)s.peak=q.delivered;if(q.poa>s.poaPk)s.poaPk=q.poa;if(q.clear>1){s.n++;s.cloud+=q.cloud;s.ta+=q.ta;s.ws+=q.ws}});
  if(s.n){s.cloud/=s.n;s.ta/=s.n;s.ws/=s.n}return s;}
/* model-only hindcast: the same forecast chain fed with the observed weather of the operating day, against the meter */
function hindcast(P,obsRows,asset){
  var n=0,ae=0,bias=0,e=0,a=0,pts=[];
  obsRows.forEach(function(r){var x=E.interval(P,Object.assign({},r,{Availability_Pct:r.Availability_Pct,Curtailment_Pct:r.Curtailment_Pct}));if(!x)return;var f=x.states.s10*(1-(asset?asset.frac:0)),act=x.actual;
    if(x.states.s1<=0&&act<=0)return;n++;ae+=Math.abs(f-act);bias+=f-act;e+=f*0.25;a+=act*0.25;pts.push({t:x.t,f:f,a:act})});
  return {n:n,nMAE:n?ae/n/P.acMW*100:NaN,bias:n?bias/n:NaN,energyErr:a>0?(e-a)/a*100:NaN,pts:pts};
}
root.AIPForecast={version:'877.1',series:series,bessDispatch:bessDispatch,sums:sums,assetState:assetState,hindcast:hindcast,ms:ms,stampFromMs:stampFromMs,hhmmFromMs:hhmmFromMs,windows:windows};
})(typeof window!=='undefined'?window:globalThis);

/* AIP v876 · Operational Twin › Generation Forecast. Computed in the browser from the active data source (Forecast Weather,
   Forecast Runs, Planned Outages, Forecast Settings, twin parameters, inverter twin, BESS). The residual (ML) correction is shown as
   NOT TRAINED and contributes nothing. */
(function(){
'use strict';
var E=window.AIPTwinPhysics,F=window.AIPForecast;if(!E||!F)return;
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var n=function(v,d){if(v===null||v===undefined||v==='')return d===undefined?NaN:d;var x=Number(v);return Number.isFinite(x)?x:(d===undefined?NaN:d)};
var esc=function(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var fx=function(v,d){return Number.isFinite(v)?v.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—'},f0=function(v){return fx(v,0)},f1=function(v){return fx(v,1)},f2=function(v){return fx(v,2)};
var H=24,RUN=null,SEL=0,VIEW='fc',CACHE={};
function synth(){return window.AIP_SYNTHETIC_ACTIVE===true||/synthetic/i.test(String(window.APM_DATA_MODE||''))}
function R(k){if(window.AIP891?.isUploaded())return window.AIP891.raw(k);var st=[];try{if(typeof APM_IMPORTED_DATA!=='undefined')st.push(APM_IMPORTED_DATA)}catch(_){}
  try{st.push(synth()?(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined'?AIP_INDEPENDENT_SYNTHETIC_DATA:null):(typeof EMBEDDED_EXCEL_DATA!=='undefined'?EMBEDDED_EXCEL_DATA:null))}catch(_){}
  st.push(synth()?window.AIP_INDEPENDENT_SYNTHETIC_DATA:window.EMBEDDED_EXCEL_DATA);
  for(var i=0;i<st.length;i++){var a=st[i]&&st[i][k];if(Array.isArray(a)&&a.length)return a}return []}
function modeLabel(){var m='';try{m=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'')}catch(_){}return synth()?'Synthetic dataset':(m||'Excel dataset')}
function same(a,b){return String(a==null?'':a).trim()===String(b==null?'':b).trim()}
function pid(){var s=$('#view-operationaltwin #tSite');return (s&&s.value)||window.AIP_TWIN_SITE||'SP-01'}
function runsFor(id){return R('Forecast Runs').filter(function(r){return same(r.Plant_ID,id)}).sort(function(a,b){return String(a.Forecast_Run_Timestamp).localeCompare(String(b.Forecast_Run_Timestamp))})}
function build(){
  var id=pid(),M=window.AIP_TWIN872&&window.AIP_TWIN872.model(id);if(!M||M.error)return {error:(M&&M.error)||'Plant twin unavailable'};
  var allRuns=runsFor(id),allWeather=R('Forecast Weather').filter(function(r){return same(r.Plant_ID,id)});
  var runs=allRuns.filter(function(r){return allWeather.some(function(w){return same(w.Forecast_Run_Timestamp,r.Forecast_Run_Timestamp)})});
  if(!runs.length)return {error:'No immutable weather snapshot for any forecast run. Import weather with Plant_ID, Forecast_Run_Timestamp and Interval_Start.'};
  var run=runs.find(function(r){return r.Forecast_Run_Timestamp===RUN})||runs[runs.length-1];RUN=run.Forecast_Run_Timestamp;var latest=runs[runs.length-1];
  var w=allWeather.filter(function(r){var lead=(F.ms(r.Interval_Start)-F.ms(run.Forecast_Run_Timestamp))/3.6e6;return same(r.Forecast_Run_Timestamp,RUN)&&lead>0&&lead<=H}).map(function(r){return Object.assign({},r,{Lead_Hours:(F.ms(r.Interval_Start)-F.ms(RUN))/3.6e6})}).sort(function(a,b){return F.ms(a.Interval_Start)-F.ms(b.Interval_Start)});
  if(!w.length||new Set(w.map(function(r){return r.Interval_Start})).size!==w.length)return {error:'Missing or duplicate valid intervals in the selected weather snapshot'};
  if(w.length!==H*4||w.some(function(r,i){return Math.abs(F.ms(r.Interval_Start)-F.ms(RUN)-(i+1)*900000)>1}))return {error:'Selected run does not contain a complete '+H+'-hour weather snapshot'};
  var key=RUN+'|'+H,cutoff=run.Observation_Window_End||RUN;
  var obs=M.rows.filter(function(r){return F.ms(r.Timestamp)<=F.ms(cutoff)}),lastObs=obs[obs.length-1];
  if(!lastObs)return {error:'No observed plant inputs at or before this run cutoff'};
  var I=window.AIP_INV874&&window.AIP_INV874.model(id),asset={frac:0,items:[],basis:'No pre-run inverter evidence available; asset loss unknown'};
  if(I&&!I.error){var it=I.it.filter(function(r){return F.ms(r.Timestamp)<=F.ms(cutoff)});var A=window.AIPInverterTwin.analyse(M.P,obs,I.cfg,it,{tariff:I.tariff});asset=F.assetState({A:A,date:String(cutoff).slice(0,10)});if(A.inverters.some(function(o){return o.gapN}))asset.basis+='; incomplete telemetry, unknown losses excluded'}
  var set=R('Forecast Settings').find(function(s){return same(s.Plant_ID,id)})||{};
  var S=F.series(M.P,w,run,{asset:asset,soilingRatio:n(lastObs.Soiling_Ratio,1),soilingRatePerDay:n(set.Soiling_Rate_Pct_per_Day,0),outages:R('Planned Outages'),settings:set});
  var B=window.AIP_BESS873&&window.AIP_BESS873.model(id),bt=null;
  if(B&&!B.error){var prior=B.D.intervals.filter(function(q){return F.ms(q.raw.Timestamp)<=F.ms(cutoff)}),qb=prior[prior.length-1],site=R('Sites').find(function(r){return same(r.Plant_ID,id)})||{};
    if(qb)bt=F.bessDispatch(S,B,qb.soc,{site:site,availableMW:qb.avail,cellTemp:qb.tmax,auxMW:qb.aux});
    else bt={unavailable:true,reason:'No BESS snapshot at or before forecast cutoff'};}
  var notes=(allRuns.length-runs.length)+' run(s) hidden because their weather snapshot is absent. Inputs cut off at '+cutoff+'.'+(bt&&bt.unavailable?' BESS dispatch excluded: '+bt.reason+'.':'');
  var v={notes:notes,id:id,M:M,run:run,runs:runs,latest:latest,S:S,sum:F.sums(S),asset:asset,set:set,B:B&&!B.error?B:null,bt:bt,hind:F.hindcast(M.P,obs,asset)};CACHE={key:key,v:v};return v;
}
var BARS='<span class="aip-kpi-master-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
function kpis(items){return '<div class="grid g4 aip-maintenance-master-kpis t872-kpis">'+items.map(function(x,i){var v=esc(x[1]),u=x[2]?'<span class="aip-kpi-unit">'+esc(x[2])+'</span>':'';
  return '<div class="aip-kpi-master" data-aip-kpi-index="'+(i%8)+'" title="'+esc(x[3]||x[0])+'" style="height:92px!important;min-height:92px!important;max-height:92px!important;padding:7px 10px 6px!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;gap:3px!important;overflow:hidden!important;"><span class="kpi-label" data-kpi-label>'+esc(x[0])+'</span><b class="kpi-value" data-kpi-value>'+v+'</b><span class="aip-kpi-display-label" style="position:static!important;display:block!important;flex:0 0 auto!important;width:100%!important;min-height:13px!important;margin:0!important;padding:0!important;text-align:left!important;">'+esc(x[0])+'</span><span class="aip-kpi-display-value" style="position:static!important;display:flex!important;flex:0 0 29px!important;width:100%!important;height:29px!important;min-height:29px!important;margin:0!important;padding:0!important;align-items:center!important;justify-content:flex-start!important;line-height:29px!important;overflow:hidden!important;"><span class="aip-kpi-number">'+v+'</span>'+u+'</span>'+BARS+'</div>'}).join('')+'</div>'}
function chip(k,t){return '<span class="t872-chip '+k+'">'+esc(t)+'</span>'}
function table(head,rows,num){num=num||[];return '<div class="t872-tablewrap"><table class="t872-table"><thead><tr>'+head.map(function(h,i){return '<th'+(num.indexOf(i)>=0?' class="num"':'')+'>'+h+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(c,i){return '<td'+(num.indexOf(i)>=0?' class="num"':'')+'>'+c+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>'}
function tlabel(ms){var d=new Date(ms);return d.toUTCString().slice(5,11)+' '+F.hhmmFromMs(ms)}

function chart(v){
  var S=v.S,W=850,Hh=290,l=44,r=16,t=18,b=34,hasB=!!v.bt&&!v.bt.unavailable,mx=Math.max(1,Math.max.apply(null,S.map(function(q){return Math.max(q.clear,q.upper,hasB?q.net:0)})))*1.07,mn=hasB?Math.min(0,Math.min.apply(null,S.map(function(q){return q.net})))*1.1:0;
  var xs=function(i){return l+i/Math.max(1,S.length-1)*(W-l-r)},ys=function(val){return Hh-b-(val-mn)/(mx-mn)*(Hh-b-t)};
  var path=function(k){return S.map(function(q,i){return (i?'L':'M')+xs(i).toFixed(1)+' '+ys(q[k]).toFixed(1)}).join(' ')};
  var band=S.map(function(q,i){return (i?'L':'M')+xs(i).toFixed(1)+' '+ys(q.upper).toFixed(1)}).join(' ')+S.slice().reverse().map(function(q,ri){return 'L'+xs(S.length-1-ri).toFixed(1)+' '+ys(q.lower).toFixed(1)}).join(' ')+'Z';
  var outs=S.map(function(q,i){return q.outage>0.01?'<rect x="'+(xs(i)-2)+'" y="'+t+'" width="5" height="'+(Hh-b-t)+'" fill="#fdebc8" opacity=".75"/>':''}).join('');
  var grid=[0,.25,.5,.75,1].map(function(qq){var val=mn+(mx-mn)*qq,y=ys(val);return '<line x1="'+l+'" y1="'+y+'" x2="'+(W-r)+'" y2="'+y+'" stroke="#e6edf0"/><text x="4" y="'+(y+3)+'" font-size="8" fill="#78909c">'+f0(val)+'</text>'}).join('')+(mn<0?'<line x1="'+l+'" y1="'+ys(0)+'" x2="'+(W-r)+'" y2="'+ys(0)+'" stroke="#9fb3bd"/>':'');
  var every=H<=24?16:H<=48?24:H<=72?48:96,ticks=S.map(function(q,i){return i%every===0?'<text x="'+xs(i)+'" y="'+(Hh-10)+'" text-anchor="middle" font-size="8" fill="#78909c">'+(H>24?tlabel(q.t):F.hhmmFromMs(q.t))+'</text>':''}).join('');
  var sel=Math.min(SEL,S.length-1);
  return '<div class="gf377-chartwrap"><svg id="fc876Chart" class="gf377-chart" viewBox="0 0 '+W+' '+Hh+'" aria-label="Generation forecast"><text x="4" y="12" font-size="8" fill="#78909c">MW</text>'+outs+grid+'<path d="'+band+'" fill="#16a34a" opacity=".10"/><path d="'+path('clear')+'" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="7 5"/><path d="'+path('weather')+'" fill="none" stroke="#2563eb" stroke-width="2.2"/><path d="'+path('delivered')+'" fill="none" stroke="#16a34a" stroke-width="2.8"/>'+(hasB?'<path d="'+path('net')+'" fill="none" stroke="#173f52" stroke-width="1.8" stroke-dasharray="3 3"/>':'')+
   '<line id="fc876Cur" x1="'+xs(sel)+'" x2="'+xs(sel)+'" y1="'+t+'" y2="'+(Hh-b)+'" stroke="#8d4aa3" stroke-width="1.6"/><rect id="fc876Hit" x="'+l+'" y="'+t+'" width="'+(W-l-r)+'" height="'+(Hh-b-t)+'" fill="transparent"/>'+ticks+'</svg><div class="gf377-tooltip" id="fc876Tip"></div></div>'+
   '<div class="gf377-legend"><span><i style="--c:#f59e0b"></i>Clear-sky AC potential</span><span><i style="--c:#2563eb"></i>Weather-adjusted physics</span><span><i style="--c:#16a34a"></i>Delivered PV forecast</span>'+(hasB?'<span><i style="--c:#173f52"></i>Net export at POI (PV + BESS)</span>':'')+'<span>Shaded green = assumed P10–P90 range · amber = planned outage</span></div>';
}
function formation(v,q){if(!q)return '';var run=v.run,end=q.t+15*60000,outTxt=q.outages.map(function(o){return o.Asset_Scope}).join('; ');
  var row=function(a,b,cls,sub){return '<div class="gf377-formrow'+(cls?' '+cls:'')+'"><span class="t876-lbl">'+a+(sub?'<small class="t876-sub">'+sub+'</small>':'')+'</span><b>'+b+'</b></div>'};
  return '<h3>Forecast Formation · '+tlabel(q.t)+'–'+F.hhmmFromMs(end)+'</h3><div class="gf377-formrows">'+
   row('Forecast POA',f0(q.poa)+' W/m²','','clear-sky '+f0(q.poaCs)+' × index '+f2(q.kc)+(v.M.P.mounting==='tracker'?' · tracker '+f1(q.orient.rotation)+'°':''))+
   row('Module temperature',f1(q.tModule)+' °C','','ambient '+f1(q.ta)+' °C · wind '+f1(q.ws)+' m/s (NOCT model)')+
   row('Clear-sky AC potential',f1(q.clear)+' MW')+row('Weather-adjusted physics',f1(q.weather)+' MW','','soiling ratio '+fx(q.soiling,3)+' · degradation · inverter curve · clipping · AC losses')+
   row('Known asset-state loss','−'+f2(q.asset)+' MW','',v.asset.items.filter(function(i){return i.frac>0}).length+' persistent inverter fault(s) from the Inverters tab')+
   row('Planned outage','−'+f2(q.outage)+' MW','',outTxt||'none in this interval')+row('Curtailment','−'+f2(q.curtail)+' MW','',f1(q.curtPct)+'% forecast')+
   row('ML residual correction <button class="gf377-model-link" id="fc876Model">Model registry ↗</button>','0.0 MW','ml','Not trained — needs '+f0(n(v.set.Min_History_Days_For_Residual_Model,30))+' days of forecast-vs-actual history')+
   row('Forecast delivered PV',f1(q.delivered)+' MW','emph','assumed range '+f1(q.lower)+'–'+f1(q.upper)+' MW')+
   (v.bt&&!v.bt.unavailable?row('BESS charge / discharge',f1(q.bessCharge)+' / '+f1(q.bessDischarge)+' MW','','SoC '+f1(q.soc)+'% · '+esc(v.B.P.model))+row('Net export at POI',f1(q.net)+' MW','emph'):'')+
   row('15-min delivered energy',f2((v.bt&&!v.bt.unavailable?q.net:q.delivered)*0.25)+' MWh','emph')+'</div><div class="gf377-actions"><button id="fc876Scenario">Simulate Mitigation</button></div>';}
function fcView(v){window.AIP891Forecast={v,H};
  var s=v.sum,rs=v.runs.slice(-4),hist=v.run.Forecast_Run_Timestamp!==v.latest.Forecast_Run_Timestamp,sel=Math.min(SEL,v.S.length-1);
  var k=[['Forecast delivered energy',f0(s.delivered),'MWh',H+' h · PV at the POI'],['Assumed P10–P90 range',f0(s.lower)+'–'+f0(s.upper),'MWh','Assumed band — not calibrated'],['Peak forecast output',f1(s.peak),'MW','of '+f0(v.M.P.acMW)+' MW AC'],v.bt&&!v.bt.unavailable?['Net export at POI',f0(s.net),'MWh','PV − BESS charging + discharging']:['Clear-sky potential',f0(s.clear),'MWh','Upper bound for this geometry']];
  return kpis(k)+'<!--/kpis--><div class="t876-shell"><div class="gf377-runbar"><div class="gf377-runitem"><span>Forecast horizon</span><b class="t876-hz">'+[[24,'24 h'],[48,'48 h'],[72,'72 h'],[168,'7 days']].map(function(x){return '<button type="button" data-fch="'+x[0]+'" class="'+(H===x[0]?'active':'')+'">'+x[1]+'</button>'}).join('')+'</b></div>'+
   '<div class="gf377-runitem"><span>Forecast run</span><select id="fc876Run">'+rs.map(function(r){return '<option value="'+esc(r.Forecast_Run_Timestamp)+'"'+(r.Forecast_Run_Timestamp===v.run.Forecast_Run_Timestamp?' selected':'')+'>'+esc(String(r.Forecast_Run_Timestamp).slice(11,16))+(r.Forecast_Run_Timestamp===v.latest.Forecast_Run_Timestamp?' · Latest':'')+'</option>'}).join('')+'</select></div>'+
   '<div class="gf377-runitem"><span>Input window</span><b>'+esc(String(v.run.Observation_Window_Start).slice(11,16))+'–'+esc(String(v.run.Observation_Window_End).slice(11,16))+'</b></div><div class="gf377-runitem"><span>Weather revision</span><b>'+(n(v.run.Weather_Revision_Pct,0)>=0?'+':'')+f2(n(v.run.Weather_Revision_Pct,0))+'%</b></div><div class="gf377-runitem gf377-current"><span>Status</span><b><i class="gf377-dot"></i>'+(hist?'Historical run':'Current')+'</b></div><button class="gf377-inputbtn" id="fc876Inputs" type="button">View Forecast Inputs ↗</button></div>'+
   '<div class="gf377-journey"><div class="gf377-step"><span>Clear-Sky AC Potential</span><b>'+f1(s.clear)+' MWh</b></div><div class="gf377-step weatherimpact"><span>Forecast Weather Impact</span><b>−'+f1(s.clear-s.weather)+' MWh</b></div><div class="gf377-step"><span>Weather-Adjusted Physics</span><b>'+f1(s.weather)+' MWh</b></div><div class="gf377-step operimpact"><span>Asset · Outage · Curtailment</span><b>−'+f1(s.asset+s.outage+s.curtail)+' MWh</b></div><div class="gf377-step"><span>ML Residual</span><b>Not trained</b></div><div class="gf377-step final"><span>Forecast Delivered Energy</span><b>'+f1(s.delivered)+' MWh</b></div></div>'+
   '<div class="gf377-main"><section class="gf377-chartpanel"><h3>'+(H===168?'7-day':H+'-hour')+' generation forecast profile — '+esc(v.M.name||v.M.params.Plant_Name)+'</h3>'+chart(v)+'</section><aside class="gf377-formpanel" id="fc876Form">'+formation(v,v.S[sel])+'</aside></div></div>';
}
function vaView(v){window.AIP891Forecast={v,H};
  var h=v.hind,hist=0,need=n(v.set.Min_History_Days_For_Residual_Model,30),W=820,Hh=200,p=38,pts=h.pts,mx=Math.max(1,Math.max.apply(null,pts.map(function(q){return Math.max(q.f,q.a)})))*1.08;
  var xs=function(i){return p+i/Math.max(1,pts.length-1)*(W-p-18)},ys=function(val){return Hh-24-val/mx*(Hh-40)},path=function(k){return pts.map(function(q,i){return (i?'L':'M')+xs(i).toFixed(1)+' '+ys(q[k]).toFixed(1)}).join(' ')};
  var svg='<svg class="ot297-chart" viewBox="0 0 '+W+' '+Hh+'"><line x1="'+p+'" y1="'+ys(0)+'" x2="'+(W-18)+'" y2="'+ys(0)+'" stroke="#e2eaee"/><path d="'+path('a')+'" fill="none" stroke="#16a34a" stroke-width="2.4"/><path d="'+path('f')+'" fill="none" stroke="#1687b1" stroke-width="1.8" stroke-dasharray="6 4"/></svg>';
  var band=v.set.Deviation_Band_Pct;
  return kpis([['Forecast-vs-actual history','Not measured','days','Days where stored forecasts overlap metered actuals'],['Residual model',hist>=need?'Ready to train':'Not trained','',f0(hist)+' of '+f0(need)+' days of history'],['Model-only hindcast error',f2(h.nMAE),'% nMAE','Operating day, forecast chain fed with observed weather'],['Hindcast energy error',(h.energyErr>=0?'+':'')+f2(h.energyErr),'%','Operating day']])+
   '<!--/kpis--><section class="ot297-card"><h3>Forecast vs actual</h3><div class="t872-subline">Forecast accuracy can only be measured once forecasts are stored and the metered actuals for the same 15-minute blocks arrive. The loaded forecast runs start after the operating day, so there is no overlap yet.</div>'+
   '<div class="t872-recon warn"><b>Accuracy not yet measurable</b><span>0 days of forecast-vs-actual history. Weather-forecast error (the dominant error in solar forecasting) cannot be assessed from this dataset. The residual (ML) correction stays off until at least '+f0(need)+' days of history exist.</span>'+chip('warn','Not trained')+'</div>'+
   '<h4 class="t872-h4">Model-only hindcast — operating day '+esc(v.M.date)+'</h4><div class="t872-muted t872-para">The same forecast chain fed with the observed weather (dashed) against the revenue meter (solid). This isolates physics and asset-state error from weather-forecast error. Note: the demo telemetry was generated with this same physics, so a small error here shows internal consistency, not real-world accuracy.</div>'+svg+
   '<div class="ot297-legend"><span><i class="lg-delivered"></i>Metered</span><span><i style="color:#1687b1;border-top-style:dashed"></i>Forecast chain with observed weather</span></div>'+
   '<h4 class="t872-h4">Measures tracked once history exists</h4>'+table(['Measure','Definition','Status'],[
     ['nMAE','Mean absolute error ÷ AC capacity, per 15-minute block, by horizon (day-ahead, intraday)',chip('muted','Awaiting history')],
     ['Bias','Mean forecast − actual; persistent bias is the first thing a residual model corrects',chip('muted','Awaiting history')],
     ['Range coverage','Share of actuals inside the P10–P90 range (target 80%); used to calibrate the band',chip('muted','Awaiting history')],
     ['Deviation vs regulatory band','Share of blocks outside the deviation band of the applicable CERC/SERC deviation-settlement regulation',Number.isFinite(n(band))?chip('info','Band '+f1(n(band))+'%'):chip('warn','Band not set — Forecast Settings')]])+'</section>';
}
function inView(v){window.AIP891Forecast={v,H};
  var s=v.set,a=v.asset;
  var aRows=a.items.map(function(i){return [esc(i.tag),esc(window.AIP_INV874?window.AIP_INV874.causeLabel(i.cause):i.cause),i.frac>0?f2(i.frac*100)+'% of that inverter':'—',esc(i.note||'Subtracted until repaired')]});
  var oRows=R('Planned Outages').filter(function(o){return same(o.Plant_ID,v.id)}).map(function(o){return [esc(o.Outage_ID),esc(o.Asset_Scope),f1(n(o.Capacity_Out_MW))+' MW',esc(o.Start)+' → '+esc(o.End),esc(o.Reason),esc(o.Status)]});
  var rRows=v.runs.map(function(r){return [esc(r.Forecast_Run_Timestamp),esc(String(r.Observation_Window_Start).slice(11,16))+'–'+esc(String(r.Observation_Window_End).slice(11,16)),(n(r.Weather_Revision_Pct,0)>=0?'+':'')+f2(n(r.Weather_Revision_Pct,0))+'%',esc(r.Run_Status),esc(r.Residual_Model_Status||'')]});
  return kpis([['Weather source',String((R('Forecast Weather').find(function(r){return same(r.Plant_ID,v.id)})||{}).NWP_Source||'—'),''],['Persistent asset loss',f2(a.frac*100),'%','of plant expected energy, from the Inverters tab'],['Planned outages',f0(oRows.length),'','in Planned Outages'],['Uncertainty basis','Assumed','','Not calibrated']])+
   '<!--/kpis--><section class="ot297-card"><h3>Forecast assumptions & inputs — '+esc(v.M.params.Plant_Name||v.id)+'</h3><div class="t872-subline">Everything the forecast uses, from the active data source. Weather enters as a clear-sky index per 15-minute block, applied to the clear-sky irradiance the engine computes for this plant\'s geometry (trackers included).</div>'+
   '<h4 class="t872-h4">Known asset state carried into the forecast</h4><div class="t872-muted t872-para">'+esc(a.basis)+'</div>'+(aRows.length?table(['Inverter','Cause','Loss applied','Treatment'],aRows):'<div class="t872-note">No persistent inverter faults.</div>')+
   '<h4 class="t872-h4">Planned outages</h4>'+(oRows.length?table(['Outage','Scope','Capacity','Window','Reason','Status'],oRows):'<div class="t872-note">No planned outages for this site in the horizon.</div>')+
   '<h4 class="t872-h4">Uncertainty band (assumed)</h4><div class="t872-note warn">Half-width = '+f1(n(s.Uncertainty_Base_Pct,4))+'% + '+f1(n(s.Uncertainty_per_Lead_Day_Pct,1.5))+'% per lead day + '+f1(n(s.Uncertainty_Cloud_Coeff_Pct,12))+'% × cloud variability. '+esc(s.Band_Basis||'')+'</div>'+
   '<h4 class="t872-h4">Forecast runs</h4>'+table(['Run','Input window','Weather revision','Status','Residual model'],rRows,[2])+'</section>';
}
function render(){
  var vEl=$('#view-operationaltwin'),body=vEl&&$('#twBody',vEl);if(!body)return false;var tk=$('#tKpis',vEl);if(tk)tk.innerHTML='';
  var v;try{v=build()}catch(e){console.error('[AIP v876 forecast]',e);v={error:String(e&&e.message||e)}}
  if(v.error){body.innerHTML='<section class="ot297-card"><h3>Generation forecast unavailable</h3><div class="t872-note warn">'+esc(v.error)+'</div></section>';return true}
  var inner=VIEW==='va'?vaView(v):VIEW==='in'?inView(v):fcView(v),cut=inner.indexOf('<!--/kpis-->');
  body.innerHTML='<div class="ot297-source t872-lineage"><span class="ot297-dot"></span><b>Forecasting engine</b><span>same physics as the Operational Twin, computed in this browser · '+esc(modeLabel())+'</span><span class="t872-sep">·</span><span>Run '+esc(v.run.Forecast_Run_Timestamp)+' · ML residual correction: not trained</span></div>'+
    '<div class="t872-note">'+esc(v.notes)+(v.bt&&v.bt.unavailable?' Battery dispatch unavailable: '+esc(v.bt.reason):'')+'</div><div class="t873-bar"><div class="t872-seg">'+[['fc','Forecast'],['va','Forecast vs Actual'],['in','Assumptions & Inputs']].map(function(s){return '<button type="button" data-fv="'+s[0]+'" class="'+(VIEW===s[0]?'active':'')+'">'+s[1]+'</button>'}).join('')+'</div></div>'+inner.slice(0,cut)+inner.slice(cut+12);
  $$('[data-fv]',body).forEach(function(b){b.onclick=function(){VIEW=b.dataset.fv;render()}});
  $$('[data-fch]',body).forEach(function(b){b.onclick=function(){H=+b.dataset.fch;SEL=0;render()}});
  var rs=$('#fc876Run',body);if(rs)rs.onchange=function(){RUN=rs.value;SEL=0;render()};
  var ib=$('#fc876Inputs',body);if(ib)ib.onclick=function(){openInputs(v)};
  wire(v);
  var svg=$('#fc876Chart',body),hit=$('#fc876Hit',body),tip=$('#fc876Tip',body);
  if(svg&&hit){var choose=function(e){var rect=svg.getBoundingClientRect(),vx=(e.clientX-rect.left)/Math.max(1,rect.width)*850,idx=Math.round((vx-44)/Math.max(1,850-44-16)*(v.S.length-1));SEL=Math.max(0,Math.min(v.S.length-1,idx));
      var q=v.S[SEL],form=$('#fc876Form');if(form){form.innerHTML=formation(v,q);wire(v)}var x=44+SEL/Math.max(1,v.S.length-1)*(850-60),cur=$('#fc876Cur');if(cur){cur.setAttribute('x1',x);cur.setAttribute('x2',x)}
      if(tip){tip.innerHTML='<b>'+tlabel(q.t)+' · '+f1(q.delivered)+' MW</b><br>POA '+f0(q.poa)+' W/m² · cloud '+f0(q.cloud)+'%'+(v.bt&&!v.bt.unavailable?'<br>Net export '+f1(q.net)+' MW':'');tip.style.display='block';tip.style.left=Math.max(4,Math.min(rect.width-190,e.clientX-rect.left+8))+'px';tip.style.top=Math.max(3,e.clientY-rect.top-58)+'px'}};
    hit.addEventListener('mousemove',choose);hit.addEventListener('click',choose);hit.addEventListener('mouseleave',function(){if(tip)tip.style.display='none'})}
  return true;
}
function wire(v){var sc=$('#fc876Scenario');if(sc)sc.onclick=function(){window.AIP_GF_SCENARIO_ORIGIN={site:pid()};if(typeof window.AIPActivateOperationalTwinLayer==='function')window.AIPActivateOperationalTwinLayer('Scenario Lab')};
  var md=$('#fc876Model');if(md)md.onclick=function(){var t=$('.nav-item[data-view="models"]');if(t)t.click()};}
function openInputs(v){var snap=R('Forecast Input Snapshots').find(function(s){return same(s.Plant_ID,v.id)&&s.Forecast_Run_Timestamp===v.run.Forecast_Run_Timestamp})||{};
  var f=document.getElementById('gf377Feed');if(!f){f=document.createElement('div');f.id='gf377Feed';document.body.appendChild(f)}
  var row=function(a,b){return '<div class="gf377-feedrow"><span>'+a+'</span><b>'+b+'</b></div>'};
  f.innerHTML='<div class="gf377-feedpanel"><div class="gf377-feedhead"><div><h3>Forecast Input Stream · Run '+esc(String(v.run.Forecast_Run_Timestamp).slice(11,16))+'</h3><div class="sub">'+esc(v.id)+' · observation window '+esc(String(v.run.Observation_Window_Start).slice(11,16))+'–'+esc(String(v.run.Observation_Window_End).slice(11,16))+' · source: Forecast Input Snapshots</div></div><button class="gf377-feedclose" id="fc876Close" type="button">× Close</button></div><div class="gf377-feedgrid">'+
    '<div class="gf377-feedcard"><h4>SCADA / PLANT</h4>'+row('AC power',f2(n(snap.SCADA_AC_Power_MW))+' MW')+row('Availability',f2(n(snap.Availability_Pct))+'%')+row('Timestamp',esc(String(snap.SCADA_Timestamp||'').slice(11,16)))+'</div>'+
    '<div class="gf377-feedcard"><h4>WEATHER / NWP</h4>'+row('Observed POA',f0(n(snap.Observed_POA_Wm2))+' W/m²')+row('Ambient',f1(n(snap.Ambient_Temp_C))+' °C')+row('Wind',f2(n(snap.Wind_Speed_ms))+' m/s')+row('Forecast feed',esc((R('Forecast Weather').find(function(r){return same(r.Plant_ID,v.id)})||{}).NWP_Source||'—'))+'</div>'+
    '<div class="gf377-feedcard"><h4>ASSET STATE</h4>'+row('Persistent inverter loss',f2(v.asset.frac*100)+'%')+row('Soiling (latest observed)',f1((1-n(v.M.rows[v.M.rows.length-1].Soiling_Ratio,1))*100)+'%')+row('Source','Inverters tab / twin telemetry')+'</div>'+
    '<div class="gf377-feedcard"><h4>GRID / PPA</h4>'+row('Curtailment (snapshot)',f2(n(snap.Curtailment_Pct))+'%')+row('Planned outages',f0(R('Planned Outages').filter(function(o){return same(o.Plant_ID,v.id)}).length))+row('Run status',esc(v.run.Run_Status))+'</div></div>'+
    '<div class="gf377-feedcycle"><b style="font:800 8px Arial;color:#dce7ed">15-minute forecast cycle</b><div class="bar"></div><div class="labels"><span>Source capture</span><span>Clear-sky index</span><span>Physics (ML off)</span><span>Forecast stored</span></div></div></div>';
  f.classList.add('open');document.body.classList.add('gf377-feed-open');var c=$('#fc876Close',f);if(c)c.onclick=close;f.addEventListener('click',function(e){if(e.target===f)close()},{once:true});
  function close(){f.classList.remove('open');document.body.classList.remove('gf377-feed-open')}}
document.addEventListener('change',function(e){if(e.target&&e.target.matches&&e.target.matches('#view-operationaltwin #tSite')){RUN=null;SEL=0;CACHE={}}},true);
document.addEventListener('aip:data-source-changed',function(){CACHE={};RUN=null});
window.AIP_GF876={render:render,model:build,version:F.version};
window.AIPRenderGenerationForecast=render;window.AIPRenderOperationalTwinPredictiveOutlook=render;
window.AIP_CURRENT_BUILD='v878';
})();

