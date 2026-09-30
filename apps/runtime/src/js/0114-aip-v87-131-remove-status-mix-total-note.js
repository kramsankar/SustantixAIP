
(function(){
 function clean(){
  const h=document.getElementById('view-workorderintelligence'); if(!h)return;
  const heading=[...h.querySelectorAll('h2,h3,h4,.section-title,.card-title')].find(n=>/work order status mix/i.test(n.textContent||''));
  if(!heading)return;
  const panel=heading.closest('.card,.panel,.ops-panel,.chart-card,.widget')||heading.parentElement;
  if(!panel)return;
  panel.querySelectorAll('*').forEach(n=>{
    if(n.children.length)return;
    const t=(n.textContent||'').trim();
    if(/^legend\s*total\s*:?\s*88\s+open\s+work\s+orders$/i.test(t))n.remove();
  });
 }
 const h=document.getElementById('view-workorderintelligence');
 if(h)new MutationObserver(()=>requestAnimationFrame(clean)).observe(h,{childList:true,subtree:true});
 document.addEventListener('click',()=>setTimeout(clean,0),true);
 clean();
})();
