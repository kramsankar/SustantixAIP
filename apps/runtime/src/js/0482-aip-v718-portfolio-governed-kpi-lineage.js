
(function(){
'use strict';
if(window.__AIP_V718_PORTFOLIO_KPI_LINEAGE__)return;
window.__AIP_V718_PORTFOLIO_KPI_LINEAGE__=true;
const N=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const siteRow=r=>/^SP-\d+$/i.test(String(r?.Plant_ID||'').trim());
function syntheticActive(){return window.AIP_SYNTHETIC_ACTIVE===true||/synthetic|demo data/i.test(String(window.APM_DATA_MODE||''));}
function store(){
  const syn=window.AIP_INDEPENDENT_SYNTHETIC_DATA;
  return syntheticActive()?(syn?.platformSyntheticData||syn||{}):(window.EMBEDDED_EXCEL_DATA||{});
}
function revenueRows(d){
  const calc=Array.isArray(d?.PORT_Revenue_Risk_Calc)?d.PORT_Revenue_Risk_Calc.filter(siteRow):[];
  if(calc.length){
    return calc.map(r=>({row:r,sh:N(r.Lost_Generation_MWh),tar:N(r.Tariff_INR_per_kWh),pen:N(r.Penalty_INR_Included),rec:N(r.Recoverable_INR_Included),gross:N(r.Lost_Revenue_INR),net:N(r.Lost_Revenue_INR),audit:r.Audit_Status||'',rateId:r.Tariff_Rate_ID||''}));
  }
  const gen=(Array.isArray(d?.SUS_Generation)?d.SUS_Generation:[]).filter(siteRow);
  const rates=Object.fromEntries((Array.isArray(d?.VE_Rate_Config)?d.VE_Rate_Config:[]).filter(x=>String(x.Rate_Type)==='PPA Tariff').map(x=>[String(x.Applies_To),x]));
  return gen.map(r=>{const q=rates[String(r.Plant_ID)],sh=N(r.Lost_MWh),tar=N(q?.Rate_or_Value),net=sh*tar*1000;return {row:r,sh,tar,pen:0,rec:0,gross:net,net,audit:q?'Reconciled — governed tariff applied':'Blocked — governed tariff missing',rateId:q?.Rate_ID||''};});
}
window.aipPortfolioRevenueAtRiskRows=function(){return revenueRows(store())};
window.aipPortfolioRevenueAtRisk=function(){return revenueRows(store()).reduce((s,x)=>s+N(x.net),0)};
window.aipPortfolioCo2AvoidedT12=function(){
  const d=store();
  const calc=(Array.isArray(d?.SUS_Avoided_Emissions_Calc)?d.SUS_Avoided_Emissions_Calc:[]).filter(siteRow);
  if(calc.length){
    return calc.reduce((s,r)=>{const v=Number(r.Avoided_Emissions_tCO2e);return s+(Number.isFinite(v)?v:N(r.Net_Generation_MWh)*N(r.Emission_Factor_tCO2e_per_MWh));},0);
  }
  const gen=(Array.isArray(d?.SUS_Generation)?d.SUS_Generation:[]).filter(siteRow);
  const cfg=Array.isArray(d?.SUS_Emission_Factor_Config)?d.SUS_Emission_Factor_Config:[];
  const f=cfg.find(x=>String(x.Status).toLowerCase()==='active')||cfg[0]||{};
  return gen.reduce((s,r)=>s+N(r.Net_MWh),0)*N(f.Value);
};
function refresh(){
  try{if(document.getElementById('view-overview')?.classList.contains('active')&&typeof window.renderOverview==='function')window.renderOverview();}catch(e){console.warn('v718 overview KPI refresh',e)}
  try{if(document.getElementById('view-sustainabilityintelligence')?.classList.contains('active')&&typeof window.renderSustainabilityIntelligence==='function')window.renderSustainabilityIntelligence();}catch(_){}
}
['aip:data-source-changed','apm:datasource-refreshed','aip:runtime-ready'].forEach(ev=>document.addEventListener(ev,()=>setTimeout(refresh,40)));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,250));else setTimeout(refresh,250);
window.AIP_V718_AUDIT={release:'v718',baseline:'v717',area:'Portfolio Intelligence Overview governed KPI lineage',rootCause:'Portfolio KPI helper functions could sum portfolio summary rows and could read formula cells with no cached browser value, causing zero/double-count behavior. Revenue and CO2 now resolve only governed site rows and derive formula values from primitive governed inputs when needed.',revenueRule:'Sum SP-01..SP-12 governed site revenue-risk rows only; exclude PORTFOLIO summary row',co2Rule:'Sum SP-01..SP-12 avoided-emissions rows only; if formula value is unavailable in browser, calculate Net_Generation_MWh × governed emission factor',syntheticExcelParity:true};
})();
