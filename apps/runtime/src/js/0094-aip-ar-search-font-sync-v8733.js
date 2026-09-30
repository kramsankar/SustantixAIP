
(function(){
'use strict';
function syncSearchFont(){
  const view=document.getElementById('view-assetrelationships');
  if(!view)return;
  const reference=view.querySelector('#arPathTarget') || view.querySelector('#arEvidence');
  const search=view.querySelector('#arGraphSearch');
  if(!reference||!search)return;
  const cs=getComputedStyle(reference);
  search.style.setProperty('font-family',cs.fontFamily,'important');
  search.style.setProperty('font-size',cs.fontSize,'important');
  search.style.setProperty('font-weight',cs.fontWeight,'important');
  search.style.setProperty('font-style',cs.fontStyle,'important');
  search.style.setProperty('line-height',cs.lineHeight,'important');
  search.style.setProperty('letter-spacing',cs.letterSpacing,'important');
  search.style.setProperty('text-transform','none','important');
  search.style.setProperty('color',cs.color,'important');
}
function run(){syncSearchFont();requestAnimationFrame(syncSearchFont)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
document.addEventListener('click',e=>{
 if(e.target?.closest?.('#sidebar .nav-item[data-view="assetrelationships"],#view-assetrelationships'))setTimeout(run,0);
},true);
document.addEventListener('aip:data-rendered',run);
document.addEventListener('apm:datasource-refreshed',run);
})();
