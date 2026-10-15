// v48 mockup: розовый котик-компаньон на ленте — сидит на заголовке пака в фокусе, лижет лапку и прыгает к следующему
(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const H=document.documentElement;
const SVG=`<svg viewBox="0 0 60 60" aria-hidden="true"><g class="ct"><path d="M40 50 C54 50 56 40 52 30 C50 25 54 21 57 24" fill="none" stroke="#e0609a" stroke-width="3" stroke-linecap="round"/></g>
<path class="cbd" d="M14 52 C12 40 18 30 30 30 C42 30 46 42 44 52 Z" fill="#fff" stroke="#e0609a" stroke-width="2.6" stroke-linejoin="round"/>
<path d="M22 46 q3 -4 6 0" fill="none" stroke="#f3a6c8" stroke-width="1.6" stroke-linecap="round"/>
<g class="chd"><path d="M12 18 L13 5 L21 12 M31 12 L39 5 L40 18" fill="#fff" stroke="#e0609a" stroke-width="2.6" stroke-linejoin="round"/><path d="M15 9 l1 4 l3 -1" fill="#f9c5dc"/><circle cx="26" cy="21" r="13" fill="#fff" stroke="#e0609a" stroke-width="2.6"/>
<g class="cey" fill="none" stroke="#8a4fd6" stroke-width="2.2" stroke-linecap="round"><path class="eo" d="M19 20 v2.5 M31 20 v2.5"/><path class="ec" d="M17.5 21.5 q2 -2 4 0 M29.5 21.5 q2 -2 4 0"/></g>
<path d="M24.5 26 l1.5 1.2 l1.5 -1.2" fill="none" stroke="#e0609a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><ellipse class="ctg" cx="26" cy="29.5" rx="1.8" ry="2.2" fill="#ff7fb0"/>
<circle cx="16" cy="25.5" r="2.2" fill="#ffc2dc" opacity=".8"/><circle cx="36" cy="25.5" r="2.2" fill="#ffc2dc" opacity=".8"/></g>
<ellipse class="cpw" cx="21" cy="51" rx="5" ry="3.6" fill="#fff" stroke="#e0609a" stroke-width="2.4"/><ellipse cx="35" cy="51.5" rx="5" ry="3.4" fill="#fff" stroke="#e0609a" stroke-width="2.4"/></svg>`;
const el=document.createElement('div');el.id='catpal';el.innerHTML='<div class="cpi">'+SVG+'</div>';document.body.append(el);
const W=50;let cur=null,pos=null,anim=null,raf=0,timer=0;
const onFeed=()=>!/^#\/(?!feed)/.test(location.hash)&&document.querySelector('#app .post');
const spot=p=>{const h=p.querySelector('.cov h3');if(!h)return null;const r=document.createRange();r.selectNodeContents(h);const rs=[...r.getClientRects()];if(!rs.length)return null;const t0=rs[0].top,ln=rs.filter(q=>Math.abs(q.top-t0)<6&&q.width>0),a={top:t0,right:Math.max(...ln.map(q=>q.right))},cv=p.querySelector('.cov').getBoundingClientRect();
  let x=Math.min(a.right+2,cv.right-W-6);x=Math.max(cv.left+4,x);return {x:x+scrollX,y:a.top+scrollY-W+10}};
const pick=()=>{const vh=innerHeight;let best=null,bd=1e9;document.querySelectorAll('#app .post').forEach(p=>{const c=p.querySelector('.cov');if(!c)return;const r=c.getBoundingClientRect();if(r.bottom<vh*.15||r.top>vh*.7)return;const d=Math.abs(r.top+r.height*.3-vh*.4);if(d<bd){bd=d;best=p}});return best};
const place=(p,jump)=>{const s=spot(p);if(!s)return;if(!pos||!jump){if(anim){anim.cancel();anim=null}pos=s;el.style.transform=`translate(${s.x}px,${s.y}px)`;el.classList.add('on');return}
  const a=pos,b=s,dy=b.y-a.y,lift=Math.min(140,60+Math.abs(dy)*.15),top=Math.min(a.y,b.y)-lift,K=[];const N=14;
  for(let i=0;i<=N;i++){const t=i/N,x=a.x+(b.x-a.x)*t,y=(1-t)*(1-t)*a.y+2*(1-t)*t*(top*2-(a.y+b.y)/2)+t*t*b.y;K.push({transform:`translate(${x}px,${y}px)`})}
  const dur=Math.min(900,480+Math.abs(dy)*.25);el.classList.add('jmp');el.classList.toggle('fl',b.x<a.x);if(anim)anim.cancel();
  anim=el.animate(K,{duration:dur,easing:'cubic-bezier(.45,.05,.35,1)'});pos=b;el.style.transform=`translate(${b.x}px,${b.y}px)`;
  anim.onfinish=()=>{anim=null;el.classList.remove('jmp');el.classList.remove('land');void el.offsetWidth;el.classList.add('land')}};
const tick=()=>{raf=0;if(!onFeed()||H.classList.contains('iwait')||H.classList.contains('ibye')){el.classList.remove('on');cur=null;pos=null;return}
  const p=pick();if(!p){el.classList.add('off');return}el.classList.remove('off');
  if(p!==cur){const first=!cur;cur=p;if(first){place(p,false);el.classList.add('pop')}else{clearTimeout(timer);timer=setTimeout(()=>place(cur,true),160)}}
  else if(!anim){const s=spot(p);if(s&&pos&&(Math.abs(s.x-pos.x)>2||Math.abs(s.y-pos.y)>2))place(p,false)}};
const q=()=>{raf||(raf=requestAnimationFrame(tick))};addEventListener('scroll',q,{passive:true});addEventListener('resize',q);addEventListener('hashchange',()=>{cur=null;pos=null;el.classList.remove('on');setTimeout(q,400)});
document.addEventListener('visibilitychange',()=>el.classList.toggle('pz',document.hidden));
const go=()=>{const a=document.querySelector('#app');if(!a)return setTimeout(go,50);new MutationObserver(()=>setTimeout(q,60)).observe(a,{childList:true,subtree:true});setInterval(q,1000);q()};
const start=()=>H.classList.contains('iwait')||H.classList.contains('ibye')?setTimeout(start,200):setTimeout(go,2600);start();})();
