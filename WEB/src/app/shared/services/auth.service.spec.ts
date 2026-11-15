import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models/auth.model';
import { AuthService } from './auth.service';

describe('Account sessions', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  const response: AuthResponse = {
    access_token: 'signed-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: 'user-1',
      name: 'Ana',
      email: 'ana@example.com',
      created_at: '2026-11-15T12:00:00Z',
    },
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    auth.logout();
    http.verify();
    vi.useRealTimers();
  });

  it('stores the session without storing the submitted password, and clears it on logout', () => {
    auth.login('ana@example.com', 'my-password').subscribe();
    const login = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(login.request.body).toEqual({ email: 'ana@example.com', password: 'my-password' });
    login.flush(response);
    expect(auth.token).toBe('signed-token');
    expect(auth.user()?.id).toBe('user-1');
    expect(sessionStorage.getItem('vetra-auth-session')).not.toContain('my-password');
    auth.logout();
    expect(auth.user()).toBeNull();
    expect(auth.token).toBeNull();
    expect(sessionStorage.getItem('vetra-auth-session')).toBeNull();
  });

  it('validates a restored session with the API before displaying the workspace', () => {
    sessionStorage.setItem(
      'vetra-auth-session',
      JSON.stringify({
        token: 'signed-token',
        user: response.user,
        expiresAt: Date.now() + 3600000,
      }),
    );
    auth.restoreSession();
    expect(auth.restoring()).toBe(true);
    http.expectOne(`${environment.apiUrl}/auth/me`).flush(response.user);
    expect(auth.restoring()).toBe(false);
    expect(auth.user()?.email).toBe('ana@example.com');
  });

  it('discards expired storage without calling the API', () => {
    sessionStorage.setItem(
      'vetra-auth-session',
      JSON.stringify({ token: 'expired-token', user: response.user, expiresAt: Date.now() - 1000 }),
    );
    auth.restoreSession();
    expect(auth.token).toBeNull();
    expect(auth.user()).toBeNull();
    expect(auth.restoring()).toBe(false);
    http.expectNone(`${environment.apiUrl}/auth/me`);
  });

  it('automatically ends a session at token expiry', () => {
    vi.useFakeTimers();
    auth.login('ana@example.com', 'my-password').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({ ...response, expires_in: 1 });
    vi.advanceTimersByTime(1000);
    expect(auth.user()).toBeNull();
    expect(auth.token).toBeNull();
  });
});
