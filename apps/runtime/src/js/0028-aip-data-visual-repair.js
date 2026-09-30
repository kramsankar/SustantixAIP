
(function(){
  const num=v=>{
    if(typeof v==='number') return Number.isFinite(v)?v:0;
    if(v==null||v==='') return 0;
    let t=String(v).trim().replace(/,/g,'');
    if(/^[-–—]$/.test(t)) return 0;
    let pct=/%$/.test(t); t=t.replace(/[^0-9eE+\-.]/g,'');
    let n=Number(t); if(!Number.isFinite(n)) n=0;
    return n;
  };
  const labels=(a,n)=>{
    const x=Array.isArray(a)?a.map((v,i)=>String(v??`Item ${i+1}`)):[];
    while(x.length<n)x.push(`Item ${x.length+1}`);
    return x.slice(0,n);
  };
  function removeEmpty(canvas){canvas?.parentElement?.querySelector(':scope > .aip-chart-empty')?.remove()}
  function empty(canvas,msg='No valid values are available for this selection'){
    if(!canvas?.parentElement)return;
    removeEmpty(canvas);const d=document.createElement('div');d.className='aip-chart-empty';d.textContent=msg;
    const p=canvas.parentElement;if(getComputedStyle(p).position==='static')p.style.position='relative';p.appendChild(d);
  }
  function wrap(name,normalise){
    const original=window[name];if(typeof original!=='function'||original.__aipFixed)return;
    const fixed=function(id,cfg){
      const canvas=document.getElementById(id);if(!canvas)return;
      try{
        const clean=normalise(cfg||{});
        const values=clean.__values||[];delete clean.__values;
        if(values.length&&!values.some(Number.isFinite)){empty(canvas);return}
        removeEmpty(canvas);return original.call(this,id,clean);
      }catch(e){console.warn(name+' repaired render failed',id,e);empty(canvas);}
    };fixed.__aipFixed=true;fixed.__original=original;window[name]=fixed;
  }
  function installChartFixes(){
    wrap('chBarV',c=>{const ss=(Array.isArray(c.series)?c.series:[]).map(s=>({...s,data:(Array.isArray(s.data)?s.data:[]).map(num)}));const n=Math.max(c.labels?.length||0,...ss.map(s=>s.data.length),1);ss.forEach(s=>{while(s.data.length<n)s.data.push(0);s.data=s.data.slice(0,n)});return {...c,labels:labels(c.labels,n),series:ss,__values:ss.flatMap(s=>s.data)}});
    wrap('chLine',c=>{const ss=(Array.isArray(c.series)?c.series:[]).map(s=>({...s,data:(Array.isArray(s.data)?s.data:[]).map(num)}));const n=Math.max(c.labels?.length||0,...ss.map(s=>s.data.length),1);ss.forEach(s=>{while(s.data.length<n)s.data.push(0);s.data=s.data.slice(0,n)});return {...c,labels:labels(c.labels,n),series:ss,__values:ss.flatMap(s=>s.data)}});
    wrap('chBarH',c=>{const d=(Array.isArray(c.data)?c.data:[]).map(num),n=Math.max(d.length,c.labels?.length||0,1);while(d.length<n)d.push(0);const m=Array.isArray(c.markers)?c.markers.map(num):c.markers;return {...c,data:d.slice(0,n),labels:labels(c.labels,n),markers:m,__values:d}});
    wrap('chBarHGrouped',c=>{const ss=(Array.isArray(c.series)?c.series:[]).map(s=>({...s,data:(Array.isArray(s.data)?s.data:[]).map(num)}));const n=Math.max(c.labels?.length||0,...ss.map(s=>s.data.length),1);ss.forEach(s=>{while(s.data.length<n)s.data.push(0);s.data=s.data.slice(0,n)});return {...c,labels:labels(c.labels,n),series:ss,__values:ss.flatMap(s=>s.data)}});
    wrap('chDoughnut',c=>{const d=(Array.isArray(c.data)?c.data:[]).map(v=>Math.max(0,num(v)));return {...c,data:d,__values:d}});
    wrap('chComboBarLine',c=>{const b=(Array.isArray(c.barData)?c.barData:[]).map(num),l=(Array.isArray(c.lineData)?c.lineData:[]).map(num),n=Math.max(c.labels?.length||0,b.length,l.length,1);while(b.length<n)b.push(0);while(l.length<n)l.push(0);return {...c,labels:labels(c.labels,n),barData:b.slice(0,n),lineData:l.slice(0,n),__values:b.concat(l)}});
  }
  function repairRings(root=document){
    root.querySelectorAll('.kpi-mini-ring,.ai3-ring,.vision-ring').forEach(r=>{
      const prop=r.classList.contains('ai3-ring')?'--rv':r.classList.contains('vision-ring')?'--vision-ring':'--ring-val';
      const span=r.querySelector('span');
      let v=num(r.style.getPropertyValue(prop));
      if(!v&&span)v=num(span.textContent);
      if(!Number.isFinite(v))v=0;v=Math.max(0,Math.min(100,v));
      r.style.setProperty(prop,String(Math.round(v)));
      if(span)span.textContent=String(Math.round(v))+(r.classList.contains('kpi-mini-ring')?'':'%');
      r.setAttribute('aria-label',`Ring value ${Math.round(v)} percent`);
    });
    root.querySelectorAll('.kpi-value,.vision-kpi-value,.ai3-kpi .val').forEach(el=>{if(!String(el.textContent||'').trim())el.textContent='0'});
  }
  function redrawVisible(){
    installChartFixes();repairRings(document);
    const active=document.querySelector('.view.active[id^="view-"]');
    if(active){const name=active.id.replace('view-','');try{window.resizeView?.(name)}catch(e){} }
  }
  function hook(){
    installChartFixes();
    const oldRefresh=window.refreshAllAPM;
    if(typeof oldRefresh==='function'&&!oldRefresh.__visualRepair){
      const f=function(){const r=oldRefresh.apply(this,arguments);setTimeout(redrawVisible,40);setTimeout(redrawVisible,220);return r};f.__visualRepair=true;window.refreshAllAPM=f;
    }
    document.querySelectorAll('#loadExcelOption,#loadSyntheticOption,#dmCommit').forEach(el=>{if(el.dataset.visualRepair)return;el.dataset.visualRepair='1';el.addEventListener('click',()=>{setTimeout(redrawVisible,120);setTimeout(redrawVisible,700);setTimeout(redrawVisible,1800)})});
    repairRings(document);
  }
  const mo=new window.__APMSafeMutationObserver(()=>{clearTimeout(window.__aipVisualRepairTimer);window.__aipVisualRepairTimer=setTimeout(()=>repairRings(document),25)});
  function boot(){hook();mo.observe(document.getElementById('main')||document.body,{childList:true,subtree:true,characterData:true});setTimeout(hook,400);setTimeout(redrawVisible,1000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
