import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton.component';

export type TrendDirection = 'up' | 'down' | 'neutral';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent],
  template: `
    <div class="card h-full">
      <div class="flex items-start justify-between">
        <h3 class="text-sm font-medium text-slate-400">{{ title }}</h3>
        @if (trend && trend !== 'neutral' && !loading) {
          <span
            class="flex items-center text-sm font-medium"
            [class.text-green-500]="trend === 'up'"
            [class.text-red-500]="trend === 'down'"
          >
            @if (trend === 'up') {
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            }
            @if (trend === 'down') {
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            }
          </span>
        }
      </div>

      @if (loading) {
        <div class="mt-2">
          <app-loading-skeleton height="36px" width="120px"></app-loading-skeleton>
        </div>
        @if (subtitle) {
          <div class="mt-2">
            <app-loading-skeleton height="16px" width="80px"></app-loading-skeleton>
          </div>
        }
      } @else if (error) {
        <div class="mt-2">
          <p class="text-red-500 text-sm">{{ error }}</p>
          <button
            (click)="retry.emit()"
            class="mt-2 text-sm text-indigo-400 hover:text-indigo-300 underline"
          >
            Retry
          </button>
        </div>
      } @else {
        <div class="mt-2">
          <span class="text-3xl font-bold text-slate-100">
            {{ prefix }}{{ formattedValue }}{{ suffix }}
          </span>
        </div>
        @if (subtitle) {
          <p class="mt-2 text-sm text-slate-400">{{ subtitle }}</p>
        }
      }
    </div>
  `
})
export class MetricCardComponent {
  @Input() title = '';
  @Input() value: string | number = 0;
  @Input() subtitle = '';
  @Input() trend: TrendDirection = 'neutral';
  @Input() loading = false;
  @Input() error = '';
  @Input() prefix = '';
  @Input() suffix = '';
  @Output() retry = new EventEmitter<void>();

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
