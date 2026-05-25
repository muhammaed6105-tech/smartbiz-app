import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { Inventory } from './pages/inventory/inventory';
import { Customers } from './pages/customers/customers';
import { Sales } from './pages/sales/sales';
import { Reports } from './pages/reports/reports';
import { AuthService } from './services/auth';
import { Users } from './pages/users/users';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    Login,
    Dashboard,
    Inventory,
    Customers,
    Sales,
    Reports,
    Users
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  isLoggedIn = false;
  activePage = 'dashboard';
  user: any = {};

  constructor(private authService: AuthService) {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.user = this.authService.getUser();
  }

  login(): void {
    this.isLoggedIn = true;
    this.user = this.authService.getUser();
    this.activePage = 'dashboard';
  }

  logout(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    this.activePage = 'dashboard';
  }
  get role(): string {
    return this.user?.role || 'staff';
  } 

  canViewReports(): boolean {
    return this.role === 'admin' || this.role === 'manager';
}
  setPage(page: string): void {
    if (page === 'reports' && !this.canViewReports()) {
      this.activePage = 'dashboard';
      return;
    }

    this.activePage = page;
  } 
}
