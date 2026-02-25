import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/overview/overview.component').then(m => m.OverviewComponent)
      },
      {
        path: 'marketing',
        loadComponent: () => import('./pages/dashboard/marketing/marketing.component').then(m => m.MarketingComponent)
      },
      {
        path: 'site-performance',
        loadComponent: () => import('./pages/dashboard/site-performance/site-performance.component').then(m => m.SitePerformanceComponent)
      },
      {
        path: 'revenue',
        loadComponent: () => import('./pages/dashboard/revenue/revenue.component').then(m => m.RevenueComponent)
      },
      {
        path: 'cases',
        loadComponent: () => import('./pages/dashboard/cases/cases.component').then(m => m.CasesComponent)
      },
      {
        path: 'hoa-news',
        loadComponent: () => import('./pages/dashboard/hoa-news/hoa-news.component').then(m => m.HOANewsComponent)
      },
      {
        path: 'legality-scorecard',
        loadComponent: () => import('./pages/dashboard/legality-scorecard/legality-scorecard.component').then(m => m.LegalityScorecardComponent)
      },
      {
        path: 'blog-manager',
        loadComponent: () => import('./pages/dashboard/blog-manager/blog-manager.component').then(m => m.BlogManagerComponent)
      }
    ]
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
