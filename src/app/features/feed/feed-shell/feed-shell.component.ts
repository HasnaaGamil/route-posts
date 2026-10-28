import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SuggestedFriendsComponent } from '../suggested-friends/suggested-friends.component';

@Component({
  selector: 'app-feed-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SuggestedFriendsComponent],
  host: { class: 'block' },
  templateUrl: './feed-shell.component.html',
})
export class FeedShellComponent {
  /** True from the `xl` breakpoint (1280px), where suggested friends get their own sidebar */
  isXl = signal(false);
  /** Below `xl`, suggested friends live in a collapsible panel instead */
  friendsOpen = signal(false);

  constructor() {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const query = window.matchMedia('(min-width: 1280px)');
    this.isXl.set(query.matches);

    const onChange = (e: MediaQueryListEvent) => this.isXl.set(e.matches);
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
  }
}