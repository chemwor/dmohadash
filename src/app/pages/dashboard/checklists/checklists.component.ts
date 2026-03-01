import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { ChecklistsService } from '../../../core/services/checklists.service';
import { ChecklistItem, ChecklistCategory, ChecklistStatus } from '../../../interfaces/dashboard.interfaces';

@Component({
  selector: 'app-checklists',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSkeletonComponent],
  templateUrl: './checklists.component.html'
})
export class ChecklistsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  items: ChecklistItem[] = [];
  loading = false;
  error = '';
  seeding = false;

  // Filters
  filterMonth: string = '';
  filterCategory: string = '';
  filterStatus: string = '';

  // Expanded item
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

  months: { value: string; label: string }[] = [
    { value: '', label: 'All Months' },
    { value: '1', label: 'Month 1' },
    { value: '2', label: 'Month 2' },
    { value: '3', label: 'Month 3' },
    { value: '4', label: 'Month 4' },
    { value: '5', label: 'Month 5' },
    { value: '6', label: 'Month 6' }
  ];

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
    if (this.filterMonth) filters.month = parseInt(this.filterMonth, 10);

    this.checklistsService.getAll(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.items = data;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load checklists';
        }
      });
  }

  onFilterChange(): void {
    this.loadItems();
  }

  toggleItem(item: ChecklistItem): void {
    if (!item.id) return;
    const newStatus: ChecklistStatus = item.status === 'done' ? 'pending' : 'done';
    this.checklistsService.update(item.id, { status: newStatus })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          const idx = this.items.findIndex(i => i.id === item.id);
          if (idx !== -1) this.items[idx] = { ...this.items[idx], ...updated };
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
}
