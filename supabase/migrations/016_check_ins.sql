-- Check-ins: "I was here" per spot. One per device per spot (device_id from localStorage).
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots(id) on delete cascade,
  device_id text not null,
  checked_in_at timestamptz default now(),
  unique(spot_id, device_id)
);

create index if not exists check_ins_spot_id_idx on public.check_ins(spot_id);

alter table public.check_ins enable row level security;

drop policy if exists "Anyone can read check_ins" on public.check_ins;
drop policy if exists "Anyone can insert check_ins" on public.check_ins;

create policy "Anyone can read check_ins"
  on public.check_ins for select using (true);

create policy "Anyone can insert check_ins"
  on public.check_ins for insert with check (true);
