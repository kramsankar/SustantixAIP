
(function(){'use strict';
let SCOPE='site';
const getP=()=>window.AIP_V475||{};
const objs=(h,rows)=>(rows||[]).map(r=>Object.fromEntries((h||[]).map((x,i)=>[x,r[i]])));
const N=v=>Number(v||0), money=v=>'₹'+N(v).toLocaleString('en-IN',{maximumFractionDigits:0});
function currentH(){return Number(document.querySelector('#view-operationaltwin [data-gfh].active')?.dataset.gfh||24)}
function currentSite(){return document.querySelector('#view-operationaltwin #tSite')?.value||'SP-01'}
function data(){const P=getP();return {P,runs:objs(P.runH,P.runs),perf:objs(P.perfH,P.perf),comm:objs(P.commH,P.comm),f:P.forecast||[]}}
function ensureScope(shell){let bar=shell.querySelector('.gf480-scopebar');if(bar)return bar;bar=document.createElement('div');bar.className='gf480-scopebar';const sites=[...new Set((getP().forecast||[]).map(x=>x.Plant_ID))].sort();bar.innerHTML='<span class="lbl">Select Forecast Scope</span><button type="button" class="gf480-scopebtn" data-scope="portfolio">All Sites</button><button type="button" class="gf480-scopebtn active" data-scope="site">Site-specific</button>';shell.insertBefore(bar,shell.firstChild.nextSibling||shell.firstChild);bar.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>setScope(b.dataset.scope));return bar}
function syncScope(shell){
 const bar=ensureScope(shell);
 bar.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope===SCOPE));
 const original=[...shell.children].filter(x=>!x.classList.contains('gf480-scopebar')&&!x.classList.contains('gf480-portfolio')&&!x.classList.contains('gf377-top'));
 let p=shell.querySelector('.gf480-portfolio');
 if(SCOPE==='portfolio'){
   if(!p){p=document.createElement('div');p.className='gf480-portfolio';shell.appendChild(p)}
   const hh=String(currentH());
   try{
     if(p.dataset.h!==hh||!p.innerHTML){renderPortfolio(p);p.dataset.h=hh}
     p.classList.add('on');
     /* Hide site-specific forecast only after portfolio content exists. */
     original.forEach(x=>x.classList.add('gf480-hide-portfolio'));
   }catch(err){
     console.error('AIP All Sites portfolio rendering failed',err);
     p.classList.remove('on');
     original.forEach(x=>x.classList.remove('gf480-hide-portfolio'));
     SCOPE='site';
     bar.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope==='site'));
   }
 }else{
   if(p)p.classList.remove('on');
   original.forEach(x=>x.classList.remove('gf480-hide-portfolio'));
 }
}
function setScope(scope){
 SCOPE=scope;
 const shell=document.querySelector('#view-operationaltwin .gf377-shell');
 if(!shell)return;
 try{syncScope(shell)}
 catch(err){
   console.error('AIP All Sites forecast render failed',err);
   const original=[...shell.children].filter(x=>!x.classList.contains('gf480-scopebar')&&!x.classList.contains('gf480-portfolio'));
   original.forEach(x=>x.classList.remove('gf480-hide-portfolio'));
   SCOPE='site';
   const bar=ensureScope(shell);
   bar.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope==='site'));
 }
}
function siteRows(h){const {runs,comm,perf}=data();return runs.filter(r=>N(r.Horizon_Hours)===h).map(r=>{const c=comm.find(x=>x.Forecast_Run_ID===r.Forecast_Run_ID)||{};const p=perf.find(x=>x.Plant_ID===r.Plant_ID&&N(x.Horizon_Hours)===h)||{};return {...r,Exposure:N(c.Forward_Revenue_Exposure_INR),Error:N(p.Hybrid_nMAE_Pct),Reliability:N(p.Interval_Coverage_Pct)}}).sort((a,b)=>b.Exposure-a.Exposure)}
function agg(h){const rows=siteRows(h),{perf}=data(), pp=perf.find(x=>x.Plant_ID==='PORTFOLIO'&&N(x.Horizon_Hours)===h)||{};const sum=k=>rows.reduce((a,x)=>a+N(x[k]),0);return {rows,physics:sum('Physics_Forecast_MWh'),hybrid:sum('Hybrid_Forecast_MWh'),risk:sum('Operational_Energy_At_Risk_MWh'),exposure:sum('Exposure'),trust:rows.length?rows.reduce((a,x)=>a+N(x.Data_Trust_Pct),0)/rows.length:0,perf:pp}}
function series(h){const f=(getP().forecast||[]).filter(r=>N(r.Lead_Hours)<=h);const map=new Map();f.forEach(r=>{const k=r.Interval_Start;let x=map.get(k);if(!x)x={t:k,phy:0,hyb:0,lo:0,hi:0};x.phy+=N(r.Weather_Adjusted_Physics_MW);x.hyb+=N(r.Forecast_Delivered_MW);x.lo+=N(r.Forecast_Lower_MW);x.hi+=N(r.Forecast_Upper_MW);map.set(k,x)});return [...map.values()].sort((a,b)=>String(a.t).localeCompare(String(b.t)))}
function chart(a){
 if(!a.length)return '<div>No portfolio interval data.</div>';
 const W=850,H=286,L=48,R=16,T=18,B=26;
 const max=Math.max(1,...a.flatMap(x=>[N(x.phy),N(x.hyb)]))*1.07;
 const X=i=>L+i/Math.max(1,a.length-1)*(W-L-R);
 const Y=v=>H-B-N(v)/max*(H-B-T);
 const path=key=>a.map((x,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(x[key]).toFixed(1)).join(' ');
 const grid=[0,.25,.5,.75,1].map(q=>{
   const yy=H-B-q*(H-B-T);
   return `<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e6edf0"/>
           <text x="${L-7}" y="${yy+3}" text-anchor="end" font-size="8" fill="#78909c">${(max*q).toFixed(0)}</text>`;
 }).join('');
 return `<div class="gf488-chartwrap">
   <svg id="gf488Chart" class="gf480-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="All Sites aggregated generation forecast">
     <text x="5" y="12" font-size="8" fill="#78909c">MW</text>
     ${grid}
     <path d="${path('phy')}" fill="none" stroke="#2563eb" stroke-width="2.4"/>
     <path d="${path('hyb')}" fill="none" stroke="#16a34a" stroke-width="2.8"/>
     <line id="gf488Cursor" x1="${X(0)}" x2="${X(0)}" y1="${T}" y2="${H-B}" stroke="#8d4aa3" stroke-width="1.6"/>
     <circle id="gf488Dot" cx="${X(0)}" cy="${Y(a[0]?.hyb||0)}" r="4" fill="#8d4aa3" stroke="#fff" stroke-width="2"/>
     <rect id="gf488Hit" x="${L}" y="${T}" width="${W-L-R}" height="${H-B-T}" fill="transparent"/>
   </svg>
   <div class="gf488-tooltip" id="gf488Tip"></div>
 </div>`
}
function wirePortfolioChart(a){
 const svg=document.getElementById('gf488Chart'),hit=document.getElementById('gf488Hit'),tip=document.getElementById('gf488Tip');
 if(!svg||!hit||!a.length)return;
 const W=850,H=286,L=48,R=16,T=18,B=26;
 const max=Math.max(1,...a.flatMap(x=>[N(x.phy),N(x.hyb)]))*1.07;
 const choose=e=>{
   const rect=svg.getBoundingClientRect();
   const vx=(e.clientX-rect.left)/Math.max(1,rect.width)*W;
   const idx=Math.max(0,Math.min(a.length-1,Math.round((vx-L)/Math.max(1,W-L-R)*(a.length-1))));
   const q=a[idx],x=L+idx/Math.max(1,a.length-1)*(W-L-R),y=H-B-N(q.hyb)/max*(H-B-T);
   const cur=document.getElementById('gf488Cursor'),dot=document.getElementById('gf488Dot');
   if(cur){cur.setAttribute('x1',x);cur.setAttribute('x2',x)}
   if(dot){dot.setAttribute('cx',x);dot.setAttribute('cy',y)}
   if(tip){
     const ts=String(q.t||'').replace('T',' ').slice(0,16);
     tip.innerHTML=`<b>${ts}</b><br><span>Portfolio physics forecast</span> ${N(q.phy).toFixed(1)} MW<br><span>Portfolio hybrid forecast</span> ${N(q.hyb).toFixed(1)} MW`;
     tip.style.display='block';
     tip.style.left=Math.max(4,Math.min(rect.width-210,e.clientX-rect.left+9))+'px';
     tip.style.top=Math.max(3,e.clientY-rect.top-67)+'px';
   }
 };
 hit.addEventListener('mousemove',choose);
 hit.addEventListener('click',choose);
 hit.addEventListener('mouseleave',()=>{if(tip)tip.style.display='none'});
}
function kpi(l,v,s){return `<div class="gf480-kpi"><span>${l}</span><b>${v}</b><small>${s}</small><div class="bars"><i></i><i></i><i></i><i></i><i></i></div></div>`}
function renderPortfolio(root){const h=currentH(),A=agg(h),a=series(h),share=x=>A.hybrid?N(x.Hybrid_Forecast_MWh)/A.hybrid*100:0;const largest=A.rows.slice(0,3);root.innerHTML=`<div class="gf480-kpis">${kpi('Portfolio Forecast Energy',A.hybrid.toFixed(2)+' MWh','Sum of 12 independently generated site forecasts')}${kpi('Physics Forecast Energy',A.physics.toFixed(2)+' MWh','Portfolio sum of site physics forecasts')}${kpi('Energy at Risk',A.risk.toFixed(2)+' MWh','Sum of site-level operational energy at risk')}${kpi('Forward Revenue Exposure',money(A.exposure),'Sum of governed site commercial exposures')}</div><div class="gf480-grid"><section class="gf480-chartcard"><h3>${h===168?'7-day':h+'-hour'} portfolio generation forecast · aggregated after site-level forecasting</h3>${chart(a)}<div class="gf480-chartlegend"><span><i style="--c:#2563eb"></i>Portfolio physics forecast</span><span><i style="--c:#16a34a"></i>Portfolio hybrid forecast</span></div></section><aside class="gf480-formcard"><h3>Portfolio Forecast Formation</h3><div class="gf480-formrow"><span>Sites independently forecast</span><b>${A.rows.length} / 12</b></div><div class="gf480-formrow"><span>Site weather/NWP contexts</span><b>${A.rows.length} separate</b></div><div class="gf480-formrow"><span>Site physics + residual ML runs</span><b>${A.rows.length} complete</b></div><div class="gf480-formrow"><span>Portfolio aggregation stage</span><b>Post-forecast</b></div><div class="gf480-formrow"><span>Average data trust</span><b>${A.trust.toFixed(2)}%</b></div><div class="gf480-formnote"><b>No single portfolio irradiance, cloud-cover, temperature or wind value is used.</b> Each site retains its own weather and engineering context. Only compatible MW/MWh, exposure and performance outputs are aggregated.</div>${largest.length?'<div class="gf480-formnote"><b>Largest forward exposure contributors:</b><br>'+largest.map(x=>x.Plant_ID+' · '+money(x.Exposure)).join('<br>')+'</div>':''}</aside></div><section class="gf480-sites"><h3>Site Forecast Contribution</h3><div class="sub">Every row is the output of that site's own forecast run. Click a site to switch to its detailed Generation Forecast.</div><div class="gf480-siteswrap"><table><thead><tr><th class="txt">Site</th><th class="num">Hybrid Forecast MWh</th><th class="num">Portfolio Share</th><th class="num">Energy at Risk MWh</th><th class="num">Forward ₹ Exposure</th><th class="num">Forecast Error %</th><th class="num">Data Trust %</th></tr></thead><tbody>${A.rows.map((x,i)=>`<tr><td class="txt"><span class="rank">${i+1}</span><button data-site="${x.Plant_ID}">${x.Plant_ID}</button></td><td class="num">${N(x.Hybrid_Forecast_MWh).toFixed(2)}</td><td class="num">${share(x).toFixed(2)}%</td><td class="num">${N(x.Operational_Energy_At_Risk_MWh).toFixed(2)}</td><td class="num">${money(x.Exposure)}</td><td class="num">${N(x.Error).toFixed(2)}%</td><td class="num">${N(x.Data_Trust_Pct).toFixed(2)}%</td></tr>`).join('')}</tbody></table></div></section><section class="gf480-perf"><div class="gf480-perfhead"><div><h3>Portfolio Forecast Performance & Calibration</h3></div><div class="gf480-perfnav"><button class="gf480-nav" data-pfd="runsvalidation">Runs & Validation <i>↗</i></button><button class="gf480-nav" data-pfd="modelgovernance">Model & Governance <i>↗</i></button><button class="gf480-nav" data-pfd="commercial">Commercial Exposure <i>↗</i></button></div></div><div class="gf480-perfkpis"><div class="gf480-perfkpi"><span>Physics Forecast Error</span><b>${N(A.perf.Physics_nMAE_Pct).toFixed(2)}%</b><small>Portfolio normalized forecast error</small></div><div class="gf480-perfkpi"><span>Hybrid Forecast Error</span><b>${N(A.perf.Hybrid_nMAE_Pct).toFixed(2)}%</b><small>After residual ML correction</small></div><div class="gf480-perfkpi"><span>Forecast Accuracy Gain</span><b>${N(A.perf.Improvement_vs_Physics_Pct).toFixed(1)}%</b><small>Error reduction vs physics baseline</small></div><div class="gf480-perfkpi"><span>Forecast Range Reliability</span><b>${N(A.perf.Interval_Coverage_Pct).toFixed(1)}%</b><small>Actuals inside calibrated band</small></div></div></section>`;
wirePortfolioChart(a);
root.querySelectorAll('[data-site]').forEach(b=>b.onclick=()=>{const t=document.querySelector('#view-operationaltwin #tSite');if(t){t.value=b.dataset.site;t.dispatchEvent(new Event('change',{bubbles:true}))}SCOPE='site';setTimeout(()=>{const sh=document.querySelector('#view-operationaltwin .gf377-shell');if(sh){ensureScope(sh);syncScope(sh)}},100)});root.querySelectorAll('[data-pfd]').forEach(b=>b.onclick=()=>{root.querySelectorAll('[data-pfd]').forEach(x=>x.classList.toggle('active',x===b));openPortfolioDrillCombined(b.dataset.pfd,h)})}
function modal(){let m=document.getElementById('gf480-modal');if(m)return m;m=document.createElement('div');m.id='gf480-modal';m.className='gf480-modal';m.innerHTML='<div class="gf480-panel"><div class="gf480-panelhead"><h3></h3><button class="gf480-close">×</button></div><div class="gf480-body"></div></div>';document.body.appendChild(m);m.querySelector('.gf480-close').onclick=()=>m.classList.remove('open');m.onclick=e=>{if(e.target===m)m.classList.remove('open')};return m}
function table(cols,rows,right=[]){return '<table><thead><tr>'+cols.map((x,i)=>`<th class="${right.includes(i)?'num':'txt'}">${x}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map((v,i)=>`<td class="${right.includes(i)?'num':'txt'}">${v}</td>`).join('')+'</tr>').join('')+'</tbody></table>'}

function openPortfolioDrillCombined(kind,h){
 if(kind==='runsvalidation'){
   openPortfolioDrill('runs',h);
   setTimeout(()=>{
     const m=document.getElementById('gf480-modal'),body=m?.querySelector('.gf480-body');
     if(!body)return;
     const first=body.innerHTML;
     openPortfolioDrill('validation',h);
     const second=m.querySelector('.gf480-body')?.innerHTML||'';
     m.querySelector('h3').textContent='Runs & Validation';
     m.querySelector('.gf480-body').innerHTML=
       '<section class="gf492-drillsection"><h4>Forecast Runs</h4>'+first+'</section>'+
       '<section class="gf492-drillsection"><h4>Validation & Calibration</h4>'+second+'</section>';
     window.AIPNormalizeForecastDrillTables?.(m);
   },0);
   return;
 }
 if(kind==='modelgovernance'){
   openPortfolioDrill('performance',h);
   setTimeout(()=>{
     const m=document.getElementById('gf480-modal'),body=m?.querySelector('.gf480-body');
     if(!body)return;
     const first=body.innerHTML;
     m.querySelector('h3').textContent='Model & Governance';
     m.querySelector('.gf480-body').innerHTML=
       '<section class="gf492-drillsection"><h4>Portfolio Model Performance</h4>'+first+'</section>'+
       '<section class="gf492-drillsection"><h4>Governance</h4><p>Portfolio results inherit the governed site-level physics, residual-ML and calibration model versions. Model approval and replacement remain governed at the underlying model level; no separate portfolio weather/model run is created.</p></section>';
     window.AIPNormalizeForecastDrillTables?.(m);
   },0);
   return;
 }
 openPortfolioDrill(kind,h);
}
function openPortfolioDrill(kind,h){const m=modal(),title=m.querySelector('h3'),body=m.querySelector('.gf480-body'),A=agg(h);if(kind==='runs'){title.textContent='Portfolio Forecast Runs';body.innerHTML='<p>These are the independently executed site forecast runs used in the portfolio aggregation. No portfolio weather run is created.</p>'+table(['Site','Forecast Run','Forecast Horizon (hours)','Physics MWh','Hybrid MWh','Energy at Risk MWh','Data Trust %'],A.rows.map(x=>[x.Plant_ID,x.Forecast_Run_ID,N(x.Horizon_Hours),N(x.Physics_Forecast_MWh).toFixed(2),N(x.Hybrid_Forecast_MWh).toFixed(2),N(x.Operational_Energy_At_Risk_MWh).toFixed(2),N(x.Data_Trust_Pct).toFixed(2)]),[2,3,4,5,6])}else if(kind==='commercial'){title.textContent='Portfolio Forward Commercial Exposure';body.innerHTML='<p>Portfolio exposure is the arithmetic sum of governed site-level exposures for the same forecast horizon.</p>'+table(['Site','Forecast Run','Hybrid MWh','Energy at Risk MWh','Forward Exposure'],A.rows.map(x=>[x.Plant_ID,x.Forecast_Run_ID,N(x.Hybrid_Forecast_MWh).toFixed(2),N(x.Operational_Energy_At_Risk_MWh).toFixed(2),money(x.Exposure)]),[2,3,4])}else{const {perf}=data(),rr=perf.filter(x=>x.Plant_ID==='PORTFOLIO'||(kind==='performance'&&N(x.Horizon_Hours)===h));title.textContent=kind==='validation'?'Portfolio Forecast Validation':'Portfolio Model Performance';body.innerHTML='<p>Portfolio performance is calculated from aggregated interval forecasts versus aggregated actual generation. Site-level statistics remain available in the contribution view.</p>'+table(['Scope','Plant','Forecast Horizon (hours)','Samples','Physics Error %','Hybrid Error %','Accuracy Gain %','Range Reliability %'],rr.map(x=>[x.Scope,x.Plant_ID,N(x.Horizon_Hours),N(x.Sample_Count),N(x.Physics_nMAE_Pct).toFixed(2),N(x.Hybrid_nMAE_Pct).toFixed(2),N(x.Improvement_vs_Physics_Pct).toFixed(1),N(x.Interval_Coverage_Pct).toFixed(1)]),[2,3,4,5,6,7])}m.classList.add('open')}
function wireSiteDrills(){document.querySelectorAll('#view-operationaltwin .gf476-nav').forEach(b=>{if(b.dataset.v480)return;b.dataset.v480='1';b.addEventListener('click',()=>{document.querySelectorAll('#view-operationaltwin .gf476-nav').forEach(x=>x.classList.toggle('active',x===b))})})}
function enhance(){const shell=document.querySelector('#view-operationaltwin .gf377-shell');if(!shell)return;ensureScope(shell);syncScope(shell);wireSiteDrills();shell.querySelectorAll('[data-gfh]').forEach(b=>{if(b.dataset.v480)return;b.dataset.v480='1';b.addEventListener('click',()=>setTimeout(()=>{const sh=document.querySelector('#view-operationaltwin .gf377-shell');if(sh){ensureScope(sh);syncScope(sh)}},40))})}
/* v485: explicit event-driven enhancement only. The former global MutationObserver
   could re-enter enhancement while the All Sites portfolio DOM was being created,
   causing flicker/blank portfolio content. */
document.addEventListener('click',e=>{
  const t=e.target&&e.target.closest?e.target.closest('#view-operationaltwin [data-gfh], #view-operationaltwin #tLayers .xi-tab'):null;
  if(t)setTimeout(enhance,60);
},true);
document.addEventListener('change',e=>{
  if(e.target&&e.target.matches&&e.target.matches('#view-operationaltwin #tSite, #view-operationaltwin #gf377Run'))setTimeout(enhance,60);
},true);
window.AIPRefreshGenerationForecastScope=enhance;
window.AIPSetGenerationForecastScope=setScope;
setTimeout(enhance,300);
window.AIP_V480_PORTFOLIO={release:'v487',siteSelector:'Operational Twin #tSite is the single source of truth for Site forecast mode',scope:'Generation Forecast only',aggregation:'Independent site forecast outputs aggregated after site-level weather/physics/ML',sites:12,validPortfolioOutputs:['MW','MWh','Energy at Risk','Forward Revenue Exposure','Forecast performance'],notAggregatedAsSinglePhysicalInput:['POA irradiance','cloud cover','ambient temperature','wind speed']};
})();
