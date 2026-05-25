import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-reports',
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports implements OnInit {
  report: any = {};
  apiDemos: any = {};
  errorMessage = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.api.get<any>('/reports/full').subscribe({
      next: (data) => this.report = data,
      error: (err) => this.errorMessage = err?.error?.message || 'Reports could not be loaded.'
    });
    this.api.get<any>('/dashboard/api-demos').subscribe({
      next: (data) => this.apiDemos = data,
      error: () => {}
    });
  }

  downloadSalesReport(): void {
    const token = localStorage.getItem('token');
    const url = `http://localhost:5000/api/reports/download/sales.csv?token=${token || ''}`;
    window.open(url, '_blank');
  }

  formatMoney(value: number | undefined): string {
    return `AED ${Number(value || 0).toLocaleString('en-AE', { maximumFractionDigits: 2 })}`;
  }
}
