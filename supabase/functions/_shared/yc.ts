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
