-- Notifications and preferences
create table if not exists notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'email',
  title text not null,
  body text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table notification_prefs enable row level security;
alter table notifications enable row level security;

drop policy if exists "prefs_select_own" on notification_prefs;
drop policy if exists "prefs_insert_own" on notification_prefs;
drop policy if exists "prefs_update_own" on notification_prefs;
drop policy if exists "notifications_select_own" on notifications;

create policy "prefs_select_own" on notification_prefs
  for select using (auth.uid() = user_id);

create policy "prefs_insert_own" on notification_prefs
  for insert with check (auth.uid() = user_id);

create policy "prefs_update_own" on notification_prefs
  for update using (auth.uid() = user_id);

create policy "notifications_select_own" on notifications
  for select using (auth.uid() = user_id);
