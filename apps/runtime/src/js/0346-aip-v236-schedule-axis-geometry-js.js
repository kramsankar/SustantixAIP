
(function(){
'use strict';
const DAY=86400000;
function pct(v,start,days){return Math.max(0,Math.min(100,100*((+v)-(+start))/(DAY*days)))}
function cell(startDate,endDate,totalStart,totalDays,html){
 const l=pct(startDate,totalStart,totalDays),r=pct(endDate,totalStart,totalDays),w=Math.max(0,r-l);
 return `<span class="po-sched236-cell" style="left:${l.toFixed(6)}%;width:${w.toFixed(6)}%">${html}</span>`;
}
window.planScheduleAxisMeta=function(start,rawDays,scale){
 const days=Math.max(1,Number(rawDays||0)+1);
 const horizonEnd=new Date(+start+days*DAY); // exclusive boundary after final displayed day
 const ticks=[],boundaries=[new Date(start)];
 let cellPx=100;
 const add=(s,e,html)=>{if(+e<=+s)return;ticks.push(cell(s,e,start,days,html));boundaries.push(new Date(e));};
 if(scale==='daily'){
   cellPx=52;
   for(let i=0;i<days;i++){
     const s=new Date(+start+i*DAY),e=new Date(Math.min(+horizonEnd,+s+DAY));
     add(s,e,`<b>${String(s.getDate()).padStart(2,'0')} ${s.toLocaleDateString('en-GB',{month:'short'})}</b><small>${s.getFullYear()}</small>`);
   }
 }else if(scale==='weekly'){
   cellPx=16; // per day; exact seven-day cells except clipped final week
   let i=0,s=new Date(start);
   while(s<horizonEnd){
     const e=new Date(Math.min(+horizonEnd,+s+7*DAY)),last=new Date(+e-DAY);
     add(s,e,`<b>Week ${i+1}</b><small>${String(s.getDate()).padStart(2,'0')} ${s.toLocaleDateString('en-GB',{month:'short'})} – ${String(last.getDate()).padStart(2,'0')} ${last.toLocaleDateString('en-GB',{month:'short'})} ${last.getFullYear()}</small>`);
     s=e;i++;
   }
 }else if(scale==='monthly'){
   cellPx=7; // per day; month widths are proportional to actual visible days
   let s=new Date(start);
   while(s<horizonEnd){
     const monthBoundary=new Date(s.getFullYear(),s.getMonth()+1,1);
     const e=new Date(Math.min(+horizonEnd,+monthBoundary));
     add(s,e,`<b>${s.toLocaleDateString('en-GB',{month:'long'})}</b><small>${s.getFullYear()}</small>`);
     s=e;
   }
 }else if(scale==='yearly'){
   cellPx=2.4;
   let s=new Date(start);
   while(s<horizonEnd){
     const yearBoundary=new Date(s.getFullYear()+1,0,1),e=new Date(Math.min(+horizonEnd,+yearBoundary));
     add(s,e,`<b>${s.getFullYear()}</b>`);s=e;
   }
 }else{
   return window.planScheduleAxisMeta(start,rawDays,'weekly');
 }
 const unique=[];const seen=new Set();
 boundaries.forEach(d=>{const p=pct(d,start,days);const k=p.toFixed(6);if(p>0&&p<100&&!seen.has(k)){seen.add(k);unique.push(p)}});
 window.AIP_SCHED236_GRIDLINES=unique;
 // Timeline width is derived from visible calendar days. Header cells and Gantt rows use the same percentages.
 const timelineWidth=Math.max(900,Math.round(days*cellPx));
 return {ticks,unitCount:days,cellPx,gridStepPct:0,days,timelineWidth,boundaries:unique};
};
const oldSchedule=window.schedule;
// schedule() is lexical in this build, so replace its width calculation by wrapping the function source below at load time is not possible.
// Instead meta.unitCount * meta.cellPx deliberately equals days * per-day pixels, preserving its existing calculation exactly.
window.AIP_V236_SCHEDULE_GEOMETRY=true;
})();
