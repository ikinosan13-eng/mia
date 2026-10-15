(() => {
const C = window.MIA_CONFIG, B = C.API_BASE.replace(/\/$/, "");
const H = { apikey: C.ANON_KEY };
const sb = supabase.createClient(B, C.ANON_KEY, { auth: { storageKey: "mia-visitor" } });
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PB = (C.PREVIEW_BASE || "").replace(/\/$/, "");
const sbPub = (p, b) => `${B}/storage/v1/object/public/${b}/${p}`; // старый Supabase Storage (запасной путь)
const pub = (p, b = "previews") => !p ? "" : PB && b == "previews" ? `${PB}/${p}` : PB && b == "media" ? `${PB}/media/${p}` : sbPub(p, b);
const abs = u => /^https?:/i.test(u) ? u : B + u; // Яндекс отдаёт абсолютные ссылки, старые функции — /storage/v1/...
// WebP-варианты публичных картинок (делает админка, кнопка «WebP-версии»). Манифест: settings.imgv → { paths: { "covers/x.jpg": { w: [480, 960], s: 1791... } } }
// Нет манифеста или пути в нём — грузим исходный файл, как раньше.
const vUrl = (path, w, st) => pub(`v/${path.replace(/\.[a-z0-9]+$/i, "")}-${w}-${st}.webp`);
const vOf = path => { const e = path && S.imgv && S.imgv[path]; return e && e.w && e.w.length ? e : null; };
const imgSrc = (path, sizes) => { const e = vOf(path); if (!e) return `src="${pub(path)}"`;
  return `src="${vUrl(path, e.w[e.w.length - 1], e.s)}" srcset="${e.w.map(w => `${vUrl(path, w, e.s)} ${w}w`).join(", ")}" sizes="${sizes}" data-fb="${pub(path)}" onerror="this.onerror=null;this.removeAttribute('srcset');this.src=this.dataset.fb"`; };
const bgSrc = (path, want) => { const e = vOf(path); if (!e) return pub(path); const w = e.w.find(x => x >= want) || e.w[e.w.length - 1]; return vUrl(path, w, e.s); };
const fmt = d => new Date(d).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(",", " в");
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m == 1 && h != 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
const toast = t => { const e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 2800); };
const DEF = {
  btn_subscribe: "Подписаться", btn_login: "Войти", locked_label: "Нужен уровень:",
  signup_title: "Создать аккаунт", login_title: "Вход",
  pay_hint: "Откроется страница оплаты в новой вкладке. После оплаты вы получите код", btn_pay: "Перейти к оплате ↗",
  code_label: "Код доступа", btn_unlock: "Открыть доступ",
  code_ok: "Доступ открыт 💕", code_bad: "Код неверный. Проверьте раскладку и пробелы", code_old: "Этот код больше не действует — получите новый у автора",
  login_bad: "Неверное имя или пароль", name_taken: "Это имя уже занято", rate_limited: "Слишком много попыток. Попробуйте через 15 минут",
  no_comment_rights: "Комментарии доступны подписчикам {tier}", guest_comment: "Войдите, чтобы комментировать", banned: "Комментарии для вас ограничены",
  offline: "Не удаётся связаться с сервером. Проверьте интернет или попробуйте позже",
  empty_feed: "Здесь пока пусто — первые арты скоро", empty_comments: "Комментариев пока нет. Будьте первым!", empty_likes: "Вы ещё ничего не лайкнули",
  forgot: "Забыли пароль? Напишите автору",
};
let TX = {};
const T = (k, v = {}) => String(TX[k] || DEF[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
let S = { free: [], user: null, liked: new Set(), rank: 0, token: localStorage.miaToken || "", tiers: [], posts: [], media: [], profile: {}, modal: null, offline: false, pick: { credit: false, unlocked: new Set() } };
// закрыт ли пак для этого аккаунта: уровень ниже нужного и пак не открыт через «1 пак на выбор»
const isLocked = p => p.tier_rank > S.rank && !S.pick.unlocked.has(p.id);
if (localStorage.miaTheme === "dark") document.body.classList.add("dark");

const rpcT = (n, a, ms = 12000) => timeout(sb.rpc(n, a), ms).catch(e => ({ error: e, timeout: e?.message == "timeout" }));
function timeout(p, ms = 10000) { return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]); }
// admin.js / crop.js — только по требованию (админка, кадрирование аватара)
const scriptP = {};
const need = (src, g) => window[g] ? Promise.resolve() : (scriptP[src] = scriptP[src] || new Promise((ok, no) => { const e = document.createElement("script"); e.src = `${src}?v=${window.MIA_VERSION || ""}`; e.onload = ok; e.onerror = () => { delete scriptP[src]; no(new Error("load " + src)); }; document.head.append(e); }));
const preTake = p => { const P = window.__pre; if (!P || !P[p]) return null; const r = P[p]; delete P[p]; return r; };
const api = p => timeout(preTake(p) || fetch(`${B}/rest/v1/${p}`, { headers: H })).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const fn = async (name, body) => { const session = await timeout(sb.auth.getSession(), 5000).then(r => r.data.session).catch(() => null);
  try { const r = await timeout(fetch(`${B}/functions/v1/${name}`, { method: "POST", headers: { ...H, "Content-Type": "application/json", ...(session ? { Authorization: "Bearer " + session.access_token } : {}) }, body: JSON.stringify(body) }), 15000); return { status: r.status, data: await timeout(r.json(), 5000).catch(() => ({})) }; }
  catch { return { status: 0, data: { error: "offline" } }; } };

function setVid(pv, mv) { S.pvList = pv || []; S.mvList = mv || []; S.pv = Object.fromEntries(S.pvList.map(x => [x.post_id, x])); S.mv = Object.fromEntries(S.mvList.map(x => [x.id, x])); }
const dur = t => { t = Math.max(0, Math.round(+t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
// подпись счётчика: видео-пост — «▶ 0:12», пак с видео — «4 арта · ▶ 0:12» (или «· ▶ 2»)
// счётчик (текст для подписей): видео-пост «0:15»; пак видео+арты «1 видео · 2 арта»; только видео «N видео»; только арты — как было
const cntText = (p, n) => { const v = S.pv?.[p.id]; if (!v || !v.video_count) return n; if (v.kind == "video") return v.video_count > 1 ? `${v.video_count} видео` : dur(v.duration_sec); const a = (p.image_count || 0) - v.video_count; return a > 0 ? `${v.video_count} видео · ${a} ${plural(a, "арт", "арта", "артов")}` : `${v.video_count} видео`; };
// значок на обложке: те же линейные иконки, что у счётчика артов (без эмодзи)
const IV = `<i class="ic v"></i>`, IA = `<i class="ic a"></i>`;
const cntHtml = (p, n) => { const v = S.pv?.[p.id]; if (!v || !v.video_count) return esc(n); if (v.kind == "video") return IV + (v.video_count > 1 ? v.video_count : dur(v.duration_sec)); const a = (p.image_count || 0) - v.video_count; return a > 0 ? `${IV}${v.video_count} · ${IA}${a}` : IV + v.video_count; };
const vPlay = `<span class="ib vplay">▶</span>`;
function fromCache(c) { setVid(c.pv, c.mv); Object.assign(S, { tiers: c.tiers, posts: c.posts, media: c.media, profile: c.st.profile || {}, viewer: c.st.viewer || {}, free: c.free || S.free || [], imgv: c.imgv || S.imgv || {} }); TX = c.st.texts || {}; }
async function load(o = {}) {
  try {
    const [tiers, posts, media, settings, free] = await Promise.all([api("tiers_public?order=rank"), api("feed_public?order=publish_at.desc"), api("media_public?order=publish_at.desc,position"), api("settings?key=in.(profile,texts,viewer,imgv)"), api("free_images_public?select=post_id,position&order=position").catch(() => [])]);
    S.free = free || [];
    // видео (после sql/video.sql); до миграции view нет → пустые списки, сайт работает как раньше
    const [pv, mv, subs] = await Promise.all([api("post_video_public?select=post_id,kind,video_count,duration_sec,teaser_path,feed_video_path").catch(() => api("post_video_public?select=post_id,kind,video_count,duration_sec")).catch(() => []), api("media_video_public?select=id,post_id,position,duration_sec,poster_path").catch(() => []), api("rpc/subscriber_count").catch(() => null)]);
    S.subs = typeof subs == "number" ? subs : null; // только число, без личных данных; до SQL функции нет → не показываем
    setVid(pv, mv);
    const st = Object.fromEntries(settings.map(x => [x.key, x.value]));
    Object.assign(S, { tiers, posts, media, profile: st.profile || {}, viewer: st.viewer || {}, imgv: st.imgv?.paths || {}, offline: false }); TX = st.texts || {};
    try { localStorage.miaCache = JSON.stringify({ tiers, posts, media, st, free: S.free, imgv: S.imgv, pv: S.pvList, mv: S.mvList, at: Date.now() }); } catch {}
  } catch (e) {
    const c = JSON.parse(localStorage.miaCache || "null"); S.offline = true;
    if (!c) throw e; fromCache(c);
  }
  { const g = $(".gava"); if (g && S.profile.avatar) g.style.backgroundImage = `url('${bgSrc(S.profile.avatar, 192)}')`; }
  if (!S.offline && !o.bgUser) await loadUser();
}
async function loadUser() {
  const { data: { session } } = await sb.auth.getSession(); S.user = null; S.liked = new Set(); S.rank = 0; S.pick = { credit: false, unlocked: new Set() };
  if (session) {
    const [{ data: adm }, { data: pr }] = await Promise.all([sb.from("admins").select("user_id").eq("user_id", session.user.id), sb.from("profiles").select("username,avatar_path,banned_until,created_at").eq("id", session.user.id)]);
    if (adm?.length) S.user = { id: session.user.id, username: "mia_owner", admin: true };
    else if (pr?.length) S.user = { id: session.user.id, ...pr[0], banned: pr[0].banned_until && new Date(pr[0].banned_until) > new Date() };
    else { await sb.auth.signOut(); }
    if (S.user) { const { data: lk } = await sb.from("likes").select("post_id"); S.liked = new Set((lk || []).map(x => x.post_id)); }
    if (S.user && !S.user.admin) await loadPick();
  }
  const r = await fn("unlock", S.token ? { token: S.token } : {});
  if (r.status === 200) S.rank = r.data.rank || 0;
  else if (r.status === 401 && S.token) { S.token = ""; localStorage.removeItem("miaToken"); toast(T("code_old")); }
}
// «1 пак на выбор»: кредит и открытые навсегда паки (до применения миграции функция отсутствует — тихо пропускаем)
async function loadPick() { try { const { data, error } = await rpcT("my_pick_access", {}, 8000); if (error || !data) return; S.pick = { credit: !!data.credit, unlocked: new Set(data.unlocked || []) }; } catch {} }
const tierOf = r => S.tiers.find(t => t.rank == r);
const tierName = r => tierOf(r)?.name || "";
const avatarHtml = (u, size = 36, extra = "") => { const url = u.is_author || u.admin ? (S.profile.avatar ? pub(S.profile.avatar) : "avatar.jpg") : u.avatar_path ? pub(u.avatar_path, "avatars") : "";
  const n = (u.username || "?")[0].toUpperCase(), col = ["#7a4cc9", "#2b6f78", "#e2557b", "#2c3e8f", "#d17b0f"][(u.username || "").length % 5];
  return `<span class="ava" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px;line-height:1;${url ? `background-image:url('${esc(url)}');background-color:#ddd` : `background:${col}`};${extra}">${url ? "" : esc(n)}</span>`; };
const tierBadge = r => r > 0 && r < 32767 ? `<span class="tier">${esc(tierName(r))}</span>` : "";

function bar() {
  const dark = document.body.classList.contains("dark"), u = S.user;
  return `<div class="bar"><a class="logo" href="#/feed">MIA</a><div class="r"><a id="tg" title="Тема">${dark ? "☀️" : "🌙"}</a>${u ? (u.admin ? `<a class="gb sm" href="#/admin/posts">⚙ Админка</a>` : "") + `<a href="#/me" title="Профиль">${avatarHtml(u, 34)}</a>` : `<a class="gb" data-open="login">${esc(T("btn_login"))}</a>`}</div></div>`
    + (S.offline ? `<div class="note offline">📡 ${esc(T("offline"))} <a class="ob sm" onclick="location.reload()">Повторить</a><br><span class="small">Показана сохранённая лента</span></div>` : "");
}
function hero() {
  const p = S.profile, cover = p.cover ? pub(p.cover) : "", l = p.links || {};
  const links = [["Boosty", l.boosty], ["VK Donut", l.donut], ["Telegram", l.telegram], ["VK", l.vk]].filter(x => x[1]).map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join("");
  return `<div class="hero"><div class="cv">${cover ? `<img ${imgSrc(p.cover, "(min-width:640px) 600px, 100vw")} alt="" fetchpriority="high">` : ""}</div><div class="prof"><span class="ava" style="background-image:url('${p.avatar ? bgSrc(p.avatar, 192) : "avatar.jpg"}')"></span>
  <h1>${esc(p.name || "Мия")}</h1><div class="mu">${esc(p.tagline || "")}</div><div class="mu small" style="margin-top:4px">${S.posts.length} ${plural(S.posts.length, "пак", "пака", "паков")} · ${S.media.length} ${plural(S.media.length, "арт", "арта", "артов")}${S.subs > 0 ? ` · 🐾 ${S.subs} ${plural(S.subs, "подписчик", "подписчика", "подписчиков")}` : ""}</div>${links ? `<div class="links">${links}</div>` : ""}</div></div>`;
}
const tabs = on => `<div class="tabs">${[["ЛЕНТА", "feed"], ["МЕДИА", "media"], ["УРОВНИ", "levels"], ["ОБ АВТОРЕ", "about"]].map(([n, h]) => `<a href="#/${h}" class="${h == on ? "on" : ""}">${n}</a>`).join("")}</div>`;
const heart = p => `${S.liked.has(p.id) ? "❤" : "♡"} ${p.like_count || 0}`;
const ACT = p => `<div class="act"><a class="${S.liked.has(p.id) ? "on" : ""}" data-like="${p.id}">${heart(p)}</a><a href="#/post/${p.id}" data-cm="${p.id}">💬 ${p.comment_count || 0}</a><span class="sp"></span><a data-share="${p.id}" title="Поделиться">↗</a></div>`;
const lockPanel = p => `<div class="frost"><span class="mu">${esc(T("locked_label"))}</span><b>${esc(p.tier_name)}${p.price_rub ? ` · ${p.price_rub} ₽/мес` : ""}</b><button class="ob" data-sub="${p.id}">🔒 ${esc(T("btn_subscribe"))}</button>${pickBtn(p)}</div>`;
const pickBtn = p => S.pick.credit ? `<button class="ob pko" data-pick="${p.id}">🎁 Мур, открыть этот пак</button><span class="pkb">Мяу! У тебя 1 пак на выбор 💕</span>` : "";
// «Пробник»: бесплатные арты внутри закрытого пака
const freeOf = id => (S.free || []).filter(f => f.post_id == id).map(f => f.position);
const freeP = {};
const freeFn = id => freeP[id] || (freeP[id] = fn("free_arts", { post_id: id }).then(r => { if (r.status != 200) { delete freeP[id]; throw new Error(r.status); } return (r.data.images || []).map(i => ({ url: abs(i.url), position: i.position })); }));
const freePlate = p => { const n = Math.max(0, (p.image_count || 0) - freeOf(p.id).length); return `<div class="fcap"><b>Мур, это лишь кусочек 🐾</b><span>Мяу~ в паке ещё ${n} ${plural(n, "арт", "арта", "артов")}, они ждут тебя 💕</span><button class="ob" data-fsub="${p.id}">Открыть полный пак 🐾</button></div>`; };
document.addEventListener("click", e => { const t = e.target.closest("[data-fsub]"); if (!t) return; e.preventDefault(); e.stopPropagation(); const p = S.posts.find(x => x.id == t.dataset.fsub); if (p) subscribe(p.tier_rank, p.id); }, true);
// тизер обложки (3–5 с, ~480p, без звука, публичный mia-previews/teasers/): играет только в зоне видимости
const tzOff = () => matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.connection?.saveData;
// открытый видео-пост — полное видео (публичная копия feedvid/), всё закрытое — только 4-секундный тизер
const tzTag = (p, locked) => { const v = S.pv?.[p.id], t = !locked && v?.feed_video_path || v?.teaser_path; return t && !tzOff() ? `<video class="tz" data-src="${pub(t)}" muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true"></video>` : ""; };
let tzIO = null;
// живой аватар/шапка: только после полной загрузки страницы (LCP — картинка), без звука, по кругу; reduced-motion / экономия трафика → только картинка
// ---------- вход на главную (1 раз за сессию; reduced-motion — без анимации) ----------
// ждём, пока шапка, аватар и арты первого экрана загрузятся и декодируются (до этого — «мур…»), потом: шапка оседает, аватар выезжает,
// плитки собираются по очереди, кнопка подписки мягко подсвечивается. Предохранитель 3,5 с — показать всё быстрым проявлением.
const INTRO = { st: 0 }; const RMo = matchMedia("(prefers-reduced-motion: reduce)");
function introRun(v) {
  const H = document.documentElement; parallax();
  if (!H.classList.contains("intro")) return; if (H.classList.contains("gate")) return;
  if (v && v != "feed") return introDone();
  if (INTRO.go) { H.style.setProperty("--el", `${-Math.round(performance.now() - INTRO.go)}ms`); introTag(); return; }
  if (INTRO.st) return; INTRO.st = performance.now();
  const imgs = [$(".hero .cv img"), ...$$(".post .cov img").filter(im => im.getBoundingClientRect().top < innerHeight)].filter(Boolean);
  const ava = ($(".hero .prof .ava")?.style.backgroundImage || "").match(/url\(["']?([^"')]+)/)?.[1];
  const dec = im => (im.complete && im.naturalWidth ? Promise.resolve() : new Promise(r => { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); })).then(() => im.decode?.().catch(() => {}));
  if (ava) { const a = new Image(); a.src = ava; imgs.push(a); }
  const L0 = window.__ls || 0, t = setTimeout(() => introGo(false), Math.max(0, L0 + 3500 - performance.now())); // 3,5 с от начала «мур…»
  Promise.all(imgs.map(dec)).then(() => { clearTimeout(t); introGo(true); });
}
function introGo(staged) {
  if (INTRO.go) return; const H = document.documentElement; INTRO.go = performance.now(); window.__iaStart = { t: Math.round(INTRO.go), staged };
  try { sessionStorage.miaIntro = 1; } catch {}
  H.classList.remove("iwait"); H.classList.add("ibye"); // «мур…» мягко гаснет, потом сцена
  setTimeout(() => { H.style.setProperty("--el", "0ms"); H.classList.remove("ibye"); H.classList.add(staged ? "igo" : "iquick");
    introTag(); if (staged) setTimeout(introGlow, 2300); setTimeout(introDone, staged ? 6000 : 700); }, 450);
}
function introTag() { let k = 0; const H = innerHeight, io = INTRO.io || (INTRO.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); INTRO.io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" }));
  $$(".post").forEach(p => { if (p.getBoundingClientRect().top < H) { p.classList.add("ia"); if (k == 0) p.classList.add("ia0"); p.style.setProperty("--i", k++); } else { p.classList.add("rv"); io.observe(p); } }); }
function introGlow() { const b = $$(".cov.lk .frost .ob").find(x => { const r = x.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }) || $('.tabs a[href="#/levels"]'); if (!b) return; b.classList.add("glow"); setTimeout(() => b.classList.remove("glow"), 3300); }
function introDone() { const H = document.documentElement; H.classList.remove("intro", "iwait", "igo", "iquick"); }
// лёгкий параллакс шапки при прокрутке (translate — отдельное от анимации scale свойство)
function parallax() { if (INTRO.px || RMo.matches) return; INTRO.px = 1; let q = 0;
  addEventListener("scroll", () => { if (q) return; q = requestAnimationFrame(() => { q = 0; const y = Math.min(scrollY, 400); $$(".hero .cv img,.hero .cv video").forEach(e => e.style.translate = `0 ${(y * .3).toFixed(1)}px`); }); }, { passive: true }); }
function heroVid() { const p = S.profile; if (tzOff() || !(p.avatar_video || p.cover_video)) return;
  const go = () => [[".hero .cv", p.cover_video], [".hero .prof .ava", p.avatar_video]].forEach(([sel, path]) => { const box = $(sel); if (!box || !path || box.querySelector("video")) return;
    const v = document.createElement("video"); Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, preload: "auto" }); v.className = "hv"; v.setAttribute("aria-hidden", "true");
    v.oncanplay = () => v.classList.add("on"); v.src = pub(path); box.append(v); v.play().catch(() => {}); });
  document.readyState == "complete" ? setTimeout(go, 300) : addEventListener("load", () => setTimeout(go, 300), { once: true }); }
function tzBind() {
  tzIO?.disconnect(); const vs = $$("video.tz"); if (!vs.length || !("IntersectionObserver" in window)) return;
  tzIO = new IntersectionObserver(es => es.forEach(e => { const v = e.target;
    if (e.isIntersecting && e.intersectionRatio >= .5) { if (!v.src) { v.src = v.dataset.src; v.oncanplay = () => v.classList.add("on"); } v.muted = true; v.play().catch(() => {}); }
    else v.pause(); }), { threshold: [0, .5] });
  vs.forEach(v => tzIO.observe(v));
}
function card(p, k = 9) {
  const locked = isLocked(p), n = `${p.image_count} ${plural(p.image_count, "арт", "арта", "артов")}`;
  return `<div class="post"><div class="ph"><span>${fmt(p.publish_at)}</span>${p.tier_rank > 0 ? `<span class="tier">${locked ? `<i class="lki"></i>` : ""}${esc(p.tier_name)}</span>` : `<span class="tier f">Открыто всем</span>`}</div>
  <a href="#/post/${p.id}" class="cov ${locked ? "lk" : ""}" ${locked ? "" : `data-view="${p.id}"`}><img ${imgSrc(p.cover_path, "(min-width:640px) 600px, 100vw")} alt="" ${k < 1 ? `fetchpriority="high"` : `loading="lazy"`}>${tzTag(p, locked)}<h3>${esc(p.title)}</h3><span class="cnt${S.pv?.[p.id]?.video_count ? " nv" : ""}">${cntHtml(p, n)}</span>${!locked && S.pv?.[p.id]?.kind == "video" ? vPlay : ""}${locked ? lockPanel(p) : ""}</a>
  ${p.body && !locked ? `<div class="body">${esc(p.body.length > 300 ? p.body.slice(0, 300) + "…" : p.body)}</div>` : ""}${ACT(p)}</div>`;
}
function levelsHtml() {
  return `<div class="levels">${S.tiers.map(t => `<div class="lv"><b>${esc(t.name)}</b><div class="pr">${t.price_rub ? `${t.price_rub} ₽ <small class="mu">/ мес</small>` : "Бесплатно"}</div><div class="perks">${(t.perks || []).map(x => "✔ " + esc(x)).join("<br>")}</div>
  ${t.rank == 0 ? `<span class="gb full">${S.rank == 0 ? "Вы здесь" : "Входит"}</span>` : S.rank >= t.rank ? `<span class="gb full">✓ Открыто</span>` : `<button class="ob full" data-subt="${t.rank}">${esc(T("btn_subscribe"))}</button>`}</div>`).join("")}
  <div class="lv pick"><b>🎁 1 пак на выбор 🐾</b><div class="pr">Любая сумма <small class="mu">мур, один раз · на этот аккаунт</small></div><div class="perks">✔ Выбери любой закрытый пак — он станет твоим навсегда 💕<br>✔ Плати сколько хочешь — получишь код, мяу<br>✔ Всего 1 пак, один раз, только на этот аккаунт</div>
  ${S.pick.credit ? `<span class="gb full">🐾 У тебя есть 1 пак на выбор</span>` : S.pick.unlocked.size ? `<span class="gb full">✓ Твой пак уже выбран 💕</span>` : `<button class="ob full" data-pickcode>Хочу код, мур 🐾</button>`}</div></div>`;
}
const views = {
  feed: () => bar() + hero() + tabs("feed") + (S.posts.map(card).join("") || `<div class="note">🎨 ${esc(T("empty_feed"))}</div>`),
  media: () => { const k = {}; return bar() + hero() + tabs("media") + `<div class="grid mgrid">${S.media.map(m => { const i = k[m.post_id] = (k[m.post_id] ?? -1) + 1, lk = m.tier_rank > S.rank && !S.pick.unlocked.has(m.post_id), p = S.posts.find(x => x.id == m.post_id);
    const vd = S.mv?.[m.id], vb = vd ? `<span class="cnt nv">${IV}${dur(vd.duration_sec)}</span>` : "";
    return lk ? `<a href="#/post/${m.post_id}" class="lk${vd ? " vd" : ""}" style="background-image:url('${bgSrc(m.preview_path, 320)}')">${vb}</a>` : `<a href="#/post/${m.post_id}" data-mp="${m.post_id}" data-mi="${i}" class="${vd ? "vd" : ""}" style="background-image:url('${bgSrc(m.preview_path, 320)}')">${vb}${p ? `<span class="cb" data-cm="${p.id}">💬 ${p.comment_count || 0}</span>` : ""}</a>`; }).join("")}</div>` + (S.media.length ? "" : `<div class="note">🎨 ${esc(T("empty_feed"))}</div>`); },
  levels: () => bar() + hero() + tabs("levels") + levelsHtml(),
  about: () => bar() + hero() + tabs("about") + `<div class="body">${esc(S.profile.about || "Привет! Я Мия, рисую паки артов 💕🐾")}</div>`,
};

// ---------- modals ----------
function openModal(m) { if (!S.modal) history.pushState({ m: 1 }, ""); S.modal = m; drawModal(); }
function closeModal(back = true) { S.modal = null; $("#modal")?.remove(); if (back && history.state?.m) history.back(); }
window.addEventListener("popstate", () => { if (S.modal) { S.modal = null; $("#modal")?.remove(); } });
// автофокус полей (и клавиатура) — только на компьютере с мышью; на тач-экранах — по тапу в поле
const fineP = () => matchMedia("(pointer: fine)").matches && !matchMedia("(pointer: coarse)").matches;
function subscribe(rank, postId, o = {}) {
  S.stay = o.stay || null; const ret = { rank, post: postId || null }; localStorage.miaReturn = JSON.stringify(ret);
  openModal(S.user ? { t: "pay", ...ret } : { t: "signup", ...ret });
}
function drawModal() {
  $("#modal")?.remove(); const m = S.modal; if (!m) return;
  const d = document.createElement("div"); d.className = "ov"; d.id = "modal"; let h = "";
  if (m.t == "signup") h = `<h2>${esc(T("signup_title"))}</h2><form id="af"><label>Имя</label><input type="text" id="au" autocomplete="username" maxlength="24"><div class="mu small">2–24 символа: буквы, цифры, _ · будет видно в комментариях</div>
    <label>Пароль</label><input type="password" id="ap" autocomplete="new-password"><div class="mu small">Минимум 8 символов</div><label>Повторите пароль</label><input type="password" id="ap2" autocomplete="new-password"><input class="hp" id="hp" tabindex="-1" autocomplete="off">
    <div class="err" id="ae"></div><button class="ob full" type="submit">${esc(T("signup_title"))}</button></form><p style="text-align:center;margin-top:14px" class="mu">Уже есть аккаунт? <a class="lnk" data-sw="login">Войти</a></p>`;
  else if (m.t == "login") h = `<h2>${esc(T("login_title"))}</h2><form id="lf"><label>Имя</label><input type="text" id="lu" autocomplete="username"><label>Пароль</label><input type="password" id="lp" autocomplete="current-password"><div class="err" id="le"></div><button class="ob full" type="submit">${esc(T("btn_login"))}</button></form>
    <p style="text-align:center;margin-top:14px" class="mu">Нет аккаунта? <a class="lnk" data-sw="signup">Создать</a><br><span class="small">${S.profile.links?.vk ? `<a class="lnk" href="${esc(S.profile.links.vk)}" target="_blank">${esc(T("forgot"))}</a>` : esc(T("forgot"))}</span></p>`;
  else if (m.t == "pay") { const t = tierOf(m.rank) || S.tiers.filter(x => x.rank > 0)[0] || {};
    h = `<h2>Уровень ${esc(t.name)} · ${t.price_rub || 0} ₽/мес</h2><div class="perks">${(t.perks || []).map(x => "✔ " + esc(x)).join("<br>")}</div>
    <a class="ob full" href="${esc(t.pay_url || t.boosty_url || C.BOOSTY_URL)}" target="_blank" rel="noopener" id="paylink">${esc(T("btn_pay"))}</a><div class="mu small" style="text-align:center;margin-top:6px">${esc(T("pay_hint"))}</div>
    <form id="cf"><label>${esc(T("code_label"))}</label><input type="text" id="ci" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase"><div class="err" id="ce"></div><button class="ob full" type="submit">${esc(T("btn_unlock"))}</button></form>`; }
  else if (m.t == "pick") h = `<h2>🎁 1 пак на выбор 🐾</h2><div class="perks">✔ Любая сумма, мур · один раз · на этот аккаунт<br>✔ Открой любой закрытый пак — навсегда твой 💕</div>
    <a class="ob full" href="${esc(S.profile.pick_url || C.BOOSTY_URL)}" target="_blank" rel="noopener">Купить код, мяу ↗</a><div class="mu small" style="text-align:center;margin-top:6px">Оплата на странице продавца — потом тебе придёт код 🐾</div>
    <form id="pf"><label>Твой код «1 пак на выбор»</label><input type="text" id="pci" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase" placeholder="Введи код, мур 🐾"><div class="err" id="pce"></div><button class="ob full" id="pcb">Активировать, мур 🐾</button></form>`;
  else if (m.t == "pickc") { const p = S.posts.find(x => x.id == m.post) || {}; h = `<h2>Мур-открыть «${esc(p.title)}» навсегда? 🐾</h2><p class="mu">Это твой единственный выбор, мяу: 1 пак, один раз, на этот аккаунт. Поменять потом не получится 💕</p><div class="err" id="pke"></div><button class="ob full" id="pkyes">🎁 Да, мур, хочу «${esc(p.title)}»</button><button class="gb full" data-close style="margin-top:8px">Ещё подумаю, мяу</button>`; }
  else if (m.t == "picks") { const p = S.posts.find(x => x.id == m.post) || {}; h = `<div class="pkok">🎉</div><h2 style="text-align:center">Мур-р, пак «${esc(p.title)}» твой навсегда 🐾</h2><p class="mu" style="text-align:center">Он теперь живёт в твоём аккаунте — смотри когда захочешь, на любом устройстве 💕</p><button class="ob full" id="pkgo">Смотреть, мяу 🐾</button>`; }
  d.innerHTML = `<div class="sheet"><a class="x" data-close>✕</a>${h}</div>`; document.body.append(d);
  $("#pf")?.addEventListener("submit", enterPick); $("#pkyes") && ($("#pkyes").onclick = () => usePick(m.post)); $("#pkgo") && ($("#pkgo").onclick = () => { closeModal(false); goIntro(m.post); });
  d.onclick = e => { if (e.target == d || e.target.dataset.close != null) closeModal(); const sw = e.target.dataset.sw; if (sw) { S.modal = { ...m, t: sw }; drawModal(); } };
  $("#af")?.addEventListener("submit", signup); $("#lf")?.addEventListener("submit", login); $("#cf")?.addEventListener("submit", enterCode);
  if (fineP()) setTimeout(() => d.querySelector("input")?.focus(), 50); // на телефоне клавиатура только по тапу в поле
}
async function signin(username, password) {
  const r = await fn("login", { username, password });
  if (r.status == 429) return T("rate_limited"); if (r.status == 0) return T("offline"); if (r.status != 200) return T("login_bad");
  await sb.auth.setSession({ access_token: r.data.access_token, refresh_token: r.data.refresh_token }); await loadUser();
  return S.user ? "" : "Этот аккаунт нельзя использовать";
}
async function signup(e) {
  e.preventDefault(); const u = $("#au").value.trim(), p = $("#ap").value, ae = $("#ae");
  if (!/^[A-Za-z0-9_\u0400-\u04FF]{2,24}$/.test(u)) return ae.textContent = "Имя: 2–24 символа, буквы, цифры или _";
  if (p.length < 8) return ae.textContent = "Пароль: минимум 8 символов"; if (p !== $("#ap2").value) return ae.textContent = "Пароли не совпадают";
  ae.textContent = "Создаю аккаунт…";
  const r = await fn("register", { username: u, password: p, website: $("#hp").value });
  if (r.status != 200) return ae.textContent = r.status == 409 ? T("name_taken") : r.status == 0 ? T("offline") : r.data.message || "Ошибка регистрации";
  const err = await signin(u, p); if (err) return ae.textContent = err;
  toast(`Добро пожаловать, ${S.user.username}!`); afterAuth();
}
async function login(e) {
  e.preventDefault(); $("#le").textContent = "Вход…";
  const err = await signin($("#lu").value.trim(), $("#lp").value); if (err) return $("#le").textContent = err;
  toast(S.user.admin ? "Вы вошли как владелец" : `Привет, ${S.user.username}!`); afterAuth();
}
function gatePass() { const H = document.documentElement; if (!H.classList.contains("gate")) return false;
  H.classList.add("gout"); setTimeout(() => { H.classList.remove("gate", "gout"); H.classList.add("intro", "iwait"); window.__ls = performance.now();
    const im = $("#iaCat img"), so = $("#iaCat source"); if (so) so.srcset = so.srcset.split("?")[0] + "?r=" + Date.now(); if (im) im.src = im.src.split("?")[0] + "?r=" + Date.now();
    INTRO.st = 0; render(); }, 480); return true; }
(() => { const g = $("#gate"); if (!g) return; $("#gate #lf").addEventListener("submit", login); $("#gate #af").addEventListener("submit", signup); g.addEventListener("pointerdown", e => { const b = e.target.closest(".gf .ob"); if (!b) return; const r = b.getBoundingClientRect(), s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "gstamp"); s.innerHTML = '<use href="#gpaw"/>'; s.style.left = e.clientX - r.left + "px"; s.style.top = e.clientY - r.top + "px"; b.append(s); setTimeout(() => s.remove(), 650); }); g.addEventListener("click", e => { const t = e.target.dataset.g; if (!t) return; g.classList.add("gsw"); g.classList.toggle("gate-s", t == "signup"); $$("#gate .gtabs a").forEach(a => a.classList.toggle("on", a.dataset.g == t)); }); })();
function afterAuth() { if (gatePass()) return;
  const ret = S.modal?.rank != null ? { rank: S.modal.rank, post: S.modal.post } : null;
  if (ret && S.rank < ret.rank) { S.modal = { t: "pay", ...ret }; drawModal(); render(); } else { closeModal(); render(); }
}
// ввод кода «1 пак на выбор»
const PICK_SLOW = "Мяу, сервер долго молчит 🐾 Проверь интернет и попробуй ещё раз";
const PICK_ERR = { bad_code: "Мяу, такого кода нет или он уже использован 🐾", already_used: "Мур, на этом аккаунте «1 пак на выбор» уже был — он даётся один раз 💕", login: "Сначала войди в аккаунт, мур 🐾" };
// общий вызов redeem_pick_code с таймаутом; если ответ потерялся, а кредит уже начислен — считаем успехом
async function redeemPick(code) {
  const r = await rpcT("redeem_pick_code", { p_code: code });
  let er = r.timeout ? "slow" : r.error ? "offline" : r.data?.ok ? null : (r.data?.error || "offline");
  if (er == "already_used" || er == "slow") { await loadPick(); if (S.pick.credit) er = null; }
  return er;
}
const pickMsg = er => er == "slow" ? PICK_SLOW : er == "rate_limited" ? T("rate_limited") : PICK_ERR[er] || T("offline");
function pickOk(code) { const c2 = $("#pce"); if (c2) { c2.className = "okm"; c2.textContent = "✔ Мяу, код принят! У тебя 1 пак на выбор 💕 Выбери любой закрытый пак и нажми «🎁 Мур, открыть этот пак»."; } if ($("#pci")) $("#pci").value = code; if ($("#pcb")) $("#pcb").disabled = true; }
async function enterPick(e) {
  e.preventDefault(); const code = $("#pci").value.trim(), ce = $("#pce"), b = $("#pcb"); if (!code || b.disabled) return; b.disabled = true; ce.className = "err"; ce.textContent = "Мур, проверяю…";
  let ok = false;
  try { const er = await redeemPick(code);
    if (!er) { ok = true; S.pick.credit = true; await render(); window.MiaViewer?.refresh?.(); pickOk(code); return; }
    ce.textContent = pickMsg(er);
  } catch (x) { console.error(x); ce.textContent = PICK_SLOW; }
  finally { if (!ok && $("#pcb")) $("#pcb").disabled = false; }
}
// потратить кредит на пак (кнопка блокируется — двойной тап не тратит дважды; сервер тоже защищён)
let picking = false;
async function usePick(id) {
  if (picking) return; picking = true; const b = $("#pkyes"), e = $("#pke"); if (b) b.disabled = true; if (e) { e.className = "mu"; e.textContent = "Мур, открываю пак… 🐾"; }
  let ok = false;
  try {
    const r = await rpcT("use_pack_credit", { p_post: id });
    let er = r.timeout ? "slow" : r.error ? "offline" : r.data?.ok ? null : (r.data?.error || "offline");
    if (r.error && !r.timeout) console.error("use_pack_credit", r.error);
    if (er) { await loadPick(); if (S.pick.unlocked.has(id)) er = null; } // ответ потерялся, а пак уже открыт — значит всё получилось
    if (!er) { ok = true; S.pick.credit = false; S.pick.unlocked.add(id); loadPick().then(() => window.MiaViewer?.refresh?.()); render(); S.modal = { t: "picks", post: id }; drawModal(); return; }
    const m = { slow: "Мяу, сервер долго молчит 🐾 Проверь интернет и нажми ещё раз — пак не пропадёт", credit_used: "Мур, твой выбор уже потрачен на другой пак 🐾", no_credit: "Мяу, у этого аккаунта нет «1 пака на выбор» — сначала введи код 🐾", no_post: "Мур, этот пак сейчас нельзя выбрать — выбери другой 🐾", login: "Сначала войди в аккаунт, мур 🐾" }[er] || "Мяу, что-то пошло не так 🐾 Попробуй ещё раз — кредит не потратится";
    const e2 = $("#pke"); if (e2) { e2.className = "err"; e2.textContent = m; } else toast(m);
  } catch (x) { console.error(x); const e2 = $("#pke"); if (e2) { e2.className = "err"; e2.textContent = "Мяу, что-то пошло не так 🐾 Попробуй ещё раз"; } }
  finally { picking = false; if (!ok) { const b2 = $("#pkyes"); if (b2) b2.disabled = false; } }
}
function pickOpen(id) { if (!S.user) return openModal({ t: "signup" }); if (!S.pick.credit) return openModal({ t: "pick" }); openModal({ t: "pickc", post: id }); }
document.addEventListener("click", e => { const t = e.target.closest("[data-pick],[data-pickcode]"); if (!t) return; e.preventDefault(); e.stopPropagation();
  t.dataset.pick ? pickOpen(t.dataset.pick) : S.user ? openModal({ t: "pick" }) : openModal({ t: "signup" }); }, true);
// вступление «Занавес» с текстом для паков с уровнем — один раз на аккаунт + пак, сразу после открытия пака кодом
// перейти на страницу пака и после перерисовки открыть его со вступлением (смена адреса закрывает кинорежим)
function goIntro(id) { const h = "#/post/" + id; if (location.hash == h) { render(); return openWithIntro(id); } addEventListener("hashchange", () => setTimeout(() => openWithIntro(id), 0), { once: true }); location.hash = h; }
function openWithIntro(id) { const k = `miaUnlockIntro:${S.user?.id || "anon"}:${id}`, seen = localStorage[k]; localStorage[k] = "1"; openViewer(id, 0, false, seen ? {} : { intro: true }); }
async function enterCode(e) {
  e.preventDefault(); const code = $("#ci").value.trim(), ce = $("#ce"); if (!code) return; ce.className = "err"; ce.textContent = "Проверяю…"; const bt = $("#cf button"); if (bt?.disabled) return; if (bt) bt.disabled = true;
  try {
  const r = await fn("unlock", { code });
  if (r.status == 200) { if (r.data.token) { S.token = r.data.token; localStorage.miaToken = r.data.token; } S.rank = Math.max(S.rank, r.data.rank);
    ce.className = "okm"; ce.textContent = "✔ " + T("code_ok"); toast(T("code_ok")); const ret = JSON.parse(localStorage.miaReturn || "{}"); localStorage.removeItem("miaReturn");
    S.stay = null; render(); const pid = ret.post || S.posts.find(p => p.tier_rank > 0 && p.tier_rank <= S.rank)?.id;
    // открыть купленный пак и один раз показать вступление (и в ленте/посте/уровнях, и в кинорежиме)
    setTimeout(() => { closeModal(false); if (pid) return goIntro(pid); location.hash = "#/feed"; render(); }, 700); }
  else if (r.status == 429 || r.status == 0) ce.textContent = r.status == 429 ? T("rate_limited") : T("offline");
  else if (!S.user) ce.textContent = T("code_bad");
  else { // не код уровня → может быть код «1 пак на выбор»
    const er = await redeemPick(code);
    if (!er) { S.pick.credit = true; closeModal(false); await render(); window.MiaViewer?.refresh?.(); openModal({ t: "pick" }); pickOk(code); return; }
    ce.textContent = er == "bad_code" ? T("code_bad") : pickMsg(er); }
  } catch (x) { console.error(x); ce.textContent = "Мяу, что-то пошло не так 🐾 Попробуй ещё раз"; }
  finally { const b2 = $("#cf button"); if (b2) b2.disabled = false; }
}

// ---------- like / comments ----------
async function toggleLike(id) {
  if (!S.user) return openModal({ t: "signup" }); if (S.user.admin) return toast("Владелец не ставит лайки");
  if (S.user.banned) return toast(T("banned"));
  const p = S.posts.find(x => x.id == id), on = S.liked.has(id);
  const { error } = on ? await sb.from("likes").delete().eq("post_id", id).eq("user_id", S.user.id) : await sb.from("likes").insert({ post_id: id, user_id: S.user.id });
  if (error) return toast("Ошибка: " + error.message);
  on ? S.liked.delete(id) : S.liked.add(id); p.like_count += on ? -1 : 1;
  $$(`[data-like="${id}"]`).forEach(b => { b.classList.toggle("on", !on); b.innerHTML = heart(p); });
}
const CERR = { too_fast: "Не так быстро — подождите 10 секунд", links: "Ссылки в комментариях запрещены", tier: null, banned: null, guest: null, length: "До 1000 символов" };
function commentHtml(c, kids) {
  const mine = S.user && (S.user.id == c.user_id || S.user.admin);
  return `<div class="cm ${c.parent_id ? "reply" : ""}">${c.is_author ? avatarHtml(c, 36) : `<a href="#/u/${c.user_id}">${avatarHtml(c, 36)}</a>`}<div style="flex:1"><div class="n">${c.is_author ? esc(S.profile.name || "Мия") + `<span class="au">Автор</span>` : `<a href="#/u/${c.user_id}">${esc(c.username)}</a> ${tierBadge(c.tier_rank)}`} <span class="mu" style="font-weight:400">${fmt(c.created_at)}</span></div>
  <div class="t">${esc(c.body)}</div><div class="a">${S.user && !c.parent_id && S.canComment ? `<a data-rep="${c.id}" data-nm="${esc(c.username)}">Ответить</a>` : ""}${mine ? `<a data-cdel="${c.id}">Удалить</a>` : S.user ? `<a data-crep="${c.id}">Пожаловаться</a>` : ""}</div></div></div>${(kids || []).map(k => commentHtml(k)).join("")}`;
}
async function commentsBlock(p) {
  let list = [];
  try { list = await api(`comments_public?post_id=eq.${p.id}&order=created_at`); } catch { return `<div class="note">${esc(T("offline"))}</div>`; }
  const locked = isLocked(p); S.canComment = S.user && !S.user.banned && !locked;
  const roots = list.filter(c => !c.parent_id), kids = id => list.filter(c => c.parent_id == id);
  let box;
  if (!S.user) box = `<div class="note">${esc(T("guest_comment"))} · <a class="lnk" data-open="login">${esc(T("btn_login"))}</a></div>`;
  else if (S.user.banned) box = `<div class="note">⛔ ${esc(T("banned"))}</div>`;
  else if (locked) box = `<div class="note">🔒 ${esc(T("no_comment_rights", { tier: p.tier_name }))}<br><button class="ob" style="margin-top:8px" data-sub="${p.id}">${esc(T("btn_subscribe"))}</button></div>`;
  else box = `<form class="cbox" id="cmf"><input type="hidden" id="cpar"><textarea id="cmt" maxlength="1000" placeholder="Написать комментарий…"></textarea><button class="ob" type="submit">➤</button></form><div class="err" id="cme" style="padding:0 14px"></div>`;
  return `<h3 style="padding:14px 14px 4px">Комментарии · ${list.length}</h3>${roots.map(c => commentHtml(c, kids(c.id))).join("") || `<div class="note">💬 ${esc(T("empty_comments"))}</div>`}${box}`;
}
// Комментарии: нижняя шторка в стиле X (лента, страница поста, «Медиа», кинорежим)
function closeComments(now) {
  const s = $(".cs"), bd = $(".cs-bd"); if (!s) return; document.body.classList.remove("cs-open"); s.style.transform = "";
  const done = () => { s.remove(); bd?.remove(); document.body.style.overflow = ""; removeEventListener("keydown", csKey, true); };
  now ? done() : setTimeout(done, 320);
}
function csKey(e) { if (e.key == "Escape") { e.stopPropagation(); closeComments(); } }
async function openComments(id, onChange) {
  const p = S.posts.find(x => x.id == id); if (!p) return;
  closeComments(true);
  const bd = document.createElement("div"); bd.className = "cs-bd";
  const d = document.createElement("div"); d.className = "cs"; d.setAttribute("role", "dialog");
  d.innerHTML = `<div class="cs-grab"><i></i></div><div class="cs-h"><h3>${esc(p.title)} <small>· ${p.comment_count || 0}</small></h3><button class="cs-x" title="Закрыть">✕</button></div><div class="cs-list"><div class="note">Загрузка…</div></div>`;
  document.body.append(bd, d); document.body.style.overflow = "hidden";
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("cs-open")));
  const close = () => closeComments();
  bd.onclick = close; d.querySelector(".cs-x").onclick = close; addEventListener("keydown", csKey, true);
  let y0 = null, dy = 0, t0 = 0;
  d.querySelectorAll(".cs-grab,.cs-h").forEach(h => {
    h.addEventListener("pointerdown", e => { if (e.target.closest(".cs-x")) return; y0 = e.clientY; dy = 0; t0 = Date.now(); d.classList.add("drag"); h.setPointerCapture(e.pointerId); });
    h.addEventListener("pointermove", e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); d.style.transform = `translateY(${dy}px)`; bd.style.opacity = 1 - dy / d.offsetHeight; });
    const up = () => { if (y0 === null) return; y0 = null; d.classList.remove("drag"); bd.style.opacity = ""; if (dy > d.offsetHeight * .25 || dy / Math.max(1, Date.now() - t0) > .5) close(); else d.style.transform = ""; };
    h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
  });
  const draw = async () => {
    const b = d.querySelector(".cs-list"); b.innerHTML = (await commentsBlock(p)).replace(/^<h3[^>]*>.*?<\/h3>/, "");
    d.querySelector(".cs-in")?.remove(); d.querySelector("#cme")?.remove();
    const f = b.querySelector("#cmf"), err = b.querySelector("#cme");
    if (f) { f.className = "cs-in"; f.querySelector("button").className = "cs-send"; d.append(f); err && f.before(err); }
    d.querySelector(".cs-h small").textContent = `· ${p.comment_count || 0}`;
    d.querySelectorAll("[data-open]").forEach(x => x.onclick = e => { e.preventDefault(); closeComments(true); window.MiaViewer?.isOpen() && window.MiaViewer.close(); openModal({ t: x.dataset.open }); });
    d.querySelectorAll("[data-sub]").forEach(x => x.onclick = e => { e.preventDefault(); closeComments(true); window.MiaViewer?.isOpen() && window.MiaViewer.close(); subscribe(p.tier_rank, p.id); });
    const ta = d.querySelector("#cmt"); if (ta) ta.oninput = () => { ta.style.height = "44px"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; };
    if (f) f.onsubmit = async e => { e.preventDefault(); const t = ta.value.trim(); if (!t) return;
      const par = d.querySelector("#cpar").value;
      const { error } = await sb.rpc("add_comment", { p_post: id, p_body: t, p_parent: par ? +par : null });
      if (error) return d.querySelector("#cme").textContent = CERR[error.message] || error.message;
      p.comment_count++; await draw(); updCount(); const l = d.querySelector(".cs-list"); l.scrollTop = l.scrollHeight; };
    d.querySelectorAll("[data-rep]").forEach(a => a.onclick = () => { d.querySelector("#cpar").value = a.dataset.rep; ta.placeholder = "Ответ для " + a.dataset.nm + "…"; fineP() ? ta.focus() : ta.scrollIntoView({ block: "nearest" }); });
    d.querySelectorAll("[data-cdel]").forEach(a => a.onclick = async () => { if (!confirm("Удалить комментарий?")) return; await sb.rpc("delete_my_comment", { p_id: +a.dataset.cdel }); p.comment_count--; await draw(); updCount(); });
    d.querySelectorAll("[data-crep]").forEach(a => a.onclick = async () => { await sb.rpc("report_comment", { p_id: +a.dataset.crep }); toast("Жалоба отправлена"); });
  };
  const updCount = () => { $$(`[data-cm="${id}"]`).forEach(a => a.textContent = `💬 ${p.comment_count || 0}`); onChange && onChange(); };
  await draw();
}
async function postView(id) {
  const p = S.posts.find(x => x.id == id); if (!p) return bar() + `<div class="empty">Публикация не найдена</div>`;
  const head = `<div class="ph" style="padding-top:14px"><a href="#/feed">← Лента</a><span>${fmt(p.publish_at)}</span></div>`;
  if (isLocked(p)) return bar() + head + `<div class="cov lk"><img ${imgSrc(p.cover_path, "(min-width:640px) 600px, 100vw")} alt="" fetchpriority="high"><h3>${esc(p.title)}</h3><span class="cnt${S.pv?.[p.id]?.video_count ? " nv" : ""}">${cntHtml(p, `${p.image_count} ${plural(p.image_count, "арт", "арта", "артов")}`)}</span>${lockPanel(p)}</div>` + ACT(p) + `<div id="pcmw">${await commentsBlock(p)}</div>`;
  const r = await packFn(id);
  if (r.status !== 200) return bar() + head + `<div class="empty">Не удалось открыть: ${esc(r.status == 0 ? T("offline") : r.data.message || r.data.error || r.status)}</div>`;
  S.imgs = r.data.images.map(i => abs(i.url)); S.idx = 0; S.imgsFor = id;
  return bar() + head + `<div style="padding:0 14px 10px;font-size:20px;font-weight:700">${esc(p.title)}</div><div class="arts">${(() => { const md = S.media.filter(m => m.post_id == id).sort((a, b) => a.position - b.position), same = md.length == r.data.images.length; return r.data.images.map((im, k) => { const w = im.width || (same && md[k].width), h = im.height || (same && md[k].height); const at = `alt="" data-vi="${k}" ${w && h ? `width="${w}" height="${h}"` : ""} ${k < 1 ? `fetchpriority="high"` : `loading="lazy"`}`;
    // видео: на странице пака — постер в том же <img> + ▶ и длительность; играет в кинорежиме
    if (im.kind == "video" || /\.mp4(\?|$)/i.test(S.imgs[k])) { const ps = im.poster || (same && md[k].preview_path); return `<div class="vd">${ps ? `<img src="${pub(ps)}" ${at}>` : `<img ${at}>`}${vPlay}<span class="cnt nv">${IV}${dur(im.duration ?? S.mvList?.find(x => x.post_id == id && same && x.position == md[k].position)?.duration_sec)}</span></div>`; }
    return `<img src="${S.imgs[k]}" ${at}>`; }).join(""); })()}</div>
  ${p.body ? `<div class="body">${esc(p.body)}</div>` : ""}` + ACT(p) + `<div id="cmts"></div><div id="pcmw">${await commentsBlock(p)}</div>`;
}
function go(i) { const n = S.imgs.length; S.idx = (i + n) % n; $("#sl") && ($("#sl").style.transform = `translateX(${-100 * S.idx}%)`); $("#ctr") && ($("#ctr").textContent = `${S.idx + 1} / ${n}`); $$("#dots i").forEach((d, k) => d.className = k == S.idx ? "on" : ""); const f = $("#fsi"); if (f) { f.src = S.imgs[S.idx]; $("#fsc").textContent = `${S.idx + 1} / ${n}`; } }
function fullscreen() { const d = document.createElement("div"); d.className = "fsbox"; d.innerHTML = `<img id="fsi" src="${S.imgs[S.idx]}"><span class="x">✕</span><span class="ctr" id="fsc">${S.idx + 1} / ${S.imgs.length}</span><span class="nv" style="left:0">‹</span><span class="nv" style="right:0">›</span>`; document.body.append(d);
  d.onclick = e => { if (e.target.classList.contains("x")) d.remove(); else if (e.target.classList.contains("nv")) go(S.idx + (e.target.style.left ? -1 : 1)); }; swipe(d); }
