import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { CameraCapture } from '../../shared/ui/camera-capture/camera-capture';
import { Component, inject, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../shared/ui/icon';
import { FaceService } from '../../shared/services/face.service';
import { RecognizeFaceResponse } from '../../shared/models/face.model';

@Component({
  selector: 'app-recognition',
  standalone: true,
  imports: [CommonModule, FormsModule, Icon, CameraCapture],
  templateUrl: './recognition.html',
  styleUrl: './recognition.css',
})
export class Recognition {
  resetResult(): void {
    this.recognitionResult.set(null);
    this.recognitionError.set(null);
  }

  @ViewChild(CameraCapture) camera?: CameraCapture;
  private readonly destroyRef = inject(DestroyRef);
  private readonly faceService = inject(FaceService);
  readonly isRecognizing = signal<boolean>(false);
  readonly recognitionResult = signal<RecognizeFaceResponse | null>(null);
  readonly recognitionError = signal<string | null>(null);

  readonly recognizedAt = signal<Date | null>(null);
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  ngOnDestroy(): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
  }
  private showError(message: string): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.recognitionError.set(message);
    this.errorTimer = setTimeout(() => {
      this.recognitionError.set(null);
      this.errorTimer = null;
    }, 3000);
  }
  confidencePercent(confidence: number): number {
    return Math.max(0, Math.min(100, confidence));
  }
  executeRecognition(): void {
    if (this.isRecognizing()) return;
    const blob = this.camera?.capturedImageBlob();
    if (!blob) {
      this.showError('Capture uma foto ou faça upload antes de reconhecer.');
      return;
    }

    this.isRecognizing.set(true);
    this.recognitionResult.set(null);
    this.recognitionError.set(null);

    this.faceService
      .recognizeFace(blob)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.recognitionResult.set(res);
          this.recognizedAt.set(new Date());
          this.isRecognizing.set(false);
        },
        error: (err) => {
          const detail = err.error?.detail || 'Erro ao processar o reconhecimento facial.';
          this.showError(detail);
          this.isRecognizing.set(false);
        },
      });
  }
}
