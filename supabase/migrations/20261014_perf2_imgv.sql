-- Perf фаза 2 (необязательно, сайт работает и без этого). Повторный запуск безопасен, удаляющих операций нет.
-- Манифест WebP-версий хранится в settings под ключом 'imgv'. Если текущие политики settings уже дают
-- гостям читать все ключи, а админу — писать любые, этот файл ничего не меняет по сути (политики складываются через OR).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'settings' and policyname = 'imgv public read') then
    create policy "imgv public read" on public.settings for select to anon, authenticated using (key = 'imgv');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'settings' and policyname = 'imgv admin write') then
    create policy "imgv admin write" on public.settings for all to authenticated
      using (key = 'imgv' and exists (select 1 from public.admins a where a.user_id = auth.uid()))
      with check (key = 'imgv' and exists (select 1 from public.admins a where a.user_id = auth.uid()));
  end if;
end $$;
