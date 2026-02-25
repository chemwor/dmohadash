import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';

import { HOANewsService, HOANewsData, HOAArticle, ArticleCategory } from '../../../core/services/hoa-news.service';

@Component({
  selector: 'app-hoa-news',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent],
  templateUrl: './hoa-news.component.html'
})
export class HOANewsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  newsData: HOANewsData | null = null;
  isLoading = false;
  error = '';
  lastRefreshed: Date | null = null;
  isRefreshing = false;

  selectedCategory: ArticleCategory | 'all' = 'all';
  viewMode: 'all' | 'bookmarked' | 'used' = 'all';

  categories: { value: ArticleCategory | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: 'All News', icon: '📰' },
    { value: 'legislation', label: 'Legislation', icon: '📜' },
    { value: 'enforcement', label: 'Enforcement', icon: '⚖️' },
    { value: 'legal', label: 'Legal', icon: '🏛️' },
    { value: 'financial', label: 'Financial', icon: '💰' },
    { value: 'general', label: 'General', icon: '📋' },
  ];

  constructor(private hoaNewsService: HOANewsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshAll(): void {
    this.isRefreshing = true;
    this.loadData(true);
  }

  loadData(forceRefresh = false): void {
    this.isLoading = true;
    this.error = '';

    this.hoaNewsService.getData(forceRefresh, {
      bookmarkedOnly: this.viewMode === 'bookmarked'
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.newsData = data;
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
          this.error = err.message || 'Failed to load HOA news';
        }
      });
  }

  setCategory(category: ArticleCategory | 'all'): void {
    this.selectedCategory = category;
  }

  setViewMode(mode: 'all' | 'bookmarked' | 'used'): void {
    this.viewMode = mode;
    this.loadData();
  }

  get filteredArticles(): HOAArticle[] {
    if (!this.newsData?.articles) return [];

    let articles = this.newsData.articles;

    // Filter by view mode
    if (this.viewMode === 'bookmarked') {
      articles = articles.filter(a => a.bookmarked);
    } else if (this.viewMode === 'used') {
      articles = articles.filter(a => a.usedForContent);
    }

    // Filter by category
    if (this.selectedCategory !== 'all') {
      articles = articles.filter(a => a.category === this.selectedCategory);
    }

    return articles;
  }

  getCategoryClass(category: ArticleCategory): string {
    switch (category) {
      case 'legislation':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'enforcement':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'legal':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'financial':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  }

  getCategoryLabel(category: ArticleCategory): string {
    const found = this.categories.find(c => c.value === category);
    return found ? found.label : 'General';
  }

  getCategoryCount(category: ArticleCategory | 'all'): number {
    if (category === 'all' || !this.newsData?.stats?.byCategory) {
      return 0;
    }
    return this.newsData.stats.byCategory[category] || 0;
  }

  getLastUpdatedDisplay(): string {
    if (!this.newsData?.lastUpdated) {
      return 'N/A';
    }
    return this.formatDate(this.newsData.lastUpdated);
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'high':
        return 'bg-amber-500/20 text-amber-400';
      case 'medium':
        return 'bg-slate-500/20 text-slate-300';
      default:
        return 'bg-slate-600/20 text-slate-400';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  truncateText(text: string, maxLength: number = 150): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  openArticle(url: string, event: Event): void {
    event.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  toggleBookmark(item: HOAArticle, event: Event): void {
    event.stopPropagation();
    const newState = !item.bookmarked;

    this.hoaNewsService.bookmarkArticle(item.id, newState)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result.success) {
            item.bookmarked = newState;
            // Update stats
            if (this.newsData?.stats) {
              this.newsData.stats.bookmarked += newState ? 1 : -1;
            }
          }
        }
      });
  }

  toggleUsedForContent(item: HOAArticle, event: Event): void {
    event.stopPropagation();
    const newState = !item.usedForContent;

    this.hoaNewsService.markAsUsedForContent(item.id, newState)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result.success) {
            item.usedForContent = newState;
            // Update stats
            if (this.newsData?.stats) {
              this.newsData.stats.usedForContent += newState ? 1 : -1;
            }
          }
        }
      });
  }

  dismissArticle(item: HOAArticle, event: Event): void {
    event.stopPropagation();

    this.hoaNewsService.dismissArticle(item.id, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result.success && this.newsData) {
            // Remove from local list
            this.newsData.articles = this.newsData.articles.filter(a => a.id !== item.id);
            this.newsData.stats.total--;
          }
        }
      });
  }
}
