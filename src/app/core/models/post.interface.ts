import { ApiResponse } from './auth.model';

export type PostPrivacy = 'public' | 'following' | 'only_me';

/** Values sent to the API (`value`) and their labels in the UI. Change `value` here if the API expects different names. */
export const PRIVACY_OPTIONS: { value: PostPrivacy; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'following', label: 'Followers' },
  { value: 'only_me', label: 'Only me' },
];

export interface PostUser {
  _id: string;
  name: string;
  username: string;
  photo?: string;
}

export interface PostComment {
  _id: string;
  content: string;
  commentCreator: PostUser;
  post: string;
  parentComment: string | null;
  image?: string;
  likes: string[];
  createdAt: string;
  repliesCount?: number;
}

export interface Post {
  _id: string;
  body?: string;
  image?: string;
  privacy?: PostPrivacy;
  user: PostUser;
  /** Present when this post is a share of another post */
  sharedPost?: Post | null;
  isShare?: boolean;
  /** User ids who liked the post */
  likes?: string[];
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  topComment?: PostComment | null;
  bookmarked?: boolean;
  createdAt: string;
}

export interface LikeResult {
  liked: boolean;
  likesCount: number;
  post: Post;
}

export interface PostsData {
  posts: Post[];
}

export interface Pagination {
  currentPage?: number;
  numberOfPages?: number;
  total?: number;
  nextPage?: number | null;
}

export interface PagedResponse<T> extends ApiResponse<T> {
  meta?: {
    feedMode?: string;
    pagination?: Pagination;
  };
}