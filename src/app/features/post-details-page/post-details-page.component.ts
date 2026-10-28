import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, EMPTY, catchError, combineLatest, finalize, map, switchMap, tap } from 'rxjs';
import { Post } from '../../core/models/post.interface';
import { PostsService } from '../../core/services/post.service';
import { CommentsSectionComponent } from '../../shared/comments-section/comments-section.component';
import { PostCardComponent } from '../../shared/post-card/post-card.component';


@Component({
  selector: 'app-post-details-page',
  standalone: true,
  imports: [PostCardComponent, CommentsSectionComponent, RouterLink],
  host: { class: 'block' },
  templateUrl: './post-details-page.component.html',
})
export class PostDetailsPageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private postsApi = inject(PostsService);

  post = signal<Post | null>(null);
  loading = signal(true);
  error = signal('');
  notFound = signal(false);

  private retry$ = new BehaviorSubject<void>(undefined);

  constructor() {
    // Reloads when the :id changes (e.g. clicking "View details" on another post) or on retry
    combineLatest([this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), this.retry$])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.notFound.set(false);
          this.post.set(null);
        }),
        switchMap(([id]) =>
          this.postsApi.getById(id).pipe(
            catchError((err: HttpErrorResponse) => {
              const missing = err.status === 404 || err.status === 400;
              this.notFound.set(missing);
              this.error.set(missing ? "This post doesn't exist or was deleted." : 'Could not load this post.');
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((post) => this.post.set(post));
  }

  retry() {
    this.retry$.next();
  }

  onDeleted() {
    this.router.navigate(['/feed']);
  }
}