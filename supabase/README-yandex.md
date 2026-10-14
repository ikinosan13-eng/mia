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
