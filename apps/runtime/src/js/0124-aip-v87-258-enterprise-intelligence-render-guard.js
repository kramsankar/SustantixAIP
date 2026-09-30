
(function(){
'use strict';
function ensureEnterpriseView(view){
  const host=document.getElementById('view-'+view);
  if(!host||!host.classList.contains('active'))return;
  const fn=view==='contextgraph'?window.AIP_V21?.renderers?.contextgraph:window.AIP_V21?.renderers?.operationaltwin;
  if(typeof fn!=='function')return;
  if(!host.children.length || !String(host.textContent||'').trim()){
    try{fn();}catch(e){console.error('Enterprise Intelligence recovery render failed',view,e);}
  }
}
document.addEventListener('click',e=>{
  const n=e.target.closest?.('#sidebar .nav-item[data-view="contextgraph"],#sidebar .nav-item[data-view="operationaltwin"]');
  if(!n)return;
  const view=n.dataset.view;
  requestAnimationFrame(()=>ensureEnterpriseView(view));
  setTimeout(()=>ensureEnterpriseView(view),40);
},true);
document.addEventListener('aip:data-source-changed',()=>{
  setTimeout(()=>{ensureEnterpriseView('contextgraph');ensureEnterpriseView('operationaltwin')},20);
});
})();
