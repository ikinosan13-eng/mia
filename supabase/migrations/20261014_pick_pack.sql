-- «1 пак на выбор»: одноразовые коды → 1 кредит на аккаунт → навсегда открытый пак.
-- Применять вручную: Supabase → SQL Editor → вставить файл целиком → Run. Повторный запуск безопасен.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.pick_codes (
  id bigint generated always as identity primary key,
  code text not null unique,                 -- в верхнем регистре, напр. MIA-PICK-7K2Q-XXXX
  note text,                                 -- пометка админа (кому продан, сумма)
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users on delete set null,
  redeemed_at timestamptz
);
create table if not exists public.pack_credits (
  user_id uuid primary key references auth.users on delete cascade,   -- один кредит на аккаунт, навсегда
  code_id bigint references public.pick_codes,
  granted_at timestamptz not null default now(),
  used_post_id uuid references public.posts on delete set null,
  used_at timestamptz
);
create table if not exists public.pack_unlocks (
  user_id uuid not null references auth.users on delete cascade,
  post_id uuid not null references public.posts on delete cascade,
  source text not null default 'pick',
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.pick_attempts (
  user_id uuid not null, at timestamptz not null default now(), ok boolean not null
);
create index if not exists pick_attempts_u on public.pick_attempts (user_id, at);

alter table public.pick_codes enable row level security;     -- только через функции ниже
alter table public.pick_attempts enable row level security;
alter table public.pack_credits enable row level security;
alter table public.pack_unlocks enable row level security;
drop policy if exists "own credit" on public.pack_credits;
create policy "own credit" on public.pack_credits for select using (user_id = auth.uid());
drop policy if exists "own unlocks" on public.pack_unlocks;
create policy "own unlocks" on public.pack_unlocks for select using (user_id = auth.uid());

-- ввод кода «1 пак на выбор»
create or replace function public.redeem_pick_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); c public.pick_codes; n int;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  select count(*) into n from pick_attempts where user_id = u and not ok and at > now() - interval '15 minutes';
  if n >= 10 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  if exists (select 1 from pack_credits where user_id = u) then return jsonb_build_object('ok', false, 'error', 'already_used'); end if;
  select * into c from pick_codes where code = upper(trim(p_code)) and redeemed_by is null for update skip locked;
  if not found then insert into pick_attempts(user_id, ok) values (u, false); return jsonb_build_object('ok', false, 'error', 'bad_code'); end if;
  begin
    insert into pack_credits(user_id, code_id) values (u, c.id);
  exception when unique_violation then return jsonb_build_object('ok', false, 'error', 'already_used'); end;
  update pick_codes set redeemed_by = u, redeemed_at = now() where id = c.id;
  insert into pick_attempts(user_id, ok) values (u, true);
  return jsonb_build_object('ok', true, 'credit', true);
end $$;

-- потратить кредит на закрытый пак (повторный/двойной вызов безопасен)
create or replace function public.use_pack_credit(p_post uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); cr public.pack_credits;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  if exists (select 1 from pack_unlocks where user_id = u and post_id = p_post) then return jsonb_build_object('ok', true, 'post_id', p_post, 'already', true); end if;
  select * into cr from pack_credits where user_id = u for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_credit'); end if;
  if cr.used_post_id is not null then return jsonb_build_object('ok', false, 'error', 'credit_used', 'post_id', cr.used_post_id); end if;
  if not exists (select 1 from posts where id = p_post and status = 'published') then return jsonb_build_object('ok', false, 'error', 'no_post'); end if;
  insert into pack_unlocks(user_id, post_id, source) values (u, p_post, 'pick') on conflict do nothing;
  update pack_credits set used_post_id = p_post, used_at = now() where user_id = u;
  return jsonb_build_object('ok', true, 'post_id', p_post);
end $$;

-- что есть у текущего аккаунта
create or replace function public.my_pick_access() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'credit', exists (select 1 from pack_credits where user_id = auth.uid() and used_post_id is null),
    'unlocked', coalesce((select jsonb_agg(post_id) from pack_unlocks where user_id = auth.uid()), '[]'::jsonb));
$$;

-- админка: выпуск кодов и список
create or replace function public.admin_create_pick_codes(p_n int, p_note text default null) returns setof text
language plpgsql security definer set search_path = public as $$
declare i int; c text; a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then raise exception 'forbidden'; end if;
  if p_n < 1 or p_n > 200 then raise exception 'n 1..200'; end if;
  for i in 1..p_n loop
    loop
      c := 'MIA-PICK-' || (select string_agg(substr(a, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1), '') from generate_series(1, 4))
                 || '-' || (select string_agg(substr(a, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1), '') from generate_series(1, 4));
      exit when not exists (select 1 from pick_codes where code = c);
    end loop;
    insert into pick_codes(code, note) values (c, p_note); return next c;
  end loop;
end $$;

create or replace function public.admin_pick_codes() returns table(id bigint, code text, note text, created_at timestamptz, redeemed_at timestamptz, username text, used_post_id uuid, post_title text, used_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then raise exception 'forbidden'; end if;
  return query select k.id, k.code, k.note, k.created_at, k.redeemed_at, pr.username, cr.used_post_id, p.title, cr.used_at
    from pick_codes k left join profiles pr on pr.id = k.redeemed_by left join pack_credits cr on cr.code_id = k.id left join posts p on p.id = cr.used_post_id
    order by k.created_at desc, k.id desc;
end $$;

revoke all on function public.admin_create_pick_codes(int, text), public.admin_pick_codes() from public, anon;
revoke all on function public.redeem_pick_code(text), public.use_pack_credit(uuid), public.my_pick_access() from public, anon;
grant execute on function public.redeem_pick_code(text), public.use_pack_credit(uuid), public.my_pick_access(), public.admin_create_pick_codes(int, text), public.admin_pick_codes() to authenticated;
