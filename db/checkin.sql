-- Global QR check-in (admin kiosk)

create table if not exists checkin_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists checkins (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  points integer not null,
  activity_date date not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

alter table checkin_tokens enable row level security;
alter table checkins enable row level security;

drop policy if exists "checkin_tokens_select_own" on checkin_tokens;
drop policy if exists "checkin_tokens_insert_own" on checkin_tokens;
drop policy if exists "checkin_tokens_update_own" on checkin_tokens;
drop policy if exists "checkins_admin_all" on checkins;

create policy "checkin_tokens_select_own" on checkin_tokens
  for select using (auth.uid() = user_id);

create policy "checkin_tokens_insert_own" on checkin_tokens
  for insert with check (auth.uid() = user_id);

create policy "checkin_tokens_update_own" on checkin_tokens
  for update using (auth.uid() = user_id);

create policy "checkins_admin_all" on checkins
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create or replace function public.get_or_create_checkin_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_token text;
begin
  select token into v_token from checkin_tokens where user_id = auth.uid();
  if v_token is null then
    v_token := gen_random_uuid()::text;
    insert into checkin_tokens(user_id, token)
    values (auth.uid(), v_token)
    on conflict (user_id) do update set token = excluded.token, created_at = now();
  end if;
  return v_token;
end;
$$;

create or replace function public.checkin_by_token(
  p_token text,
  p_points integer,
  p_activity_date date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'not authorized';
  end if;

  select user_id into v_user from checkin_tokens where token = p_token;
  if v_user is null then
    raise exception 'invalid token';
  end if;

  insert into checkins(user_id, token, points, activity_date, created_by, note)
  values (v_user, p_token, p_points, p_activity_date, auth.uid(), p_note);

  insert into point_requests(user_id, activity_date, category, points, note, status)
  values (v_user, p_activity_date, 'QR check-in', p_points, coalesce(p_note, 'QR check-in'), 'approved');

  return v_user;
end;
$$;

grant execute on function public.get_or_create_checkin_token() to authenticated;
grant execute on function public.checkin_by_token(text, integer, date, text) to authenticated;
