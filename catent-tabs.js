// v47 mockup: МЕДИА и УРОВНИ — мягкое появление, буквы, лапки. Раз на открытие вкладки.
(()=>{const H=document.documentElement;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const busy=()=>H.classList.contains('iwait')||H.classList.contains('ibye');let played={};addEventListener('hashchange',()=>played={});
const split=(el,d,keep)=>{if(!el)return 0;let n=0;[...el.childNodes].forEach(t=>{if(t.nodeType!=3||!t.textContent.trim())return;const f=document.createDocumentFragment();[...t.textContent].forEach(c=>{const s=document.createElement('span');s.className='lc';s.style.setProperty('--i',n++);s.textContent=c;f.append(s)});t.replaceWith(f)});el.style.setProperty('--d',d+'ms');return n};
const PAW='<i class="tpw"></i>';
let io;const grid=g=>{const tiles=[...g.children];if(played.m){tiles.forEach(a=>a.classList.add('tn','tq'));return}played.m=1;
  tiles.forEach(a=>{a.classList.add('tt');a.insertAdjacentHTML('beforeend',PAW)});
  io=new IntersectionObserver(es=>{const v=es.filter(e=>e.isIntersecting).map(e=>e.target).sort((a,b)=>{const r=a.getBoundingClientRect(),s=b.getBoundingClientRect();return (r.top-s.top)||(r.left-s.left)});
    v.forEach((a,k)=>{io.unobserve(a);a.style.setProperty('--td',Math.min(k,14)*70+'ms');a.classList.add('tn')})},{threshold:.05});
  const go=()=>busy()?setTimeout(go,120):tiles.forEach(a=>io.observe(a));go()};
const levels=L=>{const cs=[...L.querySelectorAll('.lv')];if(played.l){L.classList.add('tq');return}played.l=1;
  cs.forEach((c,i)=>{const b=i*180;c.style.setProperty('--lb',b+'ms');let d=b+350;d+=split(c.querySelector(':scope>b'),d)*34+120;const pr=c.querySelector('.pr');d+=split(pr,d)*34;
    const pk=c.querySelector('.perks');if(pk){const parts=pk.innerHTML.split('<br>');pk.innerHTML=parts.map((x,k)=>`<span class="pk" style="--pd:${d+150+k*110}ms">${x}</span>`).join('');d+=150+parts.length*110}
    c.style.setProperty('--bd',d+150+'ms')});
  const go=()=>busy()?setTimeout(go,120):requestAnimationFrame(()=>L.classList.add('tgo'));go()};
const scan=()=>{const g=document.querySelector('#app .mgrid:not([data-tt])');if(g){g.dataset.tt=1;grid(g)}const l=document.querySelector('#app .levels:not([data-tt])');if(l){l.dataset.tt=1;levels(l)}};
const go=()=>{const a=document.querySelector('#app');if(!a)return setTimeout(go,50);new MutationObserver(scan).observe(a,{childList:true});scan()};go();})();
