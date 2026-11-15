import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Icon } from '../icon';

@Component({
  selector: 'app-camera-capture',
  standalone: true,
  imports: [FormsModule, Icon],
  templateUrl: './camera-capture.html',
  styleUrl: './camera-capture.css',
  host: { '(document:keydown.escape)': 'closeCameraModal()' },
})
export class CameraCapture implements OnInit, OnDestroy {
  readonly mode = input<'register' | 'recognize'>('register');
  readonly busy = input(false);
  readonly recognize = output<void>();
  readonly imageChanged = output<void>();
  private readonly changeDetector = inject(ChangeDetectorRef);
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('modalVideo') modalVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;
  readonly cameraStarting = signal(false);
  readonly cameraModalOpen = signal(false);
  readonly cameraModalClosing = signal(false);
  readonly cameraActive = signal(false);
  readonly cameraError = signal<string | null>(null);
  readonly capturedImageBlob = signal<Blob | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly cameras = signal<MediaDeviceInfo[]>([]);
  selectedCamera = '';
  private cameraModalCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private mediaStream: MediaStream | null = null;
  private destroyed = false;
  private cameraRequest = 0;
  ngOnInit(): void {
    void this.startCamera();
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.cameraModalCloseTimer) clearTimeout(this.cameraModalCloseTimer);
    this.stopCamera();
    this.revokePreviewUrl();
  }
  async requestRecognition(): Promise<void> {
    if (this.busy()) return;
    if (this.cameraActive()) await this.captureSnapshot();
    this.recognize.emit();
  }
  async recognizeFromModal(): Promise<void> {
    await this.requestRecognition();
    this.closeCameraModal();
  }
  openCameraModal(): void {
    if (this.cameraModalCloseTimer) clearTimeout(this.cameraModalCloseTimer);
    this.cameraModalCloseTimer = null;
    this.cameraModalClosing.set(false);
    this.cameraModalOpen.set(true);
    this.changeDetector.detectChanges();
    if (this.mediaStream && this.modalVideo) {
      this.modalVideo.nativeElement.srcObject = this.mediaStream;
      this.modalVideo.nativeElement.muted = true;
      void this.modalVideo.nativeElement.play().catch(() => {});
    } else if (!this.cameraActive()) {
      void this.startCamera();
    }
    document.querySelector<HTMLButtonElement>('.camera-modal-close')?.focus();
  }

  closeCameraModal(): void {
    if (!this.cameraModalOpen() || this.cameraModalClosing()) return;
    this.cameraModalClosing.set(true);
    this.cameraModalOpen.set(false);
    this.changeDetector.detectChanges();
    this.cameraModalCloseTimer = setTimeout(() => {
      this.cameraModalClosing.set(false);
      this.cameraModalCloseTimer = null;
      this.changeDetector.detectChanges();
      this.videoElement?.nativeElement.focus();
    }, 220);
  }

  async activateCameraFromModal(): Promise<void> {
    const starting = this.startCamera();
    this.closeCameraModal();
    await starting;
  }

  async captureFromModal(): Promise<void> {
    const capture = this.captureSnapshot();
    this.closeCameraModal();
    await capture;
  }

  onModalFileSelected(event: Event): void {
    this.onFileSelected(event);
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.closeCameraModal();
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
      if (this.destroyed || request !== this.cameraRequest) {
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
      this.imageChanged.emit();
      this.cameraActive.set(true);
      this.changeDetector.detectChanges();
      const video = this.videoElement?.nativeElement;
      if (!video) throw new Error('VideoUnavailable');
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      if (this.cameraModalOpen() && this.modalVideo) {
        this.modalVideo.nativeElement.srcObject = stream;
        this.modalVideo.nativeElement.muted = true;
        await this.modalVideo.nativeElement.play();
      }
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
    if (this.modalVideo) this.modalVideo.nativeElement.srcObject = null;
    this.cameraActive.set(false);
  }

  async captureSnapshot(): Promise<void> {
    const video =
      this.cameraModalOpen() && this.modalVideo
        ? this.modalVideo.nativeElement
        : this.videoElement?.nativeElement;
    if (!video) return;

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
    this.imageChanged.emit();
  }

  retakePhoto(): void {
    this.revokePreviewUrl();
    this.capturedImageBlob.set(null);
    this.imageChanged.emit();
    this.previewUrl.set(null);

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
    this.imageChanged.emit();
    void this.startCamera();
  }
}
