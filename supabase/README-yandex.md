# Yandex Object Storage (ветка yandex-storage, НЕ задеплоено)
- Превью/WebP: публичный бакет mia-previews, тот же путь, что в Supabase previews (config.js PREVIEW_BASE). Пусто → старый Supabase.
- Оригиналы: приватный бакет privat, ключ originals/<original_path>; pack_images и free_arts подписывают SigV4 на 1 ч (_shared/yc.ts).
- Функция unlock в репозитории отсутствует (задеплоена только в Supabase) — её нужно перевести так же (signOriginals).
- Сайт принимает и абсолютные (Яндекс), и относительные (/storage/v1/...) ссылки — можно деплоить по частям.
- Секреты функций (имена): YC_KEY_ID, YC_SECRET, опционально YC_ORIGINALS_BUCKET (по умолчанию privat). Уже есть: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
- Админка (admin.js) пока грузит в Supabase — новые арты/WebP после переезда нужно либо дублировать в Яндекс, либо перевести загрузку (отдельный этап).
