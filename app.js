(() => {
const C = window.MIA_CONFIG, B = C.API_BASE.replace(/\/$/, "");
const H = { apikey: C.ANON_KEY };
const sb = supabase.createClient(B, C.ANON_KEY, { auth: { storageKey: "mia-visitor" } });
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pub = (p, b = "previews") => p ? `${B}/storage/v1/object/public/${b}/${p}` : "";
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
let S = { user: null, liked: new Set(), rank: 0, token: localStorage.miaToken || "", tiers: [], posts: [], media: [], profile: {}, modal: null, offline: false };
if (localStorage.miaTheme === "dark") document.body.classList.add("dark");

function timeout(p, ms = 10000) { return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]); }
const api = p => timeout(fetch(`${B}/rest/v1/${p}`, { headers: H })).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const fn = async (name, body) => { const { data: { session } } = await sb.auth.getSession();
  try { const r = await timeout(fetch(`${B}/functions/v1/${name}`, { method: "POST", headers: { ...H, "Content-Type": "application/json", ...(session ? { Authorization: "Bearer " + session.access_token } : {}) }, body: JSON.stringify(body) }), 15000); return { status: r.status, data: await r.json().catch(() => ({})) }; }
  catch { return { status: 0, data: { error: "offline" } }; } };

async function load() {
  try {
    const [tiers, posts, media, settings] = await Promise.all([api("tiers_public?order=rank"), api("feed_public?order=publish_at.desc"), api("media_public?order=publish_at.desc,position"), api("settings?key=in.(profile,texts,viewer)")]);
    const st = Object.fromEntries(settings.map(x => [x.key, x.value]));
    Object.assign(S, { tiers, posts, media, profile: st.profile || {}, viewer: st.viewer || {}, offline: false }); TX = st.texts || {};
    localStorage.miaCache = JSON.stringify({ tiers, posts, media, st });
  } catch (e) {
    const c = JSON.parse(localStorage.miaCache || "null"); S.offline = true;
    if (!c) throw e; Object.assign(S, { tiers: c.tiers, posts: c.posts, media: c.media, profile: c.st.profile || {}, viewer: c.st.viewer || {} }); TX = c.st.texts || {};
  }
  if (!S.offline) await loadUser();
}
async function loadUser() {
  const { data: { session } } = await sb.auth.getSession(); S.user = null; S.liked = new Set(); S.rank = 0;
  if (session) {
    const [{ data: adm }, { data: pr }] = await Promise.all([sb.from("admins").select("user_id").eq("user_id", session.user.id), sb.from("profiles").select("username,avatar_path,banned_until,created_at").eq("id", session.user.id)]);
    if (adm?.length) S.user = { id: session.user.id, username: "mia_owner", admin: true };
    else if (pr?.length) S.user = { id: session.user.id, ...pr[0], banned: pr[0].banned_until && new Date(pr[0].banned_until) > new Date() };
    else { await sb.auth.signOut(); }
    if (S.user) { const { data: lk } = await sb.from("likes").select("post_id"); S.liked = new Set((lk || []).map(x => x.post_id)); }
  }
  const r = await fn("unlock", S.token ? { token: S.token } : {});
  if (r.status === 200) S.rank = r.data.rank || 0;
  else if (r.status === 401 && S.token) { S.token = ""; localStorage.removeItem("miaToken"); toast(T("code_old")); }
}
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
  return `<div class="hero"><div class="cv">${cover ? `<img src="${cover}" alt="">` : ""}</div><div class="prof"><span class="ava" style="background-image:url('${p.avatar ? pub(p.avatar) : "avatar.jpg"}')"></span>
  <h1>${esc(p.name || "Мия")}</h1><div class="mu">${esc(p.tagline || "")}</div><div class="mu small" style="margin-top:4px">${S.posts.length} ${plural(S.posts.length, "пак", "пака", "паков")} · ${S.media.length} ${plural(S.media.length, "арт", "арта", "артов")}</div>${links ? `<div class="links">${links}</div>` : ""}</div></div>`;
}
const tabs = on => `<div class="tabs">${[["ЛЕНТА", "feed"], ["МЕДИА", "media"], ["УРОВНИ", "levels"], ["ОБ АВТОРЕ", "about"]].map(([n, h]) => `<a href="#/${h}" class="${h == on ? "on" : ""}">${n}</a>`).join("")}</div>`;
const heart = p => `${S.liked.has(p.id) ? "❤" : "♡"} ${p.like_count || 0}`;
const ACT = p => `<div class="act"><a class="${S.liked.has(p.id) ? "on" : ""}" data-like="${p.id}">${heart(p)}</a><a href="#/post/${p.id}" data-cm="${p.id}">💬 ${p.comment_count || 0}</a><span class="sp"></span><a data-share="${p.id}" title="Поделиться">↗</a></div>`;
const lockPanel = p => `<div class="frost"><span class="mu">${esc(T("locked_label"))}</span><b>${esc(p.tier_name)}${p.price_rub ? ` · ${p.price_rub} ₽/мес` : ""}</b><button class="ob" data-sub="${p.id}">🔒 ${esc(T("btn_subscribe"))}</button></div>`;
function card(p) {
  const locked = p.tier_rank > S.rank, n = `${p.image_count} ${plural(p.image_count, "арт", "арта", "артов")}`;
  return `<div class="post"><div class="ph"><span>${fmt(p.publish_at)}</span>${p.tier_rank > 0 ? `<span class="tier">${locked ? `<i class="lki"></i>` : ""}${esc(p.tier_name)}</span>` : `<span class="tier f">Открыто всем</span>`}</div>
  <a href="#/post/${p.id}" class="cov ${locked ? "lk" : ""}" ${locked ? "" : `data-view="${p.id}"`}><img src="${pub(p.cover_path)}" alt="" loading="lazy"><h3>${esc(p.title)}</h3><span class="cnt">${n}</span>${locked ? lockPanel(p) : ""}</a>
  ${p.body && !locked ? `<div class="body">${esc(p.body.length > 300 ? p.body.slice(0, 300) + "…" : p.body)}</div>` : ""}${ACT(p)}</div>`;
}
function levelsHtml() {
  return `<div class="levels">${S.tiers.map(t => `<div class="lv"><b>${esc(t.name)}</b><div class="pr">${t.price_rub ? `${t.price_rub} ₽ <small class="mu">/ мес</small>` : "Бесплатно"}</div><div class="perks">${(t.perks || []).map(x => "✔ " + esc(x)).join("<br>")}</div>
  ${t.rank == 0 ? `<span class="gb full">${S.rank == 0 ? "Вы здесь" : "Входит"}</span>` : S.rank >= t.rank ? `<span class="gb full">✓ Открыто</span>` : `<button class="ob full" data-subt="${t.rank}">${esc(T("btn_subscribe"))}</button>`}</div>`).join("")}</div>`;
}
const views = {
  feed: () => bar() + hero() + tabs("feed") + (S.posts.map(card).join("") || `<div class="note">🎨 ${esc(T("empty_feed"))}</div>`),
  media: () => { const k = {}; return bar() + hero() + tabs("media") + `<div class="grid mgrid">${S.media.map(m => { const i = k[m.post_id] = (k[m.post_id] ?? -1) + 1, lk = m.tier_rank > S.rank, p = S.posts.find(x => x.id == m.post_id);
    return lk ? `<a href="#/post/${m.post_id}" class="lk" style="background-image:url('${pub(m.preview_path)}')"></a>` : `<a href="#/post/${m.post_id}" data-mp="${m.post_id}" data-mi="${i}" style="background-image:url('${pub(m.preview_path)}')">${p ? `<span class="cb" data-cm="${p.id}">💬 ${p.comment_count || 0}</span>` : ""}</a>`; }).join("")}</div>` + (S.media.length ? "" : `<div class="note">🎨 ${esc(T("empty_feed"))}</div>`); },
  levels: () => bar() + hero() + tabs("levels") + levelsHtml(),
  about: () => bar() + hero() + tabs("about") + `<div class="body">${esc(S.profile.about || "Привет! Я Мия, рисую паки артов 💕🐾")}</div>` + levelsHtml(),
};

