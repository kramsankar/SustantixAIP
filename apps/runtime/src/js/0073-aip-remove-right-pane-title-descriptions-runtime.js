
(function(){
  const headerSelectors=[
    ':scope > .view-head',':scope > .page-head',':scope > .screen-head',':scope > .module-head',
    ':scope > .xi-head',':scope > .ai3-head',':scope > .dd-head',
    ':scope > [class$="-head"]',':scope > [class*="-head "]'
  ];
  const descriptiveClasses=['eyebrow','subtitle','description','desc','kicker','tagline','lede','subhead'];
  function clean(view){
    if(!view || !view.matches || !view.matches('#main .view')) return;
    const headers=[];
    headerSelectors.forEach(sel=>{try{view.querySelectorAll(sel).forEach(h=>headers.push(h));}catch(e){}});
    [...new Set(headers)].forEach(h=>{
      descriptiveClasses.forEach(c=>h.querySelectorAll('.'+c).forEach(el=>el.style.setProperty('display','none','important')));
      const title=h.querySelector('h1,h2');
      if(!title) return;
      const wrap=title.parentElement;
      if(wrap && wrap!==h){
        [...wrap.children].forEach(el=>{
          if(el===title) return;
          if(el.matches('p,small') && !el.querySelector('button,input,select,textarea')) el.style.setProperty('display','none','important');
        });
      }
    });
  }
  function cleanAll(){document.querySelectorAll('#main .view').forEach(clean);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',cleanAll,{once:true}); else cleanAll();
  const root=document.getElementById('main');
  if(root) new MutationObserver(cleanAll).observe(root,{childList:true,subtree:true});
})();
