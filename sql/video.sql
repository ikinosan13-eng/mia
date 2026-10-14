-- Видео в паках и видео-посты. Повторный запуск безопасен. Ничего не удаляет и не пересоздаёт.
-- Существующие view feed_public / media_public / free_images_public НЕ трогаем (их права и RLS остаются как есть):
-- видео-данные отдаются через два НОВЫХ view с тем же фильтром «опубликовано», сайт подмешивает их сам
-- (если view ещё нет — сайт и функции работают по-старому).
-- Видео-строка post_images: original_path = videos/<post>/<id>.mp4 (privat/originals/…),
-- preview_path = poster_path = posters/<post>/<id>.jpg|webp (mia-previews, публичный кадр-постер).
begin;
alter table public.post_images add column if not exists kind text not null default 'image';
alter table public.post_images add column if not exists duration_sec real;
alter table public.post_images add column if not exists poster_path text;
alter table public.post_images add column if not exists size_bytes bigint;
alter table public.posts add column if not exists kind text not null default 'pack';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'post_images_kind_chk') then
    alter table public.post_images add constraint post_images_kind_chk check (kind in ('image', 'video'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'post_images_video_size_chk') then
    alter table public.post_images add constraint post_images_video_size_chk check (size_bytes is null or size_bytes <= 314572800);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'posts_kind_chk') then
    alter table public.posts add constraint posts_kind_chk check (kind in ('pack', 'video'));
  end if;
end $$;

-- по паку: тип, сколько видео, длительность первого видео (для ▶ 0:12 на карточке ленты)
create or replace view public.post_video_public as
  select p.id as post_id, p.kind,
         count(i.id) filter (where i.kind = 'video')::int as video_count,
         (array_agg(i.duration_sec order by i.position) filter (where i.kind = 'video'))[1] as duration_sec
  from public.posts p left join public.post_images i on i.post_id = p.id
  where p.status = 'published' and p.publish_at <= now()
  group by p.id, p.kind
  having p.kind = 'video' or count(i.id) filter (where i.kind = 'video') > 0;
-- по арту: только видео-строки, без путей к оригиналам (постер публичный, как превью)
create or replace view public.media_video_public as
  select i.id, i.post_id, i.position, i.duration_sec, i.poster_path
  from public.post_images i join public.posts p on p.id = i.post_id
  where i.kind = 'video' and p.status = 'published' and p.publish_at <= now();
grant select on public.post_video_public, public.media_video_public to anon, authenticated;
commit;
-- Админ пишет kind/duration_sec/poster_path/size_bytes через уже существующие права insert/update на post_images и posts.

-- ОТКАТ (выполнить вручную, если нужно; удалит видео-метаданные, сами файлы в Yandex останутся):
-- begin;
-- drop view if exists public.media_video_public;
-- drop view if exists public.post_video_public;
-- alter table public.post_images drop constraint if exists post_images_kind_chk, drop constraint if exists post_images_video_size_chk;
-- alter table public.posts drop constraint if exists posts_kind_chk;
-- alter table public.post_images drop column if exists kind, drop column if exists duration_sec, drop column if exists poster_path, drop column if exists size_bytes;
-- alter table public.posts drop column if exists kind;
-- commit;
