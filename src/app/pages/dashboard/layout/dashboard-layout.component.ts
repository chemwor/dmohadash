import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { filter } from 'rxjs/operators';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-slate-900">
      <!-- Mobile Header Bar -->
      <header class="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-800 border-b border-slate-700 z-30 flex items-center justify-between px-4">
        <!-- Hamburger Button -->
        <button
          (click)="toggleSidebar()"
          class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
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

        <!-- Logo -->
        <h1 class="text-lg font-bold text-slate-100">
          Dispute<span class="text-indigo-500">My</span>HOA
        </h1>

        <!-- Placeholder for balance -->
        <div class="w-10"></div>
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
          <h1 class="text-xl font-bold text-slate-100">
            Dispute<span class="text-indigo-500">My</span>HOA
          </h1>
          <span class="text-xs text-slate-400">Operations Dashboard</span>
        </div>

        <!-- Mobile spacer for header -->
        <div class="lg:hidden h-14"></div>

        <!-- Navigation -->
        <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-indigo-500/20 text-indigo-400 border-indigo-500"
              [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
              (click)="onNavClick()"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-700/50 hover:text-slate-100 transition-colors border border-transparent"
            >
              <span [innerHTML]="item.icon" class="w-5 h-5 flex-shrink-0"></span>
              <span class="text-sm font-medium">{{ item.label }}</span>
            </a>
          }
        </nav>

        <!-- User section -->
        <div class="p-4 border-t border-slate-700">
          <button
            (click)="logout()"
            class="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 transition-colors"
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
      <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-30">
        <div class="flex justify-around items-center h-16">
          @for (item of mobileNavItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="text-indigo-400"
              [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
              class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-slate-100 transition-colors"
            >
              <span [innerHTML]="item.icon" class="w-5 h-5 mb-1"></span>
              <span class="text-[10px] font-medium">{{ item.label }}</span>
            </a>
          }
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
export class DashboardLayoutComponent {
  sidebarOpen = false;

  navItems: NavItem[] = [
    {
      path: '/dashboard',
      label: 'Overview',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>'
    },
    {
      path: '/dashboard/marketing',
      label: 'Marketing',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>'
    },
    {
      path: '/dashboard/site-performance',
      label: 'Site Performance',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>'
    },
    {
      path: '/dashboard/revenue',
      label: 'Revenue & Costs',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
    },
    {
      path: '/dashboard/cases',
      label: 'Cases',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>'
    },
    {
      path: '/dashboard/hoa-news',
      label: 'HOA News',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>'
    },
    {
      path: '/dashboard/legality-scorecard',
      label: 'Legality Scorecard',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>'
    },
    {
      path: '/dashboard/blog-manager',
      label: 'Blog Manager',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
    }
  ];

  // Simplified nav for mobile bottom bar (max 5 items)
  mobileNavItems: NavItem[] = [
    {
      path: '/dashboard',
      label: 'Home',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>'
    },
    {
      path: '/dashboard/marketing',
      label: 'Marketing',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>'
    },
    {
      path: '/dashboard/revenue',
      label: 'Revenue',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
    },
    {
      path: '/dashboard/cases',
      label: 'Cases',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>'
    },
    {
      path: '/dashboard/site-performance',
      label: 'Site',
      icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>'
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Close sidebar on route change (mobile)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeSidebar();
    });
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
    // Close sidebar on mobile when nav item is clicked
    if (window.innerWidth < 1024) {
      this.closeSidebar();
    }
  }

  private updateBodyScroll(): void {
    // Prevent body scroll when sidebar is open on mobile
    if (this.sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    // Close sidebar when resizing to desktop
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
