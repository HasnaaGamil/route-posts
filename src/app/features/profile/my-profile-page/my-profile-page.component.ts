import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize, switchMap } from 'rxjs';
import { Profile } from '../../../core/models/user.interface';
import { PostsService } from '../../../core/services/post.service';
import { UsersService } from '../../../core/services/user.service';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { PostsListComponent } from '../../../shared/post-list/post-list.component';


@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [AvatarComponent, PostsListComponent, DatePipe],
  host: { class: 'block' },
  templateUrl: './my-profile-page.component.html',
})
export class MyProfilePageComponent implements OnInit {
  private usersApi = inject(UsersService);
  private postsApi = inject(PostsService);

  profile = signal<Profile | null>(null);
  loading = signal(true);
  error = signal('');

  tab = signal<'posts' | 'saved'>('posts');
  myPostsTotal = signal<number | null>(null);

  /** Number shown in the badge at the right of the tab bar */
  activeCount = computed(() =>
    this.tab() === 'posts' ? (this.myPostsTotal() ?? 0) : (this.profile()?.bookmarksCount ?? 0),
  );

  // Loaders handed to <app-posts-list>. Only used once the profile has loaded.
  myPostsSource = (page: number) => this.postsApi.getByUser(this.profile()!._id, page);
  // Newest saved first (the API lists bookmarks oldest → newest)
  savedSource = (page: number) => this.postsApi.getSaved([...(this.profile()?.bookmarks ?? [])].reverse(), page);

  ngOnInit() {
    this.load();
  }
  photoUploading = signal(false);
photoError = signal('');
/** Local preview shown while the upload is in progress */
photoPreview = signal<string | null>(null);

onPhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // lets the user pick the same file again later
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    this.photoError.set('Please choose an image file.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    this.photoError.set('Image must be 5 MB or smaller.');
    return;
  }

  this.photoError.set('');
  this.photoUploading.set(true);
  const preview = URL.createObjectURL(file);
  this.photoPreview.set(preview);

  this.usersApi
    .uploadPhoto(file)
    .pipe(
      switchMap(() => this.usersApi.getProfile()), // reload to get the new photo URL
      finalize(() => {
        this.photoUploading.set(false);
        this.photoPreview.set(null);
        URL.revokeObjectURL(preview);
      }),
    )
    .subscribe({
      next: (p) => this.profile.set(p),
      error: () => this.photoError.set('Could not update your photo. Try again.'),
    });
}

  load() {
    this.loading.set(true);
    this.error.set('');

    this.usersApi
      .getProfile()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (p) => this.profile.set(p),
        error: () => this.error.set('Could not load your profile.'),
      });
  }
}