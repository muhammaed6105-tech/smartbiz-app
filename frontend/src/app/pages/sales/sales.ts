import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-sales',
  imports: [CommonModule, FormsModule],
  templateUrl: './sales.html',
  styleUrl: './sales.scss',
})
export class Sales implements OnInit {
  sales: any[] = [];
  products: any[] = [];
  customers: any[] = [];
  successMessage = '';
  errorMessage = '';
  form: any = this.emptyForm();

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  emptyForm(): any {
    return {
      customer: '',
      product: '',
      quantity: 1,
      paymentMethod: 'cash',
      discount: 0,
      taxRate: 5,
      notes: ''
    };
  }

  loadData(): void {
    this.api.get<any>('/sales', { limit: 100 }).subscribe({
      next: (res) => this.sales = res.sales || [],
      error: (err) => this.errorMessage = err?.error?.message || 'Could not load sales.'
    });
    this.api.get<any>('/inventory', { limit: 100 }).subscribe({
      next: (res) => this.products = res.products || [],
      error: () => {}
    });
    this.api.get<any>('/customers', { limit: 100 }).subscribe({
      next: (res) => this.customers = res.customers || [],
      error: () => {}
    });
  }

  createSale(): void {
    this.clearMessages();
    const selected = this.products.find((product) => product._id === this.form.product);
    const quantity = Number(this.form.quantity);

    if (!selected || quantity < 1) {
      this.errorMessage = 'Select a product and enter a quantity of at least 1.';
      return;
    }

    if (selected.quantity < quantity) {
      this.errorMessage = `Insufficient stock for ${selected.name}. Available: ${selected.quantity}.`;
      return;
    }

    this.api.post<any>('/sales', {
      customer: this.form.customer || undefined,
      paymentMethod: this.form.paymentMethod,
      discount: Number(this.form.discount) || 0,
      taxRate: Number(this.form.taxRate) || 0,
      notes: this.form.notes,
      items: [{ product: this.form.product, quantity }]
    }).subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.form = this.emptyForm();
        this.loadData();
      },
      error: (err) => this.errorMessage = err?.error?.errors?.[0]?.msg || err?.error?.message || 'Sale could not be created.'
    });
  }

  updateStatus(sale: any, status: string): void {
    this.api.put<any>(`/sales/${sale._id}`, { status }).subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.loadData();
      },
      error: (err) => this.errorMessage = err?.error?.message || 'Sale could not be updated.'
    });
  }

  deleteSale(sale: any): void {
    if (!confirm(`Cancel sale ${sale.invoiceNumber}? Stock will be restored when possible.`)) return;
    this.api.delete<any>(`/sales/${sale._id}`).subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.loadData();
      },
      error: (err) => this.errorMessage = err?.error?.message || 'Sale could not be cancelled.'
    });
  }

  productName(sale: any): string {
    return sale.items?.map((item: any) => `${item.productName} x${item.quantity}`).join(', ') || 'No items';
  }

  get totalRevenue(): number {
    return this.sales
      .filter((sale) => sale.status === 'completed')
      .reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}
