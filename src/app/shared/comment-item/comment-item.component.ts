import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PostComment } from '../../core/models/post.interface';
import { AuthService } from '../../core/services/auth.service';

import { AvatarComponent } from '../avatar/avatar.component';
import { CommentDraft, CommentFormComponent } from '../comment-form/comment-form.component';
import { TimeAgoPipe } from '../pipes/time-ago-pipe';
import { CommentsService } from '../../core/services/comment.service';

/**
 * One comment. Used in three places:
 *  - full size in the comments list on a post's page (like, reply, edit, delete)
 *  - `isReply` for the replies nested under a comment (no further replies)
 *  - `compact` as the read-only "top comment" preview on a post card
 *
 * It refers to itself in its own template to render replies; Angular allows that without importing it.
 */
@Component({
  selector: 'app-comment-item',
  standalone: true,
  imports: [AvatarComponent, TimeAgoPipe, RouterLink, CommentFormComponent],
  host: { class: 'block' },
  templateUrl: './comment-item.component.html',
})
export class CommentItemComponent {
  private auth = inject(AuthService);
  private commentsApi = inject(CommentsService);

  comment = input.required<PostComment>();
  compact = input(false);
  isReply = input(false);
  /** Falls back to `comment.post` when the parent doesn't pass it */
  postId = input<string>();

  deleted = output<string>();
  updated = output<PostComment>();

  pid = computed(() => this.postId() ?? this.comment().post);
  avatarSize = computed(() => (this.compact() ? 'h-8 w-8' : this.isReply() ? 'h-8 w-8' : 'h-10 w-10'));

  isMine = computed(() => {
    const me = this.auth.user()?._id;
    return !!me && me === this.comment().commentCreator._id;
  });

  // Local state so the UI reacts instantly; resets if the parent passes a different comment
  liked = linkedSignal(() => {
    const me = this.auth.user()?._id;
    return !!me && !!this.comment().likes?.includes(me);
  });
  likesCount = linkedSignal(() => this.comment().likes?.length ?? 0);
  content = linkedSignal(() => this.comment().content ?? '');
  repliesCount = linkedSignal(() => this.comment().repliesCount ?? 0);

  /** Long comments are clamped, with a "See more" button */
  expanded = signal(false);
  isLong = computed(() => {
    const text = this.content();
    return text.length > 240 || text.split('\n').length > 4;
  });

  liking = signal(false);
  editing = signal(false);
  replying = signal(false);
  confirmingDelete = signal(false);
  busy = signal(false);
  error = signal('');

  // Replies
  repliesOpen = signal(false);
  replies = signal<PostComment[]>([]);
  repliesLoaded = signal(false);
  repliesLoading = signal(false);
  repliesLoadingMore = signal(false);
  repliesError = signal('');
  repliesNext = signal<number | null>(null);

  // ---- Like / unlike ----
  toggleLike() {
    if (this.liking()) return;

    const was = this.liked();
    const before = this.likesCount();

    this.liked.set(!was); // optimistic
    this.likesCount.set(Math.max(0, before + (was ? -1 : 1)));
    this.liking.set(true);
    this.error.set('');

    this.commentsApi
      .toggleLike(this.pid(), this.comment()._id)
      .pipe(finalize(() => this.liking.set(false)))
      .subscribe({
        error: (err: HttpErrorResponse) => {
          this.liked.set(was); // roll back
          this.likesCount.set(before);
          this.error.set(this.messageFrom(err, 'Could not update your like.'));
        },
      });
  }

  // ---- Edit ----
  startEdit() {
    this.error.set('');
    this.replying.set(false);
    this.confirmingDelete.set(false);
    this.editing.set(true);
  }

  cancelEdit() {
    this.error.set('');
    this.editing.set(false);
  }

  saveEdit(draft: CommentDraft) {
    const text = draft.content;
    if (text === this.content()) {
      this.editing.set(false);
      return;
    }

    this.busy.set(true);
    this.error.set('');

    this.commentsApi
      .updateComment(this.pid(), this.comment()._id, text)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.content.set(text);
          this.editing.set(false);
          this.updated.emit({ ...this.comment(), content: text });
        },
        error: (err: HttpErrorResponse) => this.error.set(this.messageFrom(err, 'Could not save your changes.')),
      });
  }

  // ---- Delete ----
  askDelete() {
    this.error.set('');
    this.confirmingDelete.set(true);
  }

  confirmDelete() {
    this.busy.set(true);
    this.error.set('');

    this.commentsApi
      .deleteComment(this.pid(), this.comment()._id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.deleted.emit(this.comment()._id),
        error: (err: HttpErrorResponse) => {
          this.confirmingDelete.set(false);
          this.error.set(this.messageFrom(err, 'Could not delete this comment.'));
        },
      });
  }

  // ---- Reply ----
  startReply() {
    this.error.set('');
    this.editing.set(false);
    this.replying.set(!this.replying());
  }

  submitReply(draft: CommentDraft) {
    this.busy.set(true);
    this.error.set('');

    this.commentsApi
      .createReply(this.pid(), this.comment()._id, draft.content, draft.image)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (reply) => {
          this.repliesCount.update((n) => n + 1);
          this.replying.set(false);
          this.repliesOpen.set(true);

          if (this.repliesLoaded()) {
            this.replies.update((list) => [...list, reply]);
          } else {
            this.loadReplies(); // first time: fetch the list, which already includes the new reply
          }
        },
        error: (err: HttpErrorResponse) => this.error.set(this.messageFrom(err, 'Could not post your reply.')),
      });
  }

  // ---- Show replies ----
  toggleReplies() {
    const open = !this.repliesOpen();
    this.repliesOpen.set(open);
    if (open && !this.repliesLoaded()) this.loadReplies();
  }

  loadReplies() {
    this.repliesLoading.set(true);
    this.repliesError.set('');

    this.commentsApi
      .getReplies(this.pid(), this.comment()._id, 1)
      .pipe(finalize(() => this.repliesLoading.set(false)))
      .subscribe({
        next: (page) => {
          this.replies.set(page.comments);
          this.repliesNext.set(page.nextPage);
          this.repliesLoaded.set(true);
        },
        error: () => this.repliesError.set('Could not load replies.'),
      });
  }

  loadMoreReplies() {
    const page = this.repliesNext();
    if (!page || this.repliesLoadingMore()) return;

    this.repliesLoadingMore.set(true);
    this.repliesError.set('');

    this.commentsApi
      .getReplies(this.pid(), this.comment()._id, page)
      .pipe(finalize(() => this.repliesLoadingMore.set(false)))
      .subscribe({
        next: (res) => {
          this.replies.update((list) => [...list, ...res.comments]);
          this.repliesNext.set(res.nextPage);
        },
        error: () => this.repliesError.set('Could not load more replies.'),
      });
  }

  onReplyDeleted(id: string) {
    this.replies.update((list) => list.filter((r) => r._id !== id));
    this.repliesCount.update((n) => Math.max(0, n - 1));
  }

  private messageFrom(err: HttpErrorResponse, fallback: string) {
    const msg = err.error?.message;
    return (Array.isArray(msg) ? msg.join(', ') : msg) ?? fallback;
  }
}