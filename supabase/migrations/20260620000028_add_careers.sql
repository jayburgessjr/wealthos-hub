-- Create employment_type enum
CREATE TYPE public.employment_type AS ENUM ('full_time', 'part_time', 'contract', 'self_employed', 'unemployed');

-- Create skill_level enum
CREATE TYPE public.skill_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- Create career_goal_status enum
CREATE TYPE public.career_goal_status AS ENUM ('planning', 'in_progress', 'completed');

-- Create career_profiles table
CREATE TABLE public.career_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_title TEXT NOT NULL,
  current_company TEXT NOT NULL,
  start_date DATE NOT NULL,
  employment_type employment_type NOT NULL DEFAULT 'full_time',
  current_salary DECIMAL(12,2) DEFAULT 0,
  linked_income_source_id UUID REFERENCES public.income_sources(id) ON DELETE SET NULL,
  next_review_date DATE,
  target_raise DECIMAL(5,2), -- percentage
  job_search_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id) -- one profile per user per household
);

-- Create skills table
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_profile_id UUID NOT NULL REFERENCES public.career_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level skill_level NOT NULL DEFAULT 'beginner',
  certification_date DATE,
  expiry_date DATE,
  cost DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create achievements table
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_profile_id UUID NOT NULL REFERENCES public.career_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  impact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create career_goals table
CREATE TABLE public.career_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_profile_id UUID NOT NULL REFERENCES public.career_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  required_skills TEXT[] DEFAULT '{}',
  expected_income_increase DECIMAL(10,2),
  status career_goal_status NOT NULL DEFAULT 'planning',
  completed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_goals ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_career_profiles_household_id ON public.career_profiles(household_id);
CREATE INDEX idx_career_profiles_user_id ON public.career_profiles(user_id);
CREATE INDEX idx_career_profiles_next_review ON public.career_profiles(next_review_date) WHERE next_review_date IS NOT NULL;
CREATE INDEX idx_skills_career_profile_id ON public.skills(career_profile_id);
CREATE INDEX idx_skills_expiry_date ON public.skills(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_achievements_career_profile_id ON public.achievements(career_profile_id);
CREATE INDEX idx_career_goals_career_profile_id ON public.career_goals(career_profile_id);
CREATE INDEX idx_career_goals_status ON public.career_goals(status);

-- RLS Policies: All household members can view all career profiles in their household
CREATE POLICY "Users can view career profiles in their household"
  ON public.career_profiles FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Users can create their own career profile"
  ON public.career_profiles FOR INSERT
  WITH CHECK (
    household_id = public.get_user_household_id(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update career profiles in their household"
  ON public.career_profiles FOR UPDATE
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Users can delete career profiles in their household"
  ON public.career_profiles FOR DELETE
  USING (household_id = public.get_user_household_id(auth.uid()));

-- Skills RLS
CREATE POLICY "Users can view skills in their household"
  ON public.skills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.career_profiles cp
      WHERE cp.id = skills.career_profile_id
      AND cp.household_id = public.get_user_household_id(auth.uid())
    )
  );

CREATE POLICY "Users can manage skills in their household"
  ON public.skills FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.career_profiles cp
      WHERE cp.id = skills.career_profile_id
      AND cp.household_id = public.get_user_household_id(auth.uid())
    )
  );

-- Achievements RLS
CREATE POLICY "Users can view achievements in their household"
  ON public.achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.career_profiles cp
      WHERE cp.id = achievements.career_profile_id
      AND cp.household_id = public.get_user_household_id(auth.uid())
    )
  );

CREATE POLICY "Users can manage achievements in their household"
  ON public.achievements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.career_profiles cp
      WHERE cp.id = achievements.career_profile_id
      AND cp.household_id = public.get_user_household_id(auth.uid())
    )
  );

-- Career Goals RLS
CREATE POLICY "Users can view career goals in their household"
  ON public.career_goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.career_profiles cp
      WHERE cp.id = career_goals.career_profile_id
      AND cp.household_id = public.get_user_household_id(auth.uid())
    )
  );

CREATE POLICY "Users can manage career goals in their household"
  ON public.career_goals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.career_profiles cp
      WHERE cp.id = career_goals.career_profile_id
      AND cp.household_id = public.get_user_household_id(auth.uid())
    )
  );

-- Triggers to auto-update updated_at
CREATE TRIGGER update_career_profiles_updated_at
  BEFORE UPDATE ON public.career_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_skills_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_career_goals_updated_at
  BEFORE UPDATE ON public.career_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
