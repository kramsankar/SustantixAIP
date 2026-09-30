(function(){
const set=(e,k,v)=>{if(e.style.getPropertyValue(k)!==v||e.style.getPropertyPriority(k)!=='important')e.style.setProperty(k,v,'important')};
function refresh(){
 for(const table of document.querySelectorAll('table')){
  if(!table.getClientRects().length)continue;
  for(const e of [table,...table.querySelectorAll('thead,thead tr,th')])set(e,'border-radius','0px');
  // Remove clipping at the table viewport, while preserving the surrounding card.
  for(let e=table.parentElement,i=0;e&&i<3;i++,e=e.parentElement){
   if(e.querySelector('h1,h2,h3,h4,.panel-title')||e.matches('.view,#main,body'))break;
   if(!/scroll|table.?wrap|viewport/i.test(e.className))break;
   set(e,'border-top-left-radius','0px');set(e,'border-top-right-radius','0px');
  }
  for(const cell of table.querySelectorAll('th,td')){
   const header=cell.tagName==='TH'||!!cell.closest('thead');
   set(cell,'text-align','left');set(cell,'vertical-align','middle');set(cell,'padding-left','8px');set(cell,'padding-right','8px');set(cell,'font-family','Arial, sans-serif');set(cell,'font-size',header?'9.5px':'10.5px');set(cell,'line-height','1.35');
   if(header){set(cell,'background','#174f78');set(cell,'color','#ffffff');set(cell,'border-radius','0px');set(cell,'font-weight','700');}
   for(const child of cell.querySelectorAll('span,a,button,b,strong,small')){
    if(child.closest('svg')||child.matches('[aria-hidden="true"],[class*="icon"],[class*="drill"]'))continue;
    set(child,'font-size','inherit');set(child,'font-family','inherit');set(child,'line-height','inherit');
    if(header)set(child,'color','inherit');
   }
  }
 }
}
window.AIPTableDesign909={refresh};
})();
