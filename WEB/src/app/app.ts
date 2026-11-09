import {
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
import { FaceService } from './services/face.service';
import {
  FaceResponse,
  RecognizeFaceResponse,
  RegisterFaceResponse,
} from './models/face.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private readonly faceService = inject(FaceService);

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;

  // Abas: 'recognize' | 'register' | 'manage'
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

  private mediaStream: MediaStream | null = null;

  ngOnInit(): void {
    this.loadFaces();
    // Inicia a câmera automaticamente na inicialização
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.revokePreviewUrl();
  }

  setTab(tab: 'recognize' | 'register' | 'manage'): void {
    this.activeTab.set(tab);
    this.recognitionError.set(null);
    this.registerError.set(null);
    this.registerSuccess.set(null);
    this.deleteError.set(null);

    if (tab === 'manage') {
      this.loadFaces();
    } else if (!this.capturedImageBlob() && !this.cameraActive()) {
      this.startCamera();
    }
  }

  async startCamera(): Promise<void> {
    this.cameraError.set(null);
    try {
      if (this.mediaStream) {
        this.stopCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });
      this.mediaStream = stream;
      if (this.videoElement && this.videoElement.nativeElement) {
        this.videoElement.nativeElement.srcObject = stream;
        await this.videoElement.nativeElement.play();
      }
      this.cameraActive.set(true);
    } catch (err: unknown) {
      this.cameraActive.set(false);
      this.cameraError.set(
        'Não foi possível acessar a câmera. Verifique as permissões do navegador ou utilize o upload de imagem.'
      );
    }
  }

  stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement && this.videoElement.nativeElement) {
      this.videoElement.nativeElement.srcObject = null;
    }
    this.cameraActive.set(false);
  }

  captureSnapshot(): void {
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

    canvas.toBlob(
      (blob) => {
        if (blob) {
          this.setCapturedBlob(blob);
          this.stopCamera();
        }
      },
      'image/jpeg',
      0.95
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

  // --- RECONHECIMENTO FACIAL ---
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
        this.isRecognizing.set(false);
      },
      error: (err) => {
        const detail = err.error?.detail || 'Erro ao processar o reconhecimento facial.';
        this.recognitionError.set(detail);
        this.isRecognizing.set(false);
      },
    });
  }

  // --- CADASTRO FACIAL ---
  executeRegister(): void {
    const name = this.registerName.trim();
    const blob = this.capturedImageBlob();

    if (!name) {
      this.registerError.set('Informe o nome da pessoa.');
      return;
    }

    if (!blob) {
      this.registerError.set('Capture uma foto ou selecione um arquivo de imagem.');
      return;
    }

    this.isRegistering.set(true);
    this.registerSuccess.set(null);
    this.registerError.set(null);

    this.faceService.registerFace(name, blob).subscribe({
      next: (res) => {
        this.registerSuccess.set(res);
        this.isRegistering.set(false);
        this.registerName = '';
        this.loadFaces();
      },
      error: (err) => {
        const detail = err.error?.detail || 'Erro ao cadastrar o rosto no banco.';
        this.registerError.set(detail);
        this.isRegistering.set(false);
      },
    });
  }

  // --- GERENCIAMENTO DE CADASTROS ---
  loadFaces(): void {
    this.isLoadingFaces.set(true);
    this.deleteError.set(null);
    this.faceService.listFaces().subscribe({
      next: (faces) => {
        this.faces.set(faces);
        this.isLoadingFaces.set(false);
      },
      error: () => {
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
        const detail = err.error?.detail || 'Erro ao excluir o rosto do banco.';
        this.deleteError.set(detail);
      },
    });
  }
}
