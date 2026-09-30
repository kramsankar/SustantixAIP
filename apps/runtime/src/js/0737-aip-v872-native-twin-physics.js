
/* AIP v887 · Native Operational Twin physics engine (pure functions, no data embedded).
   Inputs: governed engineering parameters + measured interval telemetry from the active AIP data source.
   Outputs: clear-sky reference, sequential loss states, reconciled loss bridge, physics trace, checks.
   v887 upgrades (each switches on only when its governed parameter is present; otherwise the v872 model is used and the trace says so):
     · Ineichen–Perez clear sky (Linke turbidity by month + site elevation) instead of Haurwitz
     · Perez 1990 anisotropic sky transposition instead of isotropic
     · reflection (IAM) loss on measured irradiance, bifacial rear-side gain, low-irradiance efficiency
     · cell temperature from back-of-module sensor (+ΔT·E/1000); Faiman model when no module sensor
     · inverter thermal derating inside the clipping step
     · sun position at the interval midpoint when telemetry is stamped at interval start */
(function(root){
'use strict';
var D2R=Math.PI/180,R2D=180/Math.PI;
function num(v,d){if(v===null||v===undefined||(typeof v==='string'&&v.trim()===''))return d;var x=Number(v);return Number.isFinite(x)?x:d;}
function clamp(x,a,b){return x<a?a:x>b?b:x;}

/* ---------- Solar geometry: NOAA general solar position (Spencer/NOAA Fourier series) ---------- */
function dayOfYear(y,m,d){var t=Date.UTC(y,m-1,d),s=Date.UTC(y,0,1);return Math.round((t-s)/864e5)+1;}
function solarPosition(doy,minuteOfDay,lat,lon,tz,daysInYear){
  var N=daysInYear||365,hr=minuteOfDay/60,g=2*Math.PI/N*(doy-1+(hr-12)/24);
  var eqt=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  var decl=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  var tst=minuteOfDay+eqt+4*lon-60*tz,ha=(tst/4-180)*D2R,la=lat*D2R;
  var cz=clamp(Math.sin(la)*Math.sin(decl)+Math.cos(la)*Math.cos(decl)*Math.cos(ha),-1,1),zen=Math.acos(cz);
  var az=(Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(la)-Math.tan(decl)*Math.cos(la))*R2D+540)%360;
  return {zenith:zen*R2D,elevation:90-zen*R2D,azimuth:az,cosZ:cz,declination:decl*R2D,eqTimeMin:eqt,hourAngle:ha*R2D,solarNoonMin:720-4*lon-eqt+60*tz};
}
function sunriseSunset(doy,lat,lon,tz){
  var p=solarPosition(doy,720,lat,lon,tz),decl=p.declination*D2R,la=lat*D2R;
  var c=(Math.cos(90.833*D2R)-Math.sin(la)*Math.sin(decl))/(Math.cos(la)*Math.cos(decl));
  if(c>1||c<-1)return null;var H=Math.acos(c)*R2D;
  return {sunriseMin:p.solarNoonMin-4*H,sunsetMin:p.solarNoonMin+4*H,solarNoonMin:p.solarNoonMin,dayLengthMin:8*H};
}
/* ---------- Irradiance ---------- */
function extraterrestrial(doy){var b=2*Math.PI*(doy-1)/365;return 1367*(1.00011+0.034221*Math.cos(b)+0.00128*Math.sin(b)+0.000719*Math.cos(2*b)+0.000077*Math.sin(2*b));} // Spencer (1971)
function airmassRelative(zenDeg){return zenDeg<90?1/(Math.cos(zenDeg*D2R)+0.50572*Math.pow(96.07995-zenDeg,-1.6364)):NaN;} // Kasten & Young (1989)
function pressureFromAltitude(alt){return 100*Math.pow((44331.514-alt)/11880.516,1/0.1902632);}
function haurwitzGHI(cosZ){return cosZ>0.01?1098*cosZ*Math.exp(-0.059/cosZ):0;}
/* Ineichen & Perez (2002) clear sky, as implemented in pvlib (no Perez enhancement) */
function ineichen(sun,doy,tl,alt){
  if(sun.elevation<=0)return {ghi:0,dni:0,dhi:0};
  var cz=sun.cosZ,i0=extraterrestrial(doy),am=airmassRelative(sun.zenith)*pressureFromAltitude(alt)/101325;
  var fh1=Math.exp(-alt/8000),fh2=Math.exp(-alt/1250),cg1=5.09e-5*alt+0.868,cg2=3.92e-5*alt+0.0387;
  var ghi=cg1*i0*cz*Math.max(0,Math.exp(-cg2*am*(fh1+fh2*(tl-1))));
  var b=0.664+0.163/fh1,bnci=i0*Math.max(0,b*Math.exp(-0.09*am*(tl-1)));
  var bnci2=ghi*clamp((1-(0.1-0.2*Math.exp(-tl))/(0.1+0.882/fh1))/Math.max(cz,1e-6),0,1e20);
  var dni=Math.min(bnci,bnci2);return {ghi:ghi,dni:dni,dhi:Math.max(0,ghi-dni*cz)};
}
function erbs(ghi,cosZ,doy){
  if(ghi<=0||cosZ<=0.02)return {dni:0,dhi:Math.max(0,ghi),kt:0,kd:1};
  var kt=clamp(ghi/(extraterrestrial(doy)*cosZ),0,1),kd;
  if(kt<=0.22)kd=1-0.09*kt;else if(kt<=0.8)kd=0.9511-0.1604*kt+4.388*kt*kt-16.638*Math.pow(kt,3)+12.336*Math.pow(kt,4);else kd=0.165;
  var dhi=kd*ghi;return {dni:Math.max(0,(ghi-dhi)/cosZ),dhi:dhi,kt:kt,kd:kd};
}
function incidence(sun,tilt,azimuth){
  var zr=sun.zenith*D2R,ar=sun.azimuth*D2R,b=tilt*D2R,pa=azimuth*D2R;
  var sx=Math.sin(zr)*Math.sin(ar),sy=Math.sin(zr)*Math.cos(ar),sz=Math.cos(zr);
  var nx=Math.sin(b)*Math.sin(pa),ny=Math.sin(b)*Math.cos(pa),nz=Math.cos(b);
  var ci=nx*sx+ny*sy+nz*sz;return {cosAOI:ci,aoi:Math.acos(clamp(ci,-1,1))*R2D};
}
function ashraeIAM(cosAOI,b0){return cosAOI>0?clamp(1-(b0==null?0.05:b0)*(1/Math.max(cosAOI,0.05)-1),0,1):0;}
/* Isotropic-sky transposition with ASHRAE incidence-angle modifier (b0 = 0.05) and ground albedo — v872 model, kept as fallback */
function transposeIsotropic(ghi,dni,dhi,sun,tilt,azimuth,albedo){
  var inc=incidence(sun,tilt,azimuth),ci=Math.max(0,inc.cosAOI),b=tilt*D2R;
  var iam=ashraeIAM(ci,0.05);
  var beam=dni*ci*iam,sky=dhi*(1+Math.cos(b))/2,gnd=ghi*(albedo==null?0.2:albedo)*(1-Math.cos(b))/2;
  return {poa:Math.max(0,beam+sky+gnd),beam:beam,sky:sky,ground:gnd,iam:iam,aoi:inc.aoi};
}
/* Perez et al. (1990) anisotropic sky, "allsitescomposite1990" coefficients */
var PEREZ_EPS=[1.065,1.23,1.5,1.95,2.8,4.5,6.2];
var PEREZ_F1=[[-0.008,0.588,-0.062],[0.130,0.683,-0.151],[0.330,0.487,-0.221],[0.568,0.187,-0.295],[0.873,-0.392,-0.362],[1.132,-1.237,-0.412],[1.060,-1.600,-0.359],[0.678,-0.327,-0.250]];
var PEREZ_F2=[[-0.060,0.072,-0.022],[-0.019,0.066,-0.029],[0.055,-0.064,-0.026],[0.109,-0.152,-0.014],[0.226,-0.462,0.001],[0.288,-0.823,0.056],[0.264,-1.127,0.131],[0.156,-1.377,0.251]];
function perezSky(tilt,cosAOI,dhi,dni,sun,doy){
  if(!(dhi>0)||sun.elevation<=0)return {sky:0,F1:0,F2:0,eps:1,bin:0};
  var z=sun.zenith*D2R,k=1.041*z*z*z,eps=((dhi+dni)/dhi+k)/(1+k),bin=0;while(bin<PEREZ_EPS.length&&eps>=PEREZ_EPS[bin])bin++;
  var am=airmassRelative(sun.zenith),delta=dhi*(Number.isFinite(am)?am:0)/extraterrestrial(doy);
  var F1=Math.max(0,PEREZ_F1[bin][0]+PEREZ_F1[bin][1]*delta+PEREZ_F1[bin][2]*z),F2=PEREZ_F2[bin][0]+PEREZ_F2[bin][1]*delta+PEREZ_F2[bin][2]*z;
  var A=Math.max(0,cosAOI),B=Math.max(Math.cos(85*D2R),Math.cos(z)),b=tilt*D2R;
  return {sky:Math.max(0,dhi*((1-F1)*(1+Math.cos(b))/2+F1*A/B+F2*Math.sin(b))),F1:F1,F2:F2,eps:eps,bin:bin+1};
}
/* Plane-of-array components (no reflection loss): what a pyranometer mounted in the array plane measures */
function transposePerez(ghi,dni,dhi,sun,doy,tilt,azimuth,albedo,b0){
  var inc=incidence(sun,tilt,azimuth),ci=Math.max(0,inc.cosAOI),b=tilt*D2R;
  var beam=dni*ci,p=perezSky(tilt,inc.cosAOI,dhi,dni,sun,doy),gnd=ghi*(albedo==null?0.2:albedo)*(1-Math.cos(b))/2;
  var iam=ashraeIAM(ci,b0);
  return {poa:Math.max(0,beam+p.sky+gnd),beam:beam,sky:p.sky,ground:gnd,iam:iam,aoi:inc.aoi,cosAOI:inc.cosAOI,perez:p};
}
function linkeFor(P,month){var a=P.tlMonthly;return a&&a.length===12&&Number.isFinite(a[month-1])?a[month-1]:NaN;}
function clearSkyPOA(sun,doy,tilt,azimuth,albedo,P,month){
  if(sun.elevation<=0)return {ghi:0,dni:0,dhi:0,poa:0,poaEff:0,beam:0,iam:0,aoi:90,model:'night'};
  var tl=P?linkeFor(P,month):NaN;
  if(P&&Number.isFinite(tl)&&Number.isFinite(P.elev)){
    var c=ineichen(sun,doy,tl,P.elev),t=transposePerez(c.ghi,c.dni,c.dhi,sun,doy,tilt,azimuth,albedo,P.iamB0);
    var eff=t.beam*t.iam+t.sky*P.iamDiffuse+t.ground*P.iamGround;
    return {ghi:c.ghi,dni:c.dni,dhi:c.dhi,poa:t.poa,poaEff:eff,beam:t.beam,sky:t.sky,ground:t.ground,iam:t.iam,aoi:t.aoi,tl:tl,model:'Ineichen–Perez'};
  }
  var ghi=haurwitzGHI(sun.cosZ),d=erbs(ghi,sun.cosZ,doy),ti=transposeIsotropic(ghi,d.dni,d.dhi,sun,tilt,azimuth,albedo);
  return {ghi:ghi,dni:d.dni,dhi:d.dhi,poa:ti.poa,poaEff:ti.poa,beam:ti.beam,sky:ti.sky,ground:ti.ground,iam:ti.iam,aoi:ti.aoi,model:'Haurwitz–isotropic (basic model)'};
}
/* Horizontal single-axis tracker (true tracking + optional backtracking, Lorenzo/pvlib formulation) */
function trackerOrientation(sun,axisAz,maxAngle,gcr,backtrack){
  if(sun.elevation<=0)return {rotation:0,tilt:0,azimuth:axisAz+90};
  var zr=sun.zenith*D2R,ar=sun.azimuth*D2R,A=axisAz*D2R;
  var sx=Math.sin(zr)*Math.sin(ar),sy=Math.sin(zr)*Math.cos(ar),sz=Math.cos(zr);
  var px=Math.cos(A),py=-Math.sin(A);                 // horizontal direction perpendicular to the axis
  var sp=sx*px+sy*py,R=Math.atan2(sp,sz)*R2D;         // ideal rotation (normal in the sun's plane)
  if(backtrack&&gcr>0){var t=Math.cos(R*D2R)/gcr;if(t<1)R=R-(R>=0?1:-1)*Math.acos(clamp(t,-1,1))*R2D;}
  R=clamp(R,-maxAngle,maxAngle);
  var az=Math.atan2(px,py)*R2D;if(R<0)az+=180;az=(az+360)%360;
  return {rotation:R,tilt:Math.abs(R),azimuth:az};
}
/* ---------- Bifacial rear irradiance: 2-D row geometry (ground shadow fraction from GCR and sun angle), view factors ---------- */
function rearIrradiance(P,sun,orient,ghi,dni,dhi,cosAOI){
  if(!(P.bifaciality>0)||sun.elevation<=0)return 0;
  var b=orient.tilt*D2R,cz=Math.max(sun.cosZ,0.05);
  var shadow=clamp(P.gcr*Math.max(0,cosAOI)/cz,0,1);               // fraction of ground in row shadow
  var groundIrr=dni*Math.max(0,sun.cosZ)*(1-shadow)+dhi*(1-P.gcr);    // beam outside shadows + diffuse reduced by rows
  var vfGround=(1+Math.cos(b))/2,vfSky=(1-Math.cos(b))/2;
  return Math.max(0,P.albedo*groundIrr*vfGround+dhi*vfSky);
}
/* ---------- Temperature ---------- */
function nOCTCellTemp(ta,poa,noct,ws){return ta+poa/800*(noct-20)*(9.5/(5.7+3.8*0.51*Math.max(0,ws)));}
function faimanTemp(ta,poa,ws,u0,u1){return ta+poa/(u0+u1*Math.max(0,ws));}
/* ---------- Low irradiance: log-linear relative efficiency through a governed loss at 200 W/m² ---------- */
function lowLightFactor(g,l200){if(!(l200>0)||!(g>0))return 1;if(g>=1000)return 1;return clamp(1-l200*Math.log(1000/Math.max(g,5))/Math.log(5),0.5,1);}
/* ---------- Inverter: PVWatts part-load efficiency curve (Dobos 2014), eta_ref = 0.9637 ---------- */
function inverterEfficiency(pdc,pdc0inv,etaNom){
  if(!(pdc>0)||!(pdc0inv>0))return 0;var z=pdc/pdc0inv;if(z<0.001)return 0;
  return clamp(etaNom/0.9637*(-0.0162*z-0.0059/z+0.9858),0,1);
}
function derateFactor(P,ta){
  if(!Number.isFinite(P.derateStart)||!Number.isFinite(P.derateSlope)||!Number.isFinite(ta)||ta<=P.derateStart)return 1;
  return clamp(1-P.derateSlope/100*(ta-P.derateStart),Number.isFinite(P.derateFloor)?P.derateFloor:0.8,1);
}

/* ---------- Parameters (from governed sheets; never embedded) ---------- */
function parseList(v){if(Array.isArray(v))return v.map(Number);var a=String(v==null?'':v).split(/[;,|\s]+/).filter(function(x){return x!==''}).map(Number);return a.length===12&&a.every(Number.isFinite)?a:null;}
function plantParams(p,site,asOfYear){
  var ac=num(p.AC_Capacity_MW,NaN),dcac=num(p.DC_AC_Ratio,NaN);
  var commission=num(site&&site.Commission_Year,NaN);
  var age=Number.isFinite(commission)&&Number.isFinite(asOfYear)?Math.max(0,asOfYear-commission):NaN;
  var conv=String(p.Telemetry_Timestamp_Convention||'');
  return {
    plantId:String(p.Plant_ID||''),plantName:String(p.Plant_Name||p.Plant_ID||''),
    acMW:ac,dcac:dcac,pdc0:ac*dcac,gamma:num(p.Module_Temp_Coeff_PctPerC,NaN)/100,noct:num(p.NOCT_C,NaN),
    dcLoss:num(p.Base_DC_Loss_Pct,NaN)/100,acLoss:num(p.Base_AC_Loss_Pct,NaN)/100,
    invEff:num(p.Inverter_Efficiency_Pct,NaN)/100,xfmrEff:num(p.Transformer_Efficiency_Pct,NaN)/100,
    degrRate:num(p.Annual_Degradation_Pct,NaN)/100,commissionYear:commission,ageYears:age,
    degrFactor:Number.isFinite(age)?Math.pow(1-num(p.Annual_Degradation_Pct,0)/100,age):1,
    ageSource:Number.isFinite(age)?'Sites.Commission_Year':'not available — degradation not applied',
    lat:num(p.Latitude_Deg,NaN),lon:num(p.Longitude_Deg,NaN),tilt:num(p.Array_Tilt_Deg,NaN),azimuth:num(p.Array_Azimuth_Deg,180),
    tz:5.5,albedo:num(p.Albedo,0.2),albedoSource:Number.isFinite(num(p.Albedo,NaN))?'governed':'0.20 default (basic model)',modelVersion:String(p.Model_Version||''),
    mounting:/tracker/i.test(String(p.Mounting_Type||''))?'tracker':'fixed',axisAz:num(p.Tracker_Axis_Azimuth_Deg,180),maxAngle:num(p.Tracker_Max_Angle_Deg,55),
    gcr:num(p.Tracker_GCR,0.35),backtrack:!/^no/i.test(String(p.Backtracking||'Yes')),
    /* v887 */
    elev:num(p.Site_Elevation_m,NaN),tlMonthly:parseList(p.Linke_Turbidity_Monthly),
    iamB0:num(p.IAM_b0,NaN),iamDiffuse:num(p.IAM_Diffuse_Factor,0.95),iamGround:num(p.IAM_Ground_Factor,0.90),
    bifaciality:num(p.Bifaciality_Pct,0)/100,rearLoss:num(p.Rear_Shading_Mismatch_Pct,0)/100,moduleTech:String(p.Module_Technology||''),
    lowLight200:num(p.Low_Irradiance_Loss_Pct_at_200Wm2,NaN)/100,
    cellDeltaT:num(p.Cell_Back_DeltaT_C,NaN),u0:num(p.Faiman_U0,NaN),u1:num(p.Faiman_U1,NaN),
    derateStart:num(p.Inverter_Derate_Ambient_Start_C,NaN),derateSlope:num(p.Inverter_Derate_Pct_per_C,NaN),derateFloor:num(p.Inverter_Derate_Limit_Pct,NaN)/100,
    tsShiftMin:/start/i.test(conv)?num(p.Telemetry_Interval_Min,15)/2:/end/i.test(conv)?-num(p.Telemetry_Interval_Min,15)/2:0,tsConvention:conv||'instantaneous (not governed)'
  };
}
function missingParams(P){
  var req=['acMW','dcac','gamma','noct','dcLoss','acLoss','invEff','xfmrEff','degrRate','lat','lon'].concat(P.mounting==='tracker'?[]:['tilt']);
  return req.filter(function(k){return !Number.isFinite(P[k]);});
}
/* which v887 refinements are active for this plant (drives trace text and self-checks) */
function features(P){
  return {clearSky:Number.isFinite(P.elev)&&!!P.tlMonthly,iam:Number.isFinite(P.iamB0),bifacial:P.bifaciality>0,lowLight:P.lowLight200>0,
    cellDT:Number.isFinite(P.cellDeltaT),faiman:Number.isFinite(P.u0)&&Number.isFinite(P.u1),derate:Number.isFinite(P.derateStart)&&Number.isFinite(P.derateSlope),midpoint:P.tsShiftMin!==0};
}
function parseStamp(ts){var m=String(ts||'').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);if(!m)return null;
  return {y:+m[1],mo:+m[2],d:+m[3],minute:+m[4]*60+ +m[5],date:m[1]+'-'+m[2]+'-'+m[3],hour:+m[4]+ +m[5]/60};}

