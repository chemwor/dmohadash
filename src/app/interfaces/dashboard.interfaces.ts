// ============================================================================
// Shared Dashboard Interfaces
// ============================================================================

// --- Command Center ---
export interface CommandCenterData {
  revenue: {
    today: number;
    week: number;
    month: number;
  };
  cases: {
    new_today: number;
    paid_today: number;
    pending_analysis: number;
    conversion_rate_7d: number;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
    total_unacknowledged: number;
  };
  checklists: {
    done: number;
    total: number;
    pct: number;
    top_pending: ChecklistItem[];
  };
  health: {
    site_up: boolean;
    site_response_ms: number;
    last_scan: string;
  };
  quick_stats: {
    klaviyo_list_size: number;
    ads_spend_today: number;
    ads_cpa_today: number;
  };
  daily_summary_preview: string;
  error?: string;
}

// --- Checklists ---
export type ChecklistCategory =
  | 'google_ads'
  | 'content_seo'
  | 'social'
  | 'media'
  | 'product'
  | 'email'
  | 'ops'
  | 'finance'
  | 'legal';

export type ChecklistPriority = 'high' | 'medium' | 'low';
export type ChecklistStatus = 'pending' | 'done';

export interface ChecklistItem {
  id?: string;
  source_doc: string;
  title: string;
  description: string;
  category: ChecklistCategory;
  month: number | null;
  priority: ChecklistPriority;
  due_date: string | null;
  status: ChecklistStatus;
  completed_at?: string | null;
  notes?: string;
  created_at: string;
}

export interface SeedChecklistsResponse {
  seeded: Record<string, number>;
  skipped: string[];
  total: number;
}

// --- Alerts ---
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id?: string;
  alert_type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  data: Record<string, any>;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

export interface AlertsResponse {
  alerts: Alert[];
  unacknowledged_counts: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface AlertScanResponse {
  scan_completed: boolean;
  alerts_created: number;
  timestamp: string;
}

// --- Chat ---
export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  context_used?: { sources: string[] };
  created_at: string;
}

export interface ChatResponse {
  response: string;
  context_used: string[];
  tokens_used: {
    input: number;
    output: number;
  };
}

// --- Daily Summary ---
export interface DailySummary {
  date: string;
  summary: {
    executive_summary: string;
    revenue: {
      today: number;
      mtd: number;
      target: number;
      pace: 'on_track' | 'behind' | 'ahead';
    };
    cases: {
      new_today: number;
      paid_today: number;
      mtd_paid: number;
      conversion_rate: number;
    };
    ads: {
      spend_today: number;
      clicks: number;
      cpa: number;
      ctr: number;
      grade: string;
    };
    email: {
      list_size: number;
      new_subscribers: number;
    };
    costs: {
      api_today: number;
    };
    alerts_active: number;
    checklist_progress: {
      done: number;
      total: number;
      pct: number;
    };
    top_3_actions: string[];
    risks: string[];
    wins: string[];
  };
  summary_text: string;
  generated_at?: string;
  error?: string;
}

export interface SendSummaryResponse {
  sent: boolean;
  to: string;
}

// --- Six-Month Plan ---
export interface MonthPlan {
  month: number;
  name: string;
  theme: string;
  budget_planned: number;
  budget_actual: number;
  checklist_done: number;
  checklist_total: number;
  status: 'active' | 'completed' | 'upcoming';
}

export interface GradeMetric {
  value: number;
  grade: string;
}

export interface SixMonthPlan {
  current_month: number;
  months: MonthPlan[];
  current_grades: {
    traffic: {
      monthly_visitors: GradeMetric;
      google_ads_ctr: GradeMetric;
      organic_share: GradeMetric;
    };
    conversion: {
      site_conversion: GradeMetric;
      email_open_rate: GradeMetric;
      preview_to_paid: GradeMetric;
    };
    revenue: {
      monthly_revenue: GradeMetric;
      cac_ltv_ratio: GradeMetric;
      roas: GradeMetric;
    };
  };
  scenario: {
    current: 'good' | 'bad' | 'ugly';
    label: string;
    f_count_by_category: Record<string, number>;
    pivot_triggered: boolean;
    pivot_reason: string;
  };
  overall_progress: number;
  error?: string;
}

// --- Costs ---
export interface CostsData {
  period: string;
  revenue: {
    gross: number;
    stripe_fees: number;
    net: number;
  };
  costs: {
    google_ads: { mtd: number; daily_avg: number };
    openai_api: { mtd: number; today: number };
    claude_api: { mtd: number; today: number; total_calls: number };
    heroku: { mtd: number };
    supabase: { mtd: number };
    tools: { mtd: number };
    total: number;
  };
  margin: {
    net_revenue: number;
    total_costs: number;
    profit: number;
    margin_pct: number;
  };
  burn_rate_daily: number;
  break_even: boolean;
  error?: string;
}

// --- Features ---
export type FeatureStatus = 'proposed' | 'accepted' | 'done';

export interface FeatureRequest {
  id?: string;
  title: string;
  description: string;
  source?: string;
  target_repo: string;
  estimated_effort: string;
  priority: string;
  status: FeatureStatus;
  implementation_prompt?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface FeaturePromptResponse {
  prompt: string;
  feature_id: string;
  tokens_used: {
    input: number;
    output: number;
  };
}

// --- AI Feature Suggestions ---
export interface FeatureSuggestion {
  title: string;
  description: string;
  category: string;
  target_repo: string;
  estimated_effort: string;
  priority: string;
  data_basis: string;
}

export interface FeatureSuggestionsResponse {
  suggestions: FeatureSuggestion[];
  data_sources: string[];
  tokens_used: {
    input: number;
    output: number;
  };
}

// --- Document References ---
export interface DocReference {
  id?: string;
  doc_key: string;
  doc_name: string;
  doc_url?: string | null;
  summary_text: string;
  key_points: string[];
  last_refreshed: string | null;
  created_at: string;
}
