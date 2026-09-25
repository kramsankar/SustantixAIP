
(function(){
 const CLASS_DEFAULTS={Inverter:'Enterprise default',Transformer:'Transformer reliability',Tracker:'Tracker motion',Combiner:'DC collection',Meter:'Metering quality',Weather:'Sensor quality'};
 function framework(){return window.AIPHealthModel?.get?.()||window.AIP_HEALTH_MODEL_DEFAULTS||{};}
 function assets(){
  const rows=[];
  const add=a=>{if(Array.isArray(a)&&a.length)rows.push(...a)};
  try{if(typeof APM_IMPORTED_DATA!=='undefined')add(APM_IMPORTED_DATA['Asset Master'])}catch(_){}
  try{if(typeof EMBEDDED_EXCEL_DATA!=='undefined')add(EMBEDDED_EXCEL_DATA['Asset Master'])}catch(_){}
  try{if(typeof EXCEL_DATA!=='undefined')add(EXCEL_DATA?.['Asset Master'])}catch(_){}
  try{if(typeof WORKBOOK_DATA!=='undefined')add(WORKBOOK_DATA?.['Asset Master'])}catch(_){}
  try{if(typeof ACTIVE_DATASET!=='undefined')add(ACTIVE_DATASET?.['Asset Master'])}catch(_){}
  try{if(typeof ASSET_REGISTRY!=='undefined')add(ASSET_REGISTRY)}catch(_){}
  try{if(typeof ASSETS!=='undefined')add(ASSETS)}catch(_){}
  try{add(window.APM_IMPORTED_DATA?.['Asset Master'])}catch(_){}
  try{add(window.EMBEDDED_EXCEL_DATA?.['Asset Master'])}catch(_){}
  try{add(window.ASSET_REGISTRY)}catch(_){}
  try{add(window.ASSETS)}catch(_){}
  const seen=new Set(),out=[];
  for(const r of rows){
    if(!r||typeof r!=='object')continue;
    const id=val(r,'Asset_ID','assetId','Asset_Tag','assetTag','tag','id');
    if(!id)continue;
    const k=String(id).trim().toLowerCase();
    if(seen.has(k))continue;
    seen.add(k);out.push(r);
  }
  return out;
 }
 function val(r,...ks){for(const k of ks)if(r&&r[k]!=null&&r[k]!=='')return r[k];return ''}
 function key(r){return val(r,'Asset_ID','assetId','Asset_Tag','assetTag','tag')}
 function label(r){return val(r,'Asset_Tag','assetTag','tag','Asset_ID','assetId')}
 function add(){
  const root=document.getElementById('view-assethealthmodel'); if(!root||root.querySelector('.ahsf-extra'))return;
  const grid=root.querySelector('.ahm-grid'); if(!grid)return;
  const m=framework(), rows=assets();
  const wrap=document.createElement('div');wrap.className='ahsf-extra';
  wrap.innerHTML=`<section class="ahm-card"><h3>Asset-class models</h3><p>Assign a governed scoring profile by equipment class.</p><table class="ahsf-table"><thead><tr><th>Asset class</th><th>Active profile</th></tr></thead><tbody>${Object.entries(CLASS_DEFAULTS).map(([c,p])=>`<tr><td>${c}</td><td><select class="ahsf-select ahsf-class" data-class="${c}"><option>${p}</option><option>Enterprise default</option><option>Custom governed profile</option></select></td></tr>`).join('')}</tbody></table></section>
  <section class="ahm-card"><h3>Version & governance</h3><p>Control activation and preserve an auditable model history.</p><table class="ahsf-table"><tr><th>Active version</th><td><b>${m.calcRevision||1}</b></td></tr><tr><th>Status</th><td><span class="ahsf-chip">ACTIVE</span></td></tr><tr><th>Effective date</th><td>${m.lastRecalculated?new Date(m.lastRecalculated).toLocaleDateString():'Current baseline'}</td></tr><tr><th>Approval</th><td>Governed administrator</td></tr><tr><th>Weight validation</th><td>${Object.values(m.weights||{}).reduce((a,b)=>a+Number(b||0),0).toFixed(0)}%</td></tr></table><div class="ahsf-actions"><button class="ahm-btn secondary" id="ahsfHistory">View change history</button><button class="ahm-btn secondary" id="ahsfExport">Export configuration</button></div><div class="ahsf-note" id="ahsfGovMsg"></div></section>
  <section class="ahm-card ahsf-test-card"><h3>Test & explain</h3><p>Select an asset and audit the exact parameters used to calculate its score.</p>
  <div class="ahsf-picker" id="ahsfPicker">
    <input type="text" id="ahsfAssetSearch" class="ahsf-search-input" placeholder="Search asset ID, tag, class, site or OEM" autocomplete="off" spellcheck="false">
    <button type="button" id="ahsfAssetToggle" class="ahsf-search-toggle" aria-label="Open asset list">▾</button>
    <div id="ahsfAssetMenu" class="ahsf-search-menu" hidden></div>
  </div>
  <div id="ahsfResult" class="ahsf-result">${rows.length?'':'No governed assets are available in the active dataset.'}</div>
 </section>`;
  grid.appendChild(wrap);
  const assetSearch=root.querySelector('#ahsfAssetSearch');
  const assetToggle=root.querySelector('#ahsfAssetToggle');
  const assetMenu=root.querySelector('#ahsfAssetMenu');
  const resultBox=root.querySelector('#ahsfResult');
  const htmlEsc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const searchText=r=>[
    val(r,'Asset_ID','assetId'),
    val(r,'Asset_Tag','assetTag','tag'),
    val(r,'Asset_Class','assetClass','type'),
    val(r,'Plant_ID','plant','plantId'),
    val(r,'OEM','oem')
  ].filter(Boolean).join(' ').toLowerCase();

  function closeMenu(){
    assetMenu.hidden=true;
    activeOptionIndex=-1;
    keyboardNavigationActive=false;
    assetPickerPointerInside=false;
    assetMenu.scrollTop=0;
    assetOptions().forEach(o=>o.classList.remove('active'));
  }
  function renderMenu(showAll=false){
    const q=String(assetSearch.value||'').trim().toLowerCase();
    const matches=rows.filter(r=>showAll||!q||searchText(r).includes(q))
      .sort((a,b)=>String(label(a)).localeCompare(String(label(b))));
    const visible=matches;
    assetMenu.innerHTML=visible.length
      ? visible.map(r=>{
          const idx=rows.indexOf(r);
          const id=val(r,'Asset_ID','assetId');
          const tag=val(r,'Asset_Tag','assetTag','tag');
          const cls=val(r,'Asset_Class','assetClass','type');
          const plant=val(r,'Plant_ID','plant','plantId');
          return `<button type="button" class="ahsf-search-option" data-row="${idx}">
            <span class="ahsf-opt-main">${htmlEsc(tag||id)}${plant?' · '+htmlEsc(plant):''}</span>
          </button>`;
        }).join('')
      : '<div class="ahsf-search-empty">No matching asset</div>';
    assetMenu.hidden=false;
    resetActiveOption();
    assetMenu.scrollTop=0;
  }

  function explainRow(r){
    if(!r){resultBox.innerHTML='';return}
    assetSearch.value=label(r);
    closeMenu();
    const a={
      assetId:val(r,'Asset_ID','assetId'),
      tag:val(r,'Asset_Tag','assetTag'),
      sourceHealth:Number(val(r,'Health_Score','Health Score','healthScore')||75),
      healthKnown:true,raw:r,status:val(r,'Operating_Status','status')
    };
    let c;try{c=window.calculateAssetHealth?window.calculateAssetHealth(a):calculateAssetHealth(a)}catch(e){c=null}
    if(!c){resultBox.innerHTML='<div class="ahsf-empty-result">Calculation evidence is not available for this record.</div>';return}
    const names={
      performance:'Performance',
      electrical:'Electrical / thermal',
      alarms:'Alarms / events',
      predictive:'Predictive condition',
      maintenance:'Maintenance / work orders',
      inspection:'Inspection / AI Vision'
    };
    resultBox.innerHTML=`<div class="ahsf-score-summary">
      <span class="ahsf-neutral-chip"><span>Asset Health Score</span><b>${c.score.toFixed(1)}%</b></span>
      <span class="ahsf-neutral-chip"><span>Status</span><b>${String(c.band).toUpperCase()}</b></span>
      <span class="ahsf-neutral-chip"><span>Data completeness</span><b>${c.dataCompleteness}%</b></span>
    </div>
    <table class="ahsf-table ahsf-explain-table">
      <thead><tr><th>Parameter</th><th>Score</th><th>Weight</th><th>Contribution</th></tr></thead>
      <tbody>${Object.keys(c.components).map(k=>`<tr><td>${names[k]}</td><td>${c.components[k].toFixed(1)}</td><td>${Number(c.weights[k]).toFixed(0)}%</td><td>${(c.components[k]*c.weights[k]/100).toFixed(1)}</td></tr>`).join('')}</tbody>
    </table>`;
  }

  let activeOptionIndex=-1;
  let assetPickerPointerInside=false;
  function assetOptions(){return [...assetMenu.querySelectorAll('.ahsf-search-option')]}
  function resetActiveOption(){
    activeOptionIndex=-1;
    assetOptions().forEach(o=>o.classList.remove('active'));
  }
  function setActiveOption(next,ensureVisible=true){
    const opts=assetOptions();
    if(!opts.length){activeOptionIndex=-1;return}
    activeOptionIndex=Math.max(0,Math.min(next,opts.length-1));
    opts.forEach((o,i)=>o.classList.toggle('active',i===activeOptionIndex));
    if(ensureVisible){
      try{opts[activeOptionIndex].scrollIntoView({block:'nearest'})}catch(_){}
    }
  }
  function selectOption(option){
    if(!option)return;
    const r=rows[Number(option.dataset.row)];
    if(r)explainRow(r);
    resetActiveOption();
  }
  function pickerOwnsKeyboard(){
    const picker=root.querySelector('#ahsfPicker');
    return !assetMenu.hidden && !!picker && (picker.contains(document.activeElement)||assetPickerPointerInside);
  }
  function pickerKey(e){
    if(!['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)||!pickerOwnsKeyboard())return;
    e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
    const opts=assetOptions();
    if(e.key==='Escape'){closeMenu();try{assetSearch.focus({preventScroll:true})}catch(_){assetSearch.focus()}return}
    if(!opts.length)return;
    if(e.key==='ArrowDown'){setActiveOption(activeOptionIndex<0?0:activeOptionIndex+1);return}
    if(e.key==='ArrowUp'){setActiveOption(activeOptionIndex<0?opts.length-1:activeOptionIndex-1);return}
    if(e.key==='Enter'){selectOption(opts[activeOptionIndex>=0?activeOptionIndex:0]);return}
  }

  assetSearch.addEventListener('focus',()=>{if(assetMenu.hidden)renderMenu(false)});
  assetSearch.addEventListener('input',()=>{resultBox.innerHTML='';renderMenu(false)});
  assetToggle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation()});
  assetToggle.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(assetMenu.hidden){renderMenu(true);try{assetSearch.focus({preventScroll:true})}catch(_){assetSearch.focus()}}
    else closeMenu();
  });

  assetMenu.addEventListener('pointerenter',()=>{assetPickerPointerInside=true});
  assetMenu.addEventListener('pointerleave',()=>{assetPickerPointerInside=false});
  assetMenu.addEventListener('mousemove',e=>{
    assetPickerPointerInside=true;
    const option=e.target.closest('.ahsf-search-option');
    if(!option)return;
    const idx=assetOptions().indexOf(option);
    if(idx>=0)setActiveOption(idx,false);
  });
  assetMenu.addEventListener('pointerdown',e=>{
    const option=e.target.closest('.ahsf-search-option');
    if(!option)return;
    e.preventDefault();e.stopPropagation();
    selectOption(option);
  });
  assetMenu.addEventListener('wheel',e=>{
    if(assetMenu.hidden)return;
    assetPickerPointerInside=true;
    e.stopPropagation();
  },{passive:true});

  window.addEventListener('keydown',pickerKey,true);
  document.addEventListener('pointerdown',e=>{
    const picker=root.querySelector('#ahsfPicker');
    if(picker && !picker.contains(e.target))closeMenu();
  },true);

  root.querySelector('#ahsfHistory').onclick=()=>{root.querySelector('#ahsfGovMsg').textContent='Active version '+(m.calcRevision||1)+' · last recalculated '+(m.lastRecalculated?new Date(m.lastRecalculated).toLocaleString():'baseline')+'.';};
  root.querySelector('#ahsfExport').onclick=()=>{const blob=new Blob([JSON.stringify(framework(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='asset-health-scoring-framework.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
  root.querySelectorAll('.ahsf-class').forEach(x=>x.onchange=()=>localStorage.setItem('aip_health_class_'+x.dataset.class,x.value));
  root.querySelectorAll('.ahsf-class').forEach(x=>{const v=localStorage.getItem('aip_health_class_'+x.dataset.class);if(v)[...x.options].some(o=>{if(o.text===v){x.value=v;return true}})});
 }
 const old=window.renderAssetHealthModel;if(old)window.renderAssetHealthModel=function(){old();setTimeout(add,0)};
 document.addEventListener('click',e=>{if(e.target.closest('[data-view="assethealthmodel"]'))setTimeout(add,50)},true);
 document.addEventListener('DOMContentLoaded',()=>setTimeout(add,700));
})();
