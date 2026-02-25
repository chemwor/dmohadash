import { Injectable } from '@angular/core';

const AUTH_KEY = 'dmhoa_authenticated';
const DEFAULT_PASSWORD = 'kilimanjaro2026';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly password: string;

  constructor() {
    // In production, this would be fetched from environment or a secure endpoint
    this.password = DEFAULT_PASSWORD;
  }

  login(password: string): boolean {
    if (password === this.password) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      return true;
    }
    return false;
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_KEY);
  }

  isAuthenticated(): boolean {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  }
}
