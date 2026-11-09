import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Icon } from './icon';
import { FaceService } from './services/face.service';
import { FaceResponse, RecognizeFaceResponse, RegisterFaceResponse } from './models/face.model';

@Component({
  selector: 'app-root',
  host: { '(document:keydown.escape)': 'closeMobileMenu()', '(window:resize)': 'onWindowResize()' },
  standalone: true,
  imports: [CommonModule, FormsModule, Icon],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly cameraStarting = signal(false);
  private readonly faceService = inject(FaceService);

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;

  readonly activeTab = signal<'recognize' | 'register' | 'manage'>('recognize');

  // Controle da Câmera e Captura
  readonly cameraActive = signal<boolean>(false);
  readonly cameraError = signal<string | null>(null);
  readonly capturedImageBlob = signal<Blob | null>(null);
  readonly previewUrl = signal<string | null>(null);

  // Reconhecimento
  readonly isRecognizing = signal<boolean>(false);
  readonly recognitionResult = signal<RecognizeFaceResponse | null>(null);
  readonly recognitionError = signal<string | null>(null);

  // Cadastro
  registerName = '';
  readonly isRegistering = signal<boolean>(false);
  readonly registerSuccess = signal<RegisterFaceResponse | null>(null);
  readonly registerError = signal<string | null>(null);

  // Gerenciamento
  readonly faces = signal<FaceResponse[]>([]);
  readonly isLoadingFaces = signal<boolean>(false);
  readonly deleteError = signal<string | null>(null);

  readonly sidebarCollapsed = signal(false);
  readonly mobileMenuOpen = signal(false);
  @ViewChild('mobileMenuTrigger') mobileMenuTrigger?: ElementRef<HTMLButtonElement>;

  openMobileMenu(): void {
    this.mobileMenuOpen.set(true);
    this.changeDetector.detectChanges();
    document.getElementById('mobile-menu-close')?.focus();
  }

  closeMobileMenu(): void {
    if (!this.mobileMenuOpen()) return;
    this.mobileMenuOpen.set(false);
    this.changeDetector.detectChanges();
    this.mobileMenuTrigger?.nativeElement.focus();
  }

  onWindowResize(): void {
    if (window.innerWidth > 650) this.mobileMenuOpen.set(false);
  }

  onSidebarKeydown(event: KeyboardEvent): void {
    if (!this.mobileMenuOpen() || event.key !== 'Tab') return;
    const buttons = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button, a[href]'),
    ).filter((el) => el.getClientRects().length);
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  readonly cameras = signal<MediaDeviceInfo[]>([]);
  selectedCamera = '';
  readonly recognizedAt = signal<Date | null>(null);

  readonly theme = signal<'dark' | 'light'>('dark');
  readonly notification = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  readonly listError = signal<string | null>(null);
  private destroyed = false;
  private cameraRequest = 0;

  toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  setTheme(next: 'light' | 'dark'): void {
    this.theme.set(next);
    document.documentElement.dataset['theme'] = next;
    try {
      localStorage.setItem('vetra-theme', next);
    } catch {
      /* Storage may be unavailable. */
    }
  }

  private notifyError(text: string): void {
    this.registerError.set(text);
    this.notification.set({ type: 'error', text });
  }

  private mediaStream: MediaStream | null = null;

  ngOnInit(): void {
    try {
      const saved = localStorage.getItem('vetra-theme');
      if (saved === 'light' || saved === 'dark') this.theme.set(saved);
    } catch {
      /* Use the default theme when storage is unavailable. */
    }
    document.documentElement.dataset['theme'] = this.theme();
    this.loadFaces();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopCamera();
    this.revokePreviewUrl();
  }

  setTab(tab: 'recognize' | 'register' | 'manage'): void {
    this.closeMobileMenu();
    this.activeTab.set(tab);
    this.recognitionError.set(null);
    this.registerError.set(null);
    this.registerSuccess.set(null);
    this.deleteError.set(null);

    if (tab === 'manage') {
      this.stopCamera();
      this.loadFaces();
    } else if (!this.capturedImageBlob() && !this.cameraActive()) {
      this.startCamera();
    }
  }

  async startCamera(): Promise<void> {
    this.cameraError.set(null);
    this.stopCamera();
    const request = this.cameraRequest;
    this.cameraStarting.set(true);
    const timeout = setTimeout(() => {
      if (request !== this.cameraRequest || this.destroyed) return;
      this.stopCamera();
      this.cameraError.set(
        'A câmera não respondeu. Verifique se ela está ativada no dispositivo e permita o acesso no navegador. Depois, tente novamente.',
      );
    }, 15000);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('CameraUnavailable');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          ...(this.selectedCamera
            ? { deviceId: { ideal: this.selectedCamera } }
            : { facingMode: 'user' }),
        },
      });
      if (this.destroyed || request !== this.cameraRequest || this.activeTab() === 'manage') {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.mediaStream = stream;
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState === 'ended') throw new Error('CameraStopped');
      track.onended = () => {
        if (request !== this.cameraRequest || this.destroyed) return;
        this.stopCamera();
        this.cameraError.set(
          'A câmera foi desativada. Ative-a no dispositivo e clique em Ativar câmera para reconectar.',
        );
      };
      track.onmute = () => {
        if (request !== this.cameraRequest || this.destroyed) return;
        this.cameraActive.set(false);
        this.cameraError.set(
          'O vídeo da câmera foi interrompido. Verifique se a câmera está ativada e tente novamente.',
        );
      };
      track.onunmute = () => {
        if (request !== this.cameraRequest || this.destroyed) return;
        this.cameraActive.set(true);
        this.cameraError.set(null);
      };
      this.revokePreviewUrl();
      this.previewUrl.set(null);
      this.capturedImageBlob.set(null);
      this.cameraActive.set(true);
      this.changeDetector.detectChanges();
      const video = this.videoElement?.nativeElement;
      if (!video) throw new Error('VideoUnavailable');
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      this.selectedCamera = stream.getVideoTracks()[0]?.getSettings().deviceId || '';
      // Listing devices must not interrupt an already running camera.
      void navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (!this.destroyed && request === this.cameraRequest) {
            this.cameras.set(devices.filter((device) => device.kind === 'videoinput'));
          }
        })
        .catch(() => {});
    } catch (error: unknown) {
      if (this.destroyed || request !== this.cameraRequest) return;
      this.stopCamera();
      const name = error instanceof Error ? error.name : '';
      const message = error instanceof Error ? error.message : '';
      this.cameraError.set(
        name === 'NotAllowedError'
          ? 'Acesso bloqueado. Permita o uso da câmera nas configurações do navegador e tente novamente.'
          : name === 'NotFoundError'
            ? 'Nenhuma câmera foi encontrada. Conecte uma câmera e tente novamente.'
            : name === 'NotReadableError'
              ? 'A câmera está indisponível ou em uso por outro aplicativo. Feche-o e tente novamente.'
              : message === 'CameraUnavailable'
                ? 'A câmera precisa de uma conexão segura. Abra o aplicativo em HTTPS ou localhost.'
                : 'Não foi possível iniciar a câmera. Tente novamente ou envie uma imagem.',
      );
    } finally {
      clearTimeout(timeout);
      if (request === this.cameraRequest || !this.cameraActive()) this.cameraStarting.set(false);
    }
  }

  stopCamera(): void {
    this.cameraRequest++;
    this.cameraStarting.set(false);
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement && this.videoElement.nativeElement) {
      this.videoElement.nativeElement.srcObject = null;
    }
    this.cameraActive.set(false);
  }

  async captureSnapshot(): Promise<void> {
    if (!this.videoElement || !this.videoElement.nativeElement) return;
    const video = this.videoElement.nativeElement;

    const canvas = this.canvasElement?.nativeElement || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Espelha horizontalmente para coincidir com a visualização da webcam
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    await new Promise<void>((resolve) =>
      canvas.toBlob(
        (blob) => {
          if (blob) {
            this.setCapturedBlob(blob);
            this.stopCamera();
          }
          resolve();
        },
        'image/jpeg',
        0.95,
      ),
    );
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        this.cameraError.set('Por favor, selecione um arquivo de imagem válido.');
        return;
      }
      this.stopCamera();
      this.setCapturedBlob(file);
    }
  }

  private setCapturedBlob(blob: Blob): void {
    this.cameraError.set(null);
    this.revokePreviewUrl();
    this.capturedImageBlob.set(blob);
    const url = URL.createObjectURL(blob);
    this.previewUrl.set(url);
    this.recognitionResult.set(null);
    this.recognitionError.set(null);
    this.registerError.set(null);
    this.registerSuccess.set(null);
  }

  retakePhoto(): void {
    this.revokePreviewUrl();
    this.capturedImageBlob.set(null);
    this.previewUrl.set(null);
    this.recognitionResult.set(null);
    this.recognitionError.set(null);
    this.registerError.set(null);
    this.registerSuccess.set(null);
    this.startCamera();
  }

  private revokePreviewUrl(): void {
    const current = this.previewUrl();
    if (current) {
      URL.revokeObjectURL(current);
    }
  }

  changeCamera(deviceId: string): void {
    this.selectedCamera = deviceId;
    this.revokePreviewUrl();
    this.previewUrl.set(null);
    this.capturedImageBlob.set(null);
    void this.startCamera();
  }

  confidencePercent(confidence: number): number {
    return Math.max(0, Math.min(100, confidence));
  }

  async recognizeImage(): Promise<void> {
    if (this.isRecognizing()) return;
    if (this.cameraActive()) await this.captureSnapshot();
    this.executeRecognition();
  }

  executeRecognition(): void {
    const blob = this.capturedImageBlob();
    if (!blob) {
      this.recognitionError.set('Capture uma foto ou faça upload antes de reconhecer.');
      return;
    }

    this.isRecognizing.set(true);
    this.recognitionResult.set(null);
    this.recognitionError.set(null);

    this.faceService.recognizeFace(blob).subscribe({
      next: (res) => {
        this.recognitionResult.set(res);
        this.recognizedAt.set(new Date());
        this.isRecognizing.set(false);
      },
      error: (err) => {
        const detail = err.error?.detail || 'Erro ao processar o reconhecimento facial.';
        this.recognitionError.set(detail);
        this.isRecognizing.set(false);
      },
    });
  }

  executeRegister(): void {
    if (this.isRegistering()) return;
    this.notification.set(null);
    const name = this.registerName.trim();
    const blob = this.capturedImageBlob();

    if (!name) {
      this.notifyError('Informe o nome da pessoa.');
      return;
    }

    if (!blob) {
      this.notifyError('Capture uma foto ou selecione um arquivo de imagem.');
      return;
    }

    this.isRegistering.set(true);
    this.registerSuccess.set(null);
    this.registerError.set(null);

    this.faceService.registerFace(name, blob).subscribe({
      next: (res) => {
        this.registerSuccess.set(res);
        this.notification.set({ type: 'success', text: `${res.name} foi cadastrado com sucesso.` });
        this.isRegistering.set(false);
        this.registerName = '';
        this.loadFaces();
      },
      error: (err) => {
        const detail = err.error?.detail || 'Não foi possível cadastrar o rosto. Tente novamente.';
        this.notifyError(detail);
        this.isRegistering.set(false);
      },
    });
  }

  loadFaces(): void {
    this.isLoadingFaces.set(true);
    this.listError.set(null);
    this.deleteError.set(null);
    this.faceService.listFaces().subscribe({
      next: (faces) => {
        this.faces.set(faces);
        this.isLoadingFaces.set(false);
      },
      error: () => {
        this.listError.set('Não foi possível carregar os cadastros.');
        this.isLoadingFaces.set(false);
      },
    });
  }

  deleteFace(face: FaceResponse): void {
    if (!confirm(`Deseja realmente remover o cadastro de "${face.name}"?`)) {
      return;
    }

    this.faceService.deleteFace(face.id).subscribe({
      next: () => {
        this.faces.update((list) => list.filter((f) => f.id !== face.id));
      },
      error: (err) => {
        const detail = err.error?.detail || 'Não foi possível excluir o cadastro.';
        this.deleteError.set(detail);
      },
    });
  }
}
