-- «Подарок новичку, мур»: 1 закрытый пак бесплатно и навсегда. Проект oobbgppqkqydqqcaffpg.
-- Вставить целиком в Supabase → SQL Editor → Run. Повторный запуск безопасен (идемпотентно).
-- Требует уже применённую миграцию 20261014_pick_pack.sql (таблица public.pack_unlocks — та же,
-- через которую my_pick_access()/S.pick.unlocked открывают пак на сайте).
-- Защита (без email): 1 подарок на аккаунт; 1 на устройство (отпечаток + маркер localStorage miaDev);
-- не больше 2 подарков с одного IP за 24 ч (IP из заголовков запроса). Нарушение → 'busted'.

create table if not exists public.welcome_grants (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  device     text not null,
  ip         inet,
  created_at timestamptz not null default now()
);
create index if not exists welcome_grants_device_idx on public.welcome_grants (device);
create index if not exists welcome_grants_ip_time_idx on public.welcome_grants (ip, created_at);

alter table public.welcome_grants enable row level security;
revoke all on public.welcome_grants from anon, authenticated;
grant select on public.welcome_grants to authenticated;          -- чтение только своей строки (политика ниже)
drop policy if exists welcome_grants_self_read on public.welcome_grants;
create policy welcome_grants_self_read on public.welcome_grants
  for select to authenticated using (user_id = auth.uid());
-- политик insert/update/delete нет → писать напрямую нельзя, только через RPC ниже

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
  if not exists (select 1 from posts where id = p_post and tier_rank > 0 and status = 'published') then
    return jsonb_build_object('ok', false, 'error', 'no_post');
  end if;

  insert into welcome_grants (user_id, post_id, device, ip) values (v_uid, p_post, v_dev, v_ip);
  insert into pack_unlocks (user_id, post_id, source) values (v_uid, p_post, 'welcome') on conflict do nothing;
  return jsonb_build_object('ok', true, 'post_id', p_post);
end $$;

-- может ли текущий аккаунт ещё получить подарок (для показа баннера)
create or replace function public.my_welcome_pack()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('claimed', exists (select 1 from welcome_grants where user_id = auth.uid()),
                            'post_id', (select post_id from welcome_grants where user_id = auth.uid()));
$$;

revoke all on function public.claim_welcome_pack(uuid, text), public.my_welcome_pack() from public, anon;
grant execute on function public.claim_welcome_pack(uuid, text), public.my_welcome_pack() to authenticated;

-- Откат:
--   drop function if exists public.claim_welcome_pack(uuid, text); drop function if exists public.my_welcome_pack();
--   delete from public.pack_unlocks where source = 'welcome'; drop table if exists public.welcome_grants;
