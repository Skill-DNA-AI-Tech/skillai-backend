import { NextFunction, Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User from '../models/user';
import { env } from '../config/env';
import { AuthRequest, UserRole } from '../types/auth';
import { normalizeRole, roleIsAllowed } from '../utils/rbac';

export type { AuthRequest, UserRole } from '../types/auth';

import mongoose from 'mongoose';

type JwtPayload = {
  id?: string;
  sub?: string;
  email?: string;
  role?: string;
  name?: string;
};

const verifyTokenPayload = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch (primaryErr) {
    // If primary secret fails, fallback to shared FastAPI secret
    if (env.jwtSecret !== 'super_secret_jwt_key_skilldna') {
      try {
        return jwt.verify(token, 'super_secret_jwt_key_skilldna') as JwtPayload;
      } catch {
        // Ignore fallback error and throw below
      }
    }
    throw primaryErr;
  }
};

const resolveUserFromToken = async (decoded: JwtPayload) => {
  let user: any = null;

  if (decoded.id && mongoose.Types.ObjectId.isValid(decoded.id)) {
    user = await User.findById(decoded.id).select('-password -otp.codeHash');
  }

  const email = (decoded.sub || decoded.email || '').trim().toLowerCase();
  if (!user && email) {
    user = await User.findOne({ email }).select('-password -otp.codeHash');
    if (!user) {
      // Reconcile account from MongoDB admins collection
      const adminDoc = await mongoose.connection.collection('admins').findOne({ email });
      if (adminDoc) {
        user = await User.create({
          name: adminDoc.name || adminDoc.full_name || 'Main Administrator',
          full_name: adminDoc.full_name || adminDoc.name || 'Main Administrator',
          email: adminDoc.email,
          role: normalizeRole(adminDoc.role || decoded.role || 'MAIN_ADMIN', adminDoc.email),
          status: 'ACTIVE',
          emailVerified: true,
        });
      }
    }
  }

  return user;
};

export const protect = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : undefined;

  if (!token) {
    res.status(401).json({ message: 'Authentication token is required' });
    return;
  }

  try {
    const decoded = verifyTokenPayload(token);
    const user = await resolveUserFromToken(decoded);

    if (!user) {
      res.status(401).json({ message: 'User not found for token' });
      return;
    }

    user.role = normalizeRole(user.role || decoded.role, user.email);

    if (user.status === 'DISABLED') {
      res.status(403).json({ message: 'This account has been disabled' });
      return;
    }

    if (user.status === 'REJECTED') {
      res.status(403).json({ message: 'This account request was rejected' });
      return;
    }

    if (user.status === 'PENDING') {
      res.status(403).json({ message: 'This account is pending Main Admin approval' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

export const optionalProtect = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : undefined;

  if (!token || token === 'demo-token') {
    return next();
  }

  try {
    const decoded = verifyTokenPayload(token);
    const user = await resolveUserFromToken(decoded);
    if (user && user.status === 'ACTIVE') {
      user.role = normalizeRole(user.role || decoded.role, user.email);
      req.user = user;
    }
  } catch {
    // Proceed without authenticated user
  }
  next();
});

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roleIsAllowed(req.user.role, req.user.email, roles)) {
      res.status(403).json({ message: 'You do not have permission for this action' });
      return;
    }

    next();
  };
};
