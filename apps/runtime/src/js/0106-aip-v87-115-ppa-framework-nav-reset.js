
(function(){
  document.addEventListener('click',function(e){
    const nav=e.target?.closest?.('#sidebar .nav-item');
    if(!nav)return;
    window.__cppaPpaFrameworkOpen=false;

    /* If Commercial & PPA itself is selected from the left pane, always return
       to its normal main workspace rather than leaving the configuration screen. */
    const target=String(nav.dataset?.view||nav.dataset?.nav||nav.getAttribute('data-view')||'').toLowerCase();
    if(target.includes('commercialppa')||target.includes('commercial')){
      requestAnimationFrame(()=>{
        if(window.__renderCommercialPPA_v8768)window.__renderCommercialPPA_v8768();
      });
    }
  },true);
})();