var CATEGORIES=[
  {key:'weather',label:'Weather / resource',recoverable:'No',note:'Clear-sky POA → measured POA'},
  {key:'iam',label:'Reflection (IAM)',recoverable:'No',note:'Beam reflection at the glass (ASHRAE b₀); diffuse and ground factors'},
  {key:'bifacial',label:'Bifacial rear-side gain',recoverable:'No',note:'Rear irradiance × bifaciality × (1 − rear shading/mismatch)'},
  {key:'lowlight',label:'Low-irradiance efficiency',recoverable:'No',note:'Module efficiency drop below 1,000 W/m²'},
  {key:'temperature',label:'Module temperature',recoverable:'No',note:'Temperature coefficient × (T_cell − 25 °C)'},
  {key:'soiling',label:'Soiling',recoverable:'Yes',note:'Measured soiling ratio'},
  {key:'dcdesign',label:'DC design losses',recoverable:'No',note:'Mismatch, wiring, shading (governed DC loss)'},
  {key:'degradation',label:'Module degradation',recoverable:'No',note:'(1 − annual rate)^age'},
  {key:'conversion',label:'Inverter conversion',recoverable:'No',note:'PVWatts part-load efficiency curve'},
  {key:'clipping',label:'Inverter clipping & derate',recoverable:'No',note:'AC rating limit, reduced by thermal derating in hot ambient'},
  {key:'acxfmr',label:'AC wiring & transformer',recoverable:'No',note:'Governed AC loss × transformer efficiency'},
  {key:'availability',label:'Availability / outages',recoverable:'Yes',note:'Measured plant availability'},
  {key:'curtailment',label:'Curtailment',recoverable:'Compensable',note:'Measured POI curtailment'},
  {key:'residual',label:'Residual (unexplained)',recoverable:'Investigate',note:'Modelled delivery − measured delivery'}
];

