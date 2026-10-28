import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../avatar/avatar.component';
import { Post } from '../../core/models/post.interface';
import { PostsService } from '../../core/services/post.service';
import { TimeAgoPipe } from '../pipes/time-ago-pipe';

@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [AvatarComponent, TimeAgoPipe],
  host: { '(document:keydown.escape)': 'close()' },
  templateUrl: './share-dialog.component.html',
})
export class ShareDialogComponent {
  auth = inject(AuthService);
  private postsApi = inject(PostsService);

  post = input.required<Post>();
  closed = output<void>();
  shared = output<Post>();

  caption = signal('');
  busy = signal(false);
  errorMsg = signal('');

  onInput(e: Event) {
    this.caption.set((e.target as HTMLTextAreaElement).value);
  }

  /** Never closes while the request is running, so the result can't be lost */
  close() {
    if (!this.busy()) this.closed.emit();
  }

  submit() {
    if (this.busy()) return;

    this.busy.set(true);
    this.errorMsg.set('');

    this.postsApi
      .share(this.post()._id, this.caption().trim())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (newPost) => this.shared.emit(newPost),
        error: (err: HttpErrorResponse) => {
          const msg = err.error?.message;
          this.errorMsg.set((Array.isArray(msg) ? msg.join(', ') : msg) ?? 'Could not share this post.');
        },
      });
  }
}