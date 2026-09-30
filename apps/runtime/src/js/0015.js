
(function(){
  const KPI_ROUTE_RULES=[
    [/fleet health|health index|asset health/i,"executiveperformance"],
    [/portfolio pr|performance ratio|\bpr\b/i,"siteperformance"],
    [/availability/i,"siteperformance"],
    [/open work order|critical work order|work orders/i,"workorderintelligence"],
    [/revenue at risk|generation loss|revenue loss/i,"lossintelligence"],
    [/co.? avoided|carbon|emission/i,"carbonwater"],
    [/overdue|pm compliance|preventive/i,"preventive"],
    [/mttr|mtbf|breakdown/i,"corrective"],
    [/adaptive|interval compression/i,"adaptive"],
    [/predictive|failure risk|high.risk/i,"predictive"],
    [/inventory|spare|reorder|stock/i,"inventory"],
    [/crew|technician|labor/i,"crewscheduling"],
    [/water|waste|esg|renewable/i,"esgoverview"],
    [/model/i,"modelregistry"],
    [/approval/i,"approval"]
  ];

  const KPI_ICONS=[
    [/health|condition/i,"♥"],
    [/performance ratio|\bpr\b|generation/i,"↗"],
    [/availability|uptime/i,"◴"],
    [/work order|maintenance/i,"⚙"],
    [/revenue|cost|value|margin/i,"₹"],
    [/carbon|co.?|emission/i,"♻"],
    [/water/i,"◉"],
    [/waste|circular/i,"↻"],
    [/risk|critical|overdue|breakdown/i,"!"],
    [/inventory|spare|stock/i,"▦"],
    [/crew|technician|labor/i,"♟"],
    [/asset/i,"◇"],
    [/model|ai/i,"✦"],
    [/compliance|sla/i,"✓"],
    [/energy|power|mw|mwh/i,"ϟ"]
  ];

  function hashText(s){
    let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return Math.abs(h>>>0);
  }
  function iconFor(label){
    for(const [rx,ic] of KPI_ICONS) if(rx.test(label)) return ic;
    return "◆";
  }
  function routeFor(label){
    for(const [rx,route] of KPI_ROUTE_RULES) if(rx.test(label)) return route;
    return null;
  }
  function statusFor(card,label){
    const delta=(card.querySelector(".kpi-delta")?.textContent||"").trim();
    if(/down|risk|critical|overdue|breakdown/i.test(label+" "+delta)) return "Attention";
    if(/up|healthy|on track|improved|compliance/i.test(delta)) return "Positive";
    return "Live";
  }
  function ringValue(card,label){
    const txt=(card.querySelector(".kpi-value")?.textContent||"").replace(/,/g,"");
    const n=parseFloat(txt.match(/-?\d+(\.\d+)?/)?.[0]||"");
    if(Number.isFinite(n)){
      if(/\/100|%/.test(txt)||/health|availability|compliance|performance ratio|\bpr\b/i.test(label)) return Math.max(8,Math.min(100,n));
      return Math.max(28,Math.min(96,55+(n%41)));
    }
    return 72;
  }
  function sparkHeights(label){
    let x=hashText(label)||17, vals=[];
    for(let i=0;i<10;i++){
      x=(x*1664525+1013904223)>>>0;
      vals.push(7+(x%21));
    }
    return vals;
  }
  function enhanceCard(card){
    if(card?.closest?.('#view-overview')) return;
    // Excel refresh may replace a card's innerHTML but leave the class behind.
    // A card is only genuinely enhanced when its visual children still exist.
    const complete = card.classList.contains("enhanced-kpi")
      && card.querySelector(".kpi-icon-wrap")
      && card.querySelector(".kpi-sparkline")
      && card.querySelector(".kpi-mini-ring");
    if(complete) return;
    card.classList.remove("enhanced-kpi","kpi-clickable");
    card.querySelectorAll(".kpi-visual-head,.kpi-visual-footer,.kpi-click-hint,.kpi-ring-context").forEach(el=>el.remove());
    const labelEl=card.querySelector(".kpi-label");
    const valueEl=card.querySelector(".kpi-value");
    if(!labelEl||!valueEl) return;
    const label=(labelEl.textContent||"Metric").trim();
    card.classList.add("enhanced-kpi");
    // Assign colours explicitly so dataset-driven DOM rebuilds cannot fall back to monochrome.
    const palettes=[
      ["#1976D2","#64B5F6"],["#00897B","#4DB6AC"],["#7B1FA2","#BA68C8"],["#EF6C00","#FFB74D"],
      ["#C62828","#EF5350"],["#3949AB","#7986CB"],["#2E7D32","#66BB6A"],["#AD1457","#EC407A"]
    ];
    const siblings=[...card.parentElement?.children||[]].filter(el=>el.classList?.contains("card"));
    const pos=Math.max(0,siblings.indexOf(card));
    const palette=palettes[pos%palettes.length];
    card.style.setProperty("--kpi-accent",palette[0],"important");
    card.style.setProperty("--kpi-accent-2",palette[1],"important");

    const head=document.createElement("div");
    head.className="kpi-visual-head";
    head.innerHTML='<div class="kpi-icon-wrap" aria-hidden="true">'+iconFor(label)+'</div><span class="kpi-status-pill">'+statusFor(card,label)+'</span>';
    // Use prepend rather than insertBefore(head, labelEl): during a dataset-driven
    // re-render, labelEl can be a stale reference that is no longer actually a child
    // of card by the time we get here, which throws and aborts the whole enhancement
    // pass for every card processed after this one. prepend achieves the same
    // 'visual head first' placement without depending on that reference being live.
    card.prepend(head);

    const footer=document.createElement("div");
    footer.className="kpi-visual-footer";
    const heights=sparkHeights(label);
    footer.innerHTML='<div class="kpi-sparkline" aria-label="Illustrative recent trend">'+heights.map(h=>'<i style="height:'+h+'px"></i>').join("")+'</div><div class="kpi-mini-ring" style="--ring-val:'+ringValue(card,label)+'"><span>'+Math.round(ringValue(card,label))+'</span></div>';
    card.appendChild(footer);

    const route=routeFor(label);
    if(route){
      card.classList.add("kpi-clickable");
      card.setAttribute("role","button");
      card.setAttribute("tabindex","0");
      card.setAttribute("title","Open related analysis");
      const hint=document.createElement("span");
      hint.className="kpi-click-hint";
      hint.textContent="Open analysis →";
      card.appendChild(hint);
      const open=()=>{ if(typeof window.activate==="function") window.activate(route); };
      card.addEventListener("click",e=>{
        if(e.target.closest("button,a,input,select,textarea")) return;
        open();
      });
      card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
    }
  }
  function enhanceAll(root=document){
    root.querySelectorAll(".card").forEach(card=>{
      if(card.closest('#view-overview')) return;
      try{ enhanceCard(card); }
      catch(err){ console.warn("KPI card enhancement failed, continuing with remaining cards", err); }
    });
    // Force style recalculation after a dataset renderer replaces KPI markup.
    root.querySelectorAll(".enhanced-kpi").forEach((card,i)=>{
      if(card.closest('#view-overview')) return;
      const palettes=[["#1976D2","#64B5F6"],["#00897B","#4DB6AC"],["#7B1FA2","#BA68C8"],["#EF6C00","#FFB74D"],["#C62828","#EF5350"],["#3949AB","#7986CB"],["#2E7D32","#66BB6A"],["#AD1457","#EC407A"]];
      const p=palettes[i%palettes.length];
      card.style.setProperty("--kpi-accent",p[0],"important");
      card.style.setProperty("--kpi-accent-2",p[1],"important");
      // Paint the visual properties directly. This avoids browser/CSS-variable
      // fallback to monochrome when Excel refresh replaces the KPI DOM.
      const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;};
      card.style.borderColor=rgba(p[0],.34);
      card.style.borderLeft=`4px solid ${p[0]}`;
      card.style.background=`radial-gradient(circle at 92% 12%, ${rgba(p[0],.16)} 0 18%, transparent 19%), linear-gradient(145deg,#ffffff 0%,${rgba(p[0],.10)} 100%)`;
      const icon=card.querySelector('.kpi-icon-wrap');
      if(icon){icon.style.background=`linear-gradient(135deg,${p[1]},${p[0]})`;icon.style.color='#fff';}
      const pill=card.querySelector('.kpi-status-pill');
      if(pill){pill.style.background=rgba(p[0],.10);pill.style.color=p[0];pill.style.borderColor=rgba(p[0],.25);}
      card.querySelectorAll('.kpi-sparkline i').forEach(bar=>bar.style.background=`linear-gradient(180deg,${p[1]},${p[0]})`);
      const ring=card.querySelector('.kpi-mini-ring');
      if(ring){const rv=ring.style.getPropertyValue('--ring-val')||'65';ring.style.background=`conic-gradient(${p[0]} calc(${rv} * 1%), #e6edf0 0)`;const txt=ring.querySelector('span');if(txt)txt.style.color=p[0];}
    });
  }

  function boot(){
    enhanceAll();
    const main=document.getElementById("main")||document.body;
    let queued=false;
    const observer=new window.__APMSafeMutationObserver(()=>{
      if(queued) return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;enhanceAll(main);});
    });
    observer.observe(main,{childList:true,subtree:true,characterData:true});
    window.enhanceAllKPIs=enhanceAll;
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
