
(function(){
  let lastActive=null;
  function activeView(){
    return document.querySelector('.view.active[id^="view-"]')?.id||null;
  }
  function clearIfContextDestinationChanged(){
    const current=activeView();
    if(lastActive && current!==lastActive && typeof window.erClearContext==='function'){
      const ctx=window.AIP_EVENT_FORENSICS_CONTEXT;
      if(ctx){
        const ctxView='view-'+ctx.sourceView;
        if(current!==ctxView) window.erClearContext();
      }
    }
    lastActive=current;
  }
  document.addEventListener('click',function(ev){
    const nav=ev.target.closest?.('#sidebar .nav-item,[data-aip-maint-nav],.aip-maint-subtab');
    if(nav && typeof window.erClearContext==='function'){
      const ctx=window.AIP_EVENT_FORENSICS_CONTEXT;
      if(ctx){
        const dest=nav.dataset?.view||nav.dataset?.aipMaintNav||null;
        if(dest && dest!==ctx.sourceView) window.erClearContext();
      }
    }
  },true);
  const obs=new MutationObserver(clearIfContextDestinationChanged);
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      lastActive=activeView();
      obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
    },{once:true});
  }else{
    lastActive=activeView();
    obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  }
})();
