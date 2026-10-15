// m49: кино-режим — лента артов выезжает плавно и только после загрузки всех фото пака
(()=>{const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const urlOf=d=>{const m=/url\(["']?(.*?)["']?\)/.exec(d.style.backgroundImage||'')||/url\(["']?(.*?)["']?\)/.exec((d.querySelector('i')||{style:{}}).style.backgroundImage||'');return m&&m[1]};
const ld=u=>new Promise(r=>{const i=new Image();i.onload=()=>(i.decode?i.decode().catch(()=>{}):0,r());i.onerror=r;i.src=u});
let gen=0;
const arm=s=>{const my=++gen;s.classList.remove('rdy');const kids=[...s.children];if(!kids.length)return;
  kids.forEach((d,k)=>d.style.transitionDelay=RM?'0s':Math.min(k,12)*.09+'s');
  const us=[...new Set(kids.map(urlOf).filter(Boolean))];
  Promise.race([Promise.all(us.map(ld)),new Promise(r=>setTimeout(r,4000))]).then(()=>{if(my!==gen)return;requestAnimationFrame(()=>requestAnimationFrame(()=>s.classList.add('rdy')))})};
const watch=s=>{if(s._cw)return;s._cw=1;let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>arm(s),30)}).observe(s,{childList:true});arm(s)};
new MutationObserver(()=>{const s=document.getElementById('v-strip');if(s)watch(s)}).observe(document.body,{childList:true,subtree:true});})();
