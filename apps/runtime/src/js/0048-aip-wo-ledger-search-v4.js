
(function(){
  'use strict';
  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function norm(v){return String(v??'').toLowerCase().replace(/\s+/g,' ').trim();}
  let searchTimer=0;

  window.aipApplyWoLedgerSearch=function(value,immediate){
    const input=document.getElementById('aipWoLedgerSearch');
    const q=norm(value!=null?value:(input?.value||''));
    if(input && input.value!==String(value??'')) input.value=String(value??'');
    OPS_WO.search=String(value??'');
    clearTimeout(searchTimer);
    const run=function(){
      const body=document.querySelector('#aipWoLedgerTable tbody');
      if(!body)return;
      let shown=0,total=0;
      body.querySelectorAll('tr[data-wo-search]').forEach(function(row){
        total++;
        const visible=!q || norm(row.dataset.woSearch).includes(q);
        row.classList.toggle('aip-wo-search-hidden',!visible);
        if(visible)shown++;
      });
      const count=document.getElementById('aipWoLedgerMatchCount');
      if(count)count.textContent=shown+' of '+total+' work orders';
      const clear=document.getElementById('aipWoLedgerClear');
      if(clear)clear.hidden=!q;
    };
    if(immediate)run(); else searchTimer=setTimeout(run,120);
  };

  window.aipClearWoLedgerSearch=function(){
    clearTimeout(searchTimer);
    OPS_WO.search='';
    const input=document.getElementById('aipWoLedgerSearch');
    if(input){input.value='';input.focus({preventScroll:true});}
    aipApplyWoLedgerSearch('',true);
  };

  window.aipWoLedgerSearchKey=function(event){
    if(event.key==='Escape'){
      event.preventDefault();
      aipClearWoLedgerSearch();
    }
  };

  window.opsWOLedger=function(rows){
    const selected=window.AIP_WO_CREATE_SOURCE;
    const searchValue=OPS_WO.search||'';
    return `<div class="ops-panel"><div class="ops-toolbar">
      <div id="aipWoLedgerSearchWrap">
        <input id="aipWoLedgerSearch" type="search" autocomplete="off" spellcheck="false" placeholder="Search WO, asset, site, type or status" value="${esc(searchValue)}" oninput="aipApplyWoLedgerSearch(this.value,false)" onsearch="aipApplyWoLedgerSearch(this.value,true)" onkeydown="aipWoLedgerSearchKey(event)">
        <button id="aipWoLedgerClear" type="button" class="btn" ${searchValue?'':'hidden'} onclick="aipClearWoLedgerSearch()" aria-label="Clear work-order search">Clear</button>
        <span id="aipWoLedgerMatchCount" aria-live="polite">${rows.length} work orders</span>
      </div>
      <select onchange="OPS_WO.filter=this.value;OPS_WO.search='';renderWorkOrderIntelligence()"><option>All</option>${['Draft','Awaiting Approval','Approved','Ready to Schedule','Scheduled','In Progress','Completed','Closed'].map(x=>`<option ${OPS_WO.filter===x?'selected':''}>${x}</option>`).join('')}</select>
      <button id="aipCreateWoButton" class="btn primary" ${selected?'':'disabled'} onclick="opsCreateWO()">${selected?'Create Work Order from '+esc(selected):'Select a Row to Create Work Order'}</button>
    </div>
    <div id="aipWoSelectionNote" class="aip-wo-selection-note">${selected?'Selected source: '+esc(selected)+'. Click Create Work Order to generate a new draft.':'Select exactly one source row below. The new draft will inherit that row’s plant, asset, type, priority, evidence and business context.'}</div>
    <div class="ops-table-wrap" style="margin-top:10px"><table id="aipWoLedgerTable" class="ops-table"><thead><tr><th class="aip-wo-source-cell">Select</th><th>WO ID</th><th>Site / Asset</th><th>Type</th><th>Priority</th><th>Status</th><th>Crew</th><th>Parts</th><th>Permit</th><th>Loss</th><th>Cost</th><th>ERP</th><th>Action</th></tr></thead><tbody>${rows.map(w=>{const hay=esc([w.id,w.plant,w.asset,w.type,w.priority,w.status,w.crew,w.parts,w.permit,w.erp,w.desc].join(' ').toLowerCase());return `<tr data-wo-search="${hay}" class="${selected===w.id?'aip-wo-selected-row':''}" onclick="aipSelectWoSource('${esc(w.id)}')"><td class="aip-wo-source-cell"><input class="aip-wo-source-radio" type="radio" name="aipWoCreateSource" value="${esc(w.id)}" ${selected===w.id?'checked':''} onclick="event.stopPropagation();aipSelectWoSource('${esc(w.id)}')" aria-label="Select ${esc(w.id)} as source"></td><td class="ops-link" onclick="event.stopPropagation();opsOpenWO('${esc(w.id)}')">${esc(w.id)}</td><td>${esc(w.plant)}<br><b>${esc(w.asset)}</b></td><td>${esc(w.type)}</td><td><span class="ops-status ${opsPriority(w.priority)}">${esc(w.priority)}</span></td><td><span class="ops-status info">${esc(w.status)}</span></td><td>${esc(w.crew||'Unassigned')}</td><td>${esc(w.parts)}</td><td>${esc(w.permit)}</td><td>${Number(w.loss||0)} MWh</td><td>₹${Number(w.cost||0).toLocaleString('en-IN')}</td><td>${esc(w.erp)}</td><td><button class="ops-action primary" onclick="event.stopPropagation();opsOpenWO('${esc(w.id)}')">Open</button></td></tr>`}).join('')}</tbody></table></div></div>`;
  };

  document.addEventListener('input',function(e){
    if(e.target?.id==='aipWoLedgerSearch') return;
  },true);
})();
