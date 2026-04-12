-- Daily "Watering the Garden" task completion tracking.
-- One row per task per day. Resets daily.
create table daily_garden (
  id uuid primary key default gen_random_uuid(),
  task_date date not null default current_date,
  task_key text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (task_date, task_key)
);

create index on daily_garden (task_date);
