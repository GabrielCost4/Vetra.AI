import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class LocalFaceRegistry {
  private readonly key = 'vetra-registered-face-ids';
  readonly ids = signal<string[]>(this.read());
  private read(): string[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(this.key) || '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }
  add(id: string): void {
    this.save([...new Set([...this.ids(), id])]);
  }
  remove(id: string): void {
    this.save(this.ids().filter((value) => value !== id));
  }
  private save(ids: string[]): void {
    this.ids.set(ids);
    try {
      localStorage.setItem(this.key, JSON.stringify(ids));
    } catch {
      /* Keep this session usable when storage is blocked. */
    }
  }
}
