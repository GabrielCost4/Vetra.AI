import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnDestroy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, Icon],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  readonly creatingAccount = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly passwordVisible = signal(false);
  name = '';
  email = '';
  password = '';

  ngOnDestroy(): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
  }

  switchMode(form: NgForm): void {
    if (this.submitting()) return;
    this.creatingAccount.update((value) => !value);
    form.resetForm();
    this.name = '';
    this.email = '';
    this.password = '';
    this.passwordVisible.set(false);
    this.error.set(null);
  }

  submit(form: NgForm): void {
    if (this.submitting()) return;
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.showError('Preencha os campos corretamente.');
      return;
    }
    const name = this.name.trim().replace(/\s+/g, ' ');
    const email = this.email.trim().toLowerCase();
    if (this.creatingAccount() && name.length < 2) {
      this.showError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    if (this.creatingAccount() && (this.password.length < 8 || this.password.length > 20)) {
      this.showError('A senha deve ter entre 8 e 20 caracteres.');
      return;
    }
    if (this.password.length > 20 || !this.password.trim()) {
      this.showError('Informe uma senha de até 20 caracteres que não seja apenas espaços.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const request = this.creatingAccount()
      ? this.auth.register(name, email, this.password)
      : this.auth.login(email, this.password);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.password = '';
        this.submitting.set(false);
      },
      error: (response: HttpErrorResponse) => {
        this.submitting.set(false);
        const detail = response.error?.detail;
        this.showError(
          typeof detail === 'string'
            ? detail
            : response.status === 422
              ? 'Confira o nome, email e senha informados.'
              : 'Não foi possível acessar sua conta. Tente novamente.',
        );
      },
    });
  }

  private showError(message: string): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.error.set(message);
    this.errorTimer = setTimeout(() => {
      this.error.set(null);
      this.errorTimer = null;
    }, 3000);
  }
}
