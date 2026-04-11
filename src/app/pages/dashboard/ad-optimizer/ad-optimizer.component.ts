import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AdOptimizerService, AdProposal } from '../../../core/services/ad-optimizer.service';

@Component({
  selector: 'app-ad-optimizer',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
            (click)="generateCopy()"
            [disabled]="generatingCopy"
            class="btn-secondary text-sm flex items-center gap-2"
          >
            @if (generatingCopy) {
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Writing...
            } @else {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Generate Fresh Copy
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

                  <!-- New Ad Copy proposal: show headlines + descriptions -->
                  @if (p.type === 'new_ad_copy') {
                    <div class="mt-3 space-y-3">
                      @if (p.payload['ad_group_name']) {
                        <div class="text-xs text-slate-500">
                          Ad Group: <span class="text-slate-300">{{ p.payload['ad_group_name'] }}</span>
                        </div>
                      }
                      @if (p.payload['rationale']) {
                        <div class="px-3 py-2 bg-indigo-500/5 border-l-2 border-indigo-500/40 rounded text-xs text-slate-300">
                          <span class="text-indigo-400 font-medium">Angle:</span> {{ p.payload['rationale'] }}
                        </div>
                      }
                      @if (p.payload['current_metrics_14d']) {
                        <div class="text-[10px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>14d: {{ p.payload['current_metrics_14d']['clicks'] || 0 }} clicks,</span>
                          <span>{{ p.payload['current_metrics_14d']['impressions'] || 0 }} impressions,</span>
                          <span>{{ p.payload['current_metrics_14d']['conversions'] || 0 }} conversions,</span>
                          <span>CTR {{ ((p.payload['current_metrics_14d']['ctr'] || 0) * 100).toFixed(2) }}%</span>
                        </div>
                      }

                      @if (p.payload['headlines']?.length) {
                        <div>
                          <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Headlines ({{ p.payload['headlines'].length }})</p>
                          <ul class="space-y-1">
                            @for (h of p.payload['headlines']; track $index) {
                              <li class="text-xs text-slate-200 px-2 py-1 bg-slate-800 rounded flex items-center justify-between gap-2">
                                <span class="truncate">{{ h }}</span>
                                <span class="text-[10px] text-slate-500 flex-shrink-0">{{ h.length }}/30</span>
                              </li>
                            }
                          </ul>
                        </div>
                      }

                      @if (p.payload['descriptions']?.length) {
                        <div>
                          <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Descriptions ({{ p.payload['descriptions'].length }})</p>
                          <ul class="space-y-1">
                            @for (d of p.payload['descriptions']; track $index) {
                              <li class="text-xs text-slate-200 px-2 py-1.5 bg-slate-800 rounded flex items-start justify-between gap-2">
                                <span>{{ d }}</span>
                                <span class="text-[10px] text-slate-500 flex-shrink-0">{{ d.length }}/90</span>
                              </li>
                            }
                          </ul>
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Actions -->
                @if (p.status === 'pending') {
                  <div class="flex flex-col gap-1.5 flex-shrink-0">
                    @if (p.type === 'new_ad_copy') {
                      <button
                        (click)="openReview(p)"
                        [disabled]="working[p.id]"
                        class="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      >
                        Review &amp; Create
                      </button>
                    } @else {
                      <button
                        (click)="approve(p)"
                        [disabled]="working[p.id]"
                        class="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      >
                        {{ working[p.id] ? '...' : 'Approve' }}
                      </button>
                    }
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

    <!-- Review Modal: confirms ad creation, allows last-minute edits -->
    @if (reviewProposal) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" (click)="cancelReview()">
        <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-center justify-between p-5 border-b border-slate-700">
            <div>
              <h3 class="text-lg font-semibold text-slate-100">Review New Ad</h3>
              <p class="text-xs text-slate-400 mt-0.5">Confirm or edit before publishing to Google Ads</p>
            </div>
            <button (click)="cancelReview()" class="text-slate-500 hover:text-slate-300 text-2xl leading-none">&times;</button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div class="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Destination</p>
              <p class="text-sm text-slate-100">Ad Group: <span class="text-indigo-400">{{ reviewProposal.payload['ad_group_name'] }}</span></p>
              <p class="text-xs text-slate-400 mt-1 break-all">{{ reviewProposal.payload['final_url'] }}</p>
            </div>

            @if (reviewProposal.payload['rationale']) {
              <div class="bg-indigo-500/5 border-l-2 border-indigo-500/40 px-3 py-2 rounded">
                <p class="text-[10px] uppercase tracking-wider text-indigo-400 mb-1">Strategic Angle</p>
                <p class="text-xs text-slate-300">{{ reviewProposal.payload['rationale'] }}</p>
              </div>
            }

            <!-- Editable Headlines -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <p class="text-[10px] uppercase tracking-wider text-slate-500">Headlines (3-15, max 30 chars each)</p>
                <span class="text-[10px] text-slate-500">{{ editHeadlines.length }} total</span>
              </div>
              <div class="space-y-1.5">
                @for (h of editHeadlines; track i; let i = $index) {
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      [(ngModel)]="editHeadlines[i]"
                      maxlength="30"
                      class="flex-1 px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <span [class]="'text-[10px] w-10 text-right ' + (editHeadlines[i].length > 30 ? 'text-red-400' : 'text-slate-500')">
                      {{ editHeadlines[i].length }}/30
                    </span>
                    <button (click)="removeHeadline(i)" class="text-slate-500 hover:text-red-400 text-xs px-1">&times;</button>
                  </div>
                }
              </div>
              @if (editHeadlines.length < 15) {
                <button (click)="addHeadline()" class="text-[11px] text-indigo-400 hover:text-indigo-300 mt-2">+ Add headline</button>
              }
            </div>

            <!-- Editable Descriptions -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <p class="text-[10px] uppercase tracking-wider text-slate-500">Descriptions (2-4, max 90 chars each)</p>
                <span class="text-[10px] text-slate-500">{{ editDescriptions.length }} total</span>
              </div>
              <div class="space-y-1.5">
                @for (d of editDescriptions; track i; let i = $index) {
                  <div class="flex items-start gap-2">
                    <textarea
                      [(ngModel)]="editDescriptions[i]"
                      maxlength="90"
                      rows="2"
                      class="flex-1 px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                    ></textarea>
                    <span [class]="'text-[10px] w-10 text-right pt-2 ' + (editDescriptions[i].length > 90 ? 'text-red-400' : 'text-slate-500')">
                      {{ editDescriptions[i].length }}/90
                    </span>
                    <button (click)="removeDescription(i)" class="text-slate-500 hover:text-red-400 text-xs px-1 pt-2">&times;</button>
                  </div>
                }
              </div>
              @if (editDescriptions.length < 4) {
                <button (click)="addDescription()" class="text-[11px] text-indigo-400 hover:text-indigo-300 mt-2">+ Add description</button>
              }
            </div>

            <!-- Validation warning -->
            @if (reviewError) {
              <div class="bg-red-500/10 border border-red-500/30 rounded px-3 py-2 text-xs text-red-400">
                {{ reviewError }}
              </div>
            }

            <p class="text-[10px] text-slate-500 italic">
              When you confirm, this ad goes live in Google Ads and will start serving against your existing ads automatically. The campaign must be enabled for traffic to start.
            </p>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-2 p-5 border-t border-slate-700">
            <button
              (click)="cancelReview()"
              class="px-4 py-2 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              (click)="confirmReview()"
              [disabled]="reviewSubmitting"
              class="px-4 py-2 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 font-medium disabled:opacity-50"
            >
              {{ reviewSubmitting ? 'Creating...' : 'Confirm &amp; Create Ad' }}
            </button>
          </div>
        </div>
      </div>
    }
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
  generatingCopy = false;
  banner = '';
  bannerOk = true;

  // Review modal state
  reviewProposal: AdProposal | null = null;
  editHeadlines: string[] = [];
  editDescriptions: string[] = [];
  reviewSubmitting = false;
  reviewError = '';

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

  generateCopy(): void {
    this.generatingCopy = true;
    this.banner = '';
    this.optimizer.generateCopy()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: any) => {
          this.bannerOk = result.ok;
          if (!result.ok) {
            this.generatingCopy = false;
            this.banner = result.error || 'Copy generation failed';
            return;
          }
          this.banner = result.message || 'Writing fresh copy in the background. Refreshing in 45 seconds...';
          // Auto-refresh after 45s to pick up new proposals
          setTimeout(() => {
            this.generatingCopy = false;
            this.banner = 'Refreshed. Check the Pending tab.';
            if (this.activeTab === 'pending') this.loadProposals();
          }, 45000);
        },
        error: () => {
          this.generatingCopy = false;
          this.bannerOk = false;
          this.banner = 'Copy generation failed';
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

  // --- Review modal for new_ad_copy proposals ---

  openReview(p: AdProposal): void {
    this.reviewProposal = p;
    this.editHeadlines = [...(p.payload['headlines'] || [])];
    this.editDescriptions = [...(p.payload['descriptions'] || [])];
    this.reviewError = '';
    this.reviewSubmitting = false;
  }

  cancelReview(): void {
    if (this.reviewSubmitting) return;
    this.reviewProposal = null;
    this.editHeadlines = [];
    this.editDescriptions = [];
    this.reviewError = '';
  }

  addHeadline(): void {
    if (this.editHeadlines.length < 15) this.editHeadlines.push('');
  }

  removeHeadline(i: number): void {
    if (this.editHeadlines.length > 3) this.editHeadlines.splice(i, 1);
  }

  addDescription(): void {
    if (this.editDescriptions.length < 4) this.editDescriptions.push('');
  }

  removeDescription(i: number): void {
    if (this.editDescriptions.length > 2) this.editDescriptions.splice(i, 1);
  }

  confirmReview(): void {
    if (!this.reviewProposal) return;

    // Validate
    const headlines = this.editHeadlines.map(h => h.trim()).filter(Boolean);
    const descriptions = this.editDescriptions.map(d => d.trim()).filter(Boolean);

    if (headlines.length < 3) {
      this.reviewError = 'Need at least 3 headlines.';
      return;
    }
    if (headlines.length > 15) {
      this.reviewError = 'Maximum 15 headlines.';
      return;
    }
    if (descriptions.length < 2) {
      this.reviewError = 'Need at least 2 descriptions.';
      return;
    }
    if (descriptions.length > 4) {
      this.reviewError = 'Maximum 4 descriptions.';
      return;
    }
    const tooLongHeadline = headlines.find(h => h.length > 30);
    if (tooLongHeadline) {
      this.reviewError = `Headline over 30 chars: "${tooLongHeadline}"`;
      return;
    }
    const tooLongDescription = descriptions.find(d => d.length > 90);
    if (tooLongDescription) {
      this.reviewError = `Description over 90 chars: "${tooLongDescription}"`;
      return;
    }

    this.reviewSubmitting = true;
    this.reviewError = '';

    const p = this.reviewProposal;
    const override = { headlines, descriptions };

    this.optimizer.approveProposal(p.id, override)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.reviewSubmitting = false;
          if (result.ok) {
            this.proposals = this.proposals.filter(x => x.id !== p.id);
            this.reviewProposal = null;
            this.editHeadlines = [];
            this.editDescriptions = [];
            this.banner = `Created new ad in ${p.payload['ad_group_name'] || 'ad group'}.`;
            this.bannerOk = true;
          } else {
            this.reviewError = result.result?.error || 'Failed to create ad';
          }
        },
        error: (err) => {
          this.reviewSubmitting = false;
          this.reviewError = err?.error?.error || err?.message || 'Failed to create ad';
        }
      });
  }

  typeBadgeClass(type: string): string {
    switch (type) {
      case 'pause_keyword': return 'bg-orange-500/20 text-orange-400';
      case 'add_negative': return 'bg-red-500/20 text-red-400';
      case 'budget_alert': return 'bg-yellow-500/20 text-yellow-400';
      case 'new_ad_copy': return 'bg-indigo-500/20 text-indigo-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  }

  typeLabel(type: string): string {
    switch (type) {
      case 'pause_keyword': return 'Pause Keyword';
      case 'add_negative': return 'Add Negative';
      case 'budget_alert': return 'Budget Alert';
      case 'new_ad_copy': return 'New Ad Copy';
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
