
(function(){
  function mark(){
    const root=document.getElementById('view-modelregistry'); if(!root)return;
    const els=[...root.querySelectorAll('div,span,button')].filter(e=>{
      const t=(e.textContent||'').replace(/\s+/g,' ').trim();
      return /^(Native|External)\s*[•·]\s*(Configured|Not configured)\s*\d+$/i.test(t);
    });
    els.forEach(e=>{
      const t=(e.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      e.classList.remove('native-configured-summary','native-not-configured-summary','external-configured-summary','external-not-configured-summary');
      if(t.startsWith('native')&&t.includes('not configured'))e.classList.add('native-not-configured-summary');
      else if(t.startsWith('native'))e.classList.add('native-configured-summary');
      else if(t.startsWith('external')&&t.includes('not configured'))e.classList.add('external-not-configured-summary');
      else e.classList.add('external-configured-summary');
      e.style.minHeight='31px';e.style.padding='6px 11px';e.style.marginRight='4px';
    });
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(mark,700));
  const old=window.renderModels;
  if(typeof old==='function')window.renderModels=function(){const r=old.apply(this,arguments);setTimeout(mark,0);return r};
})();
