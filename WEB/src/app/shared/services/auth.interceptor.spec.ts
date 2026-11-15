import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('Authenticated API requests', () => {
  const auth = { token: 'signed-token', user: () => ({ id: 'user-1' }), logout: vi.fn() };
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    auth.token = 'signed-token';
    auth.logout.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the JWT and separate owner ID only to the configured API', () => {
    client.get(`${environment.apiUrl}/faces`).subscribe();
    const api = http.expectOne(`${environment.apiUrl}/faces`);
    expect(api.request.headers.get('Authorization')).toBe('Bearer signed-token');
    expect(api.request.headers.get('X-User-Id')).toBe('user-1');
    api.flush([]);
    client.get('https://another.example/resource').subscribe();
    const external = http.expectOne('https://another.example/resource');
    expect(external.request.headers.has('Authorization')).toBe(false);
    expect(external.request.headers.has('X-User-Id')).toBe(false);
    external.flush({});
  });

  it('ends the session on unauthorized responses from the API', () => {
    client.get(`${environment.apiUrl}/faces`).subscribe({ error: () => {} });
    http
      .expectOne(`${environment.apiUrl}/faces`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).toHaveBeenCalledOnce();
  });

  it('does not sign out a new session when an old request fails', () => {
    client.get(`${environment.apiUrl}/faces`).subscribe({ error: () => {} });
    const previous = http.expectOne(`${environment.apiUrl}/faces`);
    auth.token = 'new-session-token';
    previous.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
