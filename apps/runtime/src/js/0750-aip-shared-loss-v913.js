(function(){
'use strict';
const fields=[['Soiling','Soiling_Loss_MWh','Cleaning / Operations'],['Equipment unavailability','Inverter_Loss_MWh','Maintenance / ERCI'],['Planned maintenance','Planned_Maintenance_Loss_MWh','Maintenance Planning'],['Grid outage','Grid_Outage_Loss_MWh','Commercial & PPA'],['Unallocated availability','Availability_Unallocated_MWh','Event & Root Cause Intelligence'],['Curtailment','Curtailment_Loss_MWh','Commercial & PPA'],['Unallocated / model residual (signed)','Unexplained_Loss_MWh','Event & Root Cause Intelligence']];
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const source=n=>window.AIP_TWIN872?.sourceRows(n)||[];
const stamp=v=>Date.parse(String(v||'').replace(' ','T').replace(/Z$/,'')+'Z');
let cached=null,refs=[];
function evidence(id){return [...source('Planned Outages'),...source('Event Log')].filter(r=>String(r.Plant_ID)===String(id)).map(r=>{
 const start=stamp(r.Actual_Start||r.Outage_Start||r.Start),end=stamp(r.Actual_End||r.Outage_End||r.End);
 const status=String(r.Status||r.Event_Status||'').toLowerCase();
 const text=String(r.Loss_Cause||r.Cause||r.Reason||r.Event_Type||'').toLowerCase();
 const kind=/grid|utility/.test(text)?'grid':/planned|scheduled maintenance/.test(text)?'planned':/inverter|transformer|tracker|string|equipment/.test(text)?'equipment':null;
 const capacity=num(r.Capacity_Out_MW)?Number(r.Capacity_Out_MW):null;
 return {start,end,kind,capacity,siteWide:r.Scope==='Site'||r.Asset_Scope==='Site',valid:/^(completed|closed|confirmed|actual)$/.test(status)&&end>start&&!!kind};
 }).filter(r=>r.valid);}
function interval(P,r,dt,events){
 const E=window.AIPTwinPhysics,x=E.interval(P,r);if(!x)return null;
 const clean=E.scenarioInterval(P,r,{clean:true});
 const loss=Object.fromEntries(fields.map(f=>[f[1],0]));
 loss.Soiling_Loss_MWh=(clean.expectedPOI-x.expectedPOI)*dt;
 loss.Curtailment_Loss_MWh=x.loss.curtailment*dt;
 loss.Unexplained_Loss_MWh=x.loss.residual*dt;
 const unavailable=x.loss.availability*dt,t=stamp(r.Timestamp),end=t+dt*3600000;
 const hit=events.filter(e=>e.start<end&&e.end>t);
 // Conflicting or asset-only evidence without capacity remains unallocated.
 let matched=0,kind=null;
 if(hit.length===1){const e=hit[0],fraction=Math.max(0,Math.min(end,e.end)-Math.max(t,e.start))/(dt*3600000);const share=e.siteWide?1:e.capacity!==null?Math.max(0,Math.min(1,e.capacity/P.acMW)):0;matched=Math.min(unavailable,x.expectedPOI*dt*fraction*share);kind=e.kind;}
 const map={grid:'Grid_Outage_Loss_MWh',planned:'Planned_Maintenance_Loss_MWh',equipment:'Inverter_Loss_MWh'};
 if(kind)loss[map[kind]]=matched;
 loss.Availability_Unallocated_MWh=unavailable-matched;
 const recover={Soiling_Loss_MWh:Math.max(0,(clean.modelledDelivery-x.modelledDelivery)*dt),Inverter_Loss_MWh:kind==='equipment'?matched*(1-x.curtailment):0};
 return {expected:clean.expectedPOI*dt,actual:x.actual*dt,loss,recover,raw:x};
}
function calculate(){
 const data=source('Twin Telemetry'),params=source('Twin Engineering Parameters'),sites=source('Sites'),tariffs=source('Commercial & PPA');
 const current=[data,params,sites,tariffs,source('Planned Outages'),source('Event Log'),source('SUS_Generation')];
 if(cached&&current.every((v,i)=>v===refs[i]))return cached;
 const E=window.AIPTwinPhysics;if(!E||!params.length||!data.length)return {rows:[],issues:['Observed telemetry or engineering parameters unavailable'],period:'Unavailable'};
 const groups=new Map(),issues=[];
 for(const r of data){if(String(r.Weather_Mode||'Observed')!=='Observed')continue;const t=E.parseStamp(r.Timestamp);if(!t)continue;const id=String(r.Plant_ID);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}
 const models=[];
 for(const p of params){const id=String(p.Plant_ID),all=groups.get(id)||[],dates=[...new Set(all.map(r=>String(r.Timestamp).slice(0,10)))].sort();if(!dates.length){issues.push(id+': no observed telemetry');continue;}const P=E.plantParams(p,sites.find(s=>String(s.Plant_ID)===id)||null,Number(dates[0].slice(0,4)));if(E.missingParams(P).length){issues.push(id+': incomplete engineering parameters');continue;}models.push({id,P,all,dates,name:p.Plant_Name||sites.find(s=>String(s.Plant_ID)===id)?.Plant_Name||id});}
 let common=models.length?models[0].dates.filter(d=>models.every(m=>m.dates.includes(d))):[];
 const period=common.length?common[0]+' to '+common.at(-1)+' · '+common.length+' observed days':'No common observed dates';
 const rows=[];
 for(const m of models){if(!common.length)break;const row={Plant_ID:m.id,Plant_Name:m.name,Period:period,Month:common.at(-1),Period_Start:common[0],Period_End:common.at(-1),Observed_Days:common.length,Weather_Adjusted_Expected_MWh:0,Actual_Generation_MWh:0,Recoverable_Loss_MWh:0,Recovery_By_Driver:{Soiling_Loss_MWh:0,Inverter_Loss_MWh:0},Intervals:0,Excluded_Intervals:0,Duplicate_Intervals:0,Missing_Intervals:0,Attribution_Status:'Calculated from observed telemetry; availability needs matched event evidence',...Object.fromEntries(fields.map(f=>[f[1],0]))};
  const ev=evidence(m.id);let rejected=0;
  for(const date of common){const raw=m.all.filter(r=>String(r.Timestamp).slice(0,10)===date).sort((a,b)=>stamp(a.Timestamp)-stamp(b.Timestamp));const distinct=new Map();for(const r of raw){const k=String(r.Timestamp);if(distinct.has(k)){row.Duplicate_Intervals++;distinct.set(k,null)}else distinct.set(k,r)}const valid=[...distinct.values()].filter(Boolean);const diffs=[];for(let i=1;i<raw.length;i++){const d=(stamp(raw[i].Timestamp)-stamp(raw[i-1].Timestamp))/3600000;if(d>0&&d<=1)diffs.push(d)}diffs.sort((a,b)=>a-b);if(!diffs.length){rejected+=raw.length;continue;}const dt=diffs[Math.floor(diffs.length/2)];for(let i=1;i<raw.length;i++){const delta=(stamp(raw[i].Timestamp)-stamp(raw[i-1].Timestamp))/3600000;if(delta>dt*1.5)row.Missing_Intervals+=Math.max(0,Math.round(delta/dt)-1)}
   for(const r of valid){if(!['POA_Wm2','Actual_AC_MW','Availability_Pct','Soiling_Ratio','Curtailment_Pct'].every(k=>num(r[k]))||Number(r.Availability_Pct)<0||Number(r.Availability_Pct)>100||Number(r.Soiling_Ratio)<0||Number(r.Soiling_Ratio)>1||Number(r.Curtailment_Pct)<0||Number(r.Curtailment_Pct)>100||Number(r.Actual_AC_MW)<0||Number(r.POA_Wm2)<0||!['Module_Temp_C','Ambient_Temp_C'].some(k=>num(r[k]))){rejected++;continue;}
    const x=interval(m.P,r,dt,ev);if(!x||!Number.isFinite(x.expected)||!Number.isFinite(x.actual)){rejected++;continue;}row.Intervals++;row.Weather_Adjusted_Expected_MWh+=x.expected;row.Actual_Generation_MWh+=x.actual;for(const [,k] of fields)row[k]+=x.loss[k];for(const k of Object.keys(row.Recovery_By_Driver))row.Recovery_By_Driver[k]+=x.recover[k]||0;
   }
  }
  row.Excluded_Intervals=rejected;row.Total_Loss_MWh=row.Weather_Adjusted_Expected_MWh-row.Actual_Generation_MWh;row.Recoverable_Loss_MWh=Object.values(row.Recovery_By_Driver).reduce((a,b)=>a+b,0);row.External_Loss_MWh=row.Grid_Outage_Loss_MWh+row.Curtailment_Loss_MWh;row.Unallocated_Loss_MWh=row.Availability_Unallocated_MWh+row.Unexplained_Loss_MWh;row.Reconciliation_Error_MWh=row.Total_Loss_MWh-fields.reduce((sum,[,k])=>sum+row[k],0);const rate=tariffs.find(t=>String(t.Plant_ID)===m.id);row.Tariff_INR_kWh=rate&&num(rate.PPA_Tariff_INR_kWh)?Number(rate.PPA_Tariff_INR_kWh):null;row.Recoverable_Revenue_INR=row.Tariff_INR_kWh===null?null:row.Recoverable_Loss_MWh*1000*row.Tariff_INR_kWh;
  if(rejected||row.Duplicate_Intervals||row.Missing_Intervals)issues.push(m.id+': '+rejected+' invalid, '+row.Duplicate_Intervals+' duplicate and '+row.Missing_Intervals+' missing intervals; no extrapolation');if(row.Intervals)rows.push(row);else issues.push(m.id+': no valid intervals');
 }
 refs=current;cached={rows,period,issues,dates:common,basis:'Clean expected POI minus metered output; signed residual retained'};return cached;
}
function periodHtml(){const d=calculate();const annual=source('SUS_Generation').filter(r=>r.Plant_ID!=='PORTFOLIO'&&num(r.Expected_MWh)&&num(r.Net_MWh));const periods=[...new Set(annual.map(r=>String(r.Period||'')))];const reference=annual.length&&periods.length===1?'<span>Separate '+esc(periods[0])+' portfolio workbook generation gap: '+annual.reduce((s,r)=>s+Number(r.Expected_MWh)-Number(r.Net_MWh),0).toLocaleString('en-IN',{maximumFractionDigits:2})+' MWh; not included in the observed-period calculation.</span>':'';return '<div class="loss913-period"><b>Observed telemetry: '+esc(d.period)+'</b><span>Clean expected output at POI → metered output. Negative residuals mean metered output exceeds the model. Recovery is a modelled opportunity and can exceed the net gap; unmatched availability stays unallocated.</span>'+reference+(d.issues.length?'<span>'+esc(d.issues.join('; '))+'</span>':'')+'</div>';}
function summary(id){const d=calculate(),rows=d.rows.filter(r=>String(r.Plant_ID)===String(id));if(!rows.length)return periodHtml();const r=rows[0],f=v=>Number(v).toLocaleString('en-IN',{maximumFractionDigits:2});return '<div class="loss913-twin">'+periodHtml()+'<b>Same-period site loss: '+f(r.Total_Loss_MWh)+' MWh · modelled recoverable: '+f(r.Recoverable_Loss_MWh)+' MWh · external: '+f(r.External_Loss_MWh)+' MWh · unallocated / signed residual: '+f(r.Unallocated_Loss_MWh)+' MWh</b></div>';}
function dayRecovery(M,i){let soil=0,equipment=0;const ev=evidence(M.id);for(const x of M.D.intervals.slice(0,i+1)){const a=interval(M.P,x.raw,M.D.dt,ev);if(a){soil+=a.recover.Soiling_Loss_MWh;equipment+=a.recover.Inverter_Loss_MWh;}}return {soil,equipment,total:soil+equipment};}
function reset(){cached=null;refs=[]}
window.AIPSharedLoss913={get:calculate,rows:()=>calculate().rows,fields,periodHtml,summary,dayRecovery,interval,evidence,reset};
for(const name of ['aip:data-source-changed','apm:datasource-refreshed','aip:runtime-ready'])window.addEventListener(name,reset);
})();

