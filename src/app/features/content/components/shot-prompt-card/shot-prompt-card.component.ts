import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ShotPromptData {
  shot_number: number;
  character: string;
  line: string;
  duration: number;
  kling_prompt: string;
}

@Component({
  selector: 'app-shot-prompt-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <div class="flex items-center gap-3 mb-3">
        <span class="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm font-bold">
          {{ shot.shot_number }}
        </span>
        <div class="flex-1">
          <p class="text-sm font-medium text-slate-100">{{ shot.character }}</p>
          <p class="text-xs text-slate-400">{{ shot.duration }}s</p>
        </div>
        @if (editable) {
          <button
            (click)="editing = !editing"
            class="px-2 py-1 text-xs text-slate-400 hover:text-slate-100 bg-slate-700 rounded transition-colors"
          >
            {{ editing ? 'Done' : 'Edit' }}
          </button>
        }
      </div>

      <div class="mb-3 px-3 py-2 bg-slate-700/50 rounded-lg border-l-2 border-indigo-500">
        <p class="text-sm text-slate-200 italic">"{{ shot.line }}"</p>
      </div>

      @if (editing) {
        <textarea
          [(ngModel)]="editablePrompt"
          (ngModelChange)="onPromptChange()"
          class="input-field font-mono text-xs mb-2"
          rows="6"
        ></textarea>
      } @else {
        <div class="relative group">
          <pre class="text-xs text-slate-400 bg-slate-900 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono">{{ shot.kling_prompt }}</pre>
          <button
            (click)="copyPrompt()"
            class="absolute top-2 right-2 px-2 py-1 text-[10px] bg-slate-700 text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-600"
          >
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
      }
    </div>
  `
})
export class ShotPromptCardComponent {
  @Input() shot!: ShotPromptData;
  @Input() editable = false;
  @Output() promptChanged = new EventEmitter<string>();

  editing = false;
  editablePrompt = '';
  copied = false;

  ngOnInit(): void {
    this.editablePrompt = this.shot.kling_prompt;
  }

  onPromptChange(): void {
    this.promptChanged.emit(this.editablePrompt);
  }

  copyPrompt(): void {
    navigator.clipboard.writeText(this.shot.kling_prompt);
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }
}
