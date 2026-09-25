
(function(){
'use strict';
window.AIP_CURRENT_BUILD='v87_855';
const STATUS={
'ENG-INV-COOL-001':'Approved','ENG-INV-GRID-001':'Approved','ENG-TRF-INS-001':'Approved','ENG-TRF-COOL-001':'Approved','ENG-TRK-POS-001':'Approved','ENG-TRK-DRV-001':'Approved','ENG-INV-THRM-001':'Approved','ENG-TRK-ALIGN-001':'Under Review','ENG-DC-THERM-001':'Approved','ENG-PV-CRACK-001':'Under Review','ENG-PV-SOIL-001':'Approved','ENG-PV-VEG-001':'Under Review','ENG-DC-CABLE-001':'Approved','ENG-SITE-WATER-001':'Draft','ENG-SWG-FIRE-001':'Approved','ENG-PV-MCRK-001':'Draft','ENG-PV-JBOX-001':'Approved','ENG-PV-BIRD-001':'Superseded'};
function applyPool(p){if(!Array.isArray(p))return;p.forEach(m=>{if(m&&STATUS[m.Model_ID])m.Status=STATUS[m.Model_ID]})}
function applyAll(){
 try{applyPool(window.AIP_ENG_V831?.registry)}catch(_){}
 try{applyPool(window.EMBEDDED_EXCEL_DATA?.['Engineering Model Registry'])}catch(_){}
 try{applyPool(window.APM_IMPORTED_DATA?.['Engineering Model Registry'])}catch(_){}
 try{applyPool(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData?.['Engineering Model Registry'])}catch(_){}
 try{applyPool(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.engineeringKnowledge?.['Engineering Model Registry'])}catch(_){}
}
function cls(s){s=String(s||'');return s==='Approved'?'approved':s==='Under Review'?'review':s==='Draft'?'draft':'superseded'}
function note(s){
 if(s==='Approved')return 'Approved for governed CBM Engineering / Physics Fit under the current engineering revision.';
 if(s==='Under Review')return 'Under Review · technical model checks may be inspected, but the result is provisional and not governance-ready until approval.';
 if(s==='Draft')return 'Draft · not eligible to produce a governed CBM Engineering / Physics Fit until engineering approval.';
 return 'Superseded · retained for engineering audit/history only; not eligible for new governed CBM use.';
}
function decorate(){
 applyAll();
 const pane=document.querySelector('#view-assetrelationships [data-ar-pane="engineering"]');if(!pane)return;
 const selected=String(window.AIP_ENG_SELECTED_MODEL||'');const st=STATUS[selected]||'Approved';
 const badge=pane.querySelector('.aip831-model-badge');if(badge){badge.textContent='Model Status · '+st;badge.classList.remove('aip853-approved','aip853-review','aip853-draft','aip853-superseded');badge.classList.add('aip853-'+cls(st))}
 const head=pane.querySelector('.aip831-model-head');if(head&&selected){let n=head.nextElementSibling;if(!n?.classList?.contains('aip853-status-note')){n=document.createElement('div');head.insertAdjacentElement('afterend',n)}n.className='aip853-status-note '+cls(st);n.textContent=note(st)}
 pane.querySelectorAll('.aip831-model-row').forEach(r=>{const id=(r.querySelector('b')?.textContent||'').split('·')[0].trim();const s=STATUS[id]||'Approved';let chip=r.querySelector('.aip853-list-status');if(!chip){chip=document.createElement('i');r.appendChild(chip)}chip.className='aip853-list-status '+cls(s);chip.textContent=s});
}
applyAll();
const priorRender=window.renderAIP831Engineering;if(typeof priorRender==='function')window.renderAIP831Engineering=function(){applyAll();const r=priorRender.apply(this,arguments);decorate();requestAnimationFrame(decorate);return r};
const priorFit=window.aip831PhysicsFitBox;
if(typeof priorFit==='function')window.aip831PhysicsFitBox=function(a){
 const mid=String(a?.Engineering_Model_ID||'');const st=STATUS[mid]||'Approved';
 if(st==='Approved')return priorFit.apply(this,arguments);
 if(st==='Under Review'){
   let h=priorFit.apply(this,arguments);h=h.replace('cbm830-evidence-box cbm831-fit-box','cbm830-evidence-box cbm831-fit-box aip853-fit-review');h=h.replace(' · Basis ▾',' · PROVISIONAL · Under Review · Basis ▾');return h;
 }
 const label=st==='Draft'?'Draft · approval required':'Superseded · historical only';
 return `<div class="cbm830-evidence-box cbm831-fit-box aip853-fit-na"><button class="cbm831-fit-toggle" type="button" onclick="this.nextElementSibling.classList.toggle('open')"><span>Engineering / physics fit</span><b>N/A</b><small>${label} · Basis ▾</small></button><div class="cbm831-fit-basis"><div class="cbm831-model-line"><b>Model governance:</b> ${st}. No governed Engineering / Physics Fit is permitted for this assessment.</div><div class="cbm831-fit-actions"><button type="button" onclick="aip831OpenEngineeringModel('${mid}','${String(a?.CBM_Assessment_ID||'')}')">Open engineering model</button></div></div></div>`;
};
document.addEventListener('click',e=>{if(e.target.closest?.('#view-assetrelationships [data-ar-tab="engineering"],#view-assetrelationships .aip831-model-row'))setTimeout(decorate,20)},true);
window.addEventListener('aip:data-source-changed',()=>setTimeout(()=>{applyAll();decorate()},80));setTimeout(decorate,120);
window.AIP_V853_AUDIT={release:'v87_856',baseline:'v87_855',businessDataChanged:true,changes:['Engineering Model Registry status mix changed from 18 Approved to 12 Approved, 3 Under Review, 2 Draft, 1 Superseded in Excel and Synthetic data','Model Status badge is read-only and status-colored','Under Review CBM Physics Fit is explicitly provisional','Draft and Superseded models return N/A for governed CBM Physics Fit','Non-approved model status is visible in the Engineering Models list and detail pane']};
})();
