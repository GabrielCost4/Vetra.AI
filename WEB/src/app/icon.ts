import { Component, input } from '@angular/core';

// SVG geometry adapted from lucide-animated.com (MIT); see public/licenses.
@Component({
  selector: 'app-icon',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @switch (name()) {
      @case ('menu') {
        <path d="M4 6h16M4 12h16M4 18h16" />
      }
      @case ('close') {
        <path d="m6 6 12 12M6 18 18 6" />
      }
      @case ('expand') {
        <path d="M15 3h6v6M14 10l7-7M9 21H3v-6m7-1-7 7" />
      }
      @case ('camera') {
        <path
          d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"
        />
        <circle cx="12" cy="13" r="3" />
      }
      @case ('moon') {
        <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
      }
      @case ('image') {
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-5-5L5 21" />
      }
      @case ('refresh') {
        <path d="M3 11a9 9 0 0 1 15-6l3 3M21 3v5h-5M21 13a9 9 0 0 1-15 6l-3-3M3 21v-5h5" />
      }
      @case ('calendar') {
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      }
      @case ('panel') {
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" />
      }
      @case ('sun') {
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2m7.07.93-1.41 1.41M20 12h2m-4.34 5.66 1.41 1.41M12 20v2m-5.66-4.34-1.41 1.41M2 12h2m.93-7.07 1.41 1.41"
        />
      }
      @case ('users') {
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      }
      @default {
        <path
          d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"
        />
        <path class="face" d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
      }
    }
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }
    svg {
      width: 100%;
      height: 100%;
    }
    :host-context(button:hover) svg,
    :host-context(button:focus-visible) svg {
      animation: appear 0.45s ease;
    }
    @keyframes appear {
      from {
        transform: scale(0.85);
        opacity: 0.4;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      svg {
        animation: none !important;
      }
    }
  `,
})
export class Icon {
  readonly name = input('scan');
}
