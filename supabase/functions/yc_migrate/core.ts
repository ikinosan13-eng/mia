// Чистая логика переноса (тестируется без сети): батч, пропуск по размеру, сводка.
export type Job = { src: "originals" | "media"; path: string; dst: string; bucket: string };
export type IO = {
  srcSize(j: Job): Promise<number | null>;          // размер в Supabase (null = нет файла)
  dstSize(j: Job): Promise<number | null>;          // размер в Яндексе (null = нет)
  copy(j: Job): Promise<void>;                      // скачать из Supabase и положить в Яндекс
};
export async function runBatch(jobs: Job[], from: number, size: number, io: IO) {
  const part = jobs.slice(from, from + size); let copied = 0, skipped = 0; const failed: { path: string; error: string }[] = [];
  for (const j of part) {
    try {
      const [s, d] = await Promise.all([io.srcSize(j), io.dstSize(j)]);
      if (s != null && d === s) { skipped++; continue; }
      await io.copy(j); copied++;
    } catch (e) { failed.push({ path: `${j.src}/${j.path}`, error: String((e as Error).message || e).slice(0, 200) }); }
  }
  const next = from + part.length;
  return { copied, skipped, failed, total: jobs.length, next, remaining: Math.max(0, jobs.length - next) };
}
// privat должен быть закрыт: анонимный список объектов обязан давать 401/403.
export async function privatIsPublic(f: typeof fetch = fetch, bucket = "privat") {
  const r = await f(`https://${bucket}.storage.yandexcloud.net/?max-keys=1`, { method: "GET" }); await r.body?.cancel();
  return r.status == 200;
}
