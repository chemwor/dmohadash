import { Injectable } from '@angular/core';
import { supabase } from '../supabase';

// Only these email domains can log into the admin dashboard.
const ALLOWED_DOMAINS = ['disputemyhoa.com', 'astrodigitallabs.com'];

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private session: any = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Restore session from Supabase localStorage persistence
    const { data } = await supabase.auth.getSession();
    this.session = data.session;

    // Listen for auth state changes (login, logout, token refresh)
    supabase.auth.onAuthStateChange((_event, session) => {
      this.session = session;
    });
  }

  isAuthenticated(): boolean {
    return !!this.session;
  }

  getEmail(): string {
    return this.session?.user?.email || '';
  }

  isDomainAllowed(email: string): boolean {
    if (!email || !email.includes('@')) return false;
    const domain = email.split('@')[1].toLowerCase();
    return ALLOWED_DOMAINS.includes(domain);
  }

  async sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.isDomainAllowed(email)) {
      return { ok: false, error: 'Email domain not authorized. Use a @disputemyhoa.com or @astrodigitallabs.com address.' };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/dashboard',
      },
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut();
    this.session = null;
  }
}
