import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { LocalFaceRegistry } from '../../shared/data-access/local-face-registry';
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
  private readonly registry = inject(LocalFaceRegistry);
  readonly registerRequested = output<void>();
  readonly visibleFaces = () =>
    this.faces().filter((face) => this.registry.ids().includes(face.id));
  readonly isLoadingFaces = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly listError = signal<string | null>(null);
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
  deleteFace(face: FaceResponse): void {
    if (!confirm(`Deseja realmente remover o cadastro de "${face.name}"?`)) {
      return;
    }

    this.faceService
      .deleteFace(face.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.faces.update((list) => list.filter((f) => f.id !== face.id));
          this.registry.remove(face.id);
        },
        error: (err) => {
          const detail = err.error?.detail || 'Não foi possível excluir o cadastro.';
          this.deleteError.set(detail);
        },
      });
  }
}
