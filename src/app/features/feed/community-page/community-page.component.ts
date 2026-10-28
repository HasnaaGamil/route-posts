import { Component, inject } from '@angular/core';
import { PostsListComponent } from '../../../shared/post-list/post-list.component';
import { PostsService } from '../../../core/services/post.service';


@Component({
  selector: 'app-community-page',
  standalone: true,
  imports: [PostsListComponent],
  host: { class: 'block' },
  template: `<app-posts-list [source]="source" emptyText="No community posts yet." />`,
})
export class CommunityPageComponent {
  private postsApi = inject(PostsService);
  source = (page: number) => this.postsApi.getAll(page);
}