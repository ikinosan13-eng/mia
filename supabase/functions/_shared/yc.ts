// Подписанные (SigV4) ссылки на оригиналы в Yandex Object Storage, бакет privat, ключи originals/<original_path>.
// Секреты функций: YC_KEY_ID, YC_SECRET (статический ключ сервисного аккаунта с ролью только на чтение privat).
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";
const s3 = new S3Client({
  region: "ru-central1", endpoint: "https://storage.yandexcloud.net",
  credentials: { accessKeyId: Deno.env.get("YC_KEY_ID")!, secretAccessKey: Deno.env.get("YC_SECRET")! },
});
const BUCKET = Deno.env.get("YC_ORIGINALS_BUCKET") || "privat";
export const signOriginals = (paths: string[], expiresIn = 3600) =>
  Promise.all(paths.map(p => getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: `originals/${p}` }), { expiresIn })));
