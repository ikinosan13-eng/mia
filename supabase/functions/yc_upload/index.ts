// yc_upload: подписанные ссылки Yandex Object Storage для админки. Verify JWT: ВКЛ, только админ.
// Вход: { action: "put" | "get" | "delete", items: [{ bucket: "originals" | "previews" | "media", path, contentType? }] }
// Ответ: { urls: [{ url, headers }] } — headers нужно отправить ровно такими (они в подписи).
// Видео (≤300 МБ, только video/mp4, только originals/videos/…): multipart —
//   { action: "mp_create", bucket: "originals", path, contentType: "video/mp4", size } → { uploadId, partSize, parts: [{ n, url }] } (PUT каждой части, 1 ч)
//   { action: "mp_complete", bucket, path, uploadId } → сервер сам берёт список частей (ListParts) и завершает; ETag браузеру не нужен
//   { action: "mp_abort", bucket, path, uploadId }
// originals → privat/originals/<path>; previews → mia-previews/<path>; media → mia-previews/media/<path>. mia31313 не трогаем.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AwsClient } from "npm:aws4fetch@1.0.20";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const MAP: Record<string, { bucket: string; prefix: string; pub: boolean }> = {
  originals: { bucket: "privat", prefix: "originals/", pub: false },
  previews: { bucket: "mia-previews", prefix: "", pub: true },
  media: { bucket: "mia-previews", prefix: "media/", pub: true },
};
const EXP: Record<string, number> = { put: 600, get: 600, delete: 300 };
const MAX_VIDEO = 300 * 1024 * 1024, PART = 16 * 1024 * 1024;
// multipart: originals/videos/<post>/<id>.mp4 (приватно) и previews/feedvid/<post>/<id>.mp4 (публичная копия ТОЛЬКО для открытых видео-постов, решает админка)
const okVideo = (b: string, p: string) => (b == "originals" && /^videos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp4$/.test(p)) || (b == "previews" && /^feedvid\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp4$/.test(p));
const tag = (x: string, t: string) => [...x.matchAll(new RegExp(`<${t}>([^<]*)</${t}>`, "g"))].map(m => m[1]);
const okPath = (p: unknown): p is string => typeof p == "string" && p.length > 0 && p.length < 400 && !p.startsWith("/") && !p.split("/").some(s => s == ".." || s == ".") && !/[\0-\x1f\\]/.test(p);
Deno.serve(async req => {
  if (req.method == "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!, admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""); if (!jwt) return j(401, { error: "login" });
    const { data: { user } } = await admin.auth.getUser(jwt); if (!user) return j(401, { error: "login" });
    const { data: a } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(); if (!a) return j(403, { error: "forbidden" });
    const body = await req.json().catch(() => ({})), { action, items } = body;
    if (String(action).startsWith("mp_")) return j(...await multipart(body));
    for (const it of items || []) if (action == "put" && it?.bucket == "originals" && String(it.path).startsWith("videos/")) return j(400, { error: "video_needs_multipart" });
    if (!EXP[action] || !Array.isArray(items) || !items.length || items.length > 50) return j(400, { error: "bad_request" });
    const yc = new AwsClient({ accessKeyId: Deno.env.get("YC_KEY_ID")!, secretAccessKey: Deno.env.get("YC_SECRET")!, service: "s3", region: "ru-central1" });
    const urls = [];
    for (const it of items) {
      const m = MAP[it?.bucket]; if (!m || !okPath(it.path)) return j(400, { error: "bad_item", item: it });
      const key = (m.prefix + it.path).split("/").map(encodeURIComponent).join("/");
      const headers: Record<string, string> = {};
      if (action == "put") {
        headers["content-type"] = String(it.contentType || "application/octet-stream").slice(0, 100);
        if (m.pub) headers["cache-control"] = "public,max-age=31536000,immutable";
      }
      const s = await yc.sign(`https://storage.yandexcloud.net/${m.bucket}/${key}?X-Amz-Expires=${EXP[action]}`, { method: action.toUpperCase(), headers, aws: { signQuery: true } });
      urls.push({ url: s.url, headers });
    }
    return j(200, { urls });
  } catch (e) { return j(500, { error: String((e as Error).message || e) }); }
});

async function multipart(b: any): Promise<[number, unknown]> {
  const { action, bucket, path, uploadId } = b;
  if (!okVideo(bucket, path)) return [400, { error: "bad_video_path" }];
  const yc = new AwsClient({ accessKeyId: Deno.env.get("YC_KEY_ID")!, secretAccessKey: Deno.env.get("YC_SECRET")!, service: "s3", region: "ru-central1" });
  const m = MAP[bucket], u = `https://storage.yandexcloud.net/${m.bucket}/${m.prefix}${path}`;
  const call = async (q: string, init: RequestInit = {}) => { const r = await yc.fetch(`${u}?${q}`, { ...init, signal: AbortSignal.timeout(20000) }); const t = await r.text(); if (!r.ok) throw new Error(`yc ${r.status} ${tag(t, "Code")[0] || ""}`); return t; };
  if (action == "mp_create") {
    const size = Number(b.size);
    if (b.contentType != "video/mp4") return [400, { error: "only_mp4" }];
    if (!(size > 0 && size <= MAX_VIDEO)) return [400, { error: "too_big", max: MAX_VIDEO }];
    const id = tag(await call("uploads", { method: "POST", headers: { "content-type": "video/mp4", ...(m.pub ? { "cache-control": "public,max-age=31536000,immutable" } : {}) } }), "UploadId")[0];
    if (!id) return [500, { error: "no_upload_id" }];
    const n = Math.ceil(size / PART), parts = [];
    for (let k = 1; k <= n; k++) parts.push({ n: k, url: (await yc.sign(`${u}?partNumber=${k}&uploadId=${encodeURIComponent(id)}&X-Amz-Expires=3600`, { method: "PUT", aws: { signQuery: true } })).url });
    return [200, { uploadId: id, partSize: PART, parts }];
  }
  if (!uploadId || typeof uploadId != "string") return [400, { error: "uploadId" }];
  const uid = encodeURIComponent(uploadId);
  if (action == "mp_abort") { await call(`uploadId=${uid}`, { method: "DELETE" }).catch(() => {}); return [200, { ok: true }]; }
  if (action == "mp_complete") {
    const x = await call(`uploadId=${uid}&max-parts=1000`);
    const nums = tag(x, "PartNumber"), etags = tag(x, "ETag"), sizes = tag(x, "Size").map(Number);
    const total = sizes.reduce((a, c) => a + c, 0);
    if (!nums.length) return [400, { error: "no_parts" }];
    if (total > MAX_VIDEO) { await call(`uploadId=${uid}`, { method: "DELETE" }).catch(() => {}); return [400, { error: "too_big" }]; }
    const xml = `<CompleteMultipartUpload>${nums.map((n, k) => `<Part><PartNumber>${n}</PartNumber><ETag>${etags[k]}</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
    await call(`uploadId=${uid}`, { method: "POST", body: xml, headers: { "content-type": "application/xml" } });
    return [200, { ok: true, size: total, parts: nums.length }];
  }
  return [400, { error: "bad_action" }];
}
