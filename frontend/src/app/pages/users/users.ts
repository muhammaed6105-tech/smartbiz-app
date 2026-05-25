import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrls: ['./users.scss']
})
export class Users implements OnInit {
  users: any[] = [];
  successMessage = '';
  errorMessage = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    console.log('Users page loaded');
    this.loadUsers();
  }

  loadUsers(): void {
    console.log('Loading users...');
    this.api.get<any>('/auth/users').subscribe({
      next: (res) => {console.log('Users API Response:', res);this.users =res.users ||res.data ||res ||[];},
      error: (err) => this.errorMessage = err?.error?.message || 'Could not load users.'
    });
  }

  updateRole(user: any): void {
    this.successMessage = '';
    this.errorMessage = '';

    this.api.put<any>(`/auth/users/${user._id}/role`, { role: user.role }).subscribe({
      next: (res) => {
        this.successMessage = res.message || 'User role updated successfully.';
        this.loadUsers();
      },
      error: (err) => this.errorMessage = err?.error?.message || 'Could not update user role.'
    });
  }
}