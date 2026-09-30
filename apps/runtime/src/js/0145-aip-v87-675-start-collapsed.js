
(function(){
  let startupResetDone=false;
  function collapseAllMainNav(){
    document.querySelectorAll('#sidebar .x-nav-group').forEach(g=>{
      g.classList.remove('open');
      const h=g.querySelector(':scope > .x-nav-head');
      if(h)h.setAttribute('aria-expanded','false');
      const ic=h?.querySelector('.x-nav-icon');
      if(ic)ic.textContent='+';
    });
  }
  function enforceStartupCollapsed(){
    collapseAllMainNav();
    // A few deferred startup renderers can auto-open the group containing the
    // active view. Reapply briefly during initial boot only.
    [0,40,120,260,520].forEach(ms=>setTimeout(collapseAllMainNav,ms));
    setTimeout(()=>{startupResetDone=true},650);
  }
  // Fresh page load / already-authenticated reload.
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enforceStartupCollapsed,{once:true});
  else enforceStartupCollapsed();

  // Fresh login: runtime-ready occurs after deferred dashboard initialization.
  window.addEventListener('aip:runtime-ready',enforceStartupCollapsed);

  // Do not interfere after startup; normal user +/- interactions remain untouched.
})();
