
(()=>{
 const finiteText=v=>String(v??'').replace(/(?:NaN|Infinity|-Infinity|undefined|null)(?![a-z])/g,'—');
 const cleanRoot=root=>{
   if(!root)return;
   root.querySelectorAll('.kpi-value,.ai3-kpi .val,.vision-kpi-value,td,th,.ai3-bar-row b').forEach(el=>{const t=finiteText(el.textContent);if(t!==el.textContent)el.textContent=t});
   root.querySelectorAll('canvas').forEach(c=>{c.setAttribute('role','img');if(!c.getAttribute('aria-label'))c.setAttribute('aria-label','Data visualization')});
   root.querySelectorAll('svg').forEach(svg=>{svg.setAttribute('preserveAspectRatio',svg.getAttribute('preserveAspectRatio')||'xMidYMid meet');svg.style.maxWidth='100%'});
 };
 let raf=0;const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>cleanRoot(document.querySelector('.view.active')||document.body))};
 document.addEventListener('DOMContentLoaded',schedule,{once:true});
 window.addEventListener('resize',schedule,{passive:true});
 new window.__APMSafeMutationObserver(schedule).observe(document.body,{subtree:true,childList:true});
})();
