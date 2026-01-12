-- Add explicit deny policies to satisfy RLS linter while keeping table inaccessible

drop policy if exists "No direct select" on public.rate_limits;
create policy "No direct select"
on public.rate_limits
for select
to authenticated
using (false);

drop policy if exists "No direct insert" on public.rate_limits;
create policy "No direct insert"
on public.rate_limits
for insert
to authenticated
with check (false);

drop policy if exists "No direct update" on public.rate_limits;
create policy "No direct update"
on public.rate_limits
for update
to authenticated
using (false);

drop policy if exists "No direct delete" on public.rate_limits;
create policy "No direct delete"
on public.rate_limits
for delete
to authenticated
using (false);

-- Note: public.check_rate_limit() remains SECURITY DEFINER and is the only supported access path.