
(function(){
'use strict';
const E=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
const J=v=>String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const N=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const F=(v,d=1)=>N(v).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
const M=v=>{const n=N(v),a=Math.abs(n);if(a>=10000000)return '₹'+(n/10000000).toFixed(2)+' Cr';if(a>=100000)return '₹'+(n/100000).toFixed(2)+' L';return '₹'+Math.round(n).toLocaleString('en-IN')};
function store(){
 try{if(typeof APM_IMPORTED_DATA!=='undefined'&&APM_IMPORTED_DATA&&Object.keys(APM_IMPORTED_DATA).length)return APM_IMPORTED_DATA}catch(_){ }
 try{if(window.APM_IMPORTED_DATA&&Object.keys(window.APM_IMPORTED_DATA).length)return window.APM_IMPORTED_DATA}catch(_){ }
 try{if(typeof EMBEDDED_EXCEL_DATA!=='undefined'&&EMBEDDED_EXCEL_DATA)return EMBEDDED_EXCEL_DATA}catch(_){ }
 return window.EMBEDDED_EXCEL_DATA||{};
}
function rows(name){const d=store(),r=d&&d[name];return Array.isArray(r)?r:[]}
function header(){return `<div class="f1-help-top-right"></div><div class="aip508-portfolio-context">12 SITES · 552 ASSETS · 987 MW AC</div>`}
function tabs(){return `<div class="portfolio-performance-tabs v51-tabs" role="tablist" aria-label="Portfolio Performance views"><button type="button" data-pp-tab="performance">Performance</button><button type="button" data-pp-tab="benchmarking">Site Benchmarking</button><button type="button" data-pp-tab="loss">Loss &amp; Recovery</button></div>`}
function bars(){return '<span class="aip-kpi-master-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>'}
function valueHtml(v){const z=String(v??'').trim(),m=z.match(/^([₹$€£]?)([-+]?\d[\d,]*(?:\.\d+)?)(.*)$/);if(!m)return `<span class="aip-kpi-number">${E(z)}</span>`;return `${m[1]?`<span class="aip-kpi-prefix">${E(m[1])}</span>`:''}<span class="aip-kpi-number">${E(m[2])}</span>${m[3].trim()?`<span class="aip-kpi-unit">${E(m[3].trim())}</span>`:''}`}
function kpis(items){return `<div class="ax-kpis portfolio-kpis" style="--pp-cols:${Math.min(6,items.length)}">${items.map((x,i)=>{const drill=x[2]||'';return `<div class="aip-kpi-master${drill?' v232-pp-drill':''}" style="${drill?'position:relative!important;padding-right:30px!important;':''}" data-aip-kpi-index="${i%8}"${drill?` role="button" tabindex="0" title="Drill down" onclick="${drill}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${drill}}"`:''}><span class="kpi-label" data-kpi-label>${E(x[0])}</span><b class="kpi-value" data-kpi-value>${E(x[1])}</b><span class="aip-kpi-display-label">${E(x[0])}</span><span class="aip-kpi-display-value">${valueHtml(x[1])}</span>${drill?'<span class="v510-kpi-drill-badge" aria-hidden="true" style="display:flex!important;visibility:visible!important;opacity:1!important;position:absolute!important;top:8px!important;right:8px!important;width:19px!important;height:19px!important;min-width:19px!important;min-height:19px!important;border-radius:999px!important;background:#173f5f!important;color:#fff!important;align-items:center!important;justify-content:center!important;font:700 11px/19px Arial,sans-serif!important;z-index:100!important;pointer-events:none!important">↗</span>':''}${bars()}</div>`}).join('')}</div>`}
function ctx(){return window.AIP_PORTFOLIO_SITE_CONTEXT||null}
function setContext(pid,name,source){window.AIP_PORTFOLIO_SITE_CONTEXT={plantId:String(pid||''),plantName:String(name||pid||''),source:String(source||''),timestamp:Date.now()};try{sessionStorage.setItem('aip.portfolio.site.context',JSON.stringify(window.AIP_PORTFOLIO_SITE_CONTEXT))}catch(_){ }return window.AIP_PORTFOLIO_SITE_CONTEXT}
function clearContext(){window.AIP_PORTFOLIO_SITE_CONTEXT=null;try{sessionStorage.removeItem('aip.portfolio.site.context')}catch(_){ }}
function ppSearchBox(tab,label){return `<div class="v489-pp-search"><input type="search" aria-label="${E(label)}" placeholder="${E(label)}…" oninput="AIPPortfolioTableSearch('${tab}',this.value)"></div>`}
window.AIPPortfolioTableSearch=function(tab,q){const p=document.querySelector(`#view-portfoliobenchmarking [data-pp-panel="${tab}"]`);if(!p)return;const needle=String(q||'').trim().toLowerCase();p.querySelectorAll('table tbody tr').forEach(tr=>{const text=(tr.innerText||tr.textContent||'').toLowerCase();tr.style.display=!needle||text.includes(needle)?'':'none'})};

function portfolioSiteCode(pid,name){
  const rawId=String(pid??'').trim();
  const rawName=String(name??'').trim();
  const normalize=s=>String(s??'').trim().toLowerCase();

  const candidates=[];
  try{candidates.push(...rows('Sites'));}catch(_){}
  try{candidates.push(...rows('Executive Portfolio Summary'));}catch(_){}
  try{
    if(typeof PLANTS!=='undefined'&&Array.isArray(PLANTS))candidates.push(...PLANTS);
    else if(Array.isArray(window.PLANTS))candidates.push(...window.PLANTS);
  }catch(_){}

  const codeFields=['Site_Code','SiteCode','Plant_Code','PlantCode','Code','site_code','plant_code','code'];
  const idFields=['Plant_ID','Site_ID','PlantId','SiteId','id'];
  const nameFields=['Plant_Name','Site_Name','PlantName','SiteName','name'];

  const match=candidates.find(r=>{
    if(!r)return false;
    const ids=idFields.map(k=>r[k]).filter(v=>v!=null).map(v=>normalize(v));
    const names=nameFields.map(k=>r[k]).filter(v=>v!=null).map(v=>normalize(v));
    return (rawId&&ids.includes(normalize(rawId))) || (rawName&&names.includes(normalize(rawName)));
  });

  if(match){
    for(const k of codeFields){
      const v=String(match[k]??'').trim();
      if(/^SP[-\s]?\d+$/i.test(v)) return v.toUpperCase().replace(/^SP\s*/i,'SP-').replace(/^SP--/,'SP-');
      if(v) return v;
    }
  }

  // Derive SP-xx from any numeric plant/site identifier only as a last-resort
  // presentation fallback, keeping internal IDs untouched.
  const n=(rawId.match(/(\d+)/)||[])[1];
  if(n)return `SP-${String(Number(n)).padStart(2,'0')}`;
  return rawId||rawName;
}
function latestExecutive(){const a=rows('Executive Portfolio Summary').filter(r=>r&&r.Plant_ID);if(!a.length)return[];const months=a.map(r=>String(r.Month||'')).filter(Boolean).sort();const latest=months[months.length-1];return latest?a.filter(r=>String(r.Month||'')===latest):a}
function band(s){return s>=85?'Leading':s>=70?'Competitive':s>=55?'Watch':'Intervention'}
function bclass(s){return s>=85?'good':s>=70?'info':s>=55?'warn':'bad'}
function benchmarkRows(){
 const ex=latestExecutive(),br=rows('Portfolio Benchmarking').filter(r=>r&&r.Plant_ID),sites=rows('Sites').filter(r=>r&&r.Plant_ID),sx=new Map(sites.map(r=>[String(r.Plant_ID),r]));
 const base=br.length?br:(ex.length?ex:sites);
 const raw=base.map((b,i)=>{
   const e=ex.find(x=>String(x.Plant_ID)===String(b.Plant_ID))||ex[i]||{};
   const id=String(b.Plant_ID||e.Plant_ID||sites[i]?.Plant_ID||'');
   const si=sx.get(id)||sites[i]||{};
   return {
     id,
     name:e.Plant_Name||si.Plant_Name||b.Site_Name||id,
     cap:e.Capacity_MW??si.Capacity_MW,
     gen:e.Generation_Variance_Pct,
     rev:e.Revenue_Variance_INR,
     pr:N(b.PR_Pct??e.PR_Actual_Pct??si.PR_Pct),
     av:N(b.Availability_Pct??e.Availability_Actual_Pct??si.Availability_Pct),
     om:N(b.OM_Cost_Lakh_per_MW_Year),
     fail:N(b.Failures_per_100_Assets_Year),
     inventory:N(b.Inventory_Efficiency_Score??b.Inventory_Efficiency_Pct),
     productivity:N(b.WO_Productivity_Score??b.Work_Order_Productivity_Score??b.Productivity_Score),
     recg:e.Recoverable_Generation_MWh,
     recr:e.Recoverable_Revenue_INR,
     owner:e.Action_Owner||'Plant Head'
   };
 });
 const values={
   pr:raw.map(r=>r.pr),av:raw.map(r=>r.av),failures:raw.map(r=>r.fail),
   cost:raw.map(r=>r.om),inventory:raw.map(r=>r.inventory),productivity:raw.map(r=>r.productivity)
 };
 const weights=Object.assign({pr:25,av:20,failures:20,cost:15,inventory:10,productivity:10},window.BENCHMARK_APPLIED_WEIGHTS||{});
 const total=Object.values(weights).reduce((s,n)=>s+(Number(n)||0),0)||100;
 const mode=String(window.BENCHMARK_NORMALIZATION||'percentile').toLowerCase();
 function norm(value,arr,inverse){
   const valid=arr.filter(Number.isFinite).sort((a,b)=>a-b);
   if(!Number.isFinite(value)||!valid.length)return 0;
   if(valid.length===1)return 100;
   let n=0;
   if(mode==='minmax'){
     const min=valid[0],max=valid[valid.length-1];
     n=max===min?100:((value-min)/(max-min))*100;
   }else{
     let below=0,equal=0;
     valid.forEach(x=>{if(x<value)below++;else if(x===value)equal++;});
     n=((below+.5*equal-.5)/(valid.length-1))*100;
   }
   n=Math.max(0,Math.min(100,n));
   return inverse?100-n:n;
 }
 return raw.map(r=>{
   const normalized={
     pr:norm(r.pr,values.pr,false),
     av:norm(r.av,values.av,false),
     failures:norm(r.fail,values.failures,true),
     cost:norm(r.om,values.cost,true),
     inventory:norm(r.inventory,values.inventory,false),
     productivity:norm(r.productivity,values.productivity,false)
   };
   const score=Object.keys(normalized).reduce((s,k)=>s+normalized[k]*(Number(weights[k])||0)/total,0);
   return {...r,normalized,score};
 }).sort((a,b)=>b.score-a.score).map((r,i)=>({...r,rank:i+1}));
}
let lossCache={store:null,model:null};
function lossModel(){
 const d=store();
 if(lossCache.store===d&&lossCache.model&&Array.isArray(lossCache.model.use)&&lossCache.model.use.length&&Array.isArray(lossCache.model.opp)&&lossCache.model.opp.length)return lossCache.model;
 const all=rows('Generation Loss Attribution').filter(r=>r&&r.Plant_ID),ex=latestExecutive(),names=new Map(ex.map(r=>[String(r.Plant_ID),r.Plant_Name||''])),tariff=new Map(ex.map(r=>[String(r.Plant_ID),N(r.PPA_Tariff_INR_kWh)]));
 const fields=[['Inverter','Inverter_Loss_MWh','Maintenance / ERCI'],['Soiling','Soiling_Loss_MWh','Cleaning / Operations'],['Module degradation','Module_Degradation_Loss_MWh','Asset Health / Maintenance'],['Tracker','Tracker_Loss_MWh','Maintenance'],['DC strings','DC_String_Loss_MWh','Maintenance / Asset Explorer'],['Transformer','Transformer_Loss_MWh','Maintenance / ERCI'],['Grid outage','Grid_Outage_Loss_MWh','Commercial & PPA'],['Curtailment','Curtailment_Loss_MWh','Commercial & PPA'],['Planned maintenance','Planned_Maintenance_Loss_MWh','Maintenance Planning'],['Unexplained','Unexplained_Loss_MWh','Event & Root Cause Intelligence']];
 const latest={};all.forEach(r=>{const id=String(r.Plant_ID),m=String(r.Month||'');if(!latest[id]||m>String(latest[id].Month||''))latest[id]=r});const use=Object.values(latest),total=use.reduce((s,r)=>s+N(r.Total_Loss_MWh),0)||1,driverTotals=new Map(fields.map(([n,k])=>[n,use.reduce((s,r)=>s+N(r[k]),0)])),opp=[];
 use.forEach(r=>{const controllable=fields.filter(([n])=>!['Grid outage','Curtailment'].includes(n)).reduce((s,[,k])=>s+N(r[k]),0),rec=N(r.Recoverable_Loss_MWh);fields.forEach(([driver,key,route])=>{const l=N(r[key]);if(!l)return;const external=['Grid outage','Curtailment'].includes(driver),dr=external?0:(controllable?rec*l/controllable:0);opp.push({plant:String(r.Plant_ID),name:names.get(String(r.Plant_ID))||'',driver,loss:l,share:l/total*100,driverTotal:driverTotals.get(driver),siteTotal:N(r.Total_Loss_MWh),siteRec:rec,external:N(r.Grid_Outage_Loss_MWh)+N(r.Curtailment_Loss_MWh),dr,value:dr*1000*(tariff.get(String(r.Plant_ID))||0),control:external?'External / non-controllable':driver==='Unexplained'?'Needs attribution':'Controllable',route})})});
 opp.sort((a,b)=>b.value-a.value||b.loss-a.loss);
 const model={use,opp,tariff};
 if(use.length&&opp.length)lossCache={store:d,model};
 else lossCache={store:null,model:null};
 return model;
}
function performanceHtml(){
 const a=latestExecutive(),c=ctx();if(!a.length)return '<div class="card">No performance data available.</div>';
 const actual=a.reduce((s,r)=>s+N(r.Actual_Generation_MWh),0),budget=a.reduce((s,r)=>s+N(r.Budget_Generation_MWh),0),rev=a.reduce((s,r)=>s+N(r.Revenue_Actual_INR),0),revb=a.reduce((s,r)=>s+N(r.Revenue_Budget_INR),0),rec=a.reduce((s,r)=>s+N(r.Recoverable_Generation_MWh),0),recr=a.reduce((s,r)=>s+N(r.Recoverable_Revenue_INR),0),av=a.reduce((s,r)=>s+N(r.Availability_Actual_Pct),0)/Math.max(1,a.length),ranked=[...a].sort((x,y)=>N(x.Generation_Variance_Pct)-N(y.Generation_Variance_Pct)||N(y.Recoverable_Revenue_INR)-N(x.Recoverable_Revenue_INR));
 return kpis([['Actual generation',F(actual,0)+' MWh'],['Generation vs budget',F(budget?(actual-budget)/budget*100:0,1)+'%'],['Revenue vs budget',M(rev-revb)],['Availability',F(av,1)+'%']])+ppSearchBox('performance','Search all performance fields')+`<div class="card"><div class="panel-title"><div><h3>Site Performance Ranking</h3><div class="v230-ranking-basis">Ranked by Generation Variance vs Budget</div><div class="sub">Performance Status is AIP-derived using configured Generation Variance vs Budget thresholds: ${E(window.AIPPerformanceStatusConfig.rangesText())}.</div></div></div><div class="table-scroll"><table><thead><tr><th>Site</th><th>Capacity</th><th>Generation variance</th><th>Revenue variance</th><th>PR</th><th>Availability</th><th>Recoverable generation</th><th>Recoverable revenue opportunity</th><th>Performance Status</th><th>Required action</th><th>Owner</th></tr></thead><tbody>${ranked.map((r,i)=>{const gv=Number(r.Generation_Variance_Pct)||0;const performanceStatus=window.AIPPerformanceStatusConfig.status(gv);const sel=c&&(String(c.plantId||'')===String(r.Plant_ID)||String(c.plantName||'')===String(r.Plant_Name||''));return `<tr class="${sel?'v214-attention-row':''}"><td>${E(portfolioSiteCode(r.Plant_ID,r.Plant_Name||''))} · ${E(r.Plant_Name||'')}</td><td>${F(r.Capacity_MW,0)} MW</td><td>${F(r.Generation_Variance_Pct,1)}%</td><td>${M(r.Revenue_Variance_INR)}</td><td>${F(r.PR_Actual_Pct,1)}%</td><td class="${sel?'v214-availability-cell':''}">${F(r.Availability_Actual_Pct,1)}%</td><td><button class="v50-link" onclick="AIPPortfolioToLoss('${J(r.Plant_ID)}','${J(r.Plant_Name||'')}','Performance')">${F(r.Recoverable_Generation_MWh,1)} MWh</button></td><td><button class="v50-link" onclick="AIPPortfolioToLoss('${J(r.Plant_ID)}','${J(r.Plant_Name||'')}','Performance')">${M(r.Recoverable_Revenue_INR)}</button></td><td><span class="aip-perf-status aip-perf-${performanceStatus.toLowerCase().replace(/\s+/g,'-')}">${E(performanceStatus)}</span></td><td>${E(performanceStatus==='Critical'?'Approve priority intervention':performanceStatus==='Watch'?'Review loss drivers':'Monitor')}</td><td>${E(r.Action_Owner||'Plant Head')}</td></tr>`}).join('')}</tbody></table></div></div>`;
}
function benchmarkFormulaText(){
 const w=Object.assign({pr:25,av:20,failures:20,cost:15,inventory:10,productivity:10},window.BENCHMARK_APPLIED_WEIGHTS||{});
 const mode=String(window.BENCHMARK_NORMALIZATION||'percentile').toLowerCase()==='minmax'?'Min–max normalization':'Robust percentile normalization';
 return `Composite Score = PR norm × ${w.pr}% + Availability norm × ${w.av}% + Reliability norm × ${w.failures}% + O&M Cost norm × ${w.cost}% + Inventory norm × ${w.inventory}% + Productivity norm × ${w.productivity}%. Failure Rate and O&M Cost are inverse-scored. ${mode}.`;
}
function benchmarkHtml(){
 const a=benchmarkRows(),c=ctx();if(!a.length)return '<div class="card">No benchmark data available.</div>';
 const attentionOnly=!!window.AIP_BENCHMARK_ATTENTION_ONLY;
 const visibleRows=attentionOnly?a.filter(r=>Number(r.score)<70):a;
 const prs=a.map(r=>N(r.pr)).sort((x,y)=>x-y),med=prs.length?(prs.length%2?prs[(prs.length-1)/2]:(prs[prs.length/2-1]+prs[prs.length/2])/2):0,top=[...a].sort((x,y)=>y.score-x.score)[0],best=Math.max(...a.map(r=>N(r.av))),outs=a.filter(r=>r.score<70).length,banner=c?`<div class="v50-bench-note">Selected context: <b>${E(c.plantName||c.plantId||'')}</b></div>`:'';
 return kpis([['Portfolio median PR',F(med,2)+'%'],['Best availability',F(best,2)+'%'],['Sites Requiring Attention',String(outs),"AIPPortfolioKPIDrill('benchmark-attention')"]])+`<div class="benchmark-header-action"><div><b>Benchmark scoring methodology</b><span>Review weights, normalization, recommendations and governance.</span></div><button class="benchmark-launch-btn" type="button" onclick="if(typeof benchmarkOpenScoringModel==='function')benchmarkOpenScoringModel()">⚙ Scoring Framework <span class="v231-drill-icon" aria-hidden="true">↗</span></button></div>${banner}${attentionOnly?`<div class="v243-attention-filter"><span><b>Filtered:</b> Sites Requiring Attention · Composite Score &lt;70 · ${visibleRows.length} site${visibleRows.length===1?'':'s'}</span><button type="button" onclick="AIPClearBenchmarkAttentionFilter()">Show all sites</button></div>`:''}${ppSearchBox('benchmarking','Search all site benchmarking fields')}<div class="card" style="margin-top:14px"><div class="panel-title"><div><h3>Site Benchmark Register</h3><div class="v230-ranking-basis">Ranked by Composite Score</div><div class="v240-score-bands">Leading ≥ 85 · Competitive 70 ≤ Score &lt; 85 · Watch 55 ≤ Score &lt; 70 · Intervention &lt; 55</div></div></div><div class="table-scroll"><table class="rigour-table v50-benchmark-table"><thead><tr><th>Site</th><th>Capacity</th><th>Generation variance</th><th>Revenue variance</th><th>PR</th><th>Availability</th><th>O&amp;M Cost</th><th>Failures</th><th>Recoverable generation</th><th>Recoverable revenue</th><th class="aip-composite-score-head">Composite score</th><th>Band</th><th>Owner</th></tr></thead><tbody>${visibleRows.map(r=>{const sel=c&&(String(c.plantId||'')===r.id||String(c.plantName||'')===r.name);const attention=attentionOnly&&Number(r.score)<70;return `<tr class="${sel?'v50-context-row ':''}${attention?'v243-attention-row':''}"><td>${E(portfolioSiteCode(r.id,r.name))} · ${E(r.name)}</td><td>${F(r.cap,0)} MW</td><td>${F(r.gen,1)}%</td><td>${M(r.rev)}</td><td>${F(r.pr,2)}%</td><td>${F(r.av,2)}%</td><td>${F(r.om,2)}</td><td>${F(r.fail,2)}</td><td><button class="v50-link" type="button" onclick="AIPPortfolioToLoss('${J(r.id)}','${J(r.name)}','Site Benchmarking')">${F(r.recg,1)} MWh</button></td><td><button class="v50-link" type="button" onclick="AIPPortfolioToLoss('${J(r.id)}','${J(r.name)}','Site Benchmarking')">${M(r.recr)}</button></td><td class="aip-composite-score-value"><b>${F(r.score,2)}</b></td><td><span class="rigour-status ${bclass(r.score)}">${band(r.score)}</span></td><td>${E(r.owner)}</td></tr>`}).join('')}</tbody></table></div></div>`;
}
function lossHtml(){
 const m=lossModel(),c=ctx();
 const canon=v=>String(v??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
 let scopedId=c?.plantId?canon(c.plantId):'';
 if(scopedId&&!m.use.some(r=>canon(r.Plant_ID)===scopedId)&&c?.plantName){
   const wanted=String(c.plantName).trim().toLowerCase();
   const ex=latestExecutive().find(r=>String(r.Plant_Name||'').trim().toLowerCase()===wanted);
   if(ex)scopedId=canon(ex.Plant_ID);
 }
 const use=scopedId?m.use.filter(r=>canon(r.Plant_ID)===scopedId):m.use;
 const opp=scopedId?m.opp.filter(o=>canon(o.plant)===scopedId):m.opp;
 if(!m.use.length||!m.opp.length||(scopedId&&(!use.length||!opp.length)))return '<div class="v242-loss-loading" data-loss-ready="0">Loading current Loss & Recovery data…</div>';
 const total=use.reduce((s,r)=>s+N(r.Total_Loss_MWh),0),rec=use.reduce((s,r)=>s+N(r.Recoverable_Loss_MWh),0),ext=use.reduce((s,r)=>s+N(r.Grid_Outage_Loss_MWh)+N(r.Curtailment_Loss_MWh),0),un=use.reduce((s,r)=>s+N(r.Unexplained_Loss_MWh),0),rev=use.reduce((s,r)=>s+N(r.Recoverable_Loss_MWh)*1000*(m.tariff.get(String(r.Plant_ID))||0),0);
 return '<div data-loss-ready="1">'+aipRecoveryScopeHtml(use)+kpis([['Total attributed loss',F(total,0)+' MWh'],['Recoverable loss',F(rec,0)+' MWh'],['External loss',F(ext,0)+' MWh'],['Unexplained loss',F(un,0)+' MWh'],['Recoverable revenue opportunity',M(rev),"AIPPortfolioKPIDrill('loss-recovery')"]])+ppSearchBox('loss','Search all loss & recovery fields')+`<div class="card aip-recovery-opportunities"><div class="panel-title"><div><h3>Recovery Opportunities</h3><div class="v230-ranking-basis">Ordered by Recovery Value</div></div></div><div class="table-scroll aip-recovery-table-viewport"><table><thead><tr><th>Site</th><th>Loss driver</th><th>Driver loss</th><th>Portfolio share</th><th>Portfolio driver total</th><th>Site total loss</th><th>Site recoverable</th><th>Site external loss</th><th>Recoverable from driver</th><th>Recovery value</th><th>Controllability</th><th>Action route</th></tr></thead><tbody>${opp.map(o=>`<tr><td>${E(portfolioSiteCode(o.plant,o.name))} · ${E(o.name)}</td><td>${E(o.driver)}</td><td>${F(o.loss,1)} MWh</td><td>${F(o.share,1)}%</td><td>${F(o.driverTotal,1)} MWh</td><td>${F(o.siteTotal,1)} MWh</td><td>${F(o.siteRec,1)} MWh</td><td>${F(o.external,1)} MWh</td><td>${F(o.dr,1)} MWh</td><td>${M(o.value)}</td><td>${E(o.control)}</td><td><button class="v50-link" onclick="AIPPortfolioOpenRoute('${J(o.plant)}','${J(o.name)}','${J(o.driver)}','${J(o.route)}')">${E(/Grid outage|Curtailment/i.test(o.driver)?'Review commercial / PPA':/Unexplained/i.test(o.driver)?'Investigate root cause':/Planned maintenance|Soiling/i.test(o.driver)?'Open work-order context':'Review asset condition')}</button></td></tr>`).join('')}</tbody></table></div></div></div>`;
}

window.AIPPortfolioKPIDrill=function(kind){
  const current=ctx();
  if(kind==='performance-recovery'){
    window.AIP_CONTEXT_NAV={
      source:'Portfolio Performance',
      target:'lossintelligence',
      metric:'Recoverable Revenue Opportunity',
      plantId:current?.plantId||'',
      plantName:current?.plantName||'',
      timestamp:Date.now()
    };
    try{if(typeof window.activate==='function')window.activate('lossintelligence');else if(typeof activate==='function')activate('lossintelligence')}catch(_){}
    return;
  }
  if(kind==='benchmark-attention'){
    window.AIP_BENCHMARK_ATTENTION_ONLY=true;
    const p=panel('benchmarking');
    if(p)p.dataset.rendered='';
    showTab('benchmarking');
    setTimeout(()=>{
      const root=document.querySelector('#view-portfoliobenchmarking .v51-pp-panel[data-pp-panel="benchmarking"]');
      root?.querySelector('.v243-attention-filter')?.scrollIntoView({behavior:'smooth',block:'start'});
    },40);
    return;
  }
  if(kind==='loss-recovery'){
    const lm=lossModel(), scoped=current?.plantId?lm.use.filter(r=>String(r.Plant_ID)===String(current.plantId)):lm.use;
    const technicalValue=scoped.reduce((s,r)=>s+N(r.Recoverable_Loss_MWh)*1000*(lm.tariff.get(String(r.Plant_ID))||0),0);
    window.AIP_CONTEXT_NAV={
      source:'Loss & Recovery',
      target:'commercialppa',
      metric:'Technical Recoverable Revenue',
      technicalRecoverableRevenue:technicalValue,
      plantId:current?.plantId||'',
      plantName:current?.plantName||'',
      timestamp:Date.now()
    };
    try{if(typeof window.activate==='function')window.activate('commercialppa');else if(typeof activate==='function')activate('commercialppa')}catch(_){}
  }
};
window.AIPClearBenchmarkAttentionFilter=function(){
  window.AIP_BENCHMARK_ATTENTION_ONLY=false;
  const p=panel('benchmarking');
  if(p)p.dataset.rendered='';
  showTab('benchmarking');
};
function ensureShell(){
 const host=document.getElementById('view-portfoliobenchmarking');if(!host)return null;
 let shell=host.querySelector(':scope > .v51-portfolio-shell');
 if(shell)return shell;
 host.innerHTML=header()+tabs()+`<div class="v51-portfolio-shell"><section class="v51-pp-panel" data-pp-panel="performance"></section><section class="v51-pp-panel" data-pp-panel="benchmarking" hidden></section><section class="v51-pp-panel" data-pp-panel="loss" hidden></section></div>`;
 shell=host.querySelector(':scope > .v51-portfolio-shell');
 host.querySelectorAll(':scope > .portfolio-performance-tabs button[data-pp-tab]').forEach(btn=>btn.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();window.setPortfolioPerformanceTab(btn.dataset.ppTab)}));
 return shell;
}
function panel(tab){const s=ensureShell();return s?s.querySelector(`[data-pp-panel="${tab}"]`):null}
function renderPanel(tab,force=false){
 const p=panel(tab);if(!p)return;
 if(p.dataset.rendered==='1'&&!force)return;
 const t0=performance.now();
 p.innerHTML=tab==='benchmarking'?benchmarkHtml():tab==='loss'?lossHtml():performanceHtml();
 const lossReady=tab!=='loss'||p.querySelector('[data-loss-ready="1"]');
 p.dataset.rendered=lossReady?'1':'';
 p.dataset.renderMs=(performance.now()-t0).toFixed(1);
}
function showTab(tab){
 const host=document.getElementById('view-portfoliobenchmarking');if(!host)return;ensureShell();
 if(tab==='loss'){lossCache={store:null,model:null};const lp=panel('loss');if(lp)lp.dataset.rendered='';}
 renderPanel(tab,tab==='loss');
 host.querySelectorAll(':scope > .portfolio-performance-tabs button[data-pp-tab]').forEach(b=>{const on=b.dataset.ppTab===tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false')});
 host.querySelectorAll('.v51-pp-panel').forEach(p=>p.hidden=p.dataset.ppPanel!==tab);window.PORTFOLIO_PERFORMANCE_TAB=tab;try{PORTFOLIO_PERFORMANCE_TAB=tab}catch(_){ }
 const main=document.getElementById('main');if(main)main.scrollTop=0;
}
window.setPortfolioPerformanceTab=function(tab){showTab(['performance','benchmarking','loss'].includes(tab)?tab:'performance')};
window.renderPortfolioBenchmarking=function(){
 const current=window.PORTFOLIO_PERFORMANCE_TAB||'performance';
 ensureShell();renderPanel(current,current==='loss');showTab(current);
 setTimeout(()=>{if(current!=='benchmarking')renderPanel('benchmarking')},0);
};
window.AIPPortfolioClearContext=function(){clearContext();for(const t of ['benchmarking','loss']){const p=panel(t);if(p)p.dataset.rendered=''}showTab(window.PORTFOLIO_PERFORMANCE_TAB||'performance')};
window.AIPPortfolioToBenchmark=function(pid,name){setContext(pid,name,'Performance');const p=panel('benchmarking');if(p)p.dataset.rendered='';showTab('benchmarking')};
window.AIPPortfolioToLoss=function(pid,name,source){
 setContext(String(pid??'').trim(),String(name??'').trim(),source||'Portfolio Performance');
 const refresh=()=>{const p=panel('loss');if(p)p.dataset.rendered='';showTab('loss')};
 refresh();
 requestAnimationFrame(refresh);
 setTimeout(refresh,40);
 setTimeout(refresh,140);
};
window.AIPPortfolioOpenRoute=function(pid,name,driver,route){
 setContext(pid,name,'Loss & Recovery');
 const d=String(driver||'').toLowerCase(), norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const assetTerms=/inverter/.test(d)?['inverter']:/tracker/.test(d)?['tracker']:/transformer/.test(d)?['transformer']:/module degradation/.test(d)?['module']:/dc strings/.test(d)?['string','combiner']:/soiling/.test(d)?['module','string']:/planned maintenance/.test(d)?[]:[];
 const rawAssets=(()=>{try{const a=typeof window.arAssetSelectorRows==='function'?window.arAssetSelectorRows():[];if(Array.isArray(a)&&a.length)return a}catch(_){};const x=window.APM_IMPORTED_DATA||window.EMBEDDED_EXCEL_DATA||{};return x['Asset Registry']||x.ASSET_REGISTRY||x.Assets||[]})();
 const siteAssets=(Array.isArray(rawAssets)?rawAssets:[]).filter(a=>norm(a.Plant_ID||a.Site_ID)===norm(pid)||norm(a.Plant_Name||a.Site_Name)===norm(name));
 const asset=siteAssets.find(a=>assetTerms.some(t=>norm(a.Asset_Class||a.Asset_Type||a.Type||a.Asset_Tag||a.Asset_ID).includes(norm(t))))||siteAssets[0]||null;
 const assetId=asset?String(asset.Asset_ID||asset.assetId||asset.Asset_Tag||''):'';
 const assetTag=asset?String(asset.Asset_Tag||asset.Tag||assetId):'';
 const wos=(()=>{try{return typeof opsWOs==='function'?opsWOs():[]}catch(_){return []}})();
 const siteWos=(Array.isArray(wos)?wos:[]).filter(w=>norm(w.plant||w.Plant_ID||w.Plant_Name)===norm(pid)||norm(w.plant||w.Plant_ID||w.Plant_Name)===norm(name));
 const wo=siteWos.find(w=>assetId&&(norm(w.asset||w.Asset_ID||w.Asset_Tag)===norm(assetId)||norm(w.asset||w.Asset_ID||w.Asset_Tag)===norm(assetTag)))||siteWos.find(w=>assetTerms.some(t=>norm((w.asset||'')+' '+(w.desc||w.description||'')+' '+(w.type||'')).includes(norm(t))))||siteWos[0]||null;
 let target='assetexplorer', action='Review asset condition';
 if(/grid outage|curtailment/.test(d)){target='commercialppa';action='Review commercial / PPA'}
 else if(/unexplained/.test(d)){target='rootcause';action='Investigate root cause'}
 else if(/planned maintenance|soiling/.test(d)){target='workorderintelligence';action='Open work-order context'}
 const nav={source:'Portfolio Intelligence · Loss & Recovery',target,plantId:String(pid||''),plantName:String(name||''),siteId:String(pid||''),site:String(name||pid||''),lossDriver:String(driver||''),metric:'Recovery Opportunity',actionRoute:action,assetId,assetTag,tag:assetTag,assetClass:asset?String(asset.Asset_Class||asset.Asset_Type||asset.Type||''):'',workOrderId:wo?String(wo.id||wo.Work_Order_ID||wo.woId||''):'',contextToken:'LR-'+Date.now(),timestamp:Date.now()};
 window.AIP_CONTEXT_NAV=nav;
 if(assetId)window.AIP_SELECTED_ASSET_CONTEXT={...nav};
 try{sessionStorage.setItem('aip.context.nav',JSON.stringify(nav))}catch(_){}
 if(target==='workorderintelligence')window.AIP_WO_DESIRED_TAB='ledger';
 try{if(typeof window.activate==='function')window.activate(target);else if(typeof activate==='function')activate(target)}catch(_){}
 setTimeout(()=>{
   if(target==='assetexplorer'){
     try{window.renderAssetExplorer?.()}catch(_){}
     const q=document.querySelector('#view-assetexplorer #axSearch');if(q){q.value=assetTag||assetId||name||pid;q.dispatchEvent(new Event('input',{bubbles:true}))}
   }else if(target==='workorderintelligence'){
     try{window.renderWorkOrderIntelligence?.()}catch(_){}
     if(nav.workOrderId){const q=document.getElementById('wo11-ledger-search');if(q){q.value=nav.workOrderId;q.dispatchEvent(new Event('input',{bubbles:true}))}}
   }else if(target==='rootcause'){
     if(assetId)window.RC_SELECTED_ASSET_ID=assetId;window.RC_ACTIVE_EVENT='';window.RC_PORTFOLIO_CONTEXT={plantId:String(pid||''),plantName:String(name||''),lossDriver:String(driver||''),assetId:assetId};try{window.renderRootCause?.()}catch(_){}
   }
 },100);
};
document.addEventListener('aip:data-source-changed',()=>{lossCache={store:null,model:null};const host=document.getElementById('view-portfoliobenchmarking');if(host)host.querySelectorAll('.v51-pp-panel').forEach(p=>p.dataset.rendered='');window.renderPortfolioBenchmarking()});
window.AIP_BUILD_VERSION='v87_515';
})();
