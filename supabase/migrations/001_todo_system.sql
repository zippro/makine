-- Todo System Migration
-- Run this in Supabase SQL Editor

-- Todo Lists (linked to folders)
CREATE TABLE IF NOT EXISTS todo_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES project_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Todo Items
CREATE TABLE IF NOT EXISTS todo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_list_id UUID NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default Tasks Template (per project)
CREATE TABLE IF NOT EXISTS default_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  order_index INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_todo_lists_project ON todo_lists(project_id);
CREATE INDEX IF NOT EXISTS idx_todo_lists_folder ON todo_lists(folder_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_list ON todo_items(todo_list_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_order ON todo_items(todo_list_id, order_index);
CREATE INDEX IF NOT EXISTS idx_default_tasks_project ON default_tasks(project_id);

-- Enable RLS
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for authenticated users - adjust as needed)
CREATE POLICY "Allow all for auth users" ON todo_lists FOR ALL USING (true);
CREATE POLICY "Allow all for auth users" ON todo_items FOR ALL USING (true);
CREATE POLICY "Allow all for auth users" ON default_tasks FOR ALL USING (true);
