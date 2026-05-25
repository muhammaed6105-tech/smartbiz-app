const express = require('express');
const Customer = require('../models/Customer');
const Inventory = require('../models/Inventory');
const Sale = require('../models/Sale');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

    const [
      totalCustomers,
      totalProducts,
      totalSales,
      lowStockCount,
      recentSales,
      lowStockProducts,
      revenueResult,
      dailyRevenueResult,
      monthlyRevenueResult,
      monthlySales
    ] = await Promise.all([
      Customer.countDocuments({ status: { $ne: 'inactive' } }),
      Inventory.countDocuments({ isActive: true }),
      Sale.countDocuments({ status: 'completed' }),
      Inventory.countDocuments({ isActive: true, $expr: { $lte: ['$quantity', '$reorderLevel'] } }),
      Sale.find({ status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('customer', 'firstName lastName')
        .populate('processedBy', 'name'),
      Inventory.find({ isActive: true, $expr: { $lte: ['$quantity', '$reorderLevel'] } })
        .sort({ quantity: 1 })
        .limit(6),
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
      ]),
      Sale.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, dailyRevenue: { $sum: '$total' } } }
      ]),
      Sale.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, monthlyRevenue: { $sum: '$total' }, monthlySales: { $sum: 1 } } }
      ]),
      Sale.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: new Date(startOfDay.getFullYear(), 0, 1) }
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
        { $project: { month: '$_id', revenue: 1, count: 1, _id: 0 } }
      ])
    ]);

    res.json({
      totalCustomers,
      totalProducts,
      totalSales,
      lowStockCount,
      totalRevenue: revenueResult[0]?.totalRevenue || 0,
      dailyRevenue: dailyRevenueResult[0]?.dailyRevenue || 0,
      monthlyRevenue: monthlyRevenueResult[0]?.monthlyRevenue || 0,
      monthlySalesCount: monthlyRevenueResult[0]?.monthlySales || 0,
      monthlySales,
      recentSales,
      lowStockProducts
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load dashboard summary', error: err.message });
  }
});

router.get('/api-demos', async (req, res) => {
  res.json({
    weather: {
      provider: 'Open-Meteo demo',
      location: 'Dubai, UAE',
      temperatureC: 34,
      condition: 'Hot and clear',
      logisticsAlert: 'Schedule chilled stock deliveries before peak afternoon heat.',
      isDemoData: true
    },
    currency: {
      provider: 'Exchange-rate demo',
      base: 'AED',
      rates: {
        USD: 0.2723,
        GBP: 0.2145,
        ZAR: 5.08
      },
      note: 'Demo conversion data for assignment use. No paid API key required.',
      isDemoData: true
    },
    courier: {
      provider: 'Courier tracking placeholder',
      trackingNumber: 'SBZ-order-1024',
      status: 'In transit',
      estimatedDelivery: 'Next business day',
      checkpoint: 'Dubai distribution hub',
      isDemoData: true
    }
  });
});

module.exports = router;
