-- Add is_admin column to profiles
alter table public.profiles add column if not exists is_admin boolean default false;

-- Update RLS policies for profiles to allow admins to see everything
-- Note: We keep the existing "Users can view own profile" policy
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" 
  on public.profiles for select 
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" 
  on public.profiles for update 
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

-- Also allow admins to see all portfolios and positions for management
drop policy if exists "Admins can view all portfolios" on public.portfolios;
create policy "Admins can view all portfolios" 
  on public.portfolios for select 
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can view all positions" on public.positions;
create policy "Admins can view all positions" 
  on public.positions for select 
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );
