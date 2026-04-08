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
      // Operations Mode
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/command-center/command-center.component').then(m => m.CommandCenterComponent)
      },
      {
        path: 'overview',
        loadComponent: () => import('./pages/dashboard/overview/overview.component').then(m => m.OverviewComponent)
      },
      {
        path: 'alerts',
        loadComponent: () => import('./pages/dashboard/alerts/alerts.component').then(m => m.AlertsComponent)
      },
      {
        path: 'checklists',
        loadComponent: () => import('./pages/dashboard/checklists/checklists.component').then(m => m.ChecklistsComponent)
      },
      {
        path: 'chatbot',
        loadComponent: () => import('./pages/dashboard/chatbot/chatbot.component').then(m => m.ChatbotComponent)
      },
      {
        path: 'hoa-intel',
        loadComponent: () => import('./pages/dashboard/hoa-intel/hoa-intel.component').then(m => m.HoaIntelComponent)
      },
      {
        path: 'docs',
        loadComponent: () => import('./pages/dashboard/doc-hub/doc-hub.component').then(m => m.DocHubComponent)
      },
      {
        path: 'features',
        loadComponent: () => import('./pages/dashboard/feature-pipeline/feature-pipeline.component').then(m => m.FeaturePipelineComponent)
      },
      {
        path: 'costs',
        loadComponent: () => import('./pages/dashboard/cost-tracker/cost-tracker.component').then(m => m.CostTrackerComponent)
      },
      // 6-Month Plan Mode
      {
        path: 'plan',
        loadComponent: () => import('./pages/dashboard/six-month-overview/six-month-overview.component').then(m => m.SixMonthOverviewComponent)
      },
      {
        path: 'plan/month/:id',
        loadComponent: () => import('./pages/dashboard/month-detail/month-detail.component').then(m => m.MonthDetailComponent)
      },
      {
        path: 'plan/grading',
        loadComponent: () => import('./pages/dashboard/grading/grading.component').then(m => m.GradingComponent)
      },
      // Existing Analytics Routes
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
        path: 'legality-scorecard',
        loadComponent: () => import('./pages/dashboard/legality-scorecard/legality-scorecard.component').then(m => m.LegalityScorecardComponent)
      },
      {
        path: 'blog-manager',
        loadComponent: () => import('./pages/dashboard/blog-manager/blog-manager.component').then(m => m.BlogManagerComponent)
      },
      {
        path: 'statutes',
        loadComponent: () => import('./pages/dashboard/statutes/statutes.component').then(m => m.StatutesComponent)
      },
      {
        path: 'content',
        loadChildren: () => import('./features/content/content.routes').then(m => m.contentRoutes)
      },
      {
        path: 'reddit-leads',
        loadComponent: () => import('./pages/dashboard/reddit-leads/reddit-leads.component').then(m => m.RedditLeadsComponent)
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
