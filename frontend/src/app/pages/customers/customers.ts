import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-customers',
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
})
export class Customers implements OnInit {
  customers: any[] = [];
  search = '';
  isEditing = false;
  selectedId = '';
  successMessage = '';
  errorMessage = '';
  form: any = this.emptyForm();

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadCustomers();
  }

  emptyForm(): any {
    return {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      status: 'active',
      address: { city: '', country: 'United Arab Emirates' },
      notes: ''
    };
  }

  loadCustomers(): void {
    this.api.get<any>('/customers', { limit: 100, search: this.search }).subscribe({
      next: (res) => this.customers = res.customers || [],
      error: (err) => this.errorMessage = err?.error?.message || 'Could not load customers.'
    });
  }

  saveCustomer(): void {
    this.clearMessages();
    if (!this.form.firstName || !this.form.lastName) {
      this.errorMessage = 'First name and last name are required.';
      return;
    }

    const request = this.isEditing
      ? this.api.put<any>(`/customers/${this.selectedId}`, this.form)
      : this.api.post<any>('/customers', this.form);

    request.subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.resetForm();
        this.loadCustomers();
      },
      error: (err) => this.errorMessage = err?.error?.errors?.[0]?.msg || err?.error?.message || 'Customer could not be saved.'
    });
  }

  editCustomer(customer: any): void {
    this.isEditing = true;
    this.selectedId = customer._id;
    this.form = {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email || '',
      phone: customer.phone || '',
      status: customer.status || 'active',
      address: {
        city: customer.address?.city || '',
        country: customer.address?.country || 'United Arab Emirates'
      },
      notes: customer.notes || ''
    };
  }

  deleteCustomer(customer: any): void {
    if (!confirm(`Delete customer "${customer.firstName} ${customer.lastName}"?`)) return;
    this.api.delete<any>(`/customers/${customer._id}`).subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.loadCustomers();
      },
      error: (err) => this.errorMessage = err?.error?.message || 'Customer could not be deleted.'
    });
  }

  resetForm(): void {
    this.isEditing = false;
    this.selectedId = '';
    this.form = this.emptyForm();
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}
