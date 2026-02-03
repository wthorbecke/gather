-- Add energy level column to tasks table
-- Energy levels: 'low', 'medium', 'high'
-- Helps users match tasks to their current energy state

-- Energy column
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS energy TEXT;

-- Pinned column (tasks pinned to top of list)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;

-- Calendar event ID (for Google Calendar sync)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- Add check constraint for valid energy values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_energy_check'
  ) THEN
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_energy_check
    CHECK (energy IS NULL OR energy IN ('low', 'medium', 'high'));
  END IF;
END $$;

-- Add index for filtering by energy level
CREATE INDEX IF NOT EXISTS idx_tasks_energy ON tasks(energy) WHERE energy IS NOT NULL;

-- Add index for pinned tasks
CREATE INDEX IF NOT EXISTS idx_tasks_pinned ON tasks(pinned) WHERE pinned = TRUE;

-- Comments for documentation
COMMENT ON COLUMN tasks.energy IS 'Energy level required: low (can do when tired), medium (moderate focus), high (peak energy needed)';
COMMENT ON COLUMN tasks.pinned IS 'Whether task is pinned to top of list';
COMMENT ON COLUMN tasks.calendar_event_id IS 'Google Calendar event ID if synced to calendar';
