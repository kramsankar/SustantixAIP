
(function(){
 function renderRootCauseSafe(){
   const root=document.getElementById('view-rootcause');if(!root)return false;
   try{if(typeof renderRootCause==='function')renderRootCause()}catch(e){console.error('Reliability Engineering rootcause recovery failed',e)}
   const ok=String(root.innerHTML||'').trim().length>40;
   if(ok){try{window.applyMaintenanceGroupingSubtabs?.('rootcause')}catch(_){};return true}
   root.innerHTML='<div class="view-head"><div><h1>Reliability Engineering</h1></div></div><div class="rc86-empty">Event & Root Cause could not be rendered. Other Reliability Engineering tabs remain available.</div>';
   try{window.applyMaintenanceGroupingSubtabs?.('rootcause')}catch(_){}
   return false;
 }
 document.addEventListener('click',function(e){
   const nav=e.target?.closest?.('#sidebar .nav-item[data-view="rootcause"]');if(!nav)return;
   setTimeout(()=>{const root=document.getElementById('view-rootcause');if(root?.classList.contains('active')&&!String(root.innerHTML||'').trim())renderRootCauseSafe()},25);
   setTimeout(()=>{const root=document.getElementById('view-rootcause');if(root?.classList.contains('active')&&!root.querySelector('.view-head,.xi-head'))renderRootCauseSafe()},120);
 },false);
 window.__AIPRenderRootCauseSafe=renderRootCauseSafe;
})();
