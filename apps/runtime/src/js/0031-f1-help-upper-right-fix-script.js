
(function(){
  var queued=false;
  function keyFor(view){return (view.id||'').replace(/^view-/,'')||'overview';}
  function makeButton(view){
    var key=keyFor(view), b=document.createElement('button');
    b.type='button'; b.className='f1-btn'; b.dataset.helpView=key;
    b.title='F1 Help'; b.setAttribute('aria-label','Open F1 Help'); b.setAttribute('aria-expanded','false');
    b.innerHTML='<span class="f1-key">F1</span> Help';
    b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation(); if(window.openHelp) window.openHelp(b.dataset.helpView||keyFor(view));});
    return b;
  }
  function place(view){
    if(!view || !view.classList.contains('view')) return;
    var buttons=Array.from(view.querySelectorAll('.f1-btn'));
    var button=buttons.shift()||makeButton(view);
    buttons.forEach(function(x){x.remove();});
    var holder=view.querySelector(':scope > .f1-help-top-right');
    if(!holder){holder=document.createElement('div');holder.className='f1-help-top-right';view.insertBefore(holder,view.firstChild);}
    if(button.parentNode!==holder) holder.appendChild(button);
    button.dataset.helpView=keyFor(view);
    button.setAttribute('title','F1 Help');
  }
  function run(){queued=false;document.querySelectorAll('.view').forEach(place);}
  function queue(){if(queued)return;queued=true;requestAnimationFrame(run);}
  function boot(){run();
    var main=document.getElementById('main')||document.body;
    new window.__APMSafeMutationObserver(queue).observe(main,{childList:true,subtree:true});
    document.addEventListener('click',function(e){if(e.target.closest('[data-view],.nav-item,.subnav-item,.nav-link')) setTimeout(queue,0);},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
