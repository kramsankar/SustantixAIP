
(function(){
'use strict';
/* Capture the known-good persistent Portfolio handlers BEFORE deferred legacy modules execute.
   After boot/login completes, reinstall these exact handlers so no older renderer can take ownership. */
const H={
  set:window.setPortfolioPerformanceTab,
  render:window.renderPortfolioBenchmarking,
  clear:window.AIPPortfolioClearContext,
  toBenchmark:window.AIPPortfolioToBenchmark,
  toLoss:window.AIPPortfolioToLoss,
  openRoute:window.AIPPortfolioOpenRoute
};
function installV53(refresh){
  if(typeof H.set==='function')window.setPortfolioPerformanceTab=H.set;
  if(typeof H.render==='function')window.renderPortfolioBenchmarking=H.render;
  if(typeof H.clear==='function')window.AIPPortfolioClearContext=H.clear;
  if(typeof H.toBenchmark==='function')window.AIPPortfolioToBenchmark=H.toBenchmark;
  if(typeof H.toLoss==='function')window.AIPPortfolioToLoss=H.toLoss;
  if(typeof H.openRoute==='function')window.AIPPortfolioOpenRoute=H.openRoute;
  window.AIP_BUILD_VERSION='v87_53';
  if(refresh){
    const host=document.getElementById('view-portfoliobenchmarking');
    if(host&&host.classList.contains('active')&&typeof H.render==='function'){
      try{H.render()}catch(e){console.error('Portfolio v87_53 refresh failed',e)}
    }
  }
}
window.__installAIPPortfolioV53=installV53;
/* This fires only after every deferred application module has finished. */
window.addEventListener('aip:runtime-ready',function(){setTimeout(function(){installV53(true)},0)});
/* Login-complete is a second post-boot guard for browsers where CustomEvent ordering differs. */
document.addEventListener('aip:login-complete',function(){setTimeout(function(){installV53(true)},0)});
/* Data-source changes may invoke legacy listeners; reassert the same handler after that event completes. */
document.addEventListener('aip:data-source-changed',function(){setTimeout(function(){installV53(false)},0)});
installV53(false);
})();
