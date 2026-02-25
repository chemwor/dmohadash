import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="skeleton"
      [style.height]="height"
      [style.width]="width"
      [class.rounded-full]="rounded"
    ></div>
  `,
  styles: [`
    .skeleton {
      background: linear-gradient(
        90deg,
        #334155 0%,
        #475569 50%,
        #334155 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  `]
})
export class LoadingSkeletonComponent {
  @Input() height = '20px';
  @Input() width = '100%';
  @Input() rounded = false;
}
