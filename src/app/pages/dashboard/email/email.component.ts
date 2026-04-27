import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { EmailService, EmailDashboardData, ResendWindow, FunnelWindow, RecentSend } from '../../../core/services/email.service';

type Tab = 'funnel' | 'sends';

@Component({
  selector: 'app-email',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-4 md:p-6 lg:p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-100">Email</h1>
          <p class="text-xs text-slate-500 mt-0.5">Resend sends + funnel capture</p>
        </div>
        <button (click)="reload()" [disabled]="loading"
          class="btn-secondary text-sm flex items-center gap-2">
          @if (loading) {
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Loading...
          } @else {
            Refresh
          }
        </button>
      </div>

      <!-- Top stat tiles (always visible) -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Captured Yesterday</div>
          <div class="text-2xl font-bold text-slate-100">{{ data?.funnel?.yesterday?.total_unique ?? 0 }}</div>
          <div class="text-[10px] text-slate-500 mt-1">7d: {{ data?.funnel?.week?.total_unique ?? 0 }}</div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Sent Yesterday</div>
          <div class="text-2xl font-bold text-slate-100">{{ data?.resend?.yesterday?.total ?? 0 }}</div>
          <div class="text-[10px] text-slate-500 mt-1">7d: {{ data?.resend?.week?.total ?? 0 }}</div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Delivery Rate (7d)</div>
          <div class="text-2xl font-bold text-green-400">{{ data?.resend?.week?.delivery_rate_pct ?? 0 }}%</div>
          <div class="text-[10px] text-slate-500 mt-1">{{ data?.resend?.week?.counts?.delivered ?? 0 }} delivered</div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Click Rate (7d)</div>
          <div class="text-2xl font-bold text-indigo-400">{{ data?.clicks?.week?.click_rate_pct ?? 0 }}%</div>
          <div class="text-[10px] text-slate-500 mt-1">{{ data?.clicks?.week?.distinct_clickers ?? 0 }} of {{ data?.clicks?.week?.links_sent ?? 0 }} clicked</div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Bounce Rate (7d)</div>
          <div [class]="(data?.resend?.week?.bounce_rate_pct ?? 0) > 5 ? 'text-2xl font-bold text-red-400' : 'text-2xl font-bold text-slate-300'">
            {{ data?.resend?.week?.bounce_rate_pct ?? 0 }}%
          </div>
          <div class="text-[10px] text-slate-500 mt-1">{{ data?.resend?.week?.counts?.bounced ?? 0 }} bounced</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-6 bg-slate-800 rounded-lg p-1">
        <button
          (click)="activeTab = 'funnel'"
          [class]="activeTab === 'funnel'
            ? 'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-md bg-indigo-500 text-white'
            : 'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-md text-slate-400 hover:text-slate-200'">
          Funnel
        </button>
        <button
          (click)="activeTab = 'sends'"
          [class]="activeTab === 'sends'
            ? 'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-md bg-indigo-500 text-white'
            : 'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-md text-slate-400 hover:text-slate-200'">
          Recent Sends
        </button>
      </div>

      @if (activeTab === 'funnel') {
        @if (!data) {
          <div class="card text-center py-12 text-slate-500">Loading…</div>
        } @else {
          <!-- Funnel stage breakdown -->
          <div class="grid lg:grid-cols-3 gap-4 mb-6">
            @for (window of [
              { key: 'today', label: 'Today', data: data.funnel.today },
              { key: 'yesterday', label: 'Yesterday', data: data.funnel.yesterday },
              { key: 'week', label: 'Last 7 Days', data: data.funnel.week }
            ]; track window.key) {
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-sm font-semibold text-slate-200">{{ window.label }}</h3>
                  <span class="text-xs text-slate-500">{{ window.data.total_unique }} unique</span>
                </div>
                @if (window.data.total_unique === 0) {
                  <p class="text-xs text-slate-500 italic">No funnel events</p>
                } @else {
                  <div class="space-y-2">
                    @for (stage of stageRows(window.data); track stage.name) {
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-slate-300">{{ stageLabel(stage.name) }}</span>
                        <span class="px-2 py-0.5 rounded bg-slate-700 text-slate-200 font-medium">{{ stage.count }}</span>
                      </div>
                    }
                  </div>
                  <div class="mt-3 pt-3 border-t border-slate-700">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-slate-400">Nudges sent</span>
                      <span class="text-slate-300">{{ window.data.nudges_sent }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <div class="card">
            <h3 class="text-sm font-semibold text-slate-200 mb-2">Funnel notes</h3>
            <ul class="text-xs text-slate-400 space-y-1">
              <li>• <strong class="text-slate-300">quick_preview_complete</strong> — case finished initial wizard step</li>
              <li>• <strong class="text-slate-300">full_preview_viewed</strong> — user reached the preview page (deeper intent)</li>
              <li>• <strong class="text-slate-300">legal_referral_requested</strong> — case flagged as needing an attorney</li>
              <li>• Nudges fire automatically every 30 min for stalled funnel members</li>
            </ul>
          </div>
        }
      }

      @if (activeTab === 'sends') {
        <!-- Per-window breakdown -->
        <div class="grid lg:grid-cols-3 gap-4 mb-6">
          @for (w of [
            { key: 'today', label: 'Today', data: data?.resend?.today },
            { key: 'yesterday', label: 'Yesterday', data: data?.resend?.yesterday },
            { key: 'week', label: 'Last 7 Days', data: data?.resend?.week }
          ]; track w.key) {
            <div class="card">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-slate-200">{{ w.label }}</h3>
                <span class="text-xs text-slate-500">{{ w.data?.total ?? 0 }} sent</span>
              </div>
              @if ((w.data?.total ?? 0) === 0) {
                <p class="text-xs text-slate-500 italic">No sends</p>
              } @else {
                <div class="space-y-1.5 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="text-green-400">Delivered</span>
                    <span class="text-slate-200">{{ w.data?.counts?.delivered }}</span>
                  </div>
                  @if ((w.data?.counts?.opened ?? 0) > 0) {
                    <div class="flex items-center justify-between">
                      <span class="text-blue-400">Opened</span>
                      <span class="text-slate-200">{{ w.data?.counts?.opened }}</span>
                    </div>
                  }
                  @if ((w.data?.counts?.clicked ?? 0) > 0) {
                    <div class="flex items-center justify-between">
                      <span class="text-indigo-400">Clicked</span>
                      <span class="text-slate-200">{{ w.data?.counts?.clicked }}</span>
                    </div>
                  }
                  @if ((w.data?.counts?.bounced ?? 0) > 0) {
                    <div class="flex items-center justify-between">
                      <span class="text-red-400">Bounced</span>
                      <span class="text-slate-200">{{ w.data?.counts?.bounced }}</span>
                    </div>
                  }
                  @if ((w.data?.counts?.complained ?? 0) > 0) {
                    <div class="flex items-center justify-between">
                      <span class="text-orange-400">Complained</span>
                      <span class="text-slate-200">{{ w.data?.counts?.complained }}</span>
                    </div>
                  }
                  @if ((w.data?.counts?.queued ?? 0) > 0) {
                    <div class="flex items-center justify-between">
                      <span class="text-slate-400">Queued</span>
                      <span class="text-slate-300">{{ w.data?.counts?.queued }}</span>
                    </div>
                  }
                </div>
                <div class="mt-3 pt-3 border-t border-slate-700 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400">Delivery</span>
                    <span class="text-green-400 font-medium">{{ w.data?.delivery_rate_pct }}%</span>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Recent sends list -->
        <div class="card">
          <h3 class="text-sm font-semibold text-slate-200 mb-3">Recent Sends</h3>
          @if (!data || data.recent_sends.length === 0) {
            <p class="text-xs text-slate-500 italic">No recent sends</p>
          } @else {
            <div class="space-y-2">
              @for (s of data.recent_sends; track s.id) {
                <div class="flex items-start justify-between gap-3 py-2 border-b border-slate-700/50 last:border-0">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-0.5">
                      <span class="text-xs text-slate-200 font-medium truncate">{{ s.subject }}</span>
                      <span [class]="eventBadgeClass(s.last_event)">{{ s.last_event }}</span>
                    </div>
                    <p class="text-[11px] text-slate-500 truncate">to {{ s.to }} · {{ formatDate(s.created_at) }}</p>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class EmailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  data: EmailDashboardData | null = null;
  loading = true;
  activeTab: Tab = 'funnel';

  constructor(private emailService: EmailService) {}

  ngOnInit(): void { this.reload(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  reload(): void {
    this.loading = true;
    this.emailService.getData().pipe(takeUntil(this.destroy$)).subscribe(d => {
      this.data = d;
      this.loading = false;
    });
  }

  stageRows(f: FunnelWindow): Array<{ name: string; count: number }> {
    return Object.entries(f.by_stage)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  stageLabel(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  formatDate(s: string): string {
    if (!s) return '';
    try {
      const d = new Date(s);
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return s; }
  }

  eventBadgeClass(ev: string): string {
    const base = 'px-1.5 py-0.5 rounded text-[10px] font-medium leading-none';
    switch ((ev || '').toLowerCase()) {
      case 'delivered': return `${base} bg-green-500/20 text-green-400`;
      case 'opened': return `${base} bg-blue-500/20 text-blue-400`;
      case 'clicked': return `${base} bg-indigo-500/20 text-indigo-400`;
      case 'bounced': return `${base} bg-red-500/20 text-red-400`;
      case 'complained': return `${base} bg-orange-500/20 text-orange-400`;
      case 'queued':
      case 'sent': return `${base} bg-slate-600/40 text-slate-300`;
      default: return `${base} bg-slate-700 text-slate-400`;
    }
  }
}
