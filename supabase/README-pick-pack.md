# «1 пак на выбор» — как включить

Сайт (код в этой ветке) работает и без миграции: пока функций в базе нет, кнопки «1 пак на выбор» просто не активируются
(вызовы `my_pick_access` тихо игнорируются; ввод кода покажет ошибку сети).

## 1. База (один раз, владелец проекта)
1. Supabase → проект `oobbgppqkqydqqcaffpg` → **SQL Editor** → New query.
2. Вставить целиком `supabase/migrations/20261014_pick_pack.sql` → **Run**. Повторный запуск безопасен.
   Создаёт таблицы `pick_codes`, `pack_credits`, `pack_unlocks`, `pick_attempts` (RLS включён) и функции
   `redeem_pick_code`, `use_pack_credit`, `my_pick_access`, `admin_create_pick_codes`, `admin_pick_codes`.
   Использует существующие `posts(id,title,status)`, `profiles(id,username)`, `admins(user_id)`.

## 2. Edge-функция `pack_images` (выдаёт арты паков, открытых через выбор)
Вариант А (Supabase CLI, после `supabase login` своим аккаунтом): `supabase functions deploy pack_images --project-ref oobbgppqkqydqqcaffpg`
Вариант Б (дашборд): Edge Functions → Deploy a new function → имя `pack_images` → вставить `supabase/functions/pack_images/index.ts` → Deploy.
Существующую функцию `unlock` менять не нужно.

## 3. Сайт
Выложить ветку (версия 21). Админка → «🎁 1 пак на выбор» → «Выпустить коды» → раздать покупателям.
Ссылка «Купить код, мяу ↗» берётся из `profile.pick_url`. Задаётся в админке → «🎁 1 пак на выбор» → «Ссылка на оплату» (если пусто — Boosty из config.js).