// ---------- modals ----------
function openModal(m) { if (!S.modal) history.pushState({ m: 1 }, ""); S.modal = m; drawModal(); }
function closeModal(back = true) { S.modal = null; $("#modal")?.remove(); if (back && history.state?.m) history.back(); }
window.addEventListener("popstate", () => { if (S.modal) { S.modal = null; $("#modal")?.remove(); } });
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
  d.innerHTML = `<div class="sheet"><a class="x" data-close>✕</a>${h}</div>`; document.body.append(d);
  d.onclick = e => { if (e.target == d || e.target.dataset.close != null) closeModal(); const sw = e.target.dataset.sw; if (sw) { S.modal = { ...m, t: sw }; drawModal(); } };
  $("#af")?.addEventListener("submit", signup); $("#lf")?.addEventListener("submit", login); $("#cf")?.addEventListener("submit", enterCode);
  setTimeout(() => d.querySelector("input")?.focus(), 50);
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
function afterAuth() {
  const ret = S.modal?.rank != null ? { rank: S.modal.rank, post: S.modal.post } : null;
  if (ret && S.rank < ret.rank) { S.modal = { t: "pay", ...ret }; drawModal(); render(); } else { closeModal(); render(); }
}
async function enterCode(e) {
  e.preventDefault(); const code = $("#ci").value.trim(), ce = $("#ce"); if (!code) return; ce.className = "err"; ce.textContent = "Проверяю…";
  const r = await fn("unlock", { code });
  if (r.status == 200) { if (r.data.token) { S.token = r.data.token; localStorage.miaToken = r.data.token; } S.rank = Math.max(S.rank, r.data.rank);
    ce.className = "okm"; ce.textContent = "✔ " + T("code_ok"); toast(T("code_ok")); const ret = JSON.parse(localStorage.miaReturn || "{}"); localStorage.removeItem("miaReturn");
    const stay = S.stay; S.stay = null; render();
    if (stay && window.MiaViewer?.isOpen()) return setTimeout(() => { closeModal(); stay(); }, 700);
    setTimeout(() => { closeModal(false); location.hash = ret.post ? `#/post/${ret.post}` : "#/feed"; render(); }, 700); }
  else ce.textContent = r.status == 429 ? T("rate_limited") : r.status == 0 ? T("offline") : T("code_bad");
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
  const locked = p.tier_rank > S.rank; S.canComment = S.user && !S.user.banned && !locked;
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
    d.querySelectorAll("[data-rep]").forEach(a => a.onclick = () => { d.querySelector("#cpar").value = a.dataset.rep; ta.placeholder = "Ответ для " + a.dataset.nm + "…"; ta.focus(); });
    d.querySelectorAll("[data-cdel]").forEach(a => a.onclick = async () => { if (!confirm("Удалить комментарий?")) return; await sb.rpc("delete_my_comment", { p_id: +a.dataset.cdel }); p.comment_count--; await draw(); updCount(); });
    d.querySelectorAll("[data-crep]").forEach(a => a.onclick = async () => { await sb.rpc("report_comment", { p_id: +a.dataset.crep }); toast("Жалоба отправлена"); });
  };
  const updCount = () => { $$(`[data-cm="${id}"]`).forEach(a => a.textContent = `💬 ${p.comment_count || 0}`); onChange && onChange(); };
  await draw();
}
async function postView(id) {
  const p = S.posts.find(x => x.id == id); if (!p) return bar() + `<div class="empty">Публикация не найдена</div>`;
  const head = `<div class="ph" style="padding-top:14px"><a href="#/feed">← Лента</a><span>${fmt(p.publish_at)}</span></div>`;
  if (p.tier_rank > S.rank) return bar() + head + `<div class="cov lk"><img src="${pub(p.cover_path)}" alt=""><h3>${esc(p.title)}</h3><span class="cnt">${p.image_count} ${plural(p.image_count, "арт", "арта", "артов")}</span>${lockPanel(p)}</div>` + ACT(p) + await commentsBlock(p);
  const r = await fn("unlock", { token: S.token || undefined, post_id: id });
  if (r.status !== 200) return bar() + head + `<div class="empty">Не удалось открыть: ${esc(r.status == 0 ? T("offline") : r.data.message || r.data.error || r.status)}</div>`;
  S.imgs = r.data.images.map(i => B + i.url); S.idx = 0; S.imgsFor = id;
  return bar() + head + `<div style="padding:0 14px 10px;font-size:20px;font-weight:700">${esc(p.title)}</div><div class="arts">${r.data.images.map((im, k) => `<img src="${S.imgs[k]}" alt="" data-vi="${k}" ${im.width && im.height ? `width="${im.width}" height="${im.height}"` : ""} loading="${k < 2 ? "eager" : "lazy"}">`).join("")}</div>
  ${p.body ? `<div class="body">${esc(p.body)}</div>` : ""}` + ACT(p) + `<div id="cmts"></div>` + await commentsBlock(p);
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
  $("#avf") && ($("#avf").onchange = async e => { const f = e.target.files[0]; if (!f) return; const img = await Crop.loadImg(f);
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
function loadImgs(id) {
  S.vc = S.vc || {}; S.vp = S.vp || {}; id = +id || id;
  const hit = S.vc[id] && Date.now() - S.vc[id].t < 45 * 60e3 ? S.vc[id].u : S.imgsFor == id && S.imgs ? S.imgs : null;
  if (hit) return Promise.resolve(hit); if (S.vp[id]) return S.vp[id];
  return S.vp[id] = fn("unlock", { token: S.token || undefined, post_id: id }).then(r => { if (r.status != 200) throw new Error(r.status); const u = r.data.images.map(i => B + i.url); S.vc[id] = { u, t: Date.now() }; return u; }).finally(() => delete S.vp[id]);
}
function openViewer(id, start, quick) {
  const p = S.posts.find(x => x.id == id); if (!p) return;
  window.MiaViewer.open(p, loadImgs(p.id), { start, quick });
}
// «Медиа»: открытые плитки подгружают полные арты лениво, пока показано превью
function bindMedia() {
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); sharpen(e.target); }), { rootMargin: "300px" }) : null;
  const sharpen = t => loadImgs(t.dataset.mp).then(u => { const src = u[+t.dataset.mi]; if (!src) return; const i = new Image(); i.onload = () => { t.style.backgroundImage = `url("${src}")`; t.classList.add("sharp"); }; i.src = src; }).catch(() => {});
  $$(".mgrid a[data-mp]").forEach(t => { io ? io.observe(t) : sharpen(t); t.onclick = e => { if (e.target.closest("[data-cm]")) return; e.preventDefault(); openViewer(t.dataset.mp, +t.dataset.mi, false); }; });
}
// ---------- render ----------
async function render() {
  const parts = (location.hash || "#/feed").slice(2).split("/"), [v, id] = parts, app = $("#app");
  app.className = "app" + (v == "admin" ? " wide" : "");
  try {
    if (v == "admin") { if (!S.user?.admin) { location.hash = "#/feed"; return; } await window.MiaAdmin.render(id || "posts", parts[2]); }
    else app.innerHTML = v == "post" ? await postView(id) : v == "me" ? await meView(id) : v == "u" ? await userView(id) : (views[v] || views.feed)();
  } catch (e) { console.error(e); app.innerHTML = `<div class="empty">📡 ${esc(T("offline"))}<br><br><button class="ob" onclick="location.reload()">Повторить</button></div>`; }
  if (!["post"].includes(v) || parts[2] != "c") window.scrollTo(0, 0);
  $("#tg")?.addEventListener("click", () => { const d = document.body.classList.toggle("dark"); localStorage.miaTheme = d ? "dark" : "light"; render(); });
  $$("[data-open]").forEach(b => b.onclick = e => { e.preventDefault(); openModal({ t: b.dataset.open }); });
  $$("[data-sub]").forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); const p = S.posts.find(x => x.id == b.dataset.sub); subscribe(p.tier_rank, p.id); });
  $$("[data-subt]").forEach(b => b.onclick = () => subscribe(+b.dataset.subt, null));
  $$("[data-share]").forEach(b => b.onclick = () => { const u = location.href.split("#")[0] + "#/post/" + b.dataset.share; navigator.share ? navigator.share({ url: u }).catch(() => {}) : navigator.clipboard.writeText(u).then(() => toast("Ссылка скопирована")); });
  $$("[data-like]").forEach(b => b.onclick = e => { e.preventDefault(); toggleLike(b.dataset.like); });
  $$("[data-cm]").forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); openComments(a.dataset.cm); });
  if (v == "media") bindMedia();
  $$("[data-view]").forEach(a => a.onclick = e => { e.preventDefault(); openViewer(a.dataset.view, 0, false); });
  $$("[data-vi]").forEach(im => im.onclick = () => openViewer(id, +im.dataset.vi, true));
  if (parts[2] == "c") setTimeout(() => $("#cmts")?.scrollIntoView({ behavior: "smooth" }), 100);
  if ($("#vw")) { $("#fsb").onclick = fullscreen; $("#vw").onclick = e => { if (e.target.tagName == "IMG") go(S.idx + 1); }; swipe($("#vw")); }
  if ($("#cmf")) { $("#cmf").onsubmit = async e => { e.preventDefault(); const b = $("#cmt").value.trim(); if (!b) return;
      const { error } = await sb.rpc("add_comment", { p_post: id, p_body: b, p_parent: $("#cpar").value ? +$("#cpar").value : null });
      if (error) return $("#cme").textContent = CERR[error.message] || error.message; const p = S.posts.find(x => x.id == id); if (p) p.comment_count++; render(); }; }
  $$("[data-rep]").forEach(a => a.onclick = () => { $("#cpar").value = a.dataset.rep; $("#cmt").placeholder = "Ответ для " + a.dataset.nm + "…"; $("#cmt").focus(); });
  $$("[data-cdel]").forEach(a => a.onclick = async () => { if (!confirm("Удалить комментарий?")) return; await sb.rpc("delete_my_comment", { p_id: +a.dataset.cdel }); const p = S.posts.find(x => x.id == id); if (p) p.comment_count--; render(); });
  $$("[data-crep]").forEach(a => a.onclick = async () => { await sb.rpc("report_comment", { p_id: +a.dataset.crep }); toast("Жалоба отправлена"); });
  if (v == "me") bindMe();
  if (S.modal) drawModal();
}
window.Mia = { openComments, closeComments, loadImgs, subscribe, openViewer, toggleLike, sb, S, $, $$, esc, pub, fmt, toast, T, DEF, fn, load, render, B, plural, setTexts: t => TX = t };
window.addEventListener("hashchange", () => { if (window.MiaViewer?.isOpen()) window.MiaViewer.close(); if (S.modal) { S.modal = null; $("#modal")?.remove(); } closeComments(true); render(); });
$("#app").innerHTML = `<div style="padding:14px"><div class="sk" style="height:120px"></div><div class="sk" style="height:300px;margin-top:14px"></div><div class="sk" style="height:16px;margin-top:10px;width:60%"></div></div>`;
fetch("version.txt?" + Date.now(), { cache: "no-store" }).then(r => r.text()).then(v => { v = v.trim(); if (v && v != window.MIA_VERSION && !sessionStorage.miaReloaded) { sessionStorage.miaReloaded = 1; location.reload(); } }).catch(() => {});
load().then(render).catch(() => { $("#app").innerHTML = `<div class="empty">📡 ${esc(T("offline"))}<br><br><button class="ob" onclick="location.reload()">Повторить</button></div>`; });
})();
