
(function(){
'use strict';
const labels={performance:'Performance',electrical:'Electrical / thermal',alarms:'Alarms / events',predictive:'Predictive condition',maintenance:'Maintenance history',inspection:'Inspection / AI Vision'};
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function close(){document.querySelector('.aip-condition-modal')?.remove()}
function open(data){
 close();
 const factors=Object.keys(data.components||{}).map(k=>`<div class="aip-condition-factor"><span>${esc(labels[k]||k)}</span><b>${Number(data.components[k]||0).toFixed(1)}%</b><em>${Number(data.weights?.[k]||0).toFixed(0)}% wt.</em></div>`).join('');
 const reasons=(data.overrides||[]).length?(data.overrides||[]).join(', '):'No critical override triggered.';
 const actions=(data.completedActions||[]).length?`<div class="aip-condition-actions"><b>Completed session actions:</b> ${esc(data.completedActions.join(' · '))}</div>`:'';
 const modal=document.createElement('div');modal.className='aip-condition-modal';modal.innerHTML=`<section class="aip-condition-dialog" role="dialog" aria-modal="true" aria-label="Asset Condition Assessment"><div class="aip-condition-dialog-head"><div><h3>Asset Condition Assessment</h3><p>${esc(data.assetTag||data.assetId||'Selected asset')}</p></div><button type="button" class="aip-condition-close" aria-label="Close">×</button></div><div class="aip-condition-summary"><div><span>Overall condition</span><b>${esc(data.label)}</b></div><div><span>Calculated score</span><b>${Number(data.score||0).toFixed(1)}%</b></div><div><span>Data completeness</span><b>${Number(data.completeness||0).toFixed(0)}%</b></div></div><div>${factors}</div><div class="aip-condition-reason"><strong>Assessment basis</strong>${esc(reasons)}${data.sessionAdjustment?` Session mitigation adjustment: +${Number(data.sessionAdjustment).toFixed(1)} points.`:''}</div>${actions}</section>`;
 document.body.appendChild(modal);modal.querySelector('.aip-condition-close').focus();
 modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('.aip-condition-close'))close()});
}
document.addEventListener('click',e=>{const b=e.target.closest('#view-assetexplorer [data-ax-condition-detail]');if(!b)return;e.preventDefault();e.stopPropagation();try{open(JSON.parse(decodeURIComponent(b.dataset.axConditionDetail||'')))}catch(err){}},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
document.addEventListener('aip:demo-state-changed',()=>{try{window.AIP_HEALTH_CACHE?.clear?.()}catch(e){}},true);
})();
