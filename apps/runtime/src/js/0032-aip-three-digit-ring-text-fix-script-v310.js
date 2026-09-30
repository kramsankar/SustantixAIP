
(function(){
  const selector='.aip-kpi-ring-value,.kpi-mini-ring span,.vision-ring span,.ai3-ring span';
  function fit(root){
    const scope=root&&root.querySelectorAll?root:document;
    scope.querySelectorAll(selector).forEach(function(el){
      const t=(el.textContent||'').trim().replace(/\s+/g,'');
      const n=parseFloat(t.replace('%',''));
      el.classList.toggle('aip-ring-three-digit',Number.isFinite(n)&&Math.abs(n)>=100);
      el.setAttribute('title',t||'0%');
    });
    if(root&&root.matches&&root.matches(selector)){
      const t=(root.textContent||'').trim().replace(/\s+/g,'');
      const n=parseFloat(t.replace('%',''));
      root.classList.toggle('aip-ring-three-digit',Number.isFinite(n)&&Math.abs(n)>=100);
      root.setAttribute('title',t||'0%');
    }
  }
  function start(){
    fit(document);
    let queued=false;
    const mo=new window.__APMSafeMutationObserver(function(muts){
      if(queued)return; queued=true;
      requestAnimationFrame(function(){queued=false;fit(document)});
    });
    mo.observe(document.body,{subtree:true,childList:true,characterData:true});
    document.addEventListener('click',function(){requestAnimationFrame(function(){fit(document)})},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
