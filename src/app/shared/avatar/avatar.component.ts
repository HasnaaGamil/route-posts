import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <span [class]="'inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-slate-200 ' + size()">
      @if (src()) {
        <img [src]="src()" [alt]="name()" class="h-full w-full object-cover" />
      } @else {
        <span class="text-sm font-bold uppercase text-slate-600">{{ initial() }}</span>
      }
    </span>
  `,
})
export class AvatarComponent {
  src = input<string | null | undefined>(null);
  name = input('');
  size = input('h-10 w-10');
  initial = computed(() => this.name().trim().charAt(0));
}