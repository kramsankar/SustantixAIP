
(function(){
'use strict';
if(window.__AIP_V87121_OVERVIEW_KPI_AUTHORITY__)return;
window.__AIP_V87121_OVERVIEW_KPI_AUTHORITY__=true;

const TARGETS=[
  ['view-financialimpact','renderFinancialImpact'],
  ['view-scenariosimulator','renderScenarioSimulator']
];

function textOf(el,selectors){
  for(const s of selectors){
    const n=el.querySelector(s);
    if(n&&String(n.textContent||'').trim())return String(n.textContent||'').trim();
  }
  return '';
}
function collectExistingKpis(host){
  const selectors=[
    '.ovd-kpi',
    '.rigour-kpi',
    '.ops-kpi',
    '.aip-kpi-master',
    '.financial-kpi',
    '.executive-summary-metric'
  ];
  const seen=new Set(),cards=[];
  selectors.forEach(sel=>host.querySelectorAll(sel).forEach(el=>{
    if(seen.has(el)||el.closest('.ov121-kpis'))return;
    seen.add(el);
    const label=textOf(el,['.ovd-kpi-label','.kpi-label','.lbl','.label','span']);
    const value=textOf(el,['.ovd-kpi-value','.kpi-value','.val','.value','b']);
    if(label&&value)cards.push([label,value]);
  }));
  return cards;
}
function standardHtml(items){
  return `<div class="ov121-kpis" style="--ov121-cols:${Math.max(1,Math.min(6,items.length))}">
    ${items.map((x,i)=>`<div class="ov121-kpi">
      <div class="ov121-label">${String(x[0]??'')}</div>
      <div class="ov121-value">${String(x[1]??'')}</div>
      <div class="ov121-bars" aria-hidden="true">
        <i style="height:${6+(i%3)}px"></i>
        <i style="height:${11+(i%2)}px"></i>
        <i style="height:${8+(i%4)}px"></i>
        <i style="height:${16-(i%3)}px"></i>
        <i style="height:${12+(i%3)}px"></i>
      </div>
    </div>`).join('')}
  </div>`;
}
function normalize(viewId){
  const host=document.getElementById(viewId);
  if(!host)return;
  const existing=host.querySelector('.ov121-kpis');
  let items=collectExistingKpis(host);

  if(viewId==='view-workorderintelligence'){
    const labelMap={
      'open work orders':'Active',
      'open work order':'Active',
      'critical priority':'Critical Priority',
      'critical priority work orders':'Critical Priority',
      'overdue actions':'Overdue',
      'overdue work orders':'Overdue',
      'ready to schedule':'Ready to Schedule',
      'sla at risk':'SLA at Risk',
      'erp/eam pending':'ERP/EAM Pending'
    };
    items=items.map(([label,value])=>{
      const key=String(label||'').trim().toLowerCase();
      let cleanLabel=labelMap[key]||String(label||'');
      cleanLabel=cleanLabel.replace(new RegExp('work orders?','ig'),'').replace(/\s+/g,' ').trim();
      const raw=String(value||'').trim();
      const m=raw.match(/-?\d[\d,]*(?:\.\d+)?/);
      const numeric=m?m[0]:raw.replace(new RegExp('WOs?|Work Orders?','ig'),'').trim();
      return [cleanLabel,numeric];
    });
  }

  if(!items.length){
    /* If already normalized and no legacy cards remain, keep it. */
    return;
  }

  /* Remove every competing KPI container produced by older renderers. */
  host.querySelectorAll(
    '.ovd-kpis,.rigour-grid,.ops-kpis,.financial-kpis,.executive-summary-grid,.portfolio-kpis'
  ).forEach(el=>el.remove());

  if(existing)existing.remove();

  const wrap=document.createElement('div');
  wrap.innerHTML=standardHtml(items);
  const row=wrap.firstElementChild;

  /* Place directly after the view header/title region. */
  const head=host.querySelector('.view-head,.rigour-head,.page-head,.header-row');
  if(head&&head.parentNode===host)head.insertAdjacentElement('afterend',row);
  else host.insertBefore(row,host.firstChild);
}
function wrapRenderer(viewId,fnName){
  const current=window[fnName];
  if(typeof current!=='function'||current.__ov121Wrapped)return;
  function wrapped(){
    const out=current.apply(this,arguments);
    normalize(viewId);
    requestAnimationFrame(()=>normalize(viewId));
    return out;
  }
  wrapped.__ov121Wrapped=true;
  wrapped.__ov121Original=current;
  window[fnName]=wrapped;
  try{eval(`${fnName}=window[fnName]`)}catch(_){}
}
function install(){
  TARGETS.forEach(([view,fn])=>wrapRenderer(view,fn));
  TARGETS.forEach(([view])=>normalize(view));
}
install();

/* Re-wrap if another late module replaces a renderer during source switching. */
document.addEventListener('aip:data-source-changed',()=>{
  requestAnimationFrame(()=>requestAnimationFrame(install));
});
document.addEventListener('apm:datasource-refreshed',()=>{
  requestAnimationFrame(()=>requestAnimationFrame(install));
});

/* Navigation can call a renderer through a lexical/global alias; normalize after
   every click into these Overview drilldowns as a final lifecycle guard. */
document.addEventListener('click',()=>{
  setTimeout(()=>{
    const active=document.querySelector('.view.active[id]');
    if(active&&TARGETS.some(x=>x[0]===active.id))normalize(active.id);
  },0);
},true);
})();
