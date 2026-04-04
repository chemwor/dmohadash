import { Routes } from '@angular/router';

export const contentRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/content-dashboard/content-dashboard.component').then(m => m.ContentDashboardComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/idea-generator/idea-generator.component').then(m => m.IdeaGeneratorComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/video-detail/video-detail.component').then(m => m.VideoDetailComponent)
  }
];
