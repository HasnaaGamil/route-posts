import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Post, PostPrivacy, PRIVACY_OPTIONS } from '../../core/models/post.interface';
import { AuthService } from '../../core/services/auth.service';
import { PostsService } from '../../core/services/post.service';
import { AvatarComponent } from '../avatar/avatar.component';
import { CommentItemComponent } from '../comment-item/comment-item.component';
import { CommentsSectionComponent } from '../comments-section/comments-section.component';
import { LikesDialogComponent } from '../likes-dialog/likes-dialog.component';
import { ShareDialogComponent } from '../share-dialog/share-dialog.component';
import { TimeAgoPipe } from '../pipes/time-ago-pipe';


@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [AvatarComponent, TimeAgoPipe, RouterLink, LikesDialogComponent, ShareDialogComponent, CommentItemComponent, CommentsSectionComponent],
  host: { class: 'block', '(document:keydown.escape)': 'onEscape()' },
  templateUrl: './post-card.component.html',
})
export class PostCardComponent {
  private auth = inject(AuthService);
  private postsApi = inject(PostsService);

  post = input.required<Post>();
  /** Show the top comment and let people expand all comments inside the card (off on the post page) */
  inlineComments = input(true);
  deleted = output<string>();
  updated = output<Post>();
  /** Emits the brand-new post created by sharing, so lists can show it at the top */
  postShared = output<Post>();

  privacyOptions = PRIVACY_OPTIONS;

  isMine = computed(() => !!this.auth.user() && this.auth.user()!._id === this.post().user._id);

  /** Local like state so the button reacts instantly; resets whenever the post input changes */
  liked = linkedSignal(() => {
    const me = this.auth.user()?._id;
    return !!me && !!this.post().likes?.includes(me);
  });
  likesCount = linkedSignal(() => this.post().likesCount ?? 0);
  liking = signal(false);

  privacy = computed<PostPrivacy>(() => this.post().privacy ?? 'public');
  privacyLabel = computed(() => PRIVACY_OPTIONS.find((o) => o.value === this.privacy())?.label ?? 'Public');

  /** Local copy of "saved" so the menu updates instantly */
  saved = linkedSignal(() => this.post().bookmarked ?? false);

  menuOpen = signal(false);
  commentsOpen = signal(false);
  dialog = signal<'none' | 'edit' | 'delete' | 'likes' | 'share'>('none');
  busy = signal(false);
  errorMsg = signal('');
  /** Short-lived message for failed quick actions (save / like) */
  actionError = signal('');
  notice = signal('');

  editBody = signal('');
  editPrivacy = signal<PostPrivacy>('public');

  toggleLike() {
    if (this.liking()) return;

    const wasLiked = this.liked();
    const before = this.likesCount();

    // Optimistic update
    this.liked.set(!wasLiked);
    this.likesCount.set(Math.max(0, before + (wasLiked ? -1 : 1)));
    this.liking.set(true);

    this.postsApi
      .toggleLike(this.post()._id)
      .pipe(finalize(() => this.liking.set(false)))
      .subscribe({
        next: (res) => {
          // Trust the server's numbers and keep the parent list in sync
          this.liked.set(res.liked);
          this.likesCount.set(res.likesCount);
          this.updated.emit({
            ...this.post(),
            likes: res.post.likes,
            likesCount: res.likesCount,
            bookmarked: this.saved(),
          });
        },
        error: (err: HttpErrorResponse) => {
          this.liked.set(wasLiked);
          this.likesCount.set(before);
          this.showActionError(err, 'Could not update your like.');
        },
      });
  }

  toggleSave() {
    this.menuOpen.set(false);
    const before = this.saved();
    this.saved.set(!before); // optimistic
    this.postsApi.toggleBookmark(this.post()._id).subscribe({
      // Tell the parent, so a later list update doesn't reset the saved state
      next: () => this.updated.emit({ ...this.post(), bookmarked: !before }),
      error: (err: HttpErrorResponse) => {
        this.saved.set(before); // roll back
        this.showActionError(err, before ? 'Could not unsave this post.' : 'Could not save this post.');
      },
    });
  }

  openEdit() {
    this.menuOpen.set(false);
    this.errorMsg.set('');
    this.editBody.set(this.post().body ?? '');
    this.editPrivacy.set(this.privacy());
    this.dialog.set('edit');
  }

  openLikes() {
    if (this.likesCount() === 0) return;
    this.dialog.set('likes');
  }

  openShare() {
    this.errorMsg.set('');
    this.dialog.set('share');
  }

  onShared(newPost: Post) {
    this.dialog.set('none');
    // Bump the original post's share count and tell the list about the new post
    this.updated.emit({
      ...this.post(),
      sharesCount: (this.post().sharesCount ?? 0) + 1,
      bookmarked: this.saved(),
    });
    this.postShared.emit(newPost);
    this.notice.set('Post shared to your profile.');
    setTimeout(() => this.notice.set(''), 4000);
  }

  openDelete() {
    this.menuOpen.set(false);
    this.errorMsg.set('');
    this.dialog.set('delete');
  }

  closeDialog() {
    if (this.busy()) return;
    this.dialog.set('none');
  }

  onEscape() {
    this.menuOpen.set(false);
    // The share dialog handles Escape itself, because it must not close mid-request
    if (this.dialog() === 'share') return;
    this.closeDialog();
  }

  onEditInput(e: Event) {
    this.editBody.set((e.target as HTMLTextAreaElement).value);
  }

  onEditPrivacy(e: Event) {
    this.editPrivacy.set((e.target as HTMLSelectElement).value as PostPrivacy);
  }

  saveEdit() {
    const body = this.editBody().trim();
    const hasOtherContent = !!this.post().image || !!this.post().sharedPost;
    if (!body && !hasOtherContent) {
      this.errorMsg.set("A post can't be empty.");
      return;
    }

    this.busy.set(true);
    this.errorMsg.set('');

    this.postsApi
      .update(this.post()._id, { body, privacy: this.editPrivacy() })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.updated.emit({ ...this.post(), body, privacy: this.editPrivacy() });
          this.dialog.set('none');
        },
        error: (err: HttpErrorResponse) => this.errorMsg.set(this.messageFrom(err, 'Could not save your changes.')),
      });
  }

  confirmDelete() {
    this.busy.set(true);
    this.errorMsg.set('');

    this.postsApi
      .remove(this.post()._id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.dialog.set('none');
          this.deleted.emit(this.post()._id);
        },
        error: (err: HttpErrorResponse) => this.errorMsg.set(this.messageFrom(err, 'Could not delete this post.')),
      });
  }

  private showActionError(err: HttpErrorResponse, fallback: string) {
    // Includes the HTTP status so a wrong endpoint (404/405) is easy to spot
    this.actionError.set(`${this.messageFrom(err, fallback)} (${err.status || 'network error'})`);
    setTimeout(() => this.actionError.set(''), 5000);
  }

  private messageFrom(err: HttpErrorResponse, fallback: string) {
    const msg = err.error?.message;
    return (Array.isArray(msg) ? msg.join(', ') : msg) ?? fallback;
  }
}