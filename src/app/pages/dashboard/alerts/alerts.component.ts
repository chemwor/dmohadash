import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, interval } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { AlertsService } from '../../../core/services/alerts.service';
import { Alert, AlertsResponse, AlertSeverity } from '../../../interfaces/dashboard.interfaces';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent],
  templateUrl: './alerts.component.html'
})
export class AlertsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  alerts: Alert[] = [];
  unacknowledgedCounts = { critical: 0, warning: 0, info: 0 };
  loading = false;
  error = '';
  scanning = false;

  activeFilter: AlertSeverity | 'all' = 'all';
  showAcknowledged = false;

  constructor(private alertsService: AlertsService) {}

  ngOnInit(): void {
    this.loadAlerts();

    // Auto-refresh every 60 seconds
    interval(60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadAlerts());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAlerts(): void {
    this.loading = true;
    this.error = '';

    const filters: any = {};
    if (this.activeFilter !== 'all') filters.severity = this.activeFilter;
    if (!this.showAcknowledged) filters.acknowledged = false;

    this.alertsService.getAll(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: AlertsResponse) => {
          this.alerts = data.alerts;
          this.unacknowledgedCounts = data.unacknowledged_counts;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load alerts';
        }
      });
  }

  setFilter(filter: AlertSeverity | 'all'): void {
    this.activeFilter = filter;
    this.loadAlerts();
  }

  toggleAcknowledged(): void {
    this.showAcknowledged = !this.showAcknowledged;
    this.loadAlerts();
  }

  acknowledgeAlert(alert: Alert): void {
    if (!alert.id) return;
    this.alertsService.acknowledge(alert.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.alerts = this.alerts.filter(a => a.id !== alert.id);
          if (this.unacknowledgedCounts[alert.severity as keyof typeof this.unacknowledgedCounts] !== undefined) {
            (this.unacknowledgedCounts as any)[alert.severity]--;
          }
        }
      });
  }

  runScan(): void {
    this.scanning = true;
    this.alertsService.scan()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.scanning = false;
          this.loadAlerts();
        },
        error: () => {
          this.scanning = false;
        }
      });
  }

  getSeverityBg(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 border-red-500/30';
      case 'warning': return 'bg-amber-500/10 border-amber-500/30';
      case 'info': return 'bg-blue-500/10 border-blue-500/30';
      default: return 'bg-slate-700 border-slate-600';
    }
  }

  getSeverityDot(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-400';
      case 'warning': return 'bg-amber-400';
      case 'info': return 'bg-blue-400';
      default: return 'bg-slate-400';
    }
  }

  getSeverityText(severity: string): string {
    switch (severity) {
      case 'critical': return 'text-red-400';
      case 'warning': return 'text-amber-400';
      case 'info': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  }

  getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  get totalUnacknowledged(): number {
    return this.unacknowledgedCounts.critical + this.unacknowledgedCounts.warning + this.unacknowledgedCounts.info;
  }
}
