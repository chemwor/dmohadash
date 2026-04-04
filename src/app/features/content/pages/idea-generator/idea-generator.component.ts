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
    <div class="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/dashboard/content" class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-100">New Video Idea</h1>
          <p class="text-sm text-slate-400 mt-0.5">Generate AI-powered video concepts</p>
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
                <option [value]="t.value">{{ t.label }}</option>
              }
            </select>
          </div>

          <div>
            <label class="text-xs text-slate-400 mb-1.5 block">Seed Text (optional)</label>
            <input
              type="text"
              [(ngModel)]="seedText"
              class="input-field"
              placeholder="Describe a situation or leave blank for random..."
            />
          </div>

          <button
            (click)="generateIdeas()"
            [disabled]="!selectedType || generating"
            class="btn-primary"
          >
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

      <!-- Step 2: Select Idea -->
      @if (generatedIdeas.length > 0) {
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="section-header mb-0">Step 2 — Select an Idea</h2>
            <button (click)="generateIdeas()" [disabled]="generating" class="btn-secondary text-xs">
              Regenerate
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            @for (idea of generatedIdeas; track $index) {
              <div
                [class]="'card hover:border-indigo-500/50 transition-colors cursor-pointer' + (selectedIdea === $index ? ' border-indigo-500 bg-indigo-500/5' : '')"
              >
                <p class="text-sm text-slate-100 font-medium mb-3">{{ idea.scenario }}</p>

                <div class="space-y-1.5 mb-4">
                  <div class="flex justify-between text-xs">
                    <span class="text-slate-400">Violation</span>
                    <span class="text-slate-200">{{ idea.violation_type }}</span>
                  </div>
                  <div class="flex justify-between text-xs">
                    <span class="text-slate-400">Fine</span>
                    <span class="text-amber-400 font-medium">\${{ idea.fine_amount }}</span>
                  </div>
                </div>

                <button
                  (click)="selectIdea($index)"
                  [disabled]="saving"
                  class="btn-primary w-full text-xs"
                >
                  @if (saving && selectedIdea === $index) {
                    Saving...
                  } @else {
                    Select
                  }
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- Error -->
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
    { value: 'board_meeting', label: 'Board Meeting' },
    { value: 'doorbell_footage', label: 'Doorbell Footage' },
    { value: 'street_confrontation', label: 'Street Confrontation' },
    { value: 'official_document', label: 'Official Document' },
    { value: 'news_broadcast', label: 'News Broadcast' },
    { value: 'homeowner_pov', label: 'Homeowner POV' },
  ];

  selectedType = '';
  seedText = '';
  generating = false;
  saving = false;
  error = '';
  generatedIdeas: GeneratedIdea[] = [];
  selectedIdea: number | null = null;

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
    this.selectedIdea = null;

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

  selectIdea(index: number): void {
    this.selectedIdea = index;
    this.saving = true;
    const idea = this.generatedIdeas[index];

    this.contentService.saveIdea({
      type: this.selectedType,
      scenario: idea.scenario,
      violation_type: idea.violation_type,
      fine_amount: idea.fine_amount
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (saved) => {
          this.saving = false;
          this.router.navigate(['/dashboard/content', saved.id]);
        },
        error: (err) => {
          this.saving = false;
          this.error = err.message || 'Failed to save idea';
        }
      });
  }
}
