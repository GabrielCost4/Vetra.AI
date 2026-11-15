import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { Component, inject, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../shared/ui/icon';
import { FaceService } from '../../shared/services/face.service';
import { FaceResponse } from '../../shared/models/face.model';

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [CommonModule, Icon],
  templateUrl: './people.html',
  styleUrl: './people.css',
})
export class People implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly faceService = inject(FaceService);
  readonly faces = signal<FaceResponse[]>([]);
  readonly registerRequested = output<void>();
  readonly isLoadingFaces = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly listError = signal<string | null>(null);
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private showDeleteError(message: string): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.deleteError.set(message);
    this.errorTimer = setTimeout(() => {
      this.deleteError.set(null);
      this.errorTimer = null;
    }, 3000);
  }
  readonly facePendingDeletion = signal<FaceResponse | null>(null);
  ngOnDestroy(): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
  }
  ngOnInit(): void {
    this.loadFaces();
  }
  loadFaces(): void {
    this.isLoadingFaces.set(true);
    this.listError.set(null);
    this.deleteError.set(null);
    this.faceService
      .listFaces()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
  requestDelete(face: FaceResponse): void {
    this.facePendingDeletion.set(face);
  }
  cancelDelete(): void {
    this.facePendingDeletion.set(null);
  }
  confirmDelete(): void {
    const face = this.facePendingDeletion();
    if (!face) return;
    this.faceService
      .deleteFace(face.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.faces.update((list) => list.filter((f) => f.id !== face.id));
          this.facePendingDeletion.set(null);
        },
        error: (err) => {
          const detail = err.error?.detail || 'Não foi possível excluir o cadastro.';
          this.showDeleteError(detail);
        },
      });
  }
}
