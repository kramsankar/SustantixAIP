
(function(){
 'use strict';
 const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
 function ppaRows(){try{return typeof v2PpaData==='function'?(v2PpaData()||[]):[]}catch(_){return []}}
 function shortfall(r){const d=num(r?.Shortfall_Energy_MWh);return d>0?d:Math.max(0,num(r?.Scheduled_Energy_MWh)-num(r?.Delivered_Energy_MWh))}
 function ppaCalc(r){const sh=shortfall(r),tar=num(r?.PPA_Tariff_INR_kWh),pen=num(r?.Availability_Penalty_INR),rec=Math.max(0,num(r?.Curtailment_Compensation_INR)),gross=sh*tar*1000+pen,net=Math.max(0,gross-rec);return {sh,tar,pen,rec,gross,net}}
 window.aipPortfolioRevenueAtRiskRows=function(){return ppaRows().map(r=>({row:r,...ppaCalc(r)}))};
 window.aipPortfolioRevenueAtRisk=function(){return window.aipPortfolioRevenueAtRiskRows().reduce((s,x)=>s+x.net,0)};
 window.aipPortfolioCo2AvoidedT12=function(){
   const rows=(typeof ESG_MONTHLY!=='undefined'&&Array.isArray(ESG_MONTHLY))?ESG_MONTHLY:[];
   if(!rows.length)return 0;
   const key=r=>String(r?.month??r?.Month??'').slice(0,10);
   const months=[...new Set(rows.map(key).filter(Boolean))].sort();
   const keep=new Set(months.slice(-12));
   return rows.reduce((s,r)=>s+(keep.has(key(r))?num(r?.avoided??r?.Avoided_Emissions_tCO2e):0),0);
 };
 function money(v){try{return typeof v2Money==='function'?v2Money(v):'₹'+Math.round(v).toLocaleString('en-IN')}catch(_){return '₹'+Math.round(v).toLocaleString('en-IN')}}
 function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))}
 function addRevenueReconciliation(){ return; }
 const base=window.__renderCommercialPPA_v8768;
 if(typeof base==='function'&&!base.__v229){
   const wrapped=function(){const out=base.apply(this,arguments);requestAnimationFrame(addRevenueReconciliation);return out};wrapped.__v229=true;window.__renderCommercialPPA_v8768=wrapped;
 }
 document.addEventListener('aip:data-source-changed',()=>setTimeout(()=>{if(document.getElementById('view-commercialppa')?.classList.contains('active'))addRevenueReconciliation()},80));
 window.AIP_V229_META={version:'v229',portfolioDrills:'Revenue at Risk → Revenue & Commercial Intelligence / Commercial & PPA; CO2 Avoided → Sustainability Performance / Energy, Carbon & Water',backNavigation:'Records real parent views for exact return to Portfolio Intelligence Overview',revenueAtRisk:'Net commercial exposure = shortfall × tariff × 1000 + availability penalty − commercially recoverable opportunity',co2Avoided:'Trailing 12-month sum of governed ESG Monthly avoided emissions; reconciled to current Sustainability Performance'};
})();
