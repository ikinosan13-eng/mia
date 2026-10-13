-- «1 пак на выбор»: ОДИН общий код вместо пачек. Админ задаёт/меняет текст кода в админке.
-- Любой аккаунт может ввести его один раз → 1 кредит (pack_credits.user_id — первичный ключ).
-- Требует 20261014_pick_pack.sql. Повторный запуск безопасен. Удаляющих операций нет.

-- настройки: одна строка, текст кода хранится открыто (админ должен видеть текущий код),
-- RLS включён и политик нет → прямо читать таблицу не может никто, кроме функций ниже.
create table if not exists public.pick_settings (
  id boolean primary key default true check (id),
  code text,                                   -- в верхнем регистре, без пробелов по краям
  updated_at timestamptz not null default now()
);
alter table public.pick_settings enable row level security;
insert into public.pick_settings (id) values (true) on conflict (id) do nothing;

-- откуда пришёл кредит: 'code' (старые одноразовые) или 'universal'
alter table public.pack_credits add column if not exists source text not null default 'code';

-- админ: задать/сменить общий код (пустая строка или null = код выключен)
create or replace function public.admin_set_pick_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text := nullif(upper(trim(p_code)), '');
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then raise exception 'forbidden'; end if;
  if c is not null and (length(c) < 4 or length(c) > 64) then raise exception 'code length 4..64'; end if;
  update pick_settings set code = c, updated_at = now() where id;
  return jsonb_build_object('ok', true, 'code', c);
end $$;

-- админ: текущий код и сколько аккаунтов его активировали
create or replace function public.admin_pick_code() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then raise exception 'forbidden'; end if;
  return (select jsonb_build_object('code', s.code, 'updated_at', s.updated_at,
    'redeemed', (select count(*) from pack_credits where source = 'universal'),
    'used', (select count(*) from pack_credits where source = 'universal' and used_post_id is not null))
    from pick_settings s where s.id);
end $$;

-- ввод кода: сначала общий код, иначе старые одноразовые (если остались). Лимит попыток сохранён.
create or replace function public.redeem_pick_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); v text := upper(trim(p_code)); g text; c public.pick_codes; n int;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  select count(*) into n from pick_attempts where user_id = u and not ok and at > now() - interval '15 minutes';
  if n >= 10 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  if exists (select 1 from pack_credits where user_id = u) then return jsonb_build_object('ok', false, 'error', 'already_used'); end if;
  select code into g from pick_settings where id;
  if g is not null and v = g then
    begin
      insert into pack_credits(user_id, source) values (u, 'universal');
    exception when unique_violation then return jsonb_build_object('ok', false, 'error', 'already_used'); end;
    insert into pick_attempts(user_id, ok) values (u, true);
    return jsonb_build_object('ok', true, 'credit', true);
  end if;
  select * into c from pick_codes where code = v and redeemed_by is null for update skip locked;
  if not found then insert into pick_attempts(user_id, ok) values (u, false); return jsonb_build_object('ok', false, 'error', 'bad_code'); end if;
  begin
    insert into pack_credits(user_id, code_id, source) values (u, c.id, 'code');
  exception when unique_violation then return jsonb_build_object('ok', false, 'error', 'already_used'); end;
  update pick_codes set redeemed_by = u, redeemed_at = now() where id = c.id;
  insert into pick_attempts(user_id, ok) values (u, true);
  return jsonb_build_object('ok', true, 'credit', true);
end $$;

revoke all on function public.admin_set_pick_code(text), public.admin_pick_code(), public.redeem_pick_code(text) from public, anon;
grant execute on function public.admin_set_pick_code(text), public.admin_pick_code(), public.redeem_pick_code(text) to authenticated;
