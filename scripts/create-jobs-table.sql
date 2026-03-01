-- Create table for storing ad suggestion job state
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ad_suggestion_jobs (
  id SERIAL PRIMARY KEY,
  job_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups by job_id
CREATE INDEX IF NOT EXISTS idx_ad_suggestion_jobs_job_id ON ad_suggestion_jobs(job_id);

-- Create index for cleanup of old jobs
CREATE INDEX IF NOT EXISTS idx_ad_suggestion_jobs_created_at ON ad_suggestion_jobs(created_at);

-- Auto-cleanup: Delete jobs older than 1 hour (optional - can be run as a cron job)
-- DELETE FROM ad_suggestion_jobs WHERE created_at < NOW() - INTERVAL '1 hour';

-- Grant access (adjust as needed for your RLS policies)
ALTER TABLE ad_suggestion_jobs ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
CREATE POLICY "Service role has full access to ad_suggestion_jobs"
  ON ad_suggestion_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);
