const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();
const DEMO_OTP = '123456';
const OTP_EXPIRY_MINUTES = 30;

const isEmailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendEmail = async (to, subject, html) => {
  if (!isEmailConfigured()) {
    console.log(`SmartBiz email demo mode: ${subject} for ${to}`);
    console.log(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
    return false;
  }

  await transporter.sendMail({
    from: `"SmartBiz Retail" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });

  return true;
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const generateVerificationCode = () => {
  if (!isEmailConfigured()) return DEMO_OTP;
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const applyVerificationCode = (user, code = generateVerificationCode()) => {
  user.verificationCode = code;
  user.verificationCodeExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  return code;
};

const verificationEmailHtml = (code) => `
  <div style="font-family: Arial; padding: 30px;">
    <h2 style="color:#7c3aed;">SmartBiz Email Verification</h2>
    <p>Thank you for creating your SmartBiz account.</p>
    <p>Your verification code is:</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111827;margin:20px 0;">
      ${code}
    </div>
    <p>This code will expire in ${OTP_EXPIRY_MINUTES} minutes.</p>
  </div>
`;

const sendVerificationCode = async (user) => {
  const code = applyVerificationCode(user);
  await user.save({ validateBeforeSave: false });

  try {
    const sent = await sendEmail(user.email, 'SmartBiz Email Verification', verificationEmailHtml(code));
    return { sent, code };
  } catch (err) {
    const demoCode = applyVerificationCode(user, DEMO_OTP);
    await user.save({ validateBeforeSave: false });
    console.log(`SmartBiz email send failed for ${user.email}. Falling back to demo OTP ${DEMO_OTP}.`);
    console.log("EMAIL ERROR DETAILS:", err);
    return { sent: false, code: demoCode, emailError: err.message };
  }
};

// REGISTER WITH EMAIL VERIFICATION CODE
router.post('/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'manager', 'staff']).withMessage('Invalid role')
], async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      role: 'staff'
    });

    const otpResult = await sendVerificationCode(user);

    res.status(201).json({
      message: otpResult.sent
        ? 'Account created. Please verify your email using the verification code.'
        : `Account created. Demo OTP: ${DEMO_OTP}`,
      requiresVerification: true,
      demoOtp: otpResult.sent ? undefined : DEMO_OTP,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    console.error('REGISTER ERROR:', err);

res.status(500).json({
  message: 'Registration failed',
  error: err.message
});
  }
});

// VERIFY EMAIL CODE
router.post('/verify-email', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('code').notEmpty().withMessage('Verification code required')
], async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, code } = req.body;

    const user = await User.findOne({
      email,
      verificationCode: String(code).trim(),
      verificationCodeExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification code.'
      });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;

    await user.save({ validateBeforeSave: false });

    res.json({
      message: 'Email verified successfully. You can now login.'
    });
  } catch (err) {
    res.status(500).json({
      message: 'Email verification failed',
      error: err.message
    });
  }
});

// LOGIN ONLY AFTER EMAIL VERIFIED
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      const otpResult = await sendVerificationCode(user);
      return res.status(403).json({
        message: otpResult.sent
          ? 'Please verify your email before login. A new OTP has been sent.'
          : `Please verify your email before login. Demo OTP: ${DEMO_OTP}`,
        requiresVerification: true,
        email: user.email,
        demoOtp: otpResult.sent ? undefined : DEMO_OTP
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account deactivated. Contact administrator.' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});



// RESEND EMAIL VERIFICATION CODE
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required')
], async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    if (user.isVerified) {
      return res.json({ message: 'This account is already verified.' });
    }

    const otpResult = await sendVerificationCode(user);

    res.json({
      message: otpResult.sent
        ? 'A new verification OTP has been sent.'
        : `Demo OTP: ${DEMO_OTP}`,
      demoOtp: otpResult.sent ? undefined : DEMO_OTP
    });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to resend verification code',
      error: err.message
    });
  }
});

// FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: 'No account found with this email.'
      });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

    await user.save();

    await sendEmail(
  email,
  'SmartBiz Password Reset',
  `
    <div style="font-family: Arial; padding: 30px;">
      <h2 style="color:#ef4444;">
        SmartBiz Password Reset
      </h2>

      <p>
        We received a request to reset your password.
      </p>

      <p>
        Your password reset code is:
      </p>

      <div style="
        font-size:32px;
        font-weight:bold;
        letter-spacing:8px;
        color:#111827;
        margin:20px 0;
      ">
        ${resetCode}
      </div>

      <p>
        This code will expire in 10 minutes.
      </p>
    </div>
  `
);

    res.json({
      message: 'Password reset code generated successfully.'
    });
  } catch (err) {
    res.status(500).json({
      message: 'Forgot password failed',
      error: err.message
    });
  }
});

// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired reset code.'
      });
    }

    user.password = newPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({
      message: 'Password reset successful.'
    });
  } catch (err) {
    res.status(500).json({
      message: 'Password reset failed',
      error: err.message
    });
  }
});

router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password -verificationCode -resetPasswordCode').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Could not load users.' });
  }
});

router.put('/users/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;

    if (!['admin', 'manager', 'staff'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role selected.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password -verificationCode -resetPasswordCode');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'User role updated successfully.', user });
  } catch (error) {
    res.status(500).json({ message: 'Could not update user role.' });
  }
});

module.exports = router;
