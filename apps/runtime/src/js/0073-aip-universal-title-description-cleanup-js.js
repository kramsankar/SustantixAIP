
(function(){
  const DESC_CLASSES=['eyebrow','xi-eyebrow','ai3-eyebrow','dd-eyebrow','subtitle','description','desc','kicker','tagline','lede','subhead','view-sub','aip-v30-kicker'];
  const HEADER_SELECTOR=':scope > .view-head,:scope > .page-head,:scope > .screen-head,:scope > .module-head,:scope > .xi-head,:scope > .ai3-head,:scope > .dd-head,:scope > [class$="-head"],:scope > [class*="-head "]';
  function isHelp(el){return !!el.closest('#helpModal,.help-modal,.f1-help-modal,[data-help-content],#f1HelpPanel');}
  function cleanView(view){
    if(!view || !view.matches || !view.matches('#main .view')) return;
    let headers=[];
    try{headers=[...view.querySelectorAll(HEADER_SELECTOR)];}catch(e){}
    headers.forEach(header=>{
      DESC_CLASSES.forEach(c=>header.querySelectorAll('.'+c).forEach(el=>{if(!isHelp(el))el.remove();}));
      header.querySelectorAll('h1,h2').forEach(title=>{
        let n=title.nextElementSibling;
        while(n && /^(P|SMALL)$/.test(n.tagName)){
          const next=n.nextElementSibling;
          if(!isHelp(n))n.remove();
          n=next;
        }
      });
      const next=header.nextElementSibling;
      if(next && next.classList.contains('section-note') && !isHelp(next)) next.remove();
    });
    view.querySelectorAll('.aip-v30-kicker').forEach(el=>{if(!isHelp(el))el.remove();});
  }
  function cleanAll(root=document){
    if(root.matches && root.matches('#main .view')) cleanView(root);
    root.querySelectorAll && root.querySelectorAll('#main .view').forEach(cleanView);
  }
  cleanAll();
  new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)cleanAll(n)})))
    .observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>cleanAll());
  setTimeout(()=>cleanAll(),0); setTimeout(()=>cleanAll(),500); setTimeout(()=>cleanAll(),1500);
})();
