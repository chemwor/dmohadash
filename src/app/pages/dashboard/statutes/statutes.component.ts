import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import {
  StatutesService,
  Statute,
  CoverageSummary,
  ScanRequest,
  ScanResult
} from '../../../core/services/statutes.service';

@Component({
  selector: 'app-statutes',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSkeletonComponent],
  templateUrl: './statutes.component.html'
})
export class StatutesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  statutes: Statute[] = [];
  coverage: CoverageSummary | null = null;
  categories: string[] = [];
  allStates: string[] = [];

  isLoading = false;
  error = '';

  // Filters
  selectedState = '';
  selectedCategory = '';

  // Expanded statute detail
  expandedKey = '';

  // Scan panel
  showScanPanel = false;
  isScanning = false;
  scanStates: string[] = ['ALL'];
  scanCategories: string[] = ['ALL'];
  scanResults: ScanResult | null = null;
  scanError = '';
  totalGenerated = 0;
  totalFailed = 0;

  // Delete
  deletingKey = '';

  constructor(private statutesService: StatutesService) {}

  ngOnInit(): void {
    this.loadStatutes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStatutes(): void {
    this.isLoading = true;
    this.error = '';

    this.statutesService.getStatutes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.statutes = res.statutes;
          this.coverage = res.coverage;
          this.categories = res.categories;
          this.allStates = res.states;
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.error = err.message || 'Failed to load statutes';
        }
      });
  }

  get filteredStatutes(): Statute[] {
    return this.statutes.filter(s => {
      if (this.selectedState && s.state !== this.selectedState) return false;
      if (this.selectedCategory && s.violation_category !== this.selectedCategory) return false;
      return true;
    });
  }

  get coveragePercent(): number {
    if (!this.coverage) return 0;
    return Math.round((this.coverage.total_existing / this.coverage.total_possible) * 100);
  }

  get fullCoverageStates(): number {
    if (!this.coverage) return 0;
    const catCount = this.categories.length;
    return Object.values(this.coverage.by_state).filter(c => c >= catCount).length;
  }

  get aiGeneratedPercent(): number {
    if (!this.statutes.length) return 0;
    const aiCount = this.statutes.filter(s => s.ai_generated).length;
    return Math.round((aiCount / this.statutes.length) * 100);
  }

  getStateCoverage(state: string): number {
    return this.coverage?.by_state[state] || 0;
  }

  getStateCoverageClass(state: string): string {
    const count = this.getStateCoverage(state);
    const total = this.categories.length;
    if (count >= total) return 'bg-green-500/30 text-green-400 border-green-500/50';
    if (count > 0) return 'bg-amber-500/30 text-amber-400 border-amber-500/50';
    return 'bg-slate-700/50 text-slate-500 border-slate-600/50';
  }

  statuteKey(s: Statute): string {
    return `${s.state}-${s.violation_category}`;
  }

  toggleExpand(s: Statute): void {
    const key = this.statuteKey(s);
    this.expandedKey = this.expandedKey === key ? '' : key;
  }

  isExpanded(s: Statute): boolean {
    return this.expandedKey === this.statuteKey(s);
  }

  filterByState(state: string): void {
    this.selectedState = this.selectedState === state ? '' : state;
  }

  formatCategory(cat: string): string {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  // Scan
  toggleScanPanel(): void {
    this.showScanPanel = !this.showScanPanel;
    if (this.showScanPanel) {
      this.scanResults = null;
      this.scanError = '';
      this.totalGenerated = 0;
      this.totalFailed = 0;
    }
  }

  startScan(): void {
    this.isScanning = true;
    this.scanError = '';
    this.scanResults = null;

    const req: ScanRequest = {
      states: this.scanStates,
      categories: this.scanCategories
    };

    this.statutesService.scanStatutes(req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.scanResults = result;
          this.totalGenerated += result.generated;
          this.totalFailed += result.failed;
          this.isScanning = false;

          // Refresh data
          this.loadStatutes();
        },
        error: (err) => {
          this.isScanning = false;
          this.scanError = err.message || 'Scan failed';
        }
      });
  }

  continueScan(): void {
    // Re-run scan to process the next batch of 20
    this.startScan();
  }

  deleteStatute(s: Statute): void {
    const key = this.statuteKey(s);
    this.deletingKey = key;

    this.statutesService.deleteStatute(s.state, s.violation_category)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.deletingKey = '';
          this.statutes = this.statutes.filter(st => this.statuteKey(st) !== key);
          // Refresh coverage
          this.loadStatutes();
        },
        error: () => {
          this.deletingKey = '';
        }
      });
  }

  isDeleting(s: Statute): boolean {
    return this.deletingKey === this.statuteKey(s);
  }

  toggleScanState(state: string): void {
    if (state === 'ALL') {
      this.scanStates = ['ALL'];
      return;
    }
    this.scanStates = this.scanStates.filter(s => s !== 'ALL');
    const idx = this.scanStates.indexOf(state);
    if (idx >= 0) {
      this.scanStates.splice(idx, 1);
    } else {
      this.scanStates.push(state);
    }
    if (this.scanStates.length === 0) this.scanStates = ['ALL'];
  }

  toggleScanCategory(cat: string): void {
    if (cat === 'ALL') {
      this.scanCategories = ['ALL'];
      return;
    }
    this.scanCategories = this.scanCategories.filter(c => c !== 'ALL');
    const idx = this.scanCategories.indexOf(cat);
    if (idx >= 0) {
      this.scanCategories.splice(idx, 1);
    } else {
      this.scanCategories.push(cat);
    }
    if (this.scanCategories.length === 0) this.scanCategories = ['ALL'];
  }

  isScanStateSelected(state: string): boolean {
    return this.scanStates.includes(state) || this.scanStates.includes('ALL');
  }

  isScanCategorySelected(cat: string): boolean {
    return this.scanCategories.includes(cat) || this.scanCategories.includes('ALL');
  }
}
