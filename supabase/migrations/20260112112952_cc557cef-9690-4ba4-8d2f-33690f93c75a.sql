-- Rate limiting primitives
create table if not exists public.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  primary key (user_id, action)
);

alter table public.rate_limits enable row level security;

-- Lock down direct table access (function will be SECURITY DEFINER)
revoke all on table public.rate_limits from public;
revoke all on table public.rate_limits from anon;
revoke all on table public.rate_limits from authenticated;

create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_count integer,
  p_window_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_window_start timestamptz;
  v_window_age interval;
begin
  -- Basic input validation to avoid abuse/misuse
  if p_user_id is null then
    raise exception 'user_id required';
  end if;

  if p_action is null or length(btrim(p_action)) = 0 or length(p_action) > 64 then
    raise exception 'invalid action';
  end if;

  if p_max_count is null or p_max_count < 1 or p_max_count > 10000 then
    raise exception 'invalid max_count';
  end if;

  if p_window_minutes is null or p_window_minutes < 1 or p_window_minutes > 10080 then
    raise exception 'invalid window_minutes';
  end if;

  select rl.count, rl.window_start
    into v_count, v_window_start
  from public.rate_limits rl
  where rl.user_id = p_user_id
    and rl.action = p_action;

  if v_window_start is null then
    -- First time for this key
    insert into public.rate_limits (user_id, action, count, window_start)
    values (p_user_id, p_action, 1, now())
    on conflict (user_id, action)
    do update set count = 1, window_start = now();

    return true;
  end if;

  v_window_age := now() - v_window_start;

  if v_window_age > (p_window_minutes * interval '1 minute') then
    -- Window expired: reset
    update public.rate_limits
      set count = 1,
          window_start = now()
    where user_id = p_user_id
      and action = p_action;

    return true;
  end if;

  if v_count >= p_max_count then
    return false;
  end if;

  update public.rate_limits
    set count = count + 1
  where user_id = p_user_id
    and action = p_action;

  return true;
end;
$$;

revoke all on function public.check_rate_limit(uuid, text, integer, integer) from public;
grant execute on function public.check_rate_limit(uuid, text, integer, integer) to authenticated;

-- Tighten INSERT policies by embedding rate limits (policies are permissive, so we must modify the existing ones)

drop policy if exists "Users can send friend requests" on public.friendships;
create policy "Users can send friend requests"
on public.friendships
for insert
to authenticated
with check (
  auth.uid() = requester_id
  and requester_id <> addressee_id
  and public.check_rate_limit(auth.uid(), 'friend_request', 10, 60)
);

drop policy if exists "Users can insert their own scores" on public.scores;
create policy "Users can insert their own scores"
on public.scores
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.check_rate_limit(auth.uid(), 'score_submit', 50, 1440)
);

drop policy if exists "Users can insert their own votes" on public.score_votes;
create policy "Users can insert their own votes"
on public.score_votes
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.check_rate_limit(auth.uid(), 'vote', 100, 60)
);

-- Username hardening: enforce at DB level for new/updated rows without breaking existing data
alter table public.profiles
  add constraint username_not_empty
  check (btrim(username) <> '') not valid;

alter table public.profiles
  add constraint username_format
  check (username ~ '^[A-Za-z0-9_-]{3,30}$') not valid;

-- Ensure signup username generation respects the constraints
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw_username text;
  v_username text;
begin
  v_raw_username := coalesce(new.raw_user_meta_data->>'username', '');

  if v_raw_username ~ '^[A-Za-z0-9_-]{3,30}$' then
    v_username := v_raw_username;
  else
    v_username := 'user_' || left(new.id::text, 8);
  end if;

  insert into public.profiles (user_id, username)
  values (new.id, v_username);

  return new;
end;
$$;