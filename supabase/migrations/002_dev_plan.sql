-- Dev Plan System Migration
-- Global development plan with versions and tasks

-- Dev Plan Versions (e.g., v1.0, v1.1, v2.0)
CREATE TABLE IF NOT EXISTS dev_plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dev Plan Tasks (tasks under each version)
CREATE TABLE IF NOT EXISTS dev_plan_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES dev_plan_versions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dev_plan_versions_order ON dev_plan_versions(order_index);
CREATE INDEX IF NOT EXISTS idx_dev_plan_tasks_version ON dev_plan_tasks(version_id);
CREATE INDEX IF NOT EXISTS idx_dev_plan_tasks_order ON dev_plan_tasks(version_id, order_index);

-- Enable RLS
ALTER TABLE dev_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_plan_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for authenticated users)
CREATE POLICY "Allow all for auth users" ON dev_plan_versions FOR ALL USING (true);
CREATE POLICY "Allow all for auth users" ON dev_plan_tasks FOR ALL USING (true);
