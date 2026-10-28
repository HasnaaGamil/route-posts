import { Component, inject, viewChild } from '@angular/core';



import { CreatePostComponent } from '../create-post/create-post.component';
import { PostsListComponent } from '../../../shared/post-list/post-list.component';
import { PostsService } from '../../../core/services/post.service';
import { Post } from '../../../core/models/post.interface';

@Component({
  selector: 'app-feed-page',
  standalone: true,
  imports: [CreatePostComponent, PostsListComponent],
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <app-create-post (posted)="onPosted($event)" />
      <app-posts-list [source]="source" />
    </div>
  `,
})
export class FeedPageComponent {
  private postsApi = inject(PostsService);
  private list = viewChild.required(PostsListComponent);

  source = (page: number) => this.postsApi.getFeed(page);

  /** New post goes straight to the top of the feed */
  onPosted(post: Post) {
    this.list().prepend(post);
  }
}