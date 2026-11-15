import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const isApiRequest = request.url.startsWith(`${environment.apiUrl}/`);
  const token = isApiRequest ? auth.token : null;
  const user = auth.user();
  const authenticatedRequest =
    token && user
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}`, 'X-User-Id': user.id } })
      : request;

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      // Do not let a response from a previous session sign out a newer session.
      if (isApiRequest && token && error.status === 401 && auth.token === token) auth.logout();
      return throwError(() => error);
    }),
  );
};
