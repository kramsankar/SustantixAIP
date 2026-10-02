(function(){
'use strict';let pending=false;const seen=new WeakSet();
const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
function add(e,c){if(!e.classList.contains(c))e.classList.add(c)}
function refresh(){pending=false;const top=document.getElementById('topbar');if(top)document.documentElement.style.setProperty('--r896-top',top.getBoundingClientRect().bottom+'px');
for(const root of [...document.querySelectorAll('.view.active,#aipHomeOverlay,[role=dialog],dialog[open]')].filter(visible)){
 if(root.classList.contains('view')){
  let head=root.querySelector(':scope > .r896-heading');
  const original=[...root.querySelectorAll('.aip520-parent-heading,h1,.view-head h2,.page-head h2')].find(e=>!e.classList.contains('r896-heading'));
  const nav=document.querySelector('#sidebar [data-view="'+root.id.replace('view-','')+'"]');
  const title=original?.textContent.trim()||nav?.textContent.trim();
  if(title){if(!head){head=document.createElement('h1');head.className='r896-heading';root.prepend(head)}if(head.textContent!==title)head.textContent=title;if(original){add(original,'r896-original-heading');for(let p=original.parentElement;p&&p!==root;p=p.parentElement)add(p,'r896-heading-path')}}
 }
 for(const e of root.querySelectorAll('div,section,article,header,form,nav,table')){
  if(seen.has(e)||!visible(e)||e.closest('.tam895-card,svg,canvas'))continue;seen.add(e);
  if(e.tagName==='TABLE'){add(e,'r896-table');e.tabIndex=0;continue}
  const s=getComputedStyle(e);if(s.display==='grid')add(e,'r896-grid');else if(s.display==='flex'&&s.flexDirection==='row')add(e,'r896-flex');
 }
 if(root.id==='view-portfoliointelligence')for(const card of root.querySelectorAll('.tam895-card')){const row=card.parentElement;if([...row.children].filter(e=>e.classList.contains('tam895-card')).length===8){add(row,'r896-portfolio-kpis');row.style.setProperty('grid-template-columns',innerWidth<=600?'repeat(2,minmax(0,1fr))':'repeat(4,minmax(0,1fr))','important')}}
}
window.AIPHeadingSpacing904?.refresh();
window.AIPTableDesign909?.refresh();
window.AIPPortfolioScroll906?.refresh();
}
function queue(){if(pending)return;pending=true;if(document.body.classList.contains('aip-home-open'))requestAnimationFrame(refresh);else queueMicrotask(refresh)}
function start(){new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&!n.matches('.r896-heading,.a891-info,.tam895-bars,.tam895-number,.tam895-unit,i')&&!n.closest('.tam895-card,svg,canvas'))))queue()}).observe(document.body,{childList:true,subtree:true});queue()}
document.addEventListener('click',queue);window.addEventListener('resize',queue);window.addEventListener('aip:runtime-ready',queue);
window.addEventListener('click',e=>{if(e.target.closest?.('#main,#sidebar'))queue()},true);
window.AIPResponsive896={refresh};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
