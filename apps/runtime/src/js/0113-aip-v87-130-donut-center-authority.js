
(function(){
'use strict';
function fix(){
 const host=document.getElementById('view-workorderintelligence'); if(!host)return;
 const heading=[...host.querySelectorAll('h2,h3,h4,.section-title,.card-title')]
   .find(n=>/work order status mix/i.test(n.textContent||''));
 if(!heading)return;
 const panel=heading.closest('.card,.panel,.ops-panel,.chart-card,.widget')||heading.parentElement;
 if(!panel)return;

 // Prefer explicit center/middle/total elements inside this specific chart.
 const centers=[...panel.querySelectorAll('[class*="center"],[class*="middle"],[class*="total"],.donut-label,.donut-value')];
 centers.forEach(c=>{
   [...c.querySelectorAll('*'),c].forEach(n=>{
     if(n.children.length)return;
     const t=(n.textContent||'').trim();
     if(/^open$/i.test(t)) n.textContent='Active';
     else if(/^88\s+open$/i.test(t)) n.textContent='88 Active';
     else if(/^open\s+88$/i.test(t)) n.textContent='88 Active';
   });
 });

 // If center is built from sibling number + label, locate the 88 leaf and change only its nearby Open label.
 const leaves=[...panel.querySelectorAll('*')].filter(n=>!n.children.length);
 const eightyEight=leaves.find(n=>(n.textContent||'').trim()==='88');
 if(eightyEight){
   const parent=eightyEight.parentElement;
   if(parent){
     [...parent.querySelectorAll('*')].forEach(n=>{
       if(!n.children.length && /^open$/i.test((n.textContent||'').trim())) n.textContent='Active';
     });
   }
 }
}
const h=document.getElementById('view-workorderintelligence');
if(h)new MutationObserver(()=>requestAnimationFrame(fix)).observe(h,{childList:true,subtree:true,characterData:true});
document.addEventListener('click',()=>setTimeout(fix,0),true);
document.addEventListener('aip:data-source-changed',()=>requestAnimationFrame(fix));
document.addEventListener('apm:datasource-refreshed',()=>requestAnimationFrame(fix));
fix();
})();
