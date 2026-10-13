(() => {
const C = window.MIA_CONFIG, B = C.API_BASE.replace(/\/$/, "");
const H = { apikey: C.ANON_KEY };
const sb = supabase.createClient(B, C.ANON_KEY, { auth: { storageKey: "mia-visitor" } });
const emailFor = async u => { const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(u.trim().toLowerCase()))); return "u" + Array.from(h.slice(0, 16), b => b.toString(16).padStart(2, "0")).join("") + "@users.mia.local"; };
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pub = p => `${B}/storage/v1/object/public/previews/${p}`;
const api = (p) => fetch(`${B}/rest/v1/${p}`, { headers: H }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const unlock = async (body) => { const { data: { session } } = await sb.auth.getSession(); return fetch(`${B}/functions/v1/unlock`, { method: "POST", headers: { ...H, "Content-Type": "application/json", ...(session ? { Authorization: "Bearer " + session.access_token } : {}) }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) })); };
const fmt = d => new Date(d).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(",", " в");
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m == 1 && h != 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
const toast = t => { const e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 2600); };
let S = { user: null, liked: new Set(), rank: +(localStorage.miaRank || 0), token: localStorage.miaToken || "", tiers: [], posts: [], media: [], profile: {} };
if (localStorage.miaTheme === "dark") document.body.classList.add("dark");

