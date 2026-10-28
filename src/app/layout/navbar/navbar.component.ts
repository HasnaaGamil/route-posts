import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { NotificationsService } from '../../core/services/notifications.service';
import { switchMap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AvatarComponent],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  auth = inject(AuthService);
  menuOpen = signal(false);
  notifications = inject(NotificationsService);

constructor() {
  // Refresh the badge now and every minute
  timer(0, 60_000)
    .pipe(switchMap(() => this.notifications.refreshUnreadCount()), takeUntilDestroyed())
    .subscribe();
}

  logout() {
    this.menuOpen.set(false);
    this.auth.logout();
  }
}