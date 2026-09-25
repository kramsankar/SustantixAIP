
(function(){
'use strict';
let committedId='';

function graphPreview(id){
 const st=window.AR_GRAPH_STATE||{};
 const ents=Array.isArray(st.currentEntities)?st.currentEntities:[];
 const hit=ents.find(en=>String(en.Entity_ID)===String(id));
 if(!hit)return false;

 document.querySelectorAll('#arSvg .ar-node,#arSvg .ar-rel').forEach(x=>{
   x.classList.remove('path','dimmed','highlighted','ar-search-selected','ar-search-hovered');
 });
 document.querySelectorAll('#arSearchResults [data-ar-search-entity]').forEach(el=>{
   const on=String(el.dataset.arSearchEntity)===String(id);
   el.classList.toggle('ar-result-hovered',on);
   el.classList.toggle('ar-result-selected',on && String(committedId)===String(id));
 });

 const node=[...document.querySelectorAll('#arSvg .ar-node')].find(n=>String(n.dataset.node)===String(id));
 if(node){
   node.classList.add('highlighted','ar-search-hovered');
 }
 const note=document.getElementById('arNetworkNote');
 if(note)note.textContent=`Preview: ${hit.Entity_Name||hit.Entity_ID} (${hit.Entity_Type||'Entity'}).`;
 return true;
}

function currentQueryFirstMatch(){
 const input=document.getElementById('arGraphSearch');
 const q=window.arSearchNormalize?window.arSearchNormalize(input?.textContent):String(input?.textContent||'').trim().toLowerCase();
 if(!q)return '';
 const matches=window.arSearchMatches?window.arSearchMatches(q):[];
 return matches?.[0]?.Entity_ID||'';
}

document.addEventListener('mouseover',function(e){
 const row=e.target?.closest?.('#view-assetrelationships #arSearchResults [data-ar-search-entity]');
 if(!row)return;
 const related=e.relatedTarget;
 if(related&&row.contains(related))return;
 graphPreview(row.dataset.arSearchEntity);
},true);

document.addEventListener('mouseout',function(e){
 const row=e.target?.closest?.('#view-assetrelationships #arSearchResults [data-ar-search-entity]');
 if(!row)return;
 const related=e.relatedTarget;
 if(related&&row.contains(related))return;

 const restore=committedId||currentQueryFirstMatch();
 if(restore)graphPreview(restore);
},true);

document.addEventListener('click',function(e){
 const row=e.target?.closest?.('#view-assetrelationships #arSearchResults [data-ar-search-entity]');
 if(!row)return;
 committedId=String(row.dataset.arSearchEntity||'');
 document.querySelectorAll('#arSearchResults [data-ar-search-entity]').forEach(el=>{
   el.classList.toggle('ar-result-selected',String(el.dataset.arSearchEntity)===committedId);
 });
 // Existing click handler will perform the real select/centre. This layer only records the committed row.
},true);

// Expose a reset hook for clear-search behavior.
window.AIPARSearchHoverReset=function(){
 committedId='';
 document.querySelectorAll('#arSearchResults [data-ar-search-entity]').forEach(el=>el.classList.remove('ar-result-hovered','ar-result-selected'));
 document.querySelectorAll('#arSvg .ar-node').forEach(el=>el.classList.remove('ar-search-hovered'));
};
})();
