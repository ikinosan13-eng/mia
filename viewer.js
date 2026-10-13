// Кинорежим просмотра пака: затемнение, надпись, проявка арта, музыка по нажатию.
(() => {
const DEFV = { enabled: true, style: "curtain", duration: 6, full: "daily", text: "Устраивайся поудобнее, мур мяу 💕", text_locked: "Только для тебя 💕", art: null, music_on: true, volume: 40, track: null, tracks: {}, skip: true, strip: true };
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
let V, st = {}, timers = [], audio = null, ac = null, acGain = null, fadeT = null;
const T = (f, ms) => timers.push(setTimeout(f, RM ? 0 : ms));
const el = id => V.querySelector("#v-" + id);
function build() {
  V = document.createElement("div"); V.className = "viewer"; V.setAttribute("aria-hidden", "true");
  V.innerHTML = `<div class="curtain"></div><div class="intro" id="v-intro"><div class="mia" id="v-mia"></div><div class="hello" id="v-hello"></div></div>
  <div class="vtop"><button id="v-x" class="ib" title="Закрыть">✕</button><div class="vcnt" id="v-cnt"></div><div class="r"><button id="v-mu" class="ib" title="Музыка">🎵</button><button id="v-fs" class="ib" title="Во весь экран">⛶</button></div></div>
  <button id="v-skip" class="vskip">Пропустить ›</button><div class="vload" id="v-load">Загрузка…</div>
  <div class="vstage" id="v-stage"><div class="art" id="v-a1"></div><div class="art" id="v-a2"></div><button class="vnav l" id="v-pv">‹</button><button class="vnav rr" id="v-nx">›</button></div>
  <div class="vttl" id="v-ttl"><h2></h2><p></p></div><div class="vstrip" id="v-strip"></div>
  <div class="vbot"><button class="vpill" id="v-lk"></button><button class="vpill" id="v-cm"></button><div class="eq"><i></i><i></i><i></i><i></i></div></div>`;
  document.body.append(V);
  el("x").onclick = close; el("skip").onclick = finish; el("nx").onclick = () => show(st.i + 1); el("pv").onclick = () => show(st.i - 1);
  el("fs").onclick = () => document.fullscreenElement ? document.exitFullscreen() : V.requestFullscreen?.();
  el("mu").onclick = () => toggleMute();
  el("lk").onclick = async () => { await window.Mia.toggleLike(st.post.id); drawBot(); };
  el("cm").onclick = () => { const id = st.post.id; close(); location.hash = "#/post/" + id + "/c"; };
  addEventListener("keydown", e => { if (!V.classList.contains("on")) return; if (e.key == "ArrowRight") show(st.i + 1); if (e.key == "ArrowLeft") show(st.i - 1); if (e.key == "Escape") close(); });
  let sx = 0; el("stage").addEventListener("touchstart", e => sx = e.touches[0].clientX, { passive: true });
  el("stage").addEventListener("touchend", e => { const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 40) show(st.i + (d < 0 ? 1 : -1)); });
}
function drawBot() { const p = st.post, S = window.Mia.S; el("lk").textContent = `${S.liked.has(p.id) ? "❤" : "♡"} ${p.like_count || 0}`; el("lk").classList.toggle("liked", S.liked.has(p.id)); el("cm").textContent = `💬 ${p.comment_count || 0}`; }
// ---- music: must start inside the tap gesture ----
function startMusic(c, post) {
  stopMusic(true); if (!c.music_on) return;
  const vol = Math.max(0, Math.min(1, (c.volume ?? 40) / 100)), track = (c.tracks || {})[post.id] || c.track;
  if (track) {
    audio = new Audio(window.Mia.pub(track, "media")); audio.loop = true; audio.volume = 0; audio.play().catch(() => { audio = null; V.classList.remove("music"); el("mu").classList.remove("act"); });
    let v = 0; clearInterval(fadeT); fadeT = setInterval(() => { if (!audio) return clearInterval(fadeT); v = Math.min(vol, v + vol / 30); audio.volume = v; if (v >= vol) clearInterval(fadeT); }, 80);
  } else {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    acGain = ac.createGain(); acGain.gain.value = 0; acGain.gain.setTargetAtTime(vol * 0.15, ac.currentTime, 1.5);
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; f.connect(acGain); acGain.connect(ac.destination);
    [220, 277.18, 329.63, 440].forEach((hz, k) => { const o = ac.createOscillator(); o.type = k % 2 ? "triangle" : "sine"; o.frequency.value = hz; o.detune.value = (k - 1.5) * 6;
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = .1 + k * .05; lg.gain.value = 4; l.connect(lg); lg.connect(o.detune); l.start(); o.connect(f); o.start(); });
  }
  V.classList.add("music"); el("mu").classList.add("act"); st.muted = false;
}
function stopMusic(now) {
  clearInterval(fadeT);
  if (audio) { const a = audio; audio = null; let v = a.volume; const t = setInterval(() => { v -= 0.05; if (v <= 0 || now) { clearInterval(t); a.pause(); } else a.volume = v; }, 60); }
  if (ac) { const c = ac; acGain.gain.setTargetAtTime(0, c.currentTime, .3); ac = null; setTimeout(() => c.close(), now ? 0 : 1200); }
  V && V.classList.remove("music"); V && el("mu").classList.remove("act");
}
function toggleMute() {
  st.muted = !st.muted; el("mu").classList.toggle("act", !st.muted); V.classList.toggle("music", !st.muted);
  if (audio) audio.muted = st.muted; else if (ac) acGain.gain.setTargetAtTime(st.muted ? 0 : (st.cfg.volume ?? 40) / 100 * .15, ac.currentTime, .3);
  else if (!st.muted) startMusic({ ...st.cfg, music_on: true }, st.post);
}
// ---- slides ----
function show(k, slow) {
  if (!st.imgs?.length) return; const n = st.imgs.length; st.i = (k + n) % n;
  [st.front, st.back] = [st.back, st.front]; const f = st.front;
  f.classList.toggle("slow", !!slow); f.style.backgroundImage = `url("${st.imgs[st.i]}")`;
  f.classList.remove("show"); void f.offsetWidth; f.classList.add("show"); st.back.classList.remove("show");
  el("cnt").textContent = `${st.i + 1} / ${n}`;
  [...el("strip").children].forEach((d, m) => d.classList.toggle("cur", m == st.i));
  el("strip").children[st.i]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
}
function finish() {
  timers.forEach(clearTimeout); timers = []; el("intro").classList.add("out");
  const go = () => { el("load").classList.remove("on"); if (!st.front.classList.contains("show")) show(st.start || 0, true); V.classList.add("ui"); el("strip").classList.add("on"); el("ttl").classList.add("on"); };
  if (st.imgs) go(); else { el("load").classList.add("on"); st.pending = go; }
}
function isShort(c) { if (c.full == "always") return false; const d = new Date().toDateString(), r = localStorage.miaIntro == d; localStorage.miaIntro = d; return r; }
// open(post, imgsPromise, {start, quick}) — call synchronously from the tap handler
function open(post, imgsP, o = {}) {
  if (!V) build(); const c = { ...DEFV, ...(window.Mia.S.viewer || {}) }; timers.forEach(clearTimeout); timers = [];
  st = { post, cfg: c, i: 0, start: o.start || 0, imgs: null, front: el("a1"), back: el("a2") };
  startMusic(c, post);
  const style = !c.enabled ? "none" : c.style, short = o.quick || style != "curtain" || isShort(c) || RM;
  V.className = "viewer on" + (short ? " short" : "") + (style == "none" ? " none" : "") + (style == "develop" ? " dev-only" : "") + (c.music_on && !st.muted ? " music" : "");
  V.setAttribute("aria-hidden", "false"); document.documentElement.classList.add("v-open");
  for (const a of [el("a1"), el("a2")]) { a.classList.toggle("dev", style != "none"); a.classList.remove("show"); a.style.backgroundImage = ""; }
  el("intro").classList.remove("out"); el("hello").innerHTML = ""; el("mia").classList.remove("on"); el("skip").classList.toggle("hide", !c.skip); el("strip").classList.remove("on"); el("ttl").classList.remove("on");
  el("mia").style.backgroundImage = c.art ? `url("${window.Mia.pub(c.art, "media")}")` : ""; el("mia").classList.toggle("noart", !c.art);
  el("ttl").querySelector("h2").textContent = post.title; el("ttl").querySelector("p").textContent = `пак · ${post.image_count} ${window.Mia.plural(post.image_count, "арт", "арта", "артов")}${post.tier_rank > 0 ? " · " + post.tier_name : ""}`;
  el("cnt").textContent = ""; el("strip").innerHTML = ""; el("strip").classList.toggle("hide", !c.strip); drawBot();
  imgsP.then(imgs => { if (st.post !== post) return; if (!imgs.length) { el("load").textContent = "В паке пока нет артов"; el("load").classList.add("on"); } st.imgs = imgs; el("strip").innerHTML = "";
    imgs.forEach((u, k) => { const d = document.createElement("div"); d.style.backgroundImage = `url("${u}")`; d.style.transitionDelay = (k * .06) + "s"; d.onclick = () => show(k); el("strip").append(d); });
    imgs.slice(0, 3).forEach(u => { const i = new Image(); i.src = u; });
    if (st.pending) { const p = st.pending; st.pending = null; p(); } }).catch(() => { el("load").textContent = "Не удалось загрузить арты"; el("load").classList.add("on"); });
  if (style == "none") { T(finish, 50); return; }
  const D = Math.max(2, Math.min(12, +c.duration || 6)) * 1000;
  if (short) { T(() => { if (st.imgs) show(st.start, true); }, 500); T(finish, style == "develop" ? 2600 : 1500); return; }
  const text = post.tier_rank > 0 && c.text_locked ? c.text_locked : c.text;
  T(() => { el("mia").classList.add("on"); [...(text || "")].forEach((ch, k) => { const e = document.createElement("b"); e.textContent = ch; el("hello").append(e); setTimeout(() => e.classList.add("on"), k * 70); }); }, D * 0.33);
  T(() => el("intro").classList.add("out"), D * 1.0);
  T(() => { if (st.imgs) show(st.start, true); }, D * 1.12);
  T(finish, D * 1.4);
}
function close() {
  if (!V) return; timers.forEach(clearTimeout); timers = []; stopMusic(); V.classList.add("closing"); V.classList.remove("ui");
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  setTimeout(() => { V.className = "viewer"; V.setAttribute("aria-hidden", "true"); document.documentElement.classList.remove("v-open"); st.post = null; }, 900);
}
window.MiaViewer = { open, close, DEFV, isOpen: () => V?.classList.contains("on") };
})();
