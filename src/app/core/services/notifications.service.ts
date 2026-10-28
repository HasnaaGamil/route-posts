import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, catchError, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/auth.model';
import { PagedResponse } from '../models/post.interface';
import { AppNotification, NotificationKind, NotificationsPage } from '../models/notification.interface';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

/**
 * The list endpoint's item shape wasn't available when this was written, so every field
 * is read defensively. Once you have a real response, tighten this one function.
 */
function toNotification(raw: Raw): AppNotification {
  const type = String(raw['type'] ?? '').toLowerCase();
  const kind: NotificationKind = type.includes('reply')
    ? 'reply'
    : type.includes('comment')
      ? 'comment'
      : type.includes('like')
        ? 'like'
        : type.includes('share')
          ? 'share'
          : type.includes('follow')
            ? 'follow'
            : 'other';

  const entity: Raw = raw['entity'] && typeof raw['entity'] === 'object' ? raw['entity'] : {};
  const rawActor = raw['actor'] ?? raw['sender'] ?? raw['from'] ?? raw['user'];
  const actor: Raw =
    rawActor && typeof rawActor === 'object' ? rawActor : { _id: String(rawActor ?? '') };

  const likedComment = raw['entityType'] === 'comment';
  const text =
    kind === 'like'
      ? likedComment
        ? 'liked your comment'
        : 'liked your post'
      : kind === 'comment'
        ? 'commented on your post'
        : kind === 'reply'
          ? 'replied to your comment'
          : kind === 'share'
            ? 'shared your post'
            : kind === 'follow'
              ? 'started following you'
              : String(raw['message'] ?? 'sent you a notification');

  const postRef = raw['postId'] ?? raw['post'] ?? entity['post'];
  const postId =
    kind === 'follow'
      ? undefined
      : (typeof postRef === 'object' ? postRef?._id : postRef) ??
        (raw['entityType'] === 'post' ? raw['entityId'] : undefined) ??
        entity['_id'];

  return {
    id: String(raw['_id'] ?? raw['id']),
    actor: {
      _id: String(actor['_id'] ?? ''),
      name: String(actor['name'] ?? 'Someone'),
      username: String(actor['username'] ?? ''),
      photo: actor['photo'],
    },
    kind,
    text,
    preview: String(raw['preview'] ?? entity['body'] ?? entity['content'] ?? raw['post']?.['body'] ?? ''),
    postId: postId ? String(postId) : undefined,
    isRead: Boolean(raw['isRead'] ?? raw['read'] ?? false),
    createdAt: String(raw['createdAt'] ?? ''),
  };
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/notifications`;

  /** Shown as the badge on the navbar's Notifications link */
  unreadCount = signal(0);

  /**
   * GET /notifications?page=&limit=
   *
   * No `unread` parameter is sent: in testing the server returned the opposite sets (All came
   * back empty and Unread listed already-read items), so the Unread tab is filtered on the
   * client by `isRead` instead of trusting that parameter.
   */
  getPage(page = 1, limit = 10) {
    const params = new HttpParams({ fromObject: { page, limit } });
    return this.http
      .get<PagedResponse<{ notifications: Raw[] }>>(this.api, { params })
      .pipe(
        map((res): NotificationsPage => {
          const p = res.meta?.pagination;
          const hasMore = !!p?.currentPage && !!p?.numberOfPages && p.currentPage < p.numberOfPages;
          return {
            notifications: (res.data.notifications ?? []).map(toNotification),
            nextPage: p?.nextPage ?? (hasMore ? p!.currentPage! + 1 : null),
            total: p?.total ?? null,
          };
        }),
      );
  }

  /**
   * GET /notifications/unread-count (assumed URL). Never errors, so it is safe to poll:
   * if the request fails the badge just keeps its last value.
   */
  refreshUnreadCount() {
    return this.http.get<ApiResponse<{ unreadCount?: number; count?: number }>>(`${this.api}/unread-count`).pipe(
      tap((res) => this.unreadCount.set(Number(res.data?.unreadCount ?? res.data?.count ?? 0))),
      catchError(() => EMPTY),
    );
  }

  /** PATCH /notifications/:id/read (assumed URL and method) */
  markRead(id: string) {
    return this.http
      .patch<ApiResponse<unknown>>(`${this.api}/${id}/read`, {})
      .pipe(tap(() => this.unreadCount.update((n) => Math.max(0, n - 1))));
  }

  /** PATCH /notifications/read-all (assumed URL and method) */
  markAllRead() {
    return this.http
      .patch<ApiResponse<unknown>>(`${this.api}/read-all`, {})
      .pipe(tap(() => this.unreadCount.set(0)));
  }
}