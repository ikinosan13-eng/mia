// yc_migrate: переносит оригиналы из Supabase Storage (originals) в Yandex Object Storage privat/originals/<path>,
// по желанию media (intro/tracks) → mia-previews/media/<path>. Только для админа. Verify JWT: ВКЛ.
// Вход: { from?: number, size?: number (≤5, сервер режет сам), media?: boolean }  Ответ: { copied, skipped, failed, total, next, remaining }
// Секреты: YC_KEY_ID, YC_SECRET (+ уже есть SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AwsClient } from "npm:aws4fetch@1.0.20"; // лёгкая подпись SigV4 вместо тяжёлого aws-sdk
import { runBatch, privatIsPublic, type Job } from "./core.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const yc = new AwsClient({ accessKeyId: Deno.env.get("YC_KEY_ID")!, secretAccessKey: Deno.env.get("YC_SECRET")!, service: "s3", region: "ru-central1" });
const ycUrl = (b: string, k: string) => `https://storage.yandexcloud.net/${b}/${k.split("/").map(encodeURIComponent).join("/")}`;
const T = (ms: number) => AbortSignal.timeout(ms);
Deno.serve(async req => {
  if (req.method == "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!, admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""); if (!jwt) return j(401, { error: "login" });
    const { data: { user } } = await admin.auth.getUser(jwt); if (!user) return j(401, { error: "login" });
    const { data: a } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(); if (!a) return j(403, { error: "forbidden" });
    if (await privatIsPublic((u, o) => fetch(u, { ...o, signal: T(10000) })).catch(() => { throw new Error("Яндекс не ответил, попробуй ещё раз"); })) return j(409, { error: "privat открыт всем — закрой доступ" });
    const { from = 0, size = 20, media = false } = await req.json().catch(() => ({}));
    const { data: ims, error } = await admin.from("post_images").select("original_path").not("original_path", "is", null).order("original_path"); if (error) throw error;
    const jobs: Job[] = [...new Set((ims || []).map(i => i.original_path as string))].map(p => ({ src: "originals", path: p, dst: `originals/${p}`, bucket: "privat" }));
    if (media) { const { data: st } = await admin.from("settings").select("value").eq("key", "viewer").maybeSingle(); const v = st?.value || {};
      for (const p of [v.art, v.track, ...Object.keys(v.tracks || {})].filter(Boolean)) jobs.push({ src: "media", path: p, dst: `media/${p}`, bucket: "mia-previews" }); }
    const sizeOf = async (b: string, p: string) => { const d = p.split("/"), name = d.pop()!; const { data } = await admin.storage.from(b).list(d.join("/"), { search: name, limit: 5 });
      const f = (data || []).find(x => x.name == name); return f ? Number(f.metadata?.size ?? null) : null; };
    const r = await runBatch(jobs, Number(from) || 0, Math.min(5, Math.max(1, Number(size) || 5)), {
      srcSize: jb => sizeOf(jb.src, jb.path),
      dstSize: async jb => { const r = await yc.fetch(ycUrl(jb.bucket, jb.dst), { method: "HEAD", signal: T(15000) }); if (r.status == 404) return null; if (!r.ok) throw new Error(`yc head ${r.status}`); return Number(r.headers.get("content-length")); },
      copy: async jb => { const { data: blob, error } = await admin.storage.from(jb.src).download(jb.path); if (error || !blob) throw error || new Error("download");
        const h: Record<string, string> = { "content-type": blob.type || "application/octet-stream" }; if (jb.bucket == "mia-previews") h["cache-control"] = "public,max-age=31536000,immutable";
        const r = await yc.fetch(ycUrl(jb.bucket, jb.dst), { method: "PUT", headers: h, body: new Uint8Array(await blob.arrayBuffer()), signal: T(60000) }); if (!r.ok) throw new Error(`yc put ${r.status}`); },
    });
    return j(200, r);
  } catch (e) { return j(500, { error: String((e as Error).message || e) }); }
});
