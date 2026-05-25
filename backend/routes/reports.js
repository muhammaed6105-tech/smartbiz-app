const express = require('express');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const Inventory = require('../models/Inventory');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('admin', 'manager'));

// GET /api/reports/sales-summary
router.get('/sales-summary', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const summary = await Sale.aggregate([
      { $match: { createdAt: { $gte: daysAgo }, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalSales: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
          totalTax: { $sum: '$tax' },
          totalDiscount: { $sum: '$discount' }
        }
      }
    ]);

    res.json(summary[0] || { totalRevenue: 0, totalSales: 0, avgOrderValue: 0 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate report', error: err.message });
  }
});

// GET /api/reports/sales-by-day
router.get('/sales-by-day', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const data = await Sale.aggregate([
      { $match: { createdAt: { $gte: daysAgo }, status: 'completed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', revenue: 1, count: 1, _id: 0 } }
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate report', error: err.message });
  }
});

// GET /api/reports/sales-by-payment
router.get('/sales-by-payment', async (req, res) => {
  try {
    const data = await Sale.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $project: { method: '$_id', total: 1, count: 1, _id: 0 } }
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate report', error: err.message });
  }
});

// GET /api/reports/top-products
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const data = await Sale.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          sku: { $first: '$items.sku' },
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.subtotal' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) }
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate report', error: err.message });
  }
});

// GET /api/reports/top-customers
router.get('/top-customers', async (req, res) => {
  try {
    const customers = await Customer.find()
      .sort({ totalSpent: -1 })
      .limit(10)
      .select('firstName lastName email totalSpent totalPurchases loyaltyPoints status');
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate report', error: err.message });
  }
});

// GET /api/reports/inventory-value
router.get('/inventory-value', async (req, res) => {
  try {
    const data = await Inventory.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          totalItems: { $sum: 1 },
          totalCostValue: { $sum: { $multiply: ['$costPrice', '$quantity'] } },
          totalRetailValue: { $sum: { $multiply: ['$sellingPrice', '$quantity'] } },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { totalRetailValue: -1 } }
    ]);

    const totals = await Inventory.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalCostValue: { $sum: { $multiply: ['$costPrice', '$quantity'] } },
          totalRetailValue: { $sum: { $multiply: ['$sellingPrice', '$quantity'] } },
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    res.json({ byCategory: data, totals: totals[0] || {} });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate report', error: err.message });
  }
});

// GET /api/reports/monthly-sales
router.get('/monthly-sales', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const data = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(`${currentYear}-01-01`) },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          revenue: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          month: '$_id',
          revenue: 1,
          count: 1,
          _id: 0
        }
      }
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate report', error: err.message });
  }
});

// GET /api/reports/full - all assignment report sections in one response
router.get('/full', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

    const [
      totals,
      daily,
      monthly,
      inventoryValue,
      lowStock,
      topProducts,
      topCustomers,
      salesHistory
    ] = await Promise.all([
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$total' }, totalSales: { $sum: 1 } } }
      ]),
      Sale.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, dailyRevenue: { $sum: '$total' }, dailySales: { $sum: 1 } } }
      ]),
      Sale.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, monthlyRevenue: { $sum: '$total' }, monthlySales: { $sum: 1 } } }
      ]),
      Inventory.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$category',
            totalItems: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            totalRetailValue: { $sum: { $multiply: ['$sellingPrice', '$quantity'] } }
          }
        },
        { $sort: { totalRetailValue: -1 } }
      ]),
      Inventory.find({ isActive: true, $expr: { $lte: ['$quantity', '$reorderLevel'] } }).sort({ quantity: 1 }),
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            productName: { $first: '$items.productName' },
            sku: { $first: '$items.sku' },
            totalSold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.subtotal' }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]),
      Customer.find().sort({ totalSpent: -1 }).limit(10),
      Sale.find().sort({ createdAt: -1 }).limit(25).populate('customer', 'firstName lastName email')
    ]);

    res.json({
      totals: totals[0] || { totalRevenue: 0, totalSales: 0 },
      daily: daily[0] || { dailyRevenue: 0, dailySales: 0 },
      monthly: monthly[0] || { monthlyRevenue: 0, monthlySales: 0 },
      inventoryValue,
      lowStock,
      topProducts,
      topCustomers,
      salesHistory
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate full report', error: err.message });
  }
});

// GET /api/reports/download/sales.csv
router.get('/download/sales.csv', async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 }).populate('customer', 'firstName lastName email');
    const rows = [
      ['Invoice', 'Date', 'Customer', 'Payment Method', 'Status', 'Subtotal', 'Tax', 'Discount', 'Total'],
      ...sales.map((sale) => [
        sale.invoiceNumber || '',
        sale.createdAt.toISOString(),
        sale.customerName || (sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Walk-in'),
        sale.paymentMethod,
        sale.status,
        sale.subtotal.toFixed(2),
        sale.tax.toFixed(2),
        sale.discount.toFixed(2),
        sale.total.toFixed(2)
      ])
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment('smartbiz-sales-report.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Failed to download report', error: err.message });
  }
});

module.exports = router;
