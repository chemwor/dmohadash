import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd, Router } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { AlertsService } from '../../../core/services/alerts.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
}

interface QuickLink {
  label: string;
  url: string;
}

type DashboardMode = 'operations' | 'plan';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-slate-900">
      <!-- Mobile Header Bar -->
      <header class="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-800 border-b border-slate-700 z-30 flex items-center justify-between px-4">
        <button
          (click)="toggleSidebar()"
          class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Toggle menu"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            @if (sidebarOpen) {
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            } @else {
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            }
          </svg>
        </button>

        <h1 class="text-lg font-bold text-slate-100">
          Dispute<span class="text-indigo-500">My</span>HOA
        </h1>

        <!-- Alert Bell (mobile) -->
        <a routerLink="/dashboard/alerts" class="relative p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          @if (alertCount > 0) {
            <span class="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {{ alertCount > 9 ? '9+' : alertCount }}
            </span>
          }
        </a>
      </header>

      <!-- Overlay for mobile -->
      @if (sidebarOpen) {
        <div
          class="lg:hidden fixed inset-0 bg-black/50 z-30 transition-opacity"
          (click)="closeSidebar()"
        ></div>
      }

      <!-- Sidebar -->
      <aside
        [class]="'fixed h-full z-40 w-64 bg-slate-800 border-r border-slate-700 flex flex-col transition-transform duration-300 ease-in-out ' +
                 (sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')"
      >
        <!-- Logo (Desktop only) -->
        <div class="hidden lg:block p-4 border-b border-slate-700">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-xl font-bold text-slate-100">
                Dispute<span class="text-indigo-500">My</span>HOA
              </h1>
              <span class="text-xs text-slate-400">{{ mode === 'operations' ? 'Operations' : '6-Month Plan' }}</span>
            </div>
            <!-- Alert Bell (desktop) -->
            <a routerLink="/dashboard/alerts" class="relative p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              @if (alertCount > 0) {
                <span class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {{ alertCount > 9 ? '9+' : alertCount }}
                </span>
              }
            </a>
          </div>
        </div>

        <!-- Mobile spacer for header -->
        <div class="lg:hidden h-14"></div>

        <!-- Mode Toggle -->
        <div class="px-4 pt-4 pb-2">
          <div class="flex bg-slate-900 rounded-lg p-0.5">
            <button
              (click)="setMode('operations')"
              [class]="mode === 'operations'
                ? 'flex-1 px-2 py-1.5 text-xs font-semibold rounded-md bg-indigo-500 text-white transition-colors'
                : 'flex-1 px-2 py-1.5 text-xs font-semibold rounded-md text-slate-400 hover:text-slate-200 transition-colors'"
            >
              Operations
            </button>
            <button
              (click)="setMode('plan')"
              [class]="mode === 'plan'
                ? 'flex-1 px-2 py-1.5 text-xs font-semibold rounded-md bg-indigo-500 text-white transition-colors'
                : 'flex-1 px-2 py-1.5 text-xs font-semibold rounded-md text-slate-400 hover:text-slate-200 transition-colors'"
            >
              6-Month Plan
            </button>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-4 pb-2 space-y-0.5 overflow-y-auto">
          @for (item of activeNavItems; track item.path) {
            @if (item.label.startsWith('---')) {
              <div class="nav-section-label">{{ item.label.substring(3) }}</div>
            } @else {
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-indigo-500/20 text-indigo-400 border-indigo-500"
                [routerLinkActiveOptions]="{ exact: item.exact !== false && item.path === '/dashboard' }"
                (click)="onNavClick()"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700/50 hover:text-slate-100 transition-colors border border-transparent text-sm"
              >
                <span [innerHTML]="item.icon" class="w-5 h-5 flex-shrink-0"></span>
                <span class="font-medium">{{ item.label }}</span>
              </a>
            }
          }
        </nav>

        <!-- Quick Links -->
        <div class="px-4 py-3 border-t border-slate-700">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2 px-1">Quick Links</p>
          <div class="grid grid-cols-2 gap-0.5">
            @for (link of quickLinks; track link.label) {
              <a
                [href]="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="px-2 py-1.5 text-[11px] text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors truncate"
              >
                {{ link.label }}
              </a>
            }
          </div>
        </div>

        <!-- User section -->
        <div class="px-4 py-3 border-t border-slate-700">
          <button
            (click)="logout()"
            class="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span class="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <!-- Main content -->
      <main class="lg:ml-64 pt-14 lg:pt-0 pb-16 lg:pb-0 min-h-screen">
        <router-outlet></router-outlet>
      </main>

      <!-- Mobile Bottom Navigation -->
      <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-30 safe-area-bottom">
        <div class="flex justify-around items-center h-14">
          <a
            routerLink="/dashboard"
            routerLinkActive="text-indigo-400"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-slate-100 transition-colors"
          >
            <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
            <span class="text-[10px] font-medium">Hub</span>
          </a>

          <a
            routerLink="/dashboard/alerts"
            routerLinkActive="text-indigo-400"
            class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-slate-100 transition-colors relative"
          >
            <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            @if (alertCount > 0) {
              <span class="absolute top-1 right-1/4 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {{ alertCount > 9 ? '9+' : alertCount }}
              </span>
            }
            <span class="text-[10px] font-medium">Alerts</span>
          </a>

          <a
            routerLink="/dashboard/chatbot"
            routerLinkActive="text-indigo-400"
            class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-slate-100 transition-colors"
          >
            <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
            <span class="text-[10px] font-medium">Chat</span>
          </a>

          <a
            routerLink="/dashboard/plan"
            routerLinkActive="text-indigo-400"
            class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-slate-100 transition-colors"
          >
            <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <span class="text-[10px] font-medium">Plan</span>
          </a>

          <button
            (click)="toggleSidebar()"
            class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-slate-100 transition-colors"
          >
            <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            <span class="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  sidebarOpen = false;
  mode: DashboardMode = 'operations';
  alertCount = 0;

  quickLinks: QuickLink[] = [
    { label: 'GitHub', url: 'https://github.com' },
    { label: 'Stripe', url: 'https://dashboard.stripe.com' },
    { label: 'Google Ads', url: 'https://ads.google.com' },
    { label: 'Supabase', url: 'https://supabase.com/dashboard' },
    { label: 'Heroku', url: 'https://dashboard.heroku.com' },
    { label: 'Klaviyo', url: 'https://www.klaviyo.com' },
    { label: 'PostHog', url: 'https://us.posthog.com' },
    { label: 'Netlify', url: 'https://app.netlify.com' },
    { label: 'Search Console', url: 'https://search.google.com/search-console' },
    { label: 'Analytics', url: 'https://analytics.google.com' }
  ];

  operationsNavItems: NavItem[] = [
    { path: '/dashboard', label: 'Command Center', exact: true, icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>' },
    { path: '/dashboard/revenue', label: 'Revenue', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' },
    { path: '/dashboard/cases', label: 'Cases', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' },
    { path: '/dashboard/marketing', label: 'Marketing', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>' },
    { path: '/dashboard/alerts', label: 'Alerts', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>' },
    { path: '/dashboard/checklists', label: 'Checklists', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>' },
    { path: '/dashboard/chatbot', label: 'AI Advisor', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>' },
    { path: '/dashboard/hoa-intel', label: 'HOA News', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>' },
    { path: '/dashboard/features', label: 'Features', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>' },
    { path: '/dashboard/docs', label: 'Doc Hub', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>' },
    { path: '/dashboard/costs', label: 'Cost Tracker', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>' },
    { path: '/dashboard/blog-manager', label: 'Blog Manager', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>' },
    { path: '/dashboard/site-performance', label: 'Site Performance', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' },
    { path: '/dashboard/overview', label: 'Analytics Overview', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>' },
    { path: '/dashboard/legality-scorecard', label: 'Legality Scorecard', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' }
  ];

  planNavItems: NavItem[] = [
    { path: '/dashboard/plan', label: 'Plan Overview', exact: true, icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' },
    { path: '/dashboard/plan/month/1', label: 'Month 1: Foundation', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { path: '/dashboard/plan/month/2', label: 'Month 2: Optimize', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { path: '/dashboard/plan/month/3', label: 'Month 3: Revenue', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { path: '/dashboard/plan/month/4', label: 'Month 4: Scale', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { path: '/dashboard/plan/month/5', label: 'Month 5: Authority', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { path: '/dashboard/plan/month/6', label: 'Month 6: Evaluate', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { path: '/dashboard/plan/grading', label: 'Grading', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>' }
  ];

  get activeNavItems(): NavItem[] {
    return this.mode === 'operations' ? this.operationsNavItems : this.planNavItems;
  }

  constructor(
    private authService: AuthService,
    private alertsService: AlertsService,
    private router: Router
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.closeSidebar();
      // Auto-detect mode from URL
      const url = (event as NavigationEnd).urlAfterRedirects || '';
      if (url.includes('/plan')) {
        this.mode = 'plan';
      }
    });
  }

  ngOnInit(): void {
    // Load saved mode
    const saved = localStorage.getItem('dashboard_mode');
    if (saved === 'plan' || saved === 'operations') {
      this.mode = saved;
    }

    // Poll alert count
    this.loadAlertCount();
    interval(60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadAlertCount());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAlertCount(): void {
    this.alertsService.getAll({ acknowledged: false })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.alertCount = data.unacknowledged_counts.critical + data.unacknowledged_counts.warning + data.unacknowledged_counts.info;
        }
      });
  }

  setMode(mode: DashboardMode): void {
    this.mode = mode;
    localStorage.setItem('dashboard_mode', mode);
    if (mode === 'plan') {
      this.router.navigate(['/dashboard/plan']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    this.updateBodyScroll();
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
    this.updateBodyScroll();
  }

  onNavClick(): void {
    if (window.innerWidth < 1024) {
      this.closeSidebar();
    }
  }

  private updateBodyScroll(): void {
    if (this.sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth >= 1024) {
      this.sidebarOpen = false;
      document.body.style.overflow = '';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
