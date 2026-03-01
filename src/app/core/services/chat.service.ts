import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { ChatMessage, ChatResponse } from '../../interfaces/dashboard.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly apiUrl = '/api/dashboard/chat';

  constructor(private http: HttpClient) {}

  send(message: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(this.apiUrl, { message }).pipe(
      catchError(error => {
        console.error('Chat service error:', error);
        return of({
          response: 'Sorry, I encountered an error. Please try again.',
          context_used: [],
          tokens_used: { input: 0, output: 0 }
        });
      })
    );
  }

  getHistory(limit: number = 50): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/history?limit=${limit}`).pipe(
      catchError(error => {
        console.error('Chat history error:', error);
        return of([]);
      })
    );
  }
}
