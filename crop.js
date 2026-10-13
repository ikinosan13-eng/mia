// Простой редактор обрезки: рамка фиксирована, картинку двигают и масштабируют.
// Оригинал не меняется: наружу отдаётся только рамка {x,y,w,h} (доли 0..1) и превью-картинка.
(() => {
function mount(box, img, o = {}) {
  const aspect = o.aspect || 1, round = !!o.round;
  box.innerHTML = `<div class="cr-stage"><canvas></canvas></div><div class="cr-tools"><span>🔍</span><input type="range" min="1" max="5" step="0.01" value="1" class="cr-z"><button type="button" class="gb sm cr-c">По центру</button><button type="button" class="gb sm cr-r">Сбросить</button></div><div class="mu small">Тяните картинку, колесо или щипок — масштаб. Оригинал не меняется.</div>`;
  const stage = box.querySelector(".cr-stage"), cv = box.querySelector("canvas"), z = box.querySelector(".cr-z");
  let W, Hh, FW, FH, FX, FY, s0, k = 1, ox = 0, oy = 0, im = img;
  function layout() {
    W = stage.clientWidth || 480; Hh = Math.round(Math.min(W / aspect + 40, o.maxH || 420)); const dpr = devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = Hh * dpr; cv.style.width = W + "px"; cv.style.height = Hh + "px"; cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 20; FW = Math.min(W - pad * 2, (Hh - pad * 2) * aspect); FH = FW / aspect; FX = (W - FW) / 2; FY = (Hh - FH) / 2;
    s0 = Math.max(FW / im.width, FH / im.height);
  }
  const sc = () => s0 * k;
  function clamp() { const s = sc(); ox = Math.min(0, Math.max(FW - im.width * s, ox)); oy = Math.min(0, Math.max(FH - im.height * s, oy)); }
  function center() { const s = sc(); ox = (FW - im.width * s) / 2; oy = (FH - im.height * s) / 2; clamp(); }
  function setCrop(c) { // c: fractions
    if (!c) { k = 1; center(); return; }
    const s = FW / (c.w * im.width); k = Math.max(1, s / s0); ox = -c.x * im.width * sc(); oy = -c.y * im.height * sc(); clamp();
  }
  function draw() {
    const x = cv.getContext("2d"), s = sc(); x.clearRect(0, 0, W, Hh); x.fillStyle = "#222"; x.fillRect(0, 0, W, Hh);
    x.drawImage(im, FX + ox, FY + oy, im.width * s, im.height * s);
    x.save(); x.fillStyle = "rgba(0,0,0,.6)"; x.beginPath(); x.rect(0, 0, W, Hh);
    if (round) x.arc(FX + FW / 2, FY + FH / 2, FW / 2, 0, Math.PI * 2, true); else { x.moveTo(FX, FY); x.lineTo(FX, FY + FH); x.lineTo(FX + FW, FY + FH); x.lineTo(FX + FW, FY); x.closePath(); }
    x.fill("evenodd"); x.restore();
    x.strokeStyle = "#fff"; x.lineWidth = 2; if (round) { x.beginPath(); x.arc(FX + FW / 2, FY + FH / 2, FW / 2, 0, Math.PI * 2); x.stroke(); } else x.strokeRect(FX, FY, FW, FH);
    x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1; x.beginPath();
    for (const t of [1 / 3, 2 / 3]) { x.moveTo(FX + FW * t, FY); x.lineTo(FX + FW * t, FY + FH); x.moveTo(FX, FY + FH * t); x.lineTo(FX + FW, FY + FH * t); } x.stroke();
    if (o.safe) { x.setLineDash([5, 4]); x.strokeStyle = "#ffd54f"; const sw = FH * o.safe; x.strokeRect(FX + (FW - sw) / 2, FY, sw, FH); x.setLineDash([]); }
    z.value = k; o.onChange && o.onChange(api);
  }
  function zoomTo(nk, cx = FW / 2, cy = FH / 2) { const s1 = sc(); k = Math.min(5, Math.max(1, nk)); const s2 = sc(); ox = cx - (cx - ox) * s2 / s1; oy = cy - (cy - oy) * s2 / s1; clamp(); draw(); }
  const pts = new Map(); let last = null, dist0 = 0, k0 = 1;
  cv.style.touchAction = "none";
  cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; if (pts.size == 2) { const [a, b] = [...pts.values()]; dist0 = Math.hypot(a[0] - b[0], a[1] - b[1]); k0 = k; } });
  cv.addEventListener("pointermove", e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size == 2) { const [a, b] = [...pts.values()]; zoomTo(k0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / dist0); return; }
    ox += e.clientX - last[0]; oy += e.clientY - last[1]; last = [e.clientX, e.clientY]; clamp(); draw(); });
  const up = e => { pts.delete(e.pointerId); const r = [...pts.values()][0]; if (r) last = r; };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("wheel", e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomTo(k * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left - FX, e.clientY - r.top - FY); }, { passive: false });
  z.oninput = () => zoomTo(+z.value);
  box.querySelector(".cr-c").onclick = () => { center(); draw(); };
  box.querySelector(".cr-r").onclick = () => { k = 1; center(); draw(); };
  const api = {
    getCrop() { const s = sc(); const c = { x: -ox / s / im.width, y: -oy / s / im.height, w: FW / s / im.width, h: FH / s / im.height }; for (const q in c) c[q] = Math.round(c[q] * 1e4) / 1e4; return c; },
    drawTo(canvas, w, h, crop) { const c = crop || api.getCrop(); canvas.width = w; canvas.height = h; const x = canvas.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(im, c.x * im.width, c.y * im.height, c.w * im.width, c.h * im.height, 0, 0, w, h); return canvas; },
    toBlob(w, h, q = 0.86, crop) { const c = api.drawTo(document.createElement("canvas"), w, h, crop); return new Promise(r => c.toBlob(r, "image/jpeg", q)); },
    setImage(ni, crop) { im = ni; layout(); setCrop(crop); draw(); }, setCrop(c) { setCrop(c); draw(); }, img: () => im,
  };
  layout(); setCrop(o.crop); draw();
  new ResizeObserver(() => { const c = api.getCrop(); layout(); setCrop(c); draw(); }).observe(stage);
  return api;
}
// Модальное окно: превью-размеры справа
function open(img, o = {}) {
  return new Promise(res => {
    const d = document.createElement("div"); d.className = "ov"; d.innerHTML = `<div class="sheet wide-sheet"><a class="x">✕</a><h2>${o.title || "Обрезка"}</h2><div class="cr-wrap"><div class="cr-box"></div><div class="cr-prev">${(o.previews || []).map((p, i) => `<div class="cr-p"><canvas data-p="${i}" style="width:${p.w}px;height:${p.h}px;${p.round ? "border-radius:50%" : "border-radius:8px"}"></canvas><div class="mu small">${p.label}</div></div>`).join("")}</div></div><div class="row-btn"><button class="gb" data-x>Отмена</button><button class="ob" data-ok>Готово</button></div></div>`;
    document.body.append(d);
    const api = mount(d.querySelector(".cr-box"), img, { ...o, onChange: a => d.querySelectorAll("[data-p]").forEach(c => { const p = o.previews[c.dataset.p]; a.drawTo(c, p.w * 2, p.h * 2); }) });
    const close = v => { d.remove(); res(v); };
    d.querySelector(".x").onclick = d.querySelector("[data-x]").onclick = () => close(null);
    d.querySelector("[data-ok]").onclick = async () => close({ crop: api.getCrop(), blob: await api.toBlob(o.outW || 512, o.outH || 512, 0.88) });
  });
}
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src instanceof Blob ? URL.createObjectURL(src) : src; });
window.Crop = { mount, open, loadImg };
})();
