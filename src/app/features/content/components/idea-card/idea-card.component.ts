import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-idea-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card hover:border-slate-600 transition-colors cursor-pointer">
      <div class="flex items-start justify-between mb-3">
        <span [class]="'px-2 py-0.5 rounded-full text-xs font-medium ' + typeBadgeClass">
          {{ typeLabel }}
        </span>
        <span [class]="'px-2 py-0.5 rounded-full text-xs font-medium ' + statusBadgeClass">
          {{ status }}
        </span>
      </div>

      <p class="text-slate-100 text-sm font-medium mb-2 line-clamp-2">{{ scenario }}</p>

      <div class="flex items-center gap-3 text-xs text-slate-400 mb-4">
        <span>{{ violationType }}</span>
        <span class="text-slate-600">|</span>
        <span class="text-amber-400 font-medium">\${{ fineAmount }}</span>
      </div>

      @if (actionLabel) {
        <button
          (click)="action.emit(); $event.stopPropagation()"
          [class]="actionLabel === 'View Post' ? 'btn-secondary w-full text-xs' : 'btn-primary w-full text-xs'"
        >
          {{ actionLabel }}
        </button>
      }
    </div>
  `,
  styles: [`
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class IdeaCardComponent {
  @Input() type = '';
  @Input() scenario = '';
  @Input() violationType = '';
  @Input() fineAmount = 0;
  @Input() status = 'idea';
  @Output() action = new EventEmitter<void>();

  private readonly typeColors: Record<string, string> = {
    board_meeting: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    doorbell_footage: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    street_confrontation: 'bg-red-500/20 text-red-400 border border-red-500/30',
    official_document: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    news_broadcast: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    homeowner_pov: 'bg-green-500/20 text-green-400 border border-green-500/30',
  };

  private readonly typeLabels: Record<string, string> = {
    board_meeting: 'Board Meeting',
    doorbell_footage: 'Doorbell',
    street_confrontation: 'Confrontation',
    official_document: 'Document',
    news_broadcast: 'News',
    homeowner_pov: 'Homeowner POV',
  };

  private readonly statusColors: Record<string, string> = {
    idea: 'bg-slate-500/20 text-slate-400',
    prompt_ready: 'bg-blue-500/20 text-blue-400',
    generating: 'bg-yellow-500/20 text-yellow-400 animate-pulse',
    review: 'bg-orange-500/20 text-orange-400',
    approved: 'bg-green-500/20 text-green-400',
    published: 'bg-teal-500/20 text-teal-400',
  };

  private readonly actionLabels: Record<string, string> = {
    idea: 'Generate Prompts',
    prompt_ready: 'Generate Video',
    generating: '',
    review: 'Review Shots',
    approved: 'Generate Copy',
    published: 'View Post',
  };

  get typeBadgeClass(): string {
    return this.typeColors[this.type] || this.typeColors['official_document'];
  }

  get typeLabel(): string {
    return this.typeLabels[this.type] || this.type;
  }

  get statusBadgeClass(): string {
    return this.statusColors[this.status] || this.statusColors['idea'];
  }

  get actionLabel(): string {
    return this.actionLabels[this.status] || '';
  }
}
