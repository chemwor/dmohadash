import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { DocReferencesService } from '../../../core/services/doc-references.service';
import { DocReference } from '../../../interfaces/dashboard.interfaces';

@Component({
  selector: 'app-doc-hub',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent],
  templateUrl: './doc-hub.component.html'
})
export class DocHubComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  docs: DocReference[] = [];
  loading = false;
  error = '';

  constructor(private docReferencesService: DocReferencesService) {}

  ngOnInit(): void {
    this.loadDocs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDocs(): void {
    this.loading = true;
    this.error = '';

    this.docReferencesService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.docs = data;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load documents';
        }
      });
  }

  getDocColor(docKey: string): string {
    const colorMap: Record<string, string> = {
      '6month_plan': 'border-l-blue-500',
      'media_plan': 'border-l-orange-500',
      'scenario': 'border-l-purple-500',
      'identity': 'border-l-pink-500',
      'persona': 'border-l-emerald-500',
      'dev_system': 'border-l-cyan-500'
    };
    return colorMap[docKey] || 'border-l-slate-500';
  }
}
