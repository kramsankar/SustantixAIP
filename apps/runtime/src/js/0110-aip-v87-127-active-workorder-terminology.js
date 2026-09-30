
(function(){
 function clean(){
  const h=document.getElementById('view-workorderintelligence'); if(!h)return;
  h.querySelectorAll('.ov121-label,.ovd-kpi-label,.kpi-label').forEach(n=>{
    if(/^open(?: work orders?)?$/i.test((n.textContent||'').trim())) n.textContent='Active';
  });
  h.querySelectorAll('*').forEach(n=>{
    if(n.children.length)return;
    const t=(n.textContent||'').trim();
    if(/^\d+\s+open work orders$/i.test(t)) n.textContent=t.replace(/open work orders/i,'Active Work Orders');
  });
 }
 const h=document.getElementById('view-workorderintelligence');
 if(h)new MutationObserver(()=>requestAnimationFrame(clean)).observe(h,{childList:true,subtree:true});
 document.addEventListener('click',()=>setTimeout(clean,0),true);
 clean();
})();
