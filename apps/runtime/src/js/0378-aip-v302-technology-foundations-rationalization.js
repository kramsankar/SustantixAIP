
(function(){
  function openSubView(view,parent){
    try{
      if(typeof window.activate==='function') window.activate(view);
      else document.querySelector('#sidebar .nav-item[data-view="'+view+'"]')?.click();
      const p=document.querySelector('#sidebar .nav-item[data-view="'+parent+'"]');
      if(p){document.querySelectorAll('#sidebar .nav-item').forEach(n=>n.classList.remove('active'));p.classList.add('active');p.closest('.x-nav-group')?.classList.add('open');}
    }catch(e){console.error('Technology Foundations subview navigation failed',view,e);}
  }
  window.AIP_V302_OPEN_CONNECTORS=function(){openSubView('apiconnectors','integrations')};
  window.AIP_V302_OPEN_MODEL_GOVERNANCE=function(){openSubView('aigovernance','models')};
  window.AIP_V302_AUDIT={release:'v302',baseline:'v301',scope:'Technology Foundations visible rationalization only',startupChanged:false,excelChanged:false,visibleCapabilities:['Data Management','Data Quality & Observability','Enterprise Integration','Twin Model & Physics','AI Models & Governance'],hiddenLegacyTopLevel:['API & Connector Management','Model Governance','Security, Roles & Audit']};
})();
