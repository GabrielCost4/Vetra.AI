import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { App } from './app';
import { FaceService } from './services/face.service';

const person = { id: '1', name: 'Ana Silva', created_at: '2026-11-09T12:00:00Z' };

describe('Vetra workspace', () => {
  const service = {
    listFaces: vi.fn(() => of([person])),
    registerFace: vi.fn(() => of({ ...person, message: 'ok' })),
    recognizeFace: vi.fn(() =>
      of({ matched: true, ...person, confidence: 0.99, distance: 0.1, message: 'ok' }),
    ),
    deleteFace: vi.fn(() => of(undefined)),
  };

  beforeEach(async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      clear: () => storage.clear(),
    });
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: FaceService, useValue: service }],
    }).compileComponents();
  });

  it('renders the workspace and restores the selected theme', async () => {
    localStorage.setItem('vetra-theme', 'light');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain(
      'Reconhecimento facial',
    );
    expect(document.documentElement.dataset['theme']).toBe('light');
    fixture.componentInstance.toggleTheme();
    expect(localStorage.getItem('vetra-theme')).toBe('dark');
    fixture.destroy();
  });

  it('shows registration validation in the corner notification', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.setTab('register');
    app.executeRegister();
    fixture.detectChanges();
    expect(service.registerFace).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.toast.error').textContent).toContain(
      'Informe o nome',
    );
    fixture.destroy();
  });

  it('submits the selected image and shows a success message', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.registerName = ' Ana Silva ';
    const image = new Blob(['image'], { type: 'image/jpeg' });
    app.capturedImageBlob.set(image);
    app.executeRegister();
    fixture.detectChanges();
    expect(service.registerFace).toHaveBeenCalledWith('Ana Silva', image);
    expect(fixture.nativeElement.querySelector('.toast').textContent).toContain(
      'Ana Silva foi cadastrado com sucesso.',
    );
    expect(app.isRegistering()).toBe(false);
    fixture.destroy();
  });

  it('shows an API registration failure and allows another attempt', () => {
    service.registerFace.mockReturnValueOnce(
      throwError(() => ({ error: { detail: 'Rosto não detectado.' } })),
    );
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.registerName = 'Ana';
    app.capturedImageBlob.set(new Blob(['image']));
    app.executeRegister();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast.error').textContent).toContain(
      'Rosto não detectado.',
    );
    expect(app.isRegistering()).toBe(false);
    fixture.destroy();
  });
});
