
/* ===== Final Excel / Synthetic parity layer ===== */
(function(){
  function pct(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
  function syncGovernanceData(data){
    if(!data) return;
    const rows=data["AI Model Registry"]||[];
    if(rows.length && typeof MODEL_REGISTRY!=="undefined"){
      MODEL_REGISTRY.splice(0,MODEL_REGISTRY.length,...rows.map(r=>({
        model:String(r.Model_Name||r.Model_ID||"Model"),
        category:String(r.Capability||r.Model_Type||"AI"),
        use:String(r.Intended_Use||r.Capability||"Governed AI capability"),
        feedsTab:String(r.Capability||"AI Model Registry"),
        section:String(r.Version||""),
        status:String(r.Deployment_Status||"Planned"),
        deploymentRole:String(r.Deployment_Status)==="Production"?"Load-bearing now":String(r.Deployment_Status||"Roadmap"),
        decisionAuthority:String(r.Approval_Status)==="Approved"?"Governed decision support":"Human approval required",
        precision:pct(r.Precision), recall:pct(r.Recall), f1:pct(r.F1_Score),
        approvalStatus:String(r.Approval_Status||""), riskClass:String(r.Risk_Class||"")
      })));
    }
    window.AIP_GUARDRAIL_POLICIES=(data["AI Guardrail Policies"]||[]).slice();
    window.AIP_GUARDRAIL_DECISIONS=(data["AI Guardrail Decisions"]||[]).slice();
    window.AIP_AUTONOMY_MATRIX=(data["AI Autonomy Matrix"]||[]).slice();
    window.AIP_APPROVAL_MATRIX=(data["AI Approval Matrix"]||[]).slice();
  }
  const original=window.applyImportedData;
  if(typeof original==="function"){
    window.applyImportedData=function(data){ original(data); syncGovernanceData(data); };
  }
  const updateGuardrailKPIs=()=>{
    const v=document.getElementById("view-guardrails"), rows=window.AIP_GUARDRAIL_DECISIONS||[];
    if(!v||!rows.length)return;
    const cards=[...v.querySelectorAll(".aig-kpis > *")];
    const vals=[
      rows.length,
      rows.filter(r=>String(r.Outcome).toLowerCase().includes("approval")).length,
      rows.filter(r=>String(r.Outcome).toLowerCase().includes("review")).length,
      rows.filter(r=>String(r.Outcome).toLowerCase().includes("block")).length
    ];
    vals.forEach((val,i)=>{
      const card=cards[i]; if(!card)return;
      const candidates=[...card.querySelectorAll("b,strong,.kpi-value,.value")];
      const num=candidates.find(el=>/\d/.test(el.textContent||""))||candidates[0];
      if(num)num.textContent=Number(val).toLocaleString("en-IN");
    });
  };
  document.addEventListener("DOMContentLoaded",()=>{
    syncGovernanceData(window.APM_IMPORTED_DATA||{});
    let queued=false;
    const guardrailKpiObserver=new window.__APMSafeMutationObserver(()=>{
      if(queued) return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;updateGuardrailKPIs();window.enhanceAllKPIs?.(document.getElementById("main")||document);});
    });
    guardrailKpiObserver.observe(document.getElementById("main")||document.body,{childList:true,subtree:true});
    setTimeout(updateGuardrailKPIs,600);
  });
  const oldRefresh=window.refreshAllAPM;
  if(typeof oldRefresh==="function"){
    window.refreshAllAPM=function(){
      const r=oldRefresh.apply(this,arguments);
      syncGovernanceData(window.APM_IMPORTED_DATA||{});
      setTimeout(()=>{updateGuardrailKPIs();window.enhanceAllKPIs?.(document);window.updateKPIContext?.(document);},80);
      return r;
    };
  }
})();
