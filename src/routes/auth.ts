import express from 'express';
import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import User from '../models/user';
import generateToken from '../utils/generateToken';
import { protect, AuthRequest } from '../middleware/auth';
import { sendOtpEmail } from '../services/email';
import { createRefreshToken, revokeRefreshToken, verifyRefreshToken } from '../utils/refreshToken';
import { isFutureRole, normalizeRole } from '../utils/rbac';
import { writeAuditLog } from '../utils/audit';

const router = express.Router();

const hashOtp = (otp: string) => crypto.createHash('sha256').update(otp).digest('hex');
const createOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const normalizeEmail = (email?: string) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const sanitizeUser = (user: any) => ({
  _id: user._id,
  name: user.name,
  full_name: user.full_name ?? user.name,
  email: user.email,
  role: normalizeRole(user.role, user.email),
  status: user.status ?? 'ACTIVE',
  approved_by: user.approved_by,
  mobile: user.mobile,
  avatarUrl: user.avatarUrl,
  emailVerified: user.emailVerified,
  requiresPasswordChange: user.requiresPasswordChange ?? false,
  isTestUser: user.isTestUser ?? false,
  isPreProductionUser: user.isPreProductionUser ?? false,
  betaAccess: user.betaAccess ?? false,
  careerDomain: user.careerDomain,
  targetRole: user.targetRole,
});

const authPayload = async (user: any, ip = '') => ({
  ...sanitizeUser(user),
  token: generateToken(user._id.toString()),
  refreshToken: await createRefreshToken(user._id.toString(), ip),
});

const ensureCanAuthenticate = (user: any, res: any) => {
  const role = normalizeRole(user.role, user.email);
  const status = user.status ?? 'ACTIVE';

  if (role === 'MAIN_ADMIN') {
    return true;
  }

  if (status === 'PENDING') {
    res.status(403).json({ message: 'This account is pending Main Admin approval' });
    return false;
  }

  if (status === 'REJECTED') {
    res.status(403).json({ message: 'This account request was rejected' });
    return false;
  }

  if (status === 'DISABLED') {
    res.status(403).json({ message: 'This account has been disabled' });
    return false;
  }

  return true;
};

import { env } from '../config/env';

router.post('/register', asyncHandler(async (req, res) => {
  if (env.registrationMode === 'ADMIN_ONLY') {
    res.status(403).json({
      message: 'Public registration is currently disabled for controlled testing. Please sign in using the test credentials provided by your Administrator.'
    });
    return;
  }

  const { name, email, password, role, mobile } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = normalizeRole(role, normalizedEmail);

  if (normalizedRole === 'MAIN_ADMIN') {
    res.status(403).json({ message: 'Main Admin accounts cannot be self-registered' });
    return;
  }

  if (normalizedRole === 'HR') {
    res.status(403).json({ message: 'HR accounts can only be created by an Admin' });
    return;
  }

  if (isFutureRole(normalizedRole)) {
    res.status(403).json({ message: 'This role is coming soon and is not assignable yet' });
    return;
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    res.status(400).json({ message: 'Email already registered' });
    return;
  }

  const otp = createOtp();
  const user = await User.create({
    name,
    full_name: name,
    email: normalizedEmail,
    password,
    role: normalizedRole,
    status: normalizedRole === 'ADMIN' ? 'PENDING' : 'ACTIVE',
    mobile,
    otp: {
      codeHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await sendOtpEmail(email, otp);

  if (normalizedRole === 'ADMIN') {
    await writeAuditLog(req, 'ADMIN_REGISTRATION_REQUESTED', 'User', user._id.toString(), { email: normalizedEmail });
    res.status(201).json({
      ...sanitizeUser(user),
      otpSent: true,
      message: 'Admin account created and is pending Main Admin approval.',
    });
    return;
  }

  res.status(201).json({ ...(await authPayload(user, req.ip)), otpSent: true });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: 'Email/User ID and password are required' });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const trimmed = String(email).trim();
  
  // Find by email or test user ID
  const user = await User.findOne({
    $or: [
      { email: normalizedEmail },
      { testUserId: trimmed },
      { testUserId: trimmed.toUpperCase() },
      { 'testCredentials.userId': trimmed },
    ]
  });

  if (user && (await user.matchPassword(password))) {
    if (!ensureCanAuthenticate(user, res)) return;

    user.role = normalizeRole(user.role, user.email);
    user.status = user.status ?? 'ACTIVE';
    await user.save();
    (req as any).user = user;
    await writeAuditLog(req, 'LOGIN', 'User', user._id.toString());
    res.json(await authPayload(user, req.ip));
  } else {
    res.status(401).json({ message: 'Invalid credentials. Please verify your email/User ID and password.' });
  }
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  res.json({ message: 'Logged out successfully' });
}));

router.post('/request-otp', asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    res.status(404).json({ message: 'No user found for this email' });
    return;
  }

  const otp = createOtp();
  user.otp = {
    codeHash: hashOtp(otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
  await user.save();
  await sendOtpEmail(email, otp);

  res.json({ message: 'OTP sent to email', expiresInMinutes: 10 });
}));

