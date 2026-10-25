(() => {
const M = () => window.Mia;
const TABS = [["posts", "🖼 Публикации"], ["tiers", "💕 Уровни"], ["pick", "🎁 1 пак на выбор"], ["comments", "💬 Комментарии"], ["users", "👥 Пользователи"], ["author", "👤 Профиль автора"], ["viewer", "🎬 Режим просмотра"], ["texts", "✏ Тексты сайта"], ["log", "📜 Журнал"]];
const shell = (tab, body) => `<div class="bar"><a class="logo" href="#/feed">MIA</a><div class="r"><b>Админка</b><a class="gb sm" href="#/feed">← На сайт</a><a class="gb sm" href="#/me/settings">Пароль</a></div></div><div class="adm"><div class="side">${TABS.map(([k, n]) => `<a href="#/admin/${k}" class="${k == tab ? "on" : ""}">${n}</a>`).join("")}</div><div class="main" id="main">${body}</div></div>`;
const uuid = () => crypto.randomUUID();
const ev = e => M().sb.rpc("admin_event", { e });
// Хранилище админки: Yandex Object Storage через подписанные ссылки функции yc_upload (только админ).
// ys(bucket).upload/remove/download — та же форма ответов, что у supabase.storage ({ data, error }), пути в БД не меняются.
// remove/download дополнительно трогают старый Supabase Storage (файлы, загруженные до переезда).
const ycSign = async (action, items) => { const { data, error } = await M().sb.functions.invoke("yc_upload", { body: { action, items } });
  if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} throw new Error(m); } return data.urls; };
const ys = bucket => ({
  async upload(path, blob, o = {}) { try { const ct = o.contentType || blob.type || "application/octet-stream"; const [u] = await ycSign("put", [{ bucket, path, contentType: ct }]);
      let r, k = 0; for (;;) { try { r = await fetch(u.url, { method: "PUT", headers: u.headers, body: blob }); if (r.ok || r.status < 500) break; } catch (e) { if (k >= 2) throw e; } if (++k > 2) break; await new Promise(z => setTimeout(z, 1500 * k)); }
      if (!r?.ok) throw new Error(`Яндекс: ${r?.status}`); return { data: { path }, error: null }; } catch (e) { return { data: null, error: e }; } },
  async remove(paths) { paths = (paths || []).filter(Boolean); if (!paths.length) return { error: null }; let error = null;
    try { for (let i = 0; i < paths.length; i += 50) { const us = await ycSign("delete", paths.slice(i, i + 50).map(path => ({ bucket, path }))); await Promise.all(us.map(u => fetch(u.url, { method: "DELETE" }))); } } catch (e) { error = e; console.warn("yc delete", e); }
    M().sb.storage.from(bucket).remove(paths).catch(() => {}); return { error }; },
  async download(path) { try { const [u] = await ycSign("get", [{ bucket, path }]); const r = await fetch(u.url, { cache: "no-store" }); if (r.ok) return { data: await r.blob(), error: null }; } catch (e) { console.warn("yc get", e); }
    return M().sb.storage.from(bucket).download(path); },
});

// ---------- видео: mp4 ≤ 300 МБ, multipart-загрузка в privat/originals/videos/…, постер-кадр с canvas ----------
const VMAX = 300 * 1024 * 1024, VBAD = "Мяу, такое видео не подходит 🐾 Нужен mp4 до 300 МБ";
const isMp4 = f => f && (f.type == "video/mp4" || (!f.type && /\.mp4$/i.test(f.name)));
const vLoad = f => new Promise((ok, no) => { const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = typeof f == "string" ? f : URL.createObjectURL(f);
  v.onloadeddata = () => ok(v); v.onerror = () => no(new Error("video")); });
const vSeek = (v, t) => new Promise(ok => { if (Math.abs(v.currentTime - t) < .01 && v.readyState >= 2) return ok(); v.onseeked = () => { v.onseeked = null; ok(); }; v.currentTime = t; });
// кадр видео → { img (Image для обложки/кадрирования), url, t }
async function vFrame(v, t) { await vSeek(v, Math.max(0, Math.min(t, (v.duration || 1) - .05))); const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
  const b = await new Promise(r => c.toBlob(r, "image/jpeg", .9)), url = URL.createObjectURL(b), img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; }); return { img, url, t }; }
async function addVideo(f) { const v = await vLoad(f), fr = await vFrame(v, Math.min(1, (v.duration || 2) * .1));
  return { f, video: true, src: v.src, url: fr.url, img: fr.img, t: fr.t, dur: v.duration || 0, w: v.videoWidth, h: v.videoHeight }; }
// multipart: части по 16 МБ, каждая с 3 повторами (сеть нестабильная); прогресс — onp(0..1)
async function uploadVideo(path, file, onp, bucket = "originals") {
  const call = async b => { const { data, error } = await M().sb.functions.invoke("yc_upload", { body: { bucket, path, ...b } }); if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} throw new Error(m); } return data; };
  const c = await call({ action: "mp_create", contentType: "video/mp4", size: file.size }); let done = 0;
  try {
    for (const pt of c.parts) { const a = (pt.n - 1) * c.partSize, chunk = file.slice(a, Math.min(file.size, a + c.partSize));
      for (let k = 0; ; k++) { try { await new Promise((ok, no) => { const x = new XMLHttpRequest(); x.open("PUT", pt.url); x.upload.onprogress = e => onp((done + e.loaded) / file.size); x.onload = () => x.status < 300 ? ok() : no(new Error("Яндекс: " + x.status)); x.onerror = () => no(new Error("сеть")); x.send(chunk); }); break; }
        catch (e) { if (k >= 3) throw e; await new Promise(z => setTimeout(z, 2000 * (k + 1))); } }
      done += chunk.size; onp(done / file.size); }
    await call({ action: "mp_complete", uploadId: c.uploadId });
  } catch (e) { call({ action: "mp_abort", uploadId: c.uploadId }).catch(() => {}); throw e; }
}
// строки с видео-колонками; если video.sql ещё не применён — без них (сайт узнаёт видео по .mp4)
async function insertRows(rows) { const { sb } = M(); let r = await sb.from("post_images").insert(rows);
  if (r.error && /(kind|duration_sec|poster_path|size_bytes).*(does not exist|schema cache)|Could not find/i.test(r.error.message)) r = await sb.from("post_images").insert(rows.map(({ kind, duration_sec, poster_path, size_bytes, teaser_path, ...x }) => x)); return r; }

let tiers = [];
async function loadTiers() { const { data } = await M().sb.from("tiers").select("id,rank,name,price_rub,perks,pay_url,boosty_url,code_version").order("rank"); tiers = data || []; }
const LOCKED_PREV = 700;
// «Пересоздать превью»: для закрытых паков заново делает превью из оригиналов (чёткие, ~700px).
// Новый путь файла (…-s700.jpg), чтобы CDN не отдавал старые размытые; старые файлы удаляются после замены.
async function regenPreviews(btn, all) {
  const { sb, toast } = M(); await loadTiers(); const rank = Object.fromEntries(tiers.map(t => [t.id, t.rank]));
  const lp = all.filter(p => rank[p.tier_id] > 0); if (!lp.length) return toast("Закрытых паков нет");
  if (!confirm(`Пересоздать превью для ${lp.length} закрытых паков?`)) return;
  btn.disabled = true; let done = 0, fail = 0; const vjobs = [];
  for (const p of lp) {
    const { data: ims, error } = await sb.from("post_images").select("id,preview_path,original_path").eq("post_id", p.id).order("position"); if (error) { fail++; continue; }
    for (const im of ims || []) {
      btn.textContent = `Превью ${++done}…`;
      try {
        const { data: blob, error: e1 } = await ys("originals").download(im.original_path); if (e1) throw e1;
        const img = await Crop.loadImg(blob), pr = await toJpeg(img, LOCKED_PREV, 0.85), np = `thumbs/${p.id}/${im.id}-s${LOCKED_PREV}.jpg`;
        const up = await ys("previews").upload(np, pr.blob, { contentType: "image/jpeg", upsert: true }); if (up.error) throw up.error;
        const u = await sb.from("post_images").update({ preview_path: np }).eq("id", im.id); if (u.error) throw u.error; vjobs.push([np, VW.thumb, pr.blob]);
        if (im.preview_path && im.preview_path != np) await ys("previews").remove([im.preview_path]);
      } catch (e) { fail++; console.warn("regen", im.id, e); }
    }
  }
  autoVariants(vjobs); btn.disabled = false; btn.textContent = "Пересоздать превью"; toast(fail ? `Готово, ошибок: ${fail}` : `Готово: ${done} превью`); await M().load();
}
// «WebP-версии»: для публичных картинок (обложки паков, шапка, аватар, превью в «Медиа») делает уменьшенные WebP
// в previews/v/<путь>-<ширина>-<метка>.webp (кэш на год) и пишет манифест в settings (key "imgv") — сайт берёт srcset из него.
// Без манифеста сайт грузит исходные файлы, как раньше. Оригиналы платных артов сюда не попадают.
const VW = { cover: [480, 960], hero: [800, 1600], ava: [192], thumb: [320] };
// один набор WebP из готового публичного превью (Blob): те же размеры/качество/пути, что у кнопки
async function webpSet(sb, path, ws, blob, stamp) {
  const img = await createImageBitmap(blob), out = [];
  for (const w of ws) { if (w > img.width * 1.05 && out.length) continue; const tw = Math.min(w, img.width), c = document.createElement("canvas"); c.width = tw; c.height = Math.round(img.height * tw / img.width);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); const b = await new Promise(r => c.toBlob(r, "image/webp", 0.8));
    if (!b || b.type != "image/webp") throw new Error("браузер не умеет WebP");
    const vp = `v/${path.replace(/\.[a-z0-9]+$/i, "")}-${w}-${stamp}.webp`, up = await ys("previews").upload(vp, b, { cacheControl: "31536000", contentType: "image/webp", upsert: true }); if (up.error) throw up.error; out.push(w); }
  if (!out.length) throw new Error("нет размеров"); return out;
}
// манифест settings.imgv: прочитать → дописать → сохранить (не затирая чужие записи); все записи идут по очереди
let vChain = Promise.resolve();
const imgvMerge = add => { const run = async () => { const { sb } = M(); const { data, error } = await sb.from("settings").select("value").eq("key", "imgv"); if (error) throw error;
  const old = data?.[0]?.value || {}, man = { ...old, paths: { ...(old.paths || {}), ...add } }; const u = await sb.from("settings").upsert({ key: "imgv", value: man }); if (u.error) throw u.error; return man; };
  const p = vChain.then(run, run); vChain = p.catch(() => {}); return p; };
