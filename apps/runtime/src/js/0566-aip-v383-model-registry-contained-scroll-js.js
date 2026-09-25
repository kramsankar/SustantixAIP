
(function(){
  function syncModelsMode(){
    var main=document.getElementById('main');
    if(!main) return;
    var models=document.getElementById('view-models');
    var on=!!(models && models.classList.contains('active'));
    main.classList.toggle('aip383-models-mode',on);
    if(on) main.scrollTop=0;
  }
  function install(){
    var main=document.getElementById('main');
    if(!main) return;
    syncModelsMode();
    new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        if(muts[i].type==='attributes' && muts[i].attributeName==='class'){
          syncModelsMode();
          return;
        }
      }
    }).observe(main,{subtree:true,attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.AIP_V383_SYNC_MODELS_SCROLL=syncModelsMode;
  window.AIP_V383_AUDIT={release:'v383',baseline:'v382',scope:'AI Models & Governance scrolling/opacity only',changes:['Disabled overall right-pane vertical scrolling while AI Models & Governance is active','Kept screen heading and four dynamic status counters fixed','Moved vertical scrolling to the five-stage model matrix only','Kept all five blue stage headers sticky and fully opaque inside the matrix scroller','Removed legacy header-gap masks and retired any old model-registry top scrollbar'],excelChanged:false,calculationLogicChanged:false,syntheticChanged:false,navigationChanged:false};
})();
