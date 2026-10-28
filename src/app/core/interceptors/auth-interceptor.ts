import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  // Only talk to our own API, and never attach the token to signin/signup
  const isApiCall = req.url.startsWith(environment.apiUrl);
  const isAuthCall = req.url.includes('/users/signin') || req.url.includes('/users/signup');

  // A 401 here means "wrong current password", not "session expired"
  const isPasswordChange = req.url.includes('/users/change-password');

  const authReq =
    token && isApiCall && !isAuthCall
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Expired/invalid token: only log out if we actually had one
      if (err.status === 401 && token && isApiCall && !isAuthCall && !isPasswordChange) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};