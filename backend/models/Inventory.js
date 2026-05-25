const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: String,
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Electronics', 'Clothing', 'Food & Beverage', 'Home & Garden', 'Sports', 'Books', 'Toys', 'Other']
  },
  brand: String,
  costPrice: {
    type: Number,
    required: [true, 'Cost price is required'],
    min: [0, 'Price cannot be negative']
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Selling price is required'],
    min: [0, 'Price cannot be negative']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },
  reorderLevel: {
    type: Number,
    default: 10,
    min: 0
  },
  reorderQuantity: {
    type: Number,
    default: 50
  },
  supplier: {
    name: String,
    contact: String,
    email: String
  },
  location: String,
  barcode: String,
  isActive: {
    type: Boolean,
    default: true
  },
  images: [String],
  tags: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Virtual: profit margin
inventorySchema.virtual('profitMargin').get(function() {
  if (this.costPrice === 0) return 100;
  return (((this.sellingPrice - this.costPrice) / this.costPrice) * 100).toFixed(2);
});

// Virtual: stock status
inventorySchema.virtual('stockStatus').get(function() {
  if (this.quantity === 0) return 'out_of_stock';
  if (this.quantity <= this.reorderLevel) return 'low_stock';
  return 'in_stock';
});

// Text index for search
inventorySchema.index({ name: 'text', sku: 'text', description: 'text', brand: 'text' });

module.exports = mongoose.model('Inventory', inventorySchema);
