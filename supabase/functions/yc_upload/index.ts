// yc_upload: подписанные ссылки Yandex Object Storage для админки. Verify JWT: ВКЛ, только админ.
// Вход: { action: "put" | "get" | "delete", items: [{ bucket: "originals" | "previews" | "media", path, contentType? }] }
// Ответ: { urls: [{ url, headers }] } — headers нужно отправить ровно такими (они в подписи).
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
const okPath = (p: unknown): p is string => typeof p == "string" && p.length > 0 && p.length < 400 && !p.startsWith("/") && !p.split("/").some(s => s == ".." || s == ".") && !/[\0-\x1f\\]/.test(p);
Deno.serve(async req => {
  if (req.method == "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!, admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""); if (!jwt) return j(401, { error: "login" });
    const { data: { user } } = await admin.auth.getUser(jwt); if (!user) return j(401, { error: "login" });
    const { data: a } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(); if (!a) return j(403, { error: "forbidden" });
    const { action, items } = await req.json().catch(() => ({}));
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
