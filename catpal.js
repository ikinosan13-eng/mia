// v49 mockup: котик-компаньон (спрайты) сидит на заголовке пака и прыгает между паками
(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const H=document.documentElement;
const K=(innerWidth>700?70:60)/180; // сидит ~60px на телефоне, ~70px на десктопе
const CL={lick:{src:'cat/cat-lick.webp',n:60,w:188,h:180,fps:10,loop:[...Array(60).keys()]},down:{src:'cat/cat-down.webp',n:40,w:197,h:300,r:[10,36]},up:{src:'cat/cat-up.webp',n:40,w:189,h:224,r:[14,32]}};
const el=document.createElement('div');el.id='mcat';el.innerHTML='<div class="mw"><div class="ms"></div></div>';const sp=el.querySelector('.ms'),mw=el.querySelector('.mw');
let ready=false,clip=null,frame=-1,pos=null,curP=null,busy=false,want=null,stable=0,raf=0,t0=0,flip=1,app=null;
const setClip=c=>{if(clip===c)return;clip=c;const C=CL[c],k=K;const w=C.w*k,h=C.h*k;
  sp.style.cssText=`width:${w}px;height:${h}px;margin-left:${-w/2}px;margin-top:${-h}px;background-image:url(${C.src});background-size:${C.n*w}px ${h}px`;sp._w=w;frame=-1};
const setFrame=f=>{if(f===frame)return;frame=f;sp.style.backgroundPosition=`${-f*sp._w}px 0`};
const posts=()=>[...document.querySelectorAll('#app .post')].filter(p=>p.querySelector('.cov h3'));
const spot=p=>{const cv=p.querySelector('.cov');if(!cv)return null;const C=cv.getBoundingClientRect(),A=app.getBoundingClientRect(),sp=[...p.querySelectorAll('.ph>span')].map(e=>e.getBoundingClientRect()),cw=CL.lick.w*K*.6;
  const lab=sp[1],dat=sp[0];let x=(lab?lab.left-10:C.right-24)-cw/2;if(dat)x=Math.max(x,dat.right+10+cw/2);x=Math.min(x,C.right-24-cw/2);return {x:x-A.left,y:C.top-A.top+2}};
const put=(x,y)=>{el.style.transform=`translate(${x}px,${y}px)`};
let lastY=scrollY,dir=1;addEventListener('scroll',()=>{const y=scrollY;if(Math.abs(y-lastY)>2){dir=y>lastY?1:-1;lastY=y}},{passive:true});
const inView=p=>{const s=spot(p);if(!s)return false;const v=s.y+app.getBoundingClientRect().top;return v>110&&v<innerHeight-40};
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const tween=(d,f)=>new Promise(r=>{const s=performance.now();const st=n=>{const k=Math.min(1,(n-s)/d);f(k);k<1?requestAnimationFrame(st):r()};requestAnimationFrame(st)});
async function hop(to){busy=true;const a=pos,b=spot(to);if(!b){busy=false;return}const down=b.y>a.y;flip=b.x<a.x?-1:1;
  // заметила: подёргивание и поворот
  await tween(260,k=>{const w=Math.sin(k*Math.PI*3)*(1-k);mw.style.transform=`scaleX(${flip}) rotate(${w*7}deg)`});
  // присела
  await tween(200,k=>{mw.style.transform=`scaleX(${flip*(1+.12*k)}) scaleY(${1-.16*k})`});
  setClip(down?'down':'up');const C=CL[clip];const top=Math.min(a.y,b.y)-(down?70:110),D=Math.min(950,700+Math.abs(b.y-a.y)*.15);
  await tween(D,k=>{const e=ease(k),bb=spot(to)||b,x=a.x+(bb.x-a.x)*e,cy=2*top-(a.y+bb.y)/2,y=(1-e)*(1-e)*a.y+2*(1-e)*e*cy+e*e*bb.y;put(x,y);pos={x,y};
    {let f=Math.min(C.r[1],C.r[0]+Math.floor(k*(C.r[1]-C.r[0]+1)));if(clip=="up"&&f==20)f=21;setFrame(f)};const sq=k<.15?1+.1*(1-k/.15):1;mw.style.transform=`scaleX(${flip/sq}) scaleY(${sq})`});
  setClip('lick');setFrame(CL.lick.loop[0]);pos=spot(to)||b;put(pos.x,pos.y);curP=to;
  const cv=to.querySelector('.cov');cv&&cv.animate([{transform:'none'},{transform:'translateY(3px)'},{transform:'none'}],{duration:380,easing:'ease-out'});
  await tween(320,k=>{const s=Math.sin(k*Math.PI)*(1-k*.4);mw.style.transform=`scaleX(${flip*(1+.18*s)}) scaleY(${1-.2*s})`});mw.style.transform=`scaleX(${flip})`;t0=performance.now();busy=false};
const loop=n=>{raf=requestAnimationFrame(loop);if(!app||!document.contains(app)){return}if(!el.isConnected)app.append(el);
  if(/^#\/(?!feed)/.test(location.hash)||H.classList.contains('iwait')||H.classList.contains('ibye')){el.classList.remove('on');curP=null;return}
  if(busy)return;const ps=posts();if(!ps.length)return;
  if(!curP||!document.contains(curP)){const p=ps.find(inView);if(!p)return;curP=p;pos=spot(p);if(!pos)return;put(pos.x,pos.y);setClip('lick');el.classList.add('on');t0=n}
  const s=spot(curP);if(s&&(Math.abs(s.x-pos.x)>1||Math.abs(s.y-pos.y)>1)){pos=s;put(s.x,s.y)}
  const r=el.getBoundingClientRect();if(r.bottom>-50&&r.top<innerHeight+50){const L=CL.lick.loop;setFrame(L[Math.floor((n-t0)/1000*CL.lick.fps)%L.length])};
  const fy=pos.y+app.getBoundingClientRect().top,i=ps.indexOf(curP);let tgt=null;
  if(dir>0&&fy<75){for(let j=i+1;j<ps.length;j++)if(inView(ps[j])){tgt=ps[j];break}}
  else if(dir<0&&fy>innerHeight-75+0){for(let j=i-1;j>=0;j--)if(inView(ps[j])){tgt=ps[j];break}}
  if(tgt)hop(tgt)};
const load=s=>new Promise(r=>{const i=new Image();i.onload=i.onerror=r;i.src=s});
const start=async()=>{if(H.classList.contains('iwait')||H.classList.contains('ibye'))return setTimeout(start,200);await new Promise(r=>setTimeout(r,2200));
  await load(CL.lick.src);app=document.querySelector('#app');setClip('lick');raf=requestAnimationFrame(loop);load(CL.down.src);load(CL.up.src)};
(document.readyState=='complete'?start():addEventListener('load',start));})();
