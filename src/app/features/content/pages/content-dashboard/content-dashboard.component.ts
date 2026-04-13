import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ContentService, VideoIdea } from '../../services/content.service';
import { IdeaCardComponent } from '../../components/idea-card/idea-card.component';

@Component({
  selector: 'app-content-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IdeaCardComponent],
  template: `
    <div class="p-4 md:p-6 lg:p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-100">Content Pipeline</h1>
          <p class="text-sm text-slate-400 mt-1">Video content production workflow</p>
        </div>
        <a routerLink="/dashboard/content/new" class="btn-primary text-sm">
          + New Idea
        </a>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-6 bg-slate-800 rounded-lg p-1 overflow-x-auto">
        @for (tab of tabs; track tab.key) {
          <button
            (click)="activeTab = tab.key; loadIdeas()"
            [class]="activeTab === tab.key
              ? 'flex-1 min-w-0 px-3 py-2 text-xs md:text-sm font-medium rounded-md bg-indigo-500 text-white transition-colors whitespace-nowrap'
              : 'flex-1 min-w-0 px-3 py-2 text-xs md:text-sm font-medium rounded-md text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap'"
          >
            {{ tab.label }}
            @if (tabCounts[tab.key] !== undefined) {
              <span class="ml-1 text-[10px] opacity-70">({{ tabCounts[tab.key] }})</span>
            }
          </button>
        }
      </div>

      <!-- Content -->
      @if (loading) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (i of [1,2,3]; track i) {
            <div class="card">
              <div class="skeleton h-4 w-20 mb-3 rounded"></div>
              <div class="skeleton h-10 w-full mb-2 rounded"></div>
              <div class="skeleton h-4 w-32 mb-4 rounded"></div>
              <div class="skeleton h-8 w-full rounded"></div>
            </div>
          }
        </div>
      } @else if (filteredIdeas.length === 0) {
        <div class="card text-center py-12">
          <svg class="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          <p class="text-slate-400 text-sm">No videos in this stage</p>
          <a routerLink="/dashboard/content/new" class="btn-primary text-sm mt-4 inline-block">
            Create Your First Idea
          </a>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (idea of filteredIdeas; track idea.id) {
            <div (click)="navigateToIdea(idea)">
              <app-idea-card
                [type]="idea.type"
                [scenario]="idea.scenario"
                [violationType]="idea.violation_type"
                [fineAmount]="idea.fine_amount"
                [status]="idea.status"
                (action)="onIdeaAction(idea)"
              />
            </div>
          }
        </div>
      }

      <!-- Posted on YouTube -->
      @if (youtubeVideos.length > 0) {
        <div class="mt-8">
          <h2 class="section-header">Posted on YouTube ({{ youtubeVideos.length }} videos)</h2>
          <div class="space-y-2">
            @for (v of youtubeVideos; track v.id) {
              <div class="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-slate-100 truncate">{{ v.title }}</p>
                  <div class="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                    <span>{{ v.views | number }} views</span>
                    <span>{{ v.published }}</span>
                  </div>
                </div>
                <a [href]="v.url" target="_blank" rel="noopener" class="text-[11px] text-indigo-400 hover:text-indigo-300 underline flex-shrink-0">Watch</a>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class ContentDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  tabs = [
    { key: 'ideas', label: 'Ideas', statuses: ['idea'] },
    { key: 'production', label: 'In Production', statuses: ['prompt_ready', 'generating', 'review'] },
    { key: 'approved', label: 'Approved', statuses: ['approved'] },
    { key: 'published', label: 'Published', statuses: ['published'] },
  ];

  activeTab = 'ideas';
  allIdeas: VideoIdea[] = [];
  loading = true;
  tabCounts: Record<string, number> = {};

  // YouTube posted videos
  youtubeVideos: { id: string; title: string; views: number; published: string; url: string }[] = [];

  constructor(
    private contentService: ContentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadIdeas();
    this.loadYouTubeVideos();
  }

  async loadYouTubeVideos(): Promise<void> {
    try {
      const resp = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=UCB2_1EyFakAwhXvtvkbl19g');
      if (!resp.ok) return;
      const xml = await resp.text();

      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      this.youtubeVideos = entries.map(entry => {
        const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
        const id = (entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/) || [])[1] || '';
        const views = parseInt((entry.match(/views="(\d+)"/) || [])[1] || '0', 10);
        const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1]?.substring(0, 10) || '';
        return {
          id,
          title,
          views,
          published,
          url: `https://www.youtube.com/watch?v=${id}`,
        };
      }).sort((a, b) => b.views - a.views);
    } catch (e) {
      // Non-fatal
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadIdeas(): void {
    this.loading = true;
    this.contentService.getIdeas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ideas) => {
          this.allIdeas = ideas;
          this.loading = false;
          // Compute tab counts
          for (const tab of this.tabs) {
            this.tabCounts[tab.key] = ideas.filter(i => tab.statuses.includes(i.status)).length;
          }
        },
        error: () => {
          this.loading = false;
        }
      });
  }

  get filteredIdeas(): VideoIdea[] {
    const tab = this.tabs.find(t => t.key === this.activeTab);
    if (!tab) return [];
    return this.allIdeas.filter(i => tab.statuses.includes(i.status));
  }

  navigateToIdea(idea: VideoIdea): void {
    this.router.navigate(['/dashboard/content', idea.id]);
  }

  onIdeaAction(idea: VideoIdea): void {
    this.router.navigate(['/dashboard/content', idea.id]);
  }
}
