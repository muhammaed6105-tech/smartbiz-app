import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class Login {
  @Output() loginSuccess = new EventEmitter<void>();

  isRegisterMode = false;
  isLoading = false;

  showForgotPassword = false;
  showResetPassword = false;
  showVerificationBox = false;

  name = '';
  email = '';
  password = '';
  role = 'staff';

  verificationCode = '';
  demoOtp = '';
  resetCode = '';
  newPassword = '';

  errorMessage = '';
  successMessage = '';

  constructor(private authService: AuthService) {}

  toggleMode(): void {
    this.isRegisterMode = !this.isRegisterMode;
    this.showVerificationBox = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  verifyEmail(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.verificationCode) {
      this.errorMessage = 'Please enter the 6-digit verification code.';
      return;
    }

    this.authService.verifyEmail({
      email: this.email,
      code: this.verificationCode
    }).subscribe({
      next: () => {
        this.verificationCode = '';
        this.demoOtp = '';

        this.successMessage = 'Account created successfully. Please login to continue.';

        this.showVerificationBox = false;
        this.isRegisterMode = false;
      },
      error: (err) => {
        this.errorMessage =
          err?.error?.message ||
          err?.error?.errors?.[0]?.msg ||
          'Verification failed.';
      }
    });
  }

  resendOtp(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email) {
      this.errorMessage = 'Please enter your email address first.';
      return;
    }

    this.authService.resendVerification(this.email).subscribe({
      next: (res: any) => {
        this.demoOtp = res?.demoOtp || '';
        this.successMessage = res?.message || 'A new verification OTP has been sent.';
      },
      error: (err) => {
        this.errorMessage =
          err?.error?.message ||
          err?.error?.errors?.[0]?.msg ||
          'Could not resend verification OTP.';
      }
    });
  }

  private loginAfterVerification(): void {
    this.authService.login({
      email: this.email,
      password: this.password
    }).subscribe({
      next: () => {
        this.loginSuccess.emit();
      },
      error: () => {
        this.showVerificationBox = false;
        this.isRegisterMode = false;
        this.password = '';
        this.successMessage = 'Email verified successfully. Please login now.';
      }
    });
  }

  openForgotPassword(): void {
    this.showForgotPassword = true;
    this.showResetPassword = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeForgotPassword(): void {
    this.showForgotPassword = false;
    this.showResetPassword = false;
    this.resetCode = '';
    this.newPassword = '';
  }

  sendResetCode(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email) {
      this.errorMessage = 'Please enter your email first.';
      return;
    }

    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.successMessage = 'Password reset code sent to your email.';
        this.showResetPassword = true;
      },
      error: (err) => {
        this.errorMessage =
          err?.error?.message ||
          err?.error?.errors?.[0]?.msg ||
          'Failed to send reset code.';
      }
    });
  }

  resetPassword(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.resetCode || !this.newPassword) {
      this.errorMessage = 'Please enter verification code and new password.';
      return;
    }

    this.authService.resetPassword({
      email: this.email,
      code: this.resetCode,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.successMessage = 'Password reset successful. You can login now.';
        this.closeForgotPassword();
        this.password = '';
      },
      error: (err) => {
        this.errorMessage =
          err?.error?.message ||
          err?.error?.errors?.[0]?.msg ||
          'Password reset failed.';
      }
    });
  }

  submitAuth(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter email and password.';
      return;
    }

    if (this.isRegisterMode && !this.name) {
      this.errorMessage = 'Please enter your full name.';
      return;
    }

    this.isLoading = true;

    if (this.isRegisterMode) {
      this.authService.register({
        name: this.name,
        email: this.email,
        password: this.password,
        role: this.role
      }).subscribe({
        next: (res: any) => {
          this.isLoading = false;
          this.demoOtp = res?.demoOtp || '';
          this.successMessage =
            'Verification code sent to your email. Please enter the OTP below.';
          this.showVerificationBox = true;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage =
            err?.error?.message ||
            err?.error?.errors?.[0]?.msg ||
            'Registration failed.';
        }
      });

      return;
    }

    this.authService.login({
      email: this.email,
      password: this.password
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.loginSuccess.emit();
      },
      error: (err) => {
        this.isLoading = false;
        if (err?.error?.requiresVerification) {
          this.demoOtp = err?.error?.demoOtp || '';
          this.showVerificationBox = true;
          this.isRegisterMode = false;
          this.successMessage =
            err?.error?.message ||
            'Please verify your email before login.';
          return;
        }

        this.errorMessage =
          err?.error?.message ||
          err?.error?.errors?.[0]?.msg ||
          'Invalid email or password. Please try again.';
      }
    });
  }
}
