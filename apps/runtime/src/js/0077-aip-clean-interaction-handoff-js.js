
(function(){
'use strict';
function release(){
  const login=document.getElementById('loginScreen');
  if(login && getComputedStyle(login).display!=='none' && !login.classList.contains('fade-out')) return;
  document.body.classList.remove('loading','is-loading','busy','updating','aip-booting');
  ['app','main','sidebar'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.removeAttribute('inert');el.removeAttribute('aria-busy');
    el.style.pointerEvents='auto';
    el.classList.remove('loading','is-loading','busy','updating','disabled');
  });
  document.querySelectorAll('#main .view.active').forEach(v=>{
    v.removeAttribute('inert');v.style.pointerEvents='auto';
  });
}
document.addEventListener('aip:login-complete',()=>{
  release();requestAnimationFrame(release);
},{once:true});
if(sessionStorage.getItem('eam_logged_in')==='1') requestAnimationFrame(release);
})();
