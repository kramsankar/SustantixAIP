
(function(){
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 function annotate(){
   VIEWS.forEach(v=>{
     const root=document.getElementById('view-'+v),ws=root?.querySelector('.ms686-workspace'),sel=ws?._sel;
     const dd=ws?.querySelector('.ms686-failure');
     if(!ws||!sel||!dd)return;
     const asset=sel.asset;
     if(asset==='All')return;
     const p=sel.lens?.find(x=>x.key===asset);
     if(!p)return;
     [...dd.options].forEach(o=>{
       if(o.value==='All'||!o.value)return;
       if((p.evidenceFailures||[]).includes(o.value))o.title='Explicit asset evidence + governed failure-mode context';
       else if((p.rcmFailures||[]).includes(o.value))o.title='Governed RCM failure mode for '+(p.assetClass||'selected asset class');
     });
   });
 }
 let raf=0; const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;annotate()})};
 document.addEventListener('change',e=>{if(e.target.matches('.ms686-site,.ms686-asset,.ms686-failure'))setTimeout(schedule,35)},true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(schedule,50));
 setTimeout(schedule,80);setTimeout(schedule,280);
})();
