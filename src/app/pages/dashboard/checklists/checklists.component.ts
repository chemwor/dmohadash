import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { ChecklistsService } from '../../../core/services/checklists.service';
import { ChecklistItem, ChecklistCategory, ChecklistStatus } from '../../../interfaces/dashboard.interfaces';

interface MonthGroup {
  month: number;
  label: string;
  dateLabel: string;
  items: ChecklistItem[];
  doneCount: number;
  totalCount: number;
  progressPct: number;
}

@Component({
  selector: 'app-checklists',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSkeletonComponent],
  templateUrl: './checklists.component.html'
})
export class ChecklistsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  items: ChecklistItem[] = [];
  monthGroups: MonthGroup[] = [];
  loading = false;
  error = '';
  seeding = false;

  // Filters
  filterCategory: string = '';
  filterStatus: string = '';

  // Collapsed months (collapsed by default, track which are open)
  expandedMonths: Set<number> = new Set();

  // Expanded item detail
  expandedId: string | null = null;
  notesBuffer: Record<string, string> = {};

  categories: { value: string; label: string }[] = [
    { value: '', label: 'All Categories' },
    { value: 'google_ads', label: 'Google Ads' },
    { value: 'content_seo', label: 'Content/SEO' },
    { value: 'social', label: 'Social' },
    { value: 'media', label: 'Media' },
    { value: 'product', label: 'Product' },
    { value: 'email', label: 'Email' },
    { value: 'ops', label: 'Ops' },
    { value: 'finance', label: 'Finance' },
    { value: 'legal', label: 'Legal' }
  ];

  // Month labels aligned to the 6-month plan (March 2026 – August 2026)
  private monthLabels: Record<number, { label: string; dateLabel: string }> = {
    1: { label: 'Month 1', dateLabel: 'March 2026' },
    2: { label: 'Month 2', dateLabel: 'April 2026' },
    3: { label: 'Month 3', dateLabel: 'May 2026' },
    4: { label: 'Month 4', dateLabel: 'June 2026' },
    5: { label: 'Month 5', dateLabel: 'July 2026' },
    6: { label: 'Month 6', dateLabel: 'August 2026' },
  };

  constructor(private checklistsService: ChecklistsService) {}

  ngOnInit(): void {
    this.loadItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadItems(): void {
    this.loading = true;
    this.error = '';

    const filters: any = {};
    if (this.filterCategory) filters.category = this.filterCategory as ChecklistCategory;
    if (this.filterStatus) filters.status = this.filterStatus as ChecklistStatus;

    this.checklistsService.getAll(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.items = data;
          this.buildMonthGroups();
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load checklists';
        }
      });
  }

  private buildMonthGroups(): void {
    const grouped: Record<number, ChecklistItem[]> = {};
    for (const item of this.items) {
      const m = item.month || 0;
      if (!grouped[m]) grouped[m] = [];
      grouped[m].push(item);
    }

    this.monthGroups = Object.keys(grouped)
      .map(Number)
      .filter(m => m > 0)
      .sort((a, b) => a - b)
      .map(m => {
        const items = grouped[m];
        const doneCount = items.filter(i => i.status === 'done').length;
        return {
          month: m,
          label: this.monthLabels[m]?.label || `Month ${m}`,
          dateLabel: this.monthLabels[m]?.dateLabel || '',
          items,
          doneCount,
          totalCount: items.length,
          progressPct: items.length > 0 ? (doneCount / items.length) * 100 : 0
        };
      });

    // Add ungrouped items as "General" if any
    if (grouped[0]?.length) {
      const items = grouped[0];
      const doneCount = items.filter(i => i.status === 'done').length;
      this.monthGroups.push({
        month: 0,
        label: 'General',
        dateLabel: 'Ongoing',
        items,
        doneCount,
        totalCount: items.length,
        progressPct: items.length > 0 ? (doneCount / items.length) * 100 : 0
      });
    }
  }

  onFilterChange(): void {
    this.loadItems();
  }

  toggleMonth(month: number): void {
    if (this.expandedMonths.has(month)) {
      this.expandedMonths.delete(month);
    } else {
      this.expandedMonths.add(month);
    }
  }

  isMonthExpanded(month: number): boolean {
    return this.expandedMonths.has(month);
  }

  toggleItem(item: ChecklistItem, group: MonthGroup): void {
    if (!item.id) return;
    const newStatus: ChecklistStatus = item.status === 'done' ? 'pending' : 'done';
    this.checklistsService.update(item.id, { status: newStatus })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          const idx = group.items.findIndex(i => i.id === item.id);
          if (idx !== -1) group.items[idx] = { ...group.items[idx], ...updated };
          // Recalc group stats
          group.doneCount = group.items.filter(i => i.status === 'done').length;
          group.progressPct = group.totalCount > 0 ? (group.doneCount / group.totalCount) * 100 : 0;
        }
      });
  }

  toggleExpand(id: string | undefined): void {
    if (!id) return;
    this.expandedId = this.expandedId === id ? null : id;
  }

  saveNotes(item: ChecklistItem): void {
    if (!item.id) return;
    const notes = this.notesBuffer[item.id];
    if (notes === undefined) return;
    this.checklistsService.update(item.id, { notes } as any)
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  seedChecklists(): void {
    this.seeding = true;
    this.checklistsService.seed()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.seeding = false;
          this.loadItems();
        },
        error: () => {
          this.seeding = false;
        }
      });
  }

  get doneCount(): number {
    return this.items.filter(i => i.status === 'done').length;
  }

  get totalCount(): number {
    return this.items.length;
  }

  get progressPct(): number {
    return this.totalCount > 0 ? (this.doneCount / this.totalCount) * 100 : 0;
  }

  getPriorityDot(priority: string): string {
    switch (priority) {
      case 'high': return 'bg-red-400';
      case 'medium': return 'bg-amber-400';
      case 'low': return 'bg-green-400';
      default: return 'bg-slate-400';
    }
  }

  getCategoryBadge(category: string): string {
    const map: Record<string, string> = {
      google_ads: 'bg-blue-500/20 text-blue-400',
      content_seo: 'bg-emerald-500/20 text-emerald-400',
      social: 'bg-pink-500/20 text-pink-400',
      media: 'bg-orange-500/20 text-orange-400',
      product: 'bg-purple-500/20 text-purple-400',
      email: 'bg-cyan-500/20 text-cyan-400',
      ops: 'bg-slate-500/20 text-slate-400',
      finance: 'bg-yellow-500/20 text-yellow-400',
      legal: 'bg-red-500/20 text-red-400'
    };
    return map[category] || 'bg-slate-500/20 text-slate-400';
  }

  getCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      google_ads: 'Ads',
      content_seo: 'SEO',
      social: 'Social',
      media: 'Media',
      product: 'Product',
      email: 'Email',
      ops: 'Ops',
      finance: 'Finance',
      legal: 'Legal'
    };
    return map[category] || category;
  }
}
