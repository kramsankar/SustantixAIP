
(function(){
'use strict';
function view(){return document.querySelector('#view-operationaltwin')}
function genActive(){
  const v=view(); if(!v)return false;
  const a=[...v.querySelectorAll('#tLayers .xi-tab')].find(x=>x.classList.contains('active'));
  return !!a && a.textContent.trim()==='Generation Forecast';
}
function portfolioActive(){
  const v=view(); return !!v?.querySelector('.gf480-scopebtn[data-scope="portfolio"].active');
}
function setControlState(){
  const v=view(); if(!v)return;
  const off=genActive() && portfolioActive();
  v.classList.toggle('gf483-portfolio-active',off);
  const site=v.querySelector('#tSite'), time=v.querySelector('#tTime'), run=v.querySelector('#tRun');
  if(site){site.disabled=off;site.setAttribute('aria-disabled',off?'true':'false');site.title=off?'Site selection is inactive while All Sites forecast is selected.':''}
  if(time){time.disabled=off;time.setAttribute('aria-disabled',off?'true':'false');time.title=off?'Solar Hour is site-specific and is inactive in All Sites forecast.':''}
  if(run){run.disabled=off;run.setAttribute('aria-disabled',off?'true':'false');run.title=off?'Intervention simulation is site-specific and is inactive in All Sites forecast.':''}
}
function syncSiteCode(){
  const v=view(), s=v?.querySelector('#tSite'), b=v?.querySelector('#gf483SiteCode');
  if(s&&b)b.textContent='Site code · '+s.value;
}
document.addEventListener('change',e=>{
  if(e.target?.matches('#view-operationaltwin #tSite'))syncSiteCode();
},true);
document.addEventListener('click',e=>{
  if(e.target.closest('#view-operationaltwin .gf480-scopebtn') || e.target.closest('#view-operationaltwin #tLayers .xi-tab')){
    setTimeout(setControlState,0);
    setTimeout(setControlState,120);
  }
},true);
/* Lightweight sync after render without observing class mutations. */
let tries=0;
const boot=setInterval(()=>{
  syncSiteCode(); setControlState();
  if(++tries>20)clearInterval(boot);
},150);
window.AIPSyncPortfolioControlState=setControlState;
})();
