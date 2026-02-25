import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton.component';

@Component({
  selector: 'app-stat-row',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent],
  template: `
    <div class="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
      <span class="text-sm text-slate-400">{{ label }}</span>
      @if (loading) {
        <app-loading-skeleton height="20px" width="60px"></app-loading-skeleton>
      } @else {
        <span class="text-sm font-medium text-slate-100">
          {{ prefix }}{{ formattedValue }}{{ suffix }}
        </span>
      }
    </div>
  `
})
export class StatRowComponent {
  @Input() label = '';
  @Input() value: string | number = 0;
  @Input() prefix = '';
  @Input() suffix = '';
  @Input() loading = false;

  get formattedValue(): string {
    if (typeof this.value === 'number') {
      return this.value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    }
    return this.value;
  }
}
