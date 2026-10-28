import { DatePipe, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, EMPTY, catchError, combineLatest, finalize, map, switchMap, tap } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';

import { UsersService } from '../../../core/services/user.service';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { PostsService } from '../../../core/services/post.service';
import { PostsListComponent } from '../../../shared/post-list/post-list.component';
import { PublicProfile } from '../../../core/models/user.interface';


const PREVIEW_COUNT = 6;

@Component({
  selector: 'app-user-profile-page',
  standalone: true,
  imports: [AvatarComponent, PostsListComponent, RouterLink, DatePipe],
  host: { class: 'block' },
  templateUrl: './user-profile-page.component.html',
})
export class UserProfilePageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private auth = inject(AuthService);
  private usersApi = inject(UsersService);
  private postsApi = inject(PostsService);

  profile = signal<PublicProfile | null>(null);
  isFollowing = signal(false);
  loading = signal(true);
  error = signal('');
  notFound = signal(false);

  followBusy = signal(false);
  followError = signal('');
  postsTotal = signal<number | null>(null);

  followingPreview = computed(() => (this.profile()?.following ?? []).slice(0, PREVIEW_COUNT));
  moreFollowing = computed(() => Math.max(0, (this.profile()?.followingCount ?? 0) - this.followingPreview().length));

  private retry$ = new BehaviorSubject<void>(undefined);

  /** Loader for <app-posts-list>; only used once the profile has loaded */
  postsSource = (page: number) => this.postsApi.getByUser(this.profile()!._id, page);

  constructor() {
    // Reloads when the :id changes (e.g. opening someone from the "Following" list) or on retry
    combineLatest([this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), this.retry$])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.notFound.set(false);
          this.followError.set('');
          this.profile.set(null);
          this.postsTotal.set(null);
        }),
        switchMap(([id]) =>
          this.usersApi.getUserProfile(id).pipe(
            catchError((err: HttpErrorResponse) => {
              const missing = err.status === 404 || err.status === 400;
              this.notFound.set(missing);
              this.error.set(missing ? "This user doesn't exist." : 'Could not load this profile.');
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((data) => {
        // Your own profile has its own page
        if (data.user._id === this.auth.user()?._id) {
          this.router.navigate(['/profile'], { replaceUrl: true });
          return;
        }
        this.profile.set(data.user);
        this.isFollowing.set(data.isFollowing);
      });
  }

  back() {
    // Opened in a fresh tab? There is nothing to go back to, so go to the feed
    if (window.history.length > 1) this.location.back();
    else this.router.navigate(['/feed']);
  }

  retry() {
    this.retry$.next();
  }

  toggleFollow() {
    const p = this.profile();
    if (!p || this.followBusy()) return;

    const was = this.isFollowing();
    this.setFollowing(!was); // optimistic
    this.followBusy.set(true);
    this.followError.set('');

    this.usersApi
      .toggleFollow(p._id)
      .pipe(finalize(() => this.followBusy.set(false)))
      .subscribe({
        error: (err: HttpErrorResponse) => {
          this.setFollowing(was); // roll back
          this.followError.set(err.error?.message ?? 'Could not update follow. Please try again.');
        },
      });
  }

  /** Sets the follow state and keeps the follower count consistent with it */
  private setFollowing(following: boolean) {
    if (this.isFollowing() === following) return;
    this.isFollowing.set(following);
    this.profile.update((p) =>
      p ? { ...p, followersCount: Math.max(0, p.followersCount + (following ? 1 : -1)) } : p,
    );
  }
}