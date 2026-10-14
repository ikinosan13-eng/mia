// Edge Function "unlock": verifies a tier code (or a previously issued token)
// and returns 1-hour signed URLs for originals of a post the visitor may see.
import { signOriginals } from "../_shared/yc.ts";
const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SB_SECRET_KEY")!;          // sb_secret_..., set as function secret
const HMAC = Deno.env.get("UNLOCK_HMAC_SECRET")!;
const MAX_FAILS = 8, WINDOW_MIN = 10, TOKEN_DAYS = 30, SIGN_SEC = 3600;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const H = { apikey: KEY, "Content-Type": "application/json" };
const rest = (p: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${p}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
const rpc = async (fn: string, args: unknown) => (await rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) })).json();
const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function hmac(data: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(HMAC), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data))));
}
function safeEq(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function makeToken(rank: number, versions: Record<string, number>) {
  const v: Record<string, number> = {}; for (const [r, n] of Object.entries(versions)) if (+r > 0 && +r <= rank) v[r] = n;
  const body = b64u(enc.encode(JSON.stringify({ r: rank, v, exp: Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400 })));
  return `${body}.${await hmac(body)}`;
}
async function readToken(t: string, versions: Record<string, number>): Promise<number | null> {
  const [body, sig] = (t || "").split("."); if (!body || !sig || !safeEq(sig, await hmac(body))) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
    if (p.exp < Date.now() / 1000) return null;
    for (const [r, n] of Object.entries(p.v || {})) if (versions[r] !== n) return null; // code rotated
    return p.r;
  } catch { return null; }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ error: "method" }, 405);
  let b: { code?: string; token?: string; post_id?: string } = {};
  try { b = await req.json(); } catch { /* empty */ }
  const ip = (req.headers.get("x-forwarded-for") || "?").split(",")[0].trim();
  const versions = await rpc("tier_versions", {});
  let rank = 0, token: string | undefined;
  if (b.code) {
    const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
    const r = await rest(`unlock_attempts?select=id&ip=eq.${encodeURIComponent(ip)}&ok=eq.false&at=gte.${since}`, { headers: { Prefer: "count=exact", Range: "0-0" } });
    const fails = +(r.headers.get("content-range")?.split("/")[1] || 0);
    if (fails >= MAX_FAILS) return j({ error: "rate_limited", message: "Слишком много попыток. Попробуйте через 10 минут." }, 429);
    const m = await rpc("verify_tier_code", { p_code: String(b.code).slice(0, 64) });
    const ok = Array.isArray(m) && m.length > 0;
    await rest("unlock_attempts", { method: "POST", body: JSON.stringify({ ip, ok }) });
    if (!ok) return j({ error: "bad_code", message: "Неверный код" }, 401);
    rank = m[0].rank; token = await makeToken(rank, versions);
  } else if (b.token) {
    const r = await readToken(b.token, versions);
    if (r === null && !(req.headers.get("authorization") || "").startsWith("Bearer ey")) return j({ error: "bad_token", message: "Код устарел, введите новый" }, 401);
    rank = r ?? 0;
  }
  // logged-in visitor: bind tier to profile (versioned)
  let user: { id: string } | null = null;
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ey")) {
    const ur = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: auth } });
    if (ur.ok) user = await ur.json();
  }
  if (user && ((await (await rest(`admins?user_id=eq.${user.id}&select=user_id`)).json()) as unknown[]).length) rank = 32767;
  else if (user) {
    const pr = await (await rest(`profiles?id=eq.${user.id}&select=tier_rank,tier_version`)).json();
    const prof = pr[0];
    if (prof) {
      if (b.code && rank > 0 && rank >= (prof.tier_rank || 0)) {
        await rest(`profiles?id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ tier_rank: rank, tier_version: versions[String(rank)] }) });
      } else if (prof.tier_rank > 0) {
        if (versions[String(prof.tier_rank)] === prof.tier_version) rank = Math.max(rank, prof.tier_rank);
        else await rest(`profiles?id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ tier_rank: 0, tier_version: 0 }) }); // code rotated → revoked
      }
    }
  }
  const out: Record<string, unknown> = { rank, token, account: !!user };
  if (b.post_id && /^[0-9a-f-]{36}$/.test(b.post_id)) {
    const posts = await (await rest(`feed_public?id=eq.${b.post_id}&select=id,tier_rank`)).json();
    if (!posts.length) return j({ error: "not_found" }, 404);
    if (posts[0].tier_rank > rank) return j({ ...out, error: "locked", need_rank: posts[0].tier_rank }, 403);
    const imgs = await (await rest(`post_images?post_id=eq.${b.post_id}&select=position,original_path,width,height&order=position`)).json();
    const signed = await signOriginals(imgs.map((i: any) => i.original_path), SIGN_SEC);
    // абсолютные URL Яндекса (сайт принимает через abs()); Verify JWT у unlock — ВЫКЛ
    out.images = imgs.map((i: any, k: number) => ({ position: i.position, width: i.width, height: i.height, url: signed[k] || null }));
  }
  return j(out);
});
