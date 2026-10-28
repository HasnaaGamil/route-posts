import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LoginPageComponent } from './login-page/login-page.component';
@Component({
  selector: 'app-auth-layout',
  imports: [ RouterOutlet,RouterLink,RouterLinkActive],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.css',
})
export class AuthLayoutComponent {
    stats = [
    { value: '2012', label: 'Founded' },
    { value: '40K+', label: 'Graduates' },
    { value: '50+', label: 'Partner companies' },
    { value: '5', label: 'Branches' },
    { value: '20', label: 'Diplomas available' },
  ];
}
