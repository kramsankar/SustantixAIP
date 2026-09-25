
(function(){
'use strict';
if(window.__AIP_V158_TARGET_HIGHLIGHT)return;
window.__AIP_V158_TARGET_HIGHLIGHT=true;

function planRoot(){return document.getElementById('view-resourceplanning');}
function clearV158(root){
  if(!root)return;
  root.querySelectorAll('.aip-v158-plan-target').forEach(el=>el.classList.remove('aip-v158-plan-target'));
  root.querySelectorAll('.aip-v158-context-banner').forEach(el=>el.remove());
}
window.planV158ClearHighlight=function(){
  clearV158(planRoot());
  try{window.planV121ClearTarget?.();}catch(_){}
};

function ensureBanner(root,label){
  if(!root)return;
  if(root.querySelector('.aip-v121-context-banner,.aip-v158-context-banner'))return;
  const b=document.createElement('div');
  b.className='aip-v121-context-banner aip-v158-context-banner';
  b.innerHTML='<b>'+String(label||'Planning context')+'</b><button type="button" onclick="planV158ClearHighlight()">× Clear highlight</button>';
  const tabbar=root.querySelector('.po-tabs');
  if(tabbar)tabbar.insertAdjacentElement('afterend',b);
  else {
    const head=root.querySelector('.view-head');
    if(head)head.insertAdjacentElement('afterend',b); else root.prepend(b);
  }
}

function locate(id,kind){
  const root=planRoot(); if(!root)return null;
  const labels={
    crew:'Crew & skills',
    material:'Materials & spares',
    toolvehicle:'Tools / tackles & vehicle',
    accessoutage:'Execution prerequisites'
  };
  if(labels[kind]){
    const h=[...root.querySelectorAll('h3')].find(x=>(x.textContent||'').trim()===labels[kind]);
    return h?.closest('.po-card')||null;
  }
  const candidates=[...root.querySelectorAll('tr,.po-gantt-row,.po-gantt104-row,.po-card')];
  return candidates.find(x=>(x.textContent||'').includes(id))||null;
}

function ensureHighlight(id,kind,attempt){
  const root=planRoot(); if(!root)return;
  const target=locate(id,kind);
  if(target){
    root.querySelectorAll('.aip-v158-plan-target').forEach(el=>el.classList.remove('aip-v158-plan-target'));
    target.classList.add('aip-v158-plan-target');
    const labels={
      crew:'Crew & skills',
      material:'Materials & spares',
      toolvehicle:'Tools / tackles & vehicle',
      accessoutage:'Execution prerequisites',
      schedule:'Intervention Schedule',
      governance:'Optimize & Govern'
    };
    ensureBanner(root,'Planning context · '+id+' · '+(labels[kind]||'Dependency'));
    try{target.scrollIntoView({block:'center',behavior:'auto'});}catch(_){}
    return;
  }
  if(attempt<5)setTimeout(()=>ensureHighlight(id,kind,attempt+1),[100,160,240,360,520][attempt]||520);
}

function install(){
  const original=window.planOpenDependency;
  if(typeof original!=='function'||original.__v158reliable)return;
  const wrapped=function(id,kind){
    const result=original.apply(this,arguments);
    [90,190,340,560,850].forEach((ms,i)=>setTimeout(()=>ensureHighlight(id,kind,i),ms));
    return result;
  };
  wrapped.__v158reliable=true;
  wrapped.__v158original=original;
  window.planOpenDependency=wrapped;
}
install();
setTimeout(install,350);
setTimeout(install,1100);

window.AIP_V158_AUDIT={
 release:'v1.58',baseline:'v1.57',excelBusinessDataChanged:false,
 changes:[
  'Reduced Selected Intervention Dependency & Readiness card height while retaining full status words',
  'Forced drill navigation cue to the left inside every dependency card',
  'Added bounded target-location retries so Crew, Material, Tool/Vehicle, Access/Outage, Schedule and Governance highlights appear reliably after navigation',
  'Ensured a visible Clear highlight control is present on the destination page without using a page-wide MutationObserver'
 ]
};
})();
