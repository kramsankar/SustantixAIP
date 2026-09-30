
(function(){
'use strict';
if(window.__AIP_CONTEXT_SCROLL__) return;
window.__AIP_CONTEXT_SCROLL__=true;
let active=null,raf=0,scanTimer=0;
const nav=document.createElement('div');
nav.id='aipHNav';nav.setAttribute('role','toolbar');nav.setAttribute('aria-label','Horizontal navigation');
nav.innerHTML='<button type="button" data-dir="-1" aria-label="Scroll current pane left" title="Move left"><span class="aip-hnav-arrow">&#8592;</span><span>LEFT</span></button><button type="button" data-dir="1" aria-label="Scroll current pane right" title="Move right"><span>RIGHT</span><span class="aip-hnav-arrow">&#8594;</span></button>';
const topbar=document.getElementById('topbar');
const topRight=topbar?.querySelector('.top-right');
if(topbar){topbar.insertBefore(nav,topRight||null);}else{document.body.appendChild(nav);}
const leftBtn=nav.querySelector('[data-dir="-1"]'),rightBtn=nav.querySelector('[data-dir="1"]');
function isEditable(t){return !!t?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="combobox"],[role="slider"]');}
function isVisible(el){
 if(!el||!el.isConnected)return false;
 const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
 return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>40&&r.height>24&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;
}
function isCandidate(el){
 if(!el||el===document.body||el===document.documentElement||el.id==='main'||el.id==='sidebar')return false;
 const cs=getComputedStyle(el),ox=cs.overflowX;
 if(!(ox==='auto'||ox==='scroll'))return false;
 if(el.scrollWidth<=el.clientWidth+3)return false;
 if(!isVisible(el))return false;
 return !!el.querySelector('table,.ops-board-grid,.scenario-table,.rigour-table,[role="grid"],[class*="table"],[class*="grid"]');
}
function nearestCandidate(start){let el=start;while(el&&el!==document.body){if(isCandidate(el))return el;el=el.parentElement;}return null;}
function visibleCandidates(){
 const view=document.querySelector('#main>.view.active,.view.active')||document.getElementById('main');
 if(!view)return [];
 return [...view.querySelectorAll('*')].filter(isCandidate);
}
function bestCandidate(){
 const list=visibleCandidates();
 if(!list.length)return null;
 return list.sort((a,b)=>{
   const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
   const aVisible=Math.max(0,Math.min(ar.bottom,innerHeight)-Math.max(ar.top,0));
   const bVisible=Math.max(0,Math.min(br.bottom,innerHeight)-Math.max(br.top,0));
   const aScore=aVisible*Math.min(ar.width,innerWidth)+(a.scrollWidth-a.clientWidth)*20;
   const bScore=bVisible*Math.min(br.width,innerWidth)+(b.scrollWidth-b.clientWidth)*20;
   return bScore-aScore;
 })[0];
}
function updateButtons(){
 if(!active){leftBtn.disabled=true;rightBtn.disabled=true;return;}
 leftBtn.disabled=active.scrollLeft<=1;
 rightBtn.disabled=active.scrollLeft+active.clientWidth>=active.scrollWidth-2;
}
function setActive(el,showOutline){
 if(active===el){updateButtons();return;}
 if(active)active.classList.remove('aip-hnav-focus');
 active=el||null;
 if(active){if(showOutline)active.classList.add('aip-hnav-focus');nav.classList.add('visible');updateButtons();}
 else{nav.classList.remove('visible');updateButtons();}
}
function autoDetect(){
 cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
   if(active&&!isCandidate(active))active=null;
   const candidate=active||bestCandidate();
   setActive(candidate,false);
 });
}
function scheduleDetect(delay){clearTimeout(scanTimer);scanTimer=setTimeout(autoDetect,delay||40);}
function detectionBurst(){
  [0,60,140,280,520,900].forEach(ms=>setTimeout(autoDetect,ms));
}
function step(dir){
 if(!active){autoDetect();return;}
 const amount=Math.max(180,Math.min(440,Math.round(active.clientWidth*.55)));
 active.scrollBy({left:dir*amount,behavior:'smooth'});
 setTimeout(updateButtons,280);
}
nav.addEventListener('click',e=>{const b=e.target.closest('button[data-dir]');if(b&&!b.disabled)step(Number(b.dataset.dir));});
document.addEventListener('pointerdown',e=>{
 if(nav.contains(e.target))return;
 const c=nearestCandidate(e.target);
 if(c)setActive(c,true);
},true);
document.addEventListener('keydown',e=>{
 if(isEditable(e.target)||e.altKey||e.ctrlKey||e.metaKey)return;
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
   const c=nearestCandidate(e.target);if(c)setActive(c,false);else if(!active)autoDetect();
   if(active){e.preventDefault();e.stopPropagation();step(e.key==='ArrowLeft'?-1:1);}
 }
},true);
document.addEventListener('scroll',e=>{
 if(e.target===active)updateButtons();
 if(e.target===document||e.target===document.documentElement||e.target===document.body)scheduleDetect(20);
},true);
document.addEventListener('click',e=>{if(e.target.closest('#sidebar .nav-item,[data-view],.nav-item'))detectionBurst();},true);
window.addEventListener('resize',()=>detectionBurst(),{passive:true});
const mainRoot=document.getElementById('main')||document.body;
new MutationObserver(()=>scheduleDetect(50)).observe(mainRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
if(window.ResizeObserver){
  const ro=new ResizeObserver(()=>scheduleDetect(30));
  ro.observe(mainRoot);
}
document.addEventListener('aip:data-rendered',detectionBurst);
document.addEventListener('apm:datasource-refreshed',detectionBurst);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',detectionBurst);else detectionBurst();
})();
