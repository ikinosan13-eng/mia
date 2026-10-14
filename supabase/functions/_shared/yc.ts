// Подписанные GET (SigV4 query) на originals в Yandex Object Storage.
// Ссылка работает в <img> без доп. заголовков. Секреты: YC_KEY_ID, YC_SECRET.
import { AwsClient } from "npm:aws4fetch@1.0.20";
const yc = () => new AwsClient({ accessKeyId: Deno.env.get("YC_KEY_ID")!, secretAccessKey: Deno.env.get("YC_SECRET")!, service: "s3", region: "ru-central1" });
const BUCKET = () => Deno.env.get("YC_ORIGINALS_BUCKET") || "privat";
const keyUrl = (path: string) => `https://storage.yandexcloud.net/${BUCKET()}/originals/${path.split("/").map(encodeURIComponent).join("/")}`;
export async function signOriginal(path: string, expiresIn = 3600): Promise<string> {
  const r = await yc().sign(`${keyUrl(path)}?X-Amz-Expires=${expiresIn}`, { method: "GET", aws: { signQuery: true } });
  return r.url;
}
export const signOriginals = (paths: string[], expiresIn = 3600) => Promise.all(paths.map(p => signOriginal(p, expiresIn)));
// Видео: подписанная ссылка живёт 3 ч (долгий просмотр + перемотка Range-запросами), арты — 1 ч.
export const VIDEO_SEC = 10800;
export const VCOLS = "kind,duration_sec,poster_path";
export type Row = { original_path: string; position?: number; width?: number; height?: number; kind?: string | null; duration_sec?: number | null; poster_path?: string | null };
export async function signRows(rows: Row[], imgSec = 3600) {
  const urls = await Promise.all(rows.map(r => signOriginal(r.original_path, r.kind == "video" ? VIDEO_SEC : imgSec)));
  return rows.map((r, k) => ({ position: r.position, width: r.width, height: r.height, url: urls[k] || null,
    ...(r.kind == "video" ? { kind: "video", duration: r.duration_sec ?? null, poster: r.poster_path ?? null } : {}) }));
}
