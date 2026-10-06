
(function(){
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const STRATS=['Preventive','Predictive','Corrective','Risk-Based','Adaptive'];
 const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const fmt=(n,d=2)=>Number.isFinite(+n)?Number(n).toFixed(d):'N/A';
 const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
 function activeRoot(){return VIEWS.map(v=>document.getElementById('view-'+v)).find(x=>x&&getComputedStyle(x).display!=='none')||document.querySelector('.view.active')}
 function rowStrategy(w){
   const t=String(w?.type??w?.Maintenance_Type??w?.Work_Type??'Corrective');
   const low=t.toLowerCase().replace(/-/g,'');
   return STRATS.find(s=>low.includes(s.toLowerCase().replace(/-/g,'')))||(/risk/i.test(t)?'Risk-Based':'Corrective');
 }
 function detailData(a){
   const wos=Array.isArray(a.wos)?a.wos:[];
   const risks=Array.isArray(a.risks)?a.risks:[];
   const rqs=Array.isArray(a.rqs)?a.rqs:[];
   const cnt=t=>wos.filter(w=>rowStrategy(w)===t).length;
   const prev=cnt('Preventive'),pred=cnt('Predictive'),corr=cnt('Corrective'),adap=cnt('Adaptive');
   const maxField=(rows,keys,def=0)=>{
     const nums=rows.map(r=>{for(const k of keys){const n=Number(r?.[k]);if(Number.isFinite(n))return n}return NaN}).filter(Number.isFinite);
     return nums.length?Math.max(...nums):def;
   };
   const minField=(rows,keys,def=9999)=>{
     const nums=rows.map(r=>{for(const k of keys){const n=Number(r?.[k]);if(Number.isFinite(n))return n}return NaN}).filter(Number.isFinite);
     return nums.length?Math.min(...nums):def;
   };
   const rr=maxField(risks,['riskScore','Risk_Score','Failure_Risk_Pct'],0);
   const cf=maxField(risks,['confidence','Confidence_Pct'],0);
   const rul=minField(risks,['rulDays','RUL_Days'],9999);
   const comp=maxField(rqs,['composite','Composite_Risk'],0);
   return {wos,risks,rqs,prev,pred,corr,adap,rr,cf,rul,comp};
 }
 function cards(a,sel){
   const d=detailData(a),aggregate=sel?.asset==='All';
   const score=a.scores||{};
   function final(name){return `${fmt(score[name],1)} / 100`}
   const riskPresent=d.risks.length>0, compPresent=d.rqs.length>0;
   const defs={
    'Preventive':[
      ['Base','55'],
      ['Preventive WO contribution',`${d.prev} × 10 = +${d.prev*10}`],
      ['Condition-risk adjustment',riskPresent?`${fmt(d.rr)} × 25 = −${fmt(d.rr*25)}`:'No condition-risk evidence → 0'],
      ['Corrective WO penalty',`${d.corr} × 8 = −${d.corr*8}`]
    ],
    'Predictive':[
      ['Base','20'],
      ['Condition-risk contribution',riskPresent?`${fmt(d.rr)} × 50 = +${fmt(d.rr*50)}`:'No condition-risk evidence → 0'],
      ['Confidence contribution',riskPresent?`${fmt(d.cf)}% ÷ 100 × 20 = +${fmt((d.cf/100)*20)}`:'No confidence evidence → 0'],
      ['RUL trigger',riskPresent?(d.rul<60?`RUL ${fmt(d.rul,0)} d < 60 → +10`:`RUL ${fmt(d.rul,0)} d ≥ 60 → +0`):'No RUL evidence → +0'],
      ['Predictive WO contribution',`${d.pred} × 5 = +${d.pred*5}`]
    ],
    'Corrective':[
      ['Base','20'],
      ['Corrective WO contribution',`${d.corr} × 22 = +${d.corr*22}`],
      ['Condition-risk adjustment',riskPresent?(d.rr<.35?`Risk ${fmt(d.rr)} < 0.35 → +10`:`Risk ${fmt(d.rr)} ≥ 0.35 → −5`):'No condition-risk evidence → risk defaults to 0, therefore +10']
    ],
    'Risk-Based':[
      ['Base','20'],
      ['Composite-risk contribution',compPresent?`${fmt(d.comp)} × 60 = +${fmt(d.comp*60)}`:'No composite-risk evidence → 0'],
      ['Corrective WO contribution',`${d.corr} × 5 = +${d.corr*5}`]
    ],
    'Adaptive':[
      ['Base','20'],
      ['Condition evidence present',riskPresent?'+16':'No condition evidence → +0'],
      ['Risk-band adjustment',riskPresent?((d.rr>=.35&&d.rr<=.8)?`Risk ${fmt(d.rr)} in 0.35–0.80 → +12`:`Risk ${fmt(d.rr)} outside 0.35–0.80 → +4`):'No condition-risk evidence → +4'],
      ['Preventive/Predictive mix',`${Math.min(d.prev+d.pred,3)} × 6 = +${Math.min(d.prev+d.pred,3)*6}`],
      ['Adaptive WO contribution',`${d.adap} × 8 = +${d.adap*8}`]
    ]
   };
   return STRATS.map(name=>{
     const rows=defs[name].map(([k,v])=>`<div class="ms708-calc-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
     return `<div class="ms708-calc-card"><div class="ms708-calc-head"><strong>${esc(name)}</strong><em>${final(name)}</em></div>${rows}</div>`;
   }).join('');
 }
 function openGraph(){
   const root=activeRoot(),ws=root?.querySelector('.ms686-workspace'),a=ws?._a||{},sel=ws?._sel||{};
   let m=document.getElementById('ms686Modal');
   if(!m){m=document.createElement('div');m.id='ms686Modal';m.className='ms686-modal';m.innerHTML='<div class="ms686-panel"><button class="ms686-close" onclick="window.ms686Close()">×</button><h2></h2><p></p><div class="ms686-body"></div></div>';document.body.appendChild(m)}
   m.querySelector('h2').textContent='Strategy Reasoning Detail';
   m.querySelector('p').textContent='';
   const governedNote=(a.governedContext===true)
     ? `<div class="ms708-context-note">The selected failure mode is governed/applicable for this asset class, but no exact failure-tagged evidence row exists. Asset-level evidence is used as policy context and is not relabelled as failure-specific evidence.</div>`:'';
   m.querySelector('.ms686-body').innerHTML=
     `<div class="ms708-basis-intro">Suitability Basis · deterministic analytical score, not ML probability.</div>
      ${governedNote}
      <div class="ms708-summary">
        <div><span>Evidence Sufficiency</span><b>${a.sufficient?'Adequate for reassessment':'Insufficient for governed recommendation'}</b></div>
        <div><span>Strongest Fit</span><b>${esc(a.best||'No conclusion')}</b></div>
        <div><span>Policy Action</span><b>${esc(a.action||'No action')}</b></div>
      </div>
      <div class="ms708-calc-grid">${cards(a,sel)}</div>`;
   m.classList.add('open');
 }
 const prior=window.ms690Detail;
 window.ms690Detail=function(type,arg){
   if(type==='graph690'){openGraph();return}
   if(typeof prior==='function')return prior(type,arg);
 };
 function clean(){
   VIEWS.forEach(v=>{
     const root=document.getElementById('view-'+v),ws=root?.querySelector('.ms686-workspace');if(!ws)return;
     ws.querySelectorAll('.ms686-active-note').forEach(x=>x.remove());
     [...ws.querySelectorAll('.ms686-card')].forEach(card=>{
       const title=card.querySelector(':scope>.ms686-head h3')?.textContent||'';
       if(/Strategy Reasoning Graph/i.test(title)){
         const sub=card.querySelector(':scope>.ms686-head .ms686-sub');
         if(sub)sub.textContent='';
       }
     });
   });
 }
 let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;clean()})}
 const mo=new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))schedule()});
 mo.observe(document.getElementById('main')||document.body,{subtree:true,childList:true});
 document.addEventListener('aip:data-source-changed',()=>setTimeout(schedule,30));
 document.addEventListener('change',()=>setTimeout(schedule,20),true);
 document.addEventListener('click',()=>setTimeout(schedule,20),true);
 schedule();setTimeout(schedule,180);
})();
