import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  summary: any = {};
  apiDemos: any = {};
  isLoading = true;
  errorMessage = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.api.get<any>('/dashboard/summary').subscribe({
      next: (summary) => {
        this.summary = summary;
        setTimeout(() => {
        this.isLoading = false;
        }, 500); 
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Dashboard data could not be loaded.';
        this.isLoading = false;
      }
    });

    this.api.get<any>('/dashboard/api-demos').subscribe({
      next: (data) => this.apiDemos = data,
      error: () => this.apiDemos = {}
    });
  }

  formatMoney(value: number | undefined): string {
    return `AED ${Number(value || 0).toLocaleString('en-AE', { maximumFractionDigits: 2 })}`;
  }

  monthLabel(month: number): string {
    return new Date(2026, month - 1, 1).toLocaleString('en', { month: 'short' });
  }
}
