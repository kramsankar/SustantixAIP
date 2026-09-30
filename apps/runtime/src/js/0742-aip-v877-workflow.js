(function(){
'use strict';
var KEY='AIP_v877_Twin_Findings_v1';
var DRAFT_KEY='AIP_v877_Twin_Process_Drafts_v1';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function read(){try{var d=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(d)?d:[]}catch(_){return []}}
function save(a){try{localStorage.setItem(KEY,JSON.stringify(a));return true}catch(_){return false}}
function drafts(){try{var x=JSON.parse(localStorage.getItem(DRAFT_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return []}}
function putDraft(x){var a=drafts(),old=a.find(function(r){return r.Draft_ID===x.Draft_ID});if(old)Object.assign(old,x);else a.push(x);try{localStorage.setItem(DRAFT_KEY,JSON.stringify(a));return true}catch(_){return false}}
function id(m,o){return 'TWIN-'+m.id+'-'+o.id}
function valid(s){return String(s||'').trim().length>0}
function merge(m){
  var rows=read(),by={};rows.forEach(function(r){by[r.Finding_ID]=r});
  m.A.inverters.forEach(function(o){var k=id(m,o),r=by[k],active=o.flag==='underperforming'||o.flag==='data';
    if(!r&&!active)return;
    if(!r){r={Finding_ID:k,Plant_ID:m.id,Asset_ID:o.id,Asset_Tag:o.tag,First_Seen:m.date,Last_Seen:m.date,Status:'New',Owner:'',RCA_ID:'',Work_Order_ID:'',Closure_Evidence:'',History:[]};rows.push(r);by[k]=r}
    r.Last_Seen=m.date;r.Current_Condition=o.flag;r.Probable_Cause=o.primary||'Unclassified';r.Lost_MWh=o.lost;r.Lost_INR=Number.isFinite(o.value)?o.value:null;r.Data_Coverage_Pct=o.coveragePct;r.Model_Version=window.AIPInverterTwin.version;
    r.Evidence=o.evidence.join('; ');r.Evidence_Interval_Start=o.iv.length?o.iv[0].t.date+' '+String(Math.floor(o.iv[0].t.minute/60)).padStart(2,'0')+':'+String(o.iv[0].t.minute%60).padStart(2,'0'):'';
    r.Evidence_Interval_End=o.iv.length?o.iv[o.iv.length-1].t.date+' '+String(Math.floor(o.iv[o.iv.length-1].t.minute/60)).padStart(2,'0')+':'+String(o.iv[o.iv.length-1].t.minute%60).padStart(2,'0'):'';
    r.Recovery_Performance_Index_Pct=Number.isFinite(o.pi)?o.pi*100:null;
    if(r.Status==='Closed'&&active)r.Status='Reopened';
    if(r.Status==='Resolved pending verification'&&!active&&o.coveragePct>=95&&o.pi>=0.985){r.Status='Ready for closure';r.Recovery_Check='Pass: PI ≥ 98.5%, coverage ≥ 95%';}
  });
  save(rows);return rows.filter(function(r){return r.Plant_ID===m.id});
}
function update(fid,fields,action){var rows=read(),r=rows.find(function(x){return x.Finding_ID===fid});if(!r)return false;
  Object.assign(r,fields);r.History=r.History||[];r.History.push({at:new Date().toISOString(),action:action,owner:r.Owner,status:r.Status});var ok=save(rows);if(ok)renderLinks();return ok}
function download(rows,name){var text=JSON.stringify(rows,null,2),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
function panel(m){var rows=merge(m);var list=rows.filter(function(r){return r.Status!=='Closed'||r.Current_Condition!=='ok'});
  return '<div class="grid g4 aip-maintenance-master-kpis t872-kpis"><div class="aip-kpi-master"><b>'+list.length+'</b><span>Tracked findings</span></div><div class="aip-kpi-master"><b>'+list.filter(function(r){return valid(r.Owner)}).length+'</b><span>Owned</span></div><div class="aip-kpi-master"><b>'+list.filter(function(r){return valid(r.RCA_ID)}).length+'</b><span>RCA linked</span></div><div class="aip-kpi-master"><b>'+list.filter(function(r){return valid(r.Work_Order_ID)}).length+'</b><span>WO linked</span></div></div><!--/kpis-->'+
  '<section class="ot297-card"><h3>Finding actions — '+esc(m.name)+'</h3><p class="t872-subline">Local review register. Records persist in this browser; export JSON to retain or transfer them. Linking an RCA or work order here records its ID; it does not create or update an external EAM record.</p><button id="t877Export" type="button" class="t874-btn">Export finding register</button>'+
  (list.length?list.map(function(r){var fid=esc(r.Finding_ID),active=r.Current_Condition!=='ok',recovered=!active&&r.Data_Coverage_Pct>=95&&r.Recovery_Performance_Index_Pct>=98.5;
    return '<div class="t877-case" data-finding="'+fid+'" style="border:1px solid #dce6eb;border-radius:8px;padding:12px;margin:10px 0"><b>'+esc(r.Asset_Tag)+'</b> <small>'+fid+' · '+esc(r.Status)+' · '+esc(r.Current_Condition)+'</small><p>'+esc(r.Probable_Cause)+' · '+(Number.isFinite(r.Lost_MWh)?r.Lost_MWh.toFixed(3):'—')+' MWh · coverage '+(Number.isFinite(r.Data_Coverage_Pct)?r.Data_Coverage_Pct.toFixed(1):'—')+'% · last seen '+esc(r.Last_Seen)+'</p><p>Evidence: '+esc(r.Evidence||'none supplied')+'</p><div style="display:flex;gap:8px;flex-wrap:wrap"><label>Owner <input data-f="Owner" value="'+esc(r.Owner)+'"></label><label>RCA ID <input data-f="RCA_ID" value="'+esc(r.RCA_ID)+'"></label><label>Work order ID <input data-f="Work_Order_ID" value="'+esc(r.Work_Order_ID)+'"></label><label>Closure evidence <input data-f="Closure_Evidence" value="'+esc(r.Closure_Evidence)+'"></label></div><p>Recovery: '+(recovered?'PI and data coverage meet thresholds':'Awaiting clean operating evidence')+'</p><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="t874-btn" data-action="assign">Save links</button><button type="button" class="t874-btn" data-action="rca">Create RCA draft</button><button type="button" class="t874-btn" data-action="wo">Create WO draft</button><button type="button" class="t874-btn" data-action="investigate">Start investigation</button><button type="button" class="t874-btn" data-action="resolve">Mark repair complete</button><button type="button" class="t874-btn" data-action="close" '+(!recovered?'disabled':'')+'>Close with recovery evidence</button></div></div>'}).join(''):'<div class="t872-note">No tracked findings at this site.</div>')+'</section>';
}
function bind(body,m){var ex=body.querySelector('#t877Export');if(ex)ex.onclick=function(){download({findings:read(),processDrafts:drafts()},'AIP_Twin_Workflow_'+m.id+'.json')};
  body.querySelectorAll('.t877-case').forEach(function(box){box.querySelectorAll('[data-action]').forEach(function(button){button.onclick=function(){var a=button.dataset.action,fid=box.dataset.finding,fields={};box.querySelectorAll('[data-f]').forEach(function(input){fields[input.dataset.f]=input.value.trim()});
      if(!valid(fields.Owner)){alert('Assign an owner first.');return}if(a==='investigate'){if(!valid(fields.RCA_ID)){alert('Enter the RCA case ID.');return}fields.Status='Investigating'}
      if(a==='rca'||a==='wo'){var original=read().find(function(x){return x.Finding_ID===fid});if(!original)return;
        var field=a==='rca'?'RCA_ID':'Work_Order_ID',kind=a==='rca'?'RCA':'WO';if(valid(original[field])&&!/^RCA-DRAFT-|^WO-DRAFT-/.test(original[field])){alert('This finding already references an external '+kind+' ID.');return}var draftId=original[field]||kind+'-DRAFT-'+fid;
        if(!putDraft({Draft_ID:draftId,Type:kind,Finding_ID:fid,Plant_ID:original.Plant_ID,Asset_ID:original.Asset_ID,Owner:fields.Owner,Probable_Cause:original.Probable_Cause,Evidence:original.Evidence,Lost_MWh:original.Lost_MWh,Source_Model:original.Model_Version,Status:'Draft — local review only',Created_At:new Date().toISOString()})){alert('Could not save the draft.');return}
        fields[field]=draftId;fields.Status=a==='rca'?'Investigating':'Action proposed';}
      if(a==='resolve'){if(!valid(fields.Work_Order_ID)){alert('Enter the work order ID.');return}fields.Status='Resolved pending verification'}
      if(a==='close'){if(!valid(fields.RCA_ID)||!valid(fields.Work_Order_ID)||!valid(fields.Closure_Evidence)){alert('RCA ID, work order ID, and closure evidence are required.');return}var r=read().find(function(x){return x.Finding_ID===fid});if(!r||r.Current_Condition!=='ok'||r.Data_Coverage_Pct<95||r.Recovery_Performance_Index_Pct<98.5){alert('Current inverter evidence does not verify recovery.');return}fields.Status='Closed'}
      if(update(fid,fields,a)&&window.AIP_INV874)window.AIP_INV874.render();else alert('Could not save the local finding register.');
    }})});
}
window.AIPWorkflow877={panel:panel,bind:bind,merge:merge,read:read};
function renderLinks(){
  [['rootcause','RCA_ID','Twin findings linked to RCA cases'],['workorderintelligence','Work_Order_ID','Twin findings linked to work orders']].forEach(function(pair){
    var root=document.getElementById('view-'+pair[0]);if(!root||!root.classList.contains('active'))return;
    var rows=read().filter(function(r){return pair[1]==='Finding_ID'||valid(r[pair[1]])});if(!rows.length)return;
    var digest=JSON.stringify(rows.map(function(r){return [r.Finding_ID,r.Status,r[pair[1]],r.RCA_ID,r.Work_Order_ID]}));
    var old=root.querySelector('.t877-process-links');if(old&&old.dataset.digest===digest)return;if(old)old.remove();
    var box=document.createElement('section');box.className='t877-process-links';box.style.cssText='background:#f5fafb;border:1px solid #cfe2e8;border-radius:8px;padding:12px;margin:12px 0;font:11px/1.5 Arial,sans-serif;color:#173f52';
    box.dataset.digest=digest;
    box.innerHTML='<b>'+esc(pair[2])+' · '+rows.length+'</b><div style="max-height:200px;overflow:auto">'+rows.map(function(r){return '<div style="border-top:1px solid #dce8ed;padding:5px 0">'+esc(r.Finding_ID)+' · '+esc(r.Asset_Tag)+' · '+esc(r.Status)+' · '+(pair[1]==='Finding_ID'?'RCA '+esc(r.RCA_ID||'unlinked')+' · WO '+esc(r.Work_Order_ID||'unlinked'):esc(r[pair[1]]))+'</div>'}).join('')+'</div><small>Local twin workflow register. Drafts are held in this browser for review; external EAM sync is not configured.</small>';
    var head=root.querySelector('.view-head,.xi-head');if(head&&head.nextSibling)root.insertBefore(box,head.nextSibling);else root.insertBefore(box,root.firstChild);
  });
}
document.addEventListener('click',function(){setTimeout(renderLinks,120)},true);
setInterval(renderLinks,1800);
})();
