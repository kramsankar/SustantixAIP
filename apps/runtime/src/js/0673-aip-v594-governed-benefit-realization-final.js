
(function(){
'use strict';
const norm=v=>String(v||'').replace(/^SYN-/i,'');
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
const moneyLakh=v=>{const n=num(v);return n===null?'—':'₹'+(n/100000).toFixed(2)+' lakh'};
const pct=v=>{const n=num(v);return n===null?'—':n.toFixed(2)+'%'};
function recommended(d){
  const a=(d?.alternatives||[]);
  return a.find(x=>x&&x.recommended===true)||(typeof aipPreferredAlt==='function'?aipPreferredAlt(d):a.filter(x=>x&&x.eligible!==false).sort((x,y)=>Number(y.score||0)-Number(x.score||0))[0])||a[0]||null;
}
function canonicalPredicted(d){const a=recommended(d);return num(a?.netValue)??num(d?.outcome?.predictedBenefit);}
function executionWO(d){
  const ex=(d?.execution||[]).find(x=>String(x.stage||'').toLowerCase()==='executed');
  const r=String(ex?.record||'');
  if(/^((SYN-)?WO-)/i.test(r))return norm(r);
  if(String(d?.sourceSheet||'').toLowerCase()==='work orders'&&/^((SYN-)?WO-)/i.test(String(d?.sourceRecord||'')))return norm(d.sourceRecord);
  return '';
}
function datasetRows(name){
  const syn=String(window.APM_DATA_MODE||'').toLowerCase().includes('synthetic');
  const stores=syn?[window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData,window.AIP_INDEPENDENT_SYNTHETIC_DATA]:[window.APM_IMPORTED_DATA,window.AIP_V5_EXCEL_RUNTIME_DATA,window.EMBEDDED_EXCEL_DATA];
  for(const st of stores){const r=st?.[name];if(Array.isArray(r))return r;}return [];
}
function matchedOutcome(d){
  const wo=executionWO(d); if(!wo)return null;
  const r=datasetRows('PLAN_Outcome_Validation').find(x=>norm(x?.Work_Order_ID)===wo);
  if(!r||!/^Validated$/i.test(String(r.Validation_Status||'')))return null;
  const actual=num(r.Net_Realized_Value_INR);
  if(actual===null)return null;
  return {row:r,actual};
}
function statusFor(d,m){
  if(m)return 'Realized · Validated';
  const ex=(d?.execution||[]).find(x=>String(x.stage||'').toLowerCase()==='executed');
  if(/^Completed$/i.test(String(ex?.status||'')))return 'Awaiting benefit verification';
  if(/in progress/i.test(String(ex?.status||'')))return 'Measurement pending';
  return String(d?.outcome?.status||'Pending execution');
}
function normalizePayload(payload){
  (payload?.decisions||[]).forEach(d=>{
    d.outcome=d.outcome||{};
    const pred=canonicalPredicted(d); if(pred!==null)d.outcome.predictedBenefit=pred;
    const m=matchedOutcome(d);
    if(m){d.outcome.actualBenefit=m.actual;d.outcome.benefitsRecord=String(m.row.Outcome_Validation_ID||'');}
    else{d.outcome.actualBenefit=null;if(!/^BEN-/i.test(String(d.outcome.benefitsRecord||'')))d.outcome.benefitsRecord='';}
    d.outcome.status=statusFor(d,m);
  });
}
[window.AIP_DI_EXCEL,window.AIP_DI_SYNTHETIC].filter(Boolean).forEach(normalizePayload);

window.AIP594Benefits={recommended,canonicalPredicted,matchedOutcome,statusFor,executionWO};

renderBenefitsRealization=function(){
  const v=document.getElementById('view-benefitsrealization'); if(!v)return;
  const syn=String(window.APM_DATA_MODE||'').toLowerCase().includes('synthetic');
  const payload=syn?window.AIP_DI_SYNTHETIC:window.AIP_DI_EXCEL;
  const decisions=(payload?.decisions||[]);
  const rows=decisions.map(d=>{const pred=canonicalPredicted(d);const m=matchedOutcome(d);const actual=m?.actual??null;const rate=(actual!==null&&pred!==null&&pred!==0)?actual/pred*100:null;return {d,pred,actual,rate,status:statusFor(d,m),alt:recommended(d),m};});
  const totalPred=rows.reduce((a,r)=>a+(r.pred??0),0);
  const realized=rows.filter(r=>r.actual!==null);
  const totalActual=realized.reduce((a,r)=>a+r.actual,0);
  const realizedPred=realized.reduce((a,r)=>a+(r.pred??0),0);
  const totalRate=realized.length&&realizedPred?totalActual/realizedPred*100:null;
  const adopted=decisions.filter(d=>{const s=(d.execution||[]).find(x=>String(x.stage||'').toLowerCase()==='approved');return /Completed|In Progress/i.test(String(s?.status||''));}).length;
  const adoption=decisions.length?adopted/decisions.length*100:0;
  const groups={}; rows.forEach(r=>{const k=String(r.d.category||'Other');groups[k]=groups[k]||{pred:0,actual:0,n:0,realized:0};groups[k].pred+=r.pred??0;groups[k].n++;if(r.actual!==null){groups[k].actual+=r.actual;groups[k].realized++;}});
  const levers=Object.entries(groups).map(([name,g])=>({name,...g})).sort((a,b)=>b.pred-a.pred);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const kActual=realized.length?moneyLakh(totalActual):'Pending';
  const kRate=totalRate===null?'Pending':pct(totalRate);
  v.innerHTML=rigourHeader('Benefits Realization','GOVERNED PREDICTED VALUE VERSUS VALIDATED ACTUAL VALUE')+
  rigourKpis([['Approved predicted benefit',moneyLakh(totalPred),'₹ lakh · canonical decision value'],['Actual verified benefit',kActual,realized.length?'₹ lakh · validated outcome records':'No validated linked outcome yet'],['Realization rate',kRate,realized.length?'percent · validated actual / approved predicted':'Available after validated realization'],['Decision adoption',pct(adoption),'percent · approved or beyond']])+
  `<div class="rigour-two" style="margin-top:14px">
    <div class="card"><div class="panel-title"><div><h3>Predicted vs Actual by Value Lever</h3><div class="sub">Unit: ₹ lakh · actual is shown only when a Decision/Work Order outcome is validated</div></div></div>
      <div class="rigour-bar-list">${levers.map(x=>{const share=x.pred?Math.min(100,Math.round((x.actual/x.pred)*100)):0;const act=x.realized?moneyLakh(x.actual):'Pending';return `<div class="rigour-bar-row rigour-clickable" onclick="document.getElementById('benefitRegister').scrollIntoView({behavior:'smooth'})"><span>${esc(x.name)}<small> · predicted ${moneyLakh(x.pred)}</small></span><div class="rigour-bar-track"><div class="rigour-bar-fill" style="width:${share}%"></div></div><b>${act}</b></div>`}).join('')}</div>
      <div class="rigour-explain"><b>Governed calculation:</b> approved predicted benefit is inherited from the originating decision's recommended governed alternative; it is not recalculated here. Actual realized value is recognized only from a validated linked outcome. Realization rate = validated actual ÷ approved predicted.</div>
    </div>
    <div class="card"><div class="panel-title"><div><h3>Verification Controls</h3><div class="sub">Required before actual benefit recognition</div></div></div>
      <table class="rigour-table"><tbody><tr><td>Canonical prediction source</td><td class="num"><span class="rigour-status good">Decision ID governed</span></td></tr><tr><td>Execution linkage</td><td class="num">Decision → Work Order</td></tr><tr><td>Measurement / normalization</td><td class="num">Outcome record · where applicable</td></tr><tr><td>Finance / O&M validation</td><td class="num"><span class="rigour-status ${realized.length?'good':'warn'}">${realized.length} validated · ${rows.length-realized.length} pending</span></td></tr><tr><td>Missing actual treatment</td><td class="num"><span class="rigour-status good">Pending · never forced to ₹0</span></td></tr></tbody></table>
    </div>
  </div>
  <div class="card" id="benefitRegister" style="margin-top:14px"><div class="panel-title"><div><h3>Benefits Realization Register</h3><div class="sub">One value lineage: Decision → approved prediction → execution → validated actual → variance / learning</div></div><span class="tag info">Decision-linked</span></div><div class="rigour-table-wrap"><table class="rigour-table"><thead><tr><th>Decision</th><th>Recommended action</th><th class="num">Approved predicted (₹ lakh)</th><th class="num">Validated actual (₹ lakh)</th><th class="num">Variance (₹ lakh)</th><th class="num">Realization (%)</th><th>Status</th></tr></thead><tbody>${rows.map(r=>{const variance=r.actual===null||r.pred===null?null:r.actual-r.pred;return `<tr><td><span class="rigour-link" onclick="RIGOUR_ACTIVE_DECISION='${esc(r.d.id)}';rigourGo('decisiontraceability')">${esc(r.d.id)}</span></td><td>${esc(r.alt?.name||r.d.recommendedAction||r.d.title||'—')}</td><td class="num">${r.pred===null?'—':(r.pred/100000).toFixed(2)}</td><td class="num">${r.actual===null?'Pending':(r.actual/100000).toFixed(2)}</td><td class="num">${variance===null?'—':(variance/100000).toFixed(2)}</td><td class="num">${r.rate===null?'—':r.rate.toFixed(2)+'%'}</td><td><span class="rigour-status ${r.actual!==null?'good':'warn'}">${esc(r.status)}</span></td></tr>`}).join('')}</tbody></table></div></div>`;
};

window.AIP_V594_VALUE_REALIZATION_AUDIT={
 release:'v594',baseline:'v593',
 scope:'Decision / Asset-to-Value / Outcome & Learning / Benefits Realization value-lineage correction',
 canonicalPrediction:'Recommended governed alternative netValue; downstream realization screens consume, never recalculate independently',
 actualRecognition:'Validated PLAN_Outcome_Validation linked through governed Work_Order_ID only',
 missingActual:'Pending lifecycle state; null is never coerced to zero',
 stalePredictionCorrections:['DEC-008','DEC-013','DEC-014','SYN-DEC-013'],
 renderingChanged:false,sharedCssChanged:false,navigationRouterChanged:false,excelBusinessDataChanged:false
};
window.AIP_CURRENT_BUILD='v594';
})();
