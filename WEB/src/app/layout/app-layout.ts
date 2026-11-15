import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Icon } from '../shared/ui/icon';
import { Registration } from '../features/registration/registration';
import { Recognition } from '../features/recognition/recognition';
import { People } from '../features/people/people';
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [Icon, Registration, Recognition, People],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
  host: { '(document:keydown.escape)': 'closeMobileMenu()', '(window:resize)': 'onWindowResize()' },
})
export class AppLayout implements OnInit {
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly activeTab = signal<'register' | 'recognize' | 'manage'>('register');
  readonly theme = signal<'dark' | 'light'>('dark');
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
  setTheme(next: 'light' | 'dark'): void {
    this.theme.set(next);
    document.documentElement.dataset['theme'] = next;
    try {
      localStorage.setItem('vetra-theme', next);
    } catch {
      /* Storage may be unavailable. */
    }
  }

  ngOnInit(): void {
    try {
      const saved = localStorage.getItem('vetra-theme');
      if (saved === 'light' || saved === 'dark') this.theme.set(saved);
    } catch {
      /* Use the default theme when storage is unavailable. */
    }
    document.documentElement.dataset['theme'] = this.theme();
  }
  setTab(tab: 'register' | 'recognize' | 'manage'): void {
    this.closeMobileMenu();
    this.activeTab.set(tab);
  }
}
