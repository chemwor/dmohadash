import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { ChatService } from '../../../core/services/chat.service';
import { ChatMessage } from '../../../interfaces/dashboard.interfaces';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html'
})
export class ChatbotComponent implements OnInit, OnDestroy, AfterViewChecked {
  private destroy$ = new Subject<void>();
  private shouldScroll = false;

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  inputMessage = '';
  loading = false;
  sending = false;
  contextUsed: string[] = [];
  historyLoading = false;

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  loadHistory(): void {
    this.historyLoading = true;
    this.chatService.getHistory(50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history) => {
          this.messages = history;
          this.historyLoading = false;
          this.shouldScroll = true;

          // Add welcome message if no history
          if (this.messages.length === 0) {
            this.messages.push({
              role: 'assistant',
              content: 'Welcome! I have access to all your business data and strategic documents. What would you like to discuss?',
              created_at: new Date().toISOString()
            });
          }
        },
        error: () => {
          this.historyLoading = false;
          this.messages.push({
            role: 'assistant',
            content: 'Welcome! I have access to all your business data and strategic documents. What would you like to discuss?',
            created_at: new Date().toISOString()
          });
        }
      });
  }

  sendMessage(): void {
    const text = this.inputMessage.trim();
    if (!text || this.sending) return;

    // Add user message immediately
    this.messages.push({
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    });

    this.inputMessage = '';
    this.sending = true;
    this.shouldScroll = true;

    this.chatService.send(text)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.messages.push({
            role: 'assistant',
            content: response.response,
            context_used: { sources: response.context_used },
            created_at: new Date().toISOString()
          });
          this.contextUsed = response.context_used;
          this.sending = false;
          this.shouldScroll = true;
        },
        error: () => {
          this.messages.push({
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            created_at: new Date().toISOString()
          });
          this.sending = false;
          this.shouldScroll = true;
        }
      });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
