import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, AuthSession, AuthUser } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly storageKey = 'vetra-auth-session';
  private readonly session = signal<AuthSession | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  readonly restoring = signal(true);
  readonly user = computed(() => this.session()?.user ?? null);

  get token(): string | null {
    const session = this.session();
    return session && session.expiresAt > Date.now() ? session.token : null;
  }

  restoreSession(): void {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      const candidate = stored ? JSON.parse(stored) : null;
      if (
        !candidate ||
        typeof candidate.token !== 'string' ||
        typeof candidate.user?.id !== 'string' ||
        typeof candidate.expiresAt !== 'number' ||
        candidate.expiresAt <= Date.now()
      ) {
        this.logout();
        return;
      }
      this.session.set(candidate);
      this.http
        .get<AuthUser>(`${this.apiUrl}/me`)
        .pipe(timeout(15000))
        .subscribe({
          next: (user) => {
            this.session.set({ ...candidate, user });
            this.scheduleExpiry(candidate.expiresAt);
            this.restoring.set(false);
          },
          error: () => this.logout(),
        });
    } catch {
      this.logout();
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(tap((response) => this.saveSession(response)));
  }

  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, { name, email, password })
      .pipe(tap((response) => this.saveSession(response)));
  }

  logout(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    this.session.set(null);
    this.restoring.set(false);
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch {
      /* Use memory only. */
    }
  }

  private saveSession(response: AuthResponse): void {
    const session: AuthSession = {
      token: response.access_token,
      user: response.user,
      expiresAt: Date.now() + response.expires_in * 1000,
    };
    this.session.set(session);
    this.restoring.set(false);
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(session));
    } catch {
      /* Use memory only. */
    }
    this.scheduleExpiry(session.expiresAt);
  }

  private scheduleExpiry(expiresAt: number): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => this.logout(), Math.max(0, expiresAt - Date.now()));
  }
}
