import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal, computed } from "@angular/core";
import { Router } from "@angular/router";
import { tap } from "rxjs";
import { environment } from "../../../environments/environment";
import { User, SignupRequest, AuthData, SigninRequest,ApiResponse } from "../models/auth.model";

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = `${environment.apiUrl}/users`;

  private _token = signal<string | null>(localStorage.getItem('token'));
  private _user = signal<User | null>(this.readUser());

  token = this._token.asReadonly();
  user = this._user.asReadonly();
  isLoggedIn = computed(() => !!this._token());

  signup(body: SignupRequest) {
    return this.http
      .post<ApiResponse<AuthData>>(`${this.api}/signup`, body)
      .pipe(tap(res => this.setSession(res.data)));
  }

  signin(body: SigninRequest) {
    return this.http
      .post<ApiResponse<AuthData>>(`${this.api}/signin`, body)
      .pipe(tap(res => this.setSession(res.data)));
  }

  loadProfile() {
    return this.http
      .get<ApiResponse<{ user: User }>>(`${this.api}/profile-data`)
      .pipe(tap(res => this.setUser(res.data.user)));
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/auth/login']);
  }

  private setSession(data: AuthData) {
    localStorage.setItem('token', data.token);
    this._token.set(data.token);
    this.setUser(data.user);
  }

  private setUser(user: User) {
    localStorage.setItem('user', JSON.stringify(user));
    this._user.set(user);
  }

  private readUser(): User | null {
    try { return JSON.parse(localStorage.getItem('user') ?? 'null'); } catch { return null; }
  }
setToken(token: string) {
  localStorage.setItem('token', token);
  this._token.set(token);
}
}