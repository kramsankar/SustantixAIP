
(function(){
 function h(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 window.planScheduleTipShow=function(ev,id,label,cls,start,finish,calc){
  var t=document.getElementById('poSched208Tip');if(!t)return;
  t.className=cls||'current';
  var rows='';
  if(start)rows+='<div class="tip-row"><span>'+((label==='Required Completion By')?'Deadline':'Start')+'</span><b>'+h(start)+'</b></div>';
  if(finish)rows+='<div class="tip-row"><span>Finish</span><b>'+h(finish)+'</b></div>';
  t.innerHTML='<div class="tip-head">'+h(label)+' · '+h(id)+'</div><div class="tip-body">'+rows+(calc?'<div class="po-sched208-calc">'+h(calc)+'</div>':'')+'</div>';
  t.style.display='block';window.planScheduleTipMove(ev);
 };
 window.planScheduleTipMove=function(ev){var t=document.getElementById('poSched208Tip');if(!t||t.style.display==='none')return;var x=ev.clientX+14,y=ev.clientY+14;var r=t.getBoundingClientRect();if(x+r.width>window.innerWidth-8)x=ev.clientX-r.width-14;if(y+r.height>window.innerHeight-8)y=ev.clientY-r.height-14;t.style.left=Math.max(8,x)+'px';t.style.top=Math.max(8,y)+'px'};
 window.planScheduleTipHide=function(){var t=document.getElementById('poSched208Tip');if(t)t.style.display='none'};
})();
