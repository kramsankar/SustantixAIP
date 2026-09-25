
(function(){
  function isMobileDeviceView(){
    return window.matchMedia('(max-width:760px)').matches;
  }
  function redrawActiveView(){
    var active=document.querySelector('.view.active');
    if(!active)return;
    var view=(active.id||'').replace('view-','');
    setTimeout(function(){
      if(typeof resizeView==='function')resizeView(view);
      window.dispatchEvent(new Event('resize'));
    },80);
  }
  function closeMobileNav(){
    document.body.classList.remove('mobile-nav-open');
    var btn=document.getElementById('mobileMenuBtn');
    if(btn){
      btn.textContent='☰';
      btn.setAttribute('aria-label','Open navigation');
    }
  }
  function toggleMobileNav(){
    if(!isMobileDeviceView())return;
    var open=document.body.classList.toggle('mobile-nav-open');
    var btn=document.getElementById('mobileMenuBtn');
    if(btn){
      btn.textContent=open?'✕':'☰';
      btn.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    }
  }
  function bootDeviceResponsive(){
    var menu=document.getElementById('mobileMenuBtn');
    var scrim=document.getElementById('mobileNavScrim');
    if(menu)menu.addEventListener('click',toggleMobileNav);
    if(scrim)scrim.addEventListener('click',closeMobileNav);
    document.querySelectorAll('#sidebar .nav-item').forEach(function(item){
      item.addEventListener('click',function(){
        if(isMobileDeviceView())closeMobileNav();
      });
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape')closeMobileNav();
    });
    window.addEventListener('resize',function(){
      if(!isMobileDeviceView())closeMobileNav();
      redrawActiveView();
    });
    redrawActiveView();
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bootDeviceResponsive);
  }else{
    bootDeviceResponsive();
  }
})();
