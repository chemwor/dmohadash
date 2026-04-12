import { createClient } from '@supabase/supabase-js';

// Public anon key (safe to expose in frontend — RLS protects data)
const SUPABASE_URL = 'https://yvdwrkhntyutpnklxsvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2ZHdya2hudHl1dHBua2x4c3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDY3NTQsImV4cCI6MjA4MjA4Mjc1NH0.dFkoPjA60c9MH6C_YWYChehG3nKHHK3VKmKj0w722SU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
