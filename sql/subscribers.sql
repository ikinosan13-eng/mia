-- Счётчик подписчиков на главной (v37). Повторный запуск безопасен. Отдаёт ТОЛЬКО число, без id/имён.
-- Подписчик = аккаунт, у которого сейчас действует платный доступ:
--   (а) уровень по коду: profiles.tier_rank > 0 и profiles.tier_version совпадает с текущей версией кода этого уровня
--       (после смены кода unlock обнуляет доступ — такие не считаются), ИЛИ
--   (б) хотя бы один пак, открытый через «1 пак на выбор» (pack_unlocks).
-- Админы не считаются. Гости с кодом без аккаунта (токен в браузере) не считаются — их нельзя посчитать без личных данных.
create or replace function public.subscriber_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from (
    select pr.id as uid
      from public.profiles pr
      join public.tiers t on t.rank = pr.tier_rank
     where pr.tier_rank > 0 and pr.tier_version = t.code_version
    union
    select u.user_id from public.pack_unlocks u
  ) s
  where not exists (select 1 from public.admins a where a.user_id = s.uid);
$$;
revoke all on function public.subscriber_count() from public;
grant execute on function public.subscriber_count() to anon, authenticated;
-- Сайт вызывает GET /rest/v1/rpc/subscriber_count (stable-функция) → число.
-- ОТКАТ: drop function if exists public.subscriber_count();
