(() => {
const C = window.MIA_CONFIG, sb = supabase.createClient(C.API_BASE, C.ANON_KEY);
const $ = s => document.querySelector(s), app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pub = p => sb.storage.from("previews").getPublicUrl(p).data.publicUrl;
const toast = t => { const e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 3000); };
if (localStorage.miaTheme === "dark") document.body.classList.add("dark");
let tiers = [], files = [], cover = 0;
const nav = on => `<div class="top"><a href="index.html">← Сайт</a><span>Админка</span><a id="out" style="color:#f15f2c">Выйти</a></div><div class="tabs">${[["new", "Новая публикация"], ["posts", "Публикации"], ["codes", "Коды"], ["profile", "Профиль"]].map(([h, n]) => `<a href="#${h}" class="${on == h ? "on" : ""}">${n}</a>`).join("")}</div>`;

function login(msg = "") {
  app.innerHTML = `<div class="top"><span class="logo">Mia</span><span>Вход для автора</span><a href="index.html">Сайт</a></div><form class="fm" id="lf"><label>Email</label><input class="in" id="em" type="email" autocomplete="username" required><label>Пароль</label><input class="in" id="pw" type="password" autocomplete="current-password" required><button class="ob w" type="submit">ВОЙТИ</button><div class="err" id="le">${esc(msg)}</div><div class="note">Только для владельца. Регистрация закрыта.</div></form>`;
  $("#lf").onsubmit = async e => { e.preventDefault(); $("#le").textContent = "Вход…"; const { error } = await sb.auth.signInWithPassword({ email: $("#em").value, password: $("#pw").value }); if (error) $("#le").textContent = "Неверный email или пароль"; else start(); };
}
async function start() {
  const { data: { session } } = await sb.auth.getSession(); if (!session) return login();
  const { data: adm } = await sb.from("admins").select("user_id").eq("user_id", session.user.id);
  if (!adm?.length) { await sb.auth.signOut(); return login("Этот аккаунт не владелец сайта"); }
  tiers = (await sb.from("tiers_public").select("*").order("rank")).data || [];
  window.onhashchange = route; route();
}
function route() { const v = (location.hash || "#new").slice(1); ({ new: newPost, posts, codes, profile }[v] || newPost)(); $("#out").onclick = async () => { await sb.auth.signOut(); login(); }; }

function loadImg(file) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
function toJpeg(img, max, q, blur = 0) { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  const x = c.getContext("2d"); if (blur) x.filter = `blur(${blur}px)`; x.drawImage(img, 0, 0, c.width, c.height); return new Promise(r => c.toBlob(b => r({ blob: b, w: c.width, h: c.height }), "image/jpeg", q)); }
const uuid = () => crypto.randomUUID();

function newPost() {
  const local = new Date(Date.now() + 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  app.innerHTML = nav("new") + `<form class="fm" id="pf"><label>Заголовок</label><input class="in" id="ti" required maxlength="200" placeholder="Пак 12 артов Мию 💕">
  <label>Текст</label><textarea class="in" id="bo" rows="3" placeholder="Описание пака"></textarea>
  <label id="cnt">Арты · выберите сразу много · ↑↓ — порядок, нажмите на арт — сделать обложкой</label><div class="up" id="up"></div><input type="file" id="fi" accept="image/*" multiple class="hide">
  <label>Уровень доступа</label><div class="seg" id="tsel">${tiers.map((t, i) => `<span data-t="${t.id}" class="${i == tiers.length - 1 ? "on" : ""}">${esc(t.name)}${t.price_rub ? " · " + t.price_rub + " ₽" : " · бесплатно"}</span>`).join("")}</div>
  <label>Публикация</label><div class="seg" id="when"><span data-w="now" class="on">Сейчас</span><span data-w="later">По расписанию</span></div><input class="in hide" id="dt" type="datetime-local" value="${local}">
  <button class="ob w" type="submit" id="pb">ОПУБЛИКОВАТЬ</button><div class="prog hide" id="pg"><div></div></div><div class="note" id="st"></div></form>`;
  files = []; cover = 0; drawUp();
  $("#fi").onchange = e => { files.push(...e.target.files); e.target.value = ""; drawUp(); };
  for (const id of ["#tsel", "#when"]) $(id).onclick = e => { const s = e.target.closest("span"); if (!s) return; $(id).querySelectorAll("span").forEach(x => x.classList.toggle("on", x == s)); if (id == "#when") $("#dt").classList.toggle("hide", s.dataset.w == "now"); };
  $("#pf").onsubmit = publish;
}
function drawUp() {
  const up = $("#up"); up.innerHTML = files.map((f, i) => `<div data-i="${i}" style="background-image:url('${URL.createObjectURL(f)}')"><span class="o">${i + 1}</span><span class="mv"><b data-m="-1">↑</b><b data-m="1">↓</b></span><span class="rm" data-rm="1">✕</span>${i == cover ? '<span class="cv">ОБЛОЖКА</span>' : ""}</div>`).join("") + `<div class="add" id="add">＋</div>`;
  $("#cnt").firstChild.textContent = `Арты · ${files.length} выбрано · ↑↓ — порядок, нажмите на арт — сделать обложкой`;
  $("#add").onclick = () => $("#fi").click();
  up.querySelectorAll("[data-i]").forEach(d => d.onclick = e => { const i = +d.dataset.i, m = e.target.dataset.m;
    if (e.target.dataset.rm) { files.splice(i, 1); if (cover >= files.length) cover = 0; }
    else if (m) { const j = i + +m; if (j < 0 || j >= files.length) return; [files[i], files[j]] = [files[j], files[i]]; if (cover == i) cover = j; else if (cover == j) cover = i; }
    else cover = i; drawUp(); });
}
async function publish(e) {
  e.preventDefault(); if (!files.length) return toast("Добавьте хотя бы один арт");
  const tierId = +$("#tsel .on").dataset.t, tier = tiers.find(t => t.id == tierId), later = $("#when .on").dataset.w == "later";
  const publish_at = later ? new Date($("#dt").value).toISOString() : new Date().toISOString();
  $("#pb").disabled = true; $("#pg").classList.remove("hide"); const bar = $("#pg div"), st = $("#st");
  const pid = uuid(), rows = []; let coverPath = "";
  try {
    for (let i = 0; i < files.length; i++) {
      st.textContent = `Обработка ${i + 1} из ${files.length}…`; bar.style.width = `${(i / files.length) * 100}%`;
      const img = await loadImg(files[i]), iid = uuid();
      const orig = await toJpeg(img, 2560, 0.9), prev = tier.rank > 0 ? await toJpeg(img, 48, 0.7, 2) : await toJpeg(img, 480, 0.8);
      const op = `${pid}/${iid}.jpg`, pp = `thumbs/${pid}/${iid}.jpg`;
      let r = await sb.storage.from("originals").upload(op, orig.blob, { contentType: "image/jpeg" }); if (r.error) throw r.error;
      r = await sb.storage.from("previews").upload(pp, prev.blob, { contentType: "image/jpeg" }); if (r.error) throw r.error;
      if (i == cover) { const cv = await toJpeg(img, 1080, 0.85); coverPath = `covers/${pid}.jpg`; r = await sb.storage.from("previews").upload(coverPath, cv.blob, { contentType: "image/jpeg" }); if (r.error) throw r.error; }
      rows.push({ id: iid, post_id: pid, position: i + 1, preview_path: pp, original_path: op, width: orig.w, height: orig.h });
    }
    st.textContent = "Сохраняю публикацию…";
    let r = await sb.from("posts").insert({ id: pid, title: $("#ti").value.trim(), body: $("#bo").value.trim(), tier_id: tierId, cover_path: coverPath, publish_at, status: "draft" }); if (r.error) throw r.error;
    r = await sb.from("post_images").insert(rows); if (r.error) throw r.error;
    r = await sb.from("posts").update({ status: "published", cover_image_id: rows[cover].id }).eq("id", pid); if (r.error) throw r.error;
    bar.style.width = "100%"; toast(later ? "Запланировано" : "Опубликовано!"); location.hash = "#posts";
  } catch (err) { st.textContent = "Ошибка: " + (err.message || err); $("#pb").disabled = false; }
}
async function posts() {
  app.innerHTML = nav("posts") + `<div class="fm"><div class="empty">Загрузка…</div></div>`;
  const { data } = await sb.from("posts").select("id,title,tier_id,cover_path,publish_at,status,post_images(count)").order("publish_at", { ascending: false });
  const now = Date.now();
  $(".fm").innerHTML = `<div class="lst">${(data || []).map(p => `<div class="row"><img src="${pub(p.cover_path)}"><div class="x">${esc(p.title)}<small>${esc(tiers.find(t => t.id == p.tier_id)?.name)} · ${p.post_images[0]?.count || 0} арт. · ${new Date(p.publish_at) > now ? "⏰ " : ""}${new Date(p.publish_at).toLocaleString("ru-RU")}</small></div><a class="mini" data-del="${p.id}">🗑</a></div>`).join("") || '<div class="empty">Публикаций нет</div>'}</div>`;
  document.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (!confirm("Удалить публикацию и все её арты?")) return; const id = b.dataset.del;
    const { data: imgs } = await sb.from("post_images").select("preview_path,original_path").eq("post_id", id);
    await sb.storage.from("originals").remove(imgs.map(i => i.original_path)); await sb.storage.from("previews").remove([...imgs.map(i => i.preview_path), `covers/${id}.jpg`]);
    const { error } = await sb.from("posts").delete().eq("id", id); toast(error ? "Ошибка: " + error.message : "Удалено"); posts(); });
}
function codes() {
  app.innerHTML = nav("codes") + `<div class="fm">${tiers.filter(t => t.rank > 0).map(t => `<div class="tier" style="margin:14px 0"><div class="tb"><b>${esc(t.name)} · ${t.price_rub} ₽/мес</b><div class="note">Открывает все паки уровня «${esc(t.name)}» и ниже. Текущий код хранится только в виде хэша — посмотреть его нельзя, можно задать новый.</div>
  <label>Новый код (от 6 символов)</label><input class="in code" data-c="${t.id}" placeholder="MIA-NOV26"><button class="ob w" data-s="${t.id}">СОХРАНИТЬ</button><button class="ob w gb" data-r="${t.id}">🎲 Случайный код</button><div class="note">После смены старый код и все входы по нему сразу перестанут работать. Разошлите новый код подписчикам на Boosty.</div></div></div>`).join("")}</div>`;
  document.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; $(`[data-c="${b.dataset.r}"]`).value = "MIA-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), x => a[x % a.length]).join(""); });
  document.querySelectorAll("[data-s]").forEach(b => b.onclick = async () => { const v = $(`[data-c="${b.dataset.s}"]`).value.trim(); if (v.length < 6) return toast("Минимум 6 символов");
    const { error } = await sb.rpc("set_tier_code", { p_tier: +b.dataset.s, p_code: v }); toast(error ? "Ошибка: " + error.message : `Код сохранён: ${v.toUpperCase()}`); });
}
async function profile() {
  const { data } = await sb.from("settings").select("value").eq("key", "profile"); const p = data?.[0]?.value || {}, l = p.links || {};
  app.innerHTML = nav("profile") + `<form class="fm" id="prf"><label>Имя</label><input class="in" id="pn" value="${esc(p.name)}"><label>Подзаголовок</label><input class="in" id="pt" value="${esc(p.tagline)}"><label>Об авторе</label><textarea class="in" id="pa" rows="5">${esc(p.about)}</textarea>
  ${["boosty", "donut", "telegram", "vk"].map(k => `<label>${{ boosty: "Boosty", donut: "VK Donut", telegram: "Telegram", vk: "VK" }[k]}</label><input class="in" data-l="${k}" value="${esc(l[k])}" placeholder="https://">`).join("")}
  <label>Аватар</label><input class="in" type="file" id="av" accept="image/*"><label>Обложка</label><input class="in" type="file" id="cvf" accept="image/*"><button class="ob w" type="submit">СОХРАНИТЬ</button></form>`;
  $("#prf").onsubmit = async e => { e.preventDefault(); const v = { ...p, name: $("#pn").value, tagline: $("#pt").value, about: $("#pa").value, links: {} };
    document.querySelectorAll("[data-l]").forEach(i => v.links[i.dataset.l] = i.value.trim());
    for (const [id, key, max] of [["#av", "avatar", 400], ["#cvf", "cover", 1600]]) { const f = $(id).files[0]; if (!f) continue; const j = await toJpeg(await loadImg(f), max, 0.88); const path = `site/${key}-${Date.now()}.jpg`;
      const r = await sb.storage.from("previews").upload(path, j.blob, { contentType: "image/jpeg" }); if (r.error) return toast("Ошибка: " + r.error.message); v[key] = path; }
    const { error } = await sb.from("settings").upsert({ key: "profile", value: v }); toast(error ? "Ошибка: " + error.message : "Сохранено"); };
}
start();
})();
