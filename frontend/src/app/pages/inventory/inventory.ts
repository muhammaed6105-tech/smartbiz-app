import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-inventory',
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
})
export class Inventory implements OnInit {
  products: any[] = [];
  categories = ['Electronics', 'Clothing', 'Food & Beverage', 'Home & Garden', 'Sports', 'Books', 'Toys', 'Other'];
  search = '';
  isEditing = false;
  selectedId = '';
  successMessage = '';
  errorMessage = '';
  form: any = this.emptyForm();

  constructor(private api: ApiService, private authService: AuthService) {}

  get lowStockCount(): number {
    return this.products.filter((product) => product.quantity <= product.reorderLevel).length;
  }

  get availableCount(): number {
    return this.products.filter((product) => product.quantity > 0).length;
  }

  get role(): string {
    return this.authService.getUser()?.role || 'staff';
  }

  canManageInventory(): boolean {
    return this.role === 'admin' || this.role === 'manager';
  }

  canDeleteInventory(): boolean {
    return this.role === 'admin';
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  emptyForm(): any {
    return {
      sku: '',
      name: '',
      category: 'Electronics',
      costPrice: 0,
      sellingPrice: 0,
      quantity: 0,
      reorderLevel: 10,
      brand: '',
      location: ''
    };
  }

  loadProducts(): void {
    this.api.get<any>('/inventory', { limit: 100, search: this.search }).subscribe({
      next: (res) => this.products = res.products || [],
      error: (err) => this.errorMessage = err?.error?.message || 'Could not load products.'
    });
  }

  saveProduct(): void {
    this.clearMessages();
    if (!this.form.sku || !this.form.name || Number(this.form.sellingPrice) < 0 || Number(this.form.quantity) < 0) {
      this.errorMessage = 'Please complete all product fields with valid values.';
      return;
    }

    const request = this.isEditing
      ? this.api.put<any>(`/inventory/${this.selectedId}`, this.form)
      : this.api.post<any>('/inventory', this.form);

    request.subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.resetForm();
        this.loadProducts();
      },
      error: (err) => this.errorMessage = this.firstError(err) || 'Product could not be saved.'
    });
  }

  editProduct(product: any): void {
    this.isEditing = true;
    this.selectedId = product._id;
    this.form = {
      sku: product.sku,
      name: product.name,
      category: product.category,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      quantity: product.quantity,
      reorderLevel: product.reorderLevel,
      brand: product.brand || '',
      location: product.location || ''
    };
  }

  deleteProduct(product: any): void {
    if (!confirm(`Delete product "${product.name}"?`)) return;
    this.api.delete<any>(`/inventory/${product._id}`).subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.loadProducts();
      },
      error: (err) => this.errorMessage = err?.error?.message || 'Product could not be deleted.'
    });
  }

  resetForm(): void {
    this.isEditing = false;
    this.selectedId = '';
    this.form = this.emptyForm();
  }

  stockStatus(product: any): string {
    if (product.quantity === 0) return 'Out of Stock';
    if (product.quantity <= product.reorderLevel) return 'Low Stock';
    return 'Available';
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  firstError(err: any): string {
    return err?.error?.errors?.[0]?.msg || err?.error?.message;
  }
}
