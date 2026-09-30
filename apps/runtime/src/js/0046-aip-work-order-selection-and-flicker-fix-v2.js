
(function(){
  'use strict';
  window.AIP_WO_CREATE_SOURCE=window.AIP_WO_CREATE_SOURCE||null;

  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}

  window.aipSelectWoSource=function(id){
    window.AIP_WO_CREATE_SOURCE=id;
    document.querySelectorAll('#view-workorderintelligence .ops-table tbody tr').forEach(tr=>tr.classList.remove('aip-wo-selected-row'));
    const radio=document.querySelector(`input.aip-wo-source-radio[value="${CSS.escape(String(id))}"]`);
    if(radio){radio.checked=true;radio.closest('tr')?.classList.add('aip-wo-selected-row');}
    const btn=document.getElementById('aipCreateWoButton');
    if(btn){btn.disabled=false;btn.textContent='Create Work Order from '+id;}
    const note=document.getElementById('aipWoSelectionNote');
    if(note)note.textContent='Selected source: '+id+'. Click Create Work Order to generate a new draft using this row’s asset, site, priority and evidence context.';
  };

  const originalLedger=window.opsWOLedger;
  window.opsWOLedger=function(rows){
    const selected=window.AIP_WO_CREATE_SOURCE;
    return `<div class="ops-panel"><div class="ops-toolbar"><input placeholder="Search WO, asset or site" value="${esc(OPS_WO.search)}" oninput="OPS_WO.search=this.value;renderWorkOrderIntelligence()"><select onchange="OPS_WO.filter=this.value;renderWorkOrderIntelligence()"><option>All</option>${['Draft','Awaiting Approval','Approved','Ready to Schedule','Scheduled','In Progress','Completed','Closed'].map(x=>`<option ${OPS_WO.filter===x?'selected':''}>${x}</option>`).join('')} </select><button id="aipCreateWoButton" class="btn primary" ${selected?'':'disabled'} onclick="opsCreateWO()">${selected?'Create Work Order from '+esc(selected):'Select a Row to Create Work Order'}</button></div><div id="aipWoSelectionNote" class="aip-wo-selection-note">${selected?'Selected source: '+esc(selected)+'. Click Create Work Order to generate a new draft.':'Select exactly one source row below. The new draft will inherit that row’s plant, asset, type, priority, evidence and business context.'}</div><div class="ops-table-wrap" style="margin-top:10px"><table class="ops-table"><thead><tr><th class="aip-wo-source-cell">Select</th><th>WO ID</th><th>Site / Asset</th><th>Type</th><th>Priority</th><th>Status</th><th>Crew</th><th>Parts</th><th>Permit</th><th>Loss</th><th>Cost</th><th>ERP</th><th>Action</th></tr></thead><tbody>${rows.map(w=>`<tr class="${selected===w.id?'aip-wo-selected-row':''}" onclick="aipSelectWoSource('${esc(w.id)}')"><td class="aip-wo-source-cell"><input class="aip-wo-source-radio" type="radio" name="aipWoCreateSource" value="${esc(w.id)}" ${selected===w.id?'checked':''} onclick="event.stopPropagation();aipSelectWoSource('${esc(w.id)}')" aria-label="Select ${esc(w.id)} as source"></td><td class="ops-link" onclick="event.stopPropagation();opsOpenWO('${esc(w.id)}')">${esc(w.id)}</td><td>${esc(w.plant)}<br><b>${esc(w.asset)}</b></td><td>${esc(w.type)}</td><td><span class="ops-status ${opsPriority(w.priority)}">${esc(w.priority)}</span></td><td><span class="ops-status info">${esc(w.status)}</span></td><td>${esc(w.crew||'Unassigned')}</td><td>${esc(w.parts)}</td><td>${esc(w.permit)}</td><td>${Number(w.loss||0)} MWh</td><td>₹${Number(w.cost||0).toLocaleString('en-IN')}</td><td>${esc(w.erp)}</td><td><button class="ops-action primary" onclick="event.stopPropagation();opsOpenWO('${esc(w.id)}')">Open</button></td></tr>`).join('')}</tbody></table></div></div>`;
  };

  const originalOpen=window.opsOpenWO;
  window.opsOpenWO=function(id){
    document.body.classList.add('aip-wo-open');
    if(typeof originalOpen==='function')originalOpen(id);
    requestAnimationFrame(()=>{
      const drawer=document.getElementById('opsDetail');
      const backdrop=document.getElementById('aipWoBackdrop');
      drawer?.classList.add('open');backdrop?.classList.add('open');
      drawer?.setAttribute('role','dialog');drawer?.setAttribute('aria-modal','true');drawer?.setAttribute('aria-label','Intelligent Work Order');
      drawer?.querySelector('button,select,input,textarea')?.focus({preventScroll:true});
    });
  };
  const originalClose=window.closeAipWO;
  window.closeAipWO=function(){
    if(typeof originalClose==='function')originalClose();
    document.body.classList.remove('aip-wo-open');
  };

  // Stabilize only the short login handoff, without observing or rebuilding the entire page.
  function stabilize(){
    document.body.classList.add('aip-stabilizing');
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove('aip-stabilizing')));
  }
  document.addEventListener('DOMContentLoaded',stabilize,{once:true});
  document.addEventListener('click',e=>{if(e.target.closest('#loginBtn,.login-btn,[onclick*="login"]'))stabilize();},true);
})();
