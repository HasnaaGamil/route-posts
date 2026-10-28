import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { finalize } from 'rxjs';
import { PostComment } from '../../core/models/post.interface';

import { CommentDraft, CommentFormComponent } from '../comment-form/comment-form.component';
import { CommentItemComponent } from '../comment-item/comment-item.component';
import { CommentsService } from '../../core/services/comment.service';

export type CommentSort = 'relevant' | 'newest';

/** How many comments are shown at first, and how many each "View more" adds */
const STEP = 5;

@Component({
  selector: 'app-comments-section',
  standalone: true,
  imports: [CommentItemComponent, CommentFormComponent],
  host: { class: 'block' },
  templateUrl: './comments-section.component.html',
})
export class CommentsSectionComponent implements OnInit {
  private commentsApi = inject(CommentsService);

  postId = input.required<string>();
  /** When true, renders without its own card and header (used inside a post card) */
  embedded = input(false);

  /** Emits the new total whenever a comment is added or deleted, so the post's count can follow */
  totalChange = output<number>();

  private form = viewChild(CommentFormComponent);

  comments = signal<PostComment[]>([]);
  total = signal<number | null>(null);
  loading = signal(true);
  loadingMore = signal(false);
  error = signal('');
  nextPage = signal<number | null>(null);

  submitting = signal(false);
  submitError = signal('');

  sort = signal<CommentSort>('relevant');

  /** Comments in the chosen order (sorts what is loaded so far) */
  sorted = computed(() => {
    const list = [...this.comments()];
    const time = (c: PostComment) => new Date(c.createdAt).getTime();

    if (this.sort() === 'newest') return list.sort((a, b) => time(b) - time(a));

    // Most relevant: liked and replied-to comments first, newest breaks ties
    const score = (c: PostComment) => (c.likes?.length ?? 0) * 2 + (c.repliesCount ?? 0);
    return list.sort((a, b) => score(b) - score(a) || time(b) - time(a));
  });

  /** How many comments are visible right now */
  visibleCount = signal(STEP);
  visible = computed(() => this.sorted().slice(0, this.visibleCount()));

  /** Comments already loaded but still hidden */
  hiddenLoaded = computed(() => Math.max(this.comments().length - this.visibleCount(), 0));

  /** Comments not visible yet, whether loaded or still on the server */
  moreCount = computed(() => {
    const total = this.total();
    return total === null ? this.hiddenLoaded() : Math.max(total - this.visible().length, 0);
  });

  /** "View more" shows when hidden or unloaded comments remain */
  canViewMore = computed(() => this.hiddenLoaded() > 0 || !!this.nextPage());

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.commentsApi
      .getComments(this.postId(), 1)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.comments.set(page.comments);
          this.nextPage.set(page.nextPage);
          this.total.set(page.total ?? page.comments.length);
        },
        error: () => this.error.set('Could not load comments.'),
      });
  }

  /** Reveals the next batch; fetches the next page from the server only when everything loaded is already shown */
  viewMore() {
    const needsFetch = this.hiddenLoaded() === 0;
    this.visibleCount.update((n) => n + STEP);
    if (needsFetch) this.loadMore();
  }

  /** Collapses back to the first few comments */
  viewLess() {
    this.visibleCount.set(STEP);
  }

  private loadMore() {
    const page = this.nextPage();
    if (!page || this.loadingMore()) return;

    this.loadingMore.set(true);
    this.error.set('');

    this.commentsApi
      .getComments(this.postId(), page)
      .pipe(finalize(() => this.loadingMore.set(false)))
      .subscribe({
        next: (res) => {
          this.comments.update((list) => [...list, ...res.comments]);
          this.nextPage.set(res.nextPage);
        },
        error: () => this.error.set('Could not load more comments.'),
      });
  }

  addComment(draft: CommentDraft) {
    this.submitting.set(true);
    this.submitError.set('');

    this.commentsApi
      .createComment(this.postId(), draft.content, draft.image)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (comment) => {
          const newTotal = (this.total() ?? this.comments().length) + 1;
          this.comments.update((list) => [comment, ...list]);
          this.total.set(newTotal);
          this.totalChange.emit(newTotal);
          this.sort.set('newest'); // so the user sees their new comment at the top
          this.form()?.clear();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.error?.message;
          this.submitError.set((Array.isArray(msg) ? msg.join(', ') : msg) ?? 'Could not post your comment.');
        },
      });
  }

  onDeleted(id: string) {
    const newTotal = Math.max((this.total() ?? this.comments().length) - 1, 0);
    this.comments.update((list) => list.filter((c) => c._id !== id));
    this.total.set(newTotal);
    this.totalChange.emit(newTotal);
  }
}