function swipe(el) { let x0 = null; el.addEventListener("touchstart", e => x0 = e.touches[0].clientX, { passive: true }); el.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(S.idx + (dx < 0 ? 1 : -1)); x0 = null; }); }

// ---------- profiles ----------
async function meView(tab = "likes") {
  if (!S.user) return bar() + `<div class="note">${esc(T("guest_comment"))} · <a class="lnk" data-open="login">${esc(T("btn_login"))}</a></div>`;
  const u = S.user, liked = S.posts.filter(p => S.liked.has(p.id));
  let body = "";
  if (tab == "likes") body = liked.length ? `<div class="grid">${liked.map(p => `<a href="#/post/${p.id}" style="background-image:url('${pub(p.thumb_path || p.cover_path)}')"></a>`).join("")}</div>` : `<div class="note">♡ ${esc(T("empty_likes"))}</div>`;
  else if (tab == "comments") { const l = await api(`comments_public?user_id=eq.${u.id}&order=created_at.desc&limit=50`).catch(() => []);
    body = l.map(c => `<a class="cm" href="#/post/${c.post_id}"><div><div class="mu small">${fmt(c.created_at)} · ${esc(S.posts.find(p => p.id == c.post_id)?.title || "")}</div><div class="t">${esc(c.body)}</div></div></a>`).join("") || `<div class="note">💬 Комментариев пока нет</div>`; }
  else body = `<div class="card" style="margin:14px">${u.admin ? "" : `<b>Аватар</b><div class="r" style="margin-top:8px"><label class="gb sm" style="margin:0;color:var(--fg)">Загрузить фото<input type="file" id="avf" accept="image/*" class="hide"></label>${u.avatar_path ? `<a class="gb sm" id="avdel">Убрать</a>` : ""}</div>
    <form id="nmf"><label>Имя (менять можно раз в 30 дней)</label><div class="r"><input type="text" id="nm" value="${esc(u.username)}" maxlength="24"><button class="gb" type="submit">Сохранить</button></div><div class="err" id="nme"></div></form>`}
    <form id="pwf"><b style="display:block;margin-top:16px">Смена пароля</b><label>Старый пароль</label><input type="password" id="pw0" autocomplete="current-password"><label>Новый пароль</label><input type="password" id="pw1" autocomplete="new-password"><label>Повторите новый</label><input type="password" id="pw2" autocomplete="new-password"><div class="err" id="pwe"></div><button class="ob" type="submit">Сменить пароль</button></form>
    <div class="r" style="margin-top:16px;flex-wrap:wrap"><a class="gb" id="lout">Выйти</a><a class="gb" id="loutall">Выйти на всех устройствах</a></div>${u.admin ? "" : `<p style="margin-top:14px"><a class="danger small" id="delme">Удалить аккаунт</a></p>`}</div>`;
  return `<div class="bar"><a href="#/feed">← Назад</a><a class="gb sm" id="lout2">Выйти</a></div><div class="prof" style="padding-top:20px">${avatarHtml(u, 96, "margin:0 auto 8px")}<h1>${esc(u.admin ? "mia_owner" : u.username)}</h1>${u.admin ? `<span class="tier">Владелец</span>` : S.rank > 0 ? `<span class="tier">${esc(tierName(S.rank))} Подписчик</span>` : `<span class="tier f">Follower</span>`}
  ${u.created_at ? `<div class="mu" style="margin-top:6px">С нами с ${new Date(u.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}</div>` : ""}${u.banned ? `<div class="note">⛔ ${esc(T("banned"))}</div>` : ""}</div>
  <div class="tabs">${[["likes", "Понравилось"], ["comments", "Мои комментарии"], ["settings", "Настройки"]].map(([k, n]) => `<a href="#/me/${k}" class="${k == tab ? "on" : ""}">${n}</a>`).join("")}</div>${body}`;
}
async function userView(id) {
  const r = await api(`profiles_public?id=eq.${id}`).catch(() => []); const u = r[0]; if (!u) return bar() + `<div class="empty">Пользователь не найден</div>`;
  return bar() + `<div class="prof" style="padding-top:24px">${avatarHtml(u, 96, "margin:0 auto 8px")}<h1>${esc(u.username)}</h1>${u.tier_rank > 0 ? `<span class="tier">${esc(tierName(u.tier_rank))}</span>` : `<span class="tier f">Follower</span>`}<div class="mu" style="margin-top:6px">С нами с ${new Date(u.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}</div></div>`;
}
function bindMe() {
  const out = async scope => { await sb.auth.signOut(scope ? { scope } : undefined); S.token = ""; localStorage.removeItem("miaToken"); await loadUser(); toast("Вы вышли"); location.hash = "#/feed"; };
  $("#lout") && ($("#lout").onclick = () => out()); $("#lout2") && ($("#lout2").onclick = () => out()); $("#loutall") && ($("#loutall").onclick = () => out("global"));
  $("#avf") && ($("#avf").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { await need("crop.js", "Crop"); } catch { return toast(T("offline")); } const img = await Crop.loadImg(f);
    const r = await Crop.open(img, { title: "Аватар", aspect: 1, round: true, outW: 256, outH: 256, previews: [{ w: 96, h: 96, round: 1, label: "96 · профиль" }, { w: 40, h: 40, round: 1, label: "40 · комментарий" }, { w: 28, h: 28, round: 1, label: "28 · меню" }] });
    if (!r) return; const path = `${S.user.id}/${Date.now()}.jpg`;
    const up = await sb.storage.from("avatars").upload(path, r.blob, { contentType: "image/jpeg" }); if (up.error) return toast("Ошибка: " + up.error.message);
    if (S.user.avatar_path) sb.storage.from("avatars").remove([S.user.avatar_path]);
    const { error } = await sb.rpc("set_my_avatar", { p_path: path }); if (error) return toast("Ошибка: " + error.message); await loadUser(); toast("Аватар обновлён"); render(); });
  $("#avdel") && ($("#avdel").onclick = async () => { await sb.storage.from("avatars").remove([S.user.avatar_path]); await sb.rpc("set_my_avatar", { p_path: null }); await loadUser(); render(); });
  $("#nmf") && ($("#nmf").onsubmit = async e => { e.preventDefault(); const { error } = await sb.rpc("set_my_username", { p_name: $("#nm").value });
    if (error) return $("#nme").textContent = { bad_name: "Имя: 2–24 символа, буквы, цифры или _", too_soon: "Имя можно менять раз в 30 дней", taken: T("name_taken") }[error.message] || error.message; await loadUser(); toast("Имя изменено"); render(); });
  $("#pwf") && ($("#pwf").onsubmit = async e => { e.preventDefault(); const pe = $("#pwe"), n = $("#pw1").value;
    if (n.length < 8) return pe.textContent = "Минимум 8 символов"; if (n != $("#pw2").value) return pe.textContent = "Пароли не совпадают"; pe.textContent = "Сохраняю…";
    const r = await fn("login", { action: "change_password", old_password: $("#pw0").value, new_password: n });
    if (r.status == 200) { pe.className = "okm"; pe.textContent = "✔ Пароль изменён"; $("#pwf").reset(); } else { pe.className = "err"; pe.textContent = r.status == 401 ? "Старый пароль неверный" : r.status == 429 ? T("rate_limited") : "Не удалось сменить пароль"; } });
  $("#delme") && ($("#delme").onclick = async () => { const pw = prompt("Чтобы удалить аккаунт, введите пароль. Это нельзя отменить."); if (!pw) return;
    const r = await fn("login", { action: "delete_self", old_password: pw }); if (r.status != 200) return toast("Неверный пароль"); await sb.auth.signOut(); await loadUser(); toast("Аккаунт удалён"); location.hash = "#/feed"; });
}

