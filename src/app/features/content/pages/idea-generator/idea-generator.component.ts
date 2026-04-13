import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ContentService, GeneratedIdea } from '../../services/content.service';

@Component({
  selector: 'app-idea-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/dashboard/content" class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-100">New Video Idea</h1>
          <p class="text-sm text-slate-400 mt-0.5">Generate scenarios optimized for what performs on your account</p>
        </div>
      </div>

      <!-- Step 1: Select Type -->
      <div class="card mb-6">
        <h2 class="section-header">Step 1 — Select Type</h2>
        <div class="space-y-4">
          <div>
            <label class="text-xs text-slate-400 mb-1.5 block">Video Type</label>
            <select [(ngModel)]="selectedType" class="input-field">
              <option value="" disabled>Choose a video type...</option>
              @for (t of videoTypes; track t.value) {
                <option [value]="t.value" [disabled]="t.comingSoon">{{ t.label }}{{ t.comingSoon ? ' (coming soon)' : '' }}</option>
              }
            </select>
          </div>
          <div>
            <label class="text-xs text-slate-400 mb-1.5 block">Seed Text (optional)</label>
            <input type="text" [(ngModel)]="seedText" class="input-field" placeholder="Describe a situation or leave blank for random..." />
          </div>
          <button (click)="generateIdeas()" [disabled]="!selectedType || generating" class="btn-primary">
            @if (generating) {
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            } @else {
              Generate Ideas
            }
          </button>
        </div>
      </div>

      <!-- Step 2: Select from 4 ideas -->
      @if (generatedIdeas.length > 0 && !previewIdea) {
        <div class="card mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="section-header mb-0">Step 2 — Pick Your Scenario</h2>
            <button (click)="generateIdeas()" [disabled]="generating" class="btn-secondary text-xs">Regenerate All</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (idea of generatedIdeas; track $index) {
              <div
                class="card hover:border-indigo-500/50 transition-colors cursor-pointer"
                (click)="previewIdea = idea"
              >
                <p class="text-sm text-slate-100 font-medium mb-3">{{ idea.scenario }}</p>
                <div class="flex items-center gap-2 mb-2">
                  <span class="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[11px] font-medium">{{ idea.violation_type }}</span>
                </div>
                <p class="text-2xl font-bold text-amber-400 mb-2">\${{ idea.fine_amount | number }}</p>
                @if (idea.viral_hook) {
                  <p class="text-xs text-slate-400 italic">"{{ idea.viral_hook }}"</p>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Step 3: Preview before saving -->
      @if (previewIdea) {
        <div class="card mb-6">
          <h2 class="section-header">Step 3 — Confirm Scenario</h2>
          <div class="bg-slate-800 rounded-lg p-5 border border-slate-700 mb-4">
            <p class="text-base text-slate-100 font-medium mb-3">{{ previewIdea.scenario }}</p>
            <div class="flex flex-wrap items-center gap-3 mb-3">
              <span class="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-xs font-medium">{{ selectedType }}</span>
              <span class="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">{{ previewIdea.violation_type }}</span>
            </div>
            <p class="text-3xl font-bold text-amber-400 mb-3">\${{ previewIdea.fine_amount | number }}</p>
            @if (previewIdea.viral_hook) {
              <div class="bg-indigo-500/10 border-l-2 border-indigo-500/40 px-3 py-2 rounded">
                <p class="text-[10px] uppercase tracking-wider text-indigo-400 mb-1">Viral Hook</p>
                <p class="text-sm text-slate-200 italic">"{{ previewIdea.viral_hook }}"</p>
              </div>
            }
          </div>
          <div class="flex gap-3">
            <button (click)="confirmAndGenerate()" [disabled]="saving" class="btn-primary flex items-center gap-2">
              @if (saving) {
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Saving + generating script...
              } @else {
                Looks good. Generate script.
              }
            </button>
            <button (click)="previewIdea = null" class="btn-secondary">Pick a different one</button>
          </div>
        </div>
      }

      @if (error) {
        <div class="card border-red-500/30 mt-4">
          <p class="text-red-400 text-sm">{{ error }}</p>
        </div>
      }
    </div>
  `
})
export class IdeaGeneratorComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  videoTypes = [
    { value: 'board_meeting', label: 'Board Meeting', comingSoon: false },
    { value: 'doorbell_footage', label: 'Doorbell Footage', comingSoon: false },
    { value: 'news_broadcast', label: 'News Broadcast', comingSoon: false },
    { value: 'street_confrontation', label: 'Street Confrontation', comingSoon: true },
    { value: 'official_document', label: 'Official Document', comingSoon: true },
    { value: 'homeowner_pov', label: 'Homeowner POV', comingSoon: true },
  ];

  selectedType = '';
  seedText = '';
  generating = false;
  saving = false;
  error = '';
  generatedIdeas: GeneratedIdea[] = [];
  previewIdea: GeneratedIdea | null = null;

  constructor(
    private contentService: ContentService,
    private router: Router
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  generateIdeas(): void {
    this.generating = true;
    this.error = '';
    this.generatedIdeas = [];
    this.previewIdea = null;

    this.contentService.generateIdeas(this.selectedType, this.seedText || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.generatedIdeas = result.ideas || [];
          this.generating = false;
          if (this.generatedIdeas.length === 0) {
            this.error = 'No ideas were generated. Please try again.';
          }
        },
        error: (err) => {
          this.generating = false;
          this.error = err.message || 'Failed to generate ideas';
        }
      });
  }

  confirmAndGenerate(): void {
    if (!this.previewIdea) return;
    this.saving = true;
    this.error = '';

    const idea = this.previewIdea;

    // Save the idea to Supabase, then immediately trigger prompt generation
    this.contentService.saveIdea({
      type: this.selectedType,
      scenario: idea.scenario,
      violation_type: idea.violation_type,
      fine_amount: idea.fine_amount,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (saved) => {
          // Immediately trigger prompt generation (don't wait for the detail page)
          this.contentService.generatePrompts(saved.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.saving = false;
                this.router.navigate(['/dashboard/content', saved.id]);
              },
              error: () => {
                // Prompt generation failed but idea was saved. Navigate anyway.
                this.saving = false;
                this.router.navigate(['/dashboard/content', saved.id]);
              }
            });
        },
        error: (err) => {
          this.saving = false;
          this.error = err.message || 'Failed to save idea';
        }
      });
  }
}
