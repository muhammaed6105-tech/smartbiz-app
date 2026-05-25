const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Customer = require('../models/Customer');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') }
      ];
    }

    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('createdBy', 'name');

    res.json({
      customers,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customers', error: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).populate('createdBy', 'name');
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customer', error: err.message });
  }
});

// POST /api/customers
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('First name required'),
  body('lastName').trim().notEmpty().withMessage('Last name required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const customer = await Customer.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ message: 'Customer created successfully', customer });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Email already exists' });
    res.status(500).json({ message: 'Failed to create customer', error: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('email').optional().isEmail().withMessage('Valid email required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer updated successfully', customer });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update customer', error: err.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete customer', error: err.message });
  }
});

module.exports = router;
