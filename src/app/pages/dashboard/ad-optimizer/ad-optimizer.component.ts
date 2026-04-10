import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AdOptimizerService, AdProposal } from '../../../core/services/ad-optimizer.service';

@Component({
  selector: 'app-ad-optimizer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-4 md:p-6 lg:p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-100">Ad Optimizer</h1>
          <p class="text-sm text-slate-400 mt-1">Google Ads automation with manual approval</p>
        </div>
        <div class="flex gap-2">
          <button
            (click)="runAnalyzer()"
            [disabled]="analyzing"
            class="btn-secondary text-sm flex items-center gap-2"
          >
            @if (analyzing) {
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Analyzing...
            } @else {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2"/>
              </svg>
              Run Analyzer
            }
          </button>
          <button
            (click)="launchM1()"
            [disabled]="launching"
            class="btn-primary text-sm flex items-center gap-2"
          >
            @if (launching) {
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Launching...
            } @else {
              + Launch M1 Campaign
            }
          </button>
        </div>
      </div>

      <!-- Banner -->
      @if (banner) {
        <div [class]="'mb-4 p-3 rounded-lg text-sm ' + (bannerOk ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400')">
          {{ banner }}
          <button (click)="banner = ''" class="ml-2 text-xs opacity-60 hover:opacity-100">dismiss</button>
        </div>
      }

      <!-- Filter Tabs -->
      <div class="flex gap-1 mb-6 bg-slate-800 rounded-lg p-1 overflow-x-auto">
        @for (tab of tabs; track tab.key) {
          <button
            (click)="activeTab = tab.key; loadProposals()"
            [class]="activeTab === tab.key
              ? 'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-md bg-indigo-500 text-white whitespace-nowrap'
              : 'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-md text-slate-400 hover:text-slate-200 whitespace-nowrap'"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      <!-- Loading -->
      @if (loading) {
        <div class="space-y-3">
          @for (i of [1,2,3]; track i) {
            <div class="card">
              <div class="skeleton h-4 w-32 mb-2 rounded"></div>
              <div class="skeleton h-5 w-full mb-2 rounded"></div>
              <div class="skeleton h-4 w-48 rounded"></div>
            </div>
          }
        </div>
      } @else if (proposals.length === 0) {
        <div class="card text-center py-12">
          <svg class="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-slate-400 text-sm">
            @if (activeTab === 'pending') {
              No pending proposals. The analyzer runs daily, or click "Run Analyzer" to check now.
            } @else {
              No {{ activeTab }} proposals.
            }
          </p>
        </div>
      } @else {
        <div class="space-y-3">
          @for (p of proposals; track p.id) {
            <div class="card">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <span [class]="'px-2 py-0.5 rounded text-[11px] font-medium ' + typeBadgeClass(p.type)">
                      {{ typeLabel(p.type) }}
                    </span>
                    @if (p.status !== 'pending') {
                      <span [class]="'px-2 py-0.5 rounded text-[11px] font-medium ' + statusBadgeClass(p.status)">
                        {{ p.status }}
                      </span>
                    }
                    <span class="text-[11px] text-slate-500">{{ timeAgo(p.created_at) }}</span>
                  </div>

                  <p class="text-sm text-slate-100 font-medium mb-2">{{ p.reason }}</p>

                  <!-- Payload details -->
                  <div class="text-xs text-slate-400 space-y-0.5">
                    @if (p.payload['keyword_text']) {
                      <div><span class="text-slate-500">Keyword:</span> <span class="text-slate-300">{{ p.payload['keyword_text'] }}</span></div>
                    }
                    @if (p.payload['search_term']) {
                      <div><span class="text-slate-500">Search term:</span> <span class="text-slate-300">{{ p.payload['search_term'] }}</span></div>
                    }
                    @if (p.payload['campaign_name']) {
                      <div><span class="text-slate-500">Campaign:</span> <span class="text-slate-300">{{ p.payload['campaign_name'] }}</span></div>
                    }
                    @if (p.payload['clicks_14d'] !== undefined) {
                      <div><span class="text-slate-500">14d clicks:</span> <span class="text-slate-300">{{ p.payload['clicks_14d'] }}</span></div>
                    }
                    @if (p.payload['cost_14d_usd'] !== undefined) {
                      <div><span class="text-slate-500">14d cost:</span> <span class="text-amber-400">\${{ p.payload['cost_14d_usd'] }}</span></div>
                    }
                    @if (p.payload['ctr_14d'] !== undefined) {
                      <div><span class="text-slate-500">CTR:</span> <span class="text-slate-300">{{ (p.payload['ctr_14d'] * 100).toFixed(2) }}%</span></div>
                    }
                  </div>
                </div>

                <!-- Actions -->
                @if (p.status === 'pending') {
                  <div class="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      (click)="approve(p)"
                      [disabled]="working[p.id]"
                      class="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      {{ working[p.id] ? '...' : 'Approve' }}
                    </button>
                    <button
                      (click)="reject(p)"
                      [disabled]="working[p.id]"
                      class="px-3 py-1.5 bg-slate-700 text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                }
              </div>

              @if (p.apply_result?.error) {
                <div class="mt-3 pt-3 border-t border-red-500/20 text-xs text-red-400">
                  Error: {{ p.apply_result.error }}
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AdOptimizerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  tabs = [
    { key: 'pending', label: 'Pending' },
    { key: 'applied', label: 'Applied' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'failed', label: 'Failed' },
  ];

  activeTab = 'pending';
  proposals: AdProposal[] = [];
  loading = true;
  working: Record<string, boolean> = {};

  launching = false;
  analyzing = false;
  banner = '';
  bannerOk = true;

  constructor(private optimizer: AdOptimizerService) {}

  ngOnInit(): void {
    this.loadProposals();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProposals(): void {
    this.loading = true;
    this.optimizer.listProposals(this.activeTab)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (proposals) => {
          this.proposals = proposals;
          this.loading = false;
        },
        error: () => { this.loading = false; },
      });
  }

  launchM1(): void {
    if (!confirm('Create the M1 Google Ads campaign? It will be created in PAUSED state for safety — you can review and enable it in the Google Ads UI.')) return;

    this.launching = true;
    this.banner = '';
    this.optimizer.launchM1()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.launching = false;
          this.bannerOk = result.ok;
          if (result.ok) {
            const s = result.summary;
            this.banner = `Campaign created (PAUSED). ${s?.keywords_added || 0} keywords, ${s?.ads_added || 0} ads, ${s?.negatives_added || 0} negatives. Review in Google Ads then enable.`;
          } else {
            this.banner = result.error || 'Launch failed';
          }
        },
        error: () => {
          this.launching = false;
          this.bannerOk = false;
          this.banner = 'Launch failed';
        }
      });
  }

  runAnalyzer(): void {
    this.analyzing = true;
    this.banner = '';
    this.optimizer.analyze()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.analyzing = false;
          this.bannerOk = result.ok ?? false;
          if (result.ok) {
            this.banner = `Analyzer complete. ${result.proposals_created || 0} new proposals created.`;
            if (this.activeTab === 'pending') this.loadProposals();
          } else {
            this.banner = result.error || 'Analyzer failed';
          }
        },
        error: () => {
          this.analyzing = false;
          this.bannerOk = false;
          this.banner = 'Analyzer failed';
        }
      });
  }

  approve(p: AdProposal): void {
    this.working[p.id] = true;
    this.optimizer.approveProposal(p.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.working[p.id] = false;
          if (result.ok) {
            this.proposals = this.proposals.filter(x => x.id !== p.id);
          } else {
            p.status = 'failed';
            p.apply_result = result.result;
          }
        },
        error: (err) => {
          this.working[p.id] = false;
          p.status = 'failed';
          p.apply_result = { error: err?.error?.error || err.message };
        }
      });
  }

  reject(p: AdProposal): void {
    this.working[p.id] = true;
    this.optimizer.rejectProposal(p.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.working[p.id] = false;
          this.proposals = this.proposals.filter(x => x.id !== p.id);
        },
        error: () => { this.working[p.id] = false; }
      });
  }

  typeBadgeClass(type: string): string {
    switch (type) {
      case 'pause_keyword': return 'bg-orange-500/20 text-orange-400';
      case 'add_negative': return 'bg-red-500/20 text-red-400';
      case 'budget_alert': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  }

  typeLabel(type: string): string {
    switch (type) {
      case 'pause_keyword': return 'Pause Keyword';
      case 'add_negative': return 'Add Negative';
      case 'budget_alert': return 'Budget Alert';
      default: return type;
    }
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'applied': return 'bg-green-500/20 text-green-400';
      case 'rejected': return 'bg-slate-500/20 text-slate-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  }
}
