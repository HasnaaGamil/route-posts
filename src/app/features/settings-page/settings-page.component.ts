import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { UsersService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';


/** At least 8 characters with uppercase, lowercase, number and special character */
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function passwordRules(group: AbstractControl): ValidationErrors | null {
  const current = group.get('currentPassword')?.value;
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;

  const errors: ValidationErrors = {};
  if (next && confirm && next !== confirm) errors['mismatch'] = true;
  if (current && next && current === next) errors['sameAsCurrent'] = true;
  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  private fb = inject(FormBuilder);
  private usersApi = inject(UsersService);
  private auth = inject(AuthService);

  form = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.pattern(STRONG_PASSWORD)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordRules },
  );

  saving = signal(false);
  error = signal('');
  success = signal('');

  /** True once the user has touched or tried to submit the field */
  invalid(name: 'currentPassword' | 'newPassword' | 'confirmPassword') {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    const { currentPassword, newPassword } = this.form.getRawValue();

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.usersApi
      .changePassword(currentPassword, newPassword)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        // SettingsPageComponent, inside next:
next: (data) => {
  this.form.reset();

  if (data?.token) {
    // The server issued a new token, so keep the session going
    this.auth.setToken(data.token);
    this.success.set('Your password has been updated.');
  } else {
    // The old token is no longer valid, so sign out on purpose
    this.success.set('Password updated. Please sign in again.');
    setTimeout(() => this.auth.logout(), 1500);
  }
},
        error: (err: HttpErrorResponse) => {
  const message: string = err.error?.message ?? '';

  // The server rejected the current password
  const wrongCurrent =
    [400, 401, 403].includes(err.status) && /current|old|incorrect|wrong|invalid|match/i.test(message);

  if (wrongCurrent) {
    const control = this.form.controls.currentPassword;
    control.setErrors({ wrong: true });
    control.markAsTouched();
    return;
  }

  this.error.set(message || 'Could not update your password. Try again.');
},
      });
  }
}