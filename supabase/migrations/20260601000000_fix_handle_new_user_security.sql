-- Fix typo: 'security modeller' -> 'security definer' in handle_new_user function
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, onboarding_completed)
  values (new.id, new.email, false);
  return new;
end;
$$ language plpgsql security definer;
