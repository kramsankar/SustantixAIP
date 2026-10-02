
(function(){
'use strict';
const norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
function state(){
  const s=window.AIPAssetExplorerController?.getState?.();
  if(!s||!s.assetId) throw new Error('No current Asset Explorer asset is available.');
  return s;
}
function rows(){
  const r=window.arAssetSelectorRows?.();
  return Array.isArray(r)?r:[];
}
function currentRecord(){
  const s=state(), a=s.asset||{}, g=s.governed||a.governed||a.raw||{};
  const id=String(s.assetId||a.assetId||g.Asset_ID||'').trim();
  const sourceRows=rows();
  const exact=sourceRows.find(r=>norm(r.Asset_ID)===norm(id));
  const tag=String(s.tag||a.tag||g.Asset_Tag||id).trim();
  const byTag=!exact&&tag?sourceRows.find(r=>norm(r.Asset_Tag)===norm(tag)):null;
  const r=exact||byTag||{};
  return {
    Asset_ID:String(r.Asset_ID||id),
    Asset_Tag:String(r.Asset_Tag||tag||id),
    Plant_ID:String(r.Plant_ID||s.plantId||a.plant||g.Plant_ID||''),
    Plant_Name:String(r.Plant_Name||s.plantName||s.site||a.plantName||g.Plant_Name||''),
    Asset_Class:String(r.Asset_Class||s.assetClass||a.assetClass||g.Asset_Class||'Asset'),
    Description:String(r.Description||a.description||g.Description||''),
    Health_Score:Number(r.Health_Score??a.health??g.Health_Score??0)||0,
    Risk_Band:String(r.Risk_Band||a.riskBand||g.Risk_Band||'')
  };
}
function context(){
  const r=currentRecord();
  return {
    assetId:r.Asset_ID,tag:r.Asset_Tag,siteId:r.Plant_ID,site:r.Plant_Name,
    assetClass:r.Asset_Class,selectorRecord:r,target:'assetrelationships',
    source:'Asset Explorer · live controller selection',
    contextToken:'AR-V64-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)
  };
}
function persist(c){
  window.AIP_CONTEXT_NAV={...c};
  window.AIP_SELECTED_ASSET_CONTEXT={...(window.AIP_SELECTED_ASSET_CONTEXT||{}),...c};
  window.AIP_ASSET_RELATIONSHIP_SOURCE_CONTEXT={...c};
  window.AIP_PENDING_RELATIONSHIP_CONTEXT={...c};
  window.AIP_RELATIONSHIP_FOCUS_ASSET=c.assetId;
  window.AIP_LAST_ASSET_EXPLORER_RELATIONSHIP_ID=c.assetId;
  try{sessionStorage.setItem('aip.context.nav',JSON.stringify(c))}catch(_){ }
}
function resetGraph(){
  try{
    window.AR_GRAPH_STATE.positions={};
    window.AR_GRAPH_STATE.collapsed?.clear?.();
    window.AR_GRAPH_STATE.pathNodes?.clear?.();
    window.AR_GRAPH_STATE.pathRels?.clear?.();
  }catch(_){ }
}
function verify(c){
  const site=document.getElementById('arSite');
  const type=document.getElementById('arAssetType');
  const focus=document.getElementById('arFocus');
  return !!(site&&type&&focus&&norm(site.value)===norm(c.siteId)&&norm(type.value)===norm(c.assetClass)&&norm(focus.value)===norm(c.assetId));
}
function render(c){
  persist(c);window.AR_ACTIVE_TAB='explorer';resetGraph();
  window.renderAssetRelationships(c);
  const root=document.getElementById('view-assetrelationships');
  if(root){root.dataset.aipContextToken=c.contextToken;root.dataset.aipAppliedRelationshipAsset=c.assetId;}
  const title=root?.querySelector('h1');if(title)title.textContent='Asset Relationship Intelligence — '+c.tag;
  if(!verify(c)){
    // The core renderer may have been invoked by activation once more. Render one
    // final time with the same immutable click-time context.
    window.renderAssetRelationships(c);
  }
  if(!verify(c)) throw new Error('Relationship selectors did not accept the current Asset Explorer selection.');
  window.AIP_RELATIONSHIP_FOCUS_ASSET=c.assetId;resetGraph();window.drawARGraph?.();
}
function openCurrent(){
  try{
    const c=context();persist(c);window.AR_ACTIVE_TAB='explorer';
    window.activate?.('assetrelationships',true);
    requestAnimationFrame(()=>{
      try{render(c)}catch(e){console.error('Asset Relationship context render failed',e)}
    });
    setTimeout(()=>{
      try{if(!verify(c))render(c)}catch(e){console.error('Asset Relationship context verification failed',e)}
    },120);
  }catch(e){console.error('View Asset Relationships failed',e)}
  return false;
}
function relationshipContextFromCurrentControls(){
  const root=document.getElementById('view-assetrelationships');
  const site=root?.querySelector('#arSite'),type=root?.querySelector('#arAssetType'),focus=root?.querySelector('#arFocus');
  if(!root||!site||!type||!focus||!focus.value) throw new Error('Current Asset Relationship context is unavailable.');
  const sourceRows=rows();
  const rec=sourceRows.find(r=>norm(r.Asset_ID)===norm(focus.value))||{};
  const option=focus.options[focus.selectedIndex];
  const tag=String(rec.Asset_Tag||option?.textContent?.split(' — ')[0]||focus.value).trim();
  return {
    assetId:String(rec.Asset_ID||focus.value),tag,
    siteId:String(rec.Plant_ID||site.value),site:String(rec.Plant_Name||site.options[site.selectedIndex]?.textContent||site.value),
    assetClass:String(rec.Asset_Class||type.value),selectorRecord:rec,target:'assetrelationships',
    source:'Asset Relationship Intelligence · current manual selection',
    contextToken:'AR-REFRESH-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)
  };
}
function refreshCurrentRelationshipSelection(){
  try{
    const c=relationshipContextFromCurrentControls();
    persist(c);
    const root=document.getElementById('view-assetrelationships');
    if(root){root.dataset.aipContextToken=c.contextToken;root.dataset.aipAppliedRelationshipAsset=c.assetId;root.classList.add('aip-contextual-relationship');}
    const title=root?.querySelector('h1');if(title)title.textContent='Asset Relationship Intelligence — '+c.tag;
    window.AIP_RELATIONSHIP_FOCUS_ASSET=c.assetId;
    resetGraph();window.drawARGraph?.();
  }catch(e){console.error('Asset Relationship current-context refresh failed',e)}
  return false;
}
window.AIPRefreshAssetRelationshipContext=refreshCurrentRelationshipSelection;
function intercept(e){
  const btn=e.target?.closest?.('#view-assetexplorer .ax-relationship-btn');
  if(!btn)return;
  if(e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ')return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openCurrent();
}
document.addEventListener('click',intercept,true);
document.addEventListener('keydown',intercept,true);
document.addEventListener('click',function(e){
  const b=e.target?.closest?.('#view-assetrelationships #arRefreshContext');
  if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();refreshCurrentRelationshipSelection();
},true);
window.AIPOpenAssetRelationshipsV64=openCurrent;
window.AIP_BUILD_VERSION='v87_10';
})();
