
(function(){
  /* Currency policy:
     - Any absolute Indian Rupee value is rounded to a whole number.
     - Lakh/crore/k abbreviations are retained, but their displayed numeric part is rounded.
     - Percentages, ratios, scores and engineering/per-unit values are not changed here.
  */
  function roundIndianRupeeText(text){
    if(!text || !/(?:₹|\bINR\b)/i.test(text)) return text;

    // Prefix currency: ₹14.70 lakh, INR 12,345.60, ₹2.45 Cr, ₹28.50k
    text = text.replace(
      /((?:₹|\bINR\b)\s*)(-?\d[\d,]*(?:\.\d+)?)(\s*(?:crores?|cr|lakhs?|l|k|thousand|million|billion)?)(?=\b|\/|$)/gi,
      function(_, prefix, raw, suffix){
        const n = Number(raw.replace(/,/g,""));
        if(!Number.isFinite(n)) return _;
        return prefix + Math.round(n).toLocaleString("en-IN") + suffix;
      }
    );

    // Suffix currency: 12,345.60 INR or 12,345.60 ₹
    text = text.replace(
      /(-?\d[\d,]*(?:\.\d+)?)(\s*(?:₹|\bINR\b))/gi,
      function(_, raw, suffix){
        const n = Number(raw.replace(/,/g,""));
        if(!Number.isFinite(n)) return _;
        return Math.round(n).toLocaleString("en-IN") + suffix;
      }
    );
    return text;
  }

  function formatCurrencyTextNodes(root){
    const walker=document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {acceptNode(node){
        const p=node.parentElement;
        if(!p || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/i.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        return /(?:₹|\bINR\b)/i.test(node.nodeValue||"") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }}
    );
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const next=roundIndianRupeeText(node.nodeValue);
      if(next!==node.nodeValue) node.nodeValue=next;
    });
  }

  // Make the common currency helper return whole-number rupee displays.
  window.fmtINR = function(value){
    const n=Number(value)||0;
    if(Math.abs(n)>=10000000) return "₹"+Math.round(n/10000000).toLocaleString("en-IN")+" Cr";
    if(Math.abs(n)>=100000) return "₹"+Math.round(n/100000).toLocaleString("en-IN")+" L";
    return "₹"+Math.round(n).toLocaleString("en-IN");
  };

  const apply=()=>formatCurrencyTextNodes(document.body);
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",apply);
  else apply();

  new window.__APMSafeMutationObserver(mutations=>{
    if(mutations.some(m=>m.addedNodes && m.addedNodes.length)) requestAnimationFrame(apply);
  }).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
