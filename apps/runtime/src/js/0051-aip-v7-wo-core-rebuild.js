
(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const norm=v=>String(v??'').toLowerCase().replace(/\s+/g,' ').trim();
  let selectedId=window.AIP_WO_CREATE_SOURCE||null;
  let searchTimer=0;

  function rows(){try{return typeof opsWOs==='function'?opsWOs():[]}catch(_){return []}}
  function syncSelectionUI(){
    window.AIP_WO_CREATE_SOURCE=selectedId;
    document.querySelectorAll('#aipWoLedgerTable tbody tr[data-wo-id]').forEach(tr=>{
      const on=tr.dataset.woId===selectedId;
      tr.classList.toggle('aip-wo-selected-row',on);
      const radio=tr.querySelector('input[type="radio"]'); if(radio)radio.checked=on;
    });
    const btn=document.getElementById('aipCreateWoButton');
    if(btn){btn.disabled=!selectedId;btn.textContent=selectedId?'Create Work Order from '+selectedId:'Select a Row to Create Work Order'}
    const note=document.getElementById('aipWoSelectionNote');
    if(note)note.textContent=selectedId?'Selected source: '+selectedId+'. Click Create Work Order to generate a new draft.':'Select exactly one source row below.';
  }
  window.aipSelectWoSource=function(id){selectedId=id||null;syncSelectionUI()};

  function applySearch(value){
    const q=norm(value); OPS_WO.search=value||'';
    let shown=0,total=0;
    document.querySelectorAll('#aipWoLedgerTable tbody tr[data-wo-search]').forEach(tr=>{
      total++; const ok=!q||norm(tr.dataset.woSearch).includes(q); tr.hidden=!ok; if(ok)shown++;
    });
    const count=document.getElementById('aipWoLedgerMatchCount');if(count)count.textContent=shown+' of '+total+' work orders';
    const clear=document.getElementById('aipWoLedgerClear');if(clear)clear.hidden=!q;
  }
  window.aipApplyWoLedgerSearch=function(value,immediate){clearTimeout(searchTimer); if(immediate)applySearch(value); else searchTimer=setTimeout(()=>applySearch(value),80)};
  window.aipClearWoLedgerSearch=function(){clearTimeout(searchTimer);const i=document.getElementById('aipWoLedgerSearch');if(i){i.value='';i.focus({preventScroll:true})}applySearch('')};
  window.aipWoLedgerSearchKey=function(e){if(e.key==='Escape'){e.preventDefault();window.aipClearWoLedgerSearch()}};

  window.opsWOLedger=function(data){
    const searchValue=OPS_WO.search||'';
    return `<div class="ops-panel"><div class="ops-toolbar">
      <div id="aipWoLedgerSearchWrap"><input id="aipWoLedgerSearch" type="search" autocomplete="off" spellcheck="false" placeholder="Search WO, asset, site, type or status" value="${esc(searchValue)}"><button id="aipWoLedgerClear" type="button" class="btn" ${searchValue?'':'hidden'}>Clear</button><span id="aipWoLedgerMatchCount">${data.length} work orders</span></div>
      <select id="aipWoStatusFilter"><option>All</option>${['Draft','Awaiting Approval','Approved','Ready to Schedule','Scheduled','In Progress','Completed','Closed'].map(x=>`<option ${OPS_WO.filter===x?'selected':''}>${x}</option>`).join('')}</select>
      <button id="aipCreateWoButton" type="button" class="btn primary" ${selectedId?'':'disabled'}>${selectedId?'Create Work Order from '+esc(selectedId):'Select a Row to Create Work Order'}</button>
      </div><div id="aipWoSelectionNote" class="aip-wo-selection-note">${selectedId?'Selected source: '+esc(selectedId)+'. Click Create Work Order to generate a new draft.':'Select exactly one source row below.'}</div>
      <div class="ops-table-wrap" style="margin-top:10px"><table id="aipWoLedgerTable" class="ops-table"><thead><tr><th>Select</th><th>WO ID</th><th>Site / Asset</th><th>Type</th><th>Priority</th><th>Status</th><th>Crew</th><th>Parts</th><th>Permit</th><th>Loss</th><th>Cost</th><th>ERP</th><th>Action</th></tr></thead><tbody>${data.map(w=>{const hay=esc([w.id,w.plant,w.asset,w.type,w.priority,w.status,w.crew,w.parts,w.permit,w.erp,w.desc].join(' ').toLowerCase());return `<tr data-wo-id="${esc(w.id)}" data-wo-search="${hay}" class="${selectedId===w.id?'aip-wo-selected-row':''}"><td><input class="aip-wo-source-radio" type="radio" name="aipWoCreateSource" value="${esc(w.id)}" ${selectedId===w.id?'checked':''}></td><td><button type="button" class="ops-link aip-open-wo" data-open-wo="${esc(w.id)}">${esc(w.id)}</button></td><td>${esc(w.plant)}<br><b>${esc(w.asset)}</b></td><td>${esc(w.type)}</td><td><span class="ops-status ${opsPriority(w.priority)}">${esc(w.priority)}</span></td><td><span class="ops-status info">${esc(w.status)}</span></td><td>${esc(w.crew||'Unassigned')}</td><td>${esc(w.parts)}</td><td>${esc(w.permit)}</td><td>${Number(w.loss||0)} MWh</td><td>₹${Number(w.cost||0).toLocaleString('en-IN')}</td><td>${esc(w.erp)}</td><td><button type="button" class="ops-action primary aip-open-wo" data-open-wo="${esc(w.id)}">Update</button></td></tr>`}).join('')}</tbody></table></div></div>`;
  };

  const inheritedOpen=window.opsOpenWO;
  window.opsOpenWO=function(id){
    if(!id)return;
    // Call the established renderer once, then normalise the interaction layer.
    try{if(typeof inheritedOpen==='function')inheritedOpen(id)}catch(err){console.error(err)}
    setTimeout(()=>{
      const d=document.getElementById('opsDetail'); const b=document.getElementById('aipWoBackdrop');
      if(!d)return;
      document.body.appendChild(d); if(b&&b.parentNode!==document.body)document.body.insertBefore(b,d);
      d.classList.add('open'); d.style.pointerEvents='auto'; d.removeAttribute('inert'); d.setAttribute('aria-hidden','false');
      d.querySelectorAll('input,textarea,select,button').forEach(el=>{el.disabled=false;el.removeAttribute('inert');el.style.pointerEvents='auto'});
      if(b){b.classList.add('open');b.style.pointerEvents='none'}
      document.body.classList.add('aip-v7-wo-open');
    },0);
  };
  window.closeAipWO=function(){
    const d=document.getElementById('opsDetail');const b=document.getElementById('aipWoBackdrop');
    if(d){d.classList.remove('open');d.style.pointerEvents='none';d.setAttribute('aria-hidden','true')}
    if(b){b.classList.remove('open');b.style.pointerEvents='none'}
    document.body.classList.remove('aip-v7-wo-open','aip-wo-open');
  };

  window.opsCreateWO=function(){
    const sourceId=selectedId||window.AIP_WO_CREATE_SOURCE;
    if(!sourceId){toast?.('Select a work order row first');return}
    const source=rows().find(x=>x.id===sourceId);if(!source){toast?.('Selected work order is unavailable');return}
    const id='WO-'+Math.floor(7000+Math.random()*2000);
    const draft={...source,id,status:'Draft',erp:'Pending',erpId:'',crew:'Unassigned',desc:'Draft created from '+source.id+': '+(source.desc||'maintenance requirement'),sourceWorkOrderId:source.id,aipDecisionLog:[{time:new Date().toLocaleString(),actor:'AIP User',action:'Draft created',detail:'Created from '+source.id}]};
    if(Array.isArray(window.ALL_WOS))window.ALL_WOS.unshift(draft); else if(typeof ALL_WOS!=='undefined'&&Array.isArray(ALL_WOS))ALL_WOS.unshift(draft);
    selectedId=null;window.AIP_WO_CREATE_SOURCE=null;
    window.opsOpenWO(id);
  };

  // One authoritative delegated handler for the ledger and drawer.
  document.addEventListener('input',e=>{if(e.target.id==='aipWoLedgerSearch')window.aipApplyWoLedgerSearch(e.target.value,false)},false);
  document.addEventListener('keydown',e=>{if(e.target.id==='aipWoLedgerSearch')window.aipWoLedgerSearchKey(e)},false);
  document.addEventListener('change',e=>{
    if(e.target.id==='aipWoStatusFilter'){OPS_WO.filter=e.target.value;OPS_WO.search='';selectedId=null;renderWorkOrderIntelligence()}
    if(e.target.matches('.aip-wo-source-radio')){e.stopPropagation();window.aipSelectWoSource(e.target.value)}
  },false);
  document.addEventListener('click',e=>{
    const clear=e.target.closest('#aipWoLedgerClear');if(clear){e.preventDefault();return window.aipClearWoLedgerSearch()}
    const create=e.target.closest('#aipCreateWoButton');if(create){e.preventDefault();return window.opsCreateWO()}
    const open=e.target.closest('[data-open-wo]');if(open){e.preventDefault();e.stopPropagation();return window.opsOpenWO(open.dataset.openWo)}
    const tr=e.target.closest('#aipWoLedgerTable tbody tr[data-wo-id]');if(tr){e.preventDefault();return window.aipSelectWoSource(tr.dataset.woId)}
    const close=e.target.closest('#opsDetail [onclick*="closeAipWO"],#opsDetail .aip-wo-close,#opsDetail [data-close-wo]');if(close){e.preventDefault();e.stopPropagation();return window.closeAipWO()}
  },false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('opsDetail')?.classList.contains('open')&&e.target.id!=='aipWoLedgerSearch')window.closeAipWO()},false);
})();