/* ---------- One interval: sequential counterfactual states (MW) ---------- */
function interval(P,r){
  var t=parseStamp(r.Timestamp);if(!t)return null;
  var F=features(P),doy=dayOfYear(t.y,t.mo,t.d),sun=solarPosition(doy,t.minute+P.tsShiftMin,P.lat,P.lon,P.tz);
  var orient=P.mounting==='tracker'?trackerOrientation(sun,P.axisAz,P.maxAngle,P.gcr,P.backtrack):{rotation:null,tilt:P.tilt,azimuth:P.azimuth};
  var cs=clearSkyPOA(sun,doy,orient.tilt,orient.azimuth,P.albedo,P,t.mo);
  var poa=Math.max(0,num(r.POA_Wm2,0)),tm=num(r.Module_Temp_C,NaN),ta=num(r.Ambient_Temp_C,NaN),ws=num(r.Wind_Speed_ms,0);
  var ghiM=num(r.GHI_Wm2,NaN),kt=cs.poa>0?poa/cs.poa:0;
  /* beam / diffuse composition of the measured plane: from measured GHI (Erbs split + Perez) when available, else clear-sky shares scaled by the clear-sky index */
  var ghiUsed=Number.isFinite(ghiM)&&ghiM>=0?ghiM:cs.ghi*clamp(kt,0,1.2),split=erbs(ghiUsed,sun.cosZ,doy),inc=incidence(sun,orient.tilt,orient.azimuth);
  var mod=F.clearSky?transposePerez(ghiUsed,split.dni,split.dhi,sun,doy,orient.tilt,orient.azimuth,P.albedo,P.iamB0):null;
  var beamShare=mod&&mod.poa>0?clamp(mod.beam/mod.poa,0,1):(cs.poa>0?clamp(cs.beam/cs.poa,0,1)*clamp((kt-0.25)/0.7,0,1):0);
  var groundShare=mod&&mod.poa>0?clamp(mod.ground/mod.poa,0,1-beamShare):0,skyShare=Math.max(0,1-beamShare-groundShare);
  var iamBeam=ashraeIAM(Math.max(0,inc.cosAOI),F.iam?P.iamB0:0.05);
  var iamF=F.iam?beamShare*iamBeam+skyShare*P.iamDiffuse+groundShare*P.iamGround:1;
  var rear=F.bifacial?rearIrradiance(P,sun,orient,ghiUsed,split.dni,split.dhi,inc.cosAOI):0;
  var rearEff=rear*P.bifaciality*(1-P.rearLoss);
  var gFront=poa*iamF,gEff=gFront+rearEff,ll=F.lowLight?lowLightFactor(gEff,P.lowLight200):1;
  var tNoct=Number.isFinite(ta)?nOCTCellTemp(ta,poa,P.noct,ws):NaN,tFaiman=F.faiman&&Number.isFinite(ta)?faimanTemp(ta,gEff,ws,P.u0,P.u1):NaN;
  var tUsed,tSource;
  if(Number.isFinite(tm)){tUsed=F.cellDT?tm+P.cellDeltaT*gEff/1000:tm;tSource=F.cellDT?'back-of-module sensor + ΔT·E/1000':'measured module temperature';}
  else if(Number.isFinite(tFaiman)){tUsed=tFaiman;tSource='Faiman model';}
  else if(Number.isFinite(tNoct)){tUsed=tNoct;tSource='NOCT model';}
  else{tUsed=25;tSource='no temperature data — 25 °C';}
  var sr=clamp(num(r.Soiling_Ratio,1),0,1),avail=clamp(num(r.Availability_Pct,100),0,100)/100,curt=clamp(num(r.Curtailment_Pct,0),0,100)/100;
  var actual=Math.max(0,num(r.Actual_AC_MW,0));
  var pdc0inv=P.acMW/P.invEff,dr=derateFactor(P,ta),acLimit=P.acMW*dr;
  var S={};
  S.s0=P.pdc0*cs.poa/1000;                                   // reference potential: DC nameplate × clear-sky plane irradiance, 25 °C, clean, no losses
  S.s1=P.pdc0*poa/1000;                                      // measured plane irradiance
  S.s1a=S.s1*iamF;                                           // reflection
  S.s1b=S.s1a+P.pdc0*rearEff/1000;                           // + bifacial rear side
  S.s1c=S.s1b*ll;                                            // low-irradiance efficiency
  var tf=1+P.gamma*(tUsed-25);S.s2=S.s1c*tf;                  // temperature
  S.s3=S.s2*sr;                                              // soiling
  S.s4=S.s3*(1-P.dcLoss);                                    // DC design losses
  S.s5=S.s4*P.degrFactor;                                    // degradation
  var eta=inverterEfficiency(S.s5,pdc0inv,P.invEff);S.s6=S.s5*eta; // inverter conversion
  S.s7=Math.min(S.s6,acLimit);                               // clipping at (derated) AC rating
  S.s8=S.s7*(1-P.acLoss)*P.xfmrEff;                          // expected at POI, full availability, no curtailment
  S.s9=S.s8*avail;                                           // availability
  S.s10=S.s9*(1-curt);                                       // curtailment → modelled delivery
  var L={weather:S.s0-S.s1,iam:S.s1-S.s1a,bifacial:S.s1a-S.s1b,lowlight:S.s1b-S.s1c,temperature:S.s1c-S.s2,soiling:S.s2-S.s3,dcdesign:S.s3-S.s4,degradation:S.s4-S.s5,conversion:S.s5-S.s6,
         clipping:S.s6-S.s7,acxfmr:S.s7-S.s8,availability:S.s8-S.s9,curtailment:S.s9-S.s10,residual:S.s10-actual};
  // clear-sky expected at POI (same plant state, clear-sky irradiance) for weather-impact display on AC basis
  var csRear=F.bifacial?rearIrradiance(P,sun,orient,cs.ghi,cs.dni,cs.dhi,inc.cosAOI)*P.bifaciality*(1-P.rearLoss):0;
  var csG=(F.iam?cs.poaEff:cs.poa)+csRear,csLL=F.lowLight?lowLightFactor(csG,P.lowLight200):1;
  var csT=Number.isFinite(tm)&&F.cellDT?tm+P.cellDeltaT*gEff/1000:tUsed,csTf=1+P.gamma*(csT-25);
  var csDC=P.pdc0*csG/1000*csLL*csTf*sr*(1-P.dcLoss)*P.degrFactor,csEta=inverterEfficiency(csDC,pdc0inv,P.invEff);
  var csPOI=Math.min(csDC*csEta,acLimit)*(1-P.acLoss)*P.xfmrEff;
  var sumL=0;for(var k in L)sumL+=L[k];
  return {t:t,doy:doy,sun:sun,orient:orient,clearSky:cs,poa:poa,ghi:ghiM,ta:ta,ws:ws,tModule:tm,tNoct:tNoct,tFaiman:tFaiman,tUsed:tUsed,tSource:tSource,tempFactor:tf,
    iamFactor:iamF,iamBeam:iamBeam,beamShare:beamShare,aoi:inc.aoi,rear:rear,rearEff:rearEff,lowLight:ll,gEff:gEff,derate:dr,acLimit:acLimit,features:F,
    soilingRatio:sr,availability:avail,curtailment:curt,eta:eta,pdc0inv:pdc0inv,states:S,loss:L,actual:actual,
    expectedPOI:S.s8,modelledDelivery:S.s10,clearSkyPOI:csPOI,weatherImpactAC:Math.max(0,csPOI-S.s8),operationalGap:S.s8-actual,
    pr:S.s1>0?actual/S.s1:NaN,reconError:(S.s0-actual)-sumL,raw:r};
}
function day(P,rows,stepHours){
  var dt=stepHours||0.25,out=rows.map(function(r){return interval(P,r);}).filter(Boolean).sort(function(a,b){return a.t.minute-b.t.minute;});
  var tot={s0:0,s1:0,s8:0,s10:0,actual:0,loss:{}};CATEGORIES.forEach(function(c){tot.loss[c.key]=0;});
  out.forEach(function(x){tot.s0+=x.states.s0*dt;tot.s1+=x.states.s1*dt;tot.s8+=x.states.s8*dt;tot.s10+=x.states.s10*dt;tot.actual+=x.actual*dt;CATEGORIES.forEach(function(c){tot.loss[c.key]+=x.loss[c.key]*dt;});});
  return {intervals:out,dt:dt,totals:tot};
}
function cumulative(D,uptoIdx){
  var dt=D.dt,t={s0:0,s8:0,s10:0,actual:0,clearPOI:0,loss:{}};CATEGORIES.forEach(function(c){t.loss[c.key]=0;});
  for(var i=0;i<=uptoIdx&&i<D.intervals.length;i++){var x=D.intervals[i];t.s0+=x.states.s0*dt;t.s8+=x.states.s8*dt;t.s10+=x.states.s10*dt;t.actual+=x.actual*dt;t.clearPOI+=x.clearSkyPOI*dt;
    CATEGORIES.forEach(function(c){t.loss[c.key]+=x.loss[c.key]*dt;});}
  var sum=0;CATEGORIES.forEach(function(c){sum+=t.loss[c.key];});t.totalLoss=sum;t.reconError=(t.s0-t.actual)-sum;return t;
}
/* ---------- Multi-day back-test: the same engine over every observed day, compared with the meter ---------- */
function backtest(P,rows,stepHours){
  var by={};rows.forEach(function(r){var t=parseStamp(r.Timestamp);if(t)(by[t.date]=by[t.date]||[]).push(r)});
  var days=Object.keys(by).sort().map(function(d){
    var D=day(P,by[d],stepHours),T=D.totals,ae=0,n=0,sq=0;
    D.intervals.forEach(function(x){if(x.states.s1>0||x.actual>0){var e=x.states.s10-x.actual;ae+=Math.abs(e);sq+=e*e;n++}});
    var csPOA=0,poa=0;D.intervals.forEach(function(x){csPOA+=x.clearSky.poa;poa+=x.poa});
    return {date:d,n:n,expected:T.s8,modelled:T.s10,actual:T.actual,residual:T.loss.residual,residualPct:T.s10>0?T.loss.residual/T.s10*100:0,
      nMAE:n?ae/n/P.acMW*100:NaN,rmse:n?Math.sqrt(sq/n):NaN,kc:csPOA>0?poa/csPOA:NaN,avail:T.loss.availability,curt:T.loss.curtailment,soil:T.loss.soiling,
      pr:T.s1>0?T.actual/T.s1*100:NaN,D:D};
  });
  var agg={n:0,ae:0,mod:0,act:0};days.forEach(function(d){agg.n+=d.n;agg.ae+=d.nMAE*d.n;agg.mod+=d.modelled;agg.act+=d.actual});
  return {days:days,nMAE:agg.n?agg.ae/agg.n:NaN,energyBiasPct:agg.act>0?(agg.mod-agg.act)/agg.act*100:NaN,modelled:agg.mod,actual:agg.act};
}
/* ---------- Scenario: same plant state, changed operating assumptions ---------- */
function scenarioInterval(P,r,d){
  d=d||{};var q=Object.assign({},r),poa0=Math.max(0,num(r.POA_Wm2,0)),c=num(d.cloudPct,0),poa1=poa0*(1-c/100);
  if(c<0){var ref=interval(P,r);var cap=Math.max(poa0,ref?ref.clearSky.poa:poa0);poa1=Math.min(poa1,cap);} // less cloud can only recover up to clear-sky
  q.POA_Wm2=Math.max(0,poa1);
  if(Number.isFinite(num(r.GHI_Wm2,NaN))&&poa0>0)q.GHI_Wm2=num(r.GHI_Wm2,0)*q.POA_Wm2/poa0;
  if(Number.isFinite(num(r.Module_Temp_C,NaN)))q.Module_Temp_C=num(r.Module_Temp_C,25)+num(d.tempC,0);
  q.Ambient_Temp_C=num(r.Ambient_Temp_C,25)+num(d.tempC,0);
  var sr=clamp(num(r.Soiling_Ratio,1)-num(d.soilingPct,0)/100,0,1);if(d.clean)sr=1;q.Soiling_Ratio=sr;
  var av=clamp(num(r.Availability_Pct,100)+num(d.availabilityPct,0),0,100);if(d.restoreAvailability)av=100;q.Availability_Pct=av;
  var cu=clamp(num(r.Curtailment_Pct,0)+num(d.curtailPct,0),0,100);if(d.releaseCurtailment)cu=0;q.Curtailment_Pct=cu;
  return interval(P,q);
}
/* ---------- Engineering self-checks (analytic identities and invariants) ---------- */
function selfChecks(P,D){
  var res=[],push=function(name,pass,detail,kind){res.push({name:name,pass:!!pass,detail:detail,kind:kind||'Invariant'});};
  var ivs=D.intervals,first=ivs[0],F=features(P);
  if(first){
    var doy=first.doy,sn=solarPosition(doy,0,P.lat,P.lon,P.tz).solarNoonMin,noon=solarPosition(doy,sn,P.lat,P.lon,P.tz);
    var ident=90-Math.abs(P.lat-noon.declination);
    push('Solar-noon elevation identity',Math.abs(noon.elevation-ident)<0.1,'Computed '+noon.elevation.toFixed(2)+'° vs 90 − |φ − δ| = '+ident.toFixed(2)+'°','Solar geometry');
    var eq=solarPosition(dayOfYear(first.t.y,3,20),720,P.lat,P.lon,P.tz).declination,ss=solarPosition(dayOfYear(first.t.y,6,21),720,P.lat,P.lon,P.tz).declination;
    push('Declination at equinox and solstice',Math.abs(eq)<0.6&&Math.abs(ss-23.44)<0.25,'20 Mar '+eq.toFixed(2)+'° (≈0°) · 21 Jun '+ss.toFixed(2)+'° (≈23.44°)','Solar geometry');
    var srs=sunriseSunset(doy,P.lat,P.lon,P.tz),m1=solarPosition(doy,sn-120,P.lat,P.lon,P.tz).elevation,m2=solarPosition(doy,sn+120,P.lat,P.lon,P.tz).elevation;
    push('Symmetry about solar noon',Math.abs(m1-m2)<0.3,'Elevation ±2 h: '+m1.toFixed(2)+'° / '+m2.toFixed(2)+'°','Solar geometry');
    if(srs)push('Day length plausible',srs.dayLengthMin>600&&srs.dayLengthMin<840,'Sunrise '+hhmm(srs.sunriseMin)+' · sunset '+hhmm(srs.sunsetMin)+' · '+(srs.dayLengthMin/60).toFixed(2)+' h','Solar geometry');
    if(F.clearSky){
      var tl=linkeFor(P,first.t.mo),c=ineichen(noon,doy,tl,P.elev),c1=ineichen(noon,doy,2,0),c2=ineichen(noon,doy,7,0);
      push('Clear-sky GHI at solar noon plausible',c.ghi>650&&c.ghi<1150&&c1.ghi>c2.ghi,'Ineichen GHI '+c.ghi.toFixed(0)+' W/m² (T_L '+tl.toFixed(1)+', '+P.elev.toFixed(0)+' m) · falls with turbidity: T_L 2 → '+c1.ghi.toFixed(0)+', T_L 7 → '+c2.ghi.toFixed(0)+' W/m²','Irradiance model');
      var hz=transposePerez(c.ghi,c.dni,c.dhi,noon,doy,0,180,P.albedo);
      push('Perez transposition: horizontal plane returns GHI',Math.abs(hz.poa-c.ghi)<1,'Tilt 0°: '+hz.poa.toFixed(1)+' vs GHI '+c.ghi.toFixed(1)+' W/m²','Irradiance model');
    }
  }
  var z0=interval(P,{Timestamp:'2026-06-21 12:00',POA_Wm2:0,Module_Temp_C:30,Actual_AC_MW:0}),zn=ivs.filter(function(x){return x.poa<=0;});
  push('Zero irradiance gives zero expected output',z0&&z0.states.s8===0&&zn.every(function(x){return x.states.s8===0||(x.rearEff>0);}),'Synthetic zero-POA interval'+(zn.length?' + '+zn.length+' measured zero-POA intervals':'')+' → 0 MW');
  var mx=ivs.reduce(function(m,x){return Math.max(m,x.states.s7);},0);
  push('Inverter output never exceeds AC rating',mx<=P.acMW+1e-9,'Max inverter AC '+mx.toFixed(2)+' MW ≤ '+P.acMW+' MW');
  var mono=true,tmp=true;[200,400,600,800,1000].forEach(function(g){var a=interval(P,{Timestamp:'2026-06-21 12:00',POA_Wm2:g,Module_Temp_C:40,Actual_AC_MW:0}),b=interval(P,{Timestamp:'2026-06-21 12:00',POA_Wm2:g+50,Module_Temp_C:40,Actual_AC_MW:0});if(b.states.s8+1e-9<a.states.s8)mono=false;
    var c=interval(P,{Timestamp:'2026-06-21 12:00',POA_Wm2:g,Module_Temp_C:55,Actual_AC_MW:0});if(P.gamma<0&&c.states.s2>a.states.s2)tmp=false;});
  push('Expected output rises with irradiance',mono,'Tested 200–1,050 W/m² at 40 °C');
  push('Higher module temperature lowers DC output',tmp,'γ = '+(P.gamma*100).toFixed(2)+' %/°C; tested 40 °C vs 55 °C');
  var created=0;ivs.forEach(function(x){var S=x.states,seq=[['s1',S.s1],['s1a',S.s1a],['s1b',S.s1b],['s1c',S.s1c],['s2',S.s2],['s3',S.s3],['s4',S.s4],['s5',S.s5],['s6',S.s6],['s7',S.s7],['s8',S.s8],['s9',S.s9],['s10',S.s10]];
    for(var i=1;i<seq.length;i++)if(seq[i][1]>seq[i-1][1]+1e-9&&seq[i][0]!=='s1b'&&!(seq[i][0]==='s2'&&P.gamma<0&&x.tUsed<25))created++;});
  push('No loss step creates energy',created===0,created?created+' step(s) increase output (module below 25 °C and bifacial gain are allowed)':'All steps after irradiance are non-increasing (bifacial gain is the only additive step)');
  if(F.bifacial){var bg=ivs.reduce(function(m,x){return Math.max(m,x.poa>100?x.rearEff/x.poa:0)},0);
    push('Bifacial gain bounded',bg>=0&&bg<=P.bifaciality*(P.albedo+0.3),'Max rear/front '+(bg*100).toFixed(1)+'% ≤ bifaciality × (albedo + diffuse share) '+(P.bifaciality*(P.albedo+0.3)*100).toFixed(0)+'%','Irradiance model');}
  var maxErr=ivs.reduce(function(m,x){return Math.max(m,Math.abs(x.reconError));},0);
  push('Loss bridge reconciles every interval',maxErr<1e-9,'Max |reference − actual − Σ losses| = '+maxErr.toExponential(1)+' MW','Reconciliation');
  var e=ivs.reduce(function(s,x){return s+x.actual;},0)*D.dt;
  push('MW integrates to MWh',Math.abs(e-D.totals.actual)<1e-9,'Σ MW × '+D.dt+' h = '+e.toFixed(2)+' MWh','Reconciliation');
  return res;
}
function hhmm(min){min=((Math.round(min)%1440)+1440)%1440;return String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');}

root.AIPTwinPhysics={version:'887.1',CATEGORIES:CATEGORIES,solarPosition:solarPosition,sunriseSunset:sunriseSunset,dayOfYear:dayOfYear,haurwitzGHI:haurwitzGHI,ineichen:ineichen,erbs:erbs,
  transposeIsotropic:transposeIsotropic,transposePerez:transposePerez,perezSky:perezSky,airmassRelative:airmassRelative,extraterrestrial:extraterrestrial,
  trackerOrientation:trackerOrientation,clearSkyPOA:clearSkyPOA,rearIrradiance:rearIrradiance,nOCTCellTemp:nOCTCellTemp,faimanTemp:faimanTemp,lowLightFactor:lowLightFactor,
  inverterEfficiency:inverterEfficiency,derateFactor:derateFactor,features:features,
  plantParams:plantParams,missingParams:missingParams,parseStamp:parseStamp,interval:interval,day:day,cumulative:cumulative,backtest:backtest,
  scenarioInterval:scenarioInterval,selfChecks:selfChecks,hhmm:hhmm};
})(typeof window!=='undefined'?window:globalThis);

/* AIP v872 · Native Operational Twin UI (Live Plant · Physics & Losses · Scenario Lab). v887: 30-day back-test, v887 physics trace.
   Every number on these three tabs is computed in the browser by AIPTwinPhysics from the ACTIVE data source
   (imported workbook → bundled Excel dataset → synthetic dataset). No values are embedded in this script. */
