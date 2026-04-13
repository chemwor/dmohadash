import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  ContentService,
  IdeaWithRelations,
  ShotPrompt,
  PlatformCopy,
  VideoAsset
} from '../../services/content.service';
import { ShotPromptCardComponent } from '../../components/shot-prompt-card/shot-prompt-card.component';
import { CopyEditorComponent } from '../../components/copy-editor/copy-editor.component';

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ShotPromptCardComponent, CopyEditorComponent],
  template: `
    <div class="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/dashboard/content" class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div class="flex-1">
          <h1 class="text-xl md:text-2xl font-bold text-slate-100">Video Production</h1>
          @if (idea) {
            <p class="text-sm text-slate-400 mt-0.5">{{ typeLabels[idea.type] || idea.type }}</p>
          }
        </div>
        @if (idea) {
          <span [class]="'px-3 py-1 rounded-full text-xs font-medium ' + statusBadgeClass">
            {{ idea.status }}
          </span>
        }
      </div>

      @if (loading) {
        <div class="space-y-4">
          @for (i of [1,2,3]; track i) {
            <div class="card">
              <div class="skeleton h-4 w-32 mb-3 rounded"></div>
              <div class="skeleton h-16 w-full rounded"></div>
            </div>
          }
        </div>
      } @else if (idea) {
        <div class="space-y-6">

          <!-- STEP 1: IDEA -->
          <div class="card">
            <h2 class="section-header flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center">1</span>
              Idea
            </h2>

            @if (editingIdea) {
              <div class="space-y-3">
                <textarea [(ngModel)]="editScenario" class="input-field text-sm" rows="3"></textarea>
                <div class="grid grid-cols-2 gap-3">
                  <input [(ngModel)]="editViolation" class="input-field text-sm" placeholder="Violation type" />
                  <input [(ngModel)]="editFine" type="number" class="input-field text-sm" placeholder="Fine amount" />
                </div>
                <div class="flex gap-2">
                  <button (click)="saveIdeaEdits()" class="btn-primary text-xs">Save</button>
                  <button (click)="editingIdea = false" class="btn-secondary text-xs">Cancel</button>
                </div>
              </div>
            } @else {
              <p class="text-slate-100 text-sm mb-3">{{ idea.scenario }}</p>
              <div class="flex items-center gap-4 text-xs text-slate-400">
                <span>{{ idea.violation_type }}</span>
                <span class="text-amber-400 font-medium">\${{ idea.fine_amount }}</span>
              </div>
              @if (idea.status === 'idea') {
                <div class="flex gap-2 mt-4">
                  <button (click)="editingIdea = true; editScenario = idea.scenario; editViolation = idea.violation_type; editFine = idea.fine_amount" class="btn-secondary text-xs">Edit</button>
                  <button (click)="onGeneratePrompts()" [disabled]="actionLoading" class="btn-primary text-xs">
                    {{ actionLoading ? 'Generating...' : 'Generate Prompts' }}
                  </button>
                </div>
              }
            }
          </div>

          <!-- STEP 2: SCRIPT + KLING PROMPTS -->
          <div [class]="'card ' + (isUnlocked('prompt_ready') ? '' : 'opacity-50 pointer-events-none')">
            <!-- Kling workflow banner -->
            @if (isUnlocked('prompt_ready')) {
              <div class="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                <span class="font-medium">Kling Workflow:</span> Generate video with prompt below, then open Lip Sync, paste dialogue into Text to Speech, match voice settings shown, export, and assemble in CapCut.
              </div>
            }

            <div class="flex items-center justify-between mb-3">
              <h2 class="section-header flex items-center gap-2 mb-0">
                <span [class]="'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ' + (isUnlocked('prompt_ready') ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500')">2</span>
                Script + Kling Prompts
              </h2>
              @if (idea.prompt && (idea.status === 'prompt_ready' || idea.status === 'idea')) {
                <button (click)="onRegenerateScript()" [disabled]="actionLoading" class="btn-secondary text-xs">
                  {{ actionLoading ? 'Regenerating...' : 'Regenerate Script' }}
                </button>
              }
            </div>

            @if (idea.prompt) {
              <div class="mb-4">
                <p class="text-xs text-slate-400 mb-1.5">Script</p>
                <div class="bg-slate-900 rounded-lg p-4 text-sm text-slate-200 whitespace-pre-wrap">{{ idea.prompt.script }}</div>
              </div>

              <p class="text-xs text-slate-400 mb-3">{{ idea.prompt.shot_count }} shot{{ idea.prompt.shot_count > 1 ? 's' : '' }}, {{ idea.prompt.total_duration }}s total</p>

              <div class="space-y-3">
                @for (shot of idea.prompt.shots; track shot.shot_number) {
                  <app-shot-prompt-card
                    [shot]="shot"
                    [editable]="idea.status === 'prompt_ready'"
                    (promptChanged)="onShotPromptChange(shot.shot_number, $event)"
                  />
                }
              </div>

              @if (idea.status === 'prompt_ready') {
                <button (click)="onApprovePrompts()" [disabled]="actionLoading" class="btn-primary text-sm mt-4">
                  {{ actionLoading ? 'Approving...' : 'Approve Prompts' }}
                </button>
              }
            } @else {
              <p class="text-sm text-slate-500">Prompts will appear here after generation.</p>
            }
          </div>

          <!-- STEP 3: UPLOAD VIDEO -->
          <div [class]="'card ' + (isUnlocked('prompt_ready') ? '' : 'opacity-50 pointer-events-none')">
            <h2 class="section-header flex items-center gap-2">
              <span [class]="'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ' + (isUnlocked('prompt_ready') ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500')">3</span>
              Upload Video
            </h2>

            @if (isUnlocked('prompt_ready')) {
              <div class="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <p class="text-sm text-slate-300 mb-1">Use the prompts above to generate your video on
                  <a href="https://klingai.com" target="_blank" rel="noopener" class="text-indigo-400 hover:text-indigo-300 underline">klingai.com</a>,
                  then paste the final video URL below.
                </p>
                <p class="text-xs text-slate-500">Tip: Copy each shot prompt, generate on Kling's website, then combine/edit the clips.</p>
              </div>

              @if (idea.post?.final_video_url) {
                <video [src]="idea.post!.final_video_url!" controls class="w-full rounded-lg mb-4 max-h-96 bg-black"></video>
                <div class="flex gap-2">
                  <button (click)="removeVideo()" class="btn-secondary text-xs">Replace Video</button>
                </div>
              } @else {
                <div class="space-y-3">
                  <input
                    type="text"
                    [(ngModel)]="videoUrl"
                    class="input-field"
                    placeholder="Paste your final video URL here..."
                  />
                  <button
                    (click)="onUploadVideo()"
                    [disabled]="!videoUrl || actionLoading"
                    class="btn-primary w-full"
                  >
                    {{ actionLoading ? 'Saving...' : 'Save Video' }}
                  </button>
                </div>
              }

              @if (!idea.post?.final_video_url && (idea.status === 'prompt_ready' || idea.status === 'generating')) {
                <!-- Skip to approved if they want to generate copy first -->
              } @else if (idea.post?.final_video_url && idea.status !== 'approved' && idea.status !== 'copy_approved' && idea.status !== 'published') {
                <button (click)="markReviewed()" [disabled]="actionLoading" class="btn-primary text-sm mt-4">
                  {{ actionLoading ? 'Saving...' : 'Approve Video' }}
                </button>
              }
            } @else {
              <p class="text-sm text-slate-500">Upload unlocks after prompts are generated.</p>
            }
          </div>

          <!-- STEP 4: COPY -->
          <div [class]="'card ' + (isUnlocked('approved') ? '' : 'opacity-50 pointer-events-none')">
            <h2 class="section-header flex items-center gap-2">
              <span [class]="'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ' + (isUnlocked('approved') ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500')">4</span>
              Copy
            </h2>

            @if (isUnlocked('approved')) {
              <div class="mb-4">
                <p class="text-xs text-slate-400 mb-2">Select platforms:</p>
                <div class="flex flex-wrap gap-2">
                  @for (p of allPlatforms; track p) {
                    <label class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors">
                      <input
                        type="checkbox"
                        [checked]="selectedPlatforms.includes(p)"
                        (change)="togglePlatform(p)"
                        class="rounded border-slate-500"
                      />
                      <span class="text-xs text-slate-200 capitalize">{{ p }}</span>
                    </label>
                  }
                </div>
              </div>

              @if (!idea.post || !hasCopyGenerated || hasCopyEmpty) {
                <button
                  (click)="onGenerateCopy()"
                  [disabled]="selectedPlatforms.length === 0 || actionLoading"
                  class="btn-primary text-sm"
                >
                  {{ actionLoading ? 'Generating Copy...' : 'Generate Copy' }}
                </button>
              }

              @if (hasCopyGenerated) {
                <div class="space-y-3 mt-4">
                  @for (p of selectedPlatforms; track p) {
                    @if (generatedCopy[p]) {
                      <app-copy-editor
                        [platform]="p"
                        [copy]="generatedCopy[p]"
                        (copyChange)="onCopyChange(p, $event)"
                      />
                    }
                  }
                </div>

                @if (idea.status === 'approved') {
                  <button (click)="onApproveCopy()" [disabled]="actionLoading" class="btn-primary text-sm mt-4">
                    {{ actionLoading ? 'Approving...' : 'Approve Copy' }}
                  </button>
                }
              }
            } @else {
              <p class="text-sm text-slate-500">Copy generation unlocks after all video assets are approved.</p>
            }
          </div>

          <!-- STEP 5: PUBLISH -->
          <div [class]="'card ' + (isUnlocked('copy_approved') ? '' : 'opacity-50 pointer-events-none')">
            <h2 class="section-header flex items-center gap-2">
              <span [class]="'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ' + (isUnlocked('copy_approved') ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500')">5</span>
              Publish
            </h2>

            @if (isUnlocked('copy_approved') && idea.post) {
              <!-- TODO: Wire in TikTok, Meta (Instagram/Facebook), and YouTube API
                   calls in a future phase. For now, "Publish" simply marks the
                   platform as published in the video_posts record. -->
              <div class="space-y-3">
                @for (p of (idea.post.platforms || []); track p) {
                  <div class="bg-slate-700/30 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-slate-100 capitalize">{{ p }}</p>
                      @if (idea.post.copy && idea.post.copy[p]) {
                        <p class="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {{ idea.post.copy[p].caption || idea.post.copy[p].title || 'Copy ready' }}
                        </p>
                      }
                    </div>
                    @if (isPlatformPublished(p)) {
                      <span class="px-3 py-1 rounded-full text-xs font-medium bg-teal-500/20 text-teal-400">Published</span>
                    } @else {
                      <button (click)="onPublish(p)" [disabled]="actionLoading" class="btn-primary text-xs">
                        {{ actionLoading ? 'Publishing...' : 'Publish' }}
                      </button>
                    }
                  </div>
                }
              </div>
            } @else {
              <p class="text-sm text-slate-500">Publishing unlocks after copy is approved.</p>
            }
          </div>

        </div>
      }

      <!-- Error -->
      @if (error) {
        <div class="card border-red-500/30 mt-4">
          <p class="text-red-400 text-sm">{{ error }}</p>
          <button (click)="error = ''" class="text-xs text-slate-400 hover:text-slate-200 mt-1">Dismiss</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .line-clamp-1 {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class VideoDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  idea: IdeaWithRelations | null = null;
  loading = true;
  actionLoading = false;
  error = '';

  // Idea editing
  editingIdea = false;
  editScenario = '';
  editViolation = '';
  editFine = 0;

  // Video upload
  videoUrl = '';

  // Copy generation
  allPlatforms = ['tiktok', 'instagram', 'youtube', 'facebook'];
  selectedPlatforms: string[] = ['tiktok', 'instagram'];
  generatedCopy: Record<string, PlatformCopy> = {};
  hasCopyGenerated = false;

  get hasCopyEmpty(): boolean {
    return Object.keys(this.generatedCopy).length === 0;
  }

  typeLabels: Record<string, string> = {
    board_meeting: 'Board Meeting',
    doorbell_footage: 'Doorbell Footage',
    street_confrontation: 'Street Confrontation',
    official_document: 'Official Document',
    news_broadcast: 'News Broadcast',
    homeowner_pov: 'Homeowner POV',
  };

  private readonly statusOrder = ['idea', 'prompt_ready', 'generating', 'review', 'approved', 'copy_approved', 'published'];

  private readonly statusColors: Record<string, string> = {
    idea: 'bg-slate-500/20 text-slate-400',
    prompt_ready: 'bg-blue-500/20 text-blue-400',
    generating: 'bg-yellow-500/20 text-yellow-400 animate-pulse',
    review: 'bg-orange-500/20 text-orange-400',
    approved: 'bg-green-500/20 text-green-400',
    copy_approved: 'bg-green-500/20 text-green-400',
    published: 'bg-teal-500/20 text-teal-400',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private contentService: ContentService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadIdea(id);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get statusBadgeClass(): string {
    return this.statusColors[this.idea?.status || 'idea'] || this.statusColors['idea'];
  }

  isUnlocked(requiredStatus: string): boolean {
    if (!this.idea) return false;
    const current = this.statusOrder.indexOf(this.idea.status);
    const required = this.statusOrder.indexOf(requiredStatus);
    return current >= required;
  }

  get allAssetsApproved(): boolean {
    if (!this.idea?.assets || this.idea.assets.length === 0) return false;
    return this.idea.assets.every(a => a.status === 'ready');
  }

  loadIdea(id: string): void {
    this.loading = true;
    this.contentService.getIdea(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (idea) => {
          this.idea = idea;
          this.loading = false;
          if (idea.post?.copy) {
            this.generatedCopy = idea.post.copy;
            this.hasCopyGenerated = Object.keys(this.generatedCopy).length > 0;
            this.selectedPlatforms = idea.post.platforms || this.selectedPlatforms;
          }
        },
        error: () => {
          this.loading = false;
          this.error = 'Failed to load idea';
        }
      });
  }

  saveIdeaEdits(): void {
    if (!this.idea) return;
    this.idea.scenario = this.editScenario;
    this.idea.violation_type = this.editViolation;
    this.idea.fine_amount = this.editFine;
    this.editingIdea = false;
  }

  onGeneratePrompts(): void {
    if (!this.idea) return;
    this.actionLoading = true;
    this.error = '';

    this.contentService.generatePrompts(this.idea.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (prompt) => {
          if (this.idea) {
            this.idea.prompt = prompt;
            this.idea.status = 'prompt_ready';
          }
          this.actionLoading = false;
        },
        error: (err) => {
          this.actionLoading = false;
          this.error = err.message || 'Failed to generate prompts';
        }
      });
  }

  onRegenerateScript(): void {
    if (!this.idea) return;
    this.actionLoading = true;
    this.error = '';

    this.contentService.regeneratePrompts(this.idea.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (prompt) => {
          if (this.idea) {
            this.idea.prompt = prompt;
          }
          this.actionLoading = false;
        },
        error: (err) => {
          this.actionLoading = false;
          this.error = err.message || 'Failed to regenerate script';
        }
      });
  }

  onShotPromptChange(shotNumber: number, newPrompt: string): void {
    if (!this.idea?.prompt) return;
    const shot = this.idea.prompt.shots.find(s => s.shot_number === shotNumber);
    if (shot) {
      shot.kling_prompt = newPrompt;
    }
  }

  onApprovePrompts(): void {
    if (!this.idea?.prompt) return;
    this.actionLoading = true;

    // Save any edited shots first
    this.contentService.updatePrompt(this.idea.prompt.id, this.idea.prompt.shots)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.contentService.approvePrompts(this.idea!.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (result: any) => {
                if (this.idea) {
                  this.idea.status = 'generating';
                  if (this.idea.prompt) this.idea.prompt.status = 'approved';
                  if (result?.assets) {
                    this.idea.assets = result.assets;
                  }
                }
                this.actionLoading = false;
              },
              error: (err) => {
                this.actionLoading = false;
                this.error = err.message || 'Failed to approve prompts';
              }
            });
        },
        error: (err) => {
          this.actionLoading = false;
          this.error = err.message || 'Failed to update prompts';
        }
      });
  }

  createAssetPlaceholders(): void {
    if (!this.idea?.prompt) return;
    this.actionLoading = true;

    this.contentService.createAssets(this.idea.id, this.idea.prompt.shots)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (assets) => {
          if (this.idea) {
            this.idea.assets = assets;
          }
          this.actionLoading = false;
        },
        error: (err) => {
          this.actionLoading = false;
          this.error = err.message || 'Failed to create assets';
        }
      });
  }

  assetStatusClass(status: string): string {
    switch (status) {
      case 'generating': return 'bg-yellow-500/20 text-yellow-400 animate-pulse';
      case 'ready': return 'bg-green-500/20 text-green-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  }

  onUploadVideo(): void {
    if (!this.idea || !this.videoUrl) return;
    this.actionLoading = true;
    this.error = '';

    // Save video URL to video_posts record
    if (this.idea.post) {
      this.contentService.updateVideoUrl(this.idea.post.id, this.videoUrl)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (post) => {
            if (this.idea) {
              this.idea.post = post;
            }
            this.actionLoading = false;
          },
          error: (err) => {
            this.actionLoading = false;
            this.error = err.message || 'Failed to save video';
          }
        });
    } else {
      // Create a new post with the video URL
      this.contentService.savePost({
        video_idea_id: this.idea.id,
        platforms: this.selectedPlatforms,
        copy: {},
        final_video_url: this.videoUrl
      })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (post) => {
            if (this.idea) {
              this.idea.post = post;
            }
            this.actionLoading = false;
          },
          error: (err) => {
            this.actionLoading = false;
            this.error = err.message || 'Failed to save video';
          }
        });
    }
  }

  removeVideo(): void {
    this.videoUrl = '';
    if (this.idea?.post) {
      this.contentService.updateVideoUrl(this.idea.post.id, '')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (post) => {
            if (this.idea) this.idea.post = post;
          }
        });
    }
  }

  markReviewed(): void {
    if (!this.idea) return;
    this.actionLoading = true;

    this.contentService.updateIdeaStatus(this.idea.id, 'approved')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (this.idea) this.idea.status = 'approved';
          this.actionLoading = false;
        },
        error: (err) => {
          this.actionLoading = false;
          this.error = err.message || 'Failed to update status';
        }
      });
  }

  togglePlatform(platform: string): void {
    const idx = this.selectedPlatforms.indexOf(platform);
    if (idx >= 0) {
      this.selectedPlatforms.splice(idx, 1);
    } else {
      this.selectedPlatforms.push(platform);
    }
  }

  onGenerateCopy(): void {
    if (!this.idea) return;
    this.actionLoading = true;
    this.error = '';

    this.contentService.generateCopy(this.idea.id, this.selectedPlatforms)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (copy) => {
          this.generatedCopy = copy;
          this.hasCopyGenerated = Object.keys(copy).length > 0;
          this.actionLoading = false;

          // Save as post
          if (this.idea) {
            this.contentService.savePost({
              video_idea_id: this.idea.id,
              platforms: this.selectedPlatforms,
              copy
            })
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (post) => {
                  if (this.idea) this.idea.post = post;
                }
              });
          }
        },
        error: (err) => {
          this.actionLoading = false;
          this.error = err.message || 'Failed to generate copy';
        }
      });
  }

  onCopyChange(platform: string, copy: PlatformCopy): void {
    this.generatedCopy[platform] = copy;
    // Auto-save copy changes
    if (this.idea?.post) {
      this.contentService.updateCopy(this.idea.post.id, this.generatedCopy).subscribe();
    }
  }

  onApproveCopy(): void {
    if (!this.idea) return;
    this.actionLoading = true;

    this.contentService.approveCopy(this.idea.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (this.idea) this.idea.status = 'copy_approved';
          if (this.idea?.post) this.idea.post.status = 'copy_approved';
          this.actionLoading = false;
        },
        error: (err) => {
          this.actionLoading = false;
          this.error = err.message || 'Failed to approve copy';
        }
      });
  }

  isPlatformPublished(platform: string): boolean {
    if (!this.idea?.post?.copy) return false;
    return !!(this.idea.post.copy as Record<string, any>)[platform]?.published;
  }

  onPublish(platform: string): void {
    if (!this.idea?.post) return;
    this.actionLoading = true;

    this.contentService.publishPlatform(this.idea.post.id, platform)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: any) => {
          if (this.idea?.post && result) {
            this.idea.post = result;
            if (result.status === 'published') {
              this.idea.status = 'published';
            }
          }
          this.actionLoading = false;
        },
        error: (err) => {
          this.actionLoading = false;
          this.error = err.message || 'Failed to publish';
        }
      });
  }
}
