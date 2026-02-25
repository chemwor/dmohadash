import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';

import { SupabaseService, SupabaseData, RecentCase, CompletedCase, SupabasePeriod } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-cases',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent, MetricCardComponent],
  templateUrl: './cases.component.html'
})
export class CasesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  supabaseData: SupabaseData | null = null;

  selectedPeriod: SupabasePeriod = 'week';
  periods = [
    { value: 'today' as SupabasePeriod, label: 'Today' },
    { value: 'week' as SupabasePeriod, label: 'This Week' },
    { value: 'month' as SupabasePeriod, label: 'This Month' },
    { value: 'all' as SupabasePeriod, label: 'All Time' }
  ];

  selectedFilter: 'all' | 'quick' | 'full' | 'purchased' = 'all';
  filters = [
    { value: 'all' as const, label: 'All Cases' },
    { value: 'quick' as const, label: 'Quick Preview' },
    { value: 'full' as const, label: 'Full Preview' },
    { value: 'purchased' as const, label: 'Purchased' }
  ];

  isLoading = false;
  error = '';
  lastRefreshed: Date | null = null;
  isRefreshing = false;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setPeriod(period: SupabasePeriod): void {
    this.selectedPeriod = period;
    this.loadData();
  }

  setFilter(filter: 'all' | 'quick' | 'full' | 'purchased'): void {
    this.selectedFilter = filter;
  }

  refreshAll(): void {
    this.isRefreshing = true;
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.error = '';

    this.supabaseService.getData(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.supabaseData = data;
          this.isLoading = false;
          this.isRefreshing = false;
          this.lastRefreshed = new Date();
          if (data.error) {
            this.error = data.error;
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.isRefreshing = false;
          this.error = err.message || 'Failed to load cases data';
        }
      });
  }

  get filteredCases(): RecentCase[] {
    if (!this.supabaseData?.recentCases) return [];

    return this.supabaseData.recentCases.filter(c => {
      switch (this.selectedFilter) {
        case 'quick':
          return c.type === 'quick';
        case 'full':
          return c.type === 'full';
        case 'purchased':
          return c.unlocked;
        default:
          return true;
      }
    });
  }

  getStatusClass(caseItem: RecentCase): string {
    if (caseItem.unlocked) {
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
    if (caseItem.type === 'full') {
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    }
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }

  getStatusLabel(caseItem: RecentCase): string {
    if (caseItem.unlocked) return 'Purchased';
    if (caseItem.type === 'full') return 'Full Preview';
    return 'Quick Preview';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  truncateText(text: string | null, maxLength: number = 50): string {
    if (!text) return 'N/A';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // Computed metrics
  getRevenuePerVisitor(): number {
    const totalCases = this.supabaseData?.totalCases || 0;
    if (totalCases === 0) return 0;
    return (this.supabaseData?.totalRevenue || 0) / totalCases;
  }

  getAvgCaseValue(): number {
    const purchases = this.supabaseData?.purchases || 0;
    if (purchases === 0) return 0;
    return (this.supabaseData?.totalRevenue || 0) / purchases;
  }

  getQuickToFullDropoff(): number {
    const quickPreviews = this.supabaseData?.quickPreviewCompletions || 0;
    const fullPreviews = this.supabaseData?.fullPreviewCompletions || 0;
    if (quickPreviews === 0) return 0;
    return ((quickPreviews - fullPreviews) / quickPreviews) * 100;
  }

  getFullToPurchaseDropoff(): number {
    const fullPreviews = this.supabaseData?.fullPreviewCompletions || 0;
    const purchases = this.supabaseData?.purchases || 0;
    if (fullPreviews === 0) return 0;
    return ((fullPreviews - purchases) / fullPreviews) * 100;
  }

  getPurchasedCount(): number {
    if (!this.supabaseData?.recentCases) return 0;
    return this.supabaseData.recentCases.filter(c => c.unlocked).length;
  }

  getQuickPreviewCount(): number {
    if (!this.supabaseData?.recentCases) return 0;
    return this.supabaseData.recentCases.filter(c => c.type === 'quick').length;
  }

  getFullPreviewCount(): number {
    if (!this.supabaseData?.recentCases) return 0;
    return this.supabaseData.recentCases.filter(c => c.type === 'full').length;
  }

  getNoticeTypeDistribution(): { type: string; count: number }[] {
    if (!this.supabaseData?.recentCases) return [];
    const distribution: { [key: string]: number } = {};
    this.supabaseData.recentCases.forEach(c => {
      const type = c.noticeType || 'Unknown';
      distribution[type] = (distribution[type] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  getNoticeTypePercentage(count: number): number {
    const total = this.supabaseData?.recentCases?.length || 0;
    if (total === 0) return 0;
    return (count / total) * 100;
  }

  // Completed cases methods
  getOutputStatusClass(status: string): string {
    switch (status) {
      case 'ready':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  }

  getOutputStatusLabel(status: string): string {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'pending':
        return 'Processing';
      case 'error':
        return 'Error';
      case 'no_output':
        return 'Awaiting';
      default:
        return 'Unknown';
    }
  }

  getOutputSuccessRate(): number {
    const stats = this.supabaseData?.outputStats;
    if (!stats || stats.total === 0) return 0;
    return (stats.ready / stats.total) * 100;
  }

  getOutputErrorRate(): number {
    const stats = this.supabaseData?.outputStats;
    if (!stats || stats.total === 0) return 0;
    return (stats.error / stats.total) * 100;
  }
}
