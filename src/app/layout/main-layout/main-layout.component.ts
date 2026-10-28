import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <div class="min-h-screen bg-[#f1f3f8] font-sans text-slate-900">
      <app-navbar />
      <router-outlet />
    </div>
  `,
})
export class MainLayoutComponent {}