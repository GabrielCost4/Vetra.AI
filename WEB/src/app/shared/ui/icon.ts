import { Component, input } from '@angular/core';

// SVG geometry adapted from lucide-animated.com (MIT); see public/licenses.
@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.css',
})
export class Icon {
  readonly name = input('scan');
}
