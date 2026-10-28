import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/auth.model';
import { Profile, SuggestedUser, SuggestionsData, SuggestionsResponse, UserProfileData } from '../models/user.interface';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/users`;

  /** The logged-in user's full profile: GET /users/profile-data */
  getProfile() {
    return this.http
      .get<ApiResponse<{ user: Profile }>>(`${this.api}/profile-data`)
      .pipe(map((res) => res.data.user));
  }

getSuggestions(limit = 10, page = 1) {
  const params = new HttpParams().set('limit', limit).set('page', page);
  return this.http
    .get<SuggestionsResponse>(`${this.api}/suggestions`, { params })
    .pipe(map((res) => ({
      suggestions: res.data.suggestions,
      hasMore: !!res.meta?.pagination?.nextPage,
    })));
}

  /** Follows the user, or unfollows if already following (the API toggles). */
  toggleFollow(userId: string) {
    return this.http.put<ApiResponse<unknown>>(`${this.api}/${userId}/follow`, {});
  }
  /** Changes the profile photo: PUT /users/upload-photo (multipart/form-data, field "photo") */
uploadPhoto(file: File) {
  // Don't set Content-Type yourself: the browser adds the multipart boundary
  const form = new FormData();
  form.append('photo', file);
  return this.http.put<ApiResponse<unknown>>(`${this.api}/upload-photo`, form);
}

/** Changes the password: PATCH /users/change-password */
changePassword(password: string, newPassword: string) {
  return this.http
    .patch<ApiResponse<{ token?: string }>>(`${this.api}/change-password`, { password, newPassword })
    .pipe(map((res) => res.data));
}
getUserProfile(userId: string) {
  return this.http
    .get<ApiResponse<UserProfileData>>(`${this.api}/${userId}/profile`)
    .pipe(map((res) => res.data));
}
}

