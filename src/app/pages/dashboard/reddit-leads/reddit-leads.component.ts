import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { LeadsService, Lead } from '../../../core/services/leads.service';

@Component({
  selector: 'app-reddit-leads',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4 md:p-6 lg:p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <h1 class="text-xl md:text-2xl font-bold text-slate-100">Reddit Leads</h1>
          @if (newCount > 0) {
            <span class="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold">
              {{ newCount }} new
            </span>
          }
        </div>
        <button
          (click)="runScraper()"
          [disabled]="scraperRunning"
          class="btn-primary text-sm flex items-center gap-2"
        >
          @if (scraperRunning) {
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Scanning...
          } @else {
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Run Scraper
          }
        </button>
      </div>

      <!-- Daily Progress -->
      <div class="mb-4 bg-slate-800 rounded-lg p-3 border border-slate-700">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs text-slate-400">Today's Replies</span>
          <span [class]="'text-sm font-bold ' + (repliedToday >= dailyGoal ? 'text-green-400' : 'text-slate-100')">
            {{ repliedToday }}/{{ dailyGoal }}
          </span>
        </div>
        <div class="w-full bg-slate-700 rounded-full h-2">
          <div
            class="h-2 rounded-full transition-all duration-500"
            [class]="repliedToday >= dailyGoal ? 'bg-green-500' : 'bg-indigo-500'"
            [style.width.%]="Math.min(100, (repliedToday / dailyGoal) * 100)"
          ></div>
        </div>
        @if (repliedToday >= dailyGoal) {
          <p class="text-[10px] text-green-400 mt-1">Goal hit. Nice work.</p>
        } @else {
          <p class="text-[10px] text-slate-500 mt-1">{{ dailyGoal - repliedToday }} more to go</p>
        }
      </div>

      <!-- Scraper feedback -->
      @if (scraperMessage) {
        <div [class]="'mb-4 p-3 rounded-lg text-sm ' + (scraperOk ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400')">
          {{ scraperMessage }}
          <button (click)="scraperMessage = ''" class="ml-2 text-xs opacity-60 hover:opacity-100">dismiss</button>
        </div>
      }

      <!-- Filter Tabs -->
      <div class="flex gap-1 mb-6 bg-slate-800 rounded-lg p-1">
        @for (tab of tabs; track tab.key) {
          <button
            (click)="activeTab = tab.key; loadLeads()"
            [class]="activeTab === tab.key
              ? 'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-md bg-indigo-500 text-white transition-colors'
              : 'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-md text-slate-400 hover:text-slate-200 transition-colors'"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      <!-- Loading -->
      @if (loading) {
        <div class="space-y-3">
          @for (i of [1,2,3,4]; track i) {
            <div class="card">
              <div class="skeleton h-4 w-16 mb-2 rounded"></div>
              <div class="skeleton h-5 w-full mb-2 rounded"></div>
              <div class="skeleton h-4 w-24 rounded"></div>
            </div>
          }
        </div>
      } @else if (leads.length === 0) {
        <div class="card text-center py-12">
          <svg class="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <p class="text-slate-400 text-sm">No {{ activeTab === 'all' ? '' : activeTab }} leads found</p>
          @if (activeTab === 'new') {
            <button (click)="runScraper()" [disabled]="scraperRunning" class="btn-primary text-sm mt-4">
              Run Scraper to Find Leads
            </button>
          }
        </div>
      } @else {
        <!-- Lead Cards -->
        <div class="space-y-3">
          @for (lead of leads; track lead.id) {
            <div class="card hover:border-slate-600 transition-colors">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <!-- Subreddit + Score -->
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[11px] font-medium">
                      r/{{ lead.subreddit }}
                    </span>
                    <span [class]="'px-2 py-0.5 rounded text-[11px] font-bold ' + scoreBadgeClass(lead.score)">
                      {{ lead.score }}
                    </span>
                    @if (lead.status !== 'new') {
                      <span [class]="'px-2 py-0.5 rounded text-[11px] font-medium ' + statusBadgeClass(lead.status)">
                        {{ lead.status }}
                      </span>
                    }
                  </div>

                  <!-- Title -->
                  <p class="text-sm text-slate-100 font-medium line-clamp-2 mb-1.5">{{ lead.title }}</p>

                  <!-- Timestamp -->
                  <p class="text-xs text-slate-500">{{ timeAgo(lead.created_utc) }}</p>
                </div>

                <!-- Actions -->
                <div class="flex flex-col gap-1.5 flex-shrink-0">
                  <a
                    [href]="lead.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-primary text-xs text-center"
                  >
                    Open Post
                  </a>
                  <button
                    (click)="openDraftReply(lead)"
                    [disabled]="drafting[lead.id]"
                    class="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
                  >
                    {{ drafting[lead.id] ? 'Drafting...' : 'Draft Reply' }}
                  </button>
                  @if (lead.status === 'new') {
                    <button
                      (click)="markStatus(lead, 'replied')"
                      class="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors"
                    >
                      Replied
                    </button>
                    <button
                      (click)="markStatus(lead, 'skipped')"
                      class="px-3 py-1.5 bg-slate-700 text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-600 transition-colors"
                    >
                      Not Relevant
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Draft Reply Modal -->
    @if (draftLead) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" (click)="closeDraft()">
        <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between p-5 border-b border-slate-700">
            <div class="flex-1 min-w-0 mr-4">
              <div class="flex items-center gap-2 mb-0.5">
                <h3 class="text-lg font-semibold text-slate-100">Draft Reply</h3>
                @if (draftCategory === 'promo_ok') {
                  <span class="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-[10px] font-medium uppercase tracking-wider">Promo OK</span>
                } @else if (draftCategory === 'helpful_only') {
                  <span class="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-medium uppercase tracking-wider">Helpful Only</span>
                }
              </div>
              <p class="text-xs text-slate-400 truncate">r/{{ draftLead.subreddit }} : {{ draftLead.title }}</p>
              @if (draftCategory === 'helpful_only') {
                <p class="text-[10px] text-amber-400/70 mt-1">No product mention. This person already has legal help or the topic isn't a fit for DMHOA.</p>
              }
            </div>
            <button (click)="closeDraft()" class="text-slate-500 hover:text-slate-300 text-2xl leading-none">&times;</button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            @if (draftLoading) {
              <div class="flex items-center gap-3 text-slate-400 py-8 justify-center">
                <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span class="text-sm">Scraping post and drafting reply...</span>
              </div>
            } @else if (draftError) {
              <div class="bg-red-500/10 border border-red-500/20 rounded p-3 text-sm text-red-400">{{ draftError }}</div>
            } @else if (draftText) {
              <textarea
                [(ngModel)]="draftText"
                class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                rows="14"
              ></textarea>
              <p class="text-[10px] text-slate-500">Edit freely. When you're happy with it, copy and paste to Reddit.</p>
            }
          </div>

          <div class="flex items-center justify-between gap-2 p-5 border-t border-slate-700">
            <a
              [href]="draftLead.url"
              target="_blank"
              rel="noopener"
              class="text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              Open post on Reddit
            </a>
            <div class="flex gap-2">
              @if (draftText && !draftLoading) {
                <button
                  (click)="copyDraft()"
                  class="px-4 py-2 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 font-medium"
                >
                  {{ copied ? 'Copied!' : 'Copy to Clipboard' }}
                </button>
                <button
                  (click)="copyAndMarkReplied()"
                  class="px-4 py-2 text-sm bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 font-medium"
                >
                  Copy + Mark Replied
                </button>
              }
              <button
                (click)="closeDraft()"
                class="px-4 py-2 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class RedditLeadsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  Math = Math;

  // Daily stats
  repliedToday = 0;
  dailyGoal = 10;

  // Draft reply state
  drafting: Record<string, boolean> = {};
  draftLead: Lead | null = null;
  draftText = '';
  draftCategory = '';
  draftLoading = false;
  draftError = '';
  copied = false;

  tabs = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'replied', label: 'Replied' },
    { key: 'skipped', label: 'Not Relevant' },
  ];

  activeTab = 'new';
  leads: Lead[] = [];
  loading = true;
  newCount = 0;

  scraperRunning = false;
  scraperMessage = '';
  scraperOk = true;

  constructor(private leadsService: LeadsService) {}

  ngOnInit(): void {
    this.loadLeads();
    this.loadNewCount();
    this.loadDailyStats();
  }

  loadDailyStats(): void {
    this.leadsService.getDailyStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.repliedToday = stats.replied_today;
        this.dailyGoal = stats.goal;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLeads(): void {
    this.loading = true;
    const status = this.activeTab === 'all' ? undefined : this.activeTab;
    this.leadsService.getLeads(status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (leads) => {
          this.leads = leads;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
  }

  loadNewCount(): void {
    this.leadsService.getLeads('new')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (leads) => {
          this.newCount = leads.length;
        }
      });
  }

  markStatus(lead: Lead, status: string): void {
    this.leadsService.updateStatus(lead.id, status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          const idx = this.leads.findIndex(l => l.id === lead.id);
          if (idx >= 0) {
            if (this.activeTab !== 'all' && updated.status !== this.activeTab) {
              this.leads.splice(idx, 1);
            } else {
              this.leads[idx] = updated;
            }
          }
          if (status === 'replied' || status === 'skipped') {
            this.newCount = Math.max(0, this.newCount - 1);
          }
          if (status === 'replied') {
            this.repliedToday++;
          }
        }
      });
  }

  runScraper(): void {
    this.scraperRunning = true;
    this.scraperMessage = '';

    this.leadsService.runScraper()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.scraperOk = true;
          this.scraperMessage = result.message || 'Scraper started. Refreshing in 30 seconds...';
          // Auto-refresh after 30 seconds to pick up new leads
          setTimeout(() => {
            this.loadLeads();
            this.loadNewCount();
            this.scraperRunning = false;
            this.scraperMessage = 'Leads refreshed.';
          }, 30000);
        },
        error: () => {
          this.scraperRunning = false;
          this.scraperOk = false;
          this.scraperMessage = 'Failed to start scraper';
        }
      });
  }

  scoreBadgeClass(score: number): string {
    if (score >= 5) return 'bg-green-500/20 text-green-400';
    if (score >= 3) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-slate-500/20 text-slate-400';
  }

  statusBadgeClass(status: string): string {
    if (status === 'replied') return 'bg-green-500/20 text-green-400';
    if (status === 'skipped') return 'bg-slate-500/20 text-slate-400';
    return 'bg-blue-500/20 text-blue-400';
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // --- Draft Reply ---

  openDraftReply(lead: Lead): void {
    this.draftLead = lead;
    this.draftText = '';
    this.draftCategory = '';
    this.draftError = '';
    this.draftLoading = true;
    this.copied = false;
    this.drafting[lead.id] = true;

    this.leadsService.draftReply(lead.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: any) => {
          this.draftLoading = false;
          this.drafting[lead.id] = false;
          if (result.ok && result.reply) {
            this.draftText = result.reply;
            this.draftCategory = result.category || 'unknown';
          } else {
            this.draftError = result.error || 'Failed to generate draft';
          }
        },
        error: () => {
          this.draftLoading = false;
          this.drafting[lead.id] = false;
          this.draftError = 'Network error generating draft';
        }
      });
  }

  closeDraft(): void {
    this.draftLead = null;
    this.draftText = '';
    this.draftError = '';
  }

  copyDraft(): void {
    if (!this.draftText) return;
    navigator.clipboard.writeText(this.draftText);
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }

  copyAndMarkReplied(): void {
    if (!this.draftText || !this.draftLead) return;
    navigator.clipboard.writeText(this.draftText);
    this.markStatus(this.draftLead, 'replied');
    this.copied = true;
    setTimeout(() => {
      this.closeDraft();
    }, 1000);
  }
}
