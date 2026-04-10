create table ad_proposals (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied', 'failed')),
  apply_result jsonb,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index on ad_proposals (status);
create index on ad_proposals (created_at desc);
create index on ad_proposals (type);
