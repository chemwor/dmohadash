import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { HoaIntelService, HoaNewsArticle, HoaNewsResponse, NotesAnalysisResponse } from '../../../core/services/hoa-intel.service';
import { HOANewsService } from '../../../core/services/hoa-news.service';

type SortOption = 'newest' | 'oldest' | 'relevance';

@Component({
  selector: 'app-hoa-intel',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSkeletonComponent],
  templateUrl: './hoa-intel.component.html'
})
export class HoaIntelComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  articles: HoaNewsArticle[] = [];
  loading = false;
  error = '';
  scanning = false;

  // Filters
  activeStatus: string = '';
  activeCategory: string = '';
  sortBy: SortOption = 'newest';

  // Notes
  editingNotesId: string | null = null;
  notesText = '';
  savingNotes = false;

  // Notes Analysis
  showAnalysis = false;
  loadingAnalysis = false;
  analysisResult: NotesAnalysisResponse | null = null;
  analysisError = '';

  categories = [
    { value: '', label: 'All Categories' },
    { value: 'legislation', label: 'Legislation' },
    { value: 'enforcement', label: 'Enforcement' },
    { value: 'legal', label: 'Legal' },
    { value: 'financial', label: 'Financial' },
    { value: 'general', label: 'General' }
  ];

  statusTabs = [
    { value: '', label: 'All' },
    { value: 'new', label: 'Unreviewed' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'bookmarked', label: 'Bookmarked' },
    { value: 'hasNotes', label: 'Has Notes' },
    { value: 'archived', label: 'Archived' }
  ];

  constructor(
    private hoaIntelService: HoaIntelService,
    private hoaNewsService: HOANewsService
  ) {}

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

    // Bookmarked filter uses the news service with bookmarked param
    if (this.activeStatus === 'bookmarked') {
      this.hoaNewsService.getData(false, { bookmarkedOnly: true })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            this.articles = data.articles as any[];
            this.applySorting();
            this.loading = false;
          },
          error: (err) => {
            this.loading = false;
            this.error = err.message || 'Failed to load articles';
          }
        });
      return;
    }

    // Has Notes filter
    if (this.activeStatus === 'hasNotes') {
      this.hoaIntelService.getArticlesWithNotes()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data: HoaNewsResponse) => {
            this.articles = data.articles;
            this.applySorting();
            this.loading = false;
          },
          error: (err) => {
            this.loading = false;
            this.error = err.message || 'Failed to load articles';
          }
        });
      return;
    }

    this.hoaIntelService.getArticles(
      this.activeStatus || undefined,
      this.activeCategory || undefined
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: HoaNewsResponse) => {
          this.articles = data.articles;
          this.applySorting();
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load articles';
        }
      });
  }

  setStatus(status: string): void {
    this.activeStatus = status;
    this.loadArticles();
  }

  onFilterChange(): void {
    this.loadArticles();
  }

  onSortChange(): void {
    this.applySorting();
  }

  private applySorting(): void {
    switch (this.sortBy) {
      case 'newest':
        this.articles.sort((a, b) => {
          const da = this.getDateValue(a);
          const db = this.getDateValue(b);
          return db - da;
        });
        break;
      case 'oldest':
        this.articles.sort((a, b) => {
          const da = this.getDateValue(a);
          const db = this.getDateValue(b);
          return da - db;
        });
        break;
      case 'relevance':
        this.articles.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
        break;
    }
  }

  private getDateValue(article: HoaNewsArticle): number {
    const dateStr = article.published_date || article.pubDate || article.timestamp || article.created_at || '';
    return dateStr ? new Date(dateStr).getTime() : 0;
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
          if (status === 'archived' && this.activeStatus !== 'archived' && this.activeStatus !== '') {
            this.articles = this.articles.filter(a => a.id !== article.id);
          } else {
            const idx = this.articles.findIndex(a => a.id === article.id);
            if (idx !== -1) this.articles[idx] = { ...this.articles[idx], status };
          }
        }
      });
  }

  private stripHtml(text: string): string {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '').trim();
  }

  getArticleTitle(article: HoaNewsArticle): string {
    return this.stripHtml(article.title || '');
  }

  getArticleUrl(article: HoaNewsArticle): string {
    return article.source_url || article.link || '';
  }

  getArticleSource(article: HoaNewsArticle): string {
    return this.stripHtml(article.source_name || article.source || 'Unknown');
  }

  getArticleSummary(article: HoaNewsArticle): string {
    return this.stripHtml(article.summary || article.description || '');
  }

  getArticleDate(article: HoaNewsArticle): string {
    const dateStr = article.published_date || article.pubDate || article.timestamp || article.created_at || '';
    if (!dateStr) return '';
    return this.formatRelativeDate(dateStr);
  }

  getArticleDateFull(article: HoaNewsArticle): string {
    const dateStr = article.published_date || article.pubDate || article.timestamp || article.created_at || '';
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  private formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getCategoryBadge(category: string): string {
    const map: Record<string, string> = {
      legislation: 'bg-purple-500/20 text-purple-400',
      enforcement: 'bg-red-500/20 text-red-400',
      legal: 'bg-amber-500/20 text-amber-400',
      financial: 'bg-green-500/20 text-green-400',
      general: 'bg-blue-500/20 text-blue-400'
    };
    return map[category?.toLowerCase()] || 'bg-slate-500/20 text-slate-400';
  }

  getSentimentColor(sentiment: string): string {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'text-green-400';
      case 'negative': return 'text-red-400';
      default: return 'text-slate-400';
    }
  }

  getStatusBadge(status: string): string {
    switch (status) {
      case 'new': return 'bg-blue-500/20 text-blue-400';
      case 'reviewed': return 'bg-green-500/20 text-green-400';
      case 'archived': return 'bg-slate-500/20 text-slate-500';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  }

  toggleBookmark(article: HoaNewsArticle): void {
    const newState = !(article as any).bookmarked;
    this.hoaNewsService.bookmarkArticle(article.id, newState)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result.success) {
            (article as any).bookmarked = newState;
          }
        }
      });
  }

  isBookmarked(article: HoaNewsArticle): boolean {
    return !!(article as any).bookmarked;
  }

  isYouTube(article: HoaNewsArticle): boolean {
    const url = this.getArticleUrl(article);
    const title = (article.title || '').toLowerCase();
    const source = (article.source || article.source_name || '').toLowerCase();
    return url.includes('youtube.com') || url.includes('youtu.be') ||
           title.includes('- youtube') || source.includes('youtube');
  }

  get newCount(): number {
    return this.articles.filter(a => a.status === 'new').length;
  }

  get reviewedCount(): number {
    return this.articles.filter(a => a.status === 'reviewed').length;
  }

  get bookmarkedCount(): number {
    return this.articles.filter(a => (a as any).bookmarked).length;
  }

  get notesCount(): number {
    return this.articles.filter(a => a.notes).length;
  }

  // Notes methods
  toggleNotes(article: HoaNewsArticle): void {
    if (this.editingNotesId === article.id) {
      this.editingNotesId = null;
      this.notesText = '';
    } else {
      this.editingNotesId = article.id;
      this.notesText = article.notes || '';
    }
  }

  saveNotes(article: HoaNewsArticle): void {
    this.savingNotes = true;
    this.hoaIntelService.saveNotes(article.id, this.notesText)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const idx = this.articles.findIndex(a => a.id === article.id);
          if (idx !== -1) {
            this.articles[idx] = { ...this.articles[idx], notes: this.notesText.trim() || null };
          }
          this.savingNotes = false;
          this.editingNotesId = null;
          this.notesText = '';
        },
        error: () => {
          this.savingNotes = false;
        }
      });
  }

  // Notes Analysis
  analyzeNotes(): void {
    this.loadingAnalysis = true;
    this.analysisError = '';
    this.analysisResult = null;
    this.showAnalysis = true;

    this.hoaIntelService.analyzeNotes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.analysisResult = result;
          this.loadingAnalysis = false;
        },
        error: (err) => {
          this.loadingAnalysis = false;
          this.analysisError = err?.error?.error || 'Failed to analyze notes';
        }
      });
  }

  closeAnalysis(): void {
    this.showAnalysis = false;
    this.analysisResult = null;
  }

  getPriorityBadge(priority: string): string {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-amber-500/20 text-amber-400';
      case 'low': return 'bg-green-500/20 text-green-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  }
}
