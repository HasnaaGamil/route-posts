import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AvatarComponent } from '../avatar/avatar.component';
import { PostUser } from '../../core/models/post.interface';
import { PostsService } from '../../core/services/post.service';

@Component({
  selector: 'app-likes-dialog',
  standalone: true,
  imports: [AvatarComponent, RouterLink],
  templateUrl: './likes-dialog.component.html',
})
export class LikesDialogComponent implements OnInit {
  private postsApi = inject(PostsService);

  postId = input.required<string>();
  closed = output<void>();

  users = signal<PostUser[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  error = signal('');
  nextPage = signal<number | null>(null);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.postsApi
      .getLikes(this.postId(), 1)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.users.set(page.users);
          this.nextPage.set(page.nextPage);
        },
        error: () => this.error.set('Could not load likes.'),
      });
  }

  loadMore() {
    const page = this.nextPage();
    if (!page || this.loadingMore()) return;

    this.loadingMore.set(true);
    this.error.set('');

    this.postsApi
      .getLikes(this.postId(), page)
      .pipe(finalize(() => this.loadingMore.set(false)))
      .subscribe({
        next: (res) => {
          this.users.update((list) => [...list, ...res.users]);
          this.nextPage.set(res.nextPage);
        },
        error: () => this.error.set('Could not load more likes.'),
      });
  }
}