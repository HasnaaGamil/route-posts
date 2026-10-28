export interface SuggestedUser {
  _id: string;
  name: string;
  username: string;
  photo?: string;
  mutualFollowersCount: number;
  followersCount: number;
}

export interface Pagination {
  currentPage: number;
  limit: number;
  total: number;
  numberOfPages: number;
  nextPage?: number | null;
}

export interface SuggestionsData {
  suggestions: SuggestedUser[];
}

export interface SuggestionsResponse {
  success: boolean;
  message: string;
  data: SuggestionsData;
  meta: {
    pagination: Pagination;
  };
}
/** Response of GET /users/profile-data */
export interface Profile {
  _id: string;
  name: string;
  username: string;
  email: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  photo: string;
  cover: string;
  /** Ids of saved posts */
  bookmarks: string[];
  followers: string[];
  following: string[];
  createdAt: string;
  followersCount: number;
  followingCount: number;
  bookmarksCount: number;
}

export interface FollowingPreview { _id: string; name: string; photo?: string; }

export interface PublicProfile {
  _id: string; name: string; username: string; photo: string; cover: string;
  following: FollowingPreview[]; createdAt: string;
  followersCount: number; followingCount: number; bookmarksCount: number;
}

export interface UserProfileData { isFollowing: boolean; user: PublicProfile; }

