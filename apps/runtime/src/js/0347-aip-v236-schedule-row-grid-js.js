
/* Authoritative row renderer: draws the exact same boundaries as the calendar cells. */
(function(){
'use strict';
window.scheduleTimelineRow=function(r,start,days,gridStepPct){
 const parse=x=>x?new Date(String(x).replace(' ','T')):null,pct=d=>100*(d-start)/86400000/days;
 const span=(s,e,cls,top,label)=>{
  if(!s||!e||!Number.isFinite(+s)||!Number.isFinite(+e))return '';
  const l=pct(s),rr=pct(e);if(rr<0||l>100)return '';
  const left=Math.max(0,l),right=Math.min(100,rr),w=Math.max(.12,right-left);
  const hrs=Math.max(0,(e-s)/3600000),dlabel=scheduleElapsedLabel(s,e,hrs);
  const calc=`Finish − Start = ${Number.isInteger(hrs)?hrs:hrs.toFixed(1)} h = ${dlabel}`;
  return `<button class="po-sched198-gbar ${cls}" style="left:${left}%;width:${w}%;top:${top}px" onclick="event.stopPropagation();planScheduleSelect('${r.Intervention_ID}')" onmouseenter="planScheduleTipShow(event,'${r.Intervention_ID}','${esc(label)}','${cls}','${esc(planFmtDateTime?planFmtDateTime(s):s.toLocaleString())}','${esc(planFmtDateTime?planFmtDateTime(e):e.toLocaleString())}','${esc(calc)}')" onmousemove="planScheduleTipMove(event)" onmouseleave="planScheduleTipHide()" aria-label="${esc(label)} ${esc(r.Intervention_ID)}"></button>`;
 };
 const planStart=parse(r.schedule.Planned_Start||r.Planned_Start),planEnd=parse(r.schedule.Planned_End||r.schedule.Planned_Finish||r.Planned_Finish)||new Date(+planStart+n(r.Duration_Hours)*3600000);
 const optStart=parse(r.schedule.AIP_Optimized_Start||r.AIP_Optimized_Start),optEnd=parse(r.schedule.AIP_Optimized_Finish||r.AIP_Optimized_Finish);
 const actualStart=parse(r.schedule.Actual_Start||r.Actual_Start),actualEnd=parse(r.schedule.Actual_Completion||r.Actual_Completion),req=parse(r.Required_By||r.Required_Completion_By);
 const selected=U.selected===r.Intervention_ID?' selected':'';
 const grid=(window.AIP_SCHED236_GRIDLINES||[]).map(p=>`<i class="po-sched236-gridline" style="left:${Number(p).toFixed(6)}%"></i>`).join('');
 const plannedBar=span(planStart,planEnd,'current',18,'Baseline');
 const optimizedBar=optStart&&optEnd?span(optStart,optEnd,'optimized',42,'Schedule Alternative'):'';
 const actualBar=actualStart&&actualEnd?span(actualStart,actualEnd,'actual',66,'Actual'):'';
 const effectiveFinish=actualEnd||parse(r.schedule.Approved_Finish||r.Approved_Finish)||optEnd||planEnd,gapDays=req&&effectiveFinish?Math.ceil((req-effectiveFinish)/86400000):0,gapClass=gapDays<0?'late':gapDays===0?'due':'ahead';
 const due=req&&pct(req)>=0&&pct(req)<=100?`<i class="po-sched176-due ${gapClass}" style="left:${pct(req)}%" onmouseenter="planScheduleTipShow(event,'${r.Intervention_ID}','Required Completion By','due','${esc(planFmtDateTime?planFmtDateTime(req):req.toLocaleString())}','','Deadline milestone')" onmousemove="planScheduleTipMove(event)" onmouseleave="planScheduleTipHide()">◆</i>`:'';
 return `<div class="po-sched176-timeline po-sched184-timerow${selected}" style="--po-grid-step:0%" onclick="planScheduleSelect('${r.Intervention_ID}')">${grid}${plannedBar}${optimizedBar}${actualBar}${due}</div>`;
};
window.AIP_V236_AUDIT={release:'v236',baseline:'v235',excelBusinessDataChanged:false,changes:[
 'Daily, Weekly and Monthly time-scale labels are centered',
 'All calendar header cells use a consistent very-light-gray fill',
 'Header cell left/right edges are calculated from exact visible date boundaries',
 'Weekly cells use exact seven-day spans with a clipped final week',
 'Monthly cells use actual visible calendar-day spans, including partial first/last months',
 'Gantt row gridlines are generated from those same date boundaries, eliminating progressive header/grid drift'
]};
})();
