import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { CommandCenterService } from '../../../core/services/command-center.service';
import { ChecklistsService } from '../../../core/services/checklists.service';
import { DailyGardenService, GardenTask } from '../../../core/services/daily-garden.service';
import { EmailFunnelService, FunnelMetrics } from '../../../core/services/email-funnel.service';
import { CommandCenterData, ChecklistItem } from '../../../interfaces/dashboard.interfaces';

@Component({
  selector: 'app-command-center',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSkeletonComponent],
  templateUrl: './command-center.component.html'
})
export class CommandCenterComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  data: CommandCenterData | null = null;
  loading = false;
  error = '';
  lastUpdated: Date | null = null;

  // Watering the Garden — daily growth tasks
  gardenTasks: GardenTask[] = [
    { key: 'reddit_replies', label: 'Reply to 5+ Reddit leads', description: 'Open Reddit Leads, draft replies, copy + paste to Reddit', link: '/dashboard/reddit-leads', completed: false },
    { key: 'content_post', label: 'Post 1 piece of content', description: 'TikTok, Reel, or blog post from the content pipeline', link: '/dashboard/content', completed: false },
    { key: 'check_ads', label: 'Check Google Ads performance', description: 'Review spend, CTR, conversions. Approve/reject any proposals.', link: '/dashboard/marketing', completed: false },
    { key: 'social_engage', label: 'Engage on social media', description: 'Comment on 3 HOA-related posts on TikTok, IG, or Facebook', completed: false },
    { key: 'check_funnel', label: 'Check the email funnel', description: 'Review funnel metrics above. Are people stalling? Run nudges if needed.', completed: false },
    { key: 'review_leads', label: 'Review new Reddit leads', description: 'Run the scraper, mark irrelevant ones, prioritize high-score leads', link: '/dashboard/reddit-leads', completed: false },
  ];
  gardenCompleted = 0;

  // Email funnel metrics
  funnel: FunnelMetrics | null = null;
  funnelLoading = false;

  constructor(
    private commandCenterService: CommandCenterService,
    private checklistsService: ChecklistsService,
    private gardenService: DailyGardenService,
    private funnelService: EmailFunnelService,
  ) {}

  ngOnInit(): void {
    this.loadData();

    // Auto-refresh every 5 minutes
    interval(5 * 60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadData());

    this.loadGarden();
    this.loadFunnel();
  }

  loadFunnel(): void {
    this.funnelLoading = true;
    this.funnelService.getMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.funnel = data;
        this.funnelLoading = false;
      });
  }

  loadGarden(): void {
    this.gardenService.getCompletions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        const completions = result.completions || {};
        this.gardenTasks.forEach(t => {
          t.completed = !!completions[t.key];
        });
        this.gardenCompleted = this.gardenTasks.filter(t => t.completed).length;
      });
  }

  toggleGardenTask(task: GardenTask): void {
    const newState = !task.completed;
    task.completed = newState;
    this.gardenCompleted = this.gardenTasks.filter(t => t.completed).length;
    this.gardenService.toggle(task.key, newState)
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';

    this.commandCenterService.getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.data = data;
          this.loading = false;
          this.lastUpdated = new Date();
          if (data.error) {
            this.error = data.error;
          }
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load command center data';
        }
      });
  }

  onChecklistToggle(item: ChecklistItem): void {
    if (!item.id) return;
    const newStatus = item.status === 'done' ? 'pending' : 'done';
    this.checklistsService.update(item.id, { status: newStatus })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          item.status = newStatus as any;
          if (this.data?.checklists) {
            if (newStatus === 'done') {
              this.data.checklists.done++;
            } else {
              this.data.checklists.done--;
            }
            this.data.checklists.pct = this.data.checklists.total > 0
              ? this.data.checklists.done / this.data.checklists.total
              : 0;
          }
        }
      });
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'text-red-400';
      case 'warning': return 'text-amber-400';
      case 'info': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  }

  formatPercent(value: number): string {
    return (value * 100).toFixed(1) + '%';
  }
}
