import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-slate-100">
            Dispute<span class="text-indigo-500">My</span>HOA
          </h1>
          <p class="mt-2 text-slate-400">Operations Dashboard</p>
        </div>

        <div class="card">
          @if (linkSent) {
            <div class="text-center py-4">
              <svg class="w-12 h-12 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <h2 class="text-lg font-semibold text-slate-100 mb-2">Check your email</h2>
              <p class="text-sm text-slate-400 mb-4">
                We sent a login link to <span class="text-slate-200 font-medium">{{ email }}</span>
              </p>
              <p class="text-xs text-slate-500">Click the link in the email to sign in. It expires in 1 hour.</p>
              <button
                (click)="linkSent = false"
                class="mt-6 text-sm text-indigo-400 hover:text-indigo-300 underline"
              >
                Use a different email
              </button>
            </div>
          } @else {
            <form (ngSubmit)="onSubmit()" class="space-y-6">
              <div>
                <label for="email" class="block text-sm font-medium text-slate-300 mb-2">
                  Work Email
                </label>
                <input
                  type="email"
                  id="email"
                  [(ngModel)]="email"
                  name="email"
                  class="input-field"
                  placeholder="you@disputemyhoa.com"
                  autocomplete="email"
                />
                <p class="text-xs text-slate-500 mt-1.5">
                  Restricted to &#64;disputemyhoa.com and &#64;astrodigitallabs.com
                </p>
              </div>

              @if (error) {
                <div class="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                  <p class="text-sm text-red-400">{{ error }}</p>
                </div>
              }

              <button
                type="submit"
                [disabled]="isLoading || !email"
                class="w-full btn-primary py-3 flex items-center justify-center"
              >
                @if (isLoading) {
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending link...
                } @else {
                  Send Magic Link
                }
              </button>
            </form>
          }
        </div>

        <p class="mt-6 text-center text-sm text-slate-500">
          Internal use only. No password needed.
        </p>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  email = '';
  error = '';
  isLoading = false;
  linkSent = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.authService.init();
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  async onSubmit(): Promise<void> {
    this.error = '';
    this.isLoading = true;

    const result = await this.authService.sendMagicLink(this.email.trim());

    this.isLoading = false;

    if (result.ok) {
      this.linkSent = true;
    } else {
      this.error = result.error || 'Failed to send login link';
    }
  }
}
