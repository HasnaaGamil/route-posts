import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { SuggestedUser } from '../../../core/models/user.interface';
import { UsersService } from '../../../core/services/user.service';
import { RouterLink } from '@angular/router';

type Friend = SuggestedUser & { following: boolean };

@Component({
  selector: 'app-suggested-friends',
  standalone: true,
  imports: [AvatarComponent,RouterLink],
  templateUrl: './suggested-friends.component.html',
})
export class SuggestedFriendsComponent implements OnInit {
  private users = inject(UsersService);
  layout = input<'list' | 'grid'>('list');
showHeader = input(true);

  friends = signal<Friend[]>([]);
  loading = signal(true);
  error = signal('');
  query = signal('');
  pending = signal<ReadonlySet<string>>(new Set());
   private page = 1;
hasMore = signal(false);
loadingMore = signal(false);

  visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q
      ? this.friends().filter((f) => f.name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q))
      : this.friends();
  });

  ngOnInit() {
    this.load();
  }



load() {
  this.loading.set(true);
  this.error.set('');
  this.page = 1;

  this.users
    .getSuggestions(50, 1)
    .pipe(finalize(() => this.loading.set(false)))
    .subscribe({
      next: ({ suggestions, hasMore }) => {
        this.friends.set(suggestions.map((u) => ({ ...u, name: u.name.trim(), following: false })));
        this.hasMore.set(hasMore);
      },
      error: () => this.error.set('Could not load suggestions.'),
    });
}

loadMore() {
  if (this.loadingMore() || !this.hasMore()) return;
  this.loadingMore.set(true);

  this.users
    .getSuggestions(50, this.page + 1)
    .pipe(finalize(() => this.loadingMore.set(false)))
    .subscribe({
      next: ({ suggestions, hasMore }) => {
        this.page++;
        const known = new Set(this.friends().map((f) => f._id));
        const fresh = suggestions
          .filter((u) => !known.has(u._id)) // avoid duplicates across pages
          .map((u) => ({ ...u, name: u.name.trim(), following: false }));
        this.friends.update((list) => [...list, ...fresh]);
        this.hasMore.set(hasMore);
      },
    });
}

  onSearch(e: Event) {
    this.query.set((e.target as HTMLInputElement).value);
  }

  toggleFollow(id: string) {
    if (this.pending().has(id)) return;

    const before = this.friends().find((f) => f._id === id);
    if (!before) return;

    // Optimistic update: flip immediately, adjust the follower count
    this.setFriend(id, !before.following);
    this.setPending(id, true);

    this.users
      .toggleFollow(id)
      .pipe(finalize(() => this.setPending(id, false)))
      .subscribe({
        // Roll back to the previous state if the request fails
        error: () => this.setFriend(id, before.following),
      });
  }

  /** Sets the follow state and keeps the follower count consistent with it. */
  private setFriend(id: string, following: boolean) {
    this.friends.update((list) =>
      list.map((f) => {
        if (f._id !== id || f.following === following) return f;
        return { ...f, following, followersCount: f.followersCount + (following ? 1 : -1) };
      }),
    );
  }

  private setPending(id: string, on: boolean) {
    this.pending.update((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}