// pack_images: подписанные ссылки на арты пака, открытого через «1 пак на выбор».
// Ответ в том же формате, что и unlock({post_id}): { images: [{ url }] } (url — абсолютная подписанная ссылка Yandex Object Storage, 1 ч).
// Деплой: supabase functions deploy pack_images  (секреты SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY уже есть в проекте).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { signRows, VCOLS } from "../_shared/yc.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method == "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { post_id } = await req.json(); if (!post_id) return j(400, { error: "post_id" });
    const url = Deno.env.get("SUPABASE_URL")!, admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""); if (!jwt) return j(401, { error: "login" });
    const { data: { user } } = await admin.auth.getUser(jwt); if (!user) return j(401, { error: "login" });
    const { data: un } = await admin.from("pack_unlocks").select("post_id").eq("user_id", user.id).eq("post_id", post_id).maybeSingle();
    if (!un) return j(403, { error: "locked" });
    const q = (cols: string) => admin.from("post_images").select(cols).eq("post_id", post_id).order("position");
    let { data: ims, error } = await q(`original_path,position,width,height,${VCOLS}`) as any;
    if (error) ({ data: ims, error } = await q("original_path,position,width,height") as any); // до video.sql
    if (error) throw error;
    return j(200, { images: await signRows(ims || []) });
  } catch (e) { return j(500, { error: String((e as Error).message || e) }); }
});