// Ссылки на полные арты пака через функцию unlock, с кэшем на 45 минут (просмотр, «Медиа», смена пака в кинорежиме)
// арты пака: по уровню (unlock) или, если пак открыт через «1 пак на выбор», через pack_images
// пак открыт кодом «1 пак на выбор» и не по уровню → сразу pack_images (без лишнего unlock); если не вышло — старый путь
const packFn = id => { const p = S.posts.find(x => x.id == id), viaPick = S.pick.unlocked.has(id) && p && p.tier_rank > S.rank;
  const old = () => fn("unlock", { token: S.token || undefined, post_id: id }).then(r => r.status != 200 && S.pick.unlocked.has(id) ? fn("pack_images", { post_id: id }) : r);
  return viaPick ? fn("pack_images", { post_id: id }).then(r => r.status == 200 ? r : old()) : old(); };
const VC_TTL = 45 * 60e3;
const vcLoad = () => { try { const o = JSON.parse(sessionStorage.miaVC || "{}"), n = Date.now(); for (const k in o) if (!(n - o[k].t < VC_TTL)) delete o[k]; return o; } catch { return {}; } };
const vcSave = () => { try { sessionStorage.miaVC = JSON.stringify(S.vc || {}); } catch {} };
function loadImgs(id) {
  S.vc = S.vc || vcLoad(); S.vp = S.vp || {}; id = +id || id;
  const hit = S.vc[id] && Date.now() - S.vc[id].t < VC_TTL ? S.vc[id].u : S.imgsFor == id && S.imgs ? S.imgs : null;
  if (hit) return Promise.resolve(hit); if (S.vp[id]) return S.vp[id];
  return S.vp[id] = packFn(id).then(r => { if (r.status != 200) throw new Error(r.status); const u = r.data.images.map(i => abs(i.url)); S.vc[id] = { u, t: Date.now() }; vcSave(); return u; }).finally(() => delete S.vp[id]);
}
function openViewer(id, start, quick, o = {}) {
  const p = S.posts.find(x => x.id == id); if (!p) return;
  if (isLocked(p) && freeOf(p.id).length) { window.MiaViewer.open(p, new Promise(() => {}), { start, quick: true, ...o }); return setTimeout(() => window.MiaViewer.free(p.id, start || 0), 0); } // «пробник»
  window.MiaViewer.open(p, loadImgs(p.id), { start, quick, ...o });
}
// «Медиа»: открытые плитки подгружают полные арты лениво, пока показано превью
function bindMedia() {
  // плитки показывают превью 700px; полные оригиналы грузятся только в кинорежиме
  $$(".mgrid a[data-mp]").forEach(t => { t.onclick = e => { if (e.target.closest("[data-cm]")) return; e.preventDefault(); openViewer(t.dataset.mp, +t.dataset.mi, false); }; });
}
// ---------- render ----------
// комментарии на странице поста: перерисовываем только блок комментариев (без перезагрузки артов и unlock)
async function redrawPostCm(id) { const w = $("#pcmw"), p = S.posts.find(x => x.id == id); if (!w || !p) return render();
  w.innerHTML = await commentsBlock(p); bindPostCm(id); $$(`.act [data-cm="${id}"]`).forEach(a => a.textContent = `💬 ${p.comment_count || 0}`); }
