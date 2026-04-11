import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TestFunnelService, TestCase } from '../../../core/services/test-funnel.service';

@Component({
  selector: 'app-test-pipeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4 md:p-6 lg:p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-100">Test Pipeline</h1>
          <p class="text-sm text-slate-400 mt-1">Test the email funnel and case analysis end to end. Test cases are tagged and isolated from production data.</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button
            (click)="runNudges()"
            [disabled]="working['nudges']"
            class="btn-secondary text-sm flex items-center gap-2"
          >
            @if (working['nudges']) {
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Running...
            } @else {
              Run Nudges Now
            }
          </button>
          <button
            (click)="deleteAll()"
            [disabled]="working['deleteAll'] || cases.length === 0"
            class="px-3 py-1.5 text-xs md:text-sm font-medium bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
          >
            {{ working['deleteAll'] ? 'Deleting...' : 'Delete All Test Cases' }}
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

      <!-- Create Test Case -->
      <div class="card mb-6">
        <h2 class="section-header mb-3">Create New Test Case</h2>
        <div class="flex gap-2 flex-wrap">
          <input
            type="email"
            [(ngModel)]="newEmail"
            placeholder="test@your-email.com"
            class="input-field flex-1 min-w-[200px]"
            (keyup.enter)="create()"
          />
          <button
            (click)="create()"
            [disabled]="working['create'] || !newEmail"
            class="btn-primary text-sm whitespace-nowrap"
          >
            {{ working['create'] ? 'Creating...' : 'Create Test Case' }}
          </button>
        </div>
        <p class="text-xs text-slate-500 mt-2">
          Use a real email you can check. The test will fire actual emails through Resend. The case is tagged and can be cleaned up afterwards.
        </p>
      </div>

      <!-- Cases List -->
      <div class="flex items-center justify-between mb-3">
        <h2 class="section-header mb-0">Active Test Cases</h2>
        <button (click)="loadCases()" [disabled]="loading" class="text-xs text-indigo-400 hover:text-indigo-300">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>

      @if (loading && cases.length === 0) {
        <div class="space-y-2">
          @for (i of [1,2,3]; track i) {
            <div class="card">
              <div class="skeleton h-4 w-48 mb-2 rounded"></div>
              <div class="skeleton h-3 w-32 rounded"></div>
            </div>
          }
        </div>
      } @else if (cases.length === 0) {
        <div class="card text-center py-12">
          <p class="text-slate-400 text-sm">No test cases yet. Create one above to get started.</p>
        </div>
      } @else {
        <div class="space-y-3">
          @for (c of cases; track c.token) {
            <div class="card">
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-2">
                    <span class="text-sm font-medium text-slate-100">{{ c.email }}</span>
                    <span [class]="'px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ' + stageBadgeClass(c.funnel?.stage)">
                      {{ c.funnel?.stage || 'no funnel' }}
                    </span>
                    @if (c.has_plan) {
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-400">plan ready</span>
                    }
                  </div>
                  <div class="text-[11px] text-slate-500 space-x-3">
                    <span>Token: <code class="text-slate-400">{{ c.token }}</code></span>
                    <span>Created: {{ timeAgo(c.created_at) }}</span>
                  </div>
                  @if (c.funnel) {
                    <div class="text-[11px] text-slate-500 mt-1 space-x-2">
                      Nudges sent:
                      <span [class]="c.funnel.nudge_1_sent ? 'text-green-400' : 'text-slate-600'">1</span>
                      <span [class]="c.funnel.nudge_2_sent ? 'text-green-400' : 'text-slate-600'">2</span>
                      <span [class]="c.funnel.nudge_3_sent ? 'text-green-400' : 'text-slate-600'">3</span>
                    </div>
                  }
                </div>

                <!-- Actions -->
                <div class="flex flex-wrap gap-1.5 flex-shrink-0">
                  @if (c.funnel?.stage === 'quick_preview_complete') {
                    <button
                      (click)="advance(c, 'full_preview_viewed')"
                      [disabled]="working[c.token]"
                      class="px-2.5 py-1 text-[11px] bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 disabled:opacity-50"
                    >
                      → Full Preview
                    </button>
                  }
                  @if (c.funnel?.stage === 'full_preview_viewed' || c.funnel?.stage === 'quick_preview_complete') {
                    <button
                      (click)="advance(c, 'purchased')"
                      [disabled]="working[c.token]"
                      class="px-2.5 py-1 text-[11px] bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50"
                    >
                      → Purchased
                    </button>
                  }
                  @if (!c.has_plan) {
                    <button
                      (click)="generatePlan(c)"
                      [disabled]="working[c.token]"
                      class="px-2.5 py-1 text-[11px] bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 disabled:opacity-50"
                    >
                      Generate Plan
                    </button>
                  }
                  <button
                    (click)="deleteOne(c)"
                    [disabled]="working[c.token]"
                    class="px-2.5 py-1 text-[11px] bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TestPipelineComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  cases: TestCase[] = [];
  loading = false;
  newEmail = '';
  banner = '';
  bannerOk = true;
  working: Record<string, boolean> = {};

  constructor(private testFunnel: TestFunnelService) {}

  ngOnInit(): void {
    // Default to a clean test address
    this.newEmail = `test+${Date.now()}@disputemyhoa.com`;
    this.loadCases();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCases(): void {
    this.loading = true;
    this.testFunnel.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.cases = result.cases || [];
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  create(): void {
    if (!this.newEmail) return;
    this.working['create'] = true;
    this.banner = '';
    this.testFunnel.create(this.newEmail)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.working['create'] = false;
          if (result.ok) {
            this.bannerOk = true;
            this.banner = `Test case created. Quick preview email sent to ${result.email}.`;
            this.newEmail = `test+${Date.now()}@disputemyhoa.com`;
            this.loadCases();
          } else {
            this.bannerOk = false;
            this.banner = result.error || 'Failed to create test case';
          }
        }
      });
  }

  advance(c: TestCase, stage: 'full_preview_viewed' | 'purchased'): void {
    this.working[c.token] = true;
    this.testFunnel.advance(c.token, stage)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: any) => {
          this.working[c.token] = false;
          if (result.ok) {
            this.bannerOk = true;
            this.banner = result.message || `Advanced to ${stage}`;
            this.loadCases();
          } else {
            this.bannerOk = false;
            this.banner = result.error || 'Advance failed';
          }
        }
      });
  }

  generatePlan(c: TestCase): void {
    if (!confirm(`Generate full Claude case analysis for ${c.email}? This costs API tokens.`)) return;
    this.working[c.token] = true;
    this.testFunnel.generatePlan(c.token)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: any) => {
          this.working[c.token] = false;
          if (result.ok) {
            this.bannerOk = true;
            this.banner = result.message || 'Plan generation started in background. Refreshing in 60 seconds.';
            setTimeout(() => this.loadCases(), 60000);
          } else {
            this.bannerOk = false;
            this.banner = result.error || 'Plan generation failed';
          }
        }
      });
  }

  runNudges(): void {
    this.working['nudges'] = true;
    this.banner = '';
    this.testFunnel.runNudges()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.working['nudges'] = false;
          if (result.ok) {
            this.bannerOk = true;
            const total = (result.nudge_1_sent || 0) + (result.nudge_2_sent || 0) + (result.nudge_3_sent || 0);
            this.banner = `Nudge run complete. Sent ${total} (n1:${result.nudge_1_sent || 0}, n2:${result.nudge_2_sent || 0}, n3:${result.nudge_3_sent || 0}).`;
            this.loadCases();
          } else {
            this.bannerOk = false;
            this.banner = result.error || 'Nudge run failed';
          }
        }
      });
  }

  deleteOne(c: TestCase): void {
    if (!confirm(`Delete test case for ${c.email}? This removes the case, funnel row, and all related artifacts.`)) return;
    this.working[c.token] = true;
    this.testFunnel.deleteOne(c.token)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: any) => {
          this.working[c.token] = false;
          if (result.ok) {
            this.bannerOk = true;
            this.banner = `Deleted test case ${c.email}.`;
            this.cases = this.cases.filter(x => x.token !== c.token);
          } else {
            this.bannerOk = false;
            this.banner = result.error || 'Delete failed';
          }
        }
      });
  }

  deleteAll(): void {
    if (!confirm(`Delete ALL ${this.cases.length} test cases and every related Supabase row? This cannot be undone.`)) return;
    this.working['deleteAll'] = true;
    this.testFunnel.deleteAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: any) => {
          this.working['deleteAll'] = false;
          if (result.ok) {
            this.bannerOk = true;
            this.banner = `Deleted ${result.cases_deleted || 0} test cases.`;
            this.cases = [];
          } else {
            this.bannerOk = false;
            this.banner = result.error || 'Delete all failed';
          }
        }
      });
  }

  stageBadgeClass(stage: string | undefined): string {
    switch (stage) {
      case 'quick_preview_complete': return 'bg-blue-500/20 text-blue-400';
      case 'full_preview_viewed': return 'bg-amber-500/20 text-amber-400';
      case 'purchased': return 'bg-green-500/20 text-green-400';
      default: return 'bg-slate-500/20 text-slate-400';
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
