
(function(){
'use strict';
const original=window.renderAssetRelationships;
if(typeof original!=='function'||original.__aipV70KpiSync)return;
function syncRelationshipKpis(){
 const view=document.getElementById('view-assetrelationships');
 if(!view)return;
 try{window.AIPKPIMaster?.scan?.(view)}catch(e){console.error('Asset Relationship KPI normalization failed',e)}
}
function wrappedAssetRelationships(){
 const result=original.apply(this,arguments);
 /* The Asset Explorer CTA is intercepted during capture and deliberately stops
    propagation, so the global click-driven KPI normalizer never sees that first
    navigation. Normalize the freshly rendered destination directly. */
 syncRelationshipKpis();
 requestAnimationFrame(syncRelationshipKpis);
 setTimeout(syncRelationshipKpis,40);
 return result;
}
wrappedAssetRelationships.__aipV70KpiSync=true;
wrappedAssetRelationships.__aipOriginal=original;
window.renderAssetRelationships=wrappedAssetRelationships;
window.AIP_BUILD_VERSION='v70';
})();
