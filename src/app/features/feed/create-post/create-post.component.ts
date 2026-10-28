import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, output, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';

import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { PRIVACY_OPTIONS, PostPrivacy, Post } from '../../../core/models/post.interface';
import { PostsService } from '../../../core/services/post.service';

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [AvatarComponent],
  host: { class: 'block' },
  templateUrl: './create-post.component.html',
})
export class CreatePostComponent implements OnDestroy {
  auth = inject(AuthService);
  private postsApi = inject(PostsService);

  content = signal('');
  privacyOptions = PRIVACY_OPTIONS;
  privacy = signal<PostPrivacy>('public');
  image = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  posting = signal(false);
  progress = signal(0);
  justPosted = signal(false);
  private doneTimer?: ReturnType<typeof setTimeout>;
  errorMsg = signal('');

  firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0]);
  canPost = computed(() => (this.content().trim().length > 0 || !!this.image()) && !this.posting());

  posted = output<Post>();

  onInput(e: Event) {
    this.content.set((e.target as HTMLTextAreaElement).value);
  }

  onPrivacy(e: Event) {
    this.privacy.set((e.target as HTMLSelectElement).value as PostPrivacy);
  }

  onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allows picking the same file again later
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.errorMsg.set('Please choose an image file.');
      return;
    }
    this.errorMsg.set('');
    this.clearImage();
    this.image.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  clearImage() {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.image.set(null);
    this.previewUrl.set(null);
  }

  submit() {
    if (!this.canPost()) return;

    this.posting.set(true);
    this.progress.set(0);
    this.justPosted.set(false);
    this.errorMsg.set('');

    this.postsApi
      .create({ body: this.content().trim(), image: this.image(), privacy: this.privacy() })
      .pipe(finalize(() => this.posting.set(false)))
      .subscribe({
        next: (event) => {
          if (event.type === 'progress') {
            this.progress.set(event.percent);
            return;
          }
          this.posted.emit(event.post);
          this.content.set('');
          this.clearImage();
          this.showSuccess();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.error?.message;
          this.errorMsg.set(
            (Array.isArray(msg) ? msg.join(', ') : msg) ?? 'Could not publish your post. Please try again.',
          );
        },
      });
  }

  private showSuccess() {
    this.justPosted.set(true);
    clearTimeout(this.doneTimer);
    this.doneTimer = setTimeout(() => this.justPosted.set(false), 3000);
  }

  ngOnDestroy() {
    clearTimeout(this.doneTimer);
    this.clearImage();
  }
}