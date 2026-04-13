import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ShotPromptData {
  shot_number: number;
  character: string;
  dialogue?: string;
  line?: string;
  duration?: number;
  duration_seconds?: number;
  kling_prompt: string;
  elevenlabs_direction?: {
    voice_type: string;
    stability: number;
    expressiveness: number;
    delivery_notes: string;
  };
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
          <p class="text-xs text-slate-400">{{ getDuration() }}s</p>
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

      <!-- Dialogue -->
      <div class="mb-3 px-3 py-2 bg-slate-700/50 rounded-lg border-l-2 border-indigo-500">
        <p class="text-sm text-slate-200 italic">"{{ getDialogue() }}"</p>
      </div>

      <!-- ElevenLabs Direction -->
      @if (shot.elevenlabs_direction) {
        <div class="mb-3 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
          <p class="text-[10px] uppercase tracking-wider text-purple-400 mb-2">ElevenLabs Voice Direction</p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>
              <p class="text-slate-500">Voice</p>
              <p class="text-slate-300">{{ shot.elevenlabs_direction.voice_type }}</p>
            </div>
            <div>
              <p class="text-slate-500">Stability</p>
              <p class="text-slate-300">{{ shot.elevenlabs_direction.stability }}%</p>
            </div>
            <div>
              <p class="text-slate-500">Expressiveness</p>
              <p class="text-slate-300">{{ shot.elevenlabs_direction.expressiveness }}%</p>
            </div>
            <div>
              <p class="text-slate-500">Delivery</p>
              <p class="text-slate-300">{{ shot.elevenlabs_direction.delivery_notes }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Kling Prompt -->
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
export class ShotPromptCardComponent implements OnInit {
  @Input() shot!: ShotPromptData;
  @Input() editable = false;
  @Output() promptChanged = new EventEmitter<string>();

  editing = false;
  editablePrompt = '';
  copied = false;

  ngOnInit(): void {
    this.editablePrompt = this.shot.kling_prompt;
  }

  getDialogue(): string {
    return this.shot.dialogue || this.shot.line || '';
  }

  getDuration(): number {
    return this.shot.duration_seconds || this.shot.duration || 0;
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
