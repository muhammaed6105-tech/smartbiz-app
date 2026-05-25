const express = require('express');
const { body, validationResult } = require('express-validator');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Customer = require('../models/Customer');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/sales
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, paymentMethod, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    const total = await Sale.countDocuments(filter);
    const sales = await Sale.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('customer', 'firstName lastName email')
      .populate('processedBy', 'name');

    res.json({
      sales,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sales', error: err.message });
  }
});

// GET /api/sales/:id
router.get('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer', 'firstName lastName email phone')
      .populate('processedBy', 'name')
      .populate('items.product', 'name sku');
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sale', error: err.message });
  }
});

// POST /api/sales - Process new sale with inventory deduction
router.post('/', [
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.product').notEmpty().withMessage('Product ID required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity required'),
  body('discount').optional().isFloat({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100'),
  body('taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100'),
  body('paymentMethod').isIn(['cash', 'card', 'eft', 'mobile_payment']).withMessage('Valid payment method required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { items, customer: customerId, paymentMethod, discount = 0, taxRate = 15, notes } = req.body;

    if (!items.length) {
      throw new Error('Cannot create an empty sale. Add at least one product.');
    }

    // Validate and process each item
    const processedItems = [];
    let subtotal = 0;
    const requestedQuantities = new Map();

    for (const item of items) {
      const productId = item.product.toString();
      requestedQuantities.set(productId, (requestedQuantities.get(productId) || 0) + Number(item.quantity));
      const product = await Inventory.findById(item.product);
      if (!product) throw new Error(`Product ${item.product} not found`);
      if (!product.isActive) throw new Error(`Product ${product.name} is not available`);
      if (product.quantity < requestedQuantities.get(productId)) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}, requested: ${requestedQuantities.get(productId)}`);
      }

      const itemDiscount = item.discount || 0;
      const unitPrice = product.sellingPrice;
      const itemSubtotal = unitPrice * item.quantity * (1 - itemDiscount / 100);

      processedItems.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice,
        discount: itemDiscount,
        subtotal: itemSubtotal
      });

      subtotal += itemSubtotal;

      // Deduct from inventory
      await Inventory.findByIdAndUpdate(
        product._id,
        { $inc: { quantity: -item.quantity } }
      );
    }

    const discountAmount = (subtotal * discount) / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * taxRate) / 100;
    const total = taxableAmount + taxAmount;

    // Build sale data
    const saleData = {
      items: processedItems,
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      taxRate,
      total,
      paymentMethod,
      notes,
      processedBy: req.user._id
    };

    // Link customer if provided
    if (customerId) {
      const customer = await Customer.findById(customerId);
      if (customer) {
        saleData.customer = customer._id;
        saleData.customerName = `${customer.firstName} ${customer.lastName}`;
        const points = Math.floor(total / 10);
        await Customer.findByIdAndUpdate(
          customerId,
          {
            $inc: { loyaltyPoints: points, totalPurchases: 1, totalSpent: total }
          }
        );
      }
    }

    const sale = await Sale.create(saleData);

    res.status(201).json({
      message: 'Sale processed successfully',
      sale
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/sales/:id/status
router.patch('/:id/status', authorize('admin', 'manager'), [
  body('status').isIn(['completed', 'cancelled', 'refunded']).withMessage('Valid status required')
], async (req, res) => {
  try {
    const sale = await Sale.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json({ message: 'Sale status updated', sale });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update sale status', error: err.message });
  }
});

// PUT /api/sales/:id - edit non-stock sale details safely
router.put('/:id', authorize('admin', 'manager'), [
  body('status').optional().isIn(['completed', 'cancelled', 'refunded']).withMessage('Valid status required'),
  body('paymentMethod').optional().isIn(['cash', 'card', 'eft', 'mobile_payment']).withMessage('Valid payment method required'),
  body('notes').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const allowed = ['status', 'paymentMethod', 'paymentStatus', 'notes'];
    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });

    const sale = await Sale.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    }).populate('customer', 'firstName lastName email');

    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json({ message: 'Sale updated successfully', sale });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update sale', error: err.message });
  }
});

// DELETE /api/sales/:id - cancel sale and restore stock when possible
router.delete('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    if (sale.status === 'completed') {
      for (const item of sale.items) {
        await Inventory.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: item.quantity } }
        );
      }
    }

    sale.status = 'cancelled';
    sale.paymentStatus = 'refunded';
    sale.notes = sale.notes ? `${sale.notes}\nSale cancelled and stock restored.` : 'Sale cancelled and stock restored.';
    await sale.save();
    res.json({ message: 'Sale cancelled successfully and stock restored', sale });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete sale', error: err.message });
  }
});

module.exports = router;