// авто-WebP при загрузке в админке: best-effort, загрузку не ломает. items: [[путь публичного файла, размеры, Blob]]
function autoVariants(items) {
  items = items.filter(x => x && x[0] && x[2]); if (!items.length) return Promise.resolve();
  const { sb, toast } = M(), stamp = Date.now().toString(36), add = {}; let fail = 0;
  return (async () => {
    for (const [path, ws, blob] of items) { try { add[path] = { w: await webpSet(sb, path, ws, blob, stamp), s: stamp }; } catch (e) { console.error("webp", path, e); fail++; } }
    if (Object.keys(add).length) { try { await imgvMerge(add); M().load().catch(() => {}); } catch (e) { console.error("imgv", e); fail = items.length; } }
    if (fail) toast(`Мяу, WebP-версии не получились (${fail}) 🐾 Картинка загружена, сайт покажет обычную. Можно повторить кнопкой «WebP-версии»`);
  })().catch(e => { console.error(e); toast("Мяу, WebP-версии не получились 🐾 Картинка загружена — можно повторить кнопкой «WebP-версии»"); });
}
// «Перенести в Яндекс»: зовёт функцию yc_migrate пачками по 20, пока remaining не станет 0. Повторный запуск пропускает готовое.
async function ycMigrate(btn) {
  const { sb, toast } = M(); if (!confirm("Мур, перенести оригиналы (и музыку вступления) в Яндекс? Уже перенесённые пропущу 🐾")) return;
  const t0 = btn.textContent; btn.disabled = true; let from = 0, c = 0, s = 0, f = [], total = "…";
  try {
    for (;;) {
      btn.textContent = `Мур, переношу… ${from}/${total} 🐾`;
      const { data, error } = await sb.functions.invoke("yc_migrate", { body: { from, size: 20, media: true } });
      if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} throw new Error(m); }
      c += data.copied; s += data.skipped; f = f.concat(data.failed); total = data.total; from = data.next;
      if (!data.remaining) break;
    }
    toast(f.length ? `Мяу, перенесла ${c}, уже были ${s}, не вышло ${f.length} 🐾 Нажми ещё раз — повторю` : `Готово, мур! Перенесла ${c}, уже были ${s} 💕`);
    if (f.length) console.warn("yc_migrate failed", f);
  } catch (e) { toast(`Мяу, перенос остановился: ${e.message} 🐾`); }
  finally { btn.disabled = false; btn.textContent = t0; }
}
async function makeVariants(btn) {
  const { sb, toast, S, pub } = M(); btn.disabled = true; const t0 = btn.textContent; let done = 0, fail = 0, skip = 0;
  try {
    const [{ data: ps }, { data: ims }, { data: st }] = await Promise.all([sb.from("posts").select("cover_path"), sb.from("post_images").select("preview_path"), sb.from("settings").select("value").eq("key", "profile")]);
    const prof = st?.[0]?.value || {}, jobs = new Map();
    (ps || []).forEach(p => p.cover_path && jobs.set(p.cover_path, VW.cover)); (ims || []).forEach(i => i.preview_path && jobs.set(i.preview_path, VW.thumb));
    if (prof.cover) jobs.set(prof.cover, VW.hero); if (prof.avatar) jobs.set(prof.avatar, VW.ava);
    const { data: ov } = await sb.from("settings").select("value").eq("key", "imgv"), old = ov?.[0]?.value || {};
    const man = { paths: { ...(old.paths || {}) } }, stamp = Date.now().toString(36), added = {};
    if (!confirm(`Сделать WebP-версии для ${jobs.size} картинок? Уже готовые (${Object.keys(man.paths).length}) будут пропущены.`)) { btn.disabled = false; return; }
    for (const [path, ws] of jobs) {
      if (man.paths[path]) { skip++; continue; }
      btn.textContent = `WebP ${done + skip + fail + 1}/${jobs.size}…`;
      try {
        const blob = await fetch(pub(path)).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); });
        added[path] = { w: await webpSet(sb, path, ws, blob, stamp), s: stamp }; done++;
      } catch (e) { console.error(path, e); fail++; }
    }
    if (Object.keys(added).length) await imgvMerge(added); ev(`WebP-версии: +${done}, ошибок ${fail}`); toast(fail ? `Готово: ${done}, пропущено ${skip}, ошибок ${fail}` : `Готово: ${done} новых, ${skip} уже были 🐾`); await M().load();
  } catch (e) { toast("Ошибка: " + (e.message || e)); }
  btn.disabled = false; btn.textContent = t0;
}
function toJpeg(img, max, q, blur = 0) { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  const x = c.getContext("2d"); if (blur) x.filter = `blur(${blur}px)`; x.drawImage(img, 0, 0, c.width, c.height); return new Promise(r => c.toBlob(b => r({ blob: b, w: c.width, h: c.height }), "image/jpeg", q)); }
const autoThumb = c => { // square from the middle of the cover crop (in fractions, relative to image)
  return null; };