router.post('/verify-otp', asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user?.otp?.codeHash || !user.otp.expiresAt) {
    res.status(400).json({ message: 'No OTP request is active' });
    return;
  }

  const expired = user.otp.expiresAt.getTime() < Date.now();
  const matches = user.otp.codeHash === hashOtp(otp);

  if (expired || !matches) {
    res.status(400).json({ message: 'Invalid or expired OTP' });
    return;
  }

  user.emailVerified = true;
  user.otp = undefined;
  await user.save();

  if (!ensureCanAuthenticate(user, res)) return;

  res.json(await authPayload(user, req.ip));
}));

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    res.status(404).json({ message: 'No account found for this email' });
    return;
  }

  const otp = createOtp();
  user.otp = {
    codeHash: hashOtp(otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
  await user.save();
  await sendOtpEmail(normalizedEmail, otp);

  res.json({ message: 'Password reset OTP sent to email', expiresInMinutes: 10 });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    res.status(404).json({ message: 'No account found for this email' });
    return;
  }

  if (!user.otp?.codeHash || !user.otp.expiresAt) {
    res.status(400).json({ message: 'No password reset request is active' });
    return;
  }

  const expired = user.otp.expiresAt.getTime() < Date.now();
  const matches = user.otp.codeHash === hashOtp(otp);

  if (expired || !matches) {
    res.status(400).json({ message: 'Invalid or expired OTP' });
    return;
  }

  user.password = newPassword;
  user.otp = undefined;
  await user.save();

  res.json({ message: 'Password reset successfully' });
}));

router.post('/google', asyncHandler(async (req, res) => {
  const { email, name, googleId, avatarUrl, role = 'student' } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = normalizeRole(role, normalizedEmail);

  if (!normalizedEmail || !googleId) {
    res.status(400).json({ message: 'Google profile payload is required' });
    return;
  }

  if (normalizedRole === 'HR') {
    res.status(403).json({ message: 'HR accounts can only be created by an Admin' });
    return;
  }

  if (normalizedRole === 'MAIN_ADMIN' || isFutureRole(normalizedRole)) {
    res.status(403).json({ message: 'This role cannot be self-registered' });
    return;
  }

  let user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      name,
      full_name: name,
      googleId,
      avatarUrl,
      role: normalizedRole,
      status: normalizedRole === 'ADMIN' ? 'PENDING' : 'ACTIVE',
      emailVerified: true,
    });
  } else {
    user.googleId = googleId;
    user.avatarUrl = avatarUrl ?? user.avatarUrl;
    user.emailVerified = true;
    await user.save();
  }

  if (!ensureCanAuthenticate(user, res)) return;

  res.json(await authPayload(user, req.ip));
}));

router.post('/microsoft', asyncHandler(async (req, res) => {
  const { email, name, microsoftId, avatarUrl, role = 'student' } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = normalizeRole(role, normalizedEmail);

  if (!normalizedEmail || !microsoftId) {
    res.status(400).json({ message: 'Microsoft profile payload is required' });
    return;
  }

  if (normalizedRole === 'HR') {
    res.status(403).json({ message: 'HR accounts can only be created by an Admin' });
    return;
  }

  if (normalizedRole === 'MAIN_ADMIN' || isFutureRole(normalizedRole)) {
    res.status(403).json({ message: 'This role cannot be self-registered' });
    return;
  }

  let user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      name,
      full_name: name,
      microsoftId,
      avatarUrl,
      role: normalizedRole,
      status: normalizedRole === 'ADMIN' ? 'PENDING' : 'ACTIVE',
      emailVerified: true,
    });
  } else {
    user.microsoftId = microsoftId;
    user.avatarUrl = avatarUrl ?? user.avatarUrl;
    user.emailVerified = true;
    await user.save();
  }

  if (!ensureCanAuthenticate(user, res)) return;

  res.json(await authPayload(user, req.ip));
}));

router.post('/change-temp-password', protect, asyncHandler(async (req: AuthRequest, res) => {
  const { newPassword } = req.body;
  if (!newPassword) {
    res.status(400).json({ message: 'New password is required' });
    return;
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  user.password = newPassword;
  user.requiresPasswordChange = false;
  await user.save();

  res.json({ message: 'Password updated successfully', ...sanitizeUser(user) });
}));

router.get('/me', protect, asyncHandler(async (req: AuthRequest, res) => {
  res.json(sanitizeUser(req.user));
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ message: 'Refresh token is required' });
    return;
  }

  try {
    const { userId } = await verifyRefreshToken(refreshToken);
    const user = await User.findById(userId);

    if (!user) {
      res.status(401).json({ message: 'User not found for refresh token' });
      return;
    }

    if (!ensureCanAuthenticate(user, res)) return;

    res.json({
      ...sanitizeUser(user),
      token: generateToken(user._id.toString()),
      refreshToken,
    });
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  res.json({ message: 'Logged out successfully' });
}));

export default router;
