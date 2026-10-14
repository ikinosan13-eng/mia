// Сжатие видео и тизер в браузере админа: WebCodecs (H.264/AAC → MP4) через mediabunny (MPL-2.0, vendor/), грузится только в админке.
// H.264 — единственный кодек, который везде играет (Safari/iOS включительно) и везде кодируется в браузере; HEVC/AV1 не используем.
import * as MB from "./vendor/mediabunny-1.61.4.min.mjs";
const inp = f => new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
// размер по короткой стороне, только уменьшаем; чётные размеры для H.264
const fitTo = (w, h, s) => { const k = Math.min(1, s / Math.min(w, h)); return { width: Math.round(w * k / 2) * 2, height: Math.round(h * k / 2) * 2 }; };
async function run(file, { short, bitrate, fps, trim, audio, onp }) {
  const input = inp(file), vt = await input.getPrimaryVideoTrack(); if (!vt) throw new Error("нет видеодорожки");
  const sz = fitTo(vt.displayWidth, vt.displayHeight, short);
  const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: "in-memory" }), target: new MB.BufferTarget() });
  const conv = await MB.Conversion.init({ input, output, trim,
    video: { codec: "avc", ...sz, fit: "fill", bitrate, forceTranscode: true, keyFrameInterval: 2, ...(fps ? { frameRate: fps } : {}) },
    audio: audio ? { codec: "aac" } : { discard: true } }); // AAC копируется как есть (без перекодирования)
  const lost = conv.discardedTracks.filter(d => d.track.type == "audio"); if (audio && lost.length) throw new Error("audio");
  if (!conv.isValid) throw new Error("браузер не умеет кодировать H.264: " + conv.discardedTracks.map(d => d.reason).join(", "));
  if (onp) conv.onProgress = onp; await conv.execute();
  return { blob: new Blob([output.target.buffer], { type: "video/mp4" }), ...sz };
}
export const supported = () => typeof VideoEncoder != "undefined" && typeof VideoDecoder != "undefined";
// «почти то же качество»: короткая сторона ≤1080, ~3,5 Мбит/с (1080), ~2,2 (720), ~1,4 (меньше); если не стало меньше на 10 % — оставляем оригинал
export async function compress(file, onp) {
  const vt = await inp(file).getPrimaryVideoTrack(), s = Math.min(vt.displayWidth, vt.displayHeight, 1080);
  const bitrate = s >= 1000 ? 3.5e6 : s >= 700 ? 2.2e6 : 1.4e6;
  let r; try { r = await run(file, { short: 1080, bitrate, audio: true, onp }); } catch (e) { if (e.message == "audio") return { blob: file, compressed: false }; throw e; } // звук не AAC — не рискуем, оставляем оригинал
  return r.blob.size < file.size * 0.9 ? { blob: r.blob, compressed: true } : { blob: file, compressed: false };
}
// тизер: 4 с с кадра-обложки, короткая сторона 720, 24 к/с, без звука, ~0,6 Мбит/с (≈250–350 КБ)
export async function teaser(file, start = 0, dur = 4) {
  const d = await inp(file).computeDuration(), s0 = Math.max(0, Math.min(start, d - dur));
  return (await run(file, { short: 720, bitrate: 6e5, fps: 24, trim: { start: s0, end: Math.min(d, s0 + dur) }, audio: false })).blob;
}
// клип для профиля: dur с, с start, без звука, кадрирование по центру в w×h (аватар 320×320, шапка 1280×320)
export async function clip(file, start, dur, w, h, bitrate, crop) {
  const input = inp(file), d = await input.computeDuration(), s0 = Math.max(0, Math.min(start, d - dur));
  const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: "in-memory" }), target: new MB.BufferTarget() });
  const conv = await MB.Conversion.init({ input, output, trim: { start: s0, end: Math.min(d, s0 + dur) },
    video: { codec: "avc", width: w, height: h, fit: crop ? "fill" : "cover", ...(crop ? { crop } : {}), bitrate, forceTranscode: true, keyFrameInterval: 2, frameRate: 24 }, audio: { discard: true } });
  if (!conv.isValid) throw new Error("браузер не умеет кодировать H.264");
  await conv.execute(); return new Blob([output.target.buffer], { type: "video/mp4" });
}
