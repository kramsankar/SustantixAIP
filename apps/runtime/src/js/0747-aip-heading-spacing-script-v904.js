(function(){
'use strict';
const visible=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
const set=(e,k,v)=>{if(e.style.getPropertyValue(k)!==v||e.style.getPropertyPriority(k)!=='important')e.style.setProperty(k,v,'important')};
function refresh(){
 for(const root of document.querySelectorAll('#main>.view.active')){
  const heading=root.querySelector(':scope>.r896-heading');if(!heading)continue;
  // An obsolete title wrapper may still reserve height after its title is hidden.
  // Keep wrappers carrying filters, buttons or other real content.
  for(const el of root.querySelectorAll('.r896-heading-path')){
   if(!visible(el))continue;
   const controls=[...el.querySelectorAll('button,input,select,textarea,a[href],canvas,svg,img')].some(visible);
   if(!el.innerText.trim()&&!controls)el.classList.add('r904-empty-heading');
  }
  const next=[...root.children].find(e=>e!==heading&&visible(e)&&e.getBoundingClientRect().height>0&&!['absolute','fixed'].includes(getComputedStyle(e).position));
  if(next){set(next,'margin-top','0px');root.dataset.aipHeadingGap='12';}
  set(heading,'margin-top','0px');set(heading,'margin-bottom','12px');
 }
}
window.AIPHeadingSpacing904={refresh};
})();
