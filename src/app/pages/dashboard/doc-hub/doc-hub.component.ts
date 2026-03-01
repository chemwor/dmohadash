import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { DocReferencesService } from '../../../core/services/doc-references.service';
import { DocReference } from '../../../interfaces/dashboard.interfaces';

@Component({
  selector: 'app-doc-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSkeletonComponent],
  templateUrl: './doc-hub.component.html'
})
export class DocHubComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  docs: DocReference[] = [];
  loading = false;
  error = '';

  // Refresh modal
  showRefreshModal = false;
  refreshDocKey = '';
  refreshDocName = '';
  refreshingDocKey = '';

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

  openRefreshModal(doc: DocReference): void {
    this.refreshDocKey = doc.doc_key;
    this.refreshDocName = doc.doc_name;
    this.showRefreshModal = true;
  }

  closeRefreshModal(): void {
    this.showRefreshModal = false;
    this.refreshDocKey = '';
    this.refreshDocName = '';
  }

  refreshDoc(): void {
    if (!this.refreshDocKey) return;
    this.refreshingDocKey = this.refreshDocKey;
    this.closeRefreshModal();

    this.docReferencesService.refresh(this.refreshDocKey)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          const idx = this.docs.findIndex(d => d.doc_key === updated.doc_key);
          if (idx !== -1) {
            this.docs[idx] = updated;
          }
          this.refreshingDocKey = '';
        },
        error: () => {
          this.refreshingDocKey = '';
        }
      });
  }

  getDocColor(docKey: string): string {
    const colorMap: Record<string, string> = {
      '6month_plan': 'border-l-blue-500',
      'media_plan': 'border-l-orange-500',
      'scenario_plan': 'border-l-purple-500',
      'brand_identity': 'border-l-pink-500',
      'user_persona': 'border-l-emerald-500',
      'dev_system': 'border-l-cyan-500'
    };
    return colorMap[docKey] || 'border-l-slate-500';
  }
}
