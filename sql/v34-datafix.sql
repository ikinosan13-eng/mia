update public.post_images
set kind = 'video', duration_sec = 15, poster_path = preview_path, size_bytes = 7433820
where id = 'dca0a8cb-76c3-47f8-8492-8e340877db0f'
  and post_id = 'bd350c7c-c846-43be-8fc9-4568731cde45'
  and original_path like 'videos/%';
update public.posts set kind = 'video' where id = '82066b35-034c-422b-8d47-b7023bbe15e5';
