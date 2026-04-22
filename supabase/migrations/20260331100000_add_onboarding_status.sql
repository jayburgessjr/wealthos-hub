-- Add onboarding_completed column to profiles
alter table public.profiles add column if not exists onboarding_completed boolean default false;

-- Update the handle_new_user function to include onboarding_completed (redundant but good practice)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, onboarding_completed)
  values (new.id, new.email, false);
  return new;
end;
$$ language plpgsql security definer;
