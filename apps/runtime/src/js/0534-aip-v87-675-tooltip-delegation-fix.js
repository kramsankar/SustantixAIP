
(function(){
 document.addEventListener('mouseover',function(ev){const g=ev.target&&ev.target.closest&&ev.target.closest('#view-reliabilityengineering .orl-attention-point');if(!g)return;const c=g.querySelector('circle[onclick]');const m=c&&String(c.getAttribute('onclick')||'').match(/orlFilterIncident\('([^']+)'\)/);if(m&&window.orlShowTip)window.orlShowTip(ev,m[1]);},true);
 document.addEventListener('mousemove',function(ev){if(ev.target&&ev.target.closest&&ev.target.closest('#view-reliabilityengineering .orl-attention-point')&&window.orlMoveTip)window.orlMoveTip(ev);},true);
 document.addEventListener('mouseout',function(ev){const g=ev.target&&ev.target.closest&&ev.target.closest('#view-reliabilityengineering .orl-attention-point');if(!g)return;const next=ev.relatedTarget;if(next&&g.contains(next))return;if(window.orlHideTip)window.orlHideTip();},true);
})();