(function(){
'use strict';
var E=window.AIPTwinPhysics;if(!E)return;
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var n=function(v,d){var x=Number(v);return Number.isFinite(x)?x:(d===undefined?0:d)};
var esc=function(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var f1=function(v){return n(v).toLocaleString('en-IN',{minimumFractionDigits:1,maximumFractionDigits:1})};
var f2=function(v){return n(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})};
var f0=function(v){return Math.round(n(v)).toLocaleString('en-IN')};
var sgn=function(v,fmt){fmt=fmt||f1;return (v<0?'−':'')+fmt(Math.abs(v))};
var sgnp=function(v,fmt){fmt=fmt||f1;return (v<0?'−':v>0?'+':'')+fmt(Math.abs(v))};
var hhmm=E.hhmm;
var COLORS={iam:'#90a4ae',bifacial:'#16a34a',lowlight:'#ab47bc',weather:'#1565c0',temperature:'#e53935',soiling:'#43a047',dcdesign:'#8e24aa',degradation:'#6d4c41',conversion:'#546e7a',clipping:'#fb8c00',acxfmr:'#00897b',availability:'#3949ab',curtailment:'#00acc1',residual:'#c0ca33'};

/* ---------------- Active data source ---------------- */
function synth(){return window.AIP_SYNTHETIC_ACTIVE===true||/synthetic/i.test(String(window.APM_DATA_MODE||''))}
function modeLabel(){var m='';try{m=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'')}catch(_){}return synth()?'Synthetic dataset':(m||'Excel dataset')}
function importedStore(){try{return (typeof APM_IMPORTED_DATA!=='undefined'&&APM_IMPORTED_DATA)||null}catch(_){return null}}
function lexical(){try{return synth()?(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined'?AIP_INDEPENDENT_SYNTHETIC_DATA:null):(typeof EMBEDDED_EXCEL_DATA!=='undefined'?EMBEDDED_EXCEL_DATA:null)}catch(_){return null}}
function R(k){if(window.AIP891?.isUploaded())return window.AIP891.raw(k);
  var stores=[importedStore(),lexical(),synth()?window.AIP_INDEPENDENT_SYNTHETIC_DATA:window.EMBEDDED_EXCEL_DATA,synth()&&window.AIP_INDEPENDENT_SYNTHETIC_DATA?window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData:null];
  for(var i=0;i<stores.length;i++){var a=stores[i]&&stores[i][k];if(Array.isArray(a)&&a.length)return a}
  if(k==='Sites'){try{if(typeof PLANTS!=='undefined'&&Array.isArray(PLANTS)&&PLANTS.length)return PLANTS.map(function(p){return {Plant_ID:p.id,Plant_Name:p.name,Capacity_MW:p.mw,Inverter_Count:p.inverters,Tracker_Rows:p.trackerRows,Commission_Year:p.commission}})}catch(_){}}
  return [];
}
function pid(){var s=$('#view-operationaltwin #tSite');return (s&&s.value)||window.AIP_TWIN_SITE||((R('Twin Engineering Parameters')[0]||{}).Plant_ID)||''}
function sameId(a,b){return String(a==null?'':a).trim()===String(b==null?'':b).trim()}
function selHour(){var t=$('#view-operationaltwin #tTime');return n(t&&t.value,12)}
function winRange(){var t=$('#view-operationaltwin #tTime');var a=n(t&&t.min,6),b=n(t&&t.max,19);if(!(b>a)){a=6;b=19}return {min:a,max:b}}

/* ---------------- Model (cached per source + site + data fingerprint) ---------------- */
var CACHE={};
function modelFor(id,day){
  var params=R('Twin Engineering Parameters').find(function(x){return sameId(x.Plant_ID,id)});
  if(!params)return {error:'No row for '+id+' in Twin Engineering Parameters'};
  var site=R('Sites').find(function(x){return sameId(x.Plant_ID,id)})||null;
  var all=R('Twin Telemetry').filter(function(r){return sameId(r.Plant_ID,id)&&String(r.Weather_Mode||'Observed')==='Observed'&&E.parseStamp(r.Timestamp)});
  if(!all.length)return {error:'No observed Twin Telemetry rows for '+id};
  var dates=all.map(function(r){return E.parseStamp(r.Timestamp).date}).sort();var date=dates[dates.length-1];if(day&&dates.indexOf(day)>=0)date=day;
  var rows=all.filter(function(r){return E.parseStamp(r.Timestamp).date===date}).sort(function(a,b){return E.parseStamp(a.Timestamp).minute-E.parseStamp(b.Timestamp).minute});
  var key=[synth()?'S':'X',id,date,rows.length,rows[0].Timestamp,rows[rows.length-1].Timestamp,n(rows[rows.length-1].Actual_AC_MW),params.Model_Version,n(params.AC_Capacity_MW),n(params.Annual_Degradation_Pct),site?site.Commission_Year:''].join('|');
  var ck=id+'|'+date;if(CACHE[ck]&&CACHE[ck].key===key)return CACHE[ck];
  var diffs=[];for(var i=1;i<rows.length;i++){var d=E.parseStamp(rows[i].Timestamp).minute-E.parseStamp(rows[i-1].Timestamp).minute;if(d>0)diffs.push(d)}
  diffs.sort(function(a,b){return a-b});var step=(diffs.length?diffs[Math.floor(diffs.length/2)]:15)/60;
  var P=E.plantParams(params,site,+date.slice(0,4)),miss=E.missingParams(P);
  if(miss.length)return {error:'Missing governed parameter(s): '+miss.join(', '),params:params};
  var D=E.day(P,rows,step);
  var ppa=R('Commercial & PPA').find(function(x){return sameId(x.Plant_ID,id)})||{};
  var M={key:key,id:id,params:params,site:site,P:P,D:D,rows:rows,allRows:all,days:dates.filter(function(d,i){return i===0||d!==dates[i-1]}).length,date:date,step:step,tariff:n(ppa.PPA_Tariff_INR_kWh,NaN),tariffSource:'Commercial & PPA · PPA_Tariff_INR_kWh',ppa:ppa};
  M.latest=dates[dates.length-1];M.dates=dates.filter(function(d,i){return i===0||d!==dates[i-1]});CACHE[ck]=M;return M;
}
function idxAt(M,h){var iv=M.D.intervals,b=0;for(var i=1;i<iv.length;i++)if(Math.abs(iv[i].t.hour-h)<Math.abs(iv[b].t.hour-h))b=i;return b}
function plantName(M){return String(M.params.Plant_Name||M.id)}

/* ---------------- Standard KPI card (AIP master KPI markup, v443 typography) ---------------- */
var BARS='<span class="aip-kpi-master-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
function kpis(items,inCard){
  return '<div class="grid g4 aip-maintenance-master-kpis t872-kpis'+(inCard?' t872-kpis-in':'')+'">'+items.map(function(x,i){
    var val=esc(x[1]),unit=x[2]?'<span class="aip-kpi-unit">'+esc(x[2])+'</span>':'';
    return '<div class="aip-kpi-master" data-aip-kpi-index="'+(i%8)+'" title="'+esc(x[3]||x[0])+'" style="height:92px!important;min-height:92px!important;max-height:92px!important;padding:7px 10px 6px!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;gap:3px!important;overflow:hidden!important;">'+
      '<span class="kpi-label" data-kpi-label>'+esc(x[0])+'</span><b class="kpi-value" data-kpi-value>'+val+(x[2]?' '+esc(x[2]):'')+'</b>'+
      '<span class="aip-kpi-display-label" style="position:static!important;display:block!important;flex:0 0 auto!important;width:100%!important;min-height:13px!important;margin:0!important;padding:0!important;text-align:left!important;">'+esc(x[0])+'</span>'+
      '<span class="aip-kpi-display-value" style="position:static!important;display:flex!important;flex:0 0 29px!important;width:100%!important;height:29px!important;min-height:29px!important;margin:0!important;padding:0!important;align-items:center!important;justify-content:flex-start!important;text-align:left!important;line-height:29px!important;overflow:hidden!important;"><span class="aip-kpi-number">'+val+'</span>'+unit+'</span>'+BARS+'</div>';
  }).join('')+'</div>';
}
function chip(kind,text){return '<span class="t872-chip '+kind+'">'+esc(text)+'</span>'}
function lineage(M){return ''}
function unavailable(msg){var b=$('#twBody');if(b)b.innerHTML='<section class="ot297-card"><h3>Native twin engine cannot run for this site</h3><div class="t872-note warn">'+esc(msg)+'. Add or correct the governed rows in the workbook and re-import; the engine does not substitute default values.</div></section>'}

/* ---------------- Shared SVG helpers ---------------- */
function xOf(h,w,W,p){return p+Math.max(0,Math.min(1,(h-w.min)/Math.max(.001,w.max-w.min)))*(W-p*1.35)}
function pathOf(pts,w,W,H,p,max){return pts.map(function(q,i){var x=xOf(q[0],w,W,p),y=H-p-Math.max(0,q[1])/max*(H-p*1.75);return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' ')}
function axis(w,W,H,p,max,unit){
  var g=[0,.25,.5,.75,1].map(function(q){var y=H-p-q*(H-p*1.75);return '<line x1="'+p+'" y1="'+y+'" x2="'+(W-18)+'" y2="'+y+'" stroke="#e2eaee"/><text x="4" y="'+(y+3)+'" font-size="8" fill="#78909c">'+(max*q).toFixed(max*q<10&&q>0?1:0)+' '+unit+'</text>'}).join('');
  var t='';for(var h=Math.ceil(w.min);h<=Math.floor(w.max);h++){if(h%2)continue;t+='<text x="'+xOf(h,w,W,p)+'" y="'+(H-8)+'" text-anchor="middle" font-size="8" fill="#78909c">'+String(h).padStart(2,'0')+':00</text>'}
  return g+t;
}
function marker(h,w,W,H,p,yDot){var x=xOf(h,w,W,p);return '<line x1="'+x+'" y1="22" x2="'+x+'" y2="'+(H-p)+'" stroke="#c026d3" stroke-width="2.5"/>'+(yDot!=null?'<circle cx="'+x+'" cy="'+yDot+'" r="5.5" fill="#c026d3"/>':'')+'<text x="'+Math.min(W-85,x+6)+'" y="18" class="ot297-marker-label">'+hhmm(h*60)+'</text>'}
function inWin(M){var w=winRange();return M.D.intervals.filter(function(x){return x.t.hour>=w.min-.001&&x.t.hour<=w.max+.001})}

/* ================= LIVE PLANT ================= */
function renderLive(M){
  var body=$('#twBody');if(!body)return;var h=selHour(),i=idxAt(M,h),x=M.D.intervals[i],r=x.raw,w=winRange();
  var th=$('#tHour');if(th)th.textContent=hhmm(x.t.minute);var tk=$('#tKpis');if(tk)tk.innerHTML='';
  var pts=inWin(M),W=820,H=260,p=38;
  var max=Math.max(1,M.P.acMW,Math.max.apply(null,pts.map(function(q){return Math.max(q.clearSkyPOI,q.expectedPOI,q.actual)})))*1.08;
  var yDot=H-p-Math.max(0,x.actual)/max*(H-p*1.75);
  var svg='<svg class="ot297-chart" viewBox="0 0 '+W+' '+H+'" aria-label="Solar and weather operating profile">'+axis(w,W,H,p,max,'MW')+
    '<line x1="'+p+'" y1="'+(H-p-M.P.acMW/max*(H-p*1.75))+'" x2="'+(W-18)+'" y2="'+(H-p-M.P.acMW/max*(H-p*1.75))+'" stroke="#9fb3bd" stroke-dasharray="2 4"/><text x="'+(W-20)+'" y="'+(H-p-M.P.acMW/max*(H-p*1.75)-4)+'" text-anchor="end" font-size="8" fill="#78909c">AC rating '+f0(M.P.acMW)+' MW</text>'+
    '<path d="'+pathOf(pts.map(function(q){return [q.t.hour,q.clearSkyPOI]}),w,W,H,p,max)+'" fill="none" stroke="#f59e0b" stroke-width="2.6" stroke-dasharray="8 5"/>'+
    '<path d="'+pathOf(pts.map(function(q){return [q.t.hour,q.actual]}),w,W,H,p,max)+'" fill="none" stroke="#16a34a" stroke-width="3"/>'+
    '<path d="'+pathOf(pts.map(function(q){return [q.t.hour,q.expectedPOI]}),w,W,H,p,max)+'" fill="none" stroke="#2563eb" stroke-width="3" stroke-dasharray="7 5"/>'+
    marker(x.t.hour,w,W,H,p,yDot)+'</svg>';
  var PH=70,pp=30,prMin=50,prMax=100,prPts=pts.filter(function(q){return q.states.s1>M.P.pdc0*.03});
  var py=function(v){return PH-16-(Math.max(prMin,Math.min(prMax,v))-prMin)/(prMax-prMin)*(PH-28)};
  var prd=prPts.map(function(q,k){return (k?'L':'M')+xOf(q.t.hour,w,W,pp).toFixed(1)+' '+py(q.pr*100).toFixed(1)}).join(' ');
  var prNow=Number.isFinite(x.pr)&&x.states.s1>M.P.pdc0*.03?x.pr*100:NaN;
  var prSvg='<svg class="ot297-chart" viewBox="0 0 '+W+' '+PH+'"><line x1="'+pp+'" y1="'+(PH-16)+'" x2="'+(W-18)+'" y2="'+(PH-16)+'" stroke="#e2eaee"/><path d="'+prd+'" fill="none" stroke="#7e57c2" stroke-width="2"/><line x1="'+xOf(x.t.hour,w,W,pp)+'" y1="8" x2="'+xOf(x.t.hour,w,W,pp)+'" y2="'+(PH-16)+'" stroke="#c026d3" stroke-width="1.6"/>'+(Number.isFinite(prNow)?'<circle cx="'+xOf(x.t.hour,w,W,pp)+'" cy="'+py(prNow)+'" r="3.5" fill="#7e57c2"/>':'')+'<text x="4" y="16" font-size="8" fill="#78909c">PR %</text></svg>';
  var wImp=x.clearSkyPOI-x.expectedPOI,L=x.loss;
  var line=function(label,val,cls,sub){return '<div class="'+(cls||'')+'"><span>'+label+'</span><b>'+val+'</b>'+(sub?'<small class="t872-small">'+sub+'</small>':'')+'</div>'};
  body.innerHTML=lineage(M)+'<div class="ot297-live"><section class="ot297-card"><div class="ot311-livehead"><h3>Solar & Weather Operating Profile</h3><div class="ot311-pr"><span>Performance Ratio</span><b>'+(Number.isFinite(prNow)?f1(prNow)+'%':'—')+'</b><small>at '+hhmm(x.t.minute)+'</small></div></div>'+
    '<div class="ot297-weather"><div><span>POA irradiance</span><b>'+f0(x.poa)+' W/m²</b></div><div><span>Clear-sky POA (computed)</span><b>'+f0(x.clearSky.poa)+' W/m²</b></div><div><span>Ambient temperature</span><b>'+(Number.isFinite(x.ta)?f1(x.ta)+' °C':'—')+'</b></div><div><span>Module temperature</span><b>'+f1(x.tUsed)+' °C</b></div><div><span>Wind speed</span><b>'+f1(x.ws)+' m/s</b></div></div>'+
    svg+'<div class="ot297-legend"><span><i class="lg-clear"></i>Clear-sky AC potential · computed</span><span><i class="lg-weather" style="border-top-style:dashed"></i>Expected AC at POI · blue dashed</span><span><i class="lg-delivered"></i>Delivered AC · measured</span><span><i class="lg-hour"></i>Selected solar hour</span></div>'+
    '<div class="ot297-prstrip"><h4>Performance Ratio · delivered AC ÷ (DC nameplate × POA / 1000)</h4>'+prSvg+'</div></section>'+
    '<aside class="ot297-card"><h3>Causal Decomposition — '+hhmm(x.t.minute)+'</h3><div class="ot297-causal" style="margin-top:9px">'+
    line('Clear-sky AC potential',f1(x.clearSkyPOI)+' MW','ot297-good','Computed sun position + clear-sky irradiance through this plant')+
    line('Weather / resource impact',sgnp(-wImp)+' MW','ot297-gap',wImp<0?'Measured irradiance above computed clear sky — see Model Validation':'Clouds and haze versus clear sky')+
    line('Expected at POI',f1(x.expectedPOI)+' MW','','Measured weather, temperature, soiling, design, degradation, inverter, AC')+
    line('Plant / operational impact',sgnp(-(x.expectedPOI-x.actual))+' MW','ot297-gap plant','Availability '+sgnp(-L.availability,f2)+' · curtailment '+sgnp(-L.curtailment,f2)+' · unexplained '+sgnp(-L.residual,f2)+' MW'+(x.actual>x.expectedPOI*1.03?' · delivery above model, see Model Validation':''))+
    line('Delivered at POI',f1(x.actual)+' MW','ot297-good','Measured')+
    '</div><button type="button" class="t872-link" id="t872ToTrace">How AIP calculated this →</button></aside></div>';
  var b=$('#t872ToTrace');if(b)b.onclick=function(){LOSS_VIEW='trace';go('Physics & Losses')};
}

/* ================= PHYSICS & LOSSES ================= */
var LOSS_VIEW='bridge';
function renderLoss(M){
  var body=$('#twBody');if(!body)return;var i=idxAt(M,selHour()),x=M.D.intervals[i];
  var th=$('#tHour');if(th)th.textContent=hhmm(x.t.minute);var tk=$('#tKpis');if(tk)tk.innerHTML='';
  var seg='<div class="t872-seg" role="tablist">'+[['bridge','Loss Bridge'],['trace','Physics Trace'],['validation','Model Validation']].map(function(s){return '<button type="button" role="tab" data-lv="'+s[0]+'" class="'+(LOSS_VIEW===s[0]?'active':'')+'" aria-selected="'+(LOSS_VIEW===s[0])+'">'+s[1]+'</button>'}).join('')+'</div>';
  var inner=LOSS_VIEW==='trace'?traceView(M,i):LOSS_VIEW==='validation'?validationView(M):bridgeView(M,i);
  var cut=inner.indexOf('<!--/kpis-->'),top=cut>=0?inner.slice(0,cut):'';inner=cut>=0?inner.slice(cut+12):inner;
  body.innerHTML=lineage(M)+window.AIPSharedLoss913.summary(M.id)+top+'<section class="ot297-card t872-loss"><div class="t872-head"><div><h3>Physics & Loss Reconciliation — '+(LOSS_VIEW==='validation'?'back-test over '+M.days+' observed day'+(M.days===1?'':'s')+' · operating day '+esc(window.AIPDateDisplay884(M.date)):LOSS_VIEW==='trace'?'at '+hhmm(x.t.minute)+' · '+Math.round(M.step*60)+'-minute interval':'through '+hhmm(x.t.minute))+'</h3>'+'</div>'+seg+'</div>'+inner+'</section>';
  $$('.t872-seg button',body).forEach(function(b){b.onclick=function(){LOSS_VIEW=b.dataset.lv;renderLoss(M)}});
  if(LOSS_VIEW==='bridge')wireRecovery(M);
  if(LOSS_VIEW==='trace'){var bt=$('#t872TraceToLive');if(bt)bt.onclick=function(){go('Live Plant')}}
}
function bridgeView(M,i){
  var C=E.cumulative(M.D,i),cats=E.CATEGORIES,x=M.D.intervals[i];
  var s1=0;for(var k=0;k<=i;k++)s1+=M.D.intervals[k].states.s1*M.D.dt;
  var pr=s1>0?C.actual/s1*100:NaN;
  var recovery=window.AIPSharedLoss913.dayRecovery(M,i),rec=recovery.total,comp=n(C.loss.curtailment),tariff=M.tariff;
  var residPct=C.s8>0?C.loss.residual/C.s8*100:0,ar=Math.abs(residPct);
  var rk=ar<=3?'ok':ar<=7?'warn':'bad';
  var rtext=residPct>=0?('Measured delivery is '+f1(ar)+'% below the modelled delivery — unexplained loss to investigate (e.g. string faults, tracker errors, unmetered outages).'):('Measured delivery is '+f1(ar)+'% above the modelled delivery — the model is conservative here; check the degradation basis (age '+f0(M.P.ageYears)+' y), soiling ratio and availability metering.');
  var mx=Math.max.apply(null,cats.map(function(c){return Math.abs(n(C.loss[c.key]))}).concat([.01]));
  var rows=cats.map(function(c){var v=n(C.loss[c.key]),pct=C.s0>0?v/C.s0*100:0,neg=v<0;
    var note=c.key==='bifacial'&&v!==0?'Rear-side irradiance adds energy (bifaciality × (1 − rear shading/mismatch))':neg&&c.key==='weather'?'Measured POA above computed clear sky in some intervals — see Model Validation':neg&&c.key==='residual'?'Measured delivery above the model':neg&&c.key==='temperature'?'Modules below 25 °C gain output':c.note;
    if(c.key!=='residual'&&Math.abs(v)<1e-9&&(c.key==='bifacial'||c.key==='iam'||c.key==='lowlight'))return '';
    return '<div class="ot297-lossrow t872-lossrow"><span>'+esc(c.label)+'<small>'+esc(note)+'</small></span><div><i style="width:'+(Math.abs(v)<=0?0:Math.max(1,Math.abs(v)/mx*100))+'%;background:'+(neg?'#16a34a':COLORS[c.key])+'"></i></div><b>'+sgn(v)+' MWh</b><em>'+sgn(pct)+'%</em>'+chip(c.recoverable==='Yes'?'ok':c.recoverable==='Compensable'?'info':c.recoverable==='Investigate'?'warn':'muted',c.key==='availability'?'Needs evidence':c.key==='curtailment'?'PPA review':c.key==='soiling'?'Opportunity':c.recoverable==='No'?'Not controllable':c.recoverable)+'</div>'}).join('');
  window.AIP891TwinLoss={M,C,pr,i};var recon=C.s0-C.totalLoss;
  var html=kpis([
    ['Clear-sky reference',f1(C.s0),'MWh','DC nameplate × computed clear-sky POA, 25 °C, clean, no losses'],
    ['Expected at POI',f1(C.s8),'MWh','After weather, temperature, soiling, design, degradation, inverter, clipping and AC losses'],
    ['Delivered at POI',f1(C.actual),'MWh','Measured Actual_AC_MW integrated'],
    ['Performance ratio',Number.isFinite(pr)?f1(pr):'—','%','Delivered ÷ (DC nameplate × measured POA)']
  ])+'<!--/kpis-->'+
  '<div class="t872-bridgehead"><span>Loss step (in calculation order)</span><span></span><span>Energy</span><span>% of ref.</span><span>Nature</span></div>'+rows+
  '<div class="t872-recon '+(Math.abs(C.reconError)<1e-6?'ok':'bad')+'"><b>Reconciliation</b><span>Clear-sky reference '+f1(C.s0)+' − Σ losses '+f1(C.totalLoss)+' = '+f1(recon)+' MWh · delivered '+f1(C.actual)+' MWh · difference '+Math.abs(C.reconError).toExponential(1)+' MWh</span>'+chip(Math.abs(C.reconError)<1e-6?'ok':'bad',Math.abs(C.reconError)<1e-6?'Reconciled':'Not reconciled')+'</div>'+
  '<div class="t872-recon '+rk+'"><b>Residual '+sgn(residPct)+'%</b><span>'+esc(rtext)+'</span>'+chip(rk,rk==='ok'?'Within ±3%':rk==='warn'?'Investigate':'Model / data issue')+'</div>'+
  '<div class="ot305-recover"><div><div class="label">Recoverable Energy</div><div class="sub ot319-recover-copy"><strong>Cleaning opportunity '+f1(recovery.soil)+' MWh + evidence-qualified equipment '+f1(recovery.equipment)+' MWh</strong> <span class="ot319-emphasis">modelled recovery</span> at POI. Unallocated outages are not assumed recoverable · curtailment '+f1(comp)+' MWh is external; compensation depends on the PPA · through '+hhmm(x.t.minute)+(Number.isFinite(tariff)?' · value at PPA tariff ₹'+f2(tariff)+'/kWh ≈ ₹'+f2(rec*tariff/100)+' lakh':'')+'</div><div class="ot314-lineage ot319-lineage">Feeds Recoverable Generation → Recoverable Revenue Opportunity</div><button type="button" class="ot315-route ot319-route" id="ot315RecoveryImpact">View Recovery Impact →</button></div><div class="value">'+f1(rec)+' MWh</div></div>'+
  lossProfile(M,i);
  return html;
}
function lossProfile(M,i){
  var W=820,H=225,p=40,w=winRange(),pts=inWin(M),x=M.D.intervals[i];
  var groups=[{k:['weather'],label:'Weather / resource',c:COLORS.weather},{k:['iam','bifacial','lowlight'],label:'Optics, bifacial & low light',c:'#ab47bc'},{k:['temperature'],label:'Temperature',c:COLORS.temperature},{k:['soiling'],label:'Soiling',c:COLORS.soiling},{k:['availability'],label:'Availability',c:COLORS.availability},{k:['curtailment'],label:'Curtailment',c:COLORS.curtailment},{k:['dcdesign','degradation','conversion','clipping','acxfmr'],label:'Design, degradation & conversion',c:'#6d4c41'},{k:['residual'],label:'Residual',c:'#9e9d24'}];
  groups.forEach(function(g){g.v=pts.map(function(q){return [q.t.hour,g.k.reduce(function(s,k){return s+n(q.loss[k])},0)]})});
  var vis=groups.filter(function(g){return g.v.some(function(v){return Math.abs(v[1])>1e-6})});
  var hi=Math.max(.5,Math.max.apply(null,vis.map(function(g){return Math.max.apply(null,g.v.map(function(v){return v[1]}))})))*1.1;
  var lo=Math.min(0,Math.min.apply(null,vis.map(function(g){return Math.min.apply(null,g.v.map(function(v){return v[1]}))})));
  var span=hi-lo,Y=function(v){return H-p-(v-lo)/span*(H-p-24)};
  var grid=[0,.25,.5,.75,1].map(function(q){var v=lo+q*span,y=Y(v);return '<line x1="'+p+'" y1="'+y+'" x2="'+(W-18)+'" y2="'+y+'" stroke="#e2eaee"/><text x="3" y="'+(y+3)+'" font-size="8" fill="#78909c">'+v.toFixed(1)+'</text>'}).join('');
  var ticks='';for(var h=Math.ceil(w.min);h<=Math.floor(w.max);h++){if(h%2)continue;ticks+='<text x="'+xOf(h,w,W,p)+'" y="'+(H-8)+'" text-anchor="middle" font-size="8" fill="#78909c">'+String(h).padStart(2,'0')+':00</text>'}
  var lines=vis.map(function(g){return '<path d="'+g.v.map(function(v,k){return (k?'L':'M')+xOf(v[0],w,W,p).toFixed(1)+' '+Y(v[1]).toFixed(1)}).join(' ')+'" fill="none" stroke="'+g.c+'" stroke-width="'+(g.k[0]==='weather'?2.6:2)+'"/>'}).join('');
  var zero=lo<0?'<line x1="'+p+'" y1="'+Y(0)+'" x2="'+(W-18)+'" y2="'+Y(0)+'" stroke="#9fb3bd"/>':'';
  var mxX=xOf(x.t.hour,w,W,p);
  return '<div class="ot303-losschart"><h4>Intraday Loss Profile</h4><div class="ot303-sub">Loss rate per '+Math.round(M.step*60)+'-minute interval from the same sequential bridge · negative values mean measured irradiance above computed clear sky or delivery above the model · marker follows Solar Hour</div>'+
    '<svg class="ot297-chart" viewBox="0 0 '+W+' '+H+'" aria-label="Intraday loss profile"><text x="4" y="12" font-size="8" fill="#78909c">MW loss</text>'+grid+zero+lines+'<line x1="'+mxX+'" y1="18" x2="'+mxX+'" y2="'+(H-p)+'" stroke="#c026d3" stroke-width="2.3"/><text x="'+Math.min(W-80,mxX+5)+'" y="17" class="ot297-marker-label">'+hhmm(x.t.minute)+'</text>'+ticks+'</svg>'+
    '<div class="ot303-losslegend">'+vis.map(function(g){return '<span><i style="--c:'+g.c+'"></i>'+esc(g.label)+'</span>'}).join('')+'<span class="marker"><i></i>Selected solar hour</span></div></div>';
}
function wireRecovery(M){
  var impact=$('#ot315RecoveryImpact');if(!impact)return;
  impact.onclick=function(){
    var plantId=M.id,name=plantName(M),hour=selHour();
    window.AIP_CONTEXT_NAV={source:'Operational Twin',target:'portfoliobenchmarking',metric:'Recoverable Energy',plantId:plantId,plantName:name,originView:'operationaltwin',originTwinTab:'Physics & Losses',originSolarHour:hour,timestamp:Date.now()};
    window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};window.AIP_V21.state.layer='Physics & Losses';window.AIP_V21.state.time=hour;
    window.PORTFOLIO_PERFORMANCE_TAB='loss';
    try{if(typeof window.activate==='function')window.activate('portfoliobenchmarking')}catch(_){}
    setTimeout(function(){try{if(typeof window.AIPPortfolioToLoss==='function')window.AIPPortfolioToLoss(plantId,name,'Operational Twin');else if(typeof window.setPortfolioPerformanceTab==='function')window.setPortfolioPerformanceTab('loss')}catch(_){}},90);
  };
}
function traceView(M,i){window.AIP891TwinLoss={M,i,instant:true,C:{...M.D.intervals[i].states,actual:M.D.intervals[i].actual}};
  var x=M.D.intervals[i],P=M.P,S=x.states,L=x.loss,s=x.sun,cs=x.clearSky;
  var kt=cs.poa>0?x.poa/cs.poa:NaN,z=x.pdc0inv>0?S.s5/x.pdc0inv:0;
  var row=function(no,step,model,inputs,out,loss){return '<tr><td class="t872-no">'+no+'</td><td><b>'+step+'</b></td><td>'+model+'</td><td>'+inputs+'</td><td class="num">'+out+'</td><td class="num">'+(loss==null?'':loss)+'</td></tr>'};
  var mw=function(v){return f2(v)+' MW'},lz=function(v){return v===0?'0.00':sgn(-v,f2)};
  var t='<div class="t872-tablewrap"><table class="t872-table"><thead><tr><th>#</th><th>Step</th><th>Model / formula</th><th>Inputs used</th><th class="num">Result</th><th class="num">Change (MW)</th></tr></thead><tbody>'+
   row(1,'Sun position','NOAA solar position (Spencer series)','Day '+x.doy+' · '+hhmm(x.t.minute)+' IST · φ '+f2(P.lat)+'°, λ '+f2(P.lon)+'°','Elevation '+f2(s.elevation)+'° · azimuth '+f1(s.azimuth)+'°',null)+
   row(2,'Clear-sky irradiance',(cs.model==='Ineichen–Perez'?'Ineichen–Perez clear sky (Linke turbidity '+f1(cs.tl)+', elevation '+f0(P.elev)+' m) → Perez 1990 anisotropic transposition':'Haurwitz GHI → Erbs split → isotropic transposition (basic model — add Site_Elevation_m and Linke_Turbidity_Monthly)')+', albedo '+f2(P.albedo),'Declination '+f2(s.declination)+'° · '+(P.mounting==='tracker'?'tracker rotation '+f1(x.orient.rotation)+'° (±'+f0(P.maxAngle)+'°, GCR '+f2(P.gcr)+(P.backtrack?', backtracking':'')+')':'tilt '+f1(P.tilt)+'° · azimuth '+f0(P.azimuth)+'°')+' · AOI '+f1(cs.aoi)+'°'+(P.tsShiftMin?' · sun at interval midpoint (+'+P.tsShiftMin+' min)':''),'GHI '+f0(cs.ghi)+' · DNI '+f0(cs.dni)+' · DHI '+f0(cs.dhi)+' → POA '+f0(cs.poa)+' W/m²',null)+
   row(3,'Clear-sky reference','P<sub>DC0</sub> × POA<sub>cs</sub> / 1000','P<sub>DC0</sub> = '+f1(P.acMW)+' MW × DC/AC '+f2(P.dcac)+' = '+f1(P.pdc0)+' MWp',mw(S.s0),null)+
   row(4,'Measured irradiance','P<sub>DC0</sub> × POA / 1000','Measured POA '+f0(x.poa)+' W/m² · clear-sky index '+(Number.isFinite(kt)?f2(kt):'—'),mw(S.s1),lz(L.weather))+
   row('4a','Reflection (IAM)',x.features.iam?'beam × ASHRAE IAM(AOI) + sky × '+f2(P.iamDiffuse)+' + ground × '+f2(P.iamGround):'not applied (IAM_b0 not governed)','Beam share '+f0(x.beamShare*100)+'% (measured GHI → Erbs → Perez) · AOI '+f1(x.aoi)+'° · IAM<sub>beam</sub> '+f2(x.iamBeam)+' → factor '+x.iamFactor.toFixed(4),mw(S.s1a),lz(L.iam))+
   row('4b','Bifacial rear side',x.features.bifacial?'+ P<sub>DC0</sub> × E<sub>rear</sub> × φ × (1 − L<sub>rear</sub>) / 1000':'monofacial — no rear gain','E<sub>rear</sub> '+f0(x.rear)+' W/m² (ground shadow from GCR '+f2(P.gcr)+', albedo '+f2(P.albedo)+', view factors) · φ '+f0(P.bifaciality*100)+'% · L<sub>rear</sub> '+f0(P.rearLoss*100)+'%',mw(S.s1b),lz(L.bifacial))+
   row('4c','Low-irradiance efficiency',x.features.lowLight?'× [1 − L<sub>200</sub> · ln(1000/E) / ln 5]':'not applied','E<sub>eff</sub> '+f0(x.gEff)+' W/m² · L<sub>200</sub> '+f1(P.lowLight200*100)+'% → factor '+x.lowLight.toFixed(4),mw(S.s1c),lz(L.lowlight))+
   row(5,'Cell temperature','× [1 + γ (T<sub>cell</sub> − 25 °C)]','T<sub>cell</sub> = '+f1(x.tUsed)+' °C ('+esc(x.tSource)+(Number.isFinite(x.tModule)?'; sensor '+f1(x.tModule)+' °C':'')+(Number.isFinite(x.tFaiman)?'; Faiman '+f1(x.tFaiman)+' °C':'')+') · γ '+f2(P.gamma*100)+' %/°C','Factor '+(x.tempFactor).toFixed(4)+' → '+mw(S.s2),lz(L.temperature))+
   row(6,'Soiling','× soiling ratio','Measured soiling ratio '+(x.soilingRatio).toFixed(3),mw(S.s3),lz(L.soiling))+
   row(7,'DC design losses','× (1 − L<sub>DC</sub>)','L<sub>DC</sub> '+f2(P.dcLoss*100)+'% (mismatch, wiring, shading)',mw(S.s4),lz(L.dcdesign))+
   row(8,'Degradation','× (1 − d)<sup>age</sup>','d '+f2(P.degrRate*100)+'%/y · age '+(Number.isFinite(P.ageYears)?f0(P.ageYears)+' y (commissioned '+P.commissionYear+')':'not available')+' · factor '+P.degrFactor.toFixed(4),mw(S.s5),lz(L.degradation))+
   row(9,'Inverter conversion','PVWatts part-load curve η(ζ)','Load ζ = '+f2(z)+' · η<sub>nominal</sub> '+f2(P.invEff*100)+'% → η '+f2(x.eta*100)+'%',mw(S.s6),lz(L.conversion))+
   row(10,'Clipping & derate','min(P<sub>AC</sub>, AC rating × derate)','AC rating '+f1(P.acMW)+' MW'+(x.features.derate?' · derate above '+f0(P.derateStart)+' °C ambient at '+f1(P.derateSlope)+' %/°C → limit '+f1(x.acLimit)+' MW':' · thermal derate not governed'),mw(S.s7),lz(L.clipping))+
   row(11,'AC wiring & transformer','× (1 − L<sub>AC</sub>) × η<sub>xfmr</sub>','L<sub>AC</sub> '+f2(P.acLoss*100)+'% · η<sub>xfmr</sub> '+f2(P.xfmrEff*100)+'%','<b>Expected at POI '+mw(S.s8)+'</b>',lz(L.acxfmr))+
   row(12,'Availability','× availability','Measured availability '+f2(x.availability*100)+'%',mw(S.s9),lz(L.availability))+
   row(13,'Curtailment','× (1 − curtailment)','Measured POI curtailment '+f2(x.curtailment*100)+'%','<b>Modelled delivery '+mw(S.s10)+'</b>',lz(L.curtailment))+
   row(14,'Measured delivery','Residual = modelled − measured','Actual_AC_MW '+f2(x.actual)+' MW','<b>'+mw(x.actual)+'</b>',lz(L.residual))+
   '</tbody></table></div>';
  var chk=Math.abs(x.reconError)<1e-9;
  return kpis([['Clear-sky reference',f2(S.s0),'MW'],['Expected at POI',f2(S.s8),'MW'],['Delivered at POI',f2(x.actual),'MW'],['Residual',sgn(L.residual,f2),'MW']])+'<!--/kpis-->'+t+
   '<div class="t872-recon '+(chk?'ok':'bad')+'"><b>Interval check</b><span>'+f2(S.s0)+' − Σ changes '+f2(S.s0-x.actual)+' = '+f2(x.actual)+' MW measured · every step uses only governed parameters and this interval\'s telemetry</span>'+chip(chk?'ok':'bad',chk?'Reconciled':'Not reconciled')+'</div>'+
   '<div class="t872-actions"><button type="button" class="t872-link" id="t872TraceToLive">← Back to Live Plant</button></div>';
}

/* ---------------- Validation (engine checks · legacy agreement · data consistency) ---------------- */
function legacyAgreement(M){
  var n0=0,ok=0,mx=0,csN=0,csE=0;
  M.D.intervals.forEach(function(x){var st=n(x.raw.Expected_DC_MW,NaN);if(Number.isFinite(st)&&st>0.5){var mine=x.states.s2*(1-M.P.degrRate),dv=Math.abs(mine-st);n0++;var rel=dv/st;if(rel<=.005||dv<=.05)ok++;mx=Math.max(mx,rel)}
    var c=n(x.raw.ClearSky_POA_Wm2,NaN);if(Number.isFinite(c)&&c>100&&x.clearSky.poa>0){csN++;csE+=Math.abs(x.clearSky.poa-c)/c}});
  return {n:n0,ok:ok,max:mx*100,csMape:csN?csE/csN*100:NaN};
}
function dataChecks(M){
  var out=[],add=function(area,finding,status,detail){out.push({area:area,finding:finding,status:status,detail:detail})};
  var early=M.D.intervals.filter(function(x){return x.sun.elevation<=0&&x.poa>5});
  add('Irradiance timing',early.length?early.length+' interval(s) record irradiance while the computed sun is below the horizon':'Irradiance starts after computed sunrise',early.length?'Review':'Pass',early.length?'e.g. '+hhmm(early[0].t.minute)+' POA '+f0(early[0].poa)+' W/m² · check logger time zone / timestamp convention (interval start vs end)':'Sunrise '+hhmm((E.sunriseSunset(M.D.intervals[0].doy,M.P.lat,M.P.lon,M.P.tz)||{}).sunriseMin||0));
  var over=M.D.intervals.filter(function(x){return x.poa>50&&x.poa>x.clearSky.poa*1.05});
  add('Irradiance vs clear sky',over.length?over.length+' interval(s) exceed computed clear-sky POA by >5%':'Measured POA within clear-sky envelope',over.length?'Review':'Pass',over.length?'Cloud-edge enhancement is possible for single intervals; a run of them usually means a timestamp shift or pyranometer calibration issue':'');
  var inv=R('Asset Master').filter(function(a){return sameId(a.Plant_ID,M.id)&&/inverter/i.test(String(a.Asset_Class||''))});
  var sumInv=inv.reduce(function(s,a){return s+n(a.Rated_Capacity_MW)},0),sc=M.site?n(M.site.Inverter_Count,NaN):NaN;
  if(M.site)add('Inverter count','Sites lists '+f0(sc)+' inverters · Asset Master holds '+inv.length,Number.isFinite(sc)&&sc===inv.length?'Pass':'Review','Master-data alignment (engine does not use inverter-level data yet)');
  add('Inverter capacity','Σ inverter ratings '+f1(sumInv)+' MW vs plant AC rating '+f1(M.P.acMW)+' MW',Math.abs(sumInv-M.P.acMW)<=M.P.acMW*.05?'Pass':'Review','Needed before an inverter-level twin; plant-level engine uses the governed AC rating');
  if(M.site&&Number.isFinite(n(M.site.Capacity_MW,NaN)))add('Plant capacity','Sites '+f1(n(M.site.Capacity_MW))+' MW vs Twin Engineering Parameters '+f1(M.P.acMW)+' MW AC',Math.abs(n(M.site.Capacity_MW)-M.P.acMW)<.01?'Pass':'Review','');
  var trk=M.site?n(M.site.Tracker_Rows,0):0,trkAssets=R('Asset Master').filter(function(a){return sameId(a.Plant_ID,M.id)&&/tracker/i.test(String(a.Asset_Class||''))}).length;
  if(trk>0||trkAssets>0||M.P.mounting==='tracker')add('Mounting type',M.P.mounting==='tracker'?'Single-axis trackers modelled ('+f0(trk)+' tracker rows / '+trkAssets+' tracker assets)':'Site has '+f0(trk)+' tracker rows / '+trkAssets+' tracker assets, but the engine uses a fixed tilt of '+f1(M.P.tilt)+'°',M.P.mounting==='tracker'?'Pass':'Review','If the arrays track, clear-sky POA and weather loss are understated at the shoulders — add a mounting type and tracker limits to Twin Engineering Parameters');
  var ve=R('VE_Rate_Config').find(function(r){return String(r.Rate_Type||'')==='PPA Tariff'&&sameId(r.Applies_To,M.id)});
  if(ve&&Number.isFinite(M.tariff))add('PPA tariff',Math.abs(n(ve.Rate_or_Value)-M.tariff)<.005?'Tariff consistent across masters':'Commercial & PPA ₹'+f2(M.tariff)+'/kWh vs VE_Rate_Config ₹'+f2(n(ve.Rate_or_Value))+'/kWh',Math.abs(n(ve.Rate_or_Value)-M.tariff)<.005?'Pass':'Review','Twin uses Commercial & PPA (contract master)');
  else add('PPA tariff',Number.isFinite(M.tariff)?'₹'+f2(M.tariff)+'/kWh from Commercial & PPA':'No PPA tariff for this site',Number.isFinite(M.tariff)?'Pass':'Review','Used only to value recoverable energy');
  add('Degradation basis','Engine applies (1 − '+f2(M.P.degrRate*100)+'%)^'+(Number.isFinite(M.P.ageYears)?f0(M.P.ageYears):'?')+' = '+M.P.degrFactor.toFixed(4),'Info','Age from Sites.Commission_Year');
  var Fe=E.features(M.P),on=[['Ineichen–Perez clear sky',Fe.clearSky],['Reflection (IAM)',Fe.iam],['Bifacial rear side',Fe.bifacial],['Low-irradiance efficiency',Fe.lowLight],['Cell ΔT from module sensor',Fe.cellDT],['Faiman fallback',Fe.faiman],['Inverter thermal derate',Fe.derate],['Interval-midpoint sun position',Fe.midpoint]];
  add('Physics refinements',on.filter(function(o){return o[1]}).map(function(o){return o[0]}).join(' · ')||'none — basic model',on.every(function(o){return o[1]||o[0]==='Bifacial rear side'})?'Pass':'Review',on.filter(function(o){return !o[1]}).length?'Off: '+on.filter(function(o){return !o[1]}).map(function(o){return o[0]}).join(', ')+(M.P.bifaciality>0?'':' (site is monofacial)'):'All refinements active');
  add('Parameter provenance',String(M.params.Physics_Param_Source||'not stated'),/estimated|default/i.test(String(M.params.Physics_Param_Source||''))?'Review':'Info','Estimated or generic values are flagged until replaced by site survey or module PAN data');
  return out;
}
function statusChip(s){return chip(s==='Pass'?'ok':s==='Review'?'warn':s==='Fail'?'bad':'info',s)}
/* 30-day back-test: the same engine over every observed day; also re-run with the v872 physics for comparison */
var HIST={};
function v872Params(P){var q=Object.assign({},P);q.elev=NaN;q.tlMonthly=null;q.iamB0=NaN;q.bifaciality=0;q.lowLight200=NaN;q.cellDeltaT=NaN;q.u0=NaN;q.u1=NaN;q.derateStart=NaN;q.tsShiftMin=0;q.albedo=0.2;return q}
function historyFor(id){
  var M=modelFor(id);if(!M||M.error)return {error:M?M.error:'no model'};
  if(HIST[id]&&HIST[id].key===M.key+'|'+M.allRows.length)return HIST[id];
  var B=E.backtest(M.P,M.allRows,M.step),B0=E.backtest(v872Params(M.P),M.allRows,M.step);
  var d=B.days,last7=d.slice(-7),prior=d.slice(0,Math.max(0,d.length-7)),mean=function(a){return a.length?a.reduce(function(s,x){return s+x.residualPct},0)/a.length:NaN};
  var worst=d.reduce(function(w,x){return !w||Math.abs(x.residualPct)>Math.abs(w.residualPct)?x:w},null);
  var H={key:M.key+'|'+M.allRows.length,id:id,M:M,B:B,B0:B0,days:d.length,trend:mean(last7)-mean(prior),recent:mean(last7),worst:worst};
  HIST[id]=H;return H;
}
function skyClass(kc){return !Number.isFinite(kc)?'—':kc>=0.8?'Clear':kc>=0.5?'Partly cloudy':'Overcast'}
function residualChart(H){
  var d=H.B.days,W=820,Ht=190,p=40,n=d.length;if(!n)return '';
  var mx=Math.max(4,Math.max.apply(null,d.map(function(x){return Math.abs(x.residualPct)})))*1.15,bw=(W-p-18)/n;
  var Y=function(v){return 18+(mx-v)/(2*mx)*(Ht-40)};
  var grid=[-mx,-3,0,3,mx].map(function(v){var y=Y(v);return '<line x1="'+p+'" y1="'+y+'" x2="'+(W-18)+'" y2="'+y+'" stroke="'+(v===0?'#9fb3bd':'#e2eaee')+'"'+(Math.abs(v)===3?' stroke-dasharray="4 4"':'')+'/><text x="4" y="'+(y+3)+'" font-size="8" fill="#78909c">'+(v>0?'+':'')+v.toFixed(Math.abs(v)===3||v===0?0:1)+'%</text>'}).join('');
  var bars=d.map(function(x,i){var v=x.residualPct,y0=Y(0),y=Y(v),c=Math.abs(v)<=3?(v>=0?'#c0ca33':'#26a69a'):'#e53935';
    return '<rect x="'+(p+i*bw+1).toFixed(1)+'" y="'+Math.min(y,y0).toFixed(1)+'" width="'+Math.max(1,bw-2).toFixed(1)+'" height="'+Math.max(1,Math.abs(y-y0)).toFixed(1)+'" fill="'+c+'"><title>'+esc(x.date)+' · residual '+sgnp(v)+'% · '+skyClass(x.kc)+'</title></rect>'}).join('');
  var ticks=d.map(function(x,i){return i%5===0||i===n-1?'<text x="'+(p+i*bw+bw/2).toFixed(1)+'" y="'+(Ht-6)+'" text-anchor="middle" font-size="8" fill="#78909c">'+esc(x.date.slice(8,10)+'-'+x.date.slice(5,7))+'</text>':''}).join('');
  return '<svg class="ot297-chart" viewBox="0 0 '+W+' '+Ht+'" aria-label="Daily residual">'+grid+bars+ticks+'</svg><div class="ot297-legend"><span><i style="border-top:6px solid #c0ca33"></i>Model above meter (unexplained loss), within ±3%</span><span><i style="border-top:6px solid #26a69a"></i>Meter above model, within ±3%</span><span><i style="border-top:6px solid #e53935"></i>Outside ±3% — investigate</span></div>';
}
function validationView(M){
  var checks=E.selfChecks(M.P,M.D),pass=checks.filter(function(c){return c.pass}).length;
  var ids=R('Twin Engineering Parameters').map(function(p){return p.Plant_ID});
  var sites=ids.map(function(id){var h=historyFor(id);if(h.error)return {id:id,error:h.error};return {id:id,name:plantName(h.M),H:h,maxErr:h.B.days.reduce(function(s,x){return Math.max(s,x.D.intervals.reduce(function(a,q){return Math.max(a,Math.abs(q.reconError))},0))},0)}});
  var good=sites.filter(function(s){return !s.error}),cur=historyFor(M.id);
  var totMod=good.reduce(function(s,x){return s+x.H.B.modelled},0),totAct=good.reduce(function(s,x){return s+x.H.B.actual},0);
  var head=kpis([
    ['Engine self-checks',pass+' / '+checks.length,'passed','Analytic identities and physical invariants for this site'],
    ['Energy bias · this site',cur.error?'—':sgnp(cur.B.energyBiasPct),'%','Modelled delivery − metered delivery over '+(cur.error?0:cur.days)+' observed days, as % of metered'],
    ['Interval nMAE · this site',cur.error?'—':f2(cur.B.nMAE),'%','Mean absolute 15-min error ÷ AC rating, all daylight intervals, '+(cur.error?0:cur.days)+' days'],
    ['Portfolio energy bias',totAct>0?sgnp((totMod-totAct)/totAct*100):'—','%','All sites, all observed days · loss bridge closes exactly in every interval: '+(good.every(function(s){return s.maxErr<1e-9})?'yes':'no')]
  ]);
  var ct='<h4 class="t872-h4">1 · Engine self-checks — '+esc(plantName(M))+'</h4><div class="t872-tablewrap"><table class="t872-table"><thead><tr><th>Check</th><th>Type</th><th>Evidence</th><th>Result</th></tr></thead><tbody>'+
    checks.map(function(c){return '<tr><td><b>'+esc(c.name)+'</b></td><td>'+esc(c.kind)+'</td><td>'+esc(c.detail)+'</td><td>'+statusChip(c.pass?'Pass':'Fail')+'</td></tr>'}).join('')+'</tbody></table></div>';
  var st='<h4 class="t872-h4">2 · Back-test against the revenue meter — all sites, every observed day</h4><div class="t872-muted t872-para">The engine is run on each day\'s measured weather and plant status and compared with metered delivery. The telemetry comes from an independent demo simulator (different irradiance, thermal, electrical and outage models), not from this engine, so agreement is evidence rather than an identity. “Basic model” re-runs the same days with the earlier, simpler physics (Haurwitz clear sky, isotropic sky, no reflection, bifacial, low-light or cell-temperature terms) to show what the upgrade changed. Replace with real SCADA history to validate for a customer.</div><div class="t872-tablewrap"><table class="t872-table"><thead><tr><th>Site</th><th class="num">Days</th><th class="num">Modelled MWh</th><th class="num">Metered MWh</th><th class="num">Energy bias</th><th class="num">Basic model bias</th><th class="num">Interval nMAE</th><th class="num">Worst day</th><th class="num">Last 7 d vs earlier</th><th>Status</th></tr></thead><tbody>'+
    sites.map(function(s){if(s.error)return '<tr><td>'+esc(s.id)+'</td><td colspan="9">'+esc(s.error)+'</td></tr>';var H=s.H,b=H.B.energyBiasPct,ok=Math.abs(b)<=2&&H.B.nMAE<=3&&!(Math.abs(H.trend)>1.5);
      return '<tr class="'+(sameId(s.id,M.id)?'t872-cur':'')+'"><td><b>'+esc(s.id)+'</b> '+esc(s.name)+'</td><td class="num">'+H.days+'</td><td class="num">'+f0(H.B.modelled)+'</td><td class="num">'+f0(H.B.actual)+'</td><td class="num">'+sgnp(b)+'%</td><td class="num">'+sgnp(H.B0.energyBiasPct)+'%</td><td class="num">'+f2(H.B.nMAE)+'%</td><td class="num">'+(H.worst?sgnp(H.worst.residualPct)+'% · '+esc(H.worst.date.slice(8,10)+'-'+H.worst.date.slice(5,7)):'—')+'</td><td class="num">'+(Number.isFinite(H.trend)?sgnp(H.trend)+' pp':'—')+'</td><td>'+statusChip(ok?'Pass':'Review')+'</td></tr>'}).join('')+'</tbody></table></div>'+
    '<div class="t872-muted t872-para">Status: Pass when |energy bias| ≤ 2%, interval nMAE ≤ 3% and the last-7-day residual has not shifted by more than 1.5 pp. A positive residual shift that persists usually means a new unrecorded loss (string or SCB fault, tracker error, unmetered outage); a negative one usually means a sensor drift or a cleaning that the soiling station did not see.</div>';
  var dd='';
  if(!cur.error){var rows=cur.B.days.slice().reverse();
    dd='<h4 class="t872-h4">3 · Daily residual — '+esc(plantName(M))+'</h4><div class="t872-muted t872-para">Residual = modelled delivery − metered delivery, as % of modelled. Bars above zero are energy the model expected but the meter did not see.</div>'+residualChart(cur)+
    '<div class="t872-tablewrap"><table class="t872-table"><thead><tr><th>Date</th><th>Sky</th><th class="num">Clear-sky index</th><th class="num">Modelled MWh</th><th class="num">Metered MWh</th><th class="num">Residual</th><th class="num">PR</th><th class="num">Availability loss</th><th class="num">Curtailment</th><th class="num">Interval nMAE</th></tr></thead><tbody>'+
    rows.map(function(x){return '<tr'+(x.date===M.date?' class="t872-cur"':'')+'><td><b>'+esc(window.AIPDateDisplay884?window.AIPDateDisplay884(x.date):x.date)+'</b></td><td>'+skyClass(x.kc)+'</td><td class="num">'+(Number.isFinite(x.kc)?f2(x.kc):'—')+'</td><td class="num">'+f1(x.modelled)+'</td><td class="num">'+f1(x.actual)+'</td><td class="num">'+sgnp(x.residualPct)+'%</td><td class="num">'+(Number.isFinite(x.pr)?f1(x.pr)+'%':'—')+'</td><td class="num">'+f1(x.avail)+' MWh</td><td class="num">'+f1(x.curt)+' MWh</td><td class="num">'+f2(x.nMAE)+'%</td></tr>'}).join('')+'</tbody></table></div>';}
  // old vs new for this site (legacy stored Twin Loss Model row)
  var L=R('Twin Loss Model').find(function(r){return sameId(r.Plant_ID,M.id)})||{},T=M.D.totals;
  var map=[['Clear-sky / gross reference','Gross_Expected_MWh',T.s0],['Weather / resource','Weather_Resource_Loss_MWh',T.loss.weather],['Reflection (IAM)',null,T.loss.iam],['Bifacial rear-side gain',null,T.loss.bifacial],['Low-irradiance efficiency',null,T.loss.lowlight],['Temperature','Temperature_Loss_MWh',T.loss.temperature],['Soiling','Soiling_Loss_MWh',T.loss.soiling],['Shading / DC design','Shading_Loss_MWh',T.loss.dcdesign],['Degradation','Degradation_Loss_MWh',T.loss.degradation],['Inverter conversion',null,T.loss.conversion],['Clipping & derate','Clipping_Loss_MWh',T.loss.clipping],['Transformer / AC','Transformer_AC_Loss_MWh',T.loss.acxfmr],['Availability','Availability_Loss_MWh',T.loss.availability],['Curtailment','Curtailment_Loss_MWh',T.loss.curtailment],['Residual','Residual_Loss_MWh',T.loss.residual],['Delivered','Actual_MWh',T.actual]];
  var ov='<h4 class="t872-h4">4 · Legacy stored loss row versus native engine — '+esc(plantName(M))+', operating day</h4><div class="t872-muted t872-para">“Legacy” is the stored Twin Loss Model row from an earlier release; it is not reproducible from the telemetry and is shown for traceability only.</div><div class="t872-tablewrap"><table class="t872-table"><thead><tr><th>Line</th><th class="num">Legacy stored (MWh)</th><th class="num">Native engine (MWh)</th><th class="num">Difference</th></tr></thead><tbody>'+
    map.map(function(m){var lv=m[1]&&L[m[1]]!=null&&L[m[1]]!==''?n(L[m[1]]):NaN;return '<tr><td><b>'+m[0]+'</b></td><td class="num">'+(Number.isFinite(lv)?f1(lv):'not modelled')+'</td><td class="num">'+sgn(m[2])+'</td><td class="num">'+(Number.isFinite(lv)?sgn(m[2]-lv):'—')+'</td></tr>'}).join('')+'</tbody></table></div>';
  var dc=dataChecks(M);
  var dt='<h4 class="t872-h4">5 · Data consistency and model inputs — '+esc(plantName(M))+'</h4><div class="t872-muted t872-para">Computed at run time from the active data source. Findings do not change the engine result; they show what to fix in the masters.</div><div class="t872-tablewrap"><table class="t872-table"><thead><tr><th>Area</th><th>Finding</th><th>What it means</th><th>Status</th></tr></thead><tbody>'+
    dc.map(function(c){return '<tr><td><b>'+esc(c.area)+'</b></td><td>'+esc(c.finding)+'</td><td>'+esc(c.detail)+'</td><td>'+statusChip(c.status)+'</td></tr>'}).join('')+'</tbody></table></div>';
  return head+'<!--/kpis-->'+ct+st+dd+ov+dt;
}

/* ================= SCENARIO LAB ================= */
var SC={cloud:0,soil:0,curt:0,avail:0,temp:0,intervention:'Clean modules'};
var INTERVENTIONS=['Clean modules','Restore availability','Release curtailment'];
function scenarioCalc(M,i){
  var d={cloudPct:SC.cloud,soilingPct:SC.soil,curtailPct:SC.curt,availabilityPct:SC.avail,tempC:SC.temp};
  var post=Object.assign({},d);if(SC.intervention==='Clean modules')post.clean=true;if(SC.intervention==='Restore availability')post.restoreAvailability=true;if(SC.intervention==='Release curtailment')post.releaseCurtailment=true;
  var dt=M.D.dt,out={ref:0,scn:0,post:0,series:[]};
  M.D.intervals.forEach(function(x,k){var a=E.scenarioInterval(M.P,x.raw,d),b=E.scenarioInterval(M.P,x.raw,post);
    var scn=Math.max(0,x.actual+(a.states.s10-x.states.s10)),pst=Math.max(0,x.actual+(b.states.s10-x.states.s10));
    out.ref+=x.actual*dt;out.scn+=scn*dt;out.post+=pst*dt;out.series.push([x.t.hour,x.actual,scn,pst]);if(k===i){out.now={ref:x.actual,scn:scn,post:pst,a:a,b:b,x:x}}});
  return out;
}
function scenarioOut(M){
  var i=idxAt(M,selHour()),z=scenarioCalc(M,i),x=M.D.intervals[i],nw=z.now,tariff=M.tariff;
  var gainMW=nw.post-nw.scn,gainMWh=z.post-z.scn;window.AIP891Scenario={M,z,nw,gainMW,gainMWh,SC};
  var W=820,H=200,p=38,w=winRange(),pts=z.series.filter(function(s){return s[0]>=w.min-.001&&s[0]<=w.max+.001});
  var max=Math.max(1,M.P.acMW,Math.max.apply(null,pts.map(function(s){return Math.max(s[1],s[2],s[3])})))*1.08;
  var ln=function(k,c,dash){return '<path d="'+pathOf(pts.map(function(s){return [s[0],s[k]]}),w,W,H,p,max)+'" fill="none" stroke="'+c+'" stroke-width="2.4"'+(dash?' stroke-dasharray="7 4"':'')+'/>'};
  var svg='<svg class="ot297-chart" viewBox="0 0 '+W+' '+H+'" aria-label="Scenario day profile">'+axis(w,W,H,p,max,'MW')+ln(1,'#16a34a')+ln(2,'#e53935',true)+ln(3,'#1687b1')+marker(x.t.hour,w,W,H,p,null)+'</svg>';
  return kpis([['Reference delivered · now',f1(nw.ref),'MW','Measured at '+hhmm(x.t.minute)],['Scenario before action · now',f1(nw.scn),'MW'],['Post-intervention · now',f1(nw.post),'MW'],['Immediate recovery',(gainMW>=0?'+':'−')+f2(Math.abs(gainMW)),'MW']],true)+
    kpis([['Reference day energy',f1(z.ref),'MWh','Measured, operating day '+M.date],['Scenario day energy',f1(z.scn),'MWh'],['Day recovery from action',(gainMWh>=0?'+':'−')+f1(Math.abs(gainMWh)),'MWh'],['Indicative revenue recovery',Number.isFinite(tariff)?'₹'+f2(gainMWh*tariff/100):'—',Number.isFinite(tariff)?'lakh':'','At PPA tariff from Commercial & PPA']],true)+
    svg+'<div class="ot297-legend"><span><i class="lg-delivered"></i>Reference · measured</span><span><i class="lg-scn"></i>Scenario before action</span><span><i class="lg-weather"></i>Post-intervention</span><span><i class="lg-hour"></i>Selected solar hour</span></div>';
}
function scenarioSide(M){
  var x=M.D.intervals[idxAt(M,selHour())];
  return '<h3>Reference state inherited from twin · '+hhmm(x.t.minute)+'</h3><div class="ot297-causal" style="margin-top:9px">'+
    '<div><span>POA irradiance · computed clear-sky</span><b>'+f0(x.poa)+' / '+f0(x.clearSky.poa)+' W/m²</b></div><div><span>Module temperature</span><b>'+f1(x.tUsed)+' °C</b></div><div><span>Soiling loss</span><b>'+f1((1-x.soilingRatio)*100)+'%</b></div><div><span>Availability</span><b>'+f2(x.availability*100)+'%</b></div><div><span>POI curtailment</span><b>'+f1(x.curtailment*100)+'%</b></div><div><span>Model residual carried unchanged</span><b>'+sgn(x.loss.residual,f2)+' MW</b></div></div>'+
    '<div class="t872-note">'+esc(SC.intervention)+': '+(SC.intervention==='Clean modules'?'soiling ratio set to 1.000':SC.intervention==='Restore availability'?'availability set to 100%':'curtailment set to 0% (compensable energy; recovery depends on grid and PPA terms)')+'. Temperature and cloud changes act through the temperature coefficient and POA; clipping and inverter part-load efficiency respond automatically.</div>';
}
var SCN_LEVERS=[['t872Cloud','cloud','Cloud attenuation delta',-20,45,1,'%'],['t872Soil','soil','Soiling loss delta',-3,8,.2,' pp'],['t872Curt','curt','POI curtailment delta',0,40,1,' pp'],['t872Avail','avail','Availability delta',-20,5,.5,' pp'],['t872Temp','temp','Temperature stress delta',-8,15,1,' °C']];
function leverText(l){var v=SC[l[1]];return (v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(l[5]<1?1:0)+l[6]}
function renderScenario(M){
  var body=$('#twBody');if(!body)return;var x=M.D.intervals[idxAt(M,selHour())];
  var th=$('#tHour');if(th)th.textContent=hhmm(x.t.minute);var tk=$('#tKpis');if(tk)tk.innerHTML='';
  body.innerHTML=lineage(M)+'<div class="ot297-scenario t872-scen"><section class="ot297-card"><h3>Governed Scenario Lab · reference case versus what-if case</h3><div class="t872-subline">Every lever changes an input of the same physics chain used in Physics & Losses; results are integrated over the operating day. Scenario = measured delivery + modelled change, so with no changes the scenario equals the reference exactly.</div>'+
    '<div class="ot297-controls">'+SCN_LEVERS.map(function(l){return '<div class="ot297-control"><label><span>'+l[2]+'</span><b id="'+l[0]+'V">'+leverText(l)+'</b></label><input id="'+l[0]+'" type="range" min="'+l[3]+'" max="'+l[4]+'" step="'+l[5]+'" value="'+SC[l[1]]+'"></div>'}).join('')+
    '<div class="ot297-control"><label><span>Intervention to test</span><b>what-if</b></label><select id="t872Int">'+INTERVENTIONS.map(function(v){return '<option'+(v===SC.intervention?' selected':'')+'>'+v+'</option>'}).join('')+'</select></div></div>'+
    '<div id="t872ScnOut">'+scenarioOut(M)+'</div>'+
    '<div class="ot297-actions"><button class="primary" id="t872Reset" type="button">Reset to reference</button><button id="t872Pred" type="button">Compare prediction</button><span class="t872-chip info">Advisory only · no plant control</span></div></section>'+
    '<aside class="ot297-card" id="t872ScnSide">'+scenarioSide(M)+'</aside></div>';
  var repaint=function(){var o=$('#t872ScnOut');if(o)o.innerHTML=scenarioOut(M);var sd=$('#t872ScnSide');if(sd)sd.innerHTML=scenarioSide(M)};
  SCN_LEVERS.forEach(function(l){var e=$('#'+l[0]);if(e)e.oninput=function(){SC[l[1]]=+e.value;var lb=$('#'+l[0]+'V');if(lb)lb.textContent=leverText(l);repaint()}});
  var si=$('#t872Int');if(si)si.onchange=function(e){SC.intervention=e.target.value;repaint()};
  var rs=$('#t872Reset');if(rs)rs.onclick=function(){SC={cloud:0,soil:0,curt:0,avail:0,temp:0,intervention:'Clean modules'};renderScenario(M)};
  var pr=$('#t872Pred');if(pr)pr.onclick=function(){go('Generation Forecast')};
}

/* ---------------- Entry point used by the legacy renderers' one-line guards ---------------- */
function go(tab){if(typeof window.AIPActivateOperationalTwinLayer==='function')window.AIPActivateOperationalTwinLayer(tab)}
var BUSY=false;
function render(tab){
  if(BUSY)return true;
  var v=$('#view-operationaltwin');if(!v||!$('#twBody',v))return false;
  var M;try{M=modelFor(pid(),window.AIP_TWIN_DAY)}catch(e){console.error('[AIP v872 twin]',e);return false}
  if(!M||M.error){if(M&&M.error&&/Missing governed parameter/.test(M.error)){unavailable(M.error);return true}return false}
  BUSY=true;
  try{if(tab==='Live Plant')renderLive(M);else if(tab==='Physics & Losses')renderLoss(M);else if(tab==='Scenario Lab')renderScenario(M);else{BUSY=false;return false}}
  catch(e){console.error('[AIP v872 twin]',e);BUSY=false;return false}
  BUSY=false;v.setAttribute('data-twin-engine','native-v872');return true;
}
document.addEventListener('aip:data-source-changed',function(){CACHE={};HIST={}});
window.AIP_TWIN872={sourceRows:R,version:E.version,render:render,model:function(id){return modelFor(id||pid())},modelDay:function(id,day){return modelFor(id||pid(),day)},history:function(id){return historyFor(id||pid())},openValidation:function(){LOSS_VIEW='validation';go('Physics & Losses')},scenario:function(){return Object.assign({},SC)},
  audit:{release:'v872',scope:'Operational Twin · Live Plant, Physics & Losses, Scenario Lab',engine:'AIPTwinPhysics '+E.version,embeddedData:false,
    dataSources:['Twin Engineering Parameters','Twin Telemetry','Sites','Commercial & PPA','Asset Master','Twin Loss Model (legacy comparison only)','VE_Rate_Config (consistency check only)'],
    unchangedTabs:['Asset Condition','Visual Evidence','Generation Forecast']}};
/* Register the twin input sheets with the workbook importer so an imported workbook refreshes the engine */
try{if(typeof APM_SHEET_RULES!=='undefined'&&APM_SHEET_RULES){
  if(!APM_SHEET_RULES['Twin Engineering Parameters'])APM_SHEET_RULES['Twin Engineering Parameters']={required:['Plant_ID','AC_Capacity_MW','DC_AC_Ratio','Latitude_Deg','Longitude_Deg'],key:['Plant_ID'],group:'Operational Twin'};
  if(!APM_SHEET_RULES['Twin Telemetry'])APM_SHEET_RULES['Twin Telemetry']={required:['Timestamp','Plant_ID','POA_Wm2','Actual_AC_MW'],key:['Plant_ID','Timestamp','Weather_Mode'],group:'Operational Twin'};
}}catch(_){}
})();


/* Operating-day selector: Live Plant, Physics & Losses and Scenario Lab replay any observed day; other tabs hold data for the latest day only */
(function(){
'use strict';
var DAYTABS={'Live Plant':1,'Physics & Losses':1,'Scenario Lab':1};
function dd(d){var m=String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'-'+m[2]+'-'+m[1].slice(2):d}
function activeTab(){var b=document.querySelector('#view-operationaltwin #tLayers .xi-tab.active');return b?b.textContent.trim():''}
function sync(){
  var v=document.getElementById('view-operationaltwin'),badge=v&&v.querySelector('#ot325OperatingDay');if(!badge||!window.AIP_TWIN872)return;
  var M;try{M=window.AIP_TWIN872.modelDay(null,window.AIP_TWIN_DAY)}catch(_){return}if(!M||M.error||!M.dates)return;
  var sel=v.querySelector('#t887Day');
  if(!sel){sel=document.createElement('select');sel.id='t887Day';sel.className='ot325-operating-day t887-day';sel.title='Operating day';
    badge.parentNode.insertBefore(sel,badge.nextSibling);
    var note=document.createElement('span');note.id='t887DayNote';note.className='t887-day-note';sel.parentNode.insertBefore(note,sel.nextSibling);
    sel.onchange=function(){window.AIP_TWIN_DAY=sel.value===M.latest?null:sel.value;var t=activeTab();if(DAYTABS[t]&&typeof window.AIPActivateOperationalTwinLayer==='function')window.AIPActivateOperationalTwinLayer(t);setTimeout(sync,50)};}
  var key=M.dates.join('|');
  if(sel.dataset.key!==key){sel.innerHTML=M.dates.slice().reverse().map(function(d){return '<option value="'+d+'">Operating day · '+dd(d)+(d===M.latest?' · latest':'')+'</option>'}).join('');sel.dataset.key=key}
  sel.value=M.date;badge.style.display='none';
  var t=activeTab(),note=v.querySelector('#t887DayNote'),single=!DAYTABS[t]&&t!=='';
  sel.disabled=single;
  if(note)note.textContent=single?(t+' holds data for '+dd(M.latest)+' only'):(M.dates.length>1?M.dates.length+' observed days':'');
}
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#view-operationaltwin #tLayers, #view-operationaltwin #tSite'))setTimeout(sync,120)},true);
document.addEventListener('change',function(e){if(e.target&&e.target.id==='tSite')setTimeout(sync,150)},true);
document.addEventListener('aip:data-source-changed',function(){window.AIP_TWIN_DAY=null;var s=document.getElementById('t887Day');if(s)s.dataset.key='';setTimeout(sync,400)});
var st=document.createElement('style');st.textContent='#view-operationaltwin .t887-day{border:1px solid #bcd3dc;background:#fff;color:#12384F;font:700 10px/1.2 Arial,sans-serif;border-radius:10px;padding:3px 6px;cursor:pointer}#view-operationaltwin .t887-day:disabled{opacity:.6;cursor:not-allowed}#view-operationaltwin .t887-day-note{font:10px Arial,sans-serif;color:#78909c;margin-left:6px}';
document.head.appendChild(st);
var obs=new MutationObserver(function(){var v=document.getElementById('view-operationaltwin');if(v&&v.querySelector('#ot325OperatingDay')&&!v.querySelector('#t887Day'))sync()});
function start(){var v=document.getElementById('view-operationaltwin');if(!v)return setTimeout(start,300);obs.observe(v,{childList:true,subtree:true});sync()}
start();
window.AIPTwinDaySync=sync;
})();

/* AIP v887 · Portfolio physics forecast for the Operations Hub card (no ML; ML residual correction is not trained).
   Uses the same engine and forecast chain as Operational Twin → Generation Forecast, for every site's latest weather snapshot. */
(function(){
'use strict';
var E,F;
function n(v,d){var x=Number(v);return Number.isFinite(x)?x:(d===undefined?0:d)}
function same(a,b){return String(a==null?'':a).trim()===String(b==null?'':b).trim()}
function synth(){return window.AIP_SYNTHETIC_ACTIVE===true||/synthetic/i.test(String(window.APM_DATA_MODE||''))}
function store(){var s=null;try{s=(typeof APM_IMPORTED_DATA!=='undefined'&&APM_IMPORTED_DATA)||null}catch(_){}if(s)return s;try{return synth()?AIP_INDEPENDENT_SYNTHETIC_DATA:EMBEDDED_EXCEL_DATA}catch(_){return synth()?window.AIP_INDEPENDENT_SYNTHETIC_DATA:window.EMBEDDED_EXCEL_DATA}}
function R(k){if(window.AIP891?.isUploaded())return window.AIP891.raw(k);var a=store();a=a&&a[k];return Array.isArray(a)?a:[]}
var CACHE=null;
function portfolio(h){
  E=window.AIPTwinPhysics;F=window.AIPForecast;if(!E||!F)return {available:false};
  h=h||24;var key=(synth()?'S':'X')+'|'+h+'|'+R('Forecast Weather').length+'|'+R('Twin Telemetry').length;
  if(CACHE&&CACHE.key===key)return CACHE.v;
  var T=window.AIP_TWIN872;if(!T)return {available:false};
  var ids=R('Twin Engineering Parameters').map(function(p){return p.Plant_ID}),tot={forecastMWh:0,weatherMWh:0,atRiskMWh:0,exposureINR:0,sites:0,runs:[],byPlant:[],bias:[],nmae:[],mod:0,act:0,days:0};
  ids.forEach(function(id){
    var M=T.model(id);if(!M||M.error)return;
    var runs=R('Forecast Runs').filter(function(r){return same(r.Plant_ID,id)}).sort(function(a,b){return String(a.Forecast_Run_Timestamp).localeCompare(String(b.Forecast_Run_Timestamp))});
    var W=R('Forecast Weather').filter(function(r){return same(r.Plant_ID,id)});
    runs=runs.filter(function(r){return W.some(function(w){return same(w.Forecast_Run_Timestamp,r.Forecast_Run_Timestamp)})});
    var run=runs[runs.length-1];if(!run)return;
    var t0=F.ms(run.Forecast_Run_Timestamp),w=W.filter(function(r){var lead=(F.ms(r.Interval_Start)-t0)/3.6e6;return same(r.Forecast_Run_Timestamp,run.Forecast_Run_Timestamp)&&lead>0&&lead<=h}).map(function(r){return Object.assign({},r,{Lead_Hours:(F.ms(r.Interval_Start)-t0)/3.6e6})});
    if(!w.length)return;
    var cutoff=run.Observation_Window_End||run.Forecast_Run_Timestamp,obs=M.rows.filter(function(r){return F.ms(r.Timestamp)<=F.ms(cutoff)}),last=obs[obs.length-1]||{};
    var set=R('Forecast Settings').find(function(s){return same(s.Plant_ID,id)})||{};
    var S=F.series(M.P,w,run,{soilingRatio:n(last.Soiling_Ratio,1),soilingRatePerDay:n(set.Soiling_Rate_Pct_per_Day,0),outages:R('Planned Outages'),settings:set}),sm=F.sums(S);
    var risk=sm.outage+sm.curtail+sm.asset,tariff=n((R('Commercial & PPA').find(function(r){return same(r.Plant_ID,id)})||{}).PPA_Tariff_INR_kWh,NaN);
    tot.forecastMWh+=sm.delivered;tot.weatherMWh+=sm.weather;tot.atRiskMWh+=risk;if(Number.isFinite(tariff))tot.exposureINR+=risk*1000*tariff;tot.sites++;tot.runs.push(run.Forecast_Run_Timestamp);
    tot.byPlant.push({id:id,risk:risk,exposure:Number.isFinite(tariff)?risk*1000*tariff:0});
    try{var H=T.history(id);if(H&&!H.error){tot.mod+=H.B.modelled;tot.act+=H.B.actual;tot.nmae.push(H.B.nMAE);tot.days=Math.max(tot.days,H.days)}}catch(_){}
  });
  if(!tot.sites)return {available:false};
  tot.byPlant.sort(function(a,b){return b.exposure-a.exposure});
  var v={available:true,basis:'physics',forecastMWh:Math.round(tot.forecastMWh*10)/10,energyAtRisk:Math.round(tot.atRiskMWh*10)/10,exposureINR:Math.round(tot.exposureINR),siteCount:tot.sites,
    latestRun:tot.runs.sort().pop(),hindcastNMAE:tot.nmae.length?Math.round(tot.nmae.reduce(function(s,x){return s+x},0)/tot.nmae.length*100)/100:null,
    hindcastBias:tot.act>0?Math.round((tot.mod-tot.act)/tot.act*1000)/10:null,hindcastDays:tot.days,
    topPlant:tot.byPlant[0]&&tot.byPlant[0].exposure>0?tot.byPlant[0].id:null,topExposure:tot.byPlant[0]?Math.round(tot.byPlant[0].exposure):null};
  CACHE={key:key,v:v};return v;
}
window.AIPTwinPortfolioForecast=portfolio;
document.addEventListener('aip:data-source-changed',function(){CACHE=null});
})();

try{window.AIP_CURRENT_BUILD='v891'}catch(_){}
