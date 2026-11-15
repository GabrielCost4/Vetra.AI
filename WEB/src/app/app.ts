import { Component, OnInit, inject } from '@angular/core';
import { AppLayout } from './layout/app-layout';
import { Auth } from './features/auth/auth';
import { AuthService } from './shared/services/auth.service';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppLayout, Auth],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  readonly auth = inject(AuthService);

  ngOnInit(): void {
    this.auth.restoreSession();
  }
}
