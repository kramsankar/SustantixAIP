
(function(){
  const TARGETS = [
    'Enterprise-wide Coverage Map',
    'Enterprise Wide Coverage Map',
    'Cross-module Decision Ledger',
    'Cross Module Decision Ledger'
  ];

  function hideLegacyGuardrailSections(){
    const root=document.getElementById('view-guardrails');
    if(!root)return;

    const candidates=[...root.querySelectorAll('section,div,article')];
    candidates.forEach(el=>{
      if(el.classList.contains('aip-v366-legacy-hidden')) return;

      const ownText=(el.innerText||el.textContent||'').trim();
      if(!ownText) return;

      const matched=TARGETS.some(t=>ownText.includes(t));
      if(!matched) return;

      // Hide the smallest meaningful container carrying the target section.
      // Prefer containers with direct headings / limited structural depth.
      const directHeading=[...el.children].find(ch =>
        /^(H1|H2|H3|H4|DIV|SPAN)$/.test(ch.tagName) &&
        TARGETS.some(t => ((ch.innerText||ch.textContent||'').trim()).includes(t))
      );

      if(directHeading){
        el.classList.add('aip-v366-legacy-hidden');
      }
    });
  }

  function run(){
    requestAnimationFrame(()=>requestAnimationFrame(hideLegacyGuardrailSections));
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(run,500));
  window.addEventListener('resize',()=>setTimeout(run,80));

  const obs=new MutationObserver(()=>setTimeout(run,40));
  document.addEventListener('DOMContentLoaded',()=>{
    const root=document.getElementById('view-guardrails');
    if(root) obs.observe(root,{childList:true,subtree:true});
  });

  const prev=window.renderAIGuardrails;
  if(typeof prev==='function'){
    window.renderAIGuardrails=function(){
      const r=prev.apply(this,arguments);
      setTimeout(run,80);
      return r;
    };
  }
})();
