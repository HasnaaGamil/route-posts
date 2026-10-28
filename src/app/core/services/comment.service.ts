import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/auth.model';
import { Pagination, PagedResponse, PostComment } from '../models/post.interface';
import { AuthService } from './auth.service';

export interface CommentsPage {
  comments: PostComment[];
  nextPage: number | null;
  total: number | null;
}

/** Prefer `nextPage`; fall back to currentPage/numberOfPages in case it is omitted */
function nextPageFrom(p?: Pagination): number | null {
  const hasMore = !!p?.currentPage && !!p?.numberOfPages && p.currentPage < p.numberOfPages;
  return p?.nextPage ?? (hasMore ? p!.currentPage! + 1 : null);
}

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = `${environment.apiUrl}/posts`;

  private url(postId: string) {
    return `${this.api}/${postId}/comments`;
  }

  /** Comments of a post: GET /posts/:postId/comments?page=&limit= */
  getComments(postId: string, page = 1, limit = 10) {
    const params = new HttpParams({ fromObject: { page, limit } });
    return this.http
      .get<PagedResponse<{ comments: PostComment[] }>>(this.url(postId), { params })
      .pipe(map((res): CommentsPage => this.toPage(res.data.comments, res.meta?.pagination)));
  }

  /** Replies of a comment: GET /posts/:postId/comments/:commentId/replies?page=&limit= */
  getReplies(postId: string, commentId: string, page = 1, limit = 10) {
    const params = new HttpParams({ fromObject: { page, limit } });
    return this.http
      .get<PagedResponse<{ replies?: PostComment[]; comments?: PostComment[] }>>(
        `${this.url(postId)}/${commentId}/replies`,
        { params },
      )
      .pipe(
        map((res): CommentsPage =>
          this.toPage(res.data.replies ?? res.data.comments ?? [], res.meta?.pagination),
        ),
      );
  }

  /** Adds a comment: POST /posts/:postId/comments (multipart/form-data, fields "content" and optional "image") */
  createComment(postId: string, content: string, image?: File | null) {
    return this.http
      .post<ApiResponse<{ comment: PostComment }>>(this.url(postId), this.form(content, image))
      .pipe(map((res) => this.withCreator(res.data.comment)));
  }

  /** Replies to a comment: POST /posts/:postId/comments/:commentId/replies (assumed URL, same fields) */
  createReply(postId: string, commentId: string, content: string, image?: File | null) {
    return this.http
      .post<ApiResponse<{ reply?: PostComment; comment?: PostComment }>>(
        `${this.url(postId)}/${commentId}/replies`,
        this.form(content, image),
      )
      .pipe(map((res) => this.withCreator((res.data.reply ?? res.data.comment)!)));
  }

  /** Edits a comment: PUT /posts/:postId/comments/:commentId (assumed method, multipart/form-data) */
  updateComment(postId: string, commentId: string, content: string) {
    return this.http.put<ApiResponse<unknown>>(`${this.url(postId)}/${commentId}`, this.form(content));
  }

  /** Deletes a comment or reply: DELETE /posts/:postId/comments/:commentId */
  deleteComment(postId: string, commentId: string) {
    return this.http.delete<ApiResponse<unknown>>(`${this.url(postId)}/${commentId}`);
  }

  /** Likes / unlikes a comment: PUT /posts/:postId/comments/:commentId/like (toggle, assumed PUT) */
  toggleLike(postId: string, commentId: string) {
    return this.http.put<ApiResponse<unknown>>(`${this.url(postId)}/${commentId}/like`, {});
  }

  // ---- helpers ----

  /** Do NOT set Content-Type yourself: the browser adds the multipart boundary */
  private form(content: string, image?: File | null) {
    const form = new FormData();
    if (content) form.append('content', content);
    if (image) form.append('image', image);
    return form;
  }

  private toPage(comments: PostComment[], pagination?: Pagination): CommentsPage {
    return {
      comments,
      nextPage: nextPageFrom(pagination),
      total: pagination?.total ?? null,
    };
  }

  /**
   * Create endpoints often return only the author's id, so fill the author in from the
   * logged-in user, and make sure `likes` and `repliesCount` always exist.
   */
  private withCreator(c: PostComment): PostComment {
    const creator: unknown = c.commentCreator;
    const base = { ...c, likes: c.likes ?? [], repliesCount: c.repliesCount ?? 0 };
    if (typeof creator !== 'string') return base;

    const me = this.auth.user();
    return {
      ...base,
      commentCreator: {
        _id: me?._id ?? creator,
        name: me?.name ?? '',
        username: me?.username ?? '',
        photo: me?.photo,
      },
    };
  }
}