
(function(){
'use strict';
function fix(){
  const host=document.getElementById('view-workorderintelligence'); if(!host)return;
  const heading=[...host.querySelectorAll('h2,h3,h4,.section-title,.card-title')]
    .find(n=>/work order status mix/i.test(n.textContent||''));
  if(!heading)return;
  const panel=heading.closest('.card,.panel,.ops-panel,.chart-card,.widget')||heading.parentElement;
  if(!panel)return;

  // Remove the explanatory caption only in this status-mix panel.
  panel.querySelectorAll('*').forEach(n=>{
    if(n.children.length)return;
    const t=(n.textContent||'').trim();
    if(/^open work orders by current lifecycle status$/i.test(t)) n.remove();
  });

  // Change only the donut aggregate label, not the Open legend row.
  const centers=[...panel.querySelectorAll('[class*="center"],[class*="middle"],.donut-label,.donut-value,[class*="total"]')];
  centers.forEach(c=>{
    [...c.querySelectorAll('*'),c].forEach(n=>{
      if(n.children.length)return;
      const t=(n.textContent||'').trim();
      if(/^open$/i.test(t)) n.textContent='Active';
      else if(/^88\s+open$/i.test(t)) n.textContent='88 Active';
    });
  });

  // Fallback: if 88 and Open are sibling leaves in the donut center, rename only the sibling Open.
  const leaves=[...panel.querySelectorAll('*')].filter(n=>!n.children.length);
  const eightyEight=leaves.find(n=>(n.textContent||'').trim()==='88');
  if(eightyEight?.parentElement){
    [...eightyEight.parentElement.querySelectorAll('*')].forEach(n=>{
      if(!n.children.length && /^open$/i.test((n.textContent||'').trim())) n.textContent='Active';
    });
  }
}
const host=document.getElementById('view-workorderintelligence');
if(host)new MutationObserver(()=>requestAnimationFrame(fix)).observe(host,{childList:true,subtree:true,characterData:true});
document.addEventListener('click',()=>setTimeout(fix,0),true);
document.addEventListener('aip:data-source-changed',()=>requestAnimationFrame(fix));
document.addEventListener('apm:datasource-refreshed',()=>requestAnimationFrame(fix));
fix();
})();