// ---------- posts ----------
async function posts(app, filter = "all") {
  const { sb, esc, pub, fmt } = M(); await loadTiers();
  let { data, error } = await sb.from("posts").select("id,title,body,tier_id,cover_path,publish_at,status,hidden,kind,cover_image_id").order("publish_at", { ascending: false });
  if (!error) { const { data: ims } = await sb.from("post_images").select("post_id"); const n = {}; (ims || []).forEach(i => n[i.post_id] = (n[i.post_id] || 0) + 1); data.forEach(p => p.post_images = [{ count: n[p.id] || 0 }]); }
  if (error) { app.innerHTML = shell("posts", `<div class="note">Ошибка загрузки списка: ${esc(error.message)} <a class="ob sm" href="#/admin/posts">Повторить</a></div>`); return; }
  const { data: fp } = await sb.from("feed_public").select("id,like_count,comment_count"); const st = Object.fromEntries((fp || []).map(x => [x.id, x]));
  const now = Date.now(), all = data || [];
  const kind = p => p.status == "draft" ? "draft" : new Date(p.publish_at) > now ? "sched" : "pub";
  const list = all.filter(p => filter == "all" || kind(p) == filter);
  const blurOn = !!M().S.profile?.feed_blur;
  app.innerHTML = shell("posts", `<div class="r" style="justify-content:space-between;flex-wrap:wrap"><h2>Публикации</h2><span class="r" style="flex-wrap:wrap!important;gap:6px"><button class="gb" id="ycm" title="Перенести оригиналы и музыку вступления в Yandex Object Storage (можно жать повторно — готовое пропускается)">Перенести в Яндекс</button><button class="gb" id="mkv" title="Уменьшенные WebP-версии обложек и превью — сайт грузится быстрее">WebP-версии</button><button class="gb" id="rgp" title="Один раз: сделать чёткие превью ~700px для всех закрытых паков из оригиналов">Пересоздать превью</button> <a class="gb" href="#/admin/newvideo">🎬 Видео-пост</a> <a class="ob" href="#/admin/new">+ Новая публикация</a></span></div>
  <div class="card" style="margin:0 0 12px;padding:10px 14px"><div class="rowsw" style="border:0;padding:0"><div><b style="font-size:14px">Блюр на главной ленте</b><div class="mu small">Обложки закрытых паков в ленте. Медиа и просмотр не меняются.</div></div><button type="button" class="sw ${blurOn ? "on" : ""}" id="fbl" aria-label="Включить блюр"></button></div></div>
  <div class="r" style="margin-bottom:10px;flex-wrap:wrap">${[["all", "Все", all.length], ["pub", "Опубликованы"], ["sched", "Запланированы"], ["draft", "Черновики"]].map(([k, n]) => `<a class="pill ${k == filter ? "on" : ""}" href="#/admin/posts/${k}">${n} ${k == "all" ? all.length : all.filter(p => kind(p) == k).length}</a>`).join("")}</div>
  <div class="tw"><table><tr><th></th><th>Заголовок</th><th>Уровень</th><th>Арты</th><th>Статус</th><th>❤ / 💬</th><th></th></tr>${list.map(p => `<tr><td><img class="th" src="${pub(p.cover_path)}" style="width:44px;height:44px"></td><td>${esc(p.title)}</td><td><span class="tier ${p.tier_id ? "" : "f"}">${esc(tiers.find(t => t.id == p.tier_id)?.name)}</span></td><td>${p.post_images[0]?.count || 0}</td>
  <td>${p.hidden ? "🙈 Скрыт" : kind(p) == "draft" ? "Черновик" : kind(p) == "sched" ? "⏰ " + fmt(p.publish_at) : "Опубликован " + new Date(p.publish_at).toLocaleDateString("ru-RU")}</td><td>${st[p.id] ? st[p.id].like_count + " / " + st[p.id].comment_count : "—"}</td>
  <td style="white-space:nowrap"><a class="gb sm" data-ed="${p.id}">✏</a> <a class="gb sm" data-hide="${p.id}" title="${p.hidden ? "Показать" : "Скрыть"}">${p.hidden ? "👁" : "🙈"}</a> <a class="gb sm" data-del="${p.id}">🗑</a></td></tr>`).join("") || `<tr><td colspan="7" class="mu">Публикаций нет</td></tr>`}</table></div>`);
  app.querySelector("#rgp").onclick = e => regenPreviews(e.target, all);
  app.querySelector("#fbl").onclick = async () => { const on = !M().S.profile?.feed_blur, nv = { ...(M().S.profile || {}), feed_blur: on };
    const { error } = await sb.from("settings").upsert({ key: "profile", value: nv }); if (error) return M().toast("Ошибка: " + error.message);
    M().S.profile = nv; document.documentElement.classList.toggle("fbl", on); M().toast(on ? "Блюр на ленте включён" : "Блюр на ленте выключен"); posts(app, filter); };
  app.querySelector("#mkv").onclick = e => makeVariants(e.target);
  app.querySelector("#ycm").onclick = e => ycMigrate(e.target);
  app.querySelectorAll("[data-hide]").forEach(b => b.onclick = async () => { const p = all.find(x => x.id == b.dataset.hide); await sb.from("posts").update({ hidden: !p.hidden }).eq("id", p.id); await M().load(); posts(app, filter); });
  app.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (!confirm("Удалить публикацию и все её арты? Это нельзя отменить.")) return; const id = b.dataset.del, p = all.find(x => x.id == id);
    const { data: imgs } = await sb.from("post_images").select("preview_path,original_path").eq("post_id", id);
    const shared = all.some(o => o.id != id && o.cover_path == p.cover_path), own = (imgs || []).filter(Boolean);
    if (own.length) { await ys("originals").remove(own.map(i => i.original_path)); await ys("previews").remove(own.map(i => i.preview_path)); }
    { const { data: tz } = await sb.from("post_images").select("teaser_path").eq("post_id", id), { data: fv } = await sb.from("posts").select("feed_video_path").eq("id", id).maybeSingle();
      await ys("previews").remove([...(tz || []).map(x => x.teaser_path), fv?.feed_video_path]); } // тизеры и публичная копия видео (до teasers.sql — пусто)
    if (p.cover_path && !shared && p.cover_path.startsWith("covers/" + id)) await ys("previews").remove([p.cover_path]);
    const { error } = await sb.from("posts").delete().eq("id", id); M().toast(error ? "Ошибка: " + error.message : "Удалено"); if (!error) ev("Удалена публикация «" + p.title + "»"); await M().load(); posts(app, filter); });
  app.querySelectorAll("[data-ed]").forEach(b => b.onclick = () => editPost(all.find(x => x.id == b.dataset.ed), () => posts(app, filter)));
}
// «🎬 Сделать тизер» для уже загруженных видео: тизер 4 с из оригинала (+ для открытого видео-поста — сжатая публичная копия для ленты)
// один арт/видео в существующий пост — как в publish(): видео сжимается (WebCodecs), тизер, постер; арт — оригинал 2560 + превью
async function uploadItem(pid, F, rank, position, onst) {
  const iid = uuid(), img = F.img || await Crop.loadImg(F.f);
  if (F.video) { const VC = await import("./vcomp.js?v=37").catch(() => null), vp = `videos/${pid}/${iid}.mp4`, pp = `posters/${pid}/${iid}.jpg`;
    const prev = await toJpeg(img, rank > 0 ? LOCKED_PREV : 720, .85); let r = await ys("previews").upload(pp, prev.blob, { contentType: "image/jpeg", upsert: true }); if (r.error) throw r.error;
    let up = F.f, tp = null;
    if (VC?.supported()) { try { up = (await VC.compress(F.f, x => onst(`сжимаю ${Math.round(x * 100)}%`))).blob; } catch (e) { console.warn(e); }
      try { onst("тизер…"); tp = `teasers/${pid}/${iid}.mp4`; const r2 = await ys("previews").upload(tp, await VC.teaser(F.f, F.t || 0), { contentType: "video/mp4", upsert: true }); if (r2.error) tp = null; } catch { tp = null; } }
    await uploadVideo(vp, up, x => onst(`видео ${Math.round(x * 100)}%`)); autoVariants([[pp, VW.thumb, prev.blob]]);
    return { id: iid, post_id: pid, position, preview_path: pp, original_path: vp, width: F.w, height: F.h, kind: "video", duration_sec: Math.round(F.dur * 10) / 10, poster_path: pp, size_bytes: up.size, teaser_path: tp }; }
  onst("арт…"); const orig = await toJpeg(img, 2560, 0.92), prev = await toJpeg(img, rank > 0 ? LOCKED_PREV : 480, rank > 0 ? 0.85 : 0.8), op = `${pid}/${iid}.jpg`, pp = `thumbs/${pid}/${iid}.jpg`;
  for (const [b, path, blob] of [["originals", op, orig.blob], ["previews", pp, prev.blob]]) { let r, k = 0; do { r = await ys(b).upload(path, blob, { cacheControl: "31536000", contentType: "image/jpeg", upsert: true }); } while (r.error && ++k < 3); if (r.error) throw r.error; }
  autoVariants([[pp, VW.thumb, prev.blob]]);
  return { id: iid, post_id: pid, position, preview_path: pp, original_path: op, width: orig.w, height: orig.h, kind: "image", duration_sec: null, poster_path: null, size_bytes: null, teaser_path: null };
}
async function makeTeasers(p, imgs, btn, out) {
  const { sb, toast } = M(), VC = await import("./vcomp.js?v=37").catch(() => null);
  if (!VC?.supported()) return out.textContent = "Этот браузер не умеет WebCodecs — откройте админку в Chrome/Edge/Safari 16.4+";
  btn.disabled = true; const open = (tiers.find(t => t.id == p.tier_id)?.rank || 0) == 0;
  try {
    for (const im of imgs.filter(x => /^videos\//.test(x.original_path))) {
      out.textContent = "Скачиваю оригинал…"; const { data: f, error } = await ys("originals").download(im.original_path); if (error || !f) throw new Error("не удалось скачать оригинал");
      out.textContent = "Делаю тизер…"; const tp = `teasers/${p.id}/${im.id}.mp4`, r = await ys("previews").upload(tp, await VC.teaser(f, 1), { contentType: "video/mp4", upsert: true }); if (r.error) throw r.error;
      await sb.from("post_images").update({ teaser_path: tp }).eq("id", im.id);
      const isCover = p.kind == "video" || p.cover_image_id == im.id;
      let fp = null;
      if (open && p.kind == "video") { fp = `feedvid/${p.id}/${im.id}.mp4`; const c = await VC.compress(f, x => out.textContent = `Сжимаю для ленты ${Math.round(x * 100)}%`);
        await uploadVideo(fp, c.blob, x => out.textContent = `Видео для ленты · ${Math.round(x * 100)}%`, "previews"); }
      if (isCover || fp) await sb.from("posts").update({ ...(isCover ? { cover_teaser_path: tp } : {}), ...(fp ? { feed_video_path: fp } : {}) }).eq("id", p.id);
    }
    out.textContent = "Готово 🐾"; toast("Тизер готов"); await M().load();
  } catch (e) { out.textContent = "Ошибка: " + (e.message || e); } finally { btn.disabled = false; }
}
async function editPost(p, done) {
  const { sb, esc, pub, toast } = M();
  let { data: imgs, error: ie } = await sb.from("post_images").select("id,position,preview_path,original_path,is_free,kind,teaser_path,poster_path").eq("post_id", p.id).order("position");
  if (ie) ({ data: imgs } = await sb.from("post_images").select("id,position,preview_path,original_path,is_free").eq("post_id", p.id).order("position")); imgs = imgs || [];
  const d = document.createElement("div"); d.className = "ov"; d.innerHTML = `<div class="sheet wide-sheet"><a class="x">✕</a><h2>Редактировать</h2>
  <label>Заголовок</label><input type="text" id="et" value="${esc(p.title)}"><label>Текст</label><textarea id="eb" rows="3">${esc(p.body || "")}</textarea>
  <label>Уровень</label><select id="etr">${tiers.map(t => `<option value="${t.id}" ${t.id == p.tier_id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
  <label>Порядок (↑↓) · ★ — сделать обложкой · ✕ — удалить · ＋ — добавить арты или видео · «Бесплатно 🐾» — арт виден всем как пробник</label><div class="ups" id="eu"></div><input type="file" id="eaf" accept="image/*,video/mp4" multiple class="hide"><div class="mu small" id="eus"></div>${imgs.some(im => /^videos\//.test(im.original_path)) ? `<button class="gb sm" id="etz" style="margin-top:8px">🎬 Сделать тизер</button><div class="mu small" id="etzs"></div>` : ""}<div class="row-btn"><button class="gb" data-x>Отмена</button><button class="ob" id="es">Сохранить</button></div><div class="err" id="ee"></div></div>`;
  document.body.append(d); let order = imgs.slice(); const del = []; // del — удаляются при «Сохранить»; новые (im.f) загружаются при «Сохранить»
  const isV = im => im.video || im.kind == "video" || /^videos\//.test(im.original_path || "");
  const draw = () => d.querySelector("#eu").innerHTML = order.map((im, i) => `<div style="background-image:url('${im.f ? im.url : pub(im.preview_path)}')"><span class="o">${i + 1}</span>${isV(im) || im.f ? `<span class="o" style="top:auto;bottom:24px">${isV(im) ? "▶ видео" : ""}${isV(im) && im.f ? " · " : ""}${im.f ? "новый" : ""}</span>` : ""}${im.id && im.id == p.cover_image_id ? `<span class="cvb">обложка</span>` : `<b class="fr${im.is_free ? 1 : 0}" data-fr="${i}">${im.is_free ? "✓ 🐾 Бесплатно" : "Бесплатно?"}</b>`}<span class="ctl"><b data-m="-1" data-i="${i}">↑</b>${im.f ? "" : `<b data-cv="${i}">★</b>`}<b data-rm="${i}">✕</b><b data-m="1" data-i="${i}">↓</b></span></div>`).join("") + `<div class="add" id="eadd">＋</div>`;
  draw();
  if (d.querySelector("#etz")) d.querySelector("#etz").onclick = e => makeTeasers(p, imgs, e.target, d.querySelector("#etzs"));
  const free0 = new Map(imgs.map(im => [im.id, !!im.is_free]));
  d.querySelector("#eaf").onchange = async e => { const st = d.querySelector("#eus");
    for (const f of e.target.files) { if (isMp4(f)) { if (f.size > VMAX) { st.textContent = VBAD; continue; } try { order.push(await addVideo(f)); } catch { st.textContent = VBAD; } }
      else if (/^image\//.test(f.type)) order.push({ f, url: URL.createObjectURL(f) }); else st.textContent = VBAD; }
    e.target.value = ""; draw(); };
  d.querySelector("#eu").onclick = async e => { const t = e.target;
    if (t.id == "eadd") return d.querySelector("#eaf").click();
    if (t.dataset.rm) { const i = +t.dataset.rm, im = order[i], ee = d.querySelector("#ee"); ee.textContent = "";
      if (im.id && im.id == p.cover_image_id) return ee.textContent = "Мяу, это обложка 🐾 Сначала сделайте обложкой другой арт (★), потом удаляйте";
      if (order.length < 2) return ee.textContent = "В публикации должен остаться хотя бы один арт 🐾";
      if (!im.f && !confirm(`Удалить ${isV(im) ? "видео" : "арт"} №${i + 1}? Файлы удалятся из хранилища после «Сохранить». Это нельзя отменить.`)) return;
      order.splice(i, 1); if (!im.f) del.push(im); draw(); return; }
    if (t.dataset.fr) { const im = order[+t.dataset.fr]; im.is_free = !im.is_free; draw(); return; }
    if (t.dataset.m) { const i = +t.dataset.i, j = i + +t.dataset.m; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; draw(); }
    if (t.dataset.cv) { const im = order[+t.dataset.cv]; d.querySelector("#ee").textContent = "Загружаю оригинал…";
      const { data: blob, error } = await ys("originals").download(im.original_path); if (error) return d.querySelector("#ee").textContent = error.message;
      if (isV(im)) { d.querySelector("#ee").textContent = ""; // обложка-видео: квадратная рамка + живое превью, обложка = кадр, тизер = 4 с из выбранного места и кадрирования
        const VC = await import("./vcomp.js?v=37").catch(() => null); if (!VC?.supported()) return d.querySelector("#ee").textContent = "Нужен браузер с WebCodecs";
        const r = await videoCrop(blob, { title: "Обложка-видео для ленты · 1:1 · тизер 4 с", aspect: 1, dur: 4, outW: 1080, outH: 1080, ok: "Сделать обложкой", previews: [{ w: 180, h: 180, label: "Карточка в ленте" }, { w: 64, h: 64, label: "Список в админке" }] });
        if (!r) return; const ts = Date.now(), path = `covers/${p.id}-${ts}.jpg`, tzp = `teasers/${p.id}/cover-${ts}.mp4`;
        const up = await ys("previews").upload(path, r.frame, { cacheControl: "31536000", contentType: "image/jpeg" }); if (up.error) return toast(up.error.message);
        const tzb = await VC.clip(blob, r.start, 4, 720, 720, 6e5, r.crop), u2 = await ys("previews").upload(tzp, tzb, { contentType: "video/mp4" }); if (u2.error) return toast(u2.error.message);
        await sb.from("posts").update({ cover_path: path, cover_image_id: im.id, cover_teaser_path: tzp }).eq("id", p.id); p.cover_image_id = im.id; draw();
        if (p.cover_path && p.cover_path.startsWith("covers/" + p.id)) ys("previews").remove([p.cover_path]); p.cover_path = path; toast("Обложка-видео обновлена"); autoVariants([[path, VW.cover, r.frame]]); return; }
      const img = await Crop.loadImg(blob); d.querySelector("#ee").textContent = "";
      const r = await Crop.open(img, { title: "Обложка для ленты · 1:1", aspect: 1, outW: 1080, outH: 1080, previews: [{ w: 180, h: 180, label: "Карточка в ленте" }, { w: 64, h: 64, label: "Список в админке" }] });
      if (!r) return; const path = `covers/${p.id}-${Date.now()}.jpg`; const up = await ys("previews").upload(path, r.blob, { cacheControl: "31536000", contentType: "image/jpeg" }); if (up.error) return toast(up.error.message);
      const th = await squareThumb(img, r.crop); const tp = `thumbs/${p.id}/cover-${Date.now()}.jpg`; await ys("previews").upload(tp, th, { cacheControl: "31536000", contentType: "image/jpeg" });
      await sb.from("posts").update({ cover_path: path, cover_image_id: im.id, cover_crop: { image_id: im.id, ...r.crop }, thumb_path: tp }).eq("id", p.id); if (p.cover_path && p.cover_path.startsWith("covers/" + p.id)) ys("previews").remove([p.cover_path]); p.cover_path = path; toast("Обложка обновлена"); autoVariants([[path, VW.cover, r.blob]]); } };
  const close = () => d.remove(); d.querySelector(".x").onclick = d.querySelector("[data-x]").onclick = close;
  d.querySelector("#es").onclick = async () => {
    const ntier = +d.querySelector("#etr").value;
    const { error } = await sb.from("posts").update({ title: d.querySelector("#et").value.trim(), body: d.querySelector("#eb").value.trim(), tier_id: ntier }).eq("id", p.id);
    // пост стал закрытым → публичная копия полного видео (feedvid/) удаляется, в ленте остаётся только тизер
    if (!error && (tiers.find(t => t.id == ntier)?.rank || 0) > 0) { const { data: fv } = await sb.from("posts").select("feed_video_path").eq("id", p.id).maybeSingle();
      if (fv?.feed_video_path) { await ys("previews").remove([fv.feed_video_path]); await sb.from("posts").update({ feed_video_path: null }).eq("id", p.id); } }
    if (error) return d.querySelector("#ee").textContent = error.message;
    const est = d.querySelector("#eus"), bt = d.querySelector("#es"); bt.disabled = true;
    try {
      // 1) новые арты/видео — тот же путь, что в мастере (сжатие, тизер, постер, превью); позиции после существующих, потом общий пересчёт
      const rank = tiers.find(t => t.id == ntier)?.rank || 0, nw = order.filter(x => x.f);
      for (let k = 0; k < nw.length; k++) { const row = await uploadItem(p.id, nw[k], rank, 2000 + k, s => est.textContent = `Новый ${k + 1} из ${nw.length}: ${s}`);
        const r = await insertRows([row]); if (r.error) throw r.error; Object.assign(nw[k], { id: row.id, f: null, preview_path: row.preview_path, original_path: row.original_path, kind: row.kind }); }
      // 2) удаление: сначала строка (сайт перестаёт ссылаться), потом файлы в privat / mia-previews (превью, постер, тизер, публичная копия)
      if (del.length) { est.textContent = "Удаляю…"; const { data: fv } = await sb.from("posts").select("feed_video_path").eq("id", p.id).maybeSingle();
        for (const im of del) { const r = await sb.from("post_images").delete().eq("id", im.id); if (r.error) throw r.error;
          await ys("originals").remove([im.original_path]);
          const fp = fv?.feed_video_path && fv.feed_video_path.includes(im.id) ? fv.feed_video_path : null;
          await ys("previews").remove([im.preview_path, im.poster_path, im.teaser_path, fp, ...((e => e?.w ? e.w.map(w => `v/${im.preview_path.replace(/\.[a-z0-9]+$/i, "")}-${w}-${e.s}.webp`) : [])(M().S.imgv?.[im.preview_path]))].filter((x, j, a) => x && a.indexOf(x) == j));
          if (fp) await sb.from("posts").update({ feed_video_path: null }).eq("id", p.id); } }
      est.textContent = "";
    } catch (e2) { bt.disabled = false; return d.querySelector("#ee").textContent = "Мяу, не получилось: " + (e2.message || e2); }
    for (let i = 0; i < order.length; i++) await sb.from("post_images").update({ position: 1000 + i }).eq("id", order[i].id);
    for (let i = 0; i < order.length; i++) await sb.from("post_images").update({ position: i + 1 }).eq("id", order[i].id);
    for (const im of order) if (!!im.is_free != free0.get(im.id)) { const u = await sb.from("post_images").update({ is_free: !!im.is_free }).eq("id", im.id); if (u.error) return d.querySelector("#ee").textContent = "Мяу, не сохранилось «Бесплатно»: " + u.error.message; }
    toast("Сохранено"); close(); await M().load(); done(); };
}
async function squareThumb(img, c, crop2) {
  let q = crop2;
  if (!q) { const pw = c.w * img.width, ph = c.h * img.height, s = Math.min(pw, ph); q = { x: (c.x * img.width + (pw - s) / 2) / img.width, y: (c.y * img.height + (ph - s) / 2) / img.height, w: s / img.width, h: s / img.height }; }
  const cv = document.createElement("canvas"); cv.width = cv.height = 600; cv.getContext("2d").drawImage(img, q.x * img.width, q.y * img.height, q.w * img.width, q.h * img.height, 0, 0, 600, 600);
  return new Promise(r => cv.toBlob(r, "image/jpeg", 0.85));
}

// ---------- new post wizard ----------
let W = null;
async function newPost(app, mode = "pack") {
  await loadTiers(); const { esc, toast } = M();
  if (W && (W.mode || "pack") != mode) W = null;
  if (!W) W = { mode, step: 1, files: [], cover: 0, title: "", body: "", tier: tiers[tiers.length - 1]?.id ?? 0, crop: null, thumbMode: "auto", thumbCrop: null, when: "now", at: "" };
  const steps = [W.mode == "video" ? "① Видео" : "① Арты", "② Текст и уровень", "③ Превью", "④ Публикация"];
  let body = `<h2>${W.mode == "video" ? "🎬 Видео-пост" : "Новая публикация"}</h2><div class="wiz">${steps.map((s, i) => `<div class="${W.step == i + 1 ? "on" : ""}">${s}</div>`).join("")}</div>`;
  const VP = W.mode == "video";
  if (W.step == 1) body += (VP ? `<p class="mu">🎬 Видео-пост: выберите одно видео mp4 до 300 МБ. Кадр для обложки можно выбрать ниже.</p>` : `<p class="mu">Выберите сразу много артов или видео (mp4 до 300 МБ). ↑↓ — порядок, ★ — сделать обложкой. Оригиналы загрузятся как есть (до 2560px).</p>`)
    + `<div class="ups" id="ups"></div><input type="file" id="fi" accept="${VP ? "video/mp4" : "image/*,video/mp4"}" ${VP ? "" : "multiple"} class="hide"><div id="vfr"></div>`;
  if (W.step == 2) body += `<div class="card" style="max-width:640px"><label>Заголовок</label><input type="text" id="ti" maxlength="200" value="${esc(W.title)}" placeholder="Пак 12 артов Мию 💕"><label>Текст</label><textarea id="bo" rows="4">${esc(W.body)}</textarea>
    <label>Уровень доступа</label><select id="tr">${tiers.map(t => `<option value="${t.id}" ${t.id == W.tier ? "selected" : ""}>${esc(t.name)}${t.price_rub ? " · " + t.price_rub + " ₽" : " · открыто всем"}</option>`).join("")}</select></div>`;
  if (W.step == 3) body += `<div class="two"><div><b>Обложка для ленты · 1:1</b><div id="cr1" style="margin-top:8px"></div><b style="display:block;margin-top:12px">Арты пака (${W.files.length}) — выберите обложку</b><div class="ups" id="ups3"></div><button class="gb sm" id="mkcov" style="margin-top:8px">★ Сделать обложкой выбранный</button></div>
    <div><b>Так увидят в ленте</b> <span class="pill on" data-pv="guest">Гость</span> <span class="pill" data-pv="sub">Подписчик</span><div class="pvcard" style="margin-top:8px" id="pvc"></div>
    <b style="display:block;margin-top:16px">Миниатюра «Медиа» · 1:1</b><div class="r" style="margin-top:6px"><label style="margin:0;color:var(--fg)"><input type="radio" name="tm" value="auto" ${W.thumbMode == "auto" ? "checked" : ""}> Авто из обложки</label><label style="margin:0;color:var(--fg)"><input type="radio" name="tm" value="own" ${W.thumbMode == "own" ? "checked" : ""}> Настроить отдельно</label></div>
    <div id="cr2" class="${W.thumbMode == "own" ? "" : "hide"}" style="max-width:320px;margin-top:8px"></div><canvas id="thc" style="width:120px;height:120px;border-radius:8px;margin-top:8px;display:block"></canvas></div></div>`;
  if (W.step == 4) { const local = new Date(Date.now() + 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    body += `<div class="card" style="max-width:640px"><b>${esc(W.title)}</b> · ${W.files.length} артов · ${esc(tiers.find(t => t.id == W.tier)?.name)}<label>Когда</label>
    <div class="r">${[["now", "Сейчас"], ["later", "По расписанию"], ["draft", "Черновик"]].map(([k, n]) => `<span class="pill ${W.when == k ? "on" : ""}" data-w="${k}">${n}</span>`).join("")}</div><input type="datetime-local" id="dt" class="${W.when == "later" ? "" : "hide"}" value="${W.at || local}" style="margin-top:8px">
    <div style="margin-top:8px;height:8px;background:var(--bg);border-radius:4px;overflow:hidden"><div id="pg" style="height:100%;width:0;background:var(--ac)"></div></div><div class="mu" id="st" style="margin-top:6px"></div></div>`; }
  body += `<div class="row-btn" style="justify-content:flex-start">${W.step > 1 ? `<button class="gb" id="back">← Назад</button>` : ""}${W.step < 4 ? `<button class="ob" id="next">Далее →</button>` : `<button class="ob" id="pub">${W.when == "draft" ? "Сохранить черновик" : W.when == "later" ? "Запланировать" : "Опубликовать"}</button>`}<button class="gb" id="reset">Сбросить</button></div><div class="err" id="we"></div>`;
  app.innerHTML = shell("posts", body);
  const $ = s => app.querySelector(s), rer = () => newPost(app);
  const save = () => { if ($("#ti")) { W.title = $("#ti").value; W.body = $("#bo").value; W.tier = +$("#tr").value; } if ($("#dt")) W.at = $("#dt").value; if (W.c1) W.crop = W.c1.getCrop(); if (W.c2 && W.thumbMode == "own") W.thumbCrop = W.c2.getCrop(); };
  $("#back") && ($("#back").onclick = () => { save(); W.step--; rer(); });
  $("#reset").onclick = () => { if (confirm("Начать заново?")) { W = null; rer(); } };
  $("#next") && ($("#next").onclick = () => { save(); const e = $("#we");
    if (W.step == 1 && !W.files.length) return e.textContent = VP ? "Добавьте видео" : "Добавьте хотя бы один арт"; if (W.step == 1 && W.busy) return e.textContent = "Мур, видео ещё читается…"; if (W.step == 2 && !W.title.trim()) return e.textContent = "Введите заголовок"; W.step++; rer(); });
  if (W.step == 1) {
    const fmtD = t => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;
    // выбор кадра-постера: обычная карточка админки, видео + ползунок + «Взять этот кадр»
    const frame = () => { const i = W.files.findIndex(f => f.video), box = $("#vfr"); if (i < 0) return box.innerHTML = ""; const f = W.files[i];
      box.innerHTML = `<div class="card" style="max-width:640px;margin-top:12px"><b>Кадр-обложка для видео ${i + 1}</b><video id="vfv" src="${f.src}" muted playsinline preload="auto" style="display:block;width:100%;max-height:360px;margin-top:8px;border-radius:8px;background:#000"></video>
        <input type="range" id="vft" min="0" max="${f.dur}" step="0.05" value="${f.t}" style="width:100%;margin-top:8px"><div class="r" style="justify-content:space-between"><span class="mu small" id="vfl">${fmtD(f.t)} / ${fmtD(f.dur)}</span><button class="gb sm" id="vfo">📸 Взять этот кадр</button></div></div>`;
      const v = $("#vfv"); v.onloadeddata = () => vSeek(v, f.t); $("#vft").oninput = e => { v.currentTime = +e.target.value; $("#vfl").textContent = `${fmtD(+e.target.value)} / ${fmtD(f.dur)}`; };
      $("#vfo").onclick = async () => { Object.assign(f, await vFrame(v, +$("#vft").value)); W.crop = null; W.thumbCrop = null; draw(); toast("Кадр выбран 🐾"); }; };
    const draw = () => { $("#ups").innerHTML = W.files.map((f, i) => `<div style="background-image:url('${f.url}')"><span class="o">${i + 1}</span>${i == W.cover ? `<span class="cvb">обложка</span>` : ""}${f.video ? `<span class="cnt">▶ ${fmtD(f.dur)}</span>` : ""}<span class="ctl"><b data-m="-1" data-i="${i}">↑</b><b data-cv="${i}">★</b><b data-rm="${i}">✕</b><b data-m="1" data-i="${i}">↓</b></span></div>`).join("") + (VP && W.files.length ? "" : `<div class="add" id="add">＋</div>`); $("#add") && ($("#add").onclick = () => $("#fi").click()); };
    draw(); frame(); $("#fi").onchange = async e => { const fs = [...e.target.files]; e.target.value = "";
      for (const f of fs) {
        if (f.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(f.name)) {
          if (!isMp4(f) || f.size > VMAX) { toast(VBAD); continue; }
          W.busy = 1; try { W.files.push(await addVideo(f)); } catch { toast(VBAD); } W.busy = 0;
        } else if (VP) toast(VBAD); else if (f.type.startsWith("image/")) W.files.push({ f, url: URL.createObjectURL(f) });
        if (VP && W.files.length) break; }
      draw(); frame(); };
    $("#ups").onclick = e => { const t = e.target.dataset; if (t.m) { const i = +t.i, j = i + +t.m; if (j < 0 || j >= W.files.length) return; [W.files[i], W.files[j]] = [W.files[j], W.files[i]]; if (W.cover == i) W.cover = j; else if (W.cover == j) W.cover = i; }
      else if (t.cv) { W.cover = +t.cv; W.crop = null; } else if (t.rm) { W.files.splice(+t.rm, 1); if (W.cover >= W.files.length) W.cover = 0; W.crop = null; } else return; draw(); frame(); };
  }
  if (W.step == 3) {
    let sel = W.cover, mode = "guest"; const tier = tiers.find(t => t.id == W.tier);
    const img = W.files[W.cover].img || (W.files[W.cover].img = await Crop.loadImg(W.files[W.cover].f));
    const drawPv = () => { if (!W || !W.c1 || !app.querySelector("#pvc")) return; const c = document.createElement("canvas"); W.c1.drawTo(c, 600, 600); const lk = mode == "guest" && tier.rank > 0;
      $("#pvc").innerHTML = `<div class="cov ${lk ? "lk" : ""}"><img src="${c.toDataURL("image/jpeg", .8)}"><h3>${M().esc(W.title)}</h3><span class="cnt">${W.mode == "video" ? `▶ ${(t => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`)(W.files[0]?.dur || 0)}` : `🖼 ${W.files.length} артов`}</span>${lk ? `<div class="frost"><span class="mu">${M().esc(M().T("locked_label"))}</span><b>${M().esc(tier.name)}${tier.price_rub ? " · " + tier.price_rub + " ₽/мес" : ""}</b><span class="ob">🔒 ${M().esc(M().T("btn_subscribe"))}</span></div>` : ""}</div>`;
      const th = $("#thc"); th.width = th.height = 240; const x = th.getContext("2d"), im = W.c1.img();
      let q = W.thumbMode == "own" && W.c2 ? W.c2.getCrop() : null; if (!q) { const k = W.c1.getCrop(), pw = k.w * im.width, ph = k.h * im.height, s = Math.min(pw, ph); q = { x: (k.x * im.width + (pw - s) / 2) / im.width, y: (k.y * im.height + (ph - s) / 2) / im.height, w: s / im.width, h: s / im.height }; }
      x.drawImage(im, q.x * im.width, q.y * im.height, q.w * im.width, q.h * im.height, 0, 0, 240, 240); };
    let t0; const deb = () => { clearTimeout(t0); t0 = setTimeout(drawPv, 60); };
    W.c1 = Crop.mount($("#cr1"), img, { aspect: 1, crop: W.crop, onChange: deb, maxH: 420 });
    W.c2 = Crop.mount($("#cr2"), img, { aspect: 1, crop: W.thumbCrop, onChange: deb, maxH: 320 });
    const d3 = () => $("#ups3").innerHTML = W.files.map((f, i) => `<div class="${i == sel ? "sel" : ""}" data-s="${i}" style="background-image:url('${f.url}');width:64px;height:64px">${i == W.cover ? `<span class="cvb">★</span>` : ""}</div>`).join(""); d3();
    $("#ups3").onclick = e => { const i = e.target.closest("[data-s]")?.dataset.s; if (i != null) { sel = +i; d3(); } };
    $("#mkcov").onclick = () => { save(); W.cover = sel; W.crop = null; W.thumbCrop = null; rer(); };
    app.querySelectorAll("[data-pv]").forEach(p => p.onclick = () => { mode = p.dataset.pv; app.querySelectorAll("[data-pv]").forEach(x => x.classList.toggle("on", x == p)); drawPv(); });
    app.querySelectorAll("[name=tm]").forEach(r => r.onchange = () => { W.thumbMode = r.value; $("#cr2").classList.toggle("hide", r.value != "own"); if (r.value == "own") W.c2.setCrop(W.thumbCrop); drawPv(); });
    drawPv();
  }
  if (W.step == 4) {
    app.querySelectorAll("[data-w]").forEach(p => p.onclick = () => { save(); W.when = p.dataset.w; rer(); });
    $("#pub").onclick = () => { save(); publish(app); };
  }
}
async function publish(app) {
  const { sb, toast } = M(), $ = s => app.querySelector(s), st = $("#st"), bar = $("#pg"); $("#pub").disabled = true;
  const tier = tiers.find(t => t.id == W.tier), pid = uuid(), rows = [];
  const publish_at = W.when == "later" ? new Date(W.at).toISOString() : new Date().toISOString();
  try {
    let coverImg = null; const vjobs = [], vx = {}; // vx: тизер обложки и публичная копия видео для открытого видео-поста
    const VC = W.files.some(f => f.video) ? await import("./vcomp.js?v=37").catch(() => null) : null;
    for (let i = 0; i < W.files.length; i++) {
      st.textContent = `Загрузка ${i + 1} из ${W.files.length}…`; bar.style.width = `${(i / W.files.length) * 90}%`;
      const img = W.files[i].img || await Crop.loadImg(W.files[i].f), iid = uuid(); if (i == W.cover) coverImg = img;
      if (W.files[i].video) { const F = W.files[i], vp = `videos/${pid}/${iid}.mp4`, pp = `posters/${pid}/${iid}.jpg`, mb = (F.f.size / 1048576).toFixed(0);
        const prev = await toJpeg(img, tier.rank > 0 ? LOCKED_PREV : 720, .85);
        let r = await ys("previews").upload(pp, prev.blob, { contentType: "image/jpeg", upsert: true }); if (r.error) throw new Error(`Постер ${i + 1}: ${r.error.message}`);
        // сжатие (WebCodecs H.264, ≤1080p, ~3,5 Мбит/с; не стало меньше — оригинал) и тизер 4 с с кадра-обложки; без WebCodecs — как раньше
        let up = F.f, tp = null;
        if (VC?.supported()) {
          try { up = (await VC.compress(F.f, x => { st.textContent = `Видео ${i + 1} из ${W.files.length} · сжимаю ${Math.round(x * 100)}%`; })).blob; } catch (e) { console.warn("сжатие", e); }
          try { st.textContent = `Видео ${i + 1} из ${W.files.length} · тизер…`; const tz = await VC.teaser(F.f, F.t || 0); tp = `teasers/${pid}/${iid}.mp4`;
            const r2 = await ys("previews").upload(tp, tz, { contentType: "video/mp4", upsert: true }); if (r2.error) tp = null; } catch (e) { console.warn("тизер", e); tp = null; } }
        const umb = (up.size / 1048576).toFixed(0), sv = up === F.f ? "" : ` (сжато ${mb}→${umb} МБ)`;
        await uploadVideo(vp, up, x => { st.textContent = `Видео ${i + 1} из ${W.files.length} · ${Math.round(x * 100)}% из ${umb} МБ${sv} · постер готов`; bar.style.width = `${((i + x) / W.files.length) * 90}%`; });
        // открытый видео-пост: полное видео играет в ленте → публичная копия в mia-previews/feedvid/ (закрытые — никогда)
        if (W.mode == "video" && tier.rank == 0) { const fp = `feedvid/${pid}/${iid}.mp4`;
          try { await uploadVideo(fp, up, x => { st.textContent = `Видео для ленты · ${Math.round(x * 100)}%`; }, "previews"); vx.feed = fp; } catch (e) { console.warn("feedvid", e); } }
        if (i == W.cover) vx.teaser = tp;
        vjobs.push([pp, VW.thumb, prev.blob]);
        rows.push({ id: iid, post_id: pid, position: i + 1, preview_path: pp, original_path: vp, width: F.w, height: F.h, kind: "video", duration_sec: Math.round(F.dur * 10) / 10, poster_path: pp, size_bytes: up.size, teaser_path: tp }); continue; }
      const orig = await toJpeg(img, 2560, 0.92), prev = await toJpeg(img, tier.rank > 0 ? LOCKED_PREV : 480, tier.rank > 0 ? 0.85 : 0.8); // закрытые паки: чёткое превью ~700px (для превью-показа в кинорежиме)
      const op = `${pid}/${iid}.jpg`, pp = `thumbs/${pid}/${iid}.jpg`;
      for (const [b, p, blob] of [["originals", op, orig.blob], ["previews", pp, prev.blob]]) { let r, k = 0; do { r = await ys(b).upload(p, blob, { cacheControl: "31536000", contentType: "image/jpeg", upsert: true }); } while (r.error && ++k < 3); if (r.error) throw new Error(`Арт ${i + 1}: ${r.error.message}`); }
      vjobs.push([pp, VW.thumb, prev.blob]);
      rows.push({ id: iid, post_id: pid, position: i + 1, preview_path: pp, original_path: op, width: orig.w, height: orig.h, kind: "image", duration_sec: null, poster_path: null, size_bytes: null, teaser_path: null }); // все строки с одинаковыми ключами: иначе PostgREST подставит null в kind и вставка упадёт
    }
    st.textContent = "Обложка и миниатюра…";
    const crop = W.crop || null, cv = document.createElement("canvas");
    const c = crop || (() => { const a = 1, iw = coverImg.width, ih = coverImg.height; let w = iw, h = iw / a; if (h > ih) { h = ih; w = ih * a; } return { x: (iw - w) / 2 / iw, y: (ih - h) / 2 / ih, w: w / iw, h: h / ih }; })();
    cv.width = 1080; cv.height = 1080; cv.getContext("2d").drawImage(coverImg, c.x * coverImg.width, c.y * coverImg.height, c.w * coverImg.width, c.h * coverImg.height, 0, 0, 1080, 1080);
    const cb = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.86)), coverPath = `covers/${pid}.jpg`;
    let r = await ys("previews").upload(coverPath, cb, { contentType: "image/jpeg", upsert: true }); if (r.error) throw r.error; vjobs.push([coverPath, VW.cover, cb]);
    const tb = await squareThumb(coverImg, c, W.thumbMode == "own" ? W.thumbCrop : null), thumbPath = `thumbs/${pid}/cover.jpg`;
    r = await ys("previews").upload(thumbPath, tb, { contentType: "image/jpeg", upsert: true }); if (r.error) throw r.error;
    st.textContent = "Сохраняю публикацию…";
    r = await sb.from("posts").insert({ id: pid, title: W.title.trim(), body: W.body.trim(), tier_id: W.tier, cover_path: coverPath, publish_at, status: "draft", thumb_path: thumbPath, cover_crop: { ...c, image: W.cover + 1 }, thumb_crop: W.thumbMode == "own" ? W.thumbCrop : null }); if (r.error) throw r.error;
    r = await insertRows(rows); if (r.error) throw r.error;
    if (vx.teaser || vx.feed) await sb.from("posts").update({ cover_teaser_path: vx.teaser || null, feed_video_path: vx.feed || null }).eq("id", pid); // до teasers.sql колонок нет — ошибка игнорируется
    if (W.mode == "video") await sb.from("posts").update({ kind: "video" }).eq("id", pid); // до video.sql колонки нет — тихо пропускаем
    r = await sb.from("posts").update({ status: W.when == "draft" ? "draft" : "published", cover_image_id: rows[W.cover].id, cover_crop: { image_id: rows[W.cover].id, ...c } }).eq("id", pid); if (r.error) throw r.error;
    bar.style.width = "100%"; toast(W.when == "draft" ? "Черновик сохранён" : W.when == "later" ? "Запланировано" : "Опубликовано!"); W = null; autoVariants(vjobs); await M().load(); location.hash = "#/admin/posts";
  } catch (e) { st.textContent = "Ошибка: " + (e.message || e) + " — нажмите ещё раз, чтобы повторить"; $("#pub").disabled = false; }
}

// ---------- «1 пак на выбор»: выпуск одноразовых кодов и кто какой пак открыл ----------
async function pickTab(app) {
  const { sb, esc, toast } = M();
  const [{ data, error }, { data: profRows }] = await Promise.all([sb.rpc("admin_pick_code"), sb.from("settings").select("value").eq("key", "profile")]);
  const pickUrl = profRows?.[0]?.value?.pick_url || "";
  if (error) { app.innerHTML = shell("pick", `<h2>🎁 1 пак на выбор</h2><div class="note">Функции ещё не установлены в базе (нужна миграция supabase/migrations/20261014_universal_code.sql). ${esc(error.message)}</div>`); return; }
  const g = data || {}, d = t => t ? new Date(t).toLocaleString("ru-RU") : "";
  app.innerHTML = shell("pick", `<h2>🎁 1 пак на выбор</h2><div class="card"><b>Общий код</b><div class="mu small" style="margin-top:4px">Один код для всех 🐾 Любой аккаунт может ввести его <b>один раз</b> и получить 1 пак на выбор. Код можно сменить в любой момент — кто уже активировал, сохранит свой пак.</div>
    <div class="r" style="margin-top:10px;flex-wrap:wrap"><input type="text" id="pcode" value="${esc(g.code || "")}" placeholder="Например: MUR-MEOW-2026" maxlength="64" style="flex:1;min-width:180px;text-transform:uppercase;font-family:monospace"><button class="ob" id="psave">Сохранить код</button></div>
    <div class="mu small" style="margin-top:8px">${g.code ? `Сейчас действует: <code>${esc(g.code)}</code> · изменён ${d(g.updated_at)}` : "Код не задан — ввести пока нечего, мяу"}</div></div>
    <div class="card"><b>Ссылка на оплату</b><div class="mu small" style="margin-top:4px">Куда ведёт кнопка «Купить код, мяу ↗» в окне «1 пак на выбор». Пустое поле — снова откроется Boosty.</div>
    <div class="r" style="margin-top:10px;flex-wrap:wrap"><input type="url" id="purl" value="${esc(pickUrl)}" placeholder="https://" style="flex:1;min-width:180px"><button class="ob" id="purlsave">Сохранить ссылку</button></div>
    <div class="mu small" style="margin-top:8px">${pickUrl ? `Сейчас: <a href="${esc(pickUrl)}" target="_blank" rel="noopener">${esc(pickUrl)}</a>` : "Ссылка не задана — откроется Boosty"}</div></div>
    <div class="card"><b>Активации</b><div class="r" style="margin-top:8px;gap:24px"><div><div style="font-size:28px;font-weight:700">${g.redeemed || 0}</div><div class="mu small">аккаунтов ввели код</div></div><div><div style="font-size:28px;font-weight:700">${g.used || 0}</div><div class="mu small">уже выбрали пак</div></div></div></div>`);
  app.querySelector("#psave").onclick = async e => { const v = app.querySelector("#pcode").value.trim();
    if (v && (v.length < 4 || v.length > 64)) return toast("Код: от 4 до 64 символов");
    e.target.disabled = true; const { error } = await sb.rpc("admin_set_pick_code", { p_code: v }); e.target.disabled = false; if (error) return toast("Ошибка: " + error.message);
    ev(v ? "Общий код «1 пак на выбор» изменён" : "Общий код «1 пак на выбор» выключен"); toast(v ? "Код сохранён 🐾" : "Код выключен"); await pickTab(app); };
  app.querySelector("#purlsave").onclick = async e => { const u = app.querySelector("#purl").value.trim();
    if (u && !/^https:\/\//i.test(u)) return toast("Ссылка должна начинаться с https://");
    e.target.disabled = true;
    const { data: rows, error: re } = await sb.from("settings").select("value").eq("key", "profile");
    if (re) { e.target.disabled = false; return toast("Ошибка: " + re.message); }
    const p = { ...(rows?.[0]?.value || {}) }; if (u) p.pick_url = u; else delete p.pick_url;
    const { error: ue } = await sb.from("settings").upsert({ key: "profile", value: p });
    e.target.disabled = false; if (ue) return toast("Ошибка: " + ue.message);
    ev(u ? "Ссылка «1 пак на выбор» изменена" : "Ссылка «1 пак на выбор» сброшена на Boosty");
    toast(u ? "Ссылка сохранена 🐾" : "Ссылка сброшена, откроется Boosty"); await M().load(); await pickTab(app); };
}

// ---------- tiers ----------
async function tiersTab(app) {
  const { sb, esc, toast } = M(); await loadTiers(); const { data: codes } = await sb.rpc("admin_codes"); const cd = Object.fromEntries((codes || []).map(c => [c.id, c]));
  app.innerHTML = shell("tiers", `<h2>Уровни</h2><div class="two">${tiers.map(t => `<div class="card"><b>${esc(t.name)}</b> ${t.rank ? `<span class="mu">· ${cd[t.id]?.subs ?? 0} подписчиков</span>` : `<span class="tier f">бесплатно</span>`}
   <label>Название (можно эмодзи)</label><input type="text" data-f="name" data-t="${t.id}" value="${esc(t.name)}">${t.rank ? `<label>Цена, ₽/мес</label><input type="number" data-f="price_rub" data-t="${t.id}" value="${t.price_rub}">` : ""}
   <label>Что входит (каждый пункт с новой строки)</label><textarea rows="3" data-f="perks" data-t="${t.id}">${esc((t.perks || []).join("\n"))}</textarea>
   ${t.rank ? `<label>Ссылка на оплату (любой сервис, он выдаёт код)</label><input type="url" data-f="pay_url" data-t="${t.id}" value="${esc(t.pay_url || "")}" placeholder="https://">
   <label>Текущий код</label><div class="r"><input type="text" readonly value="${cd[t.id]?.code ? "••••••••" : "не задан"}" data-real="${esc(cd[t.id]?.code || "")}" id="cur${t.id}"><button class="gb" data-show="${t.id}">👁</button></div>
   <label>Новый код (от 6 символов)</label><div class="r"><input type="text" id="nc${t.id}" style="text-transform:uppercase"><button class="gb" data-rnd="${t.id}">🎲</button></div>
   <div class="warn">⚠ После смены кода все, кто вошёл по старому коду, потеряют доступ, пока не введут новый. Не забудьте обновить код в сервисе оплаты.<label style="color:#8a4b00"><input type="checkbox" id="keep${t.id}"> Сохранить доступ тем, кто уже активировал</label></div>
   <button class="gb" data-code="${t.id}" style="margin-top:10px">Сменить код</button>` : ""}<div style="margin-top:12px"><button class="ob" data-save="${t.id}">Сохранить</button></div></div>`).join("")}</div>`);
  const q = s => app.querySelector(s);
  app.querySelectorAll("[data-show]").forEach(b => b.onclick = () => { const i = q("#cur" + b.dataset.show); i.value = i.value.startsWith("•") ? i.dataset.real : "••••••••"; });
  app.querySelectorAll("[data-rnd]").forEach(b => b.onclick = () => { const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; q("#nc" + b.dataset.rnd).value = "MIA-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), x => a[x % a.length]).join(""); });
  app.querySelectorAll("[data-code]").forEach(b => b.onclick = async () => { const id = +b.dataset.code, v = q("#nc" + id).value.trim(), keep = q("#keep" + id).checked; if (v.length < 6) return toast("Минимум 6 символов");
    if (!confirm(keep ? `Сменить код на ${v.toUpperCase()}? Текущие подписчики сохранят доступ.` : `Сменить код на ${v.toUpperCase()}? Все, кто вошёл по старому коду, потеряют доступ.`)) return;
    const { error } = await sb.rpc("set_tier_code", { p_tier: id, p_code: v, p_keep: keep }); toast(error ? "Ошибка: " + error.message : "Код сменён"); tiersTab(app); });
  app.querySelectorAll("[data-save]").forEach(b => b.onclick = async () => { const id = +b.dataset.save, v = {};
    app.querySelectorAll(`[data-t="${id}"]`).forEach(i => v[i.dataset.f] = i.dataset.f == "perks" ? i.value.split("\n").map(s => s.trim()).filter(Boolean) : i.dataset.f == "price_rub" ? +i.value : i.value.trim());
    if (v.pay_url && !/^https?:\/\//.test(v.pay_url)) return toast("Ссылка должна начинаться с https://");
    const { error } = await sb.from("tiers").update(v).eq("id", id); toast(error ? "Ошибка: " + error.message : "Сохранено"); if (!error) { ev("Изменён уровень " + v.name); await M().load(); } });
}
// ---------- comments ----------
async function commentsTab(app, f = "new") {
  const { sb, esc, fmt, toast } = M();
  let qy = sb.from("comments").select("id,post_id,user_id,body,created_at,deleted,reported,parent_id").order("created_at", { ascending: false }).limit(200);
  if (f == "new" || f == "rep") qy = qy.eq("deleted", false); if (f == "rep") qy = qy.eq("reported", true);
  const [{ data: cs }, { data: pr }, { data: ps }] = await Promise.all([qy, sb.from("profiles").select("id,username,banned_until"), sb.from("posts").select("id,title")]);
  const U = Object.fromEntries((pr || []).map(x => [x.id, x])), P = Object.fromEntries((ps || []).map(x => [x.id, x.title]));
  app.innerHTML = shell("comments", `<h2>Комментарии</h2><div class="r" style="margin-bottom:10px">${[["new", "Новые"], ["rep", "⚑ Жалобы"], ["all", "Все, включая удалённые"]].map(([k, n]) => `<a class="pill ${k == f ? "on" : ""}" href="#/admin/comments/${k}">${n}</a>`).join("")}</div>
  <div class="tw"><table><tr><th>Кто</th><th>Пост</th><th>Текст</th><th>Когда</th><th></th></tr>${(cs || []).map(c => { const u = U[c.user_id];
    return `<tr style="${c.reported ? "background:#fff4e5;color:#222" : ""}${c.deleted ? ";opacity:.5" : ""}"><td>${u ? esc(u.username) + (u.banned_until && new Date(u.banned_until) > new Date() ? " ⛔" : "") : "<b>Мия</b>"}${c.reported ? " ⚑" : ""}</td><td>${esc(P[c.post_id] || "")}</td><td>${c.parent_id ? "↳ " : ""}${esc(c.body)}</td><td style="white-space:nowrap">${fmt(c.created_at)}</td>
    <td style="white-space:nowrap">${c.deleted ? "удалён" : `<a class="gb sm" data-rp="${c.id}">Ответить</a> <a class="gb sm" data-dl="${c.id}">Удалить</a>${u ? ` <a class="gb sm" data-bn="${c.user_id}">Бан</a>` : ""}`}</td></tr>`; }).join("") || `<tr><td colspan="5" class="mu">Комментариев нет</td></tr>`}</table></div>`);
  const byId = id => cs.find(c => c.id == id);
  app.querySelectorAll("[data-rp]").forEach(b => b.onclick = async () => { const c = byId(b.dataset.rp), t = prompt("Ответ от Мии:"); if (!t) return; const { error } = await sb.rpc("add_comment", { p_post: c.post_id, p_body: t, p_parent: c.parent_id || c.id }); toast(error ? "Ошибка: " + error.message : "Ответ опубликован"); commentsTab(app, f); });
  app.querySelectorAll("[data-dl]").forEach(b => b.onclick = async () => { if (!confirm("Удалить комментарий?")) return; await sb.from("comments").update({ deleted: true }).eq("id", b.dataset.dl); ev("Удалён комментарий #" + b.dataset.dl); commentsTab(app, f); });
  app.querySelectorAll("[data-bn]").forEach(b => b.onclick = () => ban(b.dataset.bn, U[b.dataset.bn]?.username, () => commentsTab(app, f)));
}
async function ban(uid, name, done) {
  const { sb, toast } = M(); const d = prompt(`Бан для ${name}: на сколько дней? (0 — навсегда)`, "7"); if (d == null) return;
  const until = +d > 0 ? new Date(Date.now() + d * 864e5).toISOString() : "2999-01-01T00:00:00Z";
  const { error } = await sb.from("profiles").update({ banned_until: until }).eq("id", uid); if (error) return toast(error.message);
  if (confirm("Удалить все его комментарии?")) await sb.from("comments").update({ deleted: true }).eq("user_id", uid);
  ev(`Бан ${name} ${+d > 0 ? "на " + d + " дн." : "навсегда"}`); toast("Забанен"); done();
}
// ---------- users ----------
async function usersTab(app, qs = "") {
  const { sb, esc, toast, fn } = M(); await loadTiers();
  const { data } = await sb.from("profiles").select("id,username,avatar_path,tier_rank,tier_version,created_at,last_seen,banned_until").order("created_at", { ascending: false });
  const list = (data || []).filter(u => !qs || u.username.toLowerCase().includes(qs.toLowerCase()));
  const eff = u => { const t = tiers.find(t => t.rank == u.tier_rank); return u.tier_rank > 0 && t && t.code_version == u.tier_version ? t : null; };
  const top = tiers.filter(t => t.rank > 0).pop();
  app.innerHTML = shell("users", `<h2>Пользователи · ${(data || []).length}</h2><input type="text" id="us" placeholder="Поиск по имени" value="${esc(qs)}" style="max-width:300px;margin-bottom:10px">
  <div class="tw"><table><tr><th>Имя</th><th>Уровень</th><th>Регистрация</th><th>Был</th><th></th></tr>${list.map(u => { const t = eff(u), banned = u.banned_until && new Date(u.banned_until) > new Date();
    return `<tr><td><a href="#/u/${u.id}">${esc(u.username)}</a>${banned ? ` <span class="pill">⛔ до ${new Date(u.banned_until).getFullYear() > 2900 ? "∞" : new Date(u.banned_until).toLocaleDateString("ru-RU")}</span>` : ""}</td><td>${t ? `<span class="tier">${esc(t.name)}</span>` : `<span class="tier f">Follower</span>`}</td><td>${new Date(u.created_at).toLocaleDateString("ru-RU")}</td><td>${u.last_seen ? new Date(u.last_seen).toLocaleString("ru-RU") : "—"}</td>
    <td style="white-space:nowrap">${t ? `<a class="gb sm" data-untier="${u.id}">Снять уровень</a>` : top ? `<a class="gb sm" data-give="${u.id}">Выдать ${esc(top.name)}</a>` : ""} ${banned ? `<a class="gb sm" data-unban="${u.id}">Разбанить</a>` : `<a class="gb sm" data-ban="${u.id}">Бан</a>`} <a class="gb sm" data-tmp="${u.id}">Врем. пароль</a></td></tr>`; }).join("") || `<tr><td colspan="5" class="mu">Никого</td></tr>`}</table></div>`);
  const nm = id => data.find(u => u.id == id)?.username, re = () => usersTab(app, app.querySelector("#us")?.value || "");
  let tm; app.querySelector("#us").oninput = e => { clearTimeout(tm); tm = setTimeout(() => { usersTab(app, e.target.value).then(() => { const i = app.querySelector("#us"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 300); };
  app.querySelectorAll("[data-untier]").forEach(b => b.onclick = async () => { if (!confirm("Снять уровень у " + nm(b.dataset.untier) + "?")) return; await sb.from("profiles").update({ tier_rank: 0, tier_version: 0 }).eq("id", b.dataset.untier); ev("Снят уровень у " + nm(b.dataset.untier)); re(); });
  app.querySelectorAll("[data-give]").forEach(b => b.onclick = async () => { await sb.from("profiles").update({ tier_rank: top.rank, tier_version: top.code_version }).eq("id", b.dataset.give); ev(`Выдан уровень ${top.name} пользователю ${nm(b.dataset.give)}`); toast("Уровень выдан"); re(); });
  app.querySelectorAll("[data-unban]").forEach(b => b.onclick = async () => { await sb.from("profiles").update({ banned_until: null }).eq("id", b.dataset.unban); ev("Разбан " + nm(b.dataset.unban)); re(); });
  app.querySelectorAll("[data-ban]").forEach(b => b.onclick = () => ban(b.dataset.ban, nm(b.dataset.ban), re));
  app.querySelectorAll("[data-tmp]").forEach(b => b.onclick = async () => { if (!confirm("Выдать временный пароль для " + nm(b.dataset.tmp) + "? Старый перестанет работать.")) return;
    const r = await fn("login", { action: "temp_password", user_id: b.dataset.tmp }); if (r.status != 200) return toast("Ошибка"); prompt("Временный пароль (передайте пользователю, пусть сменит в профиле):", r.data.password); });
}
// ---------- author ----------
// видео профиля: mp4 → 6 с с выбранного места, без звука, H.264 (аватар 320×320, шапка 1280×320), публично mia-previews/profile/; картинка остаётся постером
const pvid = (k, path, title) => `<div class="r" style="margin-top:10px;flex-wrap:wrap;gap:8px">${path ? `<video src="${M().pub(path)}" muted loop autoplay playsinline style="width:${k == "av" ? "48px;height:48px;border-radius:50%" : "120px;height:30px;border-radius:6px"};object-fit:cover"></video>` : ""}<label class="gb sm" style="margin:0;color:var(--fg)">🎬 ${title}<input type="file" id="${k}v" accept="video/mp4" class="hide"></label>${path ? `<a class="gb sm" id="${k}vdel">Убрать видео</a>` : ""}</div>`;
// кадрирование видео: рамка нужной формы (круг — аватар, прямоугольник — шапка/обложка), перетаскивание = положение, ползунок = начало 6/4-секундного куска,
// превью вживую крутят именно выбранный кусок. Возвращает { start, crop:{left,top,width,height} в пикселях исходника, frame: Blob jpeg кадра-постера } или null
function videoCrop(f, o) {
  const url = typeof f == "string" ? f : URL.createObjectURL(f), d = document.createElement("div"); d.className = "ov"; let fx = .5, fy = .5;
  const pv = (o.previews || []).map((p, k) => `<div style="text-align:center"><div style="width:${p.w}px;height:${p.h}px;border-radius:${p.round ? "50%" : "6px"};overflow:hidden;background:#000"><video data-pv="${k}" src="${url}" muted playsinline style="width:100%;height:100%;object-fit:cover"></video></div><div class="mu small">${p.label}</div></div>`).join("");
  d.innerHTML = `<div class="sheet wide-sheet"><a class="x">✕</a><h2>${o.title}</h2>
    <div id="vcf" style="position:relative;width:100%;max-width:${o.round ? 360 : 640}px;margin:0 auto;aspect-ratio:${o.aspect};border-radius:${o.round ? "50%" : "10px"};overflow:hidden;background:#000;cursor:grab;touch-action:none;outline:3px solid var(--ac);outline-offset:2px">
      <video id="vcv" src="${url}" muted playsinline style="width:100%;height:100%;object-fit:cover;pointer-events:none"></video>${o.safe ? `<i style="position:absolute;top:0;bottom:0;left:${50 - 50 * o.safe / o.aspect}%;right:${50 - 50 * o.safe / o.aspect}%;border:2px dashed #ffd400;pointer-events:none"></i>` : ""}</div>
    <div class="mu small" style="text-align:center;margin-top:6px">Перетащите, чтобы выбрать, что попадёт в ${o.round ? "круг" : "рамку"}</div>
    <label>Начало: <b id="vcs">0.0</b> с · кусок ${o.dur} с, без звука, по кругу</label><input type="range" id="vcr" min="0" max="0" step="0.1" value="0" style="width:100%">
    ${pv ? `<div class="r" style="gap:14px;margin-top:10px;flex-wrap:wrap;align-items:flex-end">${pv}</div>` : ""}<div class="mu small" id="vct"></div>
    <div class="row-btn"><button class="gb" data-x>Отмена</button><button class="ob" id="vcok">${o.ok || "Готово"}</button></div></div>`;
  document.body.append(d);
  const v = d.querySelector("#vcv"), all = [v, ...d.querySelectorAll("[data-pv]")], rg = d.querySelector("#vcr"), box = d.querySelector("#vcf");
  const pos = () => all.forEach(x => x.style.objectPosition = `${fx * 100}% ${fy * 100}%`);
  const loop = () => { const s = +rg.value; all.forEach(x => { if (x.currentTime < s || x.currentTime > s + o.dur) x.currentTime = s; }); };
  all.forEach(x => { x.loop = false; x.ontimeupdate = loop; x.onended = () => { x.currentTime = +rg.value; x.play().catch(() => {}); }; x.oncanplay = () => x.play().catch(() => {}); });
  v.onloadedmetadata = () => { rg.max = Math.max(0, v.duration - o.dur).toFixed(1); };
  rg.oninput = () => { d.querySelector("#vcs").textContent = (+rg.value).toFixed(1); all.forEach(x => x.currentTime = +rg.value); };
  let drag = null; box.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, fx, fy }; box.setPointerCapture(e.pointerId); box.style.cursor = "grabbing"; };
  box.onpointermove = e => { if (!drag) return; const r = box.getBoundingClientRect(), W = v.videoWidth, H = v.videoHeight, k = Math.max(r.width / W, r.height / H), ex = W * k - r.width, ey = H * k - r.height;
    if (ex > 1) fx = Math.min(1, Math.max(0, drag.fx - (e.clientX - drag.x) / ex)); if (ey > 1) fy = Math.min(1, Math.max(0, drag.fy - (e.clientY - drag.y) / ey)); pos(); };
  box.onpointerup = () => { drag = null; box.style.cursor = "grab"; }; pos();
  const close = () => { d.remove(); if (typeof f != "string") URL.revokeObjectURL(url); };
  return new Promise(ok => { d.querySelector(".x").onclick = d.querySelector("[data-x]").onclick = () => { close(); ok(null); };
    d.querySelector("#vcok").onclick = async () => { const W = v.videoWidth, H = v.videoHeight, A = o.aspect; let cw = W, ch = H; if (W / H > A) cw = Math.round(H * A); else ch = Math.round(W / A);
      const crop = { left: Math.round(fx * (W - cw)), top: Math.round(fy * (H - ch)), width: cw, height: ch }, start = +rg.value;
      v.pause(); v.currentTime = start; await new Promise(r => v.onseeked = r); const c = document.createElement("canvas"); c.width = o.outW; c.height = o.outH; c.getContext("2d").drawImage(v, crop.left, crop.top, cw, ch, 0, 0, o.outW, o.outH);
      const frame = await new Promise(r => c.toBlob(r, "image/jpeg", .88)); close(); ok({ start, crop, frame }); }; });
}
async function profileClip(f, kind) {
  const { toast } = M(); if (!isMp4(f) || f.size > VMAX) return toast(VBAD);
  const VC = await import("./vcomp.js?v=37").catch(() => null); if (!VC?.supported()) return toast("Этот браузер не умеет WebCodecs — откройте админку в Chrome/Edge/Safari 16.4+");
  const av = kind == "av", r = await videoCrop(f, av ? { title: "Видео-аватар · круг · 6 с", aspect: 1, round: true, dur: 6, outW: 400, outH: 400, ok: "Сделать клип", previews: [{ w: 96, h: 96, round: 1, label: "96 · шапка" }, { w: 40, h: 40, round: 1, label: "40 · комментарий" }] }
    : { title: "Видео-шапка · 4:1 · 6 с (жёлтая рамка — видно на телефоне)", aspect: 4, safe: 2.4, dur: 6, outW: 1600, outH: 400, ok: "Сделать клип", previews: [{ w: 230, h: 58, label: "ПК" }, { w: 140, h: 58, label: "Телефон (края обрезаются)" }] });
  if (!r) return null; toast("Режу и сжимаю…");
  const blob = av ? await VC.clip(f, r.start, 6, 320, 320, 6e5, r.crop) : await VC.clip(f, r.start, 6, 1280, 320, 1.2e6, r.crop);
  const path = `profile/${av ? "avatar" : "cover"}-${Date.now()}.mp4`, up = await ys("previews").upload(path, blob, { contentType: "video/mp4" }); if (up.error) { toast(up.error.message); return null; }
  toast(`Клип ${(blob.size / 1024).toFixed(0)} КБ загружен`); return path;
}
async function authorTab(app) {
  const { sb, esc, pub, toast } = M(); const { data } = await sb.from("settings").select("value").eq("key", "profile"); const p = data?.[0]?.value || {}, l = p.links || {};
  app.innerHTML = shell("author", `<h2>Профиль автора</h2><div class="two"><div class="card"><b>Аватар · круг</b><div class="r" style="margin-top:10px"><span class="ava" style="width:96px;height:96px;background-image:url('${p.avatar ? pub(p.avatar) : "avatar.jpg"}')"></span><label class="gb" style="margin:0;color:var(--fg)">Загрузить и обрезать<input type="file" id="avf" accept="image/*" class="hide"></label></div>${pvid("av", p.avatar_video, "Видео-аватар · 6 с")}</div>
  <div class="card"><b>Шапка · 4:1</b><div class="hero" style="margin-top:10px"><div class="cv" style="border-radius:8px">${p.cover ? `<img src="${pub(p.cover)}" alt="">` : ""}</div></div><label class="gb" style="margin:10px 0 0;color:var(--fg)">Загрузить и обрезать<input type="file" id="cvf" accept="image/*" class="hide"></label>${pvid("cv", p.cover_video, "Видео-шапка · 6 с")}</div></div>
  <form class="card" id="prf"><label>Имя</label><input type="text" id="pn" value="${esc(p.name || "Мия")}"><label>Подзаголовок</label><input type="text" id="pt" value="${esc(p.tagline)}"><label>Об авторе</label><textarea id="pa" rows="5">${esc(p.about)}</textarea>
  ${[["boosty", "Boosty"], ["donut", "VK Donut"], ["telegram", "Telegram"], ["vk", "VK (сюда же ведёт «Забыли пароль?»)"]].map(([k, n]) => `<label>${n}</label><input type="url" data-l="${k}" value="${esc(l[k])}" placeholder="https://">`).join("")}<div style="margin-top:12px"><button class="ob" type="submit">Сохранить</button></div></form>`);
  const q = s => app.querySelector(s);
  const save = async v => { const { error } = await sb.from("settings").upsert({ key: "profile", value: v }); toast(error ? "Ошибка: " + error.message : "Сохранено"); if (!error) { await M().load(); authorTab(app); } };
  q("#avf").onchange = async e => { const f = e.target.files[0]; if (!f) return; const img = await Crop.loadImg(f);
    const r = await Crop.open(img, { title: "Аватар автора", aspect: 1, round: true, outW: 400, outH: 400, previews: [{ w: 96, h: 96, round: 1, label: "96 · шапка" }, { w: 40, h: 40, round: 1, label: "40 · комментарий" }, { w: 28, h: 28, round: 1, label: "28 · меню" }] });
    if (!r) return; const path = `site/avatar-${Date.now()}.jpg`; const up = await ys("previews").upload(path, r.blob, { cacheControl: "31536000", contentType: "image/jpeg" }); if (up.error) return toast(up.error.message); autoVariants([[path, VW.ava, r.blob]]); save({ ...p, avatar: path, avatar_crop: r.crop }); };
  q("#cvf").onchange = async e => { const f = e.target.files[0]; if (!f) return; const img = await Crop.loadImg(f);
    const r = await Crop.open(img, { title: "Шапка профиля · 4:1 (жёлтая рамка — видно на телефоне)", aspect: 4, outW: 1600, outH: 400, safe: 2.4, previews: [{ w: 230, h: 58, label: "ПК" }, { w: 140, h: 58, label: "Телефон (края обрезаются)" }] });
    if (!r) return; const path = `site/cover-${Date.now()}.jpg`; const up = await ys("previews").upload(path, r.blob, { cacheControl: "31536000", contentType: "image/jpeg" }); if (up.error) return toast(up.error.message); autoVariants([[path, VW.hero, r.blob]]); save({ ...p, cover: path, cover_crop: r.crop }); };
  for (const k of ["av", "cv"]) { const key = k == "av" ? "avatar_video" : "cover_video";
    q(`#${k}v`).onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; const path = await profileClip(f, k); if (path) { if (p[key]) ys("previews").remove([p[key]]); save({ ...p, [key]: path }); } };
    if (q(`#${k}vdel`)) q(`#${k}vdel`).onclick = () => { if (!confirm("Убрать видео? Останется картинка.")) return; ys("previews").remove([p[key]]); const v = { ...p }; delete v[key]; save(v); }; }
  q("#prf").onsubmit = e => { e.preventDefault(); const v = { ...p, name: q("#pn").value.trim(), tagline: q("#pt").value.trim(), about: q("#pa").value, links: {} }; app.querySelectorAll("[data-l]").forEach(i => v.links[i.dataset.l] = i.value.trim()); save(v); };
}
// ---------- texts ----------
async function textsTab(app) {
  const { sb, esc, toast, DEF } = M(); const { data } = await sb.from("settings").select("value").eq("key", "texts"); const tx = data?.[0]?.value || {};
  const L = { btn_subscribe: "Кнопка подписки", btn_login: "Кнопка входа", locked_label: "Плашка закрытого поста", signup_title: "Окно регистрации", login_title: "Окно входа", pay_hint: "Подпись под кнопкой оплаты", btn_pay: "Кнопка оплаты", code_label: "Поле кода", btn_unlock: "Кнопка проверки кода", code_ok: "Код верный", code_bad: "Код неверный", code_old: "Код сменился", login_bad: "Неверный вход", name_taken: "Имя занято", rate_limited: "Много попыток", no_comment_rights: "Нет прав комментировать ({tier} — уровень)", guest_comment: "Гость под комментариями", banned: "Бан", offline: "Нет связи", empty_feed: "Пустая лента", empty_comments: "Нет комментариев", empty_likes: "Нет лайков в профиле", forgot: "Забыли пароль" };
  app.innerHTML = shell("texts", `<h2>Тексты сайта</h2><div class="tw"><table><tr><th>Где</th><th>Текст</th><th></th></tr>${Object.keys(DEF).map(k => `<tr><td class="mu">${L[k] || k}</td><td><input type="text" data-k="${k}" value="${esc(tx[k] ?? DEF[k])}"></td><td><a class="gb sm" data-rs="${k}" title="Сбросить">↺</a></td></tr>`).join("")}</table></div><div style="margin-top:12px"><button class="ob" id="sv">Сохранить</button></div>`);
  app.querySelectorAll("[data-rs]").forEach(b => b.onclick = () => app.querySelector(`[data-k="${b.dataset.rs}"]`).value = DEF[b.dataset.rs]);
  app.querySelector("#sv").onclick = async () => { const v = {}; app.querySelectorAll("[data-k]").forEach(i => { if (i.value.trim() && i.value != DEF[i.dataset.k]) v[i.dataset.k] = i.value.trim(); });
    const { error } = await sb.from("settings").upsert({ key: "texts", value: v }); toast(error ? "Ошибка: " + error.message : "Сохранено"); if (!error) { M().setTexts(v); ev("Изменены тексты сайта"); } };
}
// ---------- viewer ----------
async function viewerTab(app) {
  const { sb, esc, pub, toast, S } = M(); const D = window.MiaViewer.DEFV;
  const { data } = await sb.from("settings").select("value").eq("key", "viewer"); const v = { ...D, ...(data?.[0]?.value || {}) }; v.tracks = { ...(v.tracks || {}) };
  const { data: ps } = await sb.from("posts").select("id,title").order("publish_at", { ascending: false });
  const seg = (k, opts) => `<div class="r" style="flex-wrap:wrap">${opts.map(([val, n]) => `<span class="pill ${v[k] == val ? "on" : ""}" data-seg="${k}" data-val="${val}">${n}</span>`).join("")}</div>`;
  const sw = (k, t, d) => `<div class="rowsw"><div><b style="font-size:14px">${t}</b>${d ? `<div class="mu small">${d}</div>` : ""}</div><button type="button" class="sw ${v[k] ? "on" : ""}" data-sw="${k}"></button></div>`;
  const tname = p => p ? decodeURIComponent(p.split("/").pop().replace(/^\d+-/, "")) : "";
  const draw = () => { app.innerHTML = shell("viewer", `<h2>Режим просмотра</h2><div class="two"><div>
  <div class="card">${sw("enabled", "Вступление", "Затемнение, надпись, проявка арта")}<label>Стиль анимации</label>${seg("style", [["curtain", "Занавес"], ["develop", "Проявка"], ["none", "Без анимации"]])}
   <label>Длительность вступления: <b id="dv">${v.duration} с</b></label><input type="range" min="2" max="12" step="1" value="${v.duration}" id="dur">
   <label>Полное вступление</label>${seg("full", [["daily", "Раз в день"], ["always", "Всегда"]])}<div class="mu small" style="margin-top:6px">Повторные открытия в тот же день — короткая версия (1–2 с)</div>
   ${sw("skip", "Кнопка «Пропустить»")}${sw("strip", "Лента миниатюр внизу")}</div>
  <div class="card"><b>Тексты</b><label>Текст вступления</label><input type="text" id="vt" value="${esc(v.text)}"><label>Текст для паков с уровнем</label><input type="text" id="vtl" value="${esc(v.text_locked)}"><div class="mu small" style="margin-top:6px">Если пусто — используется текст вступления</div></div>
  <div class="card"><b>Арт вступления</b><div class="mu small">Необязательно. Появляется вместе с текстом</div><div class="r" style="margin-top:10px"><span class="ava" style="width:72px;height:72px;${v.art ? `background-image:url('${pub(v.art, "media")}')` : "background:#555"}"></span>
   <label class="gb sm" style="margin:0;color:var(--fg)">⬆ Загрузить и обрезать<input type="file" id="artf" accept="image/*" class="hide"></label>${v.art ? `<a class="gb sm" id="artdel">Убрать</a>` : ""}</div></div></div><div>
  <div class="card"><b>Музыка</b>${sw("music_on", "Музыка при открытии поста", "Плавно включается при нажатии на пост. Кнопка 🎵 в просмотре — выключить звук")}
   <label>Общий трек (для всех паков)</label>${v.track ? `<div class="trk">🎵 ${esc(tname(v.track))}<a class="mu" id="trdel" style="margin-left:auto">✕</a></div>` : `<div class="mu small">Не загружен — играет мягкий встроенный эмбиент</div>`}
   <label class="gb full" style="margin-top:8px;color:var(--fg)">⬆ Загрузить трек (mp3, m4a, ogg до 20 МБ)<input type="file" id="trf" accept="audio/*" class="hide"></label><div class="mu small" id="trst"></div>
   <label>Свой трек для пака</label><select id="pk">${(ps || []).map(p => `<option value="${p.id}">${esc(p.title)} — ${v.tracks[p.id] ? "🎵 " + esc(tname(v.tracks[p.id])) : "общий трек"}</option>`).join("")}</select>
   <div class="r" style="margin-top:8px"><label class="gb sm" style="margin:0;color:var(--fg)">⬆ Трек для пака<input type="file" id="pkf" accept="audio/*" class="hide"></label><a class="gb sm" id="pkdel">Вернуть общий</a></div>
   <label>Громкость по умолчанию: <b id="vv">${v.volume}%</b></label><input type="range" min="0" max="100" value="${v.volume}" id="vol"></div>
  <button class="ob full" id="pv">▶ Предпросмотр вживую</button><div class="row-btn"><button class="gb" id="rs">Сбросить</button><button class="ob" id="sv">Сохранить</button></div></div></div>`);
  const q = s => app.querySelector(s);
  const keep = () => { v.text = q("#vt").value; v.text_locked = q("#vtl").value; v.duration = +q("#dur").value; v.volume = +q("#vol").value; };
  app.querySelectorAll("[data-seg]").forEach(b => b.onclick = () => { keep(); v[b.dataset.seg] = b.dataset.val; draw(); });
  app.querySelectorAll("[data-sw]").forEach(b => b.onclick = () => { keep(); v[b.dataset.sw] = !v[b.dataset.sw]; draw(); });
  q("#dur").oninput = e => q("#dv").textContent = e.target.value + " с"; q("#vol").oninput = e => q("#vv").textContent = e.target.value + "%";
  const upAudio = async (f, pre) => { if (f.size > 20 * 1048576) { toast("Файл больше 20 МБ"); return null; } q("#trst").textContent = "Загружаю " + f.name + "…";
    const path = `${pre}/${Date.now()}-${encodeURIComponent(f.name.replace(/[^\w.\-]+/g, "_"))}`; const r = await ys("media").upload(path, f, { contentType: f.type || "audio/mpeg" });
    if (r.error) { q("#trst").textContent = "Ошибка: " + r.error.message; return null; } return path; };
  q("#trf").onchange = async e => { const f = e.target.files[0]; if (!f) return; keep(); const p = await upAudio(f, "tracks"); if (p) { v.track = p; draw(); toast("Трек загружен — не забудьте «Сохранить»"); } };
  q("#trdel") && (q("#trdel").onclick = () => { keep(); v.track = null; draw(); });
  q("#pkf").onchange = async e => { const f = e.target.files[0]; if (!f) return; keep(); const id = q("#pk").value; const p = await upAudio(f, "tracks/" + id); if (p) { v.tracks[id] = p; draw(); q("#pk").value = id; } };
  q("#pkdel").onclick = () => { keep(); const id = q("#pk").value; delete v.tracks[id]; draw(); q("#pk").value = id; };
  q("#artf").onchange = async e => { const f = e.target.files[0]; if (!f) return; keep(); const img = await Crop.loadImg(f);
    const r = await Crop.open(img, { title: "Арт вступления · круг", aspect: 1, round: true, outW: 400, outH: 400, previews: [{ w: 150, h: 150, round: 1, label: "Как во вступлении" }] }); if (!r) return;
    const path = `intro/${Date.now()}.jpg`; const u = await ys("media").upload(path, r.blob, { contentType: "image/jpeg" }); if (u.error) return toast(u.error.message); v.art = path; draw(); };
  q("#artdel") && (q("#artdel").onclick = () => { keep(); v.art = null; draw(); });
  q("#rs").onclick = () => { if (!confirm("Вернуть настройки по умолчанию?")) return; Object.assign(v, D, { tracks: {} }); draw(); };
  q("#sv").onclick = async () => { keep(); const { error } = await sb.from("settings").upsert({ key: "viewer", value: v }); toast(error ? "Ошибка: " + error.message : "Сохранено"); if (!error) { S.viewer = { ...v }; ev("Изменён режим просмотра"); } };
  q("#pv").onclick = () => { keep(); const p = S.posts.find(x => x.tier_rank <= S.rank) || S.posts[0]; if (!p) return toast("Нет постов для предпросмотра");
    const saved = S.viewer; S.viewer = { ...v, full: "always" }; const imgs = M().fn("unlock", { post_id: p.id }).then(r => r.data.images.map(i => M().B + i.url));
    window.MiaViewer.open(p, imgs, {}); setTimeout(() => S.viewer = saved, 500); };
  };
  draw();
}
async function logTab(app) {
  const { sb, esc } = M(); const { data } = await sb.from("admin_log").select("at,event").order("at", { ascending: false }).limit(200);
  app.innerHTML = shell("log", `<h2>Журнал</h2><div class="tw"><table><tr><th>Когда</th><th>Событие</th></tr>${(data || []).map(r => `<tr><td style="white-space:nowrap">${new Date(r.at).toLocaleString("ru-RU")}</td><td>${esc(r.event)}</td></tr>`).join("") || `<tr><td colspan="2" class="mu">Пусто</td></tr>`}</table></div>`);
}
window.MiaAdmin = { _autoVariants: (...a) => autoVariants(...a), async render(tab, arg) { const app = document.getElementById("app");
  const f = { posts: () => posts(app, arg || "all"), new: () => newPost(app), newvideo: () => newPost(app, "video"), tiers: () => tiersTab(app), pick: () => pickTab(app), comments: () => commentsTab(app, arg || "new"), users: () => usersTab(app), author: () => authorTab(app), texts: () => textsTab(app), viewer: () => viewerTab(app), log: () => logTab(app) }[tab] || (() => posts(app));
  await f(); } };
})();
