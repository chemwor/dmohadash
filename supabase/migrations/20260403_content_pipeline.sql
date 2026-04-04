-- Content Production Pipeline Tables
-- These tables support the video content workflow for HOA-themed social media videos.

-- Video Ideas: seed concepts for video content
create table video_ideas (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'board_meeting', 'doorbell_footage', 'street_confrontation',
    'official_document', 'news_broadcast', 'homeowner_pov'
  )),
  scenario text not null,
  violation_type text not null,
  fine_amount integer not null default 0,
  status text not null default 'idea' check (status in (
    'idea', 'prompt_ready', 'generating', 'review', 'approved', 'published'
  )),
  created_at timestamptz not null default now()
);

-- Video Prompts: shot-by-shot breakdown and script for a video idea
create table video_prompts (
  id uuid primary key default gen_random_uuid(),
  video_idea_id uuid not null references video_ideas(id),
  shots jsonb not null default '[]'::jsonb,
  script text not null default '',
  shot_count integer not null default 0,
  total_duration integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now()
);

-- Video Assets: individual shot files generated from prompts
create table video_assets (
  id uuid primary key default gen_random_uuid(),
  video_idea_id uuid not null references video_ideas(id),
  shot_number integer not null,
  kling_job_id text,
  file_url text,
  duration integer not null default 0,
  status text not null default 'generating' check (status in (
    'generating', 'ready', 'rejected'
  )),
  created_at timestamptz not null default now()
);

-- Video Posts: final assembled video and platform-specific copy
create table video_posts (
  id uuid primary key default gen_random_uuid(),
  video_idea_id uuid not null references video_ideas(id),
  final_video_url text,
  platforms jsonb not null default '[]'::jsonb,
  copy jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in (
    'draft', 'copy_approved', 'scheduled', 'published'
  )),
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);
