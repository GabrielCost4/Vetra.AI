import { Component } from '@angular/core';
import { AppLayout } from './layout/app-layout';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppLayout],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
