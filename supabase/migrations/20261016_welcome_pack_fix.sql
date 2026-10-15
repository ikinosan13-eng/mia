-- Исправление claim_welcome_pack: в posts нет колонки tier_rank. Уровень пака = posts.tier_id → tiers.rank
-- (как в sql/teasers.sql и admin.js; tier_rank на сайте — вычисляемое поле view). Только CREATE OR REPLACE,
-- та же сигнатура/security definer/search_path; без drop и без изменения данных. my_welcome_pack не затронута.
create or replace function public.claim_welcome_pack(p_post uuid, p_device text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_hdr json;
  v_raw text;
  v_ip  inet;
  v_cnt int;
  v_dev text := left(trim(coalesce(p_device, '')), 200);
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  if length(v_dev) < 16 then return jsonb_build_object('ok', false, 'error', 'busted'); end if;

  -- IP клиента из заголовков PostgREST (первый адрес в x-forwarded-for; запасные — cf-connecting-ip / x-real-ip)
  begin v_hdr := nullif(current_setting('request.headers', true), '')::json; exception when others then v_hdr := null; end;
  v_raw := coalesce(nullif(trim(split_part(v_hdr->>'x-forwarded-for', ',', 1)), ''), v_hdr->>'cf-connecting-ip', v_hdr->>'x-real-ip');
  begin v_ip := nullif(trim(v_raw), '')::inet; exception when others then v_ip := null; end;

  -- сериализуем выдачи, чтобы параллельные вызовы не обошли лимиты
  perform pg_advisory_xact_lock(hashtext('claim_welcome_pack'));

  if exists (select 1 from welcome_grants where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'used',
      'post_id', (select post_id from welcome_grants where user_id = v_uid));
  end if;
  if exists (select 1 from welcome_grants where device = v_dev) then
    return jsonb_build_object('ok', false, 'error', 'busted');
  end if;
  if v_ip is not null then
    select count(*) into v_cnt from welcome_grants where ip = v_ip and created_at > now() - interval '24 hours';
    if v_cnt >= 2 then return jsonb_build_object('ok', false, 'error', 'busted'); end if;
  end if;

  -- только опубликованные паки по подписке
  if not exists (select 1 from posts p join tiers t on t.id = p.tier_id
                  where p.id = p_post and t.rank > 0 and p.status = 'published' and p.publish_at <= now()) then
    return jsonb_build_object('ok', false, 'error', 'no_post');
  end if;

  insert into welcome_grants (user_id, post_id, device, ip) values (v_uid, p_post, v_dev, v_ip);
  insert into pack_unlocks (user_id, post_id, source) values (v_uid, p_post, 'welcome') on conflict do nothing;
  return jsonb_build_object('ok', true, 'post_id', p_post);
end $$;

revoke all on function public.claim_welcome_pack(uuid, text) from public, anon;
grant execute on function public.claim_welcome_pack(uuid, text) to authenticated;
