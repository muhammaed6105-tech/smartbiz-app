const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Inventory = require('../models/Inventory');

dotenv.config({ override: true });

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartbiz');

  let admin = await User.findOne({ email: 'admin@smartbiz.local' }).select('+password');
  if (!admin) {
    admin = await User.create({
      name: 'SmartBiz Admin',
      email: 'admin@smartbiz.local',
      password: 'Admin123!',
      role: 'admin',
      isVerified: true,
      isActive: true
    });
  } else {
    admin.name = 'SmartBiz Admin';
    admin.password = 'Admin123!';
    admin.role = 'admin';
    admin.isVerified = true;
    admin.isActive = true;
    admin.verificationCode = undefined;
    admin.verificationCodeExpires = undefined;
    await admin.save();
  }

  const products = [
    { sku: 'SB-1001', name: 'Laptop', category: 'Electronics', costPrice: 1800, sellingPrice: 2500, quantity: 15, reorderLevel: 5, brand: 'SmartTech' },
    { sku: 'SB-1002', name: 'Wireless Mouse', category: 'Electronics', costPrice: 35, sellingPrice: 80, quantity: 3, reorderLevel: 8, brand: 'ClickPro' },
    { sku: 'SB-1003', name: 'Receipt Printer', category: 'Electronics', costPrice: 260, sellingPrice: 420, quantity: 20, reorderLevel: 6, brand: 'POSLine' },
    { sku: 'SB-1004', name: 'Organic Coffee Beans', category: 'Food & Beverage', costPrice: 28, sellingPrice: 52, quantity: 40, reorderLevel: 12, brand: 'CafePlus' }
  ];

  for (const product of products) {
    await Inventory.findOneAndUpdate(
      { sku: product.sku },
      { ...product, createdBy: admin._id, isActive: true },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  const customers = [
    { firstName: 'Ahmed', lastName: 'Khan', email: 'ahmed@example.com', phone: '0501234567', address: { city: 'Dubai', country: 'United Arab Emirates' }, status: 'active' },
    { firstName: 'Sara', lastName: 'Ali', email: 'sara@example.com', phone: '0559876543', address: { city: 'Sharjah', country: 'United Arab Emirates' }, status: 'vip' },
    { firstName: 'Mohammed', lastName: 'Raza', email: 'mohammed@example.com', phone: '0524567890', address: { city: 'Ajman', country: 'United Arab Emirates' }, status: 'active' }
  ];

  for (const customer of customers) {
    await Customer.findOneAndUpdate(
      { email: customer.email },
      { ...customer, createdBy: admin._id },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  console.log('SmartBiz seed complete.');
  console.log('Login: admin@smartbiz.local / Admin123!');
  await mongoose.disconnect();
};

seed().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
