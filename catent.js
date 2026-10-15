// v45: буквы по одной на всех карточках ленты (заголовок, дата, плашка закрытого пака) — раз на карточку, при появлении на экране
(()=>{const H=document.documentElement,S=34,P='<svg class="tpaw" viewBox="0 0 24 24"><use href="#gpaw"/></svg>';
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const split=(el,d)=>{if(!el||el.dataset.tl)return 0;el.dataset.tl=1;const t=el.textContent;el.classList.add('tl');el.style.setProperty('--d',d+'ms');el.textContent='';[...t].forEach((c,i)=>{const s=document.createElement('span');s.className='ch';s.style.setProperty('--i',i);s.textContent=c;el.append(s)});return [...t].length};
const arm=p=>{if(H.classList.contains('iwait')||H.classList.contains('ibye'))return setTimeout(()=>arm(p),120);
  const base=p.classList.contains('ia')?1150+(+getComputedStyle(p).getPropertyValue('--i')||0)*140:250;p.style.setProperty('--b',base+'ms');p.classList.add('tin')};
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);arm(e.target)}}),{threshold:.01});
const prep=()=>document.querySelectorAll('#app .post:not([data-tp])').forEach(p=>{p.dataset.tp=1;let d=0;
  d+=split(p.querySelector('.ph>span'),d)*S*.5;const c=p.querySelector('.cov');if(!c){io.observe(p);return}
  d+=split(c.querySelector('h3'),d+250)*S+250;
  if(c.classList.contains('lk')){d+=150;const m=c.querySelector('.frost .mu'),b=c.querySelector('.frost b');d+=split(m,d)*S+100;const n=split(b,d);d+=n*S;if(b)b.insertAdjacentHTML('beforeend',P);p.style.setProperty('--pd',d+200+'ms');p.style.setProperty('--bd',d+400+'ms')}
  io.observe(p)});
const go=()=>{const a=document.querySelector('#app');if(!a)return setTimeout(go,50);new MutationObserver(prep).observe(a,{childList:true});prep()};go();})();
