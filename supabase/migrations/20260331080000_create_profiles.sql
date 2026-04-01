-- Create a table for user profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  stripe_customer_id text,
  subscription_status text default 'none', -- none, active, trialing, past_due, canceled
  subscription_plan text default 'free',   -- free, pro
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;

create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can update own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security modeller;

-- Trigger to call the function on user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
