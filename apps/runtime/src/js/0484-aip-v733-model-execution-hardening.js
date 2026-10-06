
(function(){
'use strict';
const REGISTRY=[
 {domain:'Forecasting',id:'EPM-2026.08R1',name:'PV physics forecast',execution:'NATIVE AIP',status:'ACTIVE',classification:'Coded & Executed',data:'Excel/Synthetic weather + asset state',productionBoundary:'Customer SCADA/NWP calibration required for production acceptance'},
 {domain:'Forecasting',id:'MDL-SFRC-012',name:'Gradient Boosting residual correction',execution:'NATIVE AIP',status:'ACTIVE-DEMO',classification:'Coded & Executed (demo-trained)',data:'Embedded governed demo model; 55 estimators, depth 2, Huber',productionBoundary:'Retrain and validate on customer historical SCADA/NWP before production claim'},
 {domain:'Forecasting',id:'CAL-INT-080-001',name:'Empirical 80% interval calibration',execution:'NATIVE AIP',status:'ACTIVE-DEMO',classification:'Coded & Executed (demo-calibrated)',data:'Historical/synthetic forecast errors by lead bucket',productionBoundary:'Recalibrate coverage on customer history'},
 {domain:'Forecasting',id:'BEN-PERSIST-001',name:'Persistence/seasonal challenger',execution:'NATIVE AIP',status:'VALIDATION',classification:'Validation / Governance',data:'Recent actual/normalized output',productionBoundary:'Benchmark only; not production forecast authority'},
 {domain:'Optimization',id:'OPT-MILP-NATIVE',name:'MILP scheduling optimizer',execution:'NATIVE AIP',status:'ACTIVE',classification:'Coded & Executed',data:'Excel/Synthetic work, resource, constraint and value inputs',productionBoundary:'Runtime solution; inputs require customer integration for production'},
 {domain:'Optimization',id:'OPT-VALIDATOR',name:'Constraint and solution validator',execution:'NATIVE AIP',status:'ACTIVE',classification:'Validation / Governance',data:'Runtime model + solver solution',productionBoundary:'Approval remains governed/human-controlled'},
 {domain:'Prediction',id:'PDM-PEER',name:'Peer residual / peer-string comparison',execution:'NATIVE AIP',status:'ACTIVE',classification:'Coded & Executed',data:'Telemetry/peer observations',productionBoundary:'Requires adequate peer/telemetry coverage'},
 {domain:'Prediction',id:'PDM-CUSUM',name:'CUSUM change-point detection',execution:'NATIVE AIP',status:'ACTIVE',classification:'Coded & Executed',data:'Chronological condition/telemetry series',productionBoundary:'Thresholds require site calibration'},
 {domain:'Prediction',id:'PDM-WEIBULL',name:'Weibull reliability / hazard',execution:'NATIVE AIP',status:'ACTIVE-WHEN-EVIDENCE-SUFFICIENT',classification:'Coded & Executed',data:'Observed failure/replacement events',productionBoundary:'Evidence gate applies; insufficient history must not fabricate output'},
 {domain:'Prediction',id:'PDM-MTBF',name:'MTBF / MTTR / failure-rate analytics',execution:'NATIVE AIP',status:'ACTIVE',classification:'Derived Calculation',data:'Observed events/work orders',productionBoundary:'Descriptive reliability analytics; not an ML prediction'},
 {domain:'Prediction',id:'PDM-IF',name:'Isolation Forest',execution:'EXTERNAL ML',status:'NOT CONFIGURED',classification:'Prepared / Model Evidence Only',data:'Prepared demo evidence where present',productionBoundary:'No native trained inference claim'},
 {domain:'Prediction',id:'PDM-AE',name:'Autoencoder anomaly model',execution:'EXTERNAL ML',status:'NOT CONFIGURED',classification:'Prepared / Model Evidence Only',data:'Prepared demo evidence where present',productionBoundary:'No native trained inference claim'},
 {domain:'Prediction',id:'PDM-XGB',name:'XGBoost/LightGBM failure prediction',execution:'EXTERNAL ML',status:'NOT CONFIGURED',classification:'Prepared / Model Evidence Only',data:'Prepared demo evidence where present',productionBoundary:'Customer failure/condition history and trained model required'},
 {domain:'Prediction',id:'PDM-SURV',name:'Survival/RUL model',execution:'EXTERNAL ML',status:'NOT CONFIGURED',classification:'Prepared / Model Evidence Only',data:'Prepared demo evidence where present',productionBoundary:'Censored lifetime history and trained survival model required'}
];
function num(x){x=Number(x);return Number.isFinite(x)?x:null}
function metrics(actual,pred,lo,hi){
 const a=[],p=[]; for(let i=0;i<Math.min(actual||[].length,pred||[].length);i++){const x=num(actual[i]),y=num(pred[i]);if(x!==null&&y!==null){a.push(x);p.push(y)}}
 const n=a.length;if(!n)return {n:0,mae:null,rmse:null,bias:null,nmae:null,coverage:null};
 let ae=0,se=0,b=0,den=0,cov=0,covn=0; for(let i=0;i<n;i++){const e=p[i]-a[i];ae+=Math.abs(e);se+=e*e;b+=e;den+=Math.abs(a[i]);if(lo&&hi){const l=num(lo[i]),h=num(hi[i]);if(l!==null&&h!==null){covn++;if(a[i]>=l&&a[i]<=h)cov++}}}
 return {n,mae:ae/n,rmse:Math.sqrt(se/n),bias:b/n,nmae:den?ae/den:null,coverage:covn?cov/covn:null};
}
function chronologicalSplit(rows,ratio=.7){const x=(rows||[]).slice().sort((a,b)=>new Date(a.ts||a.Timestamp||a.date)-new Date(b.ts||b.Timestamp||b.date));const cut=Math.max(1,Math.min(x.length-1,Math.floor(x.length*ratio)));return {train:x.slice(0,cut),holdout:x.slice(cut)};}
function evidenceGate(opts){opts=opts||{};const n=Number(opts.events||0),days=Number(opts.historyDays||0);const needN=Number(opts.minEvents||5),needD=Number(opts.minDays||30);return {eligible:n>=needN&&days>=needD,events:n,historyDays:days,minEvents:needN,minDays:needD,reason:n<needN?'insufficient observed events':days<needD?'insufficient history':'evidence sufficient'};}
function cusum(series,k=.5,h=5){let pos=0,neg=0,alarms=[];const xs=(series||[]).map(Number).filter(Number.isFinite);if(xs.length<3)return {alarms,eligible:false};const mean=xs.reduce((a,b)=>a+b,0)/xs.length;const sd=Math.sqrt(xs.reduce((s,x)=>s+(x-mean)*(x-mean),0)/Math.max(1,xs.length-1))||1;xs.forEach((x,i)=>{const z=(x-mean)/sd;pos=Math.max(0,pos+z-k);neg=Math.min(0,neg+z+k);if(pos>h||neg<-h){alarms.push({index:i,value:x,direction:pos>h?'up':'down'});pos=0;neg=0}});return {eligible:true,mean,sd,alarms};}
function selfTest(){const tests=[];function t(name,ok,detail){tests.push({name,ok:!!ok,detail:detail||''})}
 const m=metrics([10,20,30],[11,18,33],[8,17,25],[12,22,35]);t('forecast metrics executable',m.n===3&&Math.abs(m.mae-2)<1e-9&&m.coverage===1,JSON.stringify(m));
 const sp=chronologicalSplit([{ts:'2026-01-03'},{ts:'2026-01-01'},{ts:'2026-01-02'}],2/3);t('chronological holdout',sp.train.length===2&&sp.train[0].ts==='2026-01-01','time ordered');
 t('predictive evidence gate blocks sparse history',evidenceGate({events:2,historyDays:90}).eligible===false,'no fabricated model output');
 t('native MILP engine present',!!window.LPEngine,'LPEngine');
 t('forecast demo model packaged',!!(window.AIP_FORECAST_VALUE_INTELLIGENCE||document.getElementById('aip-v475-forecast-value-intelligence-script')),'MDL-SFRC-012');
 return {release:'v734',passed:tests.every(x=>x.ok),tests,runAt:new Date().toISOString()};}
window.AIP_MODEL_EXECUTION_REGISTRY=REGISTRY;
window.AIPModelValidation=Object.freeze({metrics,chronologicalSplit,evidenceGate,cusum,selfTest});
window.AIP_V734_AUDIT={release:'v734',baseline:'v732',scope:'Forecasting + optimization + prediction model execution boundary and validation hardening; clean workbook rebuild',renderingArchitectureChanged:false,businessDataFabricated:false,principle:'Execute what is defensible; retain prepared data where customer/training evidence is unavailable; expose validation/governance separately.',registry:REGISTRY};
window.AIP_CURRENT_BUILD='v734';
function run(){try{window.AIP_V734_SELF_TEST=selfTest();}catch(e){window.AIP_V734_SELF_TEST={release:'v733',passed:false,error:String(e)}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else setTimeout(run,0);
})();
