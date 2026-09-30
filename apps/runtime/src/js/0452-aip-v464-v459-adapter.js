
'use strict';
(function(root,factory){ if(typeof module==='object'&&module.exports) module.exports=factory(); else root.AIPV459Adapter=factory(); })(typeof self!=='undefined'?self:this,function(){
  const VERSION='1.0.0-step3';
  const SOURCE_VERSION='AIP v459';
  const SOURCE_ANCHOR=new Date('2026-09-07T08:00:00');
  const DAY=86400000;
  const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const yes=v=>/^(yes|true|1|required)$/i.test(String(v??'').trim());
  const normId=id=>String(id||'').replace(/^INT-0+(\d+)$/,(_,n)=>`INT-${String(Number(n)).padStart(3,'0')}`);
  const priorityWeight=p=>({Critical:5,High:4,Medium:3,Low:2}[String(p)]||1);
  const clone=o=>JSON.parse(JSON.stringify(o));
  const uniq=a=>[...new Set(a.filter(v=>Number.isInteger(v)&&v>=0))].sort((a,b)=>a-b);
  const parseDate=v=>{
    if(v===null||v===undefined||v==='') return null;
    const s=String(v).trim(); if(!s||/^(not required|n\/a|—)$/i.test(s)) return null;
    let m=s.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if(m) return new Date(+m[3],+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0),0,0);
    m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if(m) return new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),0,0);
    const d=new Date(s.replace(' ','T')); return Number.isFinite(+d)?d:null;
  };
  const fmt=d=>{const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`};
  const addMonths=(d,m)=>{const x=new Date(d),day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+m);x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate()));return x};
  const addHours=(d,h)=>new Date(+d+h*3600000);
  const ceilSlot=(d,start,slotHours)=>Math.max(0,Math.ceil((+d-+start)/(slotHours*3600000)-1e-9));
  const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const overlap=(a1,a2,b1,b2)=>+a1<+b2 && +b1<+a2;

  const ROLL_FIELDS={
    'PLAN_Interventions':['Required_By','Planned_Start','Planned_Finish','Actual_Start','Actual_Completion'],
    'PLAN_Schedule':['Planned_Start','Planned_End','Planned_Finish','AIP_Optimized_Start','AIP_Optimized_Finish','Approved_Start','Approved_Finish','Actual_Start','Actual_Completion'],
    'PLAN_Calendar':['Start','End'],
    'PLAN_Resource_Calendar':['Start','End'],
    'PLAN_Weather_Forecast':['Forecast_Time','Valid_From','Valid_To'],
    'PLAN_Readiness':['Material_Earliest_Receipt'],
    'PLAN_Tool_Master':['Calibration_Expiry'],
    'PLAN_Vehicle_Master':['Last_Service_Date'],
    'PNO_Interventions':['Required_By','Planned_Start','Planned_Finish','Actual_Start','Actual_Completion'],
    'PNO_Fleet_Schedule':['Planned_Start','Planned_Finish','Required_By','Actual_Start','Actual_Completion','AIP_Optimized_Start','AIP_Optimized_Finish','Approved_Start','Approved_Finish'],
    'PNO_Technician_Skills':['Valid_To'],
    'PNO_Crew_Rates':['Rate_Effective_From'],
    // v459 governance says planning evidence rolls with runtime. These material timing fields are
    // explicitly rebased here so the optimization adapter does not consume stale source-anchor dates.
    'PNO_Materials':['Need_By','Earliest_Receipt']
  };

  function runtimeNow(v){
    const d=v?new Date(v):new Date();
    if(!Number.isFinite(+d)) return new Date(SOURCE_ANCHOR);
    return new Date(d.getFullYear(),d.getMonth(),d.getDate(),8,0,0,0);
  }
  function rollDeltaDays(asOf){const n=runtimeNow(asOf),a=new Date(SOURCE_ANCHOR);return Math.round((n-a)/DAY)}
  function rollDate(v,asOf){const d=parseDate(v);if(!d)return v;d.setDate(d.getDate()+rollDeltaDays(asOf));return fmt(d)}
  function rollMonth(v,asOf){const d=parseDate(v);if(!d)return v;const n=runtimeNow(asOf),a=SOURCE_ANCHOR,md=(n.getFullYear()-a.getFullYear())*12+n.getMonth()-a.getMonth();return fmt(new Date(d.getFullYear(),d.getMonth()+md,1,0,0,0,0))}

  function extendDailySeries(rows,idKey,startKey,endKey,targetDays=366){
    rows=clone(rows||[]); if(!rows.length)return rows;
    const groups=new Map(); rows.forEach(r=>{const id=String(r[idKey]||'');if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r)});
    const add=[];
    groups.forEach((group,id)=>{
      group.sort((a,b)=>(parseDate(a[startKey])||0)-(parseDate(b[startKey])||0));
      const first=parseDate(group[0]?.[startKey]); if(!first)return;
      const existing=new Set(group.map(r=>Math.round((parseDate(r[startKey])-first)/DAY)));
      const pattern=group.slice(0,Math.min(group.length,28));
      for(let di=0;di<targetDays;di++){
        if(existing.has(di))continue; const p=pattern[di%pattern.length]; const z={...p};
        const ps=parseDate(p[startKey]),pe=parseDate(p[endKey]); const t=new Date(+first+di*DAY);t.setHours(ps.getHours(),ps.getMinutes(),0,0);z[startKey]=fmt(t);
        if(pe){const te=new Date(+first+di*DAY);te.setHours(pe.getHours(),pe.getMinutes(),0,0);z[endKey]=fmt(te)}
        if(z.Resource_Event_ID)z.Resource_Event_ID=`RCE-${id}-${String(di+1).padStart(3,'0')}`;
        if(z.Evidence_ID)z.Evidence_ID=`EVD-WX-${id}-${t.getFullYear()}${String(t.getMonth()+1).padStart(2,'0')}${String(t.getDate()).padStart(2,'0')}`;
        add.push(z);
      }
    });
    return rows.concat(add);
  }

  function prepareRuntime(raw,opts={}){
    const asOf=runtimeNow(opts.asOf); const out=clone(raw||{});
    // Mirror v459 population preparation: workbook already has 69 interventions, while daily resource/weather
    // series are extended to 366 days before the runtime roll.
    out.PLAN_Resource_Calendar=extendDailySeries(out.PLAN_Resource_Calendar||[],'Resource_ID','Start','End',366);
    out.PLAN_Weather_Forecast=extendDailySeries(out.PLAN_Weather_Forecast||[],'Plant_ID','Valid_From','Valid_To',366);
    Object.keys(out).forEach(name=>{
      const rows=out[name]; if(!Array.isArray(rows))return;
      if(name==='PLAN_Data_Window_Config'||name==='PNO_Data_Window_Config'){
        out[name]=rows.map((r,i)=>i?r:{...r,Reference_Date:fmt(asOf),Available_From:fmt(new Date(+asOf-15*DAY)),Available_To:fmt(addMonths(asOf,12)),Lookback_Days:15,Forward_Months:12,Rebase_Mode:'Automatic runtime rebase on application/data-source initialization',Custom_Range_Default_From:fmt(asOf),Custom_Range_Default_To:fmt(new Date(+asOf+30*DAY)),Governance_Status:'Approved'});
        return;
      }
      if(name==='PNO_Resource_Calendar'){out[name]=rows.map(r=>({...r,Month:rollMonth(r.Month,asOf)}));return;}
      const fields=ROLL_FIELDS[name];
      if(!fields&&name!=='PLAN_RCM_Context'&&name!=='PLAN_Operational_Feed')return;
      out[name]=rows.map(r=>{
        const x={...r};
        if(fields)fields.forEach(k=>{if(x[k]!==null&&x[k]!==undefined&&x[k]!=='')x[k]=rollDate(x[k],asOf)});
        if(name==='PLAN_Interventions'||name==='PNO_Interventions')x.Planning_As_Of=fmt(asOf);
        if(name==='PLAN_RCM_Context')x.As_Of=fmt(asOf);
        if(name==='PLAN_Operational_Feed'){const age=Math.max(0,num(x.Freshness_Seconds,0));x.Observed_At=fmt(new Date(+asOf-age*1000));}
        return x;
      });
    });
    out.__runtime={asOf:fmt(asOf),availableFrom:fmt(new Date(+asOf-15*DAY)),availableTo:fmt(addMonths(asOf,12)),sourceAnchor:fmt(SOURCE_ANCHOR),rollDeltaDays:rollDeltaDays(asOf)};
    return out;
  }

  function build(raw,opts={}){
    const data=prepareRuntime(raw,opts); const asOf=runtimeNow(opts.asOf); const slotHours=num(opts.slotHours,8);
    const activeEnd=addMonths(asOf,12); const requestedEnd=opts.horizonEnd?runtimeNow(opts.horizonEnd):new Date(+asOf+num(opts.horizonDays,30)*DAY); const horizonEnd=new Date(Math.min(+activeEnd,+requestedEnd));
    const siteScope=opts.siteId&&opts.siteId!=='All'?String(opts.siteId):null;
    const start=asOf; const horizonSlots=Math.max(1,Math.ceil((+horizonEnd-+start)/(slotHours*3600000))+1);

    const ints=data.PLAN_Interventions||[], schedules=data.PLAN_Schedule||[], reqs=data.PLAN_Requirements||[], mats=data.PNO_Materials||[], techs=data.PNO_Technician_Skills||[], detailCal=data.PLAN_Resource_Calendar||[], monthly=data.PNO_Resource_Calendar||[], calendar=data.PLAN_Calendar||[], tools=data.PLAN_Tool_Master||[], vehicles=data.PLAN_Vehicle_Master||[], costs=data.PNO_Intervention_Cost_Basis||[], rcm=data.PLAN_RCM_Context||[];
    const schBy=new Map(schedules.map(x=>[normId(x.Intervention_ID),x])); const matBy=new Map(mats.map(x=>[normId(x.Intervention_ID),x])); const costBy=new Map(costs.map(x=>[normId(x.Intervention_ID),x])); const rcmBy=new Map(rcm.map(x=>[normId(x.Intervention_ID),x]));
    const reqBy=new Map(); reqs.forEach(r=>{const id=normId(r.Intervention_ID);if(!reqBy.has(id))reqBy.set(id,[]);reqBy.get(id).push(r)});

    const completedIds=new Set(); schedules.forEach(s=>{if(parseDate(s.Actual_Completion)||/completed/i.test(String(s.ERP_Execution_Status||'')))completedIds.add(normId(s.Intervention_ID))});
    const fixedApprovedIds=new Set(); schedules.forEach(s=>{const id=normId(s.Intervention_ID);if(!completedIds.has(id)&&parseDate(s.Approved_Start))fixedApprovedIds.add(id)});
    const scope=ints.filter(x=>{
      const id=normId(x.Intervention_ID), due=parseDate(x.Required_By); if(!due)return false;
      if(siteScope&&String(x.Plant_ID)!==siteScope)return false;
      if(completedIds.has(id))return false;
      if(fixedApprovedIds.has(id))return false; // governed approved future work remains fixed outside decision variables
      return +due>=+start && +due<=+horizonEnd;
    });

    // Technician skill capacity by slot. Detailed person-day records override monthly fallback per person/day;
    // technicians without a detailed row use their crew monthly availability factor.
    const techById=new Map(techs.map(t=>[String(t.Technician_ID),t]));
    const detailByTechDay=new Map();
    detailCal.filter(r=>r.Resource_Type==='Technician').forEach(r=>{const d=parseDate(r.Start);if(!d)return;detailByTechDay.set(`${r.Resource_ID}|${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`,r)});
    const monthlyByCrewMonth=new Map(); monthly.forEach(r=>{const d=parseDate(r.Month);if(d)monthlyByCrewMonth.set(`${r.Crew_ID}|${monthKey(d)}`,r)});
    const skillNames=[...new Set(scope.map(x=>x.Required_Skill).filter(Boolean))]; const resources=[];
    function technicianFactor(t,slotStart){
      const key=`${t.Technician_ID}|${slotStart.getFullYear()}-${slotStart.getMonth()+1}-${slotStart.getDate()}`; const row=detailByTechDay.get(key);
      if(row){ if(String(row.Availability)==='Unavailable')return 0; const available=Math.max(0,num(row.Available_Hours,0)-num(row.Committed_Hours,0)); return Math.max(0,Math.min(1,available/slotHours)); }
      const mr=monthlyByCrewMonth.get(`${t.Crew_ID}|${monthKey(slotStart)}`); if(!mr)return 0;
      const gross=Math.max(1,num(mr.Gross_Capacity_Hours,0)); return Math.max(0,Math.min(1,num(mr.Effective_Available_Hours,num(mr.Available_Hours,0))/gross));
    }
    skillNames.forEach(skill=>{
      const members=techs.filter(t=>String(t.Primary_Skill)===String(skill)); const cap=[];
      for(let q=0;q<horizonSlots;q++){const d=addHours(start,q*slotHours);cap.push(members.reduce((s,t)=>s+technicianFactor(t,d),0));}
      resources.push({id:`SKILL::${skill}`,type:'crew_skill',name:skill,capacity:members.length,capacityBySlot:cap,source:'PNO_Technician_Skills + PLAN_Resource_Calendar + PNO_Resource_Calendar'});
    });

    // Tool capacity by slot, respecting explicit calibration/assignment events and calibration expiry.
    tools.forEach(t=>{
      const cap=[]; const expiry=parseDate(t.Calibration_Expiry);
      for(let q=0;q<horizonSlots;q++){const ss=addHours(start,q*slotHours),ee=addHours(ss,slotHours);let c=/unavailable/i.test(String(t.Availability||''))?0:1;if(expiry&&+ss>+expiry)c=0;for(const ev of calendar){if(ev.Calendar_Level==='Tool'&&String(ev.Reference_ID)===String(t.Tool_ID)&&String(ev.Availability)==='Unavailable'){const a=parseDate(ev.Start),b=parseDate(ev.End);if(a&&b&&overlap(ss,ee,a,b))c=0;}}cap.push(c);} resources.push({id:`TOOL::${t.Tool_ID}`,type:'tool',name:t.Tool_Name||t.Tool_ID,capacity:1,capacityBySlot:cap});
    });

    // Vehicle class capacity by slot. Specific vehicle unavailability subtracts from the class pool.
    const classes=[...new Set(vehicles.map(v=>v.Vehicle_Type).filter(Boolean))];
    classes.forEach(cls=>{const members=vehicles.filter(v=>v.Vehicle_Type===cls&&!/unavailable|out of service/i.test(String(v.Availability||'')+' '+String(v.Maintenance_Status||'')));const cap=[];for(let q=0;q<horizonSlots;q++){const ss=addHours(start,q*slotHours),ee=addHours(ss,slotHours);let c=0;for(const v of members){let ok=1;for(const ev of calendar){if(ev.Calendar_Level==='Vehicle'&&String(ev.Reference_ID)===String(v.Vehicle_ID)&&String(ev.Availability)==='Unavailable'){const a=parseDate(ev.Start),b=parseDate(ev.End);if(a&&b&&overlap(ss,ee,a,b))ok=0;}}c+=ok;}cap.push(c);}resources.push({id:`VEHICLE::${cls}`,type:'vehicle',name:cls,capacity:members.length,capacityBySlot:cap});});

    const resById=new Map(resources.map(r=>[r.id,r]));
    const hardRejected=[],interventions=[];
    const siteMobilization=new Map((data.PNO_Site_Mobilization||[]).map(r=>[String(r.Plant_ID),r]));

    function slotPassesSiteAccess(iv,s,dur){
      const ss=addHours(start,s*slotHours),ee=addHours(ss,dur*slotHours);
      for(const ev of calendar){
        if(ev.Calendar_Level==='Site'&&String(ev.Reference_ID)===String(iv.Plant_ID)){
          const a=parseDate(ev.Start),b=parseDate(ev.End); if(!a||!b||!overlap(ss,ee,a,b))continue;
          if(String(ev.Availability)==='Unavailable'||num(ev.Capacity_Pct,100)<=0)return false;
        }
      }
      return true;
    }
    function slotPassesOutage(iv,s,dur){
      if(!yes(iv.Outage_Required))return true;
      const ss=addHours(start,s*slotHours),ee=addHours(ss,dur*slotHours);
      return calendar.some(ev=>ev.Calendar_Level==='Site'&&String(ev.Reference_ID)===String(iv.Plant_ID)&&/grid outage window/i.test(String(ev.Event_Type||''))&&parseDate(ev.Start)&&parseDate(ev.End)&&+ss>=+parseDate(ev.Start)&&+ee<=+parseDate(ev.End));
    }
    function slotHasResources(reqList,s,dur){
      for(const req of reqList){const r=resById.get(req.resourceId);if(!r)return false;for(let t=s;t<s+dur;t++)if(num((r.capacityBySlot||[])[t],num(r.capacity,0))+1e-9<num(req.quantity,1))return false;}return true;
    }

    for(const x of scope){
      const id=normId(x.Intervention_ID), sch=schBy.get(id)||{}, mat=matBy.get(id)||{}, cost=costBy.get(id)||{}, rc=rcmBy.get(id)||{};
      const due=parseDate(x.Required_By), baseline=parseDate(sch.Approved_Start||sch.AIP_Optimized_Start||sch.Planned_Start||x.Planned_Start), durH=num(x.Duration_Hours,num(sch.Planned_Duration_Hours,8)), dur=Math.max(1,Math.ceil(durH/slotHours));
      if(!due||!baseline){hardRejected.push({interventionId:id,reason:'Missing governed baseline or Required Completion'});continue;}
      let earliest=new Date(start);
      if(String(mat.Material_Status)==='Constraint'||num(mat.Available_Qty,0)<num(mat.Required_Qty,x.Required_Part_Qty||0)){const er=parseDate(mat.Earliest_Receipt);if(er&&+er>+earliest)earliest=er;}
      if(+earliest+dur*slotHours*3600000>+due){hardRejected.push({interventionId:id,reason:'Hard material availability falls after Required Completion',evidence:{Material_Status:mat.Material_Status,Earliest_Receipt:mat.Earliest_Receipt,Required_By:x.Required_By}});continue;}
      const required=reqBy.get(id)||[]; const rr=[];
      const skillReq=required.find(r=>r.Requirement_Type==='Skill'); const toolReq=required.find(r=>r.Requirement_Type==='Tool'); const vehReq=required.find(r=>r.Requirement_Type==='Vehicle Class');
      const skill=skillReq?.Requirement_Ref||x.Required_Skill; if(skill)rr.push({resourceId:`SKILL::${skill}`,quantity:num(skillReq?.Quantity,x.Required_Crew_Qty||1)});
      const tool=toolReq?.Requirement_Ref||x.Required_Tool_ID; if(tool)rr.push({resourceId:`TOOL::${tool}`,quantity:num(toolReq?.Quantity,1)});
      const veh=vehReq?.Requirement_Ref||x.Vehicle_Class; if(veh)rr.push({resourceId:`VEHICLE::${veh}`,quantity:num(vehReq?.Quantity,1)});
      const missing=rr.filter(q=>!resById.has(q.resourceId)); if(missing.length){hardRejected.push({interventionId:id,reason:'Missing governed required resource',evidence:missing});continue;}

      let latest=ceilSlot(due,start,slotHours)-dur;
      if(rc.Deferral_Tolerance_Days!==undefined&&rc.Deferral_Tolerance_Days!==null&&rc.Deferral_Tolerance_Days!==''){
        const rcmMax=ceilSlot(new Date(+start+num(rc.Deferral_Tolerance_Days,0)*DAY),start,slotHours); latest=Math.min(latest,rcmMax);
      }
      const approvedFuture=false;
      const seed=[baseline,addHours(due,-dur*slotHours),parseDate(sch.AIP_Optimized_Start),parseDate(sch.Approved_Start),+earliest>+start?earliest:null].filter(Boolean).map(d=>ceilSlot(d,start,slotHours));
      // Add all daily 08:00 slots within the governed window; this preserves MILP choice without exploding to arbitrary sub-slot times.
      const lo=Math.max(0,ceilSlot(earliest,start,slotHours)),hi=Math.min(horizonSlots-dur,latest);
      for(let s=lo;s<=hi;s+=Math.max(1,Math.round(24/slotHours)))seed.push(s);
      let candidates=uniq(seed).filter(s=>s>=lo&&s<=hi&&s+dur<=horizonSlots&&slotPassesSiteAccess(x,s,dur)&&slotPassesOutage(x,s,dur)&&slotHasResources(rr,s,dur));
      if(!candidates.length){hardRejected.push({interventionId:id,reason:yes(x.Outage_Required)?'No feasible governed slot after access/outage/resource gating':'No feasible governed slot after access/resource/material gating',evidence:{Outage_Required:x.Outage_Required,Plant_ID:x.Plant_ID,Required_By:x.Required_By,Planning_Status:x.Planning_Status}});continue;}
      const mob=siteMobilization.get(String(x.Plant_ID))||{}; const startCostBySlot={}; candidates.forEach(s=>startCostBySlot[s]=num(mob.Vehicle_Travel_Cost_INR,0));
      interventions.push({id,siteId:x.Plant_ID,assetId:x.Asset_ID,assetTag:x.Asset_Tag,durationSlots:dur,durationHours:durH,earliestStartSlot:lo,latestStartSlot:hi,requiredBySlot:ceilSlot(due,start,slotHours),baselineStartSlot:Math.max(0,ceilSlot(baseline,start,slotHours)),priorityWeight:priorityWeight(x.Priority),executionCost:num(cost.Total_Execution_Cost_INR,0),startCostBySlot,resourceRequirements:rr,allowedStartSlots:candidates,sourceRecord:{mode:opts.sourceMode||'Excel',workOrderId:x.Work_Order_ID,planningStatus:x.Planning_Status,approvedFuture,permitRequired:x.Permit_Required,outageRequired:x.Outage_Required,materialStatus:mat.Material_Status||'',rcmDeferralDays:rc.Deferral_Tolerance_Days??null}});
    }

    const costScale=Math.max(1,...interventions.map(x=>x.executionCost||0));
    return {scenarioId:'AIP-V459-RUNTIME',scenarioName:`AIP v459 · governed runtime planning data · ${fmt(asOf)}`,sourceMode:opts.sourceMode||'Excel',sourceVersion:SOURCE_VERSION,adapterVersion:VERSION,readOnlySource:true,rollingWindow:{asOf:fmt(asOf),availableFrom:fmt(new Date(+asOf-15*DAY)),availableTo:fmt(activeEnd),lookbackDays:15,forwardMonths:12,sourceAnchor:fmt(SOURCE_ANCHOR)},planningContext:{siteId:siteScope||'All',horizonEnd:fmt(horizonEnd),horizonDays:Math.round((+horizonEnd-+asOf)/DAY)},horizon:{slots:horizonSlots,slotUnit:`${slotHours} hours`,slotHours,startDate:asOf.toISOString()},resources,interventions,hardRejected,objective:{strategy:opts.objectiveStrategy||'balanced',weights:{completion:.25,cost:.25,resource:.25,stability:.25,costScale,resourceScale:10}},adapterDiagnostics:{sourceInterventions:ints.length,scopeInterventions:scope.length,modelInterventions:interventions.length,hardRejected:hardRejected.length,completedExcluded:completedIds.size,fixedApprovedExcluded:fixedApprovedIds.size,resourceCalendarRowsRaw:(raw.PLAN_Resource_Calendar||[]).length,resourceCalendarRowsRuntime:detailCal.length,weatherRowsRaw:(raw.PLAN_Weather_Forecast||[]).length,weatherRowsRuntime:(data.PLAN_Weather_Forecast||[]).length,resourceCalendarPolicy:'Detailed technician-day rows where governed; crew-month fallback for uncovered technician/day; no fabricated person-day records',siteAccessPolicy:'Hard gate from PLAN_Calendar explicit blocking events',outagePolicy:'Outage_Required requires explicit governed Grid Outage Window',weatherPolicy:'Informational only; excluded from solver hard constraints',travelPolicy:'Global skill capacity prevents same-slot double use; mobilization burden retained from governed site cost basis; no route-time matrix fabricated',approvedFuturePolicy:'Approved future work excluded from decision variables and retained as fixed governed commitments; existing calendars preserve occupied capacity',completedPolicy:'Actual/ERP completed interventions excluded from decision variables'}};
  }

  function toEngineRequest(model,opts={}){
    return {runId:opts.runId,modelType:'solar_maintenance_scheduling',alternatives:Math.max(1,Math.min(5,num(opts.alternatives,3))),objectiveStrategy:opts.objectiveStrategy||model.objective?.strategy||'balanced',solverOptions:opts.solverOptions||{},data:model};
  }

  return {VERSION,SOURCE_VERSION,SOURCE_ANCHOR,prepareRuntime,build,toEngineRequest,normId,parseDate,fmt};
});

