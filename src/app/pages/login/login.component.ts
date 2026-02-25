import { Component } from '@angular/core';
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
          <form (ngSubmit)="onSubmit()" class="space-y-6">
            <div>
              <label for="password" class="block text-sm font-medium text-slate-300 mb-2">
                Dashboard Password
              </label>
              <input
                type="password"
                id="password"
                [(ngModel)]="password"
                name="password"
                class="input-field"
                placeholder="Enter password"
                autocomplete="current-password"
              />
            </div>

            @if (error) {
              <div class="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                <p class="text-sm text-red-400">{{ error }}</p>
              </div>
            }

            <button
              type="submit"
              [disabled]="isLoading"
              class="w-full btn-primary py-3 flex items-center justify-center"
            >
              @if (isLoading) {
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              } @else {
                Sign In
              }
            </button>
          </form>
        </div>

        <p class="mt-6 text-center text-sm text-slate-500">
          Internal use only
        </p>
      </div>
    </div>
  `
})
export class LoginComponent {
  password = '';
  error = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit(): void {
    this.error = '';
    this.isLoading = true;

    setTimeout(() => {
      if (this.authService.login(this.password)) {
        this.router.navigate(['/dashboard']);
      } else {
        this.error = 'Invalid password. Please try again.';
      }
      this.isLoading = false;
    }, 500);
  }
}
