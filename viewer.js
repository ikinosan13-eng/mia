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
  <div class="vchrome top"><div class="vtop"><button id="v-x" class="ib" title="Закрыть">✕</button><div class="vcnt" id="v-cnt"></div><div class="r"><button id="v-mu" class="ib" title="Музыка">🎵</button><button id="v-fs" class="ib" title="Во весь экран">⛶</button></div></div></div>
  <button id="v-skip" class="vskip">Пропустить ›</button><div class="vload" id="v-load">Загрузка…</div>
  <div class="vstage" id="v-stage"><div class="art" id="v-a1"></div><div class="art" id="v-a2"></div><div class="vlc" id="v-lc"></div><button class="vnav l" id="v-pv" title="Предыдущий арт"><span>‹</span></button><button class="vnav rr" id="v-nx" title="Следующий арт"><span>›</span></button></div>
  <div class="vchrome bot"><div class="vttl" id="v-ttl"><div class="row"><button class="parr" id="v-pp" title="Предыдущий пак">‹</button><h2></h2><button class="parr" id="v-pn" title="Следующий пак">›</button></div><p></p></div><div class="vstrip" id="v-strip"></div>
  <div class="vbot"><button class="vpill" id="v-lk"></button><button class="vpill" id="v-cm"></button><div class="eq"><i></i><i></i><i></i><i></i></div></div></div>
  <div class="pstrip" id="v-ps"></div><div class="vbz" id="v-bz"></div><div class="vtz" id="v-tz"></div><div class="vfc" id="v-fc"></div>`;
  document.body.append(V);
  el("x").onclick = close; el("skip").onclick = finish; // боковые зоны больше не листают: тап открывает нижнюю плашку с артами (как тап внизу)
  // кнопка ‹ › — листает (без перескока через край); остальная боковая зона — открывает плашку
  // ‹ › — листают по кругу (как свайп и стрелки клавиатуры); остальная боковая зона — открывает плашку
  const side = d => e => { e.stopPropagation(); if (e.target.closest("span") && !V.classList.contains("lkd")) { step(d); hideBar(); wake(); } else togBar(); };
  el("nx").onclick = side(1); el("pv").onclick = side(-1);
  el("fs").onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {});
  el("mu").onclick = () => toggleMute();
  el("lk").onclick = async () => { await window.Mia.toggleLike(st.post.id); drawBot(); };
  el("cm").onclick = () => window.Mia.openComments(st.post.id, drawBot);
  el("pp").onclick = () => pack(-1); el("pn").onclick = () => pack(1);
  addEventListener("keydown", e => { if (!V.classList.contains("on") || document.querySelector(".cs,#modal")) return;
    if (e.key == "ArrowRight" || e.key == "ArrowLeft") { const d = e.key == "ArrowRight" ? 1 : -1; e.shiftKey ? pack(d) : step(d); wake(); }
    if (e.key == "Escape") close(); });
  // арт: свайп листает; нижнюю плашку не трогает
  let sx = null; el("stage").addEventListener("pointerdown", e => sx = e.clientX);
  el("stage").addEventListener("pointerup", e => { if (sx === null) return; const d = e.clientX - sx; sx = null; if (Math.abs(d) > 40) step(d < 0 ? 1 : -1);
    // тап по центру арта (не боковые зоны/кнопки, не панель закрытого пака) закрывает открытую нижнюю плашку
    else if (Math.abs(d) < 10 && !e.target.closest(".vnav,.lfull,button")) togBar();
    wake(); });
  // верхняя панель (✕) прячется через 2 с без касаний
  V.querySelector(".vchrome.top").addEventListener("pointerenter", () => { over = 1; clearTimeout(hideT); });
  V.querySelector(".vchrome.top").addEventListener("pointerleave", () => { over = 0; wake(); });
  V.addEventListener("mousemove", wake);
  // нижняя плашка: появляется только по тапу в её зоне, пока с ней работают — держится, потом быстро гаснет
  el("bz").addEventListener("pointerup", e => { e.preventDefault();
    // в закрытом паке кнопка «Подписаться» может оказаться под нижней зоной — нажимаем её
    const b = V.classList.contains("lkd") && el("buy"), r = b && b.getBoundingClientRect();
    if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return b.click();
    bar(0); });
  el("tz").addEventListener("click", e => { e.stopPropagation(); if (tz) tz.done(); });
  V.querySelectorAll(".vchrome.bot,.pstrip").forEach(c => { c.addEventListener("pointerdown", () => { if (V.classList.contains("bar") && !barStay) bar(1500); }); c.addEventListener("scroll", () => { if (V.classList.contains("bar") && !barStay) bar(1500); }, true); });
  // полоса паков: перетаскивание мышью, тап выбирает
  const ps = el("ps"); let x0 = null, sl = 0, moved = 0;
  ps.addEventListener("pointerdown", e => { moved = 0; if (e.pointerType != "mouse") return; x0 = e.clientX; sl = ps.scrollLeft; });
  addEventListener("pointermove", e => { if (x0 === null) return; const d = e.clientX - x0; if (Math.abs(d) > 4) moved = 1; ps.scrollLeft = sl - d; });
  addEventListener("pointerup", () => x0 = null);
  ps.addEventListener("click", e => { if (moved) return; const t = e.target.closest("[data-p]"); if (!t) return; const p = window.Mia.S.posts.find(x => x.id == t.dataset.p); if (!p) return; if (locked(p)) { if (p.id != st.post.id || !V.classList.contains("lkd")) goPack(p); teaser(p); } else goPack(p); });
}
let hideT = null, over = 0, barT = null, barStay = 0;
// bar(0): плашка остаётся, пока не выберут другой арт в полосе
function bar(ms) { if (!V) return; V.classList.add("bar"); clearTimeout(barT); barStay = ms === 0 ? 1 : 0; if (barStay) return; barT = setTimeout(() => { if (!document.querySelector(".cs")) V.classList.remove("bar"); else bar(ms); }, RM ? ms : ms); }
// плашка: тап по арту открывает, следующий тап закрывает; ‹ › и выбор арта в полосе — закрывают
function hideBar() { if (!V) return; barStay = 0; clearTimeout(barT); V.classList.remove("bar"); }
function togBar() { V.classList.contains("bar") ? hideBar() : bar(0); }
function wake() { if (!V) return; V.classList.remove("idle"); clearTimeout(hideT); if (!V.classList.contains("ui")) return; hideT = setTimeout(() => { if (!over && !document.querySelector(".cs")) V.classList.add("idle"); }, 2000); }
const locked = p => window.Mia.isLocked(p);
// прокрутка полосы к элементу без сдвига самого кинорежима (scrollIntoView двигал и предков)
function center(box, c, behavior) { if (!c) return; const b = box.getBoundingClientRect(), r = c.getBoundingClientRect(); box.scrollTo({ left: box.scrollLeft + r.left - b.left - (b.width - r.width) / 2, behavior: behavior || "auto" }); }
function drawPacks() {
  const M = window.Mia, ps = el("ps");
  ps.innerHTML = M.S.posts.map(p => `<div data-p="${p.id}" class="p${p.id == st.post.id ? " cur" : ""}${locked(p) ? " lk" : ""}" title="${M.esc(p.title)}" style="background-image:url('${M.pub(p.cover_path)}')"></div>`).join("");
  center(ps, ps.querySelector(".cur"));
}
// стрелки паков: по кругу, закрытые паки не пропускаем — показываем карточку с замком
function pack(d) { const P = window.Mia.S.posts, n = P.length; if (!n) return; const k = P.findIndex(p => p.id == st.post.id); goPack(P[(k + d + n) % n]); }
// листание артов: одна функция для ‹ ›, свайпа и клавиатуры, по кругу
function step(d) { if (st.imgs?.length) show(st.i + d); }
// подписка на закрытый пак (окно с кодом внутри кинорежима)
function sub(p) { window.Mia.subscribe(p.tier_rank, p.id, { stay: () => { if (st.post !== p || locked(p)) return; goPack(p); } }); }
// превью закрытого пака: 1–2 размытые миниатюры с водяным знаком и замком, затем «Подписаться».
// Только миниатюры из бакета previews (размытие всегда через CSS) — настоящие арты не показываем.
let tz = null;
// превью арта пака строго по порядку в паке (position): арт №1 и №2, без случайности
const packPv = p => window.Mia.S.media.filter(m => m.post_id == p.id && m.preview_path).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
// плашка «Подписаться» поверх арта — как на карточке закрытого пака (подпись уровня + цена)
function plate(p) { const M = window.Mia; return `<div class="tzp"><span class="mu">${M.esc(M.T("locked_label"))}</span><b>${M.esc(p.tier_name || "")}${p.price_rub ? ` · ${p.price_rub} ₽/мес` : ""}</b><span class="ob">🔒 ${M.esc(M.T("btn_subscribe"))}</span></div>`; }
function teaser(p) {
  if (tz) return tz.done();
  const M = window.Mia, list = packPv(p).slice(0, 2).map(m => M.pub(m.preview_path));
  if (!list.length || RM) return sub(p);
  const box = el("tz"), ts = [];
  box.innerHTML = `<div class="tzw">${list.map(u => `<div class="im" style="background-image:url('${u}')"></div>`).join("")}${plate(p)}</div>`;
  const ims = [...box.querySelectorAll(".im")];
  const lf = el("lc").querySelector(".lfull"), w = box.firstChild;
  if (lf) { const r = lf.getBoundingClientRect(); Object.assign(w.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", maxWidth: "none", maxHeight: "none" }); }
  box.classList.add("on");
  ims.forEach((d, k) => ts.push(setTimeout(() => { ims.forEach(x => x.classList.toggle("on", x === d)); }, 30 + k * 1200)));
  tz = { done: () => { ts.forEach(clearTimeout); tz = null; box.classList.remove("on"); setTimeout(() => { if (!tz) box.innerHTML = ""; }, 350); if (st.post === p && V.classList.contains("on")) sub(p); } };
  ts.push(setTimeout(() => tz && tz.done(), list.length * 1200 + 30));
}
function stopTeaser() { if (!tz) return; const t = tz; tz = null; t.done = () => {}; el("tz").classList.remove("on"); el("tz").innerHTML = ""; }
// смена пака внутри просмотра: без длинного приветствия и без перезапуска музыки
function goPack(p) {
  if (p.id == st.post.id && !V.classList.contains("lkd")) return;
  if (locked(p)) return lockCard(p);
  stopTeaser(); V.classList.remove("lkd", "frm"); el("fc").innerHTML = ""; el("lc").innerHTML = "";
  st.post = p; st.imgs = null; st.i = 0; st.start = 0; title(p); drawBot(); drawPacks();
  el("cnt").textContent = ""; el("strip").innerHTML = ""; st.front.classList.remove("show"); st.back.classList.remove("show"); el("load").textContent = "Загрузка…";
  fill(p, window.Mia.loadImgs(p.id), () => { el("load").classList.remove("on"); show(0); el("strip").classList.add("on"); });
  if (!st.imgs) el("load").classList.add("on");
  wake();
}
// закрытый пак: остаёмся в кинорежиме, в центре карточка с постером и кнопкой «Купить пак»
// размер квадрата закрытого пака считаем в px (без cq/vw/translate — на Android они давали сдвиг)
function lkSize() { if (!V || !V.classList.contains("lkd")) return; const vb = Math.max(0, Math.round(el("stage").getBoundingClientRect().bottom - V.querySelector(".vchrome.bot").getBoundingClientRect().top)); V.style.setProperty("--vb", vb + "px");
  const c = el("lc"), cs = getComputedStyle(c), w = c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h = c.clientHeight - parseFloat(cs.paddingTop) - vb;
  V.style.setProperty("--fs", Math.max(120, Math.floor(Math.min(w, h))) + "px"); }
addEventListener("resize", () => lkSize());
function lockCard(p) {
  const M = window.Mia, n = p.image_count || 0; st.post = p; st.imgs = null; st.i = 0; st.pending = null;
  loadTok++; title(p); drawBot(); drawPacks(); el("cnt").textContent = ""; st.front.classList.remove("show"); st.back.classList.remove("show"); el("load").classList.remove("on", "err");
  V.classList.remove("frm"); el("fc").innerHTML = ""; V.classList.add("lkd"); lkSize(); V.style.setProperty("--lkbg", `url('${M.pub(p.cover_path)}')`);
  const pv = packPv(p);
  const fr = M.freeOf(p.id), isF = k => pv[k] && fr.includes(pv[k].position);
  el("strip").innerHTML = Array.from({ length: Math.min(n, 12) }, (_, k) => `<div class="tzt${isF(k) ? " fr" : ""}" data-k="${k}"><i${pv[k] ? ` style="background-image:url('${M.pub(pv[k].preview_path)}')"` : ""}></i></div>`).join(""); el("strip").classList.add("on");
  el("strip").querySelectorAll(".tzt").forEach(d => d.onclick = e => { e.stopPropagation(); const k = +d.dataset.k; if (isF(k)) return freeShow(p, fr.indexOf(pv[k].position)); teaser(p); });
  el("lc").innerHTML = `<div class="lfull"><img src="${M.pub(p.cover_path)}" alt=""><i class="lfz"></i><button class="llock" id="v-llk" title="${M.esc(M.T("btn_subscribe"))}"></button><h3>${M.esc(p.title)}</h3><span class="lcnt">${n} ${M.plural(n, "арт", "арта", "артов")}</span>
    <div class="frost lpan"><span class="mu">${M.esc(M.T("locked_label"))}</span><b>${M.esc(p.tier_name || "")}${p.price_rub ? ` · ${p.price_rub} ₽/мес` : ""}</b><button class="ob" id="v-buy">🔒 ${M.esc(M.T("btn_subscribe"))}</button>${M.pickBtn(p)}${fr.length ? `<button class="gb" id="v-free">🐾 Посмотреть ${fr.length} ${M.plural(fr.length, "арт", "арта", "артов")} бесплатно</button>` : ""}</div></div>`;
  el("buy").onclick = e => { e.stopPropagation(); sub(p); };
  if (el("free")) el("free").onclick = e => { e.stopPropagation(); freeShow(p, 0); };
  // тап по замку / обложке → превью → «Подписаться»; плашку не закрывает
  el("lc").querySelector(".lfull").onclick = e => { e.stopPropagation(); if (e.target.closest(".lpan") && !e.target.closest("#v-llk")) return; teaser(p); };
  wake();
}
// «Пробник»: показать бесплатные арты закрытого пака в полном качестве + плашка с подпиской/кодом
function freeShow(p, k = 0) {
  const M = window.Mia; stopTeaser(); st.post = p; st.imgs = null; st.pending = null; loadTok++;
  V.classList.remove("lkd"); V.classList.add("frm"); el("lc").innerHTML = ""; title(p); drawBot(); drawPacks();
  el("cnt").textContent = ""; el("strip").innerHTML = ""; el("load").textContent = "Мур, загружаю бесплатные арты… 🐾"; el("load").classList.remove("err"); el("load").classList.add("on");
  el("fc").innerHTML = M.freePlate(p);
  Promise.race([M.freeFn(p.id), new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 15000))]).then(list => { if (st.post !== p || !V.classList.contains("frm")) return;
    if (!list.length) return lockCard(p);
    st.imgs = list.map(x => x.url);
    list.forEach((x, m) => { const d = document.createElement("div"); d.className = "fr"; d.style.backgroundImage = `url("${x.url}")`; d.onclick = () => { show(m); hideBar(); }; el("strip").append(d); });
    const lk = document.createElement("div"); lk.className = "tzt"; lk.innerHTML = `<i style="background-image:url('${M.pub(p.cover_path)}')"></i>`; lk.onclick = e => { e.stopPropagation(); lockCard(p); }; el("strip").append(lk);
    el("strip").classList.add("on"); show(Math.min(k, list.length - 1));
  }).catch(() => { if (st.post !== p) return; el("load").textContent = "Мяу, бесплатные арты не загрузились 🐾 Попробуй ещё раз"; el("load").classList.add("on", "err"); });
  wake();
}
function title(post) { el("ttl").querySelector("h2").textContent = post.title; el("ttl").querySelector("p").textContent = `пак · ${post.image_count} ${window.Mia.plural(post.image_count, "арт", "арта", "артов")}${post.tier_rank > 0 ? " · " + post.tier_name : ""}`; }
function fill(post, imgsP, then) {
  imgsP.then(imgs => { if (st.post !== post) return; if (!imgs.length) { el("load").textContent = "В паке пока нет артов"; el("load").classList.add("on"); } st.imgs = imgs; el("strip").innerHTML = "";
    imgs.forEach((u, k) => { const d = document.createElement("div"); d.style.backgroundImage = `url("${u}")`; d.style.transitionDelay = (k * .06) + "s"; d.onclick = () => { show(k); hideBar(); }; el("strip").append(d); });
    imgs.slice(0, 3).forEach(u => { const i = new Image(); i.src = u; });
    if (then) then(); else if (st.pending) { const p = st.pending; st.pending = null; p(); } }).catch(() => { if (st.post !== post) return; el("load").textContent = "Мяу, арты не загрузились 🐾 Проверь интернет и открой пак ещё раз"; el("load").classList.add("on"); });
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
// смена арта: плашка «Загрузка…» висит, пока картинка не загружена и не декодирована; анимация появления — только после
let loadTok = 0;
function show(k, slow) {
  if (!st.imgs?.length) return; const n = st.imgs.length; st.i = (k + n) % n;
  const i = st.i, url = st.imgs[i], tok = ++loadTok, post = st.post;
  el("cnt").textContent = `${i + 1} / ${n}`;
  [...el("strip").children].forEach((d, m) => d.classList.toggle("cur", m == i));
  center(el("strip"), el("strip").children[i], "smooth");
  const im = new Image(); im.src = url;
  const ready = () => { if (tok != loadTok || st.post !== post) return; el("load").classList.remove("on", "err");
    [st.front, st.back] = [st.back, st.front]; const f = st.front;
    f.classList.toggle("slow", !!slow); f.style.backgroundImage = `url("${url}")`;
    f.classList.remove("show"); void f.offsetWidth; f.classList.add("show"); st.back.classList.remove("show"); };
  const fail = () => { if (tok != loadTok || st.post !== post) return; st.front.classList.remove("show"); st.back.classList.remove("show");
    el("load").textContent = "Не удалось загрузить арт"; el("load").classList.add("on", "err"); };
  if (im.complete && im.naturalWidth) return ready();
  el("load").textContent = "Загрузка…"; el("load").classList.remove("err"); el("load").classList.add("on");
  im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(ready); im.onerror = fail;
}
function finish() {
  timers.forEach(clearTimeout); timers = []; el("intro").classList.add("out");
  const go = () => { el("load").classList.remove("on"); if (!st.front.classList.contains("show")) show(st.start || 0, true); V.classList.add("ui"); el("strip").classList.add("on"); el("ttl").classList.add("on"); wake(); bar(0); };
  if (st.imgs) go(); else { el("load").classList.add("on"); st.pending = go; }
}
function isShort(c) { if (c.full == "always") return false; const d = new Date().toDateString(), r = localStorage.miaIntro == d; localStorage.miaIntro = d; return r; }
// open(post, imgsPromise, {start, quick}) — call synchronously from the tap handler
let vGen = 0; // открытие сразу после закрытия отменяет отложенную очистку закрытия
function open(post, imgsP, o = {}) {
  if (!V) build(); vGen++; const c = { ...DEFV, ...(window.Mia.S.viewer || {}) }; timers.forEach(clearTimeout); timers = [];
  st = { post, cfg: c, i: 0, start: o.start || 0, imgs: null, front: el("a1"), back: el("a2") };
  startMusic(c, post);
  // o.intro: пак только что открыт кодом — полный «Занавес» с текстом для паков с уровнем (один раз, решает вызывающий)
  const style = o.intro ? "curtain" : !c.enabled ? "none" : c.style, short = !o.intro && (o.quick || style != "curtain" || isShort(c) || RM);
  V.className = "viewer on" + (short ? " short" : "") + (style == "none" ? " none" : "") + (style == "develop" ? " dev-only" : "") + (c.music_on && !st.muted ? " music" : "");
  V.setAttribute("aria-hidden", "false"); document.documentElement.classList.add("v-open");
  // авто-полный экран на всю страницу (чтобы окна подписки/комментариев были видны поверх) (в жесте тапа); где не поддерживается (iPhone Safari) — молча пропускаем
  try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch {}
  for (const a of [el("a1"), el("a2")]) { a.classList.toggle("dev", style != "none"); a.classList.remove("show"); a.style.backgroundImage = ""; }
  el("intro").classList.remove("out"); el("hello").innerHTML = ""; el("mia").classList.remove("on"); el("skip").classList.toggle("hide", !c.skip); el("strip").classList.remove("on"); el("ttl").classList.remove("on");
  el("mia").style.backgroundImage = c.art ? `url("${window.Mia.pub(c.art, "media")}")` : ""; el("mia").classList.toggle("noart", !c.art);
  title(post); el("load").textContent = "Загрузка…"; clearTimeout(hideT);
  el("cnt").textContent = ""; el("strip").innerHTML = ""; el("strip").classList.toggle("hide", !c.strip); drawBot(); drawPacks();
  fill(post, imgsP);
  if (style == "none") { T(finish, 50); return; }
  const D = Math.max(2, Math.min(12, +c.duration || 6)) * 1000;
  if (short) { T(() => { if (st.imgs) show(st.start, true); }, 500); T(finish, style == "develop" ? 2600 : 1500); return; }
  const text = (o.intro || post.tier_rank > 0) && c.text_locked ? c.text_locked : c.text;
  T(() => { el("mia").classList.add("on"); [...(text || "")].forEach((ch, k) => { const e = document.createElement("b"); e.textContent = ch; el("hello").append(e); setTimeout(() => e.classList.add("on"), k * 70); }); }, D * 0.33);
  T(() => el("intro").classList.add("out"), D * 1.0);
  T(() => { if (st.imgs) show(st.start, true); }, D * 1.12);
  T(finish, D * 1.4);
}
function close() {
  if (!V) return; stopTeaser(); timers.forEach(clearTimeout); timers = []; stopMusic(); clearTimeout(hideT); clearTimeout(barT); window.Mia.closeComments?.(true); V.classList.add("closing"); V.classList.remove("ui", "idle", "bar");
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  const g = ++vGen; setTimeout(() => { if (g != vGen) return; V.className = "viewer"; V.setAttribute("aria-hidden", "true"); document.documentElement.classList.remove("v-open"); st.post = null; }, 900);
}
window.MiaViewer = { open, close, DEFV, free: (id, k) => { const p = window.Mia.S.posts.find(x => x.id == id); if (p && V?.classList.contains("on")) freeShow(p, k); }, refresh: () => { if (V?.classList.contains("on") && st.post && V.classList.contains("lkd")) lockCard(st.post); }, isOpen: () => V?.classList.contains("on") };
})();
