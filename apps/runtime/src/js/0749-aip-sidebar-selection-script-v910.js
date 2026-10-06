(function(){
let replay=false,ticket=0;
const sidebar=document.getElementById('sidebar');
// Legacy grouped-module callbacks can clear the sidebar after routing.
// Restore the current module's alias in the same mutation turn, before paint.
if(sidebar)new MutationObserver(()=>{
 if(sidebar.querySelector('.nav-item.active'))return;
 const view=document.querySelector('#main>.view.active')?.id.replace(/^view-/,'');
 const alias=window.AIP_MAINTENANCE_NAV_ALIAS?.[view]||view;
 if(alias)sidebar.querySelector('.nav-item[data-view="'+CSS.escape(alias)+'"]')?.classList.add('active');
}).observe(sidebar,{subtree:true,attributes:true,attributeFilter:['class']});
window.addEventListener('click',event=>{
 const button=event.target.closest?.('#sidebar .nav-item[data-view]');
 if(!button||replay||button.disabled)return;
 event.preventDefault();event.stopImmediatePropagation();
 const current=++ticket;
 document.querySelectorAll('#sidebar .nav-item.active').forEach(e=>{if(e!==button)e.classList.remove('active')});
 button.classList.add('active');
 // Paint the selection before the destination's synchronous rendering work.
 requestAnimationFrame(()=>setTimeout(()=>{
  if(current!==ticket||!button.isConnected)return;
  replay=true;try{button.click()}finally{replay=false;
   document.querySelectorAll('#sidebar .nav-item.active').forEach(e=>{if(e!==button)e.classList.remove('active')});
   button.classList.add('active');
  }
 },0));
},true);
})();
