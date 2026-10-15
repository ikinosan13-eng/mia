// v49 mockup: котик-компаньон (спрайты) сидит на заголовке пака и прыгает между паками
(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const H=document.documentElement;
const K=100/180; // css px на px спрайта (100px высота на телефоне)
const CL={lick:{src:'cat/cat-lick.webp',n:72,w:202,h:180,fps:12},down:{src:'cat/cat-down.webp',n:40,w:155,h:338},up:{src:'cat/cat-up.webp',n:35,w:210,h:276}};
const el=document.createElement('div');el.id='mcat';el.innerHTML='<div class="mw"><div class="ms"></div></div>';const sp=el.querySelector('.ms'),mw=el.querySelector('.mw');
let ready=false,clip=null,frame=-1,pos=null,curP=null,busy=false,want=null,stable=0,raf=0,t0=0,flip=1,app=null;
const setClip=c=>{if(clip===c)return;clip=c;const C=CL[c],k=K;const w=C.w*k,h=C.h*k;
  sp.style.cssText=`width:${w}px;height:${h}px;margin-left:${-w/2}px;margin-top:${-h}px;background-image:url(${C.src});background-size:${C.n*w}px ${h}px`;sp._w=w;frame=-1};
const setFrame=f=>{if(f===frame)return;frame=f;sp.style.backgroundPosition=`${-f*sp._w}px 0`};
const posts=()=>[...document.querySelectorAll('#app .post')].filter(p=>p.querySelector('.cov h3'));
const spot=p=>{const h=p.querySelector('.cov h3'),cv=p.querySelector('.cov').getBoundingClientRect(),A=app.getBoundingClientRect();const r=document.createRange();r.selectNodeContents(h);const rs=[...r.getClientRects()].filter(q=>q.width>0);if(!rs.length)return null;
  const t=rs[0].top,ln=rs.filter(q=>Math.abs(q.top-t)<6),right=Math.max(...ln.map(q=>q.right));let x=Math.min(right+34,cv.right-40);x=Math.max(cv.left+40,x);return {x:x-A.left,y:t+8-A.top}};
const put=(x,y)=>{el.style.transform=`translate(${x}px,${y}px)`};
const active=()=>{const vh=innerHeight;let best=null,bd=1e9;for(const p of posts()){const r=p.querySelector('.cov').getBoundingClientRect();const c=r.top+r.height*.35;if(r.bottom<0||r.top>vh)continue;const d=Math.abs(c-vh*.45);if(d<bd){bd=d;best=p}}return best};
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const tween=(d,f)=>new Promise(r=>{const s=performance.now();const st=n=>{const k=Math.min(1,(n-s)/d);f(k);k<1?requestAnimationFrame(st):r()};requestAnimationFrame(st)});
async function hop(to){busy=true;const a=pos,b=spot(to);if(!b){busy=false;return}const down=b.y>a.y;flip=b.x<a.x?-1:1;
  // присела
  await tween(200,k=>{mw.style.transform=`scaleX(${flip*(1+.12*k)}) scaleY(${1-.16*k})`});
  setClip(down?'down':'up');const C=CL[clip];const top=Math.min(a.y,b.y)-(down?70:110),D=Math.min(950,700+Math.abs(b.y-a.y)*.15);
  await tween(D,k=>{const e=ease(k),bb=spot(to)||b,x=a.x+(bb.x-a.x)*e,cy=2*top-(a.y+bb.y)/2,y=(1-e)*(1-e)*a.y+2*(1-e)*e*cy+e*e*bb.y;put(x,y);pos={x,y};
    setFrame(Math.min(C.n-1,Math.floor((down?k:(.25+k*.75))*C.n)));const sq=k<.15?1+.1*(1-k/.15):1;mw.style.transform=`scaleX(${flip/sq}) scaleY(${sq})`});
  setClip('lick');setFrame(0);pos=spot(to)||b;put(pos.x,pos.y);curP=to;
  const cv=to.querySelector('.cov');cv&&cv.animate([{transform:'none'},{transform:'translateY(3px)'},{transform:'none'}],{duration:380,easing:'ease-out'});
  await tween(320,k=>{const s=Math.sin(k*Math.PI)*(1-k*.4);mw.style.transform=`scaleX(${flip*(1+.18*s)}) scaleY(${1-.2*s})`});mw.style.transform=`scaleX(${flip})`;t0=performance.now();busy=false};
const loop=n=>{raf=requestAnimationFrame(loop);if(!app||!document.contains(app)){return}if(!el.isConnected)app.append(el);
  if(/^#\/(?!feed)/.test(location.hash)||H.classList.contains('iwait')||H.classList.contains('ibye')){el.classList.remove('on');curP=null;return}
  if(busy)return;const ps=posts();if(!ps.length)return;
  if(!curP||!document.contains(curP)){const p=active();if(!p)return;curP=p;pos=spot(p);if(!pos)return;put(pos.x,pos.y);setClip('lick');el.classList.add('on');t0=n}
  const s=spot(curP);if(s&&(Math.abs(s.x-pos.x)>1||Math.abs(s.y-pos.y)>1)){pos=s;put(s.x,s.y)}
  const r=el.getBoundingClientRect();if(r.bottom>-50&&r.top<innerHeight+50)setFrame(Math.floor((n-t0)/1000*CL.lick.fps)%CL.lick.n);
  const a=active();if(a&&a!==curP){if(want!==a){want=a;stable=n}if(n-stable>260){const i=ps.indexOf(curP),j=ps.indexOf(a);const nx=ps[i+Math.sign(j-i)];if(nx)hop(nx)}}else want=null};
const load=s=>new Promise(r=>{const i=new Image();i.onload=i.onerror=r;i.src=s});
const start=async()=>{if(H.classList.contains('iwait')||H.classList.contains('ibye'))return setTimeout(start,200);await new Promise(r=>setTimeout(r,2200));
  await load(CL.lick.src);app=document.querySelector('#app');setClip('lick');raf=requestAnimationFrame(loop);load(CL.down.src);load(CL.up.src)};
(document.readyState=='complete'?start():addEventListener('load',start));})();
