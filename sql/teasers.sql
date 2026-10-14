-- Тизеры и полное видео в ленте (v35). Повторный запуск безопасен. Требует уже применённого sql/video.sql.
-- Существующие view feed_public / media_public / free_images_public / media_video_public не трогаем.
-- post_video_public пересоздаётся с ТЕМИ ЖЕ колонками в том же порядке + две новые в конце (create or replace это допускает, гранты сохраняются).
begin;
alter table public.post_images add column if not exists teaser_path text;      -- mia-previews/teasers/<post>/<id>.mp4 (4 с, без звука)
alter table public.posts add column if not exists cover_teaser_path text;       -- тизер для обложки (если обложка — видео)
alter table public.posts add column if not exists feed_video_path text;         -- mia-previews/feedvid/<post>/<id>.mp4 — ТОЛЬКО у открытых видео-постов
create or replace view public.post_video_public as
  select p.id as post_id, p.kind,
         count(i.id) filter (where i.kind = 'video')::int as video_count,
         (array_agg(i.duration_sec order by i.position) filter (where i.kind = 'video'))[1] as duration_sec,
         p.cover_teaser_path as teaser_path,
         -- полное видео отдаём только если пост открыт всем (уровень rank 0); иначе null, даже если путь остался
         case when coalesce(t.rank, 0) = 0 and p.kind = 'video' then p.feed_video_path end as feed_video_path
  from public.posts p
  left join public.tiers t on t.id = p.tier_id
  left join public.post_images i on i.post_id = p.id
  where p.status = 'published' and p.publish_at <= now()
  group by p.id, p.kind, p.cover_teaser_path, p.feed_video_path, t.rank
  having p.kind = 'video' or count(i.id) filter (where i.kind = 'video') > 0 or p.cover_teaser_path is not null;
grant select on public.post_video_public to anon, authenticated;
commit;
-- Админ пишет новые колонки через уже существующие права update на posts / insert на post_images.

-- ОТКАТ (вручную):
-- begin;
-- create or replace view … нельзя убрать колонки — поэтому drop + create прежнего определения из sql/video.sql:
-- drop view if exists public.post_video_public;
-- (выполнить блок create view public.post_video_public … и grant из sql/video.sql)
-- alter table public.posts drop column if exists feed_video_path, drop column if exists cover_teaser_path;
-- alter table public.post_images drop column if exists teaser_path;
-- commit;
-- Публичные файлы feedvid/ и teasers/ в mia-previews при откате удалить вручную (или оставить: на них никто не ссылается).
