
(function(){
  'use strict';
  window.__AIP_STABLE_BUILD__='v3';
  let loginDone=false;
  document.addEventListener('aip:login-complete',function(){
    if(loginDone)return; loginDone=true;
    document.documentElement.classList.add('aip-login-transition');
    document.body.classList.add('aip-login-transition');
    requestAnimationFrame(function(){requestAnimationFrame(function(){
      document.documentElement.classList.remove('aip-login-transition');
      document.body.classList.remove('aip-login-transition');
    })});
  },{once:true});
})();
