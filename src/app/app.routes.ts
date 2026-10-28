import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/guards/guard-guard';
import { AuthLayoutComponent } from './features/auth/auth-layout.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { FeedShellComponent } from './features/feed/feed-shell/feed-shell.component';

// Layouts stay eager (they are small and needed straight away).
// Every page is lazy-loaded, so each one downloads only when someone opens it.
export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        title: 'Sign In | Route Posts',
        loadComponent: () =>
          import('./features/auth/login-page/login-page.component').then((m) => m.LoginPageComponent),
      },
      {
        path: 'register',
        title: 'Create Account | Route Posts',
        loadComponent: () =>
          import('./features/auth/register-page/register-page.component').then((m) => m.RegisterPageComponent),
      },
    ],
  },
  {
    path: '',
    component: MainLayoutComponent,
    // Runs for every child navigation, not just the first entry into the layout
    canActivateChild: [authGuard],
    children: [
      {
        path: 'profile',
        title: 'My Profile | Route Posts',
        loadComponent: () =>
          import('./features/profile/my-profile-page/my-profile-page.component').then((m) => m.MyProfilePageComponent),
      },
      {
        path: 'users/:id',
        title: 'User Profile | Route Posts',
        loadComponent: () =>
          import('./features/profile/user-profile-page/user-profile-page.component').then(
            (m) => m.UserProfilePageComponent,
          ),
      },
      {
        path: 'notifications',
        title: 'Notifications | Route Posts',
        loadComponent: () =>
          import('./features/notifications-page/notifications-page.component').then(
            (m) => m.NotificationsPageComponent,
          ),
      },
      {
        path: 'settings',
        title: 'Settings | Route Posts',
        loadComponent: () =>
          import('./features/settings-page/settings-page.component').then((m) => m.SettingsPageComponent),
      },
      {
        // left sidebar + suggested friends stay while the center changes
        path: '',
        component: FeedShellComponent,
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'feed' },
          {
            path: 'feed',
            title: 'Home | Route Posts',
            loadComponent: () =>
              import('./features/feed/feed-page/feed-page.component').then((m) => m.FeedPageComponent),
          },
          {
            path: 'community',
            title: 'Community | Route Posts',
            loadComponent: () =>
              import('./features/feed/community-page/community-page.component').then(
                (m) => m.CommunityPageComponent,
              ),
          },
          {
            path: 'posts/:id',
            title: 'Post | Route Posts',
            loadComponent: () =>
              import('./features/post-details-page/post-details-page.component').then(
                (m) => m.PostDetailsPageComponent,
              ),
          },
          {
            path: 'saved',
            title: 'Saved | Route Posts',
            loadComponent: () =>
              import('./features/feed/saved-page/saved-page.component').then((m) => m.SavedPageComponent),
          },
          {
            path: 'my-posts',
            title: 'My Posts | Route Posts',
            loadComponent: () =>
              import('./features/feed/my-posts-page/my-posts-page.component').then((m) => m.MyPostsPageComponent),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'feed' },
];