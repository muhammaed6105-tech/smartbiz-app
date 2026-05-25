const express = require('express');
const { body, validationResult } = require('express-validator');
const Inventory = require('../models/Inventory');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/inventory
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, stockStatus, sortBy = 'name', sortOrder = 'asc' } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { sku: new RegExp(search, 'i') },
        { brand: new RegExp(search, 'i') }
      ];
    }
    if (stockStatus === 'low_stock') filter.$expr = { $lte: ['$quantity', '$reorderLevel'] };
    if (stockStatus === 'out_of_stock') filter.quantity = 0;
    if (stockStatus === 'in_stock') filter.$expr = { $gt: ['$quantity', '$reorderLevel'] };

    const total = await Inventory.countDocuments(filter);
    const products = await Inventory.find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      products,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch inventory', error: err.message });
  }
});

// GET /api/inventory/low-stock
router.get('/alerts/low-stock', async (req, res) => {
  try {
    const products = await Inventory.find({
      isActive: true,
      $expr: { $lte: ['$quantity', '$reorderLevel'] }
    }).sort({ quantity: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch low stock items', error: err.message });
  }
});

// GET /api/inventory/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Inventory.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch product', error: err.message });
  }
});

// POST /api/inventory
router.post('/', authorize('admin', 'manager'), [
  body('sku').trim().notEmpty().withMessage('SKU required'),
  body('name').trim().notEmpty().withMessage('Name required'),
  body('category').notEmpty().withMessage('Category required'),
  body('costPrice').isFloat({ min: 0 }).withMessage('Valid cost price required'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Valid selling price required'),
  body('quantity').isInt({ min: 0 }).withMessage('Valid quantity required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const product = await Inventory.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ message: 'Product added successfully', product });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'SKU already exists' });
    res.status(500).json({ message: 'Failed to add product', error: err.message });
  }
});

// PUT /api/inventory/:id
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    const product = await Inventory.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product updated successfully', product });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update product', error: err.message });
  }
});

// PATCH /api/inventory/:id/stock - Update stock quantity only
router.patch('/:id/stock', [
  body('quantity').isInt().withMessage('Valid quantity required'),
  body('operation').isIn(['set', 'add', 'subtract']).withMessage('Valid operation required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const product = await Inventory.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { quantity, operation } = req.body;
    if (operation === 'set') product.quantity = quantity;
    else if (operation === 'add') product.quantity += quantity;
    else if (operation === 'subtract') {
      if (product.quantity < quantity) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }
      product.quantity -= quantity;
    }

    await product.save();
    res.json({ message: 'Stock updated successfully', product });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update stock', error: err.message });
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const product = await Inventory.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deactivated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete product', error: err.message });
  }
});

module.exports = router;
