
/* AIP Solar IPP Optimization Engine v2.0.0
 * Standalone bolt-on service layer over the native LP/MIP solver.
 * UMD: works in browser and Node. No AIP application dependency.
 */
'use strict';
(function(root, factory){
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./aip-native-solver.js'));
  else root.AIPOptimizationEngine = factory(root.LPEngine);
})(typeof self !== 'undefined' ? self : this, function(LPEngine){
  if (!LPEngine) throw new Error('AIP Optimization Engine requires aip-native-solver.js / LPEngine.');

  const VERSION = '2.0.0';
  const CONTRACT_VERSION = '2026-09-06';
  const EPS = 1e-7;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const num = (x,d=0) => Number.isFinite(Number(x)) ? Number(x) : d;

  function isoRunId(prefix='OPT') {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
    return `${prefix}-${stamp}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  }

  function analyzeNumerics(model) {
    const vals=[];
    model.objective.forEach(v=>{ if (Math.abs(v)>0) vals.push(Math.abs(v)); });
    model.constraints.forEach(c=>c.coeffs.forEach(v=>{ if(Math.abs(v)>0) vals.push(Math.abs(v)); }));
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 0;
    const ratio = min>0 ? max/min : 1;
    const warnings=[];
    if (min>0 && min<1e-8) warnings.push('Very small non-zero coefficients detected (<1e-8); rescale the model to reduce numerical risk.');
    if (max>1e8) warnings.push('Very large coefficients detected (>1e8); rescale the model and review Big-M values.');
    if (ratio>1e9) warnings.push('Coefficient magnitude ratio exceeds 1e9; numerical conditioning may be poor.');
    return { minNonZeroCoefficient:min, maxCoefficient:max, coefficientRatio:ratio, warnings };
  }

  function validateSolution(model, result, tolerance=1e-6) {
    if (!result || result.status !== 'optimal' || !result.variables) {
      return { valid:false, checked:false, violations:[{type:'solver_status', message:'No solver solution available for independent validation.'}] };
    }
    const vios=[];
    const values=result.variables;
    for (const v of model.variables) {
      const x=num(values[v.name], NaN);
      if (!Number.isFinite(x)) { vios.push({type:'missing_variable', variable:v.name}); continue; }
      if (x < v.lb-tolerance) vios.push({type:'lower_bound',variable:v.name,value:x,bound:v.lb});
      if (x > v.ub+tolerance) vios.push({type:'upper_bound',variable:v.name,value:x,bound:v.ub});
      if ((v.type==='integer'||v.type==='binary') && Math.abs(x-Math.round(x))>tolerance) vios.push({type:'integrality',variable:v.name,value:x});
    }
    for (const c of model.constraints) {
      let lhs=0;
      c.coeffs.forEach((coef,idx)=>{ lhs += coef*num(values[model.variables[idx].name],0); });
      let ok=true;
      if(c.sense==='<=') ok=lhs<=c.rhs+tolerance;
      else if(c.sense==='>=') ok=lhs>=c.rhs-tolerance;
      else ok=Math.abs(lhs-c.rhs)<=tolerance;
      if(!ok) vios.push({type:'constraint',constraint:c.name,sense:c.sense,lhs,rhs:c.rhs});
    }
    return { valid:vios.length===0, checked:true, violationCount:vios.length, violations:vios.slice(0,100) };
  }

  function allowedStarts(iv,horizon) {
    const start=Math.max(num(iv.earliestStartSlot,0),0);
    const latestByHorizon=horizon.slots-num(iv.durationSlots,1);
    const latestByDue=iv.deadlineHard===false ? latestByHorizon : Math.min(latestByHorizon,num(iv.requiredBySlot,horizon.slots)-num(iv.durationSlots,1)+1);
    const latest=Math.min(iv.latestStartSlot===undefined?latestByDue:num(iv.latestStartSlot),latestByDue);
    const out=[];
    for(let s=start;s<=latest;s++) {
      if(Array.isArray(iv.allowedStartSlots) && !iv.allowedStartSlots.includes(s)) continue;
      out.push(s);
    }
    return out;
  }

  function objectiveCoefficient(iv,s,strategy,profile,horizon,scarcity) {
    const dur=num(iv.durationSlots,1), completion=s+dur;
    const baseline=num(iv.baselineStartSlot,s);
    const move=Math.abs(s-baseline);
    const late=Math.max(0,completion-num(iv.requiredBySlot,horizon.slots));
    const priority=Math.max(1,num(iv.priorityWeight,1));
    const execution=num(iv.executionCost,0) + num((iv.startCostBySlot||{})[s],0);
    const scarce=scarcity[iv.id]?.[s]||0;
    if(strategy==='earliest_completion') return priority*completion + late*10000 + move*1e-4;
    if(strategy==='lowest_execution_cost') return execution + late*10000 + move*1e-4;
    if(strategy==='resource_efficiency') return scarce + late*10000 + move*1e-4;
    if(strategy==='minimum_schedule_change') return move + late*10000;
    const w=profile||{};
    const norm=(value,scale)=>value/Math.max(EPS,scale||1);
    return (num(w.completion,0.25)*norm(priority*completion,horizon.slots*Math.max(1,priority))+
      num(w.cost,0.25)*norm(execution,num(w.costScale,Math.max(1,execution)))+
      num(w.resource,0.25)*norm(scarce,num(w.resourceScale,10))+
      num(w.stability,0.25)*norm(move,horizon.slots)+
      late*10000);
  }

  function computeScarcity(data,startsByIv) {
    const cap={};
    (data.resources||[]).forEach(r=>{ cap[r.id]=Array.from({length:data.horizon.slots},(_,t)=>num((r.capacityBySlot||[])[t],num(r.capacity,1))); });
    const out={};
    (data.interventions||[]).forEach(iv=>{
      out[iv.id]={};
      (startsByIv[iv.id]||[]).forEach(s=>{
        let score=0;
        (iv.resourceRequirements||[]).forEach(req=>{
          for(let t=s;t<s+num(iv.durationSlots,1);t++) {
            const c=cap[req.resourceId]?.[t]||0;
            score += c>0 ? num(req.quantity,1)/c : 1000;
          }
        });
        out[iv.id][s]=score;
      });
    });
    return out;
  }

  function buildSolarMaintenanceModel(data, options={}) {
    const horizon=data.horizon;
    if(!horizon || !Number.isInteger(num(horizon.slots)) || num(horizon.slots)<=0) throw new Error('Solar scheduling model requires horizon.slots > 0.');
    const interventions=data.interventions||[];
    if(!interventions.length) throw new Error('Solar scheduling model requires interventions.');
    const m=new LPEngine.LPModel({sense:'minimize'});
    const startsByIv={};
    interventions.forEach(iv=>{
      const starts=allowedStarts(iv,horizon);
      if(!starts.length) throw new Error(`Intervention ${iv.id} has no feasible start slot within its governed window.`);
      startsByIv[iv.id]=starts;
      starts.forEach(s=>m.addVariable(`x__${iv.id}__${s}`,{type:'binary'}));
      const row={}; starts.forEach(s=>row[`x__${iv.id}__${s}`]=1);
      m.addConstraint(row,'=',1,`schedule_once__${iv.id}`);
    });

    // Resource capacity by time slot.
    const resources=data.resources||[];
    for(const r of resources) {
      for(let t=0;t<horizon.slots;t++) {
        const row={};
        for(const iv of interventions) {
          const req=(iv.resourceRequirements||[]).find(q=>q.resourceId===r.id);
          if(!req) continue;
          for(const s of startsByIv[iv.id]) if(t>=s && t<s+num(iv.durationSlots,1)) row[`x__${iv.id}__${s}`]=num(req.quantity,1);
        }
        if(Object.keys(row).length) {
          const capacity=num((r.capacityBySlot||[])[t],num(r.capacity,1));
          m.addConstraint(row,'<=',capacity,`capacity__${r.id}__${t}`);
        }
      }
    }

    // Precedence through forbidden start pairs.
    for(const iv of interventions) {
      for(const predId of (iv.predecessors||[])) {
        const pred=interventions.find(x=>x.id===predId);
        if(!pred) throw new Error(`Intervention ${iv.id} references missing predecessor ${predId}.`);
        for(const sp of startsByIv[pred.id]) for(const ss of startsByIv[iv.id]) {
          if(ss < sp+num(pred.durationSlots,1)) {
            m.addConstraint({[`x__${pred.id}__${sp}`]:1,[`x__${iv.id}__${ss}`]:1},'<=',1,`precedence__${pred.id}__${sp}__${iv.id}__${ss}`);
          }
        }
      }
    }

    // Optional forbidden exact solutions for alternative generation.
    (options.forbiddenSolutions||[]).forEach((sol,idx)=>{
      const row={}; let n=0;
      Object.entries(sol).forEach(([ivId,s])=>{ const name=`x__${ivId}__${s}`; if(m._varIndex.has(name)){row[name]=1;n++;} });
      if(n) m.addConstraint(row,'<=',n-1,`alternative_diversity__${idx+1}`);
    });

    const scarcity=computeScarcity(data,startsByIv);
    const strategy=options.objectiveStrategy||data.objective?.strategy||'balanced';
    const obj={};
    interventions.forEach(iv=>startsByIv[iv.id].forEach(s=>{ obj[`x__${iv.id}__${s}`]=objectiveCoefficient(iv,s,strategy,data.objective?.weights,horizon,scarcity); }));
    m.setObjective(obj);
    return {model:m,startsByIv,strategy,scarcity};
  }

  function extractSolarSchedule(data, modelResult) {
    const schedule=[];
    for(const iv of data.interventions||[]) {
      let start=null;
      Object.entries(modelResult.variables||{}).forEach(([name,val])=>{
        const prefix=`x__${iv.id}__`;
        if(name.startsWith(prefix)&&num(val)>0.5) start=num(name.slice(prefix.length));
      });
      if(start===null) continue;
      schedule.push({
        interventionId:iv.id, siteId:iv.siteId, assetId:iv.assetId,
        startSlot:start, finishSlot:start+num(iv.durationSlots,1),
        baselineStartSlot:num(iv.baselineStartSlot,start), requiredBySlot:num(iv.requiredBySlot,data.horizon.slots),
        movementSlots:Math.abs(start-num(iv.baselineStartSlot,start)), executionCost:num(iv.executionCost,0),
        resourceRequirements:clone(iv.resourceRequirements||[])
      });
    }
    return schedule.sort((a,b)=>a.startSlot-b.startSlot||a.interventionId.localeCompare(b.interventionId));
  }

  function solarMetrics(data,schedule) {
    const byId=Object.fromEntries(schedule.map(x=>[x.interventionId,x]));
    const completion=schedule.length?Math.max(...schedule.map(x=>x.finishSlot)):0;
    const breaches=schedule.filter(x=>x.finishSlot>x.requiredBySlot).length;
    const movement=schedule.reduce((a,x)=>a+x.movementSlots,0);
    const cost=schedule.reduce((a,x)=>a+x.executionCost,0);
    let resourcePeak=0, conflicts=0;
    for(const r of data.resources||[]) for(let t=0;t<data.horizon.slots;t++) {
      let used=0;
      for(const iv of data.interventions||[]) {
        const s=byId[iv.id]; if(!s || !(t>=s.startSlot&&t<s.finishSlot)) continue;
        const req=(iv.resourceRequirements||[]).find(q=>q.resourceId===r.id); if(req) used+=num(req.quantity,1);
      }
      const cap=num((r.capacityBySlot||[])[t],num(r.capacity,1));
      resourcePeak=Math.max(resourcePeak,cap>0?used/cap:used>0?Infinity:0);
      if(used>cap+EPS) conflicts++;
    }
    return {planCompletionSlot:completion,requiredCompletionBreaches:breaches,scheduleMovementSlots:movement,executionCost:cost,resourceConflictSlots:conflicts,peakResourceUtilization:resourcePeak};
  }

  function optimizeSolar(request) {
    const data=clone(request.data||{});
    const alternatives=Math.max(1,Math.min(5,num(request.alternatives,3)));
    const forbidden=[]; const outputs=[];
    for(let k=0;k<alternatives;k++) {
      const built=buildSolarMaintenanceModel(data,{objectiveStrategy:request.objectiveStrategy||data.objective?.strategy,forbiddenSolutions:forbidden});
      const numerical=analyzeNumerics(built.model);
      const result=built.model.solve(request.solverOptions||{});
      const validation=validateSolution(built.model,result);
      if(result.status!=='optimal' || !result.variables || !validation.valid) {
        if(k===0) return {status:result.status,solverResult:result,validation,numerical,alternatives:[]};
        break;
      }
      const schedule=extractSolarSchedule(data,result);
      const startMap=Object.fromEntries(schedule.map(x=>[x.interventionId,x.startSlot]));
      forbidden.push(startMap);
      outputs.push({alternativeId:`ALT-${String(k+1).padStart(2,'0')}`,objective:result.objective,optimal:result.optimal!==false,bestBound:result.bestBound,mipGapRelative:result.mipGapRelative,nodesExplored:result.nodesExplored,schedule,metrics:solarMetrics(data,schedule),validation,numerical});
      if(result.optimal===false) break; // do not proliferate alternatives from an unproven incumbent.
    }
    return {status:outputs.length?'optimal':'infeasible',alternatives:outputs};
  }

  function optimize(request) {
    const started=Date.now();
    request=clone(request||{});
    const runId=request.runId||isoRunId('SOLAR');
    const response={contractVersion:CONTRACT_VERSION,engineVersion:VERSION,nativeSolverVersion:LPEngine.VERSION,runId,modelType:request.modelType||'solar_maintenance_scheduling',startedAt:new Date().toISOString()};
    try {
      if(response.modelType!=='solar_maintenance_scheduling') throw new Error('This standalone engine is scoped only to Solar IPP maintenance scheduling.');
      Object.assign(response,optimizeSolar(request));
    } catch(err) {
      response.status='error'; response.error={message:err.message,stack:err.stack};
    }
    response.elapsedMs=Date.now()-started;
    response.completedAt=new Date().toISOString();
    return response;
  }

  return {VERSION,CONTRACT_VERSION,optimize,buildSolarMaintenanceModel,validateSolution,analyzeNumerics,solarMetrics};
});

