-- Create task_status enum
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');

-- Create task_priority enum
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}', -- Array of strings
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0, -- For drag-and-drop ordering
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_tasks_household_id ON public.tasks(household_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

-- RLS Policies: All household members can view/manage tasks
CREATE POLICY "Users can view tasks in their household"
  ON public.tasks FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Users can create tasks in their household"
  ON public.tasks FOR INSERT
  WITH CHECK (
    household_id = public.get_user_household_id(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update tasks in their household"
  ON public.tasks FOR UPDATE
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Users can delete tasks in their household"
  ON public.tasks FOR DELETE
  USING (household_id = public.get_user_household_id(auth.uid()));

-- Trigger to auto-update updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically set position for new tasks at end of column
CREATE OR REPLACE FUNCTION public.set_task_position()
RETURNS TRIGGER AS $$
BEGIN
  -- If position not explicitly set, put at end of status column
  IF NEW.position IS NULL OR NEW.position = 0 THEN
    SELECT COALESCE(MAX(position), 0) + 1000
    INTO NEW.position
    FROM public.tasks
    WHERE household_id = NEW.household_id AND status = NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_task_position_trigger
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_position();
