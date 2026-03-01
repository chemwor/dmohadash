import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { CommandCenterService } from '../../../core/services/command-center.service';
import { ChecklistsService } from '../../../core/services/checklists.service';
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

  constructor(
    private commandCenterService: CommandCenterService,
    private checklistsService: ChecklistsService
  ) {}

  ngOnInit(): void {
    this.loadData();

    // Auto-refresh every 5 minutes
    interval(5 * 60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadData());
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
