import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { FeaturesService } from '../../../core/services/features.service';
import { FeatureRequest, FeatureStatus } from '../../../interfaces/dashboard.interfaces';

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
}
