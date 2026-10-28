import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, of, switchMap } from 'rxjs';
import { AppNotification, NotificationsPage } from '../../core/models/notification.interface';
import { NotificationsService } from '../../core/services/notifications.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { TimeAgoPipe } from '../../shared/pipes/time-ago-pipe';

type Filter = 'all' | 'unread';

/** The Unread tab keeps fetching pages until it has at least this many unread items (or runs out) */
const MIN_UNREAD = 5;
const MAX_PAGES_PER_LOAD = 10;

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [AvatarComponent, TimeAgoPipe],
  host: { class: 'block' },
  templateUrl: './notifications-page.component.html',
})
export class NotificationsPageComponent implements OnInit {
  private api = inject(NotificationsService);
  private router = inject(Router);

  filter = signal<Filter>('all');
  items = signal<AppNotification[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  error = signal('');
  actionError = signal('');
  nextPage = signal<number | null>(null);
  markingAll = signal(false);

  /** Lets a slow response from a previous tab be ignored */
  private requestId = 0;

  /** Enables "Mark all as read" while anything is unread (loaded or not) */
  canMarkAll = computed(() => this.api.unreadCount() > 0 || this.items().some((n) => !n.isRead));

  ngOnInit() {
    this.load();
    this.api.refreshUnreadCount().subscribe();
  }

  setFilter(next: Filter) {
    if (next === this.filter()) return;
    this.filter.set(next);
    this.load();
  }

  load() {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    this.actionError.set('');

    this.fetch(1, this.filter() === 'unread')
      .pipe(finalize(() => id === this.requestId && this.loading.set(false)))
      .subscribe({
        next: (page) => {
          if (id !== this.requestId) return;
          this.items.set(page.notifications);
          this.nextPage.set(page.nextPage);
        },
        error: () => id === this.requestId && this.error.set('Could not load your notifications.'),
      });
  }

  /**
   * One page of notifications. For the Unread tab it drops read items on the client and keeps
   * fetching the following pages until it has enough to show.
   */
  private fetch(page: number, unreadOnly: boolean, depth = 0): Observable<NotificationsPage> {
    return this.api.getPage(page).pipe(
      switchMap((res) => {
        if (!unreadOnly) return of(res);

        const unread = res.notifications.filter((n) => !n.isRead);
        if (unread.length >= MIN_UNREAD || !res.nextPage || depth >= MAX_PAGES_PER_LOAD - 1) {
          return of({ ...res, notifications: unread });
        }
        return this.fetch(res.nextPage, true, depth + 1).pipe(
          map((rest) => ({ ...rest, notifications: [...unread, ...rest.notifications] })),
        );
      }),
    );
  }

  loadMore() {
    const page = this.nextPage();
    if (!page || this.loadingMore()) return;

    const id = this.requestId;
    this.loadingMore.set(true);
    this.actionError.set('');

    this.fetch(page, this.filter() === 'unread')
      .pipe(finalize(() => this.loadingMore.set(false)))
      .subscribe({
        next: (res) => {
          if (id !== this.requestId) return;
          this.items.update((list) => [...list, ...res.notifications]);
          this.nextPage.set(res.nextPage);
        },
        error: () => this.actionError.set('Could not load more notifications.'),
      });
  }

  /** Clicking a notification marks it read and opens what it is about */
  open(n: AppNotification) {
    if (!n.isRead) this.markRead(n);

    if (n.kind === 'follow') {
      if (n.actor._id) this.router.navigate(['/users', n.actor._id]);
    } else if (n.postId) {
      this.router.navigate(['/posts', n.postId]);
    }
  }

  markRead(n: AppNotification, event?: Event) {
    event?.stopPropagation();
    if (n.isRead) return;
    this.actionError.set('');

    const inUnreadTab = this.filter() === 'unread';
    const before = this.items();

    // Optimistic: flip it now (or drop it from the Unread tab), roll back on failure
    this.items.update((list) =>
      inUnreadTab ? list.filter((x) => x.id !== n.id) : list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
    );

    this.api.markRead(n.id).subscribe({
      error: (err: HttpErrorResponse) => {
        this.items.set(before);
        this.actionError.set(err.error?.message ?? 'Could not mark it as read.');
      },
    });
  }

  markAll() {
    if (this.markingAll() || !this.canMarkAll()) return;

    this.markingAll.set(true);
    this.actionError.set('');

    this.api
      .markAllRead()
      .pipe(finalize(() => this.markingAll.set(false)))
      .subscribe({
        next: () => {
          if (this.filter() === 'unread') {
            this.items.set([]);
            this.nextPage.set(null);
          } else {
            this.items.update((list) => list.map((x) => ({ ...x, isRead: true })));
          }
        },
        error: (err: HttpErrorResponse) =>
          this.actionError.set(err.error?.message ?? 'Could not mark all as read.'),
      });
  }
}