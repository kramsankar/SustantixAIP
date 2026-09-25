
(function(){
'use strict';
function clean(){
  const h=document.getElementById('view-workorderintelligence'); if(!h)return;
  const candidates=[...h.querySelectorAll('*')];
  candidates.forEach(n=>{
    if(n.children.length)return;
    const t=(n.textContent||'').trim();
    /* Only change aggregate center-style text containing the total 88 + Open.
       Do not touch legend/status rows such as Open 28. */
    if(/^88\s+open$/i.test(t) || /^open\s+88$/i.test(t)){
      n.textContent='88 Active';
    }
  });
}
const h=document.getElementById('view-workorderintelligence');
if(h)new MutationObserver(()=>requestAnimationFrame(clean)).observe(h,{childList:true,subtree:true});
document.addEventListener('click',()=>setTimeout(clean,0),true);
document.addEventListener('aip:data-source-changed',()=>requestAnimationFrame(clean));
document.addEventListener('apm:datasource-refreshed',()=>requestAnimationFrame(clean));
clean();
})();
