import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { CameraCapture } from '../../shared/ui/camera-capture/camera-capture';
import { Component, inject, ViewChild, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../shared/ui/icon';
import { FaceService } from '../../shared/services/face.service';
import { RegisterFaceResponse } from '../../shared/models/face.model';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, Icon, CameraCapture],
  templateUrl: './registration.html',
  styleUrl: './registration.css',
})
export class Registration implements OnDestroy {
  ngOnDestroy(): void {
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
  }
  resetResult(): void {
    this.registerError.set(null);
    this.registerSuccess.set(null);
  }

  @ViewChild(CameraCapture) camera?: CameraCapture;
  private readonly destroyRef = inject(DestroyRef);
  private readonly faceService = inject(FaceService);
  registerName = '';
  readonly isRegistering = signal<boolean>(false);
  readonly registerSuccess = signal<RegisterFaceResponse | null>(null);
  readonly registerError = signal<string | null>(null);

  readonly notification = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  private notificationTimer: ReturnType<typeof setTimeout> | null = null;
  private notifyError(text: string): void {
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notificationTimer = null;
    this.registerError.set(text);
    this.notification.set({ type: 'error', text });
    this.notificationTimer = setTimeout(() => {
      this.notification.set(null);
      this.registerError.set(null);
      this.notificationTimer = null;
    }, 3000);
  }

  executeRegister(): void {
    if (this.isRegistering()) return;
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notificationTimer = null;
    this.notification.set(null);
    const name = this.registerName.trim();
    const blob = this.camera?.capturedImageBlob();

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

    this.faceService
      .registerFace(name, blob)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.registerSuccess.set(res);
          this.notification.set({
            type: 'success',
            text: `${res.name} foi cadastrado com sucesso.`,
          });
          this.notificationTimer = setTimeout(() => {
            this.notification.set(null);
            this.notificationTimer = null;
          }, 3000);
          this.isRegistering.set(false);
          this.registerName = '';
        },
        error: (err) => {
          const detail =
            err.error?.detail || 'Não foi possível cadastrar o rosto. Tente novamente.';
          this.notifyError(detail);
          this.isRegistering.set(false);
        },
      });
  }
}
