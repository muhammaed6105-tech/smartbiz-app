const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  productName: String,
  sku: String,
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  subtotal: {
    type: Number,
    required: true
  }
});

const saleSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  customerName: String,
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  taxRate: {
    type: Number,
    default: 15 // 15% VAT
  },
  total: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'eft', 'mobile_payment'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'refunded', 'partial'],
    default: 'paid'
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'refunded'],
    default: 'completed'
  },
  notes: String,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Auto-generate invoice number
saleSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Sale').countDocuments();
    const year = new Date().getFullYear();
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Index for reports
saleSchema.index({ createdAt: -1 });
saleSchema.index({ customer: 1 });
saleSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Sale', saleSchema);
