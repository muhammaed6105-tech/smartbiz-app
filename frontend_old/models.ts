// ── Auth ────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// ── Customer ─────────────────────────────────────────────
export interface Customer {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  loyaltyPoints: number;
  totalPurchases: number;
  totalSpent: number;
  status: 'active' | 'inactive' | 'vip';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  customers: Customer[];
  pagination: Pagination;
}

// ── Inventory ─────────────────────────────────────────────
export interface Product {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  brand?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  supplier?: { name?: string; contact?: string; email?: string; };
  location?: string;
  barcode?: string;
  isActive: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryListResponse {
  products: Product[];
  pagination: Pagination;
}

// ── Sales ─────────────────────────────────────────────────
export interface SaleItem {
  product: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface Sale {
  _id: string;
  invoiceNumber: string;
  customer?: Customer;
  customerName?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  taxRate: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'eft' | 'mobile_payment';
  paymentStatus: 'paid' | 'pending' | 'refunded' | 'partial';
  status: 'completed' | 'cancelled' | 'refunded';
  notes?: string;
  processedBy?: User;
  createdAt: string;
}

export interface SaleListResponse {
  sales: Sale[];
  pagination: Pagination;
}

// ── Shared ─────────────────────────────────────────────────
export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiError {
  message: string;
  errors?: { msg: string; param: string }[];
}

export interface DashboardStats {
  todayRevenue: number;
  todaySales: number;
  totalCustomers: number;
  lowStockCount: number;
  recentSales: Sale[];
  topProducts: any[];
  salesByDay: { date: string; revenue: number; count: number }[];
  monthlyRevenue: number;
}
