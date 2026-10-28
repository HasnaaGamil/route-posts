import { Component, inject, signal } from '@angular/core';
import { map, of, switchMap, tap } from 'rxjs';
import { PostsService } from '../../../core/services/post.service';
import { UsersService } from '../../../core/services/user.service';
import { PostsListComponent } from '../../../shared/post-list/post-list.component';


@Component({
  selector: 'app-saved-page',
  standalone: true,
  imports: [PostsListComponent],
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <header class="flex items-center justify-between rounded-3xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm">
        <h1 class="flex items-center gap-2 text-lg font-bold">
          <svg class="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4V4z" /></svg>
          Saved posts
        </h1>
        @if (total() !== null) {
          <span class="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-600">{{ total() }}</span>
        }
      </header>

      <app-posts-list
        [source]="source"
        [hideUnsaved]="true"
        emptyText="You haven't saved any posts yet."
        (totalChange)="total.set($event)"
      />
    </div>
  `,
})
export class SavedPageComponent {
  private usersApi = inject(UsersService);
  private postsApi = inject(PostsService);

  total = signal<number | null>(null);

  /** Saved post ids, newest first. Refreshed every time the first page is (re)loaded. */
  private ids: string[] = [];

  source = (page: number) => {
    const ids$ =
      page === 1
        ? this.usersApi.getProfile().pipe(
            map((profile) => [...profile.bookmarks].reverse()),
            tap((ids) => (this.ids = ids)),
          )
        : of(this.ids);

    return ids$.pipe(switchMap((ids) => this.postsApi.getSaved(ids, page)));
  };
}