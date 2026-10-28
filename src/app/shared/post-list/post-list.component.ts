import { Component, effect, input, OnInit, output, signal } from '@angular/core';
import { Observable, finalize } from 'rxjs';

import { PostCardComponent } from '../post-card/post-card.component';
import { Post } from '../../core/models/post.interface';
import { PostsPage } from '../../core/services/post.service';

/**
 * Loads and paginates any list of posts.
 * Usage: <app-posts-list [source]="loader" />, where loader = (page) => postsService.getFeed(page)
 */
@Component({
  selector: 'app-posts-list',
  standalone: true,
  imports: [PostCardComponent],
  host: { class: 'block' },
  templateUrl: './post-list.component.html',
})
export class PostsListComponent implements OnInit {
  source = input.required<(page: number) => Observable<PostsPage>>();
  emptyText = input('No posts yet. Be the first one to publish.');
  /** When true, a post disappears from the list as soon as it is unsaved (used on the Saved page) */
  hideUnsaved = input(false);

  /** Emits the total number of posts in this list (and again whenever it changes) */
  totalChange = output<number>();

  posts = signal<Post[]>([]);
  total = signal<number | null>(null);
  private totalEmitter = effect(() => {
    const t = this.total();
    if (t !== null) this.totalChange.emit(t);
  });
  loading = signal(true);
  loadingMore = signal(false);
  error = signal('');
  nextPage = signal<number | null>(null);

  ngOnInit() {
    this.loadFirstPage();
  }

  /** Adds a freshly created post to the top of the list. */
  prepend(post: Post) {
    this.posts.update((list) => [post, ...list]);
    this.total.update((t) => (t === null ? t : t + 1));
  }

  remove(id: string) {
    this.posts.update((list) => list.filter((p) => p._id !== id));
    this.total.update((t) => (t === null ? t : Math.max(0, t - 1)));
  }

  replace(post: Post) {
    if (this.hideUnsaved() && post.bookmarked === false) {
      this.remove(post._id);
      return;
    }
    this.posts.update((list) => list.map((p) => (p._id === post._id ? post : p)));
  }

  loadFirstPage() {
    this.loading.set(true);
    this.error.set('');

    this.source()(1)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.posts.set(page.posts);
          this.nextPage.set(page.nextPage);
          this.total.set(page.total ?? page.posts.length);
        },
        error: () => this.error.set('Could not load posts.'),
      });
  }

  loadMore() {
    const page = this.nextPage();
    if (!page || this.loadingMore()) return;

    this.loadingMore.set(true);
    this.error.set('');

    this.source()(page)
      .pipe(finalize(() => this.loadingMore.set(false)))
      .subscribe({
        next: (res) => {
          this.posts.update((list) => [...list, ...res.posts]);
          this.nextPage.set(res.nextPage);
        },
        error: () => this.error.set('Could not load more posts.'),
      });
  }
}