async function load() {
  const [tiers, posts, media, settings] = await Promise.all([api("tiers_public?order=rank"), api("feed_public?order=publish_at.desc"), api("media_public?order=publish_at.desc,position"), api("settings?key=eq.profile")]);
  Object.assign(S, { tiers, posts, media, profile: settings[0]?.value || {} });
  await loadUser();
  if (S.user && !S.token) { const r = await unlock({}); if (r.status === 200) setRank(r.data.rank, ""); }
  else if (S.token) { const r = await unlock({ token: S.token }); if (r.status === 200) setRank(r.data.rank, S.token); else { setRank(0, ""); toast("Код сменился — введите новый"); } }
}
async function loadUser() {
  const { data: { session } } = await sb.auth.getSession(); S.user = null; S.liked = new Set();
  if (!session) return;
  const { data: pr } = await sb.from("profiles").select("username,tier_rank").eq("id", session.user.id);
  if (!pr?.length) { await sb.auth.signOut(); return; }
  S.user = { id: session.user.id, username: pr[0].username };
  const { data: lk } = await sb.from("likes").select("post_id"); S.liked = new Set((lk || []).map(x => x.post_id));
}
async function toggleLike(id) {
  if (!S.user) { location.hash = "#/register"; return toast("Зарегистрируйтесь, чтобы ставить лайки"); }
  const p = S.posts.find(x => x.id == id), on = S.liked.has(id);
  const { error } = on ? await sb.from("likes").delete().eq("post_id", id).eq("user_id", S.user.id) : await sb.from("likes").insert({ post_id: id, user_id: S.user.id });
  if (error) return toast("Ошибка: " + error.message);
  on ? S.liked.delete(id) : S.liked.add(id); p.like_count += on ? -1 : 1;
  document.querySelectorAll(`[data-like="${id}"]`).forEach(b => { b.classList.toggle("liked", !on); b.innerHTML = heart(p); });
}
const heart = p => `${S.liked.has(p.id) ? "❤️" : "🤍"} <small>${p.like_count || 0}</small>`;
function setRank(r, t) { S.rank = r; S.token = t; localStorage.miaRank = r; if (t) localStorage.miaToken = t; else localStorage.removeItem("miaToken"); }
const tierName = r => S.tiers.find(t => t.rank == r)?.name || "";
const topTier = () => S.tiers.find(t => t.rank == S.rank);
const links = () => { const l = S.profile.links || {}; return [["b", "Boosty", l.boosty || C.BOOSTY_URL], ["d", "VK Donut", l.donut], ["t", "Telegram", l.telegram], ["v", "VK", l.vk]].filter(x => x[2]).map(([c, n, u]) => `<a class="${c}" href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join(""); };

function bar() {
  const dark = document.body.classList.contains("dark");
  return `<div class="bar"><a class="logo" href="#/feed">Mia</a><div class="r"><a class="toggle" id="tg" title="Тема">${dark ? "☀️" : "🌙"}</a>${S.user ? `<a class="uchip" href="#/me">👤 ${esc(S.user.username)}</a>` : `<a class="ob gb sm" href="#/login">Войти</a>`}${S.rank > 0 ? `<a class="ob" href="#/levels">${esc(tierName(S.rank))} ОТКРЫТО</a>` : `<a class="ob" href="#/code">ВВЕСТИ КОД</a>`}</div></div>`;
}
function hero() {
  const p = S.profile, cover = p.cover ? pub(p.cover) : (S.posts[0] ? pub(S.posts[0].cover_path) : "");
  const n = S.media.length;
  return `<div class="hero"><div class="cv" style="background-image:url('${cover}')"></div><div class="pf"><div class="av" style="background-image:url('${p.avatar ? pub(p.avatar) : "avatar.jpg"}')"></div>
  <h1>${esc(p.name || "Мия")}</h1><div class="sb">${esc(p.tagline || "")}</div>
  <div class="st"><div><b>${S.posts.length}</b>${plural(S.posts.length, "пак", "пака", "паков")}</div><div><b>${n}</b>${plural(n, "арт", "арта", "артов")}</div><div><b>${S.tiers.length}</b>${plural(S.tiers.length, "уровень", "уровня", "уровней")}</div></div>
  <div class="lc">${links()}</div></div></div>${S.rank > 0 ? `<div class="ok">✓ Уровень «${esc(tierName(S.rank))}» открыт на этом устройстве · <a href="#/code"><u>сменить код</u></a></div>` : ""}`;
}
const tabs = on => `<div class="tabs">${[["ЛЕНТА", "feed"], ["МЕДИА", "media"], ["УРОВНИ", "levels"], ["ОБ АВТОРЕ", "about"]].map(([n, h]) => `<a href="#/${h}" class="${h == on ? "on" : ""}">${n}</a>`).join("")}</div>`;
const ACT = id => `<div class="act"><a class="lk-btn ${S.liked.has(id) ? "liked" : ""}" data-like="${id}">${heart(S.posts.find(p => p.id == id) || { id })}</a><span title="Комментарии — на Boosty">💬</span><a class="d" href="${C.BOOSTY_URL}" target="_blank" title="Поддержать">Ⓢ</a><span class="sp"></span><a data-share="${id}" title="Поделиться">⤴</a></div>`;
function card(p) {
  const locked = p.tier_rank > S.rank;
  return `<div class="post"><div class="ph"><span>${fmt(p.publish_at)}</span><span>${locked ? "🔒" : "🔓"}</span></div>
  <a href="#/post/${p.id}" class="cov ${locked ? "lock" : ""}" style="background-image:url('${pub(p.cover_path)}')"><h3>${esc(p.title)}</h3><span class="cnt">🖼 ${p.image_count} ${plural(p.image_count, "арт", "арта", "артов")}</span>
  ${locked ? `<div class="frost">Нужен уровень:<br>${esc(p.tier_name)}<br><span class="ob" data-code="1">🔒 ПОДПИСАТЬСЯ</span></div>` : ""}</a>${ACT(p.id)}</div>`;
}
function tiersHtml() {
  return `<h2>Уровни подписки</h2><div class="htiers">${S.tiers.map(t => { const mine = t.rank <= S.rank;
    return `<div class="tier" ${t.rank > 0 ? 'style="border-color:#f15f2c"' : ""}><div class="tc ${t.rank ? "" : "phd3"}" ${t.rank && S.posts[0] ? `style="background-image:url('${pub(S.posts[0].cover_path)}')"` : ""}></div><div class="tb"><b>${esc(t.name)}</b>
    <div class="pr">${t.price_rub ? `${t.price_rub} ₽ <small>/ мес</small>` : "0 ₽"}</div><ul>${(t.perks || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    ${t.rank == 0 ? `<span class="ob w gb">${S.rank == 0 ? "Вы здесь" : "Входит"}</span>` : mine ? `<span class="ob w gb">✓ Открыто</span>` :
      `<a class="ob w" href="${esc(t.boosty_url || C.BOOSTY_URL)}" target="_blank" rel="noopener">ПОДПИСАТЬСЯ НА BOOSTY</a>${t.donut_url ? `<a class="ob w" style="background:#ff3985" href="${esc(t.donut_url)}" target="_blank">VK DONUT</a>` : ""}<a class="ob w gb" href="#/code">У меня есть код</a>`}</div></div>`; }).join("")}</div>`;
}
const SORT = `<div class="sort"><span>⇅ Сначала новые</span><span class="ic"></span></div>`;
const views = {
  feed: () => bar() + hero() + tabs("feed") + SORT + (S.posts.map(card).join("") || `<div class="empty">Пока нет публикаций</div>`),
  media: () => bar() + hero() + tabs("media") + `<div class="grid">${S.media.map(m => { const lk = m.tier_rank > S.rank;
    return `<a href="#/post/${m.post_id}" class="cell ${lk ? "lk" : ""}"><img loading="lazy" src="${pub(m.preview_path)}" alt="">${lk ? `<span class="l">🔒</span><span class="tg">${esc(m.tier_name)}</span>` : ""}</a>`; }).join("")}</div>` + (S.media.length ? "" : `<div class="empty">Пока пусто</div>`),
  levels: () => bar() + hero() + tabs("levels") + tiersHtml(),
  about: () => bar() + hero() + tabs("about") + `<div class="ab">${esc(S.profile.about || "Привет! Я Мия, рисую паки артов 💕🐾 Каждая публикация — пак из нескольких артов. Обложки открыты всем, а полные паки — для подписчиков.").replace(/\n/g, "<br>")}</div>` + tiersHtml(),
  code: () => views.feed() + codeSheet(),
  login: () => views.feed() + authSheet("login"),
  register: () => views.feed() + authSheet("register"),
  me: () => views.feed() + `<div class="dim" id="dim"><div class="sheet"><div class="h"></div><h3>👤 ${esc(S.user?.username)}</h3><div class="note">${S.rank > 0 ? `Уровень «${esc(tierName(S.rank))}» привязан к аккаунту — он откроется на любом устройстве после входа.` : "Уровень не открыт. Введите код — он привяжется к аккаунту."}</div>${S.rank > 0 ? "" : `<a class="ob w" href="#/code">ВВЕСТИ КОД</a>`}<a class="ob w gb" id="lout">Выйти из аккаунта</a></div></div>`,
};
function authSheet(mode) {
  const reg = mode == "register";
  return `<div class="dim" id="dim"><div class="sheet"><div class="h"></div><h3>${reg ? "Регистрация" : "Вход"}</h3><div class="note">${reg ? "Только имя и пароль, без почты. Аккаунт нужен для лайков и чтобы открытый уровень работал на всех устройствах." : "Войдите, чтобы ставить лайки и открыть свой уровень на этом устройстве."}</div>
  <form id="af" data-mode="${mode}"><input class="in" id="au" autocomplete="username" placeholder="Имя (3–20: буквы, цифры, _)" maxlength="20"><input class="in" id="ap" type="password" autocomplete="${reg ? "new-password" : "current-password"}" placeholder="Пароль (от 6 символов)">${reg ? `<input class="in" id="ap2" type="password" autocomplete="new-password" placeholder="Пароль ещё раз">` : ""}
  <div class="err" id="ae"></div><button class="ob w" type="submit">${reg ? "ЗАРЕГИСТРИРОВАТЬСЯ" : "ВОЙТИ"}</button></form>
  <a class="ob w gb" href="#/${reg ? "login" : "register"}">${reg ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Регистрация"}</a></div></div>`;
}
async function doLogin(u, p) {
  const { error } = await sb.auth.signInWithPassword({ email: await emailFor(u), password: p });
  if (error) return "Неверное имя или пароль";
  await loadUser(); if (!S.user) return "Этот аккаунт нельзя использовать на сайте";
  const r = await unlock(S.token ? { token: S.token, code: undefined } : {}); if (r.status === 200) setRank(r.data.rank, S.token);
  // bind a device-code unlock to the account: re-submit is not possible (code unknown), so device rank stays local
  return "";
}
function codeSheet() {
  const t = S.tiers.filter(t => t.rank > 0).sort((a, b) => a.rank - b.rank)[0];
  return `<div class="dim" id="dim"><div class="sheet"><div class="h"></div><h3>🔒 Введите код уровня</h3><div class="note">Код приходит подписчикам на Boosty${t ? ` (уровень «${esc(t.name)}», ${t.price_rub} ₽/мес)` : ""}. Он откроет все паки этого уровня и ниже и запомнится на этом устройстве.</div>
  <form id="cf"><input class="in code" id="ci" autocomplete="off" autocapitalize="characters" placeholder="MIA-XXXXXX"><div class="err" id="ce"></div><button class="ob w" type="submit">ОТКРЫТЬ</button></form>
  <a class="ob w gb" href="${esc(t?.boosty_url || C.BOOSTY_URL)}" target="_blank" rel="noopener">Нет кода? Подписаться на Boosty ↗</a>${S.rank > 0 ? `<a class="ob w gb" id="lo">Выйти (забыть код)</a>` : ""}</div></div>`;
}
async function postView(id) {
  const p = S.posts.find(x => x.id == id); if (!p) return bar() + `<div class="empty">Публикация не найдена</div>`;
  const head = bar() + `<div class="ph" style="padding-top:14px"><a href="#/feed">← Лента</a><span>${fmt(p.publish_at)} · ${p.tier_rank > S.rank ? "🔒" : "🔓"}</span></div>`;
  if (p.tier_rank > S.rank) return head + `<div class="cov lock" style="background-image:url('${pub(p.cover_path)}')"><h3>${esc(p.title)}</h3><div class="frost"><b style="font-size:20px">🖼 ${p.image_count} ${plural(p.image_count, "арт", "арта", "артов")}</b><br>Нужен уровень: ${esc(p.tier_name)}${p.price_rub ? ` · ${p.price_rub} ₽/мес` : ""}<br><span class="ob" data-code="1">🔒 ПОДПИСАТЬСЯ</span></div></div><div class="txt">${esc(p.body)}</div>` + ACT(p.id);
  const r = await unlock({ token: S.token || undefined, post_id: id });
  if (r.status !== 200) { if (r.status == 401) setRank(0, ""); return head + `<div class="empty">Не удалось открыть: ${esc(r.data.message || r.data.error || r.status)}</div>`; }
  S.imgs = r.data.images.map(i => B + i.url); S.dims = r.data.images; S.idx = 0;
  return head + `<div style="padding:0 14px 10px;font-size:20px;font-weight:700">${esc(p.title)}</div><div class="viewer" id="vw"><div class="slides" id="sl">${S.imgs.map((u, k) => `<img src="${u}" alt="" width="${S.dims[k].width || 1000}" height="${S.dims[k].height || 1000}" style="height:auto">`).join("")}</div><span class="ctr" id="ctr">1 / ${S.imgs.length}</span><span class="fs" id="fsb">⛶</span></div>
  <div class="dots" id="dots">${S.imgs.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div><div class="txt">${esc(p.body)}</div>` + ACT(p.id);
}
function go(i) { const n = S.imgs.length; S.idx = (i + n) % n; $("#sl") && ($("#sl").style.transform = `translateX(${-100 * S.idx}%)`); $("#ctr") && ($("#ctr").textContent = `${S.idx + 1} / ${n}`); document.querySelectorAll("#dots i").forEach((d, k) => d.className = k == S.idx ? "on" : ""); const f = $("#fsi"); if (f) { f.src = S.imgs[S.idx]; $("#fsc").textContent = `${S.idx + 1} / ${n}`; } }
function fullscreen() { const d = document.createElement("div"); d.className = "fsbox"; d.innerHTML = `<img id="fsi" src="${S.imgs[S.idx]}"><span class="x">✕</span><span class="ctr" id="fsc">${S.idx + 1} / ${S.imgs.length}</span><span class="nv" style="left:0">‹</span><span class="nv" style="right:0">›</span>`; document.body.append(d);
  d.onclick = e => { if (e.target.classList.contains("x")) d.remove(); else if (e.target.classList.contains("nv")) go(S.idx + (e.target.style.left ? -1 : 1)); }; swipe(d); }
function swipe(el) { let x0 = null; el.addEventListener("touchstart", e => x0 = e.touches[0].clientX, { passive: true }); el.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(S.idx + (dx < 0 ? 1 : -1)); x0 = null; }); }

async function render() {
  const [, v, id] = (location.hash || "#/feed").split("/"); const app = $("#app");
  try { app.innerHTML = v == "post" ? await postView(id) : (views[v] || views.feed)(); } catch (e) { app.innerHTML = `<div class="empty">Не удалось загрузить данные (${esc(e.message)}). Если вы в России — попробуйте позже или с другим интернетом.</div>`; }
  if (v != "code" && v != "post") window.scrollTo(0, 0);
  $("#tg")?.addEventListener("click", () => { const d = document.body.classList.toggle("dark"); localStorage.miaTheme = d ? "dark" : "light"; render(); });
  document.querySelectorAll("[data-code]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); location.hash = "#/code"; }));
  document.querySelectorAll("[data-share]").forEach(b => b.addEventListener("click", () => { const u = location.href.split("#")[0] + "#/post/" + b.dataset.share; navigator.share ? navigator.share({ url: u }) : navigator.clipboard.writeText(u).then(() => toast("Ссылка скопирована")); }));
  if ($("#vw")) { $("#fsb").onclick = fullscreen; $("#vw").onclick = e => { if (e.target.tagName == "IMG") go(S.idx + 1); }; swipe($("#vw")); }
  document.querySelectorAll("[data-like]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); toggleLike(b.dataset.like); }));
  if ($("#dim")) { $("#dim").onclick = e => { if (e.target.id == "dim") location.hash = "#/feed"; }; ($("#ci") || $("#au"))?.focus();
    $("#lo") && ($("#lo").onclick = () => { setRank(0, ""); location.hash = "#/feed"; });
    $("#lout") && ($("#lout").onclick = async () => { await sb.auth.signOut(); S.user = null; S.liked = new Set(); setRank(0, ""); toast("Вы вышли"); location.hash = "#/feed"; });
    $("#af") && ($("#af").onsubmit = async e => { e.preventDefault(); const reg = e.target.dataset.mode == "register", u = $("#au").value.trim(), p = $("#ap").value, ae = $("#ae");
      if (reg && p !== $("#ap2").value) return ae.textContent = "Пароли не совпадают";
      ae.textContent = reg ? "Создаю аккаунт…" : "Вход…";
      if (reg) { const r = await fetch(`${B}/functions/v1/register`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) }); const d = await r.json().catch(() => ({}));
        if (!r.ok) return ae.textContent = d.message || "Ошибка регистрации"; }
      const err = await doLogin(u, p); if (err) return ae.textContent = err;
      toast(reg ? `Добро пожаловать, ${S.user.username}!` : `Привет, ${S.user.username}!`); location.hash = "#/feed"; });
    if ($("#cf")) $("#cf").onsubmit = async e => { e.preventDefault(); const code = $("#ci").value.trim(); if (!code) return; $("#ce").textContent = "Проверяю…";
      const r = await unlock({ code }); if (r.status == 200) { setRank(r.data.rank, r.data.token); toast(`Открыт уровень «${tierName(r.data.rank)}»${r.data.account ? " и привязан к аккаунту" : ""}`); location.hash = "#/feed"; } else $("#ce").textContent = r.data.message || "Ошибка, попробуйте ещё раз"; }; }
}
window.addEventListener("hashchange", render);
$("#app").innerHTML = `<div class="empty">Загрузка…</div>`;
load().then(render).catch(e => { $("#app").innerHTML = `<div class="empty">Не удалось загрузить данные (${esc(e.message)}).<br>Если вы в России и сайт не открывается — попробуйте позже.</div>`; });
})();
