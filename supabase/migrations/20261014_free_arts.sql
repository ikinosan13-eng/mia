-- «Пробник»: админ отмечает отдельные арты платного пака как бесплатные.
-- Повторный запуск безопасен. Удаляющих операций нет. Существующие view/таблицы не пересоздаются.
alter table public.post_images add column if not exists is_free boolean not null default false;
create index if not exists post_images_free on public.post_images (post_id, position) where is_free;

-- публичный список бесплатных артов: только id/пак/позиция (без путей к оригиналам), только опубликованные паки
create or replace view public.free_images_public as
  select i.id, i.post_id, i.position
  from public.post_images i join public.posts p on p.id = i.post_id
  where i.is_free and p.status = 'published' and p.publish_at <= now();
grant select on public.free_images_public to anon, authenticated;
-- Отметку is_free меняет админ через уже существующие права на update post_images (как position).
