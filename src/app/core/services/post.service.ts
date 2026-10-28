import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { filter, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/auth.model';
import { AuthService } from './auth.service';
import { Post, PostUser, Pagination, PostPrivacy, PagedResponse, LikeResult, PostsData, PostComment } from '../models/post.interface';

/** Emitted while a post is being created: upload progress first, then the finished post. */
export type CreatePostEvent = { type: 'progress'; percent: number } | { type: 'done'; post: Post };

export interface LikesPage {
  users: PostUser[];
  nextPage: number | null;
}
export interface CommentsPage {
  comments: PostComment[];
  nextPage: number | null;
  total?: number;
}

/** Prefer `nextPage`; fall back to currentPage/numberOfPages in case it is omitted */
function nextPageFrom(p?: Pagination): number | null {
  const hasMore = !!p?.currentPage && !!p?.numberOfPages && p.currentPage < p.numberOfPages;
  return p?.nextPage ?? (hasMore ? p!.currentPage! + 1 : null);
}

export interface PostsPage {
  posts: Post[];
  nextPage: number | null;
  /** Total number of items across all pages (from meta.pagination.total), when known */
  total?: number | null;
}

@Injectable({ providedIn: 'root' })
export class PostsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = `${environment.apiUrl}/posts`;
  private usersApi = `${environment.apiUrl}/users`;

  /** Posts from people you follow: GET /posts/feed?only=following */
  getFeed(page = 1, limit = 10) {
    return this.fetch(`${this.api}/feed`, page, limit, { only: 'following' });
  }

  /** All posts: GET /posts */
  getAll(page = 1, limit = 10) {
    return this.fetch(this.api, page, limit);
  }

  /** Posts written by one user: GET /users/:userId/posts?page=&limit= */
  getByUser(userId: string, page = 1, limit = 10) {
    return this.fetch(`${this.usersApi}/${userId}/posts`, page, limit);
  }

  /**
   * Saved posts of the signed-in user: GET /users/bookmarks
   *
   * `order` is the list of bookmarked post ids in the order you want them shown
   * (your reversed `profile().bookmarks`). The API always returns bookmarks
   * oldest → newest, so server paging can't give "newest first". Instead we fetch
   * them all once, sort them by `order`, and page on the client.
   */
  getSaved(order: string[], page = 1, limit = 10) {
    if (!order.length) {
      return of<PostsPage>({ posts: [], nextPage: null, total: 0 });
    }

    // One request big enough to cover every saved post
    const params = new HttpParams({ fromObject: { page: 1, limit: order.length } });

    return this.http
      .get<PagedResponse<{ bookmarks: Post[] }>>(`${this.usersApi}/bookmarks`, { params })
      .pipe(
        map((res): PostsPage => {
          const byId = new Map(res.data.bookmarks.map((p) => [p._id, p]));

          // Keep the requested order; skip ids the API no longer returns (e.g. deleted posts)
          const sorted = order.map((id) => byId.get(id)).filter((p): p is Post => !!p);

          const start = (page - 1) * limit;
          const end = start + limit;

          return {
            posts: sorted.slice(start, end),
            nextPage: end < sorted.length ? page + 1 : null,
            total: sorted.length,
          };
        }),
      );
  }

  /** Single post: GET /posts/:id */
  getById(id: string) {
    return this.http
      .get<ApiResponse<{ post: Post }>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data.post));
  }

  /** Creates a post: POST /posts (multipart/form-data). Emits upload progress, then the new post. */
  create(input: { body?: string; image?: File | null; privacy: PostPrivacy }) {
    // Do NOT set Content-Type yourself: the browser adds the multipart boundary
    const form = new FormData();
    if (input.body) form.append('body', input.body);
    if (input.image) form.append('image', input.image);
    form.append('privacy', input.privacy);

    return this.http
      .post<ApiResponse<{ post: Omit<Post, 'user'> & { user: string } }>>(this.api, form, {
        observe: 'events',
        reportProgress: true,
      })
      .pipe(
        map((event): CreatePostEvent | null => {
          if (event.type === HttpEventType.UploadProgress) {
            const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
            return { type: 'progress', percent };
          }
          if (event.type === HttpEventType.Response) {
            // The API returns only the author's id, so fill in the author from the logged-in user
            const me = this.auth.user();
            const created = event.body!.data.post;
            return {
              type: 'done',
              post: {
                ...created,
                user: {
                  _id: me?._id ?? created.user,
                  name: me?.name ?? '',
                  username: me?.username ?? '',
                  photo: me?.photo,
                },
              },
            };
          }
          return null;
        }),
        filter((e): e is CreatePostEvent => e !== null),
      );
  }

  /** Shares a post: POST /posts/:id/share. The optional caption goes in `body` (assumed POST + JSON). */
  share(id: string, body?: string) {
    return this.http
      .post<ApiResponse<{ post: Post }>>(`${this.api}/${id}/share`, body ? { body } : {})
      .pipe(map((res) => res.data.post));
  }

  /** People who liked a post: GET /posts/:id/likes?page=&limit= */
  getLikes(postId: string, page = 1, limit = 20) {
    const params = new HttpParams({ fromObject: { page, limit } });
    return this.http
      .get<PagedResponse<{ likes: PostUser[] }>>(`${this.api}/${postId}/likes`, { params })
      .pipe(
        map((res): LikesPage => ({
          users: res.data.likes,
          nextPage: nextPageFrom(res.meta?.pagination),
        })),
      );
  }
  /** Comments of a post: GET /posts/:id/comments?page=&limit= */
  getComments(postId: string, page = 1, limit = 10) {
    const params = new HttpParams({ fromObject: { page, limit } });
    return this.http
      .get<PagedResponse<{ comments: PostComment[] }>>(`${this.api}/${postId}/comments`, { params })
      .pipe(
        map((res): CommentsPage => ({
          comments: res.data.comments,
          nextPage: nextPageFrom(res.meta?.pagination),
          total: res.meta?.pagination?.total,
        })),
      );
  }

  /** Likes / unlikes a post: PUT /posts/:id/like (toggle). Assumed PUT; change to post() if the API differs. */
  toggleLike(id: string) {
    return this.http
      .put<ApiResponse<LikeResult>>(`${this.api}/${id}/like`, {})
      .pipe(map((res) => res.data));
  }

  // NOTE: the three endpoints below are assumptions (standard REST). Adjust the URLs/methods if the API differs.

  /** Edits a post: PUT /posts/:id (multipart/form-data) */
  update(id: string, input: { body: string; privacy: PostPrivacy }) {
    const form = new FormData();
    form.append('body', input.body);
    form.append('privacy', input.privacy);
    return this.http.put<ApiResponse<unknown>>(`${this.api}/${id}`, form);
  }

  /** Deletes a post: DELETE /posts/:id */
  remove(id: string) {
    return this.http.delete<ApiResponse<unknown>>(`${this.api}/${id}`);
  }

  /** Saves / unsaves a post: PUT /posts/:id/bookmark (toggle) */
  toggleBookmark(id: string) {
    return this.http.put<ApiResponse<unknown>>(`${this.api}/${id}/bookmark`, {});
  }

  /** Shared paged GET for any endpoint that returns `data.posts` + `meta.pagination`. Takes a full URL. */
  private fetch(url: string, page: number, limit: number, extra: Record<string, string> = {}) {
    const params = new HttpParams({ fromObject: { ...extra, limit, page } });

    return this.http.get<PagedResponse<PostsData>>(url, { params }).pipe(
      map((res): PostsPage => ({
        posts: res.data.posts,
        nextPage: nextPageFrom(res.meta?.pagination),
        total: res.meta?.pagination?.total ?? null,
      })),
    );
  }
}