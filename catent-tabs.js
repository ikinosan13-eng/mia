// v47 mockup: МЕДИА и УРОВНИ — мягкое появление, буквы, лапки. Раз на открытие вкладки.
(()=>{const H=document.documentElement;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const busy=()=>H.classList.contains('iwait')||H.classList.contains('ibye');let played={};addEventListener('hashchange',()=>played={});
const split=(el,d,keep)=>{if(!el)return 0;let n=0;[...el.childNodes].forEach(t=>{if(t.nodeType!=3||!t.textContent.trim())return;const f=document.createDocumentFragment();[...t.textContent].forEach(c=>{const s=document.createElement('span');s.className='lc';s.style.setProperty('--i',n++);s.textContent=c;f.append(s)});t.replaceWith(f)});el.style.setProperty('--d',d+'ms');return n};
const PAW='<i class="tpw"></i>';
let io;const ready=new Set();
const url=a=>{const m=/url\(["']?(.*?)["']?\)/.exec(a.style.backgroundImage||getComputedStyle(a).backgroundImage);return m&&m[1]};
const load=a=>{if(a._p)return a._p;const u=url(a);a._p=new Promise(r=>{if(!u)return r();const im=new Image();im.decoding='async';im.onload=()=>(im.decode?im.decode().catch(()=>{}):Promise.resolve()).then(r);im.onerror=r;im.src=u;setTimeout(r,2500)});return a._p};
const grid=g=>{const tiles=[...g.children];if(played.m){tiles.forEach(a=>a.classList.add('tn','tq'));return}played.m=1;
  tiles.forEach(a=>{a.classList.add('tt','tw');a.insertAdjacentHTML('beforeend','<i class="tsh"></i>'+PAW)});
  const vis=()=>tiles.filter(a=>{const r=a.getBoundingClientRect();return r.top<innerHeight*1.3&&r.bottom>-50});vis().forEach(load);
  let q=[],t=0;const flush=()=>{t=0;q.sort((a,b)=>{const r=a.getBoundingClientRect(),s=b.getBoundingClientRect();return (r.top-s.top)||(r.left-s.left)}).forEach((a,k)=>{a.style.setProperty('--td',Math.min(k,8)*70+'ms');a.classList.remove('tw');a.classList.add('tn')});q=[]};
  io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const a=e.target;io.unobserve(a);load(a).then(()=>{q.push(a);t||(t=setTimeout(flush,40))})}),{threshold:.05,rootMargin:'0px 0px 200px 0px'});
  const go=()=>busy()?setTimeout(go,120):tiles.forEach(a=>io.observe(a));go()};
const CAT='<svg class="lcat" viewBox="0 0 120 50" aria-hidden="true"><g fill="none" stroke="#e0609a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path class="e1" d="M30 40 L34 10 L50 26"/><path class="e2" d="M70 26 L86 10 L90 40"/><path d="M30 40 Q60 18 90 40"/><g class="eyes"><path d="M46 38 q4 -4 8 0"/><path d="M66 38 q4 -4 8 0"/></g><path d="M58 44 l2 2 l2 -2"/></g><g fill="#e0609a"><ellipse cx="34" cy="49" rx="7" ry="4"/><ellipse cx="86" cy="49" rx="7" ry="4"/></g></svg>';
const PW='<svg class="pb" viewBox="0 0 24 24"><use href="#gpaw"/></svg>';
const count=(el,to,delay)=>{if(!el||!to)return;const t0=performance.now()+delay,D=900;el.textContent='0';const f=n=>{const k=Math.min(1,Math.max(0,(n-t0)/D));el.textContent=Math.round(to*(1-Math.pow(1-k,3)));k<1&&requestAnimationFrame(f)};requestAnimationFrame(f)};
const levels=L=>{const cs=[...L.querySelectorAll('.lv')];if(played.l){L.classList.add('tq');return}played.l=1;
  let top=null,mx=-1;cs.forEach(c=>{const p=parseInt((c.querySelector('.pr')||{}).textContent);if(p>mx&&!c.classList.contains('pick')){mx=p;top=c}});
  const jobs=[];cs.forEach((c,i)=>{const b=i*220;c.style.setProperty('--lb',b+'ms');c.style.setProperty('--rz',(i%2?3:-3)+'deg');let d=b+500;
    const nb=c.querySelector(':scope>b');d+=split(nb,d)*34+120;nb&&nb.querySelectorAll('.lc').forEach(x=>{if(/\p{Extended_Pictographic}/u.test(x.textContent))x.classList.add('hop')});
    const pr=c.querySelector('.pr');const n=pr&&pr.firstChild&&pr.firstChild.nodeType==3?parseInt(pr.firstChild.textContent):NaN;
    if(n>0){const sp=document.createElement('span');sp.className='num';sp.textContent=n;const rest=pr.firstChild.textContent.replace(/^\s*\d+/,'');pr.firstChild.replaceWith(sp,rest);pr.style.setProperty('--d',d+'ms');jobs.push([sp,n,d]);d+=500}else d+=split(pr,d)*34;
    const pk=c.querySelector('.perks');if(pk){const parts=pk.innerHTML.split('<br>');pk.innerHTML=parts.map((x,k)=>`<span class="pk" style="--pd:${d+150+k*160}ms">${PW}${x.replace(/^\s*✔\s*/,'')}</span>`).join('');d+=150+parts.length*160}
    c.style.setProperty('--bd',d+150+'ms');const bt=c.querySelector(':scope>.ob,:scope>.gb');if(bt&&bt.classList.contains('ob'))bt.insertAdjacentHTML('afterend','<i class="brst" aria-hidden="true">'+['💕','✨','💗','✨','💕','✨'].map((e,k)=>`<i style="--a:${k*60-150}deg">${e}</i>`).join('')+'</i>')});
  if(top){top.classList.add('ltop');top.insertAdjacentHTML('afterbegin',CAT)}
  const go=()=>busy()?setTimeout(go,120):requestAnimationFrame(()=>{L.classList.add('tgo');jobs.forEach(j=>count(...j))});go()};
const scan=()=>{const g=document.querySelector('#app .mgrid:not([data-tt])');if(g){g.dataset.tt=1;grid(g)}const l=document.querySelector('#app .levels:not([data-tt])');if(l){l.dataset.tt=1;levels(l)}};
const go=()=>{const a=document.querySelector('#app');if(!a)return setTimeout(go,50);new MutationObserver(scan).observe(a,{childList:true});scan()};go();})();
