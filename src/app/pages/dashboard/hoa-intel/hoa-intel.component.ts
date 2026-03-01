import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { HoaIntelService, HoaNewsArticle, HoaNewsResponse } from '../../../core/services/hoa-intel.service';

@Component({
  selector: 'app-hoa-intel',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent],
  templateUrl: './hoa-intel.component.html'
})
export class HoaIntelComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  articles: HoaNewsArticle[] = [];
  loading = false;
  error = '';
  scanning = false;

  activeFilter: string = '';

  constructor(private hoaIntelService: HoaIntelService) {}

  ngOnInit(): void {
    this.loadArticles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadArticles(): void {
    this.loading = true;
    this.error = '';

    this.hoaIntelService.getArticles(this.activeFilter || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: HoaNewsResponse) => {
          this.articles = data.articles;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load intel';
        }
      });
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
    this.loadArticles();
  }

  scanNews(): void {
    this.scanning = true;
    this.hoaIntelService.scanNews()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.scanning = false;
          this.loadArticles();
        },
        error: () => {
          this.scanning = false;
        }
      });
  }

  updateStatus(article: HoaNewsArticle, status: 'new' | 'reviewed' | 'archived'): void {
    this.hoaIntelService.updateStatus(article.id, status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (status === 'archived') {
            this.articles = this.articles.filter(a => a.id !== article.id);
          } else {
            const idx = this.articles.findIndex(a => a.id === article.id);
            if (idx !== -1) this.articles[idx] = { ...this.articles[idx], status };
          }
        }
      });
  }

  getCategoryIcon(category: string): string {
    switch (category?.toLowerCase()) {
      case 'legislation': return 'scale';
      case 'enforcement': return 'shield';
      case 'legal': return 'gavel';
      case 'financial': return 'currency';
      default: return 'newspaper';
    }
  }

  getCategoryBadge(category: string): string {
    switch (category?.toLowerCase()) {
      case 'legislation': return 'bg-purple-500/20 text-purple-400';
      case 'enforcement': return 'bg-red-500/20 text-red-400';
      case 'legal': return 'bg-amber-500/20 text-amber-400';
      case 'financial': return 'bg-green-500/20 text-green-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  }

  getSentimentColor(sentiment: string): string {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'text-green-400';
      case 'negative': return 'text-red-400';
      default: return 'text-slate-400';
    }
  }
}
