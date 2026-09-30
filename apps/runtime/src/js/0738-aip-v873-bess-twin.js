
/* AIP v873 · BESS physics & compliance engine (pure functions, no data embedded).
   Inputs: governed BESS master sheets + 15-min BESS telemetry + daily operations from the active data source. */
(function(root){
'use strict';
function num(v,d){if(v===null||v===undefined||(typeof v==='string'&&v.trim()===''))return d;var x=Number(v);return Number.isFinite(x)?x:d;}
function clamp(x,a,b){return x<a?a:x>b?b:x;}
function stamp(ts){var m=String(ts||'').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);return m?{date:m[1]+'-'+m[2]+'-'+m[3],minute:+m[4]*60+ +m[5],hour:+m[4]+ +m[5]/60}:null;}
function days(a,b){return (Date.parse(b)-Date.parse(a))/864e5;}
/* PVWatts-type part-load efficiency curve, used for the bidirectional PCS in both directions */
function pcsEff(z,nom){if(!(z>0.001))return 0;return clamp(nom/0.9637*(-0.0162*z-0.0059/z+0.9858),0,1);}

function params(sys,spec,lim,war,com,tests,plan){
  var t=(tests||[]).slice().sort(function(a,b){return String(a.Test_Date).localeCompare(String(b.Test_Date))});
  var last=t[t.length-1]||null,first=t[0]||null;
  var bol=num(sys.Nameplate_Energy_MWh_BOL,NaN),soh=last?num(last.SOH_Energy_Pct,NaN)/100:NaN;
  return {
    id:String(sys.BESS_ID),plantId:String(sys.Plant_ID),name:String(sys.BESS_Name||sys.BESS_ID),mw:num(sys.Rated_Power_MW,NaN),contracted:num(sys.Contracted_Energy_MWh,NaN),bol:bol,
    socMin:num(sys.Usable_SoC_Min_Pct,num(lim&&lim.SoC_Operating_Min_Pct,NaN)),socMax:num(sys.Usable_SoC_Max_Pct,num(lim&&lim.SoC_Operating_Max_Pct,NaN)),
    cod:String(sys.Commissioning_Date||''),containers:num(sys.Container_Count,NaN),pcsCount:num(sys.PCS_Count,NaN),mvtCount:num(sys.MV_Transformer_Count,NaN),
    chargingSource:String(sys.Charging_Source||''),model:String(sys.Commercial_Model||''),
    contMWh:num(spec&&spec.Container_Energy_MWh,NaN),pcsMW:num(spec&&spec.PCS_Unit_Rating_MW,NaN),mvtMVA:num(spec&&spec.MV_Transformer_MVA,NaN),
    pcsNom:num(spec&&spec.PCS_Nominal_Efficiency_Pct,NaN)/100,xfmr:num(spec&&spec.MV_Transformer_Efficiency_Pct,NaN)/100,dcRte:num(spec&&spec.Battery_DC_RTE_Pct,NaN)/100,
    selfDisPerHour:num(spec&&spec.Self_Discharge_Pct_per_Day,0)/100/24,auxBaseKW:num(spec&&spec.Aux_Base_kW_per_Container,NaN),auxHvacKW:num(spec&&spec.Aux_HVAC_kW_per_Container_per_10C,NaN),auxThru:num(spec&&spec.Aux_Throughput_Coeff_Pct,NaN)/100,
    tOpMax:num(lim&&lim.Cell_Temp_Operating_Max_C,NaN),tAlarm:num(lim&&lim.Cell_Temp_Alarm_C,NaN),tTrip:num(lim&&lim.Cell_Temp_Trip_C,NaN),maxChg:num(lim&&lim.Max_Charge_MW,NaN),maxDis:num(lim&&lim.Max_Discharge_MW,NaN),maxCyclesDay:num(lim&&lim.Max_Cycles_per_Day,NaN),rampPct:num(lim&&lim.Ramp_Rate_Pct_per_Min,NaN),residualTolerancePct:num(lim&&lim.Residual_Tolerance_Pct,1),socTolerancePct:num(lim&&lim.SoC_Drift_Tolerance_Pct,2),
    soh:soh,sohSource:last?('Capacity test '+last.Test_ID+' · '+last.Test_Date):'no capacity test',lastTest:last,firstTest:first,tests:t,
    full:bol*soh,war:war||{},com:com||{},plan:(plan||[]).slice().sort(function(a,b){return num(a.Operating_Year,0)-num(b.Operating_Year,0)})
  };
}
function missing(P){return ['mw','contracted','bol','pcsNom','xfmr','dcRte','soh','socMin','socMax'].filter(function(k){return !Number.isFinite(P[k])});}

/* ---------- one operating day: loss bridge, SoC model, limit and dispatch checks ---------- */
function day(P,rows,dt,openingSoC){
  dt=dt>0?dt:0.25;var dcb=Math.sqrt(P.dcRte),iv=[];
  rows=rows.slice().sort(function(a,b){return String(a.Timestamp).localeCompare(String(b.Timestamp))});
  var soc0=num(openingSoC,NaN),Em=soc0/100*P.full,T={chg:0,dis:0,aux:0,xfmrC:0,pcsC:0,batC:0,batD:0,pcsD:0,xfmrD:0,self:0,stored:0,withdrawn:0,sched:0,delivInWin:0,pv:0,avail:0};
  var V={socOut:0,tempOp:0,tempAlarm:0,tempTrip:0,overPower:0,simultaneous:0,pvShort:0,export:0};var maxDrift=NaN,maxT=-99;var unique=new Set(rows.map(function(r){return r.Timestamp}));var minutes=rows.map(function(r){var t=stamp(r.Timestamp);return t?t.minute:NaN}).sort(function(a,b){return a-b});var coverageOk=unique.size===Math.round(24/dt)&&rows.length===unique.size&&minutes.every(function(v,i){return Number.isFinite(v)&&(!i||Math.abs(v-minutes[i-1]-dt*60)<0.001)});var invalidN=rows.filter(function(r){return ['Charge_MW_POI','Discharge_MW_POI','Aux_Load_MW','SoC_Pct'].some(function(k){return !Number.isFinite(num(r[k],NaN))})}).length;
  rows.forEach(function(r,i){
    var t=stamp(r.Timestamp),pc=Math.max(0,num(r.Charge_MW_POI,0)),pd=Math.max(0,num(r.Discharge_MW_POI,0)),aux=Math.max(0,num(r.Aux_Load_MW,0)),soc=num(r.SoC_Pct,NaN);
    var zc=pc/P.mw,zd=pd/P.mw,ec=pc>0?pcsEff(zc,P.pcsNom):0,ed=pd>0?pcsEff(zd,P.pcsNom):0;
    var L={xfmrC:pc*(1-P.xfmr)*dt,pcsC:pc*P.xfmr*(1-ec)*dt,batC:pc*P.xfmr*ec*(1-dcb)*dt};
    var stIn=pc*P.xfmr*ec*dcb*dt,dcOut=pd>0?pd/(P.xfmr*ed):0,stOut=dcOut/dcb*dt;
    L.pcsD=dcOut*(1-ed)*dt;L.xfmrD=(pd>0?pd/P.xfmr:0)*(1-P.xfmr)*dt;L.batD=stOut-dcOut*dt;L.self=Math.max(0,Em)*P.selfDisPerHour*dt;
    Em=clamp(Em+stIn-stOut-L.self,0,P.full);
    var socModel=Em/P.full*100,drift=Number.isFinite(soc)?soc-socModel:NaN;if(!Number.isFinite(maxDrift)||Math.abs(drift)>Math.abs(maxDrift))maxDrift=drift;
    T.chg+=pc*dt;T.dis+=pd*dt;T.aux+=aux*dt;T.stored+=stIn;T.withdrawn+=stOut;for(var k in L)T[k]+=L[k];
    var sched=Math.max(0,num(r.Dispatch_Schedule_MW,0));T.sched+=sched*dt;if(sched>0)T.delivInWin+=Math.min(pd,sched)*dt;
    var pv=Math.max(0,num(r.Co_located_PV_MW,0));T.pv+=pv*dt;T.avail+=clamp(num(r.Available_MW,P.mw)/P.mw,0,1);
    var tmax=num(r.Cell_Temp_Max_C,NaN);if(tmax>maxT)maxT=tmax;
    if(Number.isFinite(soc)&&(soc<P.socMin-0.5||soc>P.socMax+0.5))V.socOut++;
    if(tmax>P.tOpMax)V.tempOp++;if(tmax>=P.tAlarm)V.tempAlarm++;if(tmax>=P.tTrip)V.tempTrip++;
    if(pc>P.maxChg*1.02||pd>P.maxDis*1.02)V.overPower++;if(pc>0&&pd>0)V.simultaneous++;
    if(pc>0&&/^PV$/.test(String(r.Charge_Source||''))&&pc>pv*1.001+0.05)V.pvShort++;
    iv.push({t:t,pc:pc,pd:pd,aux:aux,soc:soc,socModel:socModel,drift:drift,tmax:tmax,tavg:num(r.Cell_Temp_Avg_C,NaN),ta:num(r.Ambient_Temp_C,NaN),pv:pv,avail:num(r.Available_MW,P.mw),sched:sched,src:String(r.Charge_Source||''),mode:String(r.Operating_Mode||''),loss:L,raw:r});
  });
  var soc1=num(rows[rows.length-1]&&rows[rows.length-1].SoC_Pct,NaN);
  var dStored=(soc1-soc0)/100*P.full;             // measured (BMS) change in stored energy
  var losses=T.xfmrC+T.pcsC+T.batC+T.batD+T.pcsD+T.xfmrD+T.self;
  var residual=T.chg-T.dis-losses-dStored;         // + = more energy lost than the model explains; − = BMS shows more stored than the model
  var rteRaw=(T.chg+T.aux)>0?T.dis/(T.chg+T.aux):NaN;
  var rteAdj=(T.chg+T.aux)>0?(T.dis+Math.max(0,dStored)*dcb*P.xfmr*P.pcsNom)/(T.chg+T.aux+Math.max(0,-dStored)/(dcb*P.xfmr*P.pcsNom)):NaN;
  var modelRte=P.dcRte*Math.pow(P.pcsNom*P.xfmr,2);
  return {coverageOk:coverageOk,invalidN:invalidN,openingKnown:Number.isFinite(soc0),intervals:iv,dt:dt,T:T,soc0:soc0,soc1:soc1,dStored:dStored,losses:losses,residual:residual,rteRaw:rteRaw,rteAdj:rteAdj,modelRte:modelRte,
    cycles:P.contracted>0?T.dis/P.contracted:NaN,availability:rows.length?T.avail/rows.length*100:NaN,fulfil:T.sched>0?T.delivInWin/T.sched*100:NaN,violations:V,maxDrift:maxDrift,maxT:maxT,
    bridge:[['xfmrC','MV transformer · charging',T.xfmrC],['pcsC','PCS conversion · charging',T.pcsC],['batC','Battery DC loss · charging',T.batC],['self','Self-discharge',T.self],['batD','Battery DC loss · discharging',T.batD],['pcsD','PCS conversion · discharging',T.pcsD],['xfmrD','MV transformer · discharging',T.xfmrD],['dStored','Change in stored energy (BMS SoC)',dStored],['residual','Residual (unexplained)',residual]]};
}
/* ---------- month to date from daily operations (contract basis) ---------- */
function monthToDate(P,daily,opDate){
  var ym=String(opDate).slice(0,7),rows=daily.filter(function(r){return String(r.Date).slice(0,7)===ym&&String(r.Date)<=opDate}).sort(function(a,b){return String(a.Date).localeCompare(String(b.Date))});
  var s={days:rows.length,chg:0,dis:0,aux:0,avail:0,sched:0,cyc:0,tmax:-99};
  rows.forEach(function(r){s.chg+=num(r.Charge_MWh_POI,0);s.dis+=num(r.Discharge_MWh_POI,0);s.aux+=num(r.Aux_MWh,0);s.avail+=num(r.Availability_Pct,100);s.sched+=num(r.Scheduled_Discharge_MWh,0);s.cyc+=num(r.Equivalent_Full_Cycles,0);s.tmax=Math.max(s.tmax,num(r.Max_Cell_Temp_C,-99));});
  s.availability=s.days?s.avail/s.days:NaN;s.rte=(s.chg+s.aux)>0?s.dis/(s.chg+s.aux)*100:NaN;s.cyclesPerDay=s.days?s.cyc/s.days:NaN;s.fulfil=s.sched>0?Math.min(s.dis,s.sched)/s.sched*100:NaN;
  var y=+ym.slice(0,4),m=+ym.slice(5,7);s.daysInMonth=new Date(y,m,0).getDate();s.rows=rows;s.month=ym;return s;
}
function commercial(P,M,ppaTariff){
  var c=P.com,out={model:P.model,lines:[]},minA=num(c.Min_Availability_Pct,95),minR=num(c.Min_RTE_Pct,NaN);
  if(num(c.Capacity_Charge_INR_per_MW_Month,NaN)>0){
    var rate=num(c.Capacity_Charge_INR_per_MW_Month,0),accr=P.mw*rate*M.days/M.daysInMonth,short=Math.max(0,minA-M.availability);
    var ld=accr*short/100*num(c.Availability_LD_Multiplier,1);
    var tariffC=num(c.Charging_Energy_Tariff_INR_kWh,NaN),excess=Number.isFinite(minR)&&M.rte<minR?(M.chg+M.aux)-M.dis/(minR/100):0,rteP=excess>0&&Number.isFinite(tariffC)?excess*1000*tariffC:0;
    out.kind='capacity';out.accrued=accr;out.availabilityLD=ld;out.rtePenalty=rteP;out.excessMWh=excess;out.net=accr-ld-rteP;
    out.lines=[['Capacity charge accrued ('+M.days+' of '+M.daysInMonth+' days)',accr],['Availability liquidated damages',-ld],['RTE shortfall penalty',-rteP]];
  }else{
    var peak=num(c.Peak_Tariff_INR_kWh,NaN),rev=M.dis*1000*peak,opp=Number.isFinite(ppaTariff)?M.chg*1000*ppaTariff:NaN,auxC=Number.isFinite(ppaTariff)?M.aux*1000*ppaTariff:NaN;
    out.kind='energy';out.revenue=rev;out.opportunity=opp;out.auxCost=auxC;out.net=rev-(opp||0)-(auxC||0);
    out.lines=[['Peak-window energy revenue',rev],['PV energy used for charging (valued at PPA tariff)',-(opp||0)],['Auxiliary consumption (at PPA tariff)',-(auxC||0)]];
  }
  out.availabilityOk=M.availability>=minA;out.rteOk=Number.isFinite(minR)?M.rte>=minR:null;out.minA=minA;out.minR=minR;
  var minF=num(c.Min_Dispatch_Fulfilment_Pct,NaN);out.minF=minF;out.fulfilOk=Number.isFinite(minF)?M.fulfil>=minF:null;
  return out;
}
/* ---------- health & warranty ---------- */
function planAt(P,age){var pl=P.plan;if(!pl.length)return NaN;var a=Math.floor(age),b=a+1,A=pl.find(function(x){return num(x.Operating_Year)===a}),B=pl.find(function(x){return num(x.Operating_Year)===b});
  if(!A)return NaN;if(!B)return num(A.Expected_Retention_Pct);return num(A.Expected_Retention_Pct)+(num(B.Expected_Retention_Pct)-num(A.Expected_Retention_Pct))*(age-a);}
function health(P,daily,opDate){
  var age=days(P.cod,opDate)/365.25,lt=P.lastTest,testAge=lt?days(P.cod,lt.Test_Date)/365.25:NaN,exp=planAt(P,testAge);
  var d=daily.slice().sort(function(a,b){return String(a.Date).localeCompare(String(b.Date))}),cum=d.length?num(d[d.length-1].Cumulative_Discharge_MWh_Since_COD,NaN):NaN;
  var efc=cum/P.contracted,limC=num(P.war.Warranty_Cycle_Limit,NaN),limT=num(P.war.Warranty_Throughput_Limit_MWh,NaN),perfY=num(P.war.Performance_Warranty_Years,NaN);
  var usableNow=lt?num(lt.Discharged_Energy_POI_MWh,NaN):NaN;
  var aug=P.plan.find(function(x){return num(x.Planned_Augmentation_MWh,0)>0&&num(x.Operating_Year)>=Math.floor(age)});
  var nextTest=lt?new Date(Date.parse(lt.Test_Date)+num(P.war.Capacity_Test_Interval_Days,365)*864e5).toISOString().slice(0,10):null;
  return {age:age,soh:P.soh*100,expected:exp,deviation:P.soh*100-exp,usableNow:usableNow,margin:usableNow-P.contracted,cum:cum,efc:efc,cycleLimit:limC,cycleUse:efc/limC*100,timeUse:age/perfY*100,throughputUse:cum/limT*100,
    nextAug:aug||null,nextTest:nextTest,guarY10:num(P.war.Guaranteed_Retention_Pct_Year10,NaN)};
}
/* ---------- engineering self-checks ---------- */
function selfChecks(P,D){
  var r=[],push=function(n,p,d,k){r.push({name:n,pass:!!p,detail:d,kind:k||'Invariant'})};
  var e1=pcsEff(1,P.pcsNom),eL=pcsEff(0.1,P.pcsNom);
  push('PCS efficiency curve is physical',e1<=1&&eL<e1&&e1>0.9,'η(100%) '+(e1*100).toFixed(2)+'% · η(10%) '+(eL*100).toFixed(2)+'%','Component model');
  push('Modelled round trip below every component efficiency',D.modelRte<P.dcRte&&D.modelRte<P.pcsNom,'Model AC–AC (excl. aux) '+(D.modelRte*100).toFixed(2)+'% = DC '+(P.dcRte*100).toFixed(1)+'% × (PCS × transformer)²','Component model');
  var sum=D.T.dis+D.losses+D.dStored+D.residual;
  push('Energy balance closes',Math.abs(sum-D.T.chg)<1e-9,'Charged '+D.T.chg.toFixed(2)+' = discharged + losses + Δstored + residual (error '+Math.abs(sum-D.T.chg).toExponential(1)+' MWh)','Reconciliation');
  var e=D.intervals.reduce(function(s,x){return s+x.pd},0)*D.dt;push('MW integrates to MWh',Math.abs(e-D.T.dis)<1e-9,'Σ discharge MW × '+D.dt+' h = '+e.toFixed(2)+' MWh','Reconciliation');
  push('No simultaneous charge and discharge',D.violations.simultaneous===0,D.violations.simultaneous+' interval(s)','Telemetry integrity');
  push('Power within PCS rating',D.violations.overPower===0,D.violations.overPower+' interval(s) above rated power','Telemetry integrity');
  push('Complete unique regular intervals',D.coverageOk&&D.invalidN===0,D.intervals.length+' of '+Math.round(24/D.dt),'Telemetry integrity');
  push('Opening SoC provided',D.openingKnown,'Start-of-day SoC from BESS Daily Operations, before integrating interval 1','Independent input');
  push('Unexplained residual within tolerance',Number.isFinite(D.residual)&&Math.abs(D.residual)<=Math.max(0.1,D.T.chg*num(P.residualTolerancePct,1)/100),'Residual '+D.residual.toFixed(3)+' MWh; limit '+num(P.residualTolerancePct,1)+'% of charge or 0.1 MWh','Physical validation');
  push('SoC drift within tolerance',Number.isFinite(D.maxDrift)&&Math.abs(D.maxDrift)<=num(P.socTolerancePct,2),'Maximum drift '+D.maxDrift.toFixed(2)+' percentage points; limit '+num(P.socTolerancePct,2),'Physical validation');
  return r;
}
/* Forecast dispatch uses governed BESS operating limits. Power is at the POI. */
function dispatchStep(P,energy,dt,requestCharge,requestDischarge,opts){
  opts=opts||{};
  var full=P.full,minE=P.socMin/100*full,maxE=P.socMax/100*full,dc=Math.sqrt(P.dcRte);
  var available=Number.isFinite(num(opts.availableMW,NaN))?Math.max(0,opts.availableMW):P.mw;
  var temp=num(opts.cellTemp,NaN),safe=Number.isFinite(temp)&&temp>=P.tTrip?0:1;
  var chargeCap=Math.max(0,Math.min(P.mw,P.maxChg,available))*safe;
  var disCap=Math.max(0,Math.min(P.mw,P.maxDis,available))*safe;
  if(Number.isFinite(P.rampPct)&&Number.isFinite(num(opts.previousPower,NaN))){
    var ramp=P.mw*P.rampPct/100*dt*60;
    chargeCap=Math.min(chargeCap,Math.max(0,ramp-num(opts.previousPower,0)));
    disCap=Math.min(disCap,Math.max(0,ramp+num(opts.previousPower,0)));
  }
  var pc=Math.min(Math.max(0,requestCharge),chargeCap),pd=Math.min(Math.max(0,requestDischarge),disCap);
  if(pc>0)pd=0;
  var ec=pc>0?pcsEff(pc/P.mw,P.pcsNom):0;
  var gain=pc*P.xfmr*ec*dc*dt;
  if(energy+gain>maxE&&gain>0){pc*=Math.max(0,(maxE-energy)/gain);ec=pc>0?pcsEff(pc/P.mw,P.pcsNom):0;gain=pc*P.xfmr*ec*dc*dt;}
  var ed=pd>0?pcsEff(pd/P.mw,P.pcsNom):0;
  var draw=pd>0?pd/(P.xfmr*ed*dc)*dt:0;
  if(energy-draw<minE&&draw>0){pd*=Math.max(0,(energy-minE)/draw);ed=pd>0?pcsEff(pd/P.mw,P.pcsNom):0;draw=pd>0?pd/(P.xfmr*ed*dc)*dt:0;}
  var self=Math.max(0,energy+gain-draw)*P.selfDisPerHour*dt;
  var next=energy+gain-draw-self;
  return {charge:pc,discharge:pd,energy:next,soc:next/full*100,selfDischarge:self};
}

root.AIPBessPhysics={version:'877.1',dispatchStep:dispatchStep,num:num,pcsEff:pcsEff,params:params,missing:missing,day:day,monthToDate:monthToDate,commercial:commercial,health:health,planAt:planAt,selfChecks:selfChecks,stamp:stamp,days:days};
})(typeof window!=='undefined'?window:globalThis);

