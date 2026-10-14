// free_arts: подписанные ссылки на оригиналы ТОЛЬКО тех артов, что админ отметил «Бесплатно 🐾».
// Доступно всем, даже без входа → при деплое через дашборд выключить «Verify JWT».
// Ответ: { images: [{ url, position }] } (url — абсолютная подписанная ссылка Yandex Object Storage, 1 ч, как у unlock/pack_images).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { signOriginals } from "../_shared/yc.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async req => {
  if (req.method == "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method != "POST") return j(405, { error: "method" });
  try {
    const { post_id } = await req.json().catch(() => ({})); if (!post_id || !UUID.test(post_id)) return j(400, { error: "post_id" });
    const url = Deno.env.get("SUPABASE_URL")!, admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: p } = await admin.from("posts").select("id").eq("id", post_id).eq("status", "published").lte("publish_at", new Date().toISOString()).maybeSingle();
    if (!p) return j(404, { error: "no_post" });
    const { data: ims, error } = await admin.from("post_images").select("original_path,position").eq("post_id", post_id).eq("is_free", true).order("position"); if (error) throw error;
    if (!ims?.length) return j(200, { images: [] });
    const signed = await signOriginals(ims.map(i => i.original_path), 3600);
    return j(200, { images: signed.map((u, k) => ({ url: u, position: ims[k].position })) });
  } catch (e) { return j(500, { error: String((e as Error).message || e) }); }
});
