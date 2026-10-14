# Yandex Object Storage (ветка yandex-storage, НЕ задеплоено)
- Превью/WebP: публичный бакет mia-previews, тот же путь, что в Supabase previews (config.js PREVIEW_BASE). Пусто → старый Supabase.
- Оригиналы: приватный бакет privat, ключ originals/<original_path>; pack_images и free_arts подписывают SigV4 на 1 ч (_shared/yc.ts).
- Функция unlock в репозитории отсутствует (задеплоена только в Supabase) — её нужно перевести так же (signOriginals).
- Сайт принимает и абсолютные (Яндекс), и относительные (/storage/v1/...) ссылки — можно деплоить по частям.
- Секреты функций (имена): YC_KEY_ID, YC_SECRET, опционально YC_ORIGINALS_BUCKET (по умолчанию privat). Уже есть: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
- Админка (admin.js) пока грузит в Supabase — новые арты/WebP после переезда нужно либо дублировать в Яндекс, либо перевести загрузку (отдельный этап).

## yc_migrate + кнопка «Перенести в Яндекс» (не задеплоено)
- Функция supabase/functions/yc_migrate (Verify JWT: ВКЛ): только админ (таблица admins), отказ 409 если privat
  анонимно отдаёт список (200) — «privat открыт всем — закрой доступ». Пачки ≤20, пропуск если размер совпадает.
  Список: post_images.original_path → privat/originals/<path>; media: settings.viewer art/track(s) → mia-previews/media/<path>.
- Тест логики: npx esbuild supabase/functions/yc_migrate/core.ts --format=esm --outfile=tests/core.mjs && node tests/yc_migrate.test.mjs

## Чек-лист деплоя
1. Яндекс: privat → Публичный доступ: всё «Ограниченный» (проверка: curl https://privat.storage.yandexcloud.net/ → 403).
2. Supabase → Edge Functions → Secrets: YC_KEY_ID, YC_SECRET.
3. Деплой функций: yc_migrate (Verify JWT ON). Сайт (admin.js) с кнопкой — выкатить.
4. Админ жмёт «Перенести в Яндекс» до «Готово», проверяем количество в privat.
5. Деплой pack_images, free_arts (подпись Яндекса); перевести unlock (исходника нет в репо — нужен экспорт из дашборда).
6. Выкатить сайт с PREVIEW_BASE. Supabase-файлы не удалять до проверки.
7. После переезда: admin.js грузит новые файлы ещё в Supabase — отдельный этап.

## unlock / pack_images / free_arts → Яндекс (ветка yandex-storage, не в main)
- `_shared/yc.ts`: aws4fetch `signQuery` GET на 1 ч → `https://storage.yandexcloud.net/privat/originals/<path>?X-Amz-…` (без signed headers, работает в <img>).
- unlock: логика кода/токена/HMAC без изменений; только подпись оригиналов через Яндекс. Verify JWT: ВЫКЛ.
- Бандлы для дашборда: /workspace/yandex/single/{unlock,pack_images,free_arts}.ts и http://127.0.0.1:8765/<name>.ts
- Сайт v30 на ветке: PREVIEW_BASE включён. В main не пушить до «ок».

### Порядок деплоя
1. Секреты YC_KEY_ID / YC_SECRET уже есть. unlock дополнительно: SB_SECRET_KEY, UNLOCK_HMAC_SECRET (уже стоят).
2. Вставить бандлы в дашборд: сначала unlock (JWT OFF), pack_images (JWT ON), free_arts (JWT OFF).
3. Проверить POST unlock без post_id → rank; с валидным доступом + post_id → images с URL на storage.yandexcloud.net.
4. Потом выкатить сайт v30 (main): PREVIEW_BASE + abs().

### Откат
- Функции: вставить старый unlock из git `66d60a5:supabase/functions/unlock/index.ts` (Supabase sign); pack_images/free_arts — из main до переезда (createSignedUrls).
- Сайт: убрать PREVIEW_BASE или поставить "" и откатить app.js abs/pub; version bump.
- Файлы в Яндексе и Supabase не удалять.

## v31 (ветка yandex-uploads): загрузки админки в Яндекс
- Функция yc_upload (Verify JWT: ВКЛ, только админ): { action: put|get|delete, items: [{ bucket: originals|previews|media, path, contentType }] } → подписанные ссылки (put/get 10 мин, delete 5 мин).
  originals → privat/originals/<path>, previews → mia-previews/<path>, media → mia-previews/media/<path>. mia31313 не используется.
- admin.js: ys(bucket).upload/remove/download вместо supabase.storage; remove также чистит старый Supabase, download падает обратно на Supabase.
- Сайт: pub(…, "media") → mia-previews/media/<path>; запасной путь на Supabase (аудио onerror, фон — второй слой url()).
- CORS Яндекса (privat, mia-previews): GET, HEAD, PUT, DELETE с https://ikinosan13-eng.github.io.
- Content-Type не входит в подпись (aws4fetch его не подписывает) — его задаёт только админ; Cache-Control для публичных подписан.
Деплой: 1) yc_upload из /workspace/yandex/single/yc_upload.ts (JWT ВКЛ). 2) Сайт v31 (main). Откат: вернуть main на коммит v30, функцию можно оставить.