/* AIP v873 · Operational Twin › BESS tab. All values computed in the browser by AIPBessPhysics from the ACTIVE data source. */
(function(){
'use strict';
var B=window.AIPBessPhysics;if(!B)return;
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var n=B.num,esc=function(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var fmt=function(v,d){return Number.isFinite(v)?v.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—'};
var f0=function(v){return fmt(v,0)},f1=function(v){return fmt(v,1)},f2=function(v){return fmt(v,2)};
var sg=function(v,f){f=f||f1;return Number.isFinite(v)?(v<0?'−':v>0?'+':'')+f(Math.abs(v)):'—'};
var inrL=function(v){return Number.isFinite(v)?'₹'+fmt(v/1e5,2):'—'};
var hhmm=function(m){m=Math.round(m);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
var VIEW='ops',HOUR=19.5;

/* ---------- active data source (same resolution order as the PV twin) ---------- */
function synth(){return window.AIP_SYNTHETIC_ACTIVE===true||/synthetic/i.test(String(window.APM_DATA_MODE||''))}
function R(k){if(window.AIP891?.isUploaded())return window.AIP891.raw(k);
  var st=[];try{if(typeof APM_IMPORTED_DATA!=='undefined')st.push(APM_IMPORTED_DATA)}catch(_){}
  try{st.push(synth()?(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined'?AIP_INDEPENDENT_SYNTHETIC_DATA:null):(typeof EMBEDDED_EXCEL_DATA!=='undefined'?EMBEDDED_EXCEL_DATA:null))}catch(_){}
  st.push(synth()?window.AIP_INDEPENDENT_SYNTHETIC_DATA:window.EMBEDDED_EXCEL_DATA);
  if(synth()){try{if(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined')st.push(AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData)}catch(_){}}
  for(var i=0;i<st.length;i++){var a=st[i]&&st[i][k];if(Array.isArray(a)&&a.length)return a}return [];
}
function modeLabel(){var m='';try{m=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'')}catch(_){}return synth()?'Synthetic dataset':(m||'Excel dataset')}
function same(a,b){return String(a==null?'':a).trim()===String(b==null?'':b).trim()}
function pid(){var s=$('#view-operationaltwin #tSite');return (s&&s.value)||window.AIP_TWIN_SITE||'SP-01'}

var CACHE={};
function modelFor(plantId){
  var sys=R('BESS Systems').find(function(x){return same(x.Plant_ID,plantId)});if(!sys)return null;
  var id=sys.BESS_ID,f=function(k){return R(k).find(function(x){return same(x.BESS_ID,id)})},fl=function(k){return R(k).filter(function(x){return same(x.BESS_ID,id)})};
  var tel=fl('BESS Telemetry').filter(function(r){return B.stamp(r.Timestamp)});if(!tel.length)return {error:'No BESS Telemetry rows for '+id,sys:sys};
  var dates=tel.map(function(r){return B.stamp(r.Timestamp).date}).sort(),date=dates[dates.length-1];tel=tel.filter(function(r){return B.stamp(r.Timestamp).date===date});
  var key=[synth()?'S':'X',id,date,tel.length,n(tel[tel.length-1].SoC_Pct),n(sys.Rated_Power_MW)].join('|');/* Active source values are recomputed on demand. */
  var P=B.params(sys,f('BESS Specifications'),f('BESS Operating Limits'),f('BESS Warranty & Maintenance'),f('BESS Commercial & Dispatch'),fl('BESS Capacity Tests'),fl('BESS Degradation Plan'));
  var miss=B.missing(P);if(miss.length)return {error:'Missing governed BESS parameter(s): '+miss.join(', '),sys:sys};
  var ts=tel.map(function(r){return B.stamp(r.Timestamp).minute}).sort(function(a,b){return a-b}),d=[];for(var i=1;i<ts.length;i++)d.push(ts[i]-ts[i-1]);d.sort(function(a,b){return a-b});var dt=(d.length?d[Math.floor(d.length/2)]:15)/60;
  var daily=fl('BESS Daily Operations'),opening=daily.find(function(r){return String(r.Date)===date}),D=B.day(P,tel,dt,opening&&opening.Start_SoC_Pct),M=B.monthToDate(P,daily,date);
  var ppa=R('Commercial & PPA').find(function(x){return same(x.Plant_ID,plantId)})||{},ppaT=n(ppa.PPA_Tariff_INR_kWh,NaN);
  var C=B.commercial(P,M,ppaT),H=B.health(P,daily,date);
  var m={key:key,id:id,plantId:plantId,sys:sys,P:P,D:D,M:M,C:C,H:H,date:date,dt:dt,daily:daily,ppaT:ppaT,safety:f('BESS Safety & Compliance')||{},comms:f('BESS Controls & Comms')||{}};
  CACHE[plantId]=m;return m;
}

/* ---------- UI helpers (AIP standard KPI card) ---------- */
var BARS='<span class="aip-kpi-master-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
function kpis(items){return '<div class="grid g4 aip-maintenance-master-kpis t872-kpis">'+items.map(function(x,i){var v=esc(x[1]),u=x[2]?'<span class="aip-kpi-unit">'+esc(x[2])+'</span>':'';
  return '<div class="aip-kpi-master" data-aip-kpi-index="'+(i%8)+'" title="'+esc(x[3]||x[0])+'" style="height:92px!important;min-height:92px!important;max-height:92px!important;padding:7px 10px 6px!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;gap:3px!important;overflow:hidden!important;"><span class="kpi-label" data-kpi-label>'+esc(x[0])+'</span><b class="kpi-value" data-kpi-value>'+v+'</b><span class="aip-kpi-display-label" style="position:static!important;display:block!important;flex:0 0 auto!important;width:100%!important;min-height:13px!important;margin:0!important;padding:0!important;text-align:left!important;">'+esc(x[0])+'</span><span class="aip-kpi-display-value" style="position:static!important;display:flex!important;flex:0 0 29px!important;width:100%!important;height:29px!important;min-height:29px!important;margin:0!important;padding:0!important;align-items:center!important;justify-content:flex-start!important;line-height:29px!important;overflow:hidden!important;"><span class="aip-kpi-number">'+v+'</span>'+u+'</span>'+BARS+'</div>'}).join('')+'</div>'}
function chip(k,t){return '<span class="t872-chip '+k+'">'+esc(t)+'</span>'}
function st(s){return chip(s==='Pass'?'ok':s==='Review'?'warn':s==='Fail'?'bad':'info',s)}
function table(head,rows,numCols){numCols=numCols||[];return '<div class="t872-tablewrap"><table class="t872-table"><thead><tr>'+head.map(function(h,i){return '<th'+(numCols.indexOf(i)>=0?' class="num"':'')+'>'+h+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(c,i){return '<td'+(numCols.indexOf(i)>=0?' class="num"':'')+'>'+c+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>'}
function lineage(m){return '<div class="ot297-source t872-lineage"><span class="ot297-dot"></span><b>BESS engine</b><span>computed in this browser from the active data source · '+esc(modeLabel())+'</span><span class="t872-sep">·</span><span>'+esc(m.P.name)+' · '+f0(m.P.mw)+' MW / '+f0(m.P.contracted)+' MWh · '+esc(m.P.model)+' · operating day '+esc(m.date)+'</span></div>'}

/* ================= views ================= */
function opsView(m){window.AIP891Bess=m;
  var D=m.D,P=m.P,iv=D.intervals,idx=0;iv.forEach(function(x,i){if(Math.abs(x.t.hour-HOUR)<Math.abs(iv[idx].t.hour-HOUR))idx=i});var x=iv[idx];
  var W=820,H=260,p=40,top=24,xs=function(h){return p+h/24*(W-p-40)},SC=Math.max(P.mw,Math.max.apply(null,iv.map(function(q){return Math.max(q.pv,q.pc,q.pd,q.sched)})))*1.1,ymw=function(v){var mid=(H-p+top)/2;return mid-v/SC*((H-p-top)/2)},ysoc=function(s){return H-p-s/100*(H-p-top)};
  var mid=(H-p+top)/2,bw=(W-p-40)/iv.length*0.8;
  var bars=iv.map(function(q){var y=ymw(q.pd),y2=ymw(-q.pc);return (q.pd>0?'<rect x="'+(xs(q.t.hour)-bw/2)+'" y="'+y+'" width="'+bw+'" height="'+(mid-y)+'" fill="#1687b1" opacity=".85"/>':'')+(q.pc>0?'<rect x="'+(xs(q.t.hour)-bw/2)+'" y="'+mid+'" width="'+bw+'" height="'+(y2-mid)+'" fill="#43a047" opacity=".8"/>':'')}).join('');
  var line=function(fn,c,w,dash){return '<path d="'+iv.map(function(q,i){return (i?'L':'M')+xs(q.t.hour).toFixed(1)+' '+fn(q).toFixed(1)}).join(' ')+'" fill="none" stroke="'+c+'" stroke-width="'+w+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>'};
  var grid=[-1,-.5,0,.5,1].map(function(q){var y=ymw(q*SC/1.1);return '<line x1="'+p+'" y1="'+y+'" x2="'+(W-40)+'" y2="'+y+'" stroke="'+(q===0?'#9fb3bd':'#e2eaee')+'"/><text x="4" y="'+(y+3)+'" font-size="8" fill="#78909c">'+(q<0?'−':'')+f0(Math.abs(q*SC/1.1))+' MW</text>'}).join('')+[0,50,100].map(function(s){return '<text x="'+(W-36)+'" y="'+(ysoc(s)+3)+'" font-size="8" fill="#8e24aa">'+s+'%</text>'}).join('');
  var ticks='';for(var h=0;h<=24;h+=3)ticks+='<text x="'+xs(h)+'" y="'+(H-8)+'" text-anchor="middle" font-size="8" fill="#78909c">'+String(h).padStart(2,'0')+':00</text>';
  var mk=xs(x.t.hour);
  var svg='<svg class="ot297-chart" viewBox="0 0 '+W+' '+H+'" aria-label="BESS operating day">'+grid+bars+line(function(q){return ymw(q.pv)},'#f59e0b',1.8,'5 4')+line(function(q){return ymw(q.sched)},'#0d47a1',1.2,'2 3')+line(function(q){return ysoc(q.soc)},'#8e24aa',2.4)+line(function(q){return ysoc(q.socModel)},'#8e24aa',1.2,'6 4')+
    '<line x1="'+mk+'" y1="'+top+'" x2="'+mk+'" y2="'+(H-p)+'" stroke="#c026d3" stroke-width="2.2"/><text x="'+Math.min(W-90,mk+5)+'" y="16" class="ot297-marker-label">'+hhmm(x.t.minute)+'</text>'+ticks+'<text x="'+(p+4)+'" y="'+(top+10)+'" font-size="8" fill="#1687b1">Discharge ↑</text><text x="'+(p+4)+'" y="'+(H-p-4)+'" font-size="8" fill="#43a047">Charge ↓</text></svg>';
  var lim=[];if(x.tmax>P.tOpMax)lim.push('cell temperature above '+f0(P.tOpMax)+' °C operating limit');if(x.tmax>=P.tAlarm)lim.push('at or above '+f0(P.tAlarm)+' °C alarm');if(x.soc>P.socMax+0.5||x.soc<P.socMin-0.5)lim.push('SoC outside '+f0(P.socMin)+'–'+f0(P.socMax)+'% window');if(x.avail<P.mw)lim.push('available '+f1(x.avail)+' of '+f0(P.mw)+' MW');
  var side='<h3>State at '+hhmm(x.t.minute)+'</h3><div class="ot297-causal" style="margin-top:9px">'+
    '<div class="ot297-good"><span>Operating mode</span><b>'+esc(x.mode||'—')+(x.pc>0?' · from '+esc(x.src):'')+'</b></div>'+
    '<div><span>Charge / discharge at POI</span><b>'+f1(x.pc)+' / '+f1(x.pd)+' MW</b></div>'+
    '<div><span>State of charge · BMS / model</span><b>'+f1(x.soc)+'% / '+f1(x.socModel)+'%</b><small class="t872-small">Model rebuilt from metered power and governed efficiencies; difference '+sg(x.drift)+' pp</small></div>'+
    '<div class="'+(x.tmax>P.tOpMax?'ot297-gap':'')+'"><span>Cell temperature · max / avg</span><b>'+f1(x.tmax)+' / '+f1(x.tavg)+' °C</b><small class="t872-small">Ambient '+f1(x.ta)+' °C · limits '+f0(P.tOpMax)+' / '+f0(P.tAlarm)+' / '+f0(P.tTrip)+' °C</small></div>'+
    '<div><span>Auxiliary load</span><b>'+f0(x.aux*1000)+' kW</b></div>'+
    '<div><span>Co-located PV · dispatch schedule</span><b>'+f1(x.pv)+' · '+f1(x.sched)+' MW</b></div>'+
    '</div>'+(flags(m).length?'<div class="t872-note warn">System findings: '+esc(flags(m).join(' · '))+'</div>':'')+'<div class="t872-note'+(lim.length?' warn':'')+'">'+(lim.length?'Limit flags: '+esc(lim.join('; ')):'All operating limits respected at this interval.')+'</div>';
  return kpis([['Charged today',f1(D.T.chg),'MWh','Metered at POI'],['Discharged today',f1(D.T.dis),'MWh','Metered at POI'],['Round-trip efficiency today',f1(D.rteAdj*100),'%','AC–AC at POI incl. auxiliary, adjusted for SoC change'],['Availability today',f1(D.availability),'%','Time-weighted available MW ÷ rated MW']])+
   '<!--/kpis--><div class="ot297-live"><section class="ot297-card"><div class="t872-head"><div><h3>BESS operating day</h3><div class="t872-subline">Bars: metered charge (green, below axis) and discharge (blue). Solid purple: BMS state of charge; dashed purple: engine SoC rebuilt from metered power. Orange dashed: co-located PV. Blue dotted: dispatch schedule.</div></div></div>'+svg+
   '<div class="t872-hour"><label for="t873Hour">Time of day</label><input id="t873Hour" type="range" min="0" max="23.75" step="0.25" value="'+HOUR+'"><b>'+hhmm(x.t.minute)+'</b></div></section><aside class="ot297-card">'+side+'</aside></div>';
}
function bridgeView(m){window.AIP891Bess=m;
  var D=m.D,P=m.P,T=D.T,inE=T.chg+T.aux,resPct=T.chg>0?D.residual/T.chg*100:0,ar=Math.abs(resPct),rk=ar<=1?'ok':ar<=2.5?'warn':'bad';
  var mx=Math.max.apply(null,D.bridge.map(function(b){return Math.abs(b[2])}).concat([T.aux,0.01]));
  var rows=[['aux','Auxiliary consumption (HVAC, BMS, controls)',T.aux]].concat(D.bridge).map(function(b){var v=b[2],neg=v<0,nat=b[0]==='residual'?chip('warn','Investigate'):b[0]==='dStored'?chip('info','Stored, not lost'):b[0]==='aux'?chip('muted','Station load'):chip('muted','Physics');
    return '<div class="ot297-lossrow t872-lossrow"><span>'+esc(b[1])+'</span><div><i style="width:'+(Math.abs(v)<=0?0:Math.max(1,Math.abs(v)/mx*100))+'%;background:'+(b[0]==='residual'?'#9e9d24':b[0]==='dStored'?'#8e24aa':b[0]==='aux'?'#fb8c00':'#546e7a')+'"></i></div><b>'+sg(-v,f2)+' MWh</b><em>'+sg(inE>0?v/inE*100:0)+'%</em>'+nat+'</div>'}).join('');
  var rtext=resPct>=0?'The meters show '+f2(D.residual)+' MWh more loss than the governed efficiencies explain — typical causes: PCS or transformer below nameplate efficiency, unmetered auxiliary load, cell imbalance.':'The BMS reports '+f2(-D.residual)+' MWh more stored energy than the metered power supports — typical cause: BMS state-of-charge estimation drift; schedule a full-charge recalibration.';
  var W=820,H=150,p=36,iv=D.intervals,xs=function(h){return p+h/24*(W-p-18)},ys=function(v){return H-22-v/100*(H-38)};
  var svg='<svg class="ot297-chart" viewBox="0 0 '+W+' '+H+'" aria-label="SoC BMS versus model">'+[0,50,100].map(function(s){return '<line x1="'+p+'" y1="'+ys(s)+'" x2="'+(W-18)+'" y2="'+ys(s)+'" stroke="#e2eaee"/><text x="4" y="'+(ys(s)+3)+'" font-size="8" fill="#78909c">'+s+'%</text>'}).join('')+
    '<path d="'+iv.map(function(q,i){return (i?'L':'M')+xs(q.t.hour).toFixed(1)+' '+ys(q.soc).toFixed(1)}).join(' ')+'" fill="none" stroke="#8e24aa" stroke-width="2.2"/><path d="'+iv.map(function(q,i){return (i?'L':'M')+xs(q.t.hour).toFixed(1)+' '+ys(q.socModel).toFixed(1)}).join(' ')+'" fill="none" stroke="#1687b1" stroke-width="1.6" stroke-dasharray="6 4"/></svg>';
  return kpis([['Energy in at POI',f1(inE),'MWh','Charged '+f1(T.chg)+' + auxiliary '+f1(T.aux)],['Energy out at POI',f1(T.dis),'MWh'],['Measured round trip',f1(D.rteRaw*100),'%','Discharged ÷ (charged + auxiliary), unadjusted'],['Modelled round trip',f1(D.modelRte*100),'%','DC round trip × (PCS × transformer)², excl. auxiliary']])+
   '<!--/kpis--><section class="ot297-card t872-loss"><div class="t872-head"><div><h3>Energy & Efficiency Bridge — operating day '+esc(m.date)+'</h3><div class="t872-subline">Energy charged plus auxiliary load, traced through every conversion step to the energy delivered back at the point of interconnection. Each line is computed per 15-minute interval from metered power and the governed efficiency parameters, then summed.</div></div></div>'+
   '<div class="t872-bridgehead"><span>Step</span><span></span><span>Energy</span><span>% of input</span><span>Nature</span></div>'+rows+
   '<div class="t872-recon ok"><b>Reconciliation</b><span>Charged '+f2(T.chg)+' − losses '+f2(D.losses)+' − Δstored '+f2(D.dStored)+' − residual '+f2(D.residual)+' = discharged '+f2(T.dis)+' MWh (exact)</span>'+chip('ok','Reconciled')+'</div>'+
   '<div class="t872-recon '+rk+'"><b>Residual '+sg(resPct)+'%</b><span>'+esc(rtext)+'</span>'+chip(rk,rk==='ok'?'Within ±1%':rk==='warn'?'Investigate':'Model / data issue')+'</div>'+
   '<div class="ot303-losschart"><h4>State of charge · BMS versus engine</h4><div class="ot303-sub">Largest difference '+sg(D.maxDrift)+' pp. A growing gap during cycling points to BMS SoC estimation drift; a step change points to a metering or telemetry fault.</div>'+svg+'<div class="ot297-legend"><span><i style="color:#8e24aa"></i>BMS SoC</span><span><i style="color:#1687b1;border-top-style:dashed"></i>Engine SoC from metered power</span></div></div></section>';
}
function healthView(m){window.AIP891Bess=m;
  var P=m.P,H=m.H,t=P.tests;
  var W=820,Hh=200,p=40,years=P.plan.map(function(x){return n(x.Operating_Year)}),maxY=Math.max.apply(null,years.concat([1])),maxE=Math.max.apply(null,P.plan.map(function(x){return n(x.Expected_Usable_MWh)}).concat([P.contracted*1.15]))*1.05;
  var minE=Math.min(P.contracted*0.85,Math.min.apply(null,P.plan.map(function(x){return n(x.Expected_Usable_MWh)}))*0.97),xs=function(y){return p+10+y/maxY*(W-p-60)},ys=function(e){return Hh-24-(e-minE)/(maxE-minE)*(Hh-44)};
  var plan='<path d="'+P.plan.map(function(x,i){return (i?'L':'M')+xs(n(x.Operating_Year)).toFixed(1)+' '+ys(n(x.Expected_Usable_MWh)).toFixed(1)}).join(' ')+'" fill="none" stroke="#1687b1" stroke-width="2.2"/>';
  var aug=P.plan.filter(function(x){return n(x.Planned_Augmentation_MWh)>0}).map(function(x){return '<circle cx="'+xs(n(x.Operating_Year))+'" cy="'+ys(n(x.Expected_Usable_MWh))+'" r="4" fill="#fb8c00"/>'}).join('');
  var pts=t.map(function(x){var a=B.days(P.cod,x.Test_Date)/365.25;return '<circle cx="'+xs(a)+'" cy="'+ys(n(x.Discharged_Energy_POI_MWh))+'" r="5" fill="#16a34a" stroke="#fff"/>'}).join('');
  var now=xs(H.age);
  var svg='<svg class="ot297-chart" viewBox="0 0 '+W+' '+Hh+'" aria-label="Usable energy versus plan">'+[0,.5,1].map(function(q){var e=minE+(maxE-minE)*q;return '<line x1="'+p+'" y1="'+ys(e)+'" x2="'+(W-18)+'" y2="'+ys(e)+'" stroke="#e2eaee"/><text x="4" y="'+(ys(e)+3)+'" font-size="8" fill="#78909c">'+f0(e)+' MWh</text>'}).join('')+
    '<line x1="'+p+'" y1="'+ys(P.contracted)+'" x2="'+(W-18)+'" y2="'+ys(P.contracted)+'" stroke="#d65353" stroke-dasharray="6 4"/><text x="'+(p+14)+'" y="'+(ys(P.contracted)+12)+'" text-anchor="start" font-size="8" fill="#d65353">Contracted '+f0(P.contracted)+' MWh</text>'+plan+aug+pts+
    '<line x1="'+now+'" y1="16" x2="'+now+'" y2="'+(Hh-24)+'" stroke="#c026d3" stroke-width="1.6"/><text x="'+Math.min(W-60,now+4)+'" y="14" class="ot297-marker-label">today</text>'+
    P.plan.filter(function(x){return n(x.Operating_Year)%3===0}).map(function(x){return '<text x="'+xs(n(x.Operating_Year))+'" y="'+(Hh-8)+'" text-anchor="'+(n(x.Operating_Year)===maxY?'end':n(x.Operating_Year)===0?'start':'middle')+'" font-size="8" fill="#78909c">Y'+n(x.Operating_Year)+' · '+n(x.Calendar_Year)+'</text>'}).join('')+'</svg>';
  var dev=H.deviation,dk=dev>=-0.5?'ok':dev>=-1.5?'warn':'bad',mk=H.margin>=P.contracted*0.03?'ok':H.margin>=0?'warn':'bad';
  var tRows=t.map(function(x){return [esc(x.Test_ID),esc(x.Test_Date),esc(x.Test_Type),f2(n(x.Discharged_Energy_POI_MWh)),f2(n(x.AC_RTE_Pct))+'%',f2(n(x.SOH_Energy_Pct))+'%',esc(x.Witness),st(n(x.Discharged_Energy_POI_MWh)>=P.contracted?'Pass':'Review')]});
  var W8=P.war,warRows=[
    ['Performance warranty','Retention ≥ '+f0(n(W8.Guaranteed_Retention_Pct_Year10))+'% at year 10, ≥ '+f0(n(W8.Guaranteed_Retention_Pct_EOL))+'% at end of life','SOH '+f1(H.soh)+'% at '+f1(H.age)+' years',st(H.soh>=n(W8.Guaranteed_Retention_Pct_Year10)?'Pass':'Review')],
    ['Cycle limit',f0(H.cycleLimit)+' equivalent full cycles','Used '+f0(H.efc)+' ('+f1(H.cycleUse)+'%) in '+f1(H.timeUse)+'% of warranty time',st(H.cycleUse<=H.timeUse*1.1?'Pass':'Review')],
    ['Throughput limit',f0(n(W8.Warranty_Throughput_Limit_MWh))+' MWh','Used '+f0(H.cum)+' MWh ('+f1(H.throughputUse)+'%)',st(H.throughputUse<=H.timeUse*1.1?'Pass':'Review')],
    ['Temperature condition',esc(W8.Warranty_Temp_Condition_C||'—'),'Max cell temperature month-to-date '+f1(m.M.tmax)+' °C; today '+f1(m.D.maxT)+' °C',st(m.D.violations.tempAlarm?'Review':m.M.tmax>40?'Review':'Pass')],
    ['Cycling condition','≤ '+f0(P.maxCyclesDay)+' cycle(s) per day','Month-to-date '+f2(m.M.cyclesPerDay)+' per day',st(m.M.cyclesPerDay<=P.maxCyclesDay*1.02?'Pass':'Review')],
    ['Guaranteed AC round trip','≥ '+f0(n(W8.Guaranteed_AC_RTE_Pct))+'% (excl. auxiliary)','Month-to-date '+f1(m.M.chg>0?m.M.dis/m.M.chg*100:NaN)+'%',st(m.M.chg>0&&m.M.dis/m.M.chg*100>=n(W8.Guaranteed_AC_RTE_Pct)?'Pass':'Review')]];
  return kpis([['State of health',f1(H.soh),'%',P.sohSource],['Versus OEM expected curve',sg(dev),'pp','Expected '+f1(H.expected)+'% at test age'],['Usable energy at POI',f1(H.usableNow),'MWh','Latest capacity test · margin '+sg(H.margin)+' MWh over contracted'],['Warranty cycles used',f1(H.cycleUse),'%',f0(H.efc)+' of '+f0(H.cycleLimit)+' equivalent full cycles']])+
   '<!--/kpis--><section class="ot297-card"><div class="t872-head"><div><h3>Health, degradation & warranty</h3><div class="t872-subline">Usable energy from capacity tests (green) against the OEM expected curve with planned augmentation (blue, orange points) and the contracted energy (red). '+
   (H.nextAug?'Next planned augmentation: '+f1(n(H.nextAug.Planned_Augmentation_MWh))+' MWh in '+n(H.nextAug.Calendar_Year)+'. ':'')+'Next capacity test due '+esc(H.nextTest||'—')+'.</div></div></div>'+svg+
   '<div class="ot297-legend"><span><i style="color:#16a34a"></i>Capacity tests</span><span><i class="lg-weather"></i>Expected usable (plan)</span><span><i style="color:#fb8c00"></i>Augmentation</span><span><i style="color:#d65353;border-top-style:dashed"></i>Contracted energy</span></div>'+
   '<div class="t872-recon '+dk+'"><b>Degradation</b><span>'+(dev>=-0.5?'Capacity is tracking the OEM expected curve.':'Capacity is '+f1(-dev)+' pp below the OEM expected curve for this age — review cycling depth, temperature exposure and cell balancing; raise with the OEM if the gap persists at the next test.')+'</span>'+chip(dk,dk==='ok'?'On curve':dk==='warn'?'Watch':'Below curve')+'</div>'+
   '<div class="t872-recon '+mk+'"><b>Contract energy</b><span>Usable energy at POI is '+f1(H.usableNow)+' MWh against '+f0(P.contracted)+' MWh contracted ('+sg(H.margin)+' MWh). '+(H.margin<P.contracted*0.03?'Augmentation or dispatch derating is needed before the margin runs out.':'Margin is adequate until the next planned augmentation.')+'</span>'+chip(mk,mk==='ok'?'Adequate':mk==='warn'?'Thin margin':'Shortfall')+'</div>'+
   '<h4 class="t872-h4">Capacity tests</h4>'+table(['Test','Date','Type','Discharged at POI (MWh)','AC round trip','State of health','Witness','Against contract'],tRows,[3,4,5])+
   '<h4 class="t872-h4">Warranty conditions</h4>'+table(['Condition','Warranty term','Current position','Status'],warRows)+'</section>';
}
function contractView(m){window.AIP891Bess=m;
  var P=m.P,M=m.M,C=m.C,c=P.com;
  var obl=[['Availability','≥ '+f0(C.minA)+'% · '+esc(c.Availability_Measurement||''),f2(M.availability)+'%',st(C.availabilityOk?'Pass':'Fail')],
    Number.isFinite(n(c.Min_RTE_Pct,NaN))?['Round-trip efficiency','≥ '+f0(C.minR)+'% · '+esc(c.RTE_Measurement||''),f2(M.rte)+'%',st(C.rteOk?'Pass':'Fail')]:['Round-trip efficiency',esc(c.RTE_Measurement||'Not contractual'),f2(M.rte)+'% incl. auxiliary',st('Info')],
    ['Cycles','≤ '+f0(n(c.Cycles_per_Day))+' per day (contract)',f2(M.cyclesPerDay)+' per day',st(M.cyclesPerDay<=n(c.Cycles_per_Day)*1.02?'Pass':'Review')]];
  if(Number.isFinite(C.minF))obl.push(['Peak dispatch fulfilment','≥ '+f0(C.minF)+'% of scheduled energy',f1(M.fulfil)+'%',st(C.fulfilOk?'Pass':'Fail')]);
  else obl.push(['Dispatch fulfilment','Scheduled energy delivered',f1(M.fulfil)+'%',st(M.fulfil>=95?'Pass':'Review')]);
  var lines=C.lines.map(function(l){return [esc(l[0]),'<b>'+(l[1]<0?'−':'')+inrL(Math.abs(l[1]))+'</b> lakh']});lines.push(['<b>Net month to date</b>','<b>'+inrL(C.net)+'</b> lakh']);
  var terms=[['Offtaker',esc(c.Offtaker)],['Commercial model',esc(c.Commercial_Model)],['Tenure',f0(n(c.Tenure_Years))+' years from '+esc(c.Contract_Start)],['Charge window',esc(c.Charge_Window)],['Discharge window',esc(c.Discharge_Window)],
    C.kind==='capacity'?['Capacity charge','₹'+f0(n(c.Capacity_Charge_INR_per_MW_Month))+' per MW per month']:['Peak tariff','₹'+f2(n(c.Peak_Tariff_INR_kWh))+' per kWh · PV valued at ₹'+f2(m.ppaT)+'/kWh (Commercial & PPA)'],
    ['Viability gap funding',esc(c.VGF_Support)+(n(c.VGF_INR_per_MWh)>0?' · ₹'+f0(n(c.VGF_INR_per_MWh)/1e5)+' lakh/MWh ≈ ₹'+f2(n(c.VGF_INR_per_MWh)*P.contracted/1e7)+' crore':'')],c.RTE_Penalty_Basis?['RTE penalty basis',esc(c.RTE_Penalty_Basis)]:null].filter(Boolean);
  var dly=M.rows.map(function(r){var rte=(n(r.Charge_MWh_POI)+n(r.Aux_MWh))>0?n(r.Discharge_MWh_POI)/(n(r.Charge_MWh_POI)+n(r.Aux_MWh))*100:NaN;return [esc(r.Date),f1(n(r.Charge_MWh_POI)),f1(n(r.Discharge_MWh_POI)),f2(n(r.Aux_MWh)),f1(rte)+'%',f2(n(r.Availability_Pct))+'%',f2(n(r.Equivalent_Full_Cycles))]}).reverse().slice(0,10);
  return kpis([['Availability month to date',f2(M.availability),'%','Minimum '+f0(C.minA)+'%'],['Round trip month to date',f2(M.rte),'%','AC–AC incl. auxiliary'+(Number.isFinite(n(c.Min_RTE_Pct,NaN))?' · minimum '+f0(C.minR)+'%':' · not a contract obligation')],['Cycles per day',f2(M.cyclesPerDay),'','Contract '+f0(n(c.Cycles_per_Day))],['Net value month to date',inrL(C.net),'lakh',C.kind==='capacity'?'Capacity charge less penalties':'Peak revenue less charging opportunity cost']])+
   '<!--/kpis--><div class="ot297-live"><section class="ot297-card"><h3>Contract obligations — '+esc(M.month)+' ('+M.days+' days)</h3><div class="t872-subline">Measured on the contract basis: monthly, at the point of interconnection, from BESS Daily Operations.</div>'+table(['Obligation','Requirement','Month to date','Status'],obl)+
   '<h4 class="t872-h4">Value month to date</h4>'+table(['Line','Amount'],lines,[1])+'<h4 class="t872-h4">Last 10 days</h4>'+table(['Date','Charged MWh','Discharged MWh','Aux MWh','Round trip','Availability','Cycles'],dly,[1,2,3,4,5,6])+'</section>'+
   '<aside class="ot297-card"><h3>Contract terms</h3><div class="ot297-causal" style="margin-top:9px">'+terms.map(function(t){return '<div><span>'+t[0]+'</span><b>'+t[1]+'</b></div>'}).join('')+'</div><div class="t872-note">Advisory only — AIP does not send dispatch or setpoint commands to the EMS or PPC.</div></aside></div>';
}
function checksView(m){
  var P=m.P,S=m.safety,D=m.D,sys=m.sys,out=[],add=function(a,f,s,d){out.push([esc(a),esc(f),esc(d||''),st(s)])};
  var am=R('Asset Master').filter(function(a){return same(a.Plant_ID,m.plantId)&&/^BESS/.test(String(a.Asset_Class||''))}),cnt=function(c){return am.filter(function(a){return a.Asset_Class===c}).length};
  add('Containers vs nameplate',f0(P.containers)+' × '+f2(P.contMWh)+' MWh = '+f1(P.containers*P.contMWh)+' MWh vs '+f1(P.bol)+' MWh',Math.abs(P.containers*P.contMWh-P.bol)<=P.bol*0.01?'Pass':'Review','BESS Systems vs BESS Specifications');
  add('PCS capacity',f0(P.pcsCount)+' × '+f2(P.pcsMW)+' MW = '+f1(P.pcsCount*P.pcsMW)+' MW vs '+f0(P.mw)+' MW rated',P.pcsCount*P.pcsMW>=P.mw?'Pass':'Fail');
  add('Transformer capacity',f0(P.mvtCount)+' × '+f2(P.mvtMVA)+' MVA = '+f1(P.mvtCount*P.mvtMVA)+' MVA vs PCS '+f1(P.pcsCount*P.pcsMW)+' MW',P.mvtCount*P.mvtMVA>=P.pcsCount*P.pcsMW?'Pass':'Review');
  add('Asset Master · containers',cnt('BESS Container')+' records vs '+f0(P.containers),cnt('BESS Container')===P.containers?'Pass':'Review','Hierarchy via Parent_Asset_ID');
  add('Asset Master · PCS',cnt('BESS PCS')+' records vs '+f0(P.pcsCount)+(am.filter(function(a){return a.Asset_Class==='BESS PCS'&&!/operational/i.test(String(a.Operating_Status||''))}).length?' · '+am.filter(function(a){return a.Asset_Class==='BESS PCS'&&!/operational/i.test(String(a.Operating_Status||''))}).map(function(a){return a.Asset_Tag+' '+a.Operating_Status}).join(', '):''),cnt('BESS PCS')===P.pcsCount&&!am.some(function(a){return a.Asset_Class==='BESS PCS'&&!/operational/i.test(String(a.Operating_Status||''))})?'Pass':'Review');
  add('Asset Master · transformers',cnt('BESS MV Transformer')+' records vs '+f0(P.mvtCount),cnt('BESS MV Transformer')===P.mvtCount?'Pass':'Review');
  var site=R('Sites').find(function(s){return same(s.Plant_ID,m.plantId)})||{};
  add('Sites flag',site.Has_BESS?'Has_BESS = '+site.Has_BESS+' · BESS_ID '+(site.BESS_ID||'—'):'Sites has no BESS columns in this data source',String(site.Has_BESS||'')==='Yes'&&same(site.BESS_ID,m.id)?'Pass':'Review');
  var pvMW=n(site.Capacity_MW,NaN),dur=P.contracted/P.mw;
  add('Co-location advisory (MoP, Feb 2025)','BESS '+f0(P.mw)+' MW = '+f1(P.mw/pvMW*100)+'% of '+f0(pvMW)+' MW solar · '+f1(dur)+' h',P.mw>=0.1*pvMW&&dur>=2?'Pass':'Review','Advisory: ≥ 10% of solar capacity with ≥ 2 h storage for new solar tenders');
  var sp=R('Spare Parts Master').filter(function(x){return /bess/i.test(String(x.Category||''))});
  add('Critical spares',sp.length+' BESS part lines in Spare Parts Master',sp.length?'Pass':'Review','Modules, PCS stacks, BMS boards, cooling, suppression');
  var ntest=m.H.nextTest;add('Capacity test schedule','Next test due '+(ntest||'—'),ntest&&ntest>=m.date?'Pass':'Review');
  var saf=[], ok=function(c){return c?'Pass':'Review'};
  var inForce='2027-04-01',dl=Math.round(B.days(m.date,inForce));
  saf.push(['Automatic suppression in every container',f0(n(S.Containers_With_Auto_Suppression))+' of '+f0(P.containers),st(ok(n(S.Containers_With_Auto_Suppression)>=P.containers))]);
  saf.push(['Smoke / gas / heat / flame detection',esc(S.Gas_Smoke_Heat_Flame_Detection),st(ok(S.Gas_Smoke_Heat_Flame_Detection==='Yes'))]);
  saf.push(['Explosion venting and forced ventilation',esc(S.Explosion_Venting_Deflagration_Panels)+' / '+esc(S.Forced_Ventilation_Auto_Louvers),st(ok(S.Explosion_Venting_Deflagration_Panels==='Yes'&&S.Forced_Ventilation_Auto_Louvers==='Yes'))]);
  saf.push(['Two-fault-tolerance design review',esc(S.Two_Fault_Tolerance_Design_Review),st(ok(S.Two_Fault_Tolerance_Design_Review==='Completed'))]);
  saf.push(['Independent fire-safety audit',S.Last_Third_Party_Fire_Audit?'Last '+esc(S.Last_Third_Party_Fire_Audit)+' · due by '+esc(S.Fire_Audit_Due_By):'Not yet done · due by '+esc(S.Fire_Audit_Due_By),st(ok(!!S.Last_Third_Party_Fire_Audit&&S.Last_Third_Party_Fire_Audit<=m.date&&!!S.Fire_Audit_Due_By&&S.Fire_Audit_Due_By>=m.date&&!!S.Evidence_Document_ID))]);
  saf.push(['Perimeter fence ≥ 1.8 m, CCTV, emergency stop',f1(n(S.Perimeter_Fence_m))+' m · '+esc(S.CCTV_Motion_Detection)+' · '+esc(S.Emergency_Stop_Auto_and_Manual),st(ok(n(S.Perimeter_Fence_m)>=1.8&&S.CCTV_Motion_Detection==='Yes'&&S.Emergency_Stop_Auto_and_Manual==='Yes'))]);
  var chk=B.selfChecks(P,D).map(function(c){return [esc(c.name),esc(c.kind),esc(c.detail),st(c.pass?'Pass':'Fail')]});
  var V=D.violations,lim=[['SoC outside operating window',V.socOut],['Cell temperature above operating maximum',V.tempOp],['Cell temperature at or above alarm',V.tempAlarm],['Cell temperature at or above trip',V.tempTrip],['Charging above co-located PV output',V.pvShort]].map(function(v){return [v[0],f0(v[1])+' interval(s)',st(v[1]?(/trip/.test(v[0])?'Fail':'Review'):'Pass')]});
  var safePass=saf.filter(function(r){return /Pass/.test(r[2])}).length;window.AIP891Bess=m;window.AIP891BessChecks={chk,saf,safePass,dl};
  return kpis([['Engine self-checks',chk.filter(function(r){return /Pass/.test(r[3])}).length+' / '+chk.length,'passed'],['Operating-limit flags today',f0(V.socOut+V.tempOp+V.tempAlarm+V.tempTrip+V.pvShort),'intervals'],['CEA safety readiness',safePass+' / '+saf.length,'items','CEA BESS safety regulations in force 1 Apr 2027'],['Days to CEA regulations',f0(dl),'days']])+
   '<!--/kpis--><section class="ot297-card"><h3>Safety, limits & data checks — '+esc(P.name)+'</h3><div class="t872-subline">Computed at run time from the active data source; findings do not change the engine results.</div>'+
   '<div class="t872-note warn">Readiness checklist only. Illustrative records are not compliance evidence. Fire audit requires a document reference and a current due date.</div><h4 class="t872-h4">1 · CEA safety readiness</h4>'+table(['Requirement','Current position','Status'],saf)+
   '<h4 class="t872-h4">2 · Operating limits — operating day</h4>'+table(['Limit','Occurrences','Status'],lim)+
   '<h4 class="t872-h4">3 · Engine self-checks</h4>'+table(['Check','Type','Evidence','Result'],chk)+
   '<h4 class="t872-h4">4 · Master-data consistency</h4>'+table(['Area','Finding','Source','Status'],out)+'</section>';
}
function flags(m){var f=[],P=m.P,D=m.D,M=m.M,H=m.H,C=m.C,S=m.safety;
  if(C.availabilityOk===false)f.push('Availability below '+f0(C.minA)+'%');if(C.rteOk===false)f.push('RTE below contract');
  if(M.chg>0&&M.dis/M.chg*100<n(P.war.Guaranteed_AC_RTE_Pct,0))f.push('RTE below OEM guarantee');if(C.fulfilOk===false)f.push('Peak fulfilment '+f0(M.fulfil)+'%');
  if(D.violations.tempAlarm)f.push('Cell temperature alarm');if(Math.abs(D.maxDrift)>=2)f.push('BMS SoC drift '+sg(D.maxDrift)+' pp');
  if(H.deviation<-0.5)f.push('Capacity below OEM curve');if(H.margin<P.contracted*0.03)f.push('Thin energy margin');
  if(!S.Last_Third_Party_Fire_Audit)f.push('Fire audit pending');if(S.Two_Fault_Tolerance_Design_Review&&S.Two_Fault_Tolerance_Design_Review!=='Completed')f.push('Two-fault review pending');
  var out=R('Asset Master').filter(function(a){return same(a.Plant_ID,m.plantId)&&a.Asset_Class==='BESS PCS'&&!/operational/i.test(String(a.Operating_Status||''))});if(out.length)f.push(out.length+' PCS on outage');
  return f;}
function gridView(m){
  var P=m.P,site=R('Sites').find(function(s){return same(s.Plant_ID,m.plantId)})||{},lim=n(site.Export_Limit_MW,NaN),imp=n(site.Import_Limit_MW,NaN);
  var pvRows=R('Twin Telemetry').filter(function(r){return same(r.Plant_ID,m.plantId)&&String(r.Weather_Mode||'Observed')==='Observed'&&String(r.Timestamp).slice(0,10)===m.date}),pv={};pvRows.forEach(function(r){pv[String(r.Timestamp)]=n(r.Actual_AC_MW,0)});
  var iv=m.D.intervals,dt=m.dt,S={pv:0,exp:0,chg:0,fromPV:0,grid:0,dis:0,peak:0,over:0,imp:0,impOver:0},pts=[];
  iv.forEach(function(q){var p=pv[String(q.raw.Timestamp)]||0,fp=q.pc>0&&/PV/.test(q.src)?Math.min(q.pc,p):0,g=q.pc-fp,e=p-q.pc+q.pd;
    S.pv+=p*dt;S.chg+=q.pc*dt;S.fromPV+=fp*dt;S.grid+=g*dt;S.dis+=q.pd*dt;S.exp+=Math.max(0,e)*dt;S.imp+=Math.max(0,-e)*dt;if(e>S.peak)S.peak=e;if(Number.isFinite(lim)&&e>lim+0.01)S.over++;if(Number.isFinite(imp)&&-e>imp+0.01)S.impOver++;pts.push({h:q.t.hour,pv:p,pc:q.pc,pd:q.pd,e:e})});
  var W=820,H=250,p=40,top=22,mx=Math.max(lim||0,Math.max.apply(null,pts.map(function(x){return Math.max(x.pv,x.e,x.pd)})))*1.08,mn=-Math.max(P.mw,Math.max.apply(null,pts.map(function(x){return x.pc})))*1.1;
  var xs=function(h){return p+h/24*(W-p-20)},ys=function(v){return top+(mx-v)/(mx-mn)*(H-p-top)};
  var line=function(k,c,w,dash){return '<path d="'+pts.map(function(x,i){return (i?'L':'M')+xs(x.h).toFixed(1)+' '+ys(x[k]).toFixed(1)}).join(' ')+'" fill="none" stroke="'+c+'" stroke-width="'+w+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>'};
  var bw=(W-p-20)/pts.length*0.8,bars=pts.map(function(x){return (x.pd>0?'<rect x="'+(xs(x.h)-bw/2)+'" y="'+ys(x.pd)+'" width="'+bw+'" height="'+(ys(0)-ys(x.pd))+'" fill="#1687b1" opacity=".55"/>':'')+(x.pc>0?'<rect x="'+(xs(x.h)-bw/2)+'" y="'+ys(0)+'" width="'+bw+'" height="'+(ys(-x.pc)-ys(0))+'" fill="#43a047" opacity=".55"/>':'')}).join('');
  var grid=[mn,0,mx/2,mx].map(function(v){return '<line x1="'+p+'" y1="'+ys(v)+'" x2="'+(W-20)+'" y2="'+ys(v)+'" stroke="'+(v===0?'#9fb3bd':'#e2eaee')+'"/><text x="4" y="'+(ys(v)+3)+'" font-size="8" fill="#78909c">'+(v<0?'−':'')+f0(Math.abs(v))+' MW</text>'}).join('');
  var ticks='';for(var h=0;h<=24;h+=3)ticks+='<text x="'+xs(h)+'" y="'+(H-8)+'" text-anchor="middle" font-size="8" fill="#78909c">'+String(h).padStart(2,'0')+':00</text>';
  var svg='<svg class="ot297-chart" viewBox="0 0 '+W+' '+H+'" aria-label="Grid connection">'+grid+bars+(Number.isFinite(lim)?'<line x1="'+p+'" y1="'+ys(lim)+'" x2="'+(W-20)+'" y2="'+ys(lim)+'" stroke="#d65353" stroke-dasharray="6 4"/><text x="'+(W-22)+'" y="'+(ys(lim)-4)+'" text-anchor="end" font-size="8" fill="#d65353">Export limit '+f0(lim)+' MW</text>':'')+line('pv','#f59e0b',1.8,'5 4')+line('e','#173f52',2.4)+ticks+'</svg>';
  var solarShare=S.chg>0?S.fromPV/S.chg*100:NaN,rows=[['Export limit',Number.isFinite(lim)?f0(lim)+' MW':'not in Sites','Peak POI export '+f1(S.peak)+' MW · '+S.over+' interval(s) above limit',st(S.over?'Fail':'Pass')],
    ['Import limit',Number.isFinite(imp)?f0(imp)+' MW':'not in Sites','Grid import '+f1(S.imp)+' MWh · '+S.impOver+' interval(s) above limit',st(S.impOver?'Fail':'Pass')],
    ['Charging source','Contract: '+esc(P.chargingSource),f1(solarShare)+'% of charging from co-located PV · '+f1(S.grid)+' MWh from grid',st(/PV/.test(P.chargingSource)&&!/Grid/.test(P.chargingSource)&&S.grid>0.5?'Review':'Pass')]];
  window.AIP891Bess=m;window.AIP891BessGrid={S,pts,pvRows};return kpis([['PV generation',f1(S.pv),'MWh','Plant revenue meter (Twin Telemetry)'],['Charged from PV',f1(S.fromPV),'MWh',f1(solarShare)+'% of charging'],['Net export at POI',f1(S.exp),'MWh','PV − charging + discharging'],['Peak export',f1(S.peak),'MW',Number.isFinite(lim)?'Limit '+f0(lim)+' MW':'']])+
   '<!--/kpis--><section class="ot297-card"><h3>Grid connection — PV and battery at the point of interconnection</h3><div class="t872-subline">Solid line: net export at the POI. Orange dashed: PV generation. Blue bars: battery discharge; green bars: battery charging (below axis). Red dashed: connectivity export limit from Sites.</div>'+svg+
   '<div class="ot297-legend"><span><i style="color:#173f52"></i>Net export at POI</span><span><i style="color:#f59e0b;border-top-style:dashed"></i>PV generation</span><span><i style="color:#1687b1"></i>Battery discharge</span><span><i style="color:#43a047"></i>Battery charging</span><span><i style="color:#d65353;border-top-style:dashed"></i>Export limit</span></div>'+
   '<h4 class="t872-h4">Connection checks</h4>'+table(['Check','Limit / term','Operating day','Status'],rows)+'</section>';
}
function portfolioView(){
  var sys=R('BESS Systems');
  if(!sys.length)return '<section class="ot297-card"><h3>Battery storage</h3><div class="t872-note warn">The active data source has no BESS Systems sheet. Import a workbook with the BESS master sheets to enable this tab.</div></section>';
  var rows=sys.map(function(s){var m=modelFor(s.Plant_ID);var ok=m&&!m.error;return ['<b>'+esc(s.BESS_ID)+'</b> '+esc(s.BESS_Name),esc(s.Plant_ID),f0(n(s.Rated_Power_MW))+' MW / '+f0(n(s.Contracted_Energy_MWh))+' MWh',esc(s.Commercial_Model),ok?f1(m.H.soh)+'%':'—',ok?f2(m.M.availability)+'%':'—',ok?f1(m.M.rte)+'%':'—',ok?(flags(m).length?flags(m).map(function(t){return chip('warn',t)}).join(' '):chip('ok','No findings')):'—','<button type="button" class="t872-link" data-open="'+esc(s.Plant_ID)+'">Open →</button>']});
  var tMW=sys.reduce(function(a,s){return a+n(s.Rated_Power_MW)},0),tMWh=sys.reduce(function(a,s){return a+n(s.Contracted_Energy_MWh)},0);
  window.AIP891BessPortfolio={sys,sites:R('Sites')};return kpis([['BESS systems',f0(sys.length),''],['Rated power',f0(tMW),'MW'],['Contracted energy',f0(tMWh),'MWh'],['Sites with storage',f0(new Set(sys.map(s=>s.Plant_ID)).size)+' of '+f0(R('Sites').length),'']])+
   '<!--/kpis--><section class="ot297-card"><h3>No battery at this site — portfolio battery storage</h3><div class="t872-subline">Select a system to open its twin.</div>'+table(['System','Site','Rating','Commercial model','State of health','Availability MTD','Round trip MTD','Needs attention',''],rows,[4,5,6])+'</section>';
}
/* ================= render & lifecycle ================= */
var SUBS=[['ops','Operations'],['grid','Grid Connection'],['bridge','Energy Bridge'],['health','Health & Warranty'],['contract','Contract & Revenue'],['checks','Safety & Checks']];
function render(){
  var v=$('#view-operationaltwin'),body=v&&$('#twBody',v);if(!body)return false;
  v.classList.add('t873-bess-active');var tk=$('#tKpis',v);if(tk)tk.innerHTML='';
  var m;try{m=modelFor(pid())}catch(e){console.error('[AIP v873 BESS]',e);m={error:String(e&&e.message||e)}}
  var html;
  if(!m){html=portfolioView()}
  else if(m.error){html='<section class="ot297-card"><h3>BESS engine cannot run for this site</h3><div class="t872-note warn">'+esc(m.error)+'. Correct the governed rows and re-import; the engine does not substitute default values.</div></section>'}
  else{
    var inner=VIEW==='grid'?gridView(m):VIEW==='bridge'?bridgeView(m):VIEW==='health'?healthView(m):VIEW==='contract'?contractView(m):VIEW==='checks'?checksView(m):opsView(m);
    var cut=inner.indexOf('<!--/kpis-->'),top=cut>=0?inner.slice(0,cut):'',rest=cut>=0?inner.slice(cut+12):inner;
    html=lineage(m)+'<div class="t873-bar"><div class="t872-seg" role="tablist">'+SUBS.map(function(s){return '<button type="button" data-bv="'+s[0]+'" class="'+(VIEW===s[0]?'active':'')+'">'+s[1]+'</button>'}).join('')+'</div></div>'+top+rest;
  }
  body.innerHTML=html;
  $$('.t872-seg button[data-bv]',body).forEach(function(b){b.onclick=function(){VIEW=b.dataset.bv;render()}});
  $$('[data-open]',body).forEach(function(b){b.onclick=function(){var s=$('#view-operationaltwin #tSite');if(s){s.value=b.dataset.open;window.AIP_TWIN_SITE=b.dataset.open;s.dispatchEvent(new Event('change',{bubbles:true}))}setTimeout(render,120)}});
  var hr=$('#t873Hour',body);if(hr)hr.oninput=function(){HOUR=+hr.value;var sc=body.scrollTop;render();var h2=$('#t873Hour');if(h2)h2.focus()};
  return true;
}
function isActive(){var b=$('#view-operationaltwin #tLayers .xi-tab.t873-tab');return !!(b&&b.classList.contains('active'))}
function activate(){
  var v=$('#view-operationaltwin');if(!v)return;
  $$('#tLayers .xi-tab',v).forEach(function(x){x.classList.remove('active')});var b=$('#tLayers .t873-tab',v);if(b)b.classList.add('active');
  window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};window.AIP_V21.state.layer='BESS';render();
}
function ensureTab(){
  var v=$('#view-operationaltwin'),t=v&&$('#tLayers',v);if(!t)return;
  var b=$('.t873-tab',t);
  if(!b){b=document.createElement('button');b.type='button';b.className='xi-tab t873-tab';b.textContent='BESS';t.appendChild(b)}
  b.onclick=function(e){if(e)e.preventDefault();activate()};
  if(window.AIP_V21&&window.AIP_V21.state&&window.AIP_V21.state.layer==='BESS'&&!isActive())activate();
  else if(isActive())render();else v.classList.remove('t873-bess-active');
}
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('#view-operationaltwin #tLayers .xi-tab');if(t&&!t.classList.contains('t873-tab')&&!t.classList.contains('t875-cr-tab')){var v=$('#view-operationaltwin');if(v)v.classList.remove('t873-bess-active')}},true);
document.addEventListener('change',function(e){if(e.target&&e.target.matches&&e.target.matches('#view-operationaltwin #tSite')&&isActive()){setTimeout(function(){activate()},60);setTimeout(function(){if(isActive())render()},260)}},false);
document.addEventListener('aip:data-source-changed',function(){CACHE={};setTimeout(ensureTab,400)});
function hook(){var Rr=window.AIP_V21&&window.AIP_V21.renderers;if(!Rr||typeof Rr.operationaltwin!=='function')return setTimeout(hook,100);var prior=Rr.operationaltwin;if(prior.__v873)return;
  var w=function(){var out=prior.apply(this,arguments);setTimeout(ensureTab,0);setTimeout(ensureTab,200);return out};w.__v873=true;Rr.operationaltwin=w;if($('#view-operationaltwin.active'))setTimeout(ensureTab,200)}
hook();
window.AIP_BESS873={version:B.version,render:render,model:function(id){return modelFor(id||pid())},activate:activate,
  audit:{release:'v873',scope:'Operational Twin › BESS tab',engine:'AIPBessPhysics '+B.version,embeddedDataInCode:false}};

})();

