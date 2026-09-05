import { NextFunction, Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User from '../models/user';
import { env } from '../config/env';
import { AuthRequest, UserRole } from '../types/auth';
import { normalizeRole, roleIsAllowed } from '../utils/rbac';

export type { AuthRequest, UserRole } from '../types/auth';

type JwtPayload = {
  id: string;
};

export const protect = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : undefined;

  if (!token) {
    res.status(401).json({ message: 'Authentication token is required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    const user = await User.findById(decoded.id).select('-password -otp.codeHash');

    if (!user) {
      res.status(401).json({ message: 'User not found for token' });
      return;
    }

    user.role = normalizeRole(user.role, user.email);

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
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    const user = await User.findById(decoded.id).select('-password -otp.codeHash');
    if (user && user.status === 'ACTIVE') {
      user.role = normalizeRole(user.role, user.email);
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
