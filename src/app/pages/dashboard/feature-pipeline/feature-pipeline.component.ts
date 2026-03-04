import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { FeaturesService } from '../../../core/services/features.service';
import { FeatureRequest, FeatureStatus, FeatureSuggestion } from '../../../interfaces/dashboard.interfaces';

@Component({
  selector: 'app-feature-pipeline',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSkeletonComponent],
  templateUrl: './feature-pipeline.component.html'
})
export class FeaturePipelineComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  features: FeatureRequest[] = [];
  loading = false;
  error = '';

  activeFilter: FeatureStatus | '' = '';
  showAddForm = false;
  showPromptModal = false;
  promptModalContent = '';
  generatingPromptId: string | null = null;

  // AI Suggestions
  showSuggestions = false;
  loadingSuggestions = false;
  suggestions: FeatureSuggestion[] = [];
  suggestionsDataSources: string[] = [];
  suggestionsError = '';

  // Add form model
  newFeature = {
    title: '',
    description: '',
    target_repo: 'frontend',
    estimated_effort: 'medium',
    priority: 'medium',
    source: 'manual'
  };

  constructor(private featuresService: FeaturesService) {}

  ngOnInit(): void {
    this.loadFeatures();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFeatures(): void {
    this.loading = true;
    this.error = '';

    const status = this.activeFilter || undefined;
    this.featuresService.getAll(status as FeatureStatus | undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.features = data;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load features';
        }
      });
  }

  setFilter(filter: FeatureStatus | ''): void {
    this.activeFilter = filter;
    this.loadFeatures();
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
  }

  createFeature(): void {
    if (!this.newFeature.title.trim() || !this.newFeature.description.trim()) return;

    this.featuresService.create(this.newFeature)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (created) => {
          this.features.unshift(created);
          this.showAddForm = false;
          this.newFeature = { title: '', description: '', target_repo: 'frontend', estimated_effort: 'medium', priority: 'medium', source: 'manual' };

          // Auto-accept and generate implementation prompt
          if (created.id) {
            this.autoAcceptAndGeneratePrompt(created);
          }
        }
      });
  }

  private autoAcceptAndGeneratePrompt(feature: FeatureRequest): void {
    this.featuresService.update(feature.id!, { status: 'accepted' as FeatureStatus })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (accepted) => {
          const idx = this.features.findIndex(f => f.id === feature.id);
          if (idx !== -1) this.features[idx] = accepted;

          this.generatingPromptId = feature.id!;
          this.featuresService.generatePrompt(feature.id!)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (result) => {
                const i = this.features.findIndex(f => f.id === feature.id);
                if (i !== -1) {
                  this.features[i] = { ...this.features[i], implementation_prompt: result.prompt };
                }
                this.generatingPromptId = null;
              },
              error: () => {
                this.generatingPromptId = null;
              }
            });
        }
      });
  }

  updateStatus(feature: FeatureRequest, status: FeatureStatus): void {
    if (!feature.id) return;
    this.featuresService.update(feature.id, { status })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          const idx = this.features.findIndex(f => f.id === feature.id);
          if (idx !== -1) this.features[idx] = updated;
        }
      });
  }

  generatePrompt(feature: FeatureRequest): void {
    if (!feature.id) return;
    this.generatingPromptId = feature.id;

    this.featuresService.generatePrompt(feature.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const idx = this.features.findIndex(f => f.id === feature.id);
          if (idx !== -1) {
            this.features[idx] = { ...this.features[idx], implementation_prompt: result.prompt };
          }
          this.generatingPromptId = null;
        },
        error: () => {
          this.generatingPromptId = null;
        }
      });
  }

  viewPrompt(prompt: string): void {
    this.promptModalContent = prompt;
    this.showPromptModal = true;
  }

  closePromptModal(): void {
    this.showPromptModal = false;
    this.promptModalContent = '';
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
  }

  getStatusBadge(status: string): string {
    switch (status) {
      case 'proposed': return 'bg-amber-500/20 text-amber-400';
      case 'accepted': return 'bg-green-500/20 text-green-400';
      case 'done': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-amber-400';
      case 'low': return 'text-green-400';
      default: return 'text-slate-400';
    }
  }

  getCountByStatus(status: string): number {
    return this.features.filter(f => f.status === status).length;
  }

  // AI Suggestions
  generateSuggestions(): void {
    this.loadingSuggestions = true;
    this.suggestionsError = '';
    this.suggestions = [];
    this.showSuggestions = true;

    this.featuresService.getSuggestions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.suggestions = result.suggestions;
          this.suggestionsDataSources = result.data_sources;
          this.loadingSuggestions = false;
        },
        error: (err) => {
          this.loadingSuggestions = false;
          this.suggestionsError = err?.error?.error || 'Failed to generate suggestions';
        }
      });
  }

  approveSuggestion(suggestion: FeatureSuggestion): void {
    this.featuresService.create({
      title: suggestion.title,
      description: suggestion.description,
      target_repo: suggestion.target_repo,
      estimated_effort: suggestion.estimated_effort,
      priority: suggestion.priority,
      source: 'ai_suggestion'
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (created) => {
          this.features.unshift(created);
          this.suggestions = this.suggestions.filter(s => s.title !== suggestion.title);

          if (created.id) {
            this.autoAcceptAndGeneratePrompt(created);
          }
        }
      });
  }

  dismissSuggestion(suggestion: FeatureSuggestion): void {
    this.suggestions = this.suggestions.filter(s => s.title !== suggestion.title);
  }

  closeSuggestions(): void {
    this.showSuggestions = false;
    this.suggestions = [];
  }

  getCategoryBadge(category: string): string {
    const badges: Record<string, string> = {
      'homepage': 'bg-purple-500/20 text-purple-400',
      'conversion': 'bg-green-500/20 text-green-400',
      'performance': 'bg-red-500/20 text-red-400',
      'content': 'bg-cyan-500/20 text-cyan-400',
      'marketing': 'bg-amber-500/20 text-amber-400',
      'ux': 'bg-pink-500/20 text-pink-400',
      'product': 'bg-blue-500/20 text-blue-400',
    };
    return badges[category] || 'bg-slate-500/20 text-slate-400';
  }
}
