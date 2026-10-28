import { Component, inject, signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PostsListComponent } from '../../../shared/post-list/post-list.component';
import { PostsService, PostsPage } from '../../../core/services/post.service';


@Component({
  selector: 'app-my-posts-page',
  standalone: true,
  imports: [PostsListComponent],
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <header class="flex items-center justify-between rounded-3xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm">
        <h1 class="flex items-center gap-2 text-lg font-bold">
          <svg class="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" /></svg>
          My posts
        </h1>
        @if (total() !== null) {
          <span class="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-600">{{ total() }}</span>
        }
      </header>

      <app-posts-list
        [source]="source"
        emptyText="You haven't posted yet."
        (totalChange)="total.set($event)"
      />
    </div>
  `,
})
export class MyPostsPageComponent {
  private auth = inject(AuthService);
  private postsApi = inject(PostsService);

  total = signal<number | null>(null);

  source = (page: number) => {
    const id = this.auth.user()?._id;
    return id ? this.postsApi.getByUser(id, page) : of<PostsPage>({ posts: [], nextPage: null });
  };
}