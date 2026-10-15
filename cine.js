// m49: кино-режим — всё содержимое пака (большие арты + миниатюры) сначала грузится и декодируется,
// пока виден только спокойный лоадер с ушками; потом всё плавно выезжает снизу. То же при смене пака.
(()=>{const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const urlOf=d=>{const m=/url\(["']?(.*?)["']?\)/.exec(d.style.backgroundImage||'')||/url\(["']?(.*?)["']?\)/.exec(((d.querySelector('i')||{}).style||{}).backgroundImage||'');return m&&m[1]};
const dec=u=>new Promise(r=>{const i=new Image();i.decoding='async';i.onload=()=>{(i.decode?i.decode():Promise.resolve()).catch(()=>{}).then(r)};i.onerror=r;i.src=u});
const LD='<div class="cvld" aria-hidden="true"><svg viewBox="0 0 120 60"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path class="e1" d="M22 52 L34 10 L56 40"/><path class="e2" d="M64 40 L86 10 L98 52"/><path d="M22 52 Q60 30 98 52" opacity=".55"/></g></svg><div class="cvd"><i></i><i></i><i></i></div><p>Мур, готовлю арты…</p></div>';
let gen=0,V=null;
const hide=()=>{if(!V)return;gen++;V.classList.remove('cgo');V.classList.add('cwait')};
const arm=s=>{const kids=[...s.children];if(!kids.length)return hide();const my=++gen;V.classList.remove('cgo');V.classList.add('cwait');
  const us=[...new Set(kids.map(urlOf).filter(Boolean))];
  kids.forEach((d,k)=>d.style.setProperty('--ck',Math.min(k,12)));
  Promise.race([Promise.all(us.map(dec)),new Promise(r=>setTimeout(r,6000))]).then(()=>new Promise(r=>setTimeout(r,250))).then(()=>{const fire=()=>{if(my!==gen)return;if(!V.classList.contains('ui'))return setTimeout(fire,80);
    V.classList.remove('cwait');void V.offsetWidth;if(!RM)V.classList.add('cgo');setTimeout(()=>{if(my===gen)V.classList.remove('cgo')},2800)};fire()})};
const watch=v=>{if(v._cw)return;v._cw=1;V=v;v.insertAdjacentHTML('beforeend',LD);const s=v.querySelector('#v-strip');let t=0;
  new MutationObserver(()=>{if(!s.children.length){clearTimeout(t);hide();return}clearTimeout(t);t=setTimeout(()=>arm(s),40)}).observe(s,{childList:true});
  new MutationObserver(()=>{if(!v.classList.contains('on')&&(v.classList.contains('cwait')||v.classList.contains('cgo'))){gen++;v.classList.remove('cwait','cgo')}else if(v.classList.contains('on')&&!s.children.length&&!v.classList.contains('cwait'))hide()}).observe(v,{attributes:true,attributeFilter:['class']})};
new MutationObserver(()=>{const v=document.querySelector('.viewer');if(v)watch(v)}).observe(document.body,{childList:true});})();
