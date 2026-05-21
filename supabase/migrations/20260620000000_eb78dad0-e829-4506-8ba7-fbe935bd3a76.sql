-- Create app_role enum for household roles
CREATE TYPE public.app_role AS ENUM ('owner', 'member');

-- Create households table
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  monthly_income DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, household_id)
);

-- Create category_type enum
CREATE TYPE public.category_type AS ENUM ('fixed', 'variable', 'savings', 'debt');

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type category_type NOT NULL DEFAULT 'variable',
  monthly_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create goals table
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  monthly_contribution DECIMAL(12,2) NOT NULL DEFAULT 0,
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Security definer function to check household membership
CREATE OR REPLACE FUNCTION public.is_household_member(_user_id UUID, _household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND household_id = _household_id
  )
$$;

-- Security definer function to check household role
CREATE OR REPLACE FUNCTION public.has_household_role(_user_id UUID, _household_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
      AND household_id = _household_id 
      AND role = _role
  )
$$;

-- Get user's household_id
CREATE OR REPLACE FUNCTION public.get_user_household_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.profiles WHERE id = _user_id
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view profiles in their household"
  ON public.profiles FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Households policies
CREATE POLICY "Users can view their household"
  ON public.households FOR SELECT
  USING (id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Owners can update their household"
  ON public.households FOR UPDATE
  USING (public.has_household_role(auth.uid(), id, 'owner'));

CREATE POLICY "Users can create households"
  ON public.households FOR INSERT
  WITH CHECK (true);

-- User roles policies
CREATE POLICY "Users can view roles in their household"
  ON public.user_roles FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Owners can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_household_role(auth.uid(), household_id, 'owner'));

CREATE POLICY "Users can insert their own role"
  ON public.user_roles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Categories policies
CREATE POLICY "Users can view categories in their household"
  ON public.categories FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Owners can manage categories"
  ON public.categories FOR ALL
  USING (public.has_household_role(auth.uid(), household_id, 'owner'));

-- Expenses policies
CREATE POLICY "Users can view expenses in their household"
  ON public.expenses FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Users can create expenses in their household"
  ON public.expenses FOR INSERT
  WITH CHECK (
    household_id = public.get_user_household_id(auth.uid()) 
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own expenses"
  ON public.expenses FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own expenses"
  ON public.expenses FOR DELETE
  USING (user_id = auth.uid());

-- Goals policies
CREATE POLICY "Users can view goals in their household"
  ON public.goals FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Owners can manage goals"
  ON public.goals FOR ALL
  USING (public.has_household_role(auth.uid(), household_id, 'owner'));

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();