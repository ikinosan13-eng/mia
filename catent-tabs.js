// v47 mockup: МЕДИА и УРОВНИ — мягкое появление, буквы, лапки. Раз на открытие вкладки.
(()=>{const H=document.documentElement;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const busy=()=>H.classList.contains('iwait')||H.classList.contains('ibye');let played={};addEventListener('hashchange',()=>played={});
const split=(el,d,keep)=>{if(!el)return 0;let n=0;[...el.childNodes].forEach(t=>{if(t.nodeType!=3||!t.textContent.trim())return;const f=document.createDocumentFragment();[...t.textContent].forEach(c=>{const s=document.createElement('span');s.className='lc';s.style.setProperty('--i',n++);s.textContent=c;f.append(s)});t.replaceWith(f)});el.style.setProperty('--d',d+'ms');return n};
const PAW='<i class="tpw"></i>';
let io;const ready=new Set();
const url=a=>{const m=/url\(["']?(.*?)["']?\)/.exec(a.style.backgroundImage||getComputedStyle(a).backgroundImage);return m&&m[1]};
const load=a=>{if(a._p)return a._p;const u=url(a);a._p=new Promise(r=>{if(!u)return r();const im=new Image();im.decoding='async';im.onload=()=>(im.decode?im.decode().catch(()=>{}):Promise.resolve()).then(r);im.onerror=r;im.src=u;setTimeout(r,2500)});return a._p};
const grid=g=>{const tiles=[...g.children];if(played.m){tiles.forEach(a=>a.classList.add('tn','tq'));return}played.m=1;
  tiles.forEach(a=>{a.classList.add('tt','tw');a.insertAdjacentHTML('beforeend',PAW)});
  const run=async()=>{tiles.forEach(load);let last=0;for(const a of tiles){await load(a);const w=80-(performance.now()-last);if(w>0)await new Promise(r=>setTimeout(r,w));a.style.setProperty('--td','0ms');a.classList.remove('tw');a.classList.add('tn');last=performance.now()}};
  const go=()=>busy()?setTimeout(go,120):run();go()};
const CAT='<svg class="lcat" viewBox="0 0 120 50" aria-hidden="true"><g fill="none" stroke="#e0609a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path class="e1" d="M30 40 L34 10 L50 26"/><path class="e2" d="M70 26 L86 10 L90 40"/><path d="M30 40 Q60 18 90 40"/><g class="eyes"><path d="M46 38 q4 -4 8 0"/><path d="M66 38 q4 -4 8 0"/></g><path d="M58 44 l2 2 l2 -2"/></g><g fill="#e0609a"><ellipse cx="34" cy="49" rx="7" ry="4"/><ellipse cx="86" cy="49" rx="7" ry="4"/></g></svg>';
const PW='<svg class="pb" viewBox="0 0 24 24"><use href="#gpaw"/></svg>';
const count=(el,to,delay)=>{if(!el||!to)return;const t0=performance.now()+delay,D=900;el.textContent='0';const f=n=>{const k=Math.min(1,Math.max(0,(n-t0)/D));el.textContent=Math.round(to*(1-Math.pow(1-k,3)));k<1&&requestAnimationFrame(f)};requestAnimationFrame(f)};
const ST=30;
const deep=(el,d)=>{if(!el)return 0;let n=0;const walk=x=>[...x.childNodes].forEach(t=>{if(t.nodeType==1){if(!t.matches('svg,.num,.lcur'))walk(t);return}if(t.nodeType!=3||!t.textContent.trim())return;const f=document.createDocumentFragment();t.textContent.split(/(\s+)/).forEach(w=>{if(!w)return;const g=/^\s+$/.test(w)?f:document.createElement('span');if(g!==f){g.className='lw';f.append(g)}[...w].forEach(c=>{const s=document.createElement('span');s.className='lc'+(c.trim()&&n%7==5?' wg':'')+(/\p{Extended_Pictographic}/u.test(c)?' hop':'');s.style.setProperty('--i',n++);s.textContent=c;g.append(s)})});t.replaceWith(f)});walk(el);
  el.style.setProperty('--d',d+'ms');if(n>2){el.classList.add('lcw');el.insertAdjacentHTML('beforeend','<i class="lcur" aria-hidden="true"></i>');el.style.setProperty('--n',n);el._cur=1}return n};
const levels=L=>{const cs=[...L.querySelectorAll('.lv')];if(played.l){L.classList.add('tq');return}played.l=1;
  let top=null,mx=-1;cs.forEach(c=>{const p=parseInt((c.querySelector('.pr')||{}).textContent);if(p>mx&&!c.classList.contains('pick')){mx=p;top=c}});
  const jobs=[];cs.forEach((c,i)=>{const b=i*220;c.style.setProperty('--lb',b+'ms');c.style.setProperty('--rz',(i%2?3:-3)+'deg');let d=b+500;
    const nb=c.querySelector(':scope>b');d+=deep(nb,d)*ST*.75;
    const pr=c.querySelector('.pr');const n=pr&&pr.firstChild&&pr.firstChild.nodeType==3?parseInt(pr.firstChild.textContent):NaN;
    if(n>0){const sp=document.createElement('span');sp.className='num';sp.textContent=n;sp.style.setProperty('--d',d+'ms');const rest=pr.firstChild.textContent.replace(/^\s*\d+/,'');pr.firstChild.replaceWith(sp,rest);jobs.push([sp,n,d]);d+=300}
    d+=deep(pr,d)*ST*.75;
    const pk=c.querySelector('.perks');if(pk){const parts=pk.innerHTML.split('<br>');pk.innerHTML=parts.map(x=>`<span class="pk">${PW}<span class="pt">${x.replace(/^\s*✔\s*/,'')}</span></span>`).join('');
      pk.querySelectorAll('.pk').forEach(p=>{p.style.setProperty('--pd',d+'ms');d+=deep(p.querySelector('.pt'),d+220)*ST*.75+220})}
    c.style.setProperty('--bd',d+100+'ms');const bt=c.querySelector(':scope>.ob,:scope>.gb');if(bt){deep(bt,d+350);if(bt.classList.contains('ob'))bt.insertAdjacentHTML('afterend','<i class="brst" aria-hidden="true">'+['💕','✨','💗','✨','💕','✨'].map((e,k)=>`<i style="--a:${k*60-150}deg">${e}</i>`).join('')+'</i>')}});
  if(top){top.classList.add('ltop');top.insertAdjacentHTML('afterbegin',CAT)}
  const go=()=>busy()?setTimeout(go,120):requestAnimationFrame(()=>{L.querySelectorAll('.lcw').forEach(e=>{const r=e.getBoundingClientRect(),cs=[...e.querySelectorAll('.lc')],l=cs[cs.length-1];if(l){const w=Math.min(l.getBoundingClientRect().right-r.left,r.width);e.style.setProperty('--w',Math.max(0,w)+'px')}});L.classList.add('tgo');jobs.forEach(j=>count(...j))});go()};
const scan=()=>{const g=document.querySelector('#app .mgrid:not([data-tt])');if(g){g.dataset.tt=1;grid(g)}const l=document.querySelector('#app .levels:not([data-tt])');if(l){l.dataset.tt=1;levels(l)}};
const go=()=>{const a=document.querySelector('#app');if(!a)return setTimeout(go,50);new MutationObserver(scan).observe(a,{childList:true});scan()};go();})();
