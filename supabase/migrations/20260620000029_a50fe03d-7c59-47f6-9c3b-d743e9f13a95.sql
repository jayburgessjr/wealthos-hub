-- Create tasks table for Kanban board
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view household tasks"
  ON public.tasks FOR SELECT
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can create household tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can update household tasks"
  ON public.tasks FOR UPDATE
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can delete household tasks"
  ON public.tasks FOR DELETE
  USING (household_id = get_user_household_id(auth.uid()));

-- Indexes
CREATE INDEX idx_tasks_household ON public.tasks(household_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

-- Trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create career_profiles table
CREATE TABLE IF NOT EXISTS public.career_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  current_title TEXT NOT NULL,
  current_company TEXT NOT NULL,
  start_date DATE NOT NULL,
  employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'self_employed', 'unemployed')),
  current_salary DECIMAL(10,2) DEFAULT 0,
  linked_income_source_id UUID REFERENCES public.income_sources(id) ON DELETE SET NULL,
  next_review_date DATE,
  target_raise DECIMAL(5,2),
  job_search_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create skills table
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_profile_id UUID NOT NULL REFERENCES public.career_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'intermediate' CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years_experience DECIMAL(4,1) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_profile_id UUID NOT NULL REFERENCES public.career_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create career_goals table
CREATE TABLE IF NOT EXISTS public.career_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_profile_id UUID NOT NULL REFERENCES public.career_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_goals ENABLE ROW LEVEL SECURITY;

-- Career profiles policies
CREATE POLICY "Users can view household career profiles"
  ON public.career_profiles FOR SELECT
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can create career profiles"
  ON public.career_profiles FOR INSERT
  WITH CHECK (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can update career profiles"
  ON public.career_profiles FOR UPDATE
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can delete career profiles"
  ON public.career_profiles FOR DELETE
  USING (household_id = get_user_household_id(auth.uid()));

-- Skills policies
CREATE POLICY "Users can view skills"
  ON public.skills FOR SELECT
  USING (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

CREATE POLICY "Users can create skills"
  ON public.skills FOR INSERT
  WITH CHECK (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

CREATE POLICY "Users can update skills"
  ON public.skills FOR UPDATE
  USING (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

CREATE POLICY "Users can delete skills"
  ON public.skills FOR DELETE
  USING (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

-- Achievements policies
CREATE POLICY "Users can view achievements"
  ON public.achievements FOR SELECT
  USING (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

CREATE POLICY "Users can create achievements"
  ON public.achievements FOR INSERT
  WITH CHECK (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

CREATE POLICY "Users can delete achievements"
  ON public.achievements FOR DELETE
  USING (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

-- Career goals policies
CREATE POLICY "Users can view career goals"
  ON public.career_goals FOR SELECT
  USING (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

CREATE POLICY "Users can create career goals"
  ON public.career_goals FOR INSERT
  WITH CHECK (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

CREATE POLICY "Users can update career goals"
  ON public.career_goals FOR UPDATE
  USING (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

CREATE POLICY "Users can delete career goals"
  ON public.career_goals FOR DELETE
  USING (career_profile_id IN (SELECT id FROM public.career_profiles WHERE household_id = get_user_household_id(auth.uid())));

-- Indexes
CREATE INDEX idx_career_profiles_household ON public.career_profiles(household_id);
CREATE INDEX idx_career_profiles_user ON public.career_profiles(user_id);
CREATE INDEX idx_skills_profile ON public.skills(career_profile_id);
CREATE INDEX idx_achievements_profile ON public.achievements(career_profile_id);
CREATE INDEX idx_career_goals_profile ON public.career_goals(career_profile_id);

-- Triggers
CREATE TRIGGER update_career_profiles_updated_at 
  BEFORE UPDATE ON public.career_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_career_goals_updated_at 
  BEFORE UPDATE ON public.career_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();