function bindPostCm(id) {
  if ($("#cmf")) { $("#cmf").onsubmit = async e => { e.preventDefault(); const b = $("#cmt").value.trim(); if (!b) return;
      const { error } = await sb.rpc("add_comment", { p_post: id, p_body: b, p_parent: $("#cpar").value ? +$("#cpar").value : null });
      if (error) return $("#cme").textContent = CERR[error.message] || error.message; const p = S.posts.find(x => x.id == id); if (p) p.comment_count++; redrawPostCm(id); }; }
  $$("#pcmw [data-rep], #app > [data-rep]").forEach(a => a.onclick = () => { $("#cpar").value = a.dataset.rep; $("#cmt").placeholder = "Ответ для " + a.dataset.nm + "…"; fineP() ? $("#cmt").focus() : $("#cmt").scrollIntoView({ block: "nearest" }); });
  $$("#pcmw [data-cdel]").forEach(a => a.onclick = async () => { if (!confirm("Удалить комментарий?")) return; await sb.rpc("delete_my_comment", { p_id: +a.dataset.cdel }); const p = S.posts.find(x => x.id == id); if (p) p.comment_count--; redrawPostCm(id); });
  $$("#pcmw [data-crep]").forEach(a => a.onclick = async () => { await sb.rpc("report_comment", { p_id: +a.dataset.crep }); toast("Жалоба отправлена"); });
}
async function render(o = {}) {
  const parts = (location.hash || "#/feed").slice(2).split("/"), [v, id] = parts, app = $("#app");
  app.className = "app" + (v == "admin" ? " wide" : "");
  try {
    if (v == "admin") { if (!S.user?.admin) { location.hash = "#/feed"; return; } await need("crop.js", "Crop"); await need("admin.js", "MiaAdmin"); await window.MiaAdmin.render(id || "posts", parts[2]); }
    else app.innerHTML = v == "post" ? await postView(id) : v == "me" ? await meView(id) : v == "u" ? await userView(id) : (views[v] || views.feed)();
  } catch (e) { console.error(e); app.innerHTML = `<div class="empty">📡 ${esc(T("offline"))}<br><br><button class="ob" onclick="location.reload()">Повторить</button></div>`; }
  if (!o.keep && (!["post"].includes(v) || parts[2] != "c")) window.scrollTo(0, 0);
  $("#tg")?.addEventListener("click", () => { const d = document.body.classList.toggle("dark"); localStorage.miaTheme = d ? "dark" : "light"; render(); });
  $$("[data-open]").forEach(b => b.onclick = e => { e.preventDefault(); openModal({ t: b.dataset.open }); });
  $$("[data-sub]").forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); const p = S.posts.find(x => x.id == b.dataset.sub); subscribe(p.tier_rank, p.id); });
  $$("[data-subt]").forEach(b => b.onclick = () => subscribe(+b.dataset.subt, null));
  $$("[data-share]").forEach(b => b.onclick = () => { const u = location.href.split("#")[0] + "#/post/" + b.dataset.share; navigator.share ? navigator.share({ url: u }).catch(() => {}) : navigator.clipboard.writeText(u).then(() => toast("Ссылка скопирована")); });
  $$("[data-like]").forEach(b => b.onclick = e => { e.preventDefault(); toggleLike(b.dataset.like); });
  $$("[data-cm]").forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); openComments(a.dataset.cm); });
  if (v == "media") bindMedia();
  $$("[data-view]").forEach(a => a.onclick = e => { e.preventDefault(); openViewer(a.dataset.view, 0, false); }); tzBind(); heroVid(); introRun(v);
  $$("[data-vi]").forEach(im => im.onclick = () => openViewer(id, +im.dataset.vi, true));
  if (parts[2] == "c") setTimeout(() => $("#cmts")?.scrollIntoView({ behavior: "smooth" }), 100);
  if ($("#vw")) { $("#fsb").onclick = fullscreen; $("#vw").onclick = e => { if (e.target.tagName == "IMG") go(S.idx + 1); }; swipe($("#vw")); }
  bindPostCm(id);
  if (v == "me") bindMe();
  if (S.modal) drawModal();
}
window.Mia = { cntText, cntHtml, sbPub, imgSrc, bgSrc, vOf, freeOf, freeFn, freePlate, isLocked, pickOpen, pickBtn, openComments, closeComments, loadImgs, subscribe, openViewer, toggleLike, sb, S, $, $$, esc, pub, fmt, toast, T, DEF, fn, load, render, B, plural, setTexts: t => TX = t };
window.addEventListener("hashchange", () => { if (window.MiaViewer?.isOpen()) window.MiaViewer.close(); if (S.modal) { S.modal = null; $("#modal")?.remove(); } closeComments(true); render(); });
$("#app").innerHTML = `<div style="padding:14px"><div class="sk" style="height:120px"></div><div class="sk" style="height:300px;margin-top:14px"></div><div class="sk" style="height:16px;margin-top:10px;width:60%"></div></div>`;
fetch("version.txt?" + Date.now(), { cache: "no-store" }).then(r => r.text()).then(v => { v = v.trim(); if (v && v != window.MIA_VERSION && sessionStorage.miaReloaded != v) { sessionStorage.miaReloaded = v; location.reload(); } }).catch(() => {});
const hasAuth = () => { try { return !!(S.token || localStorage.getItem("mia-visitor")); } catch { return true; } };
// гость: сразу рисуем из кэша (если свежий, < 24 ч), потом свежие данные; перерисовка — только если что-то изменилось
const sigNow = () => JSON.stringify([S.posts, S.media, S.tiers, S.profile, S.viewer, TX, S.free, S.imgv]);
const cached = (() => { try { const c = JSON.parse(localStorage.miaCache || "null"); return c && c.at && Date.now() - c.at < 864e5 && c.st ? c : null; } catch { return null; } })();
let cacheSig = "";
if (!hasAuth() && cached) { try { fromCache(cached); cacheSig = sigNow(); render(); } catch { cacheSig = ""; } }
(hasAuth() ? load().then(render) : load({ bgUser: true }).then(async () => {
  if (!cacheSig) await render(); else if (sigNow() != cacheSig && !window.MiaViewer?.isOpen()) await render({ keep: true }); if (S.offline) return; await loadUser().catch(() => {}); if (S.user || S.rank > 0) render(); })).catch(() => { $("#app").innerHTML = `<div class="empty">📡 ${esc(T("offline"))}<br><br><button class="ob" onclick="location.reload()">Повторить</button></div>`; });
})();
