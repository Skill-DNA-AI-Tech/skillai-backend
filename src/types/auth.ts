import { Request } from 'express';

export const CANONICAL_USER_ROLES = [
  'MAIN_ADMIN',
  'ADMIN',
  'HR',
  'STUDENT',
  'SUPPORT_TEAM',
  'RECRUITER',
  'INTERVIEW_COACH',
  'SALES_TEAM',
] as const;

export const LEGACY_USER_ROLES = ['student', 'recruiter', 'admin', 'employee', 'staff'] as const;

export const ACTIVE_ASSIGNABLE_ROLES = ['ADMIN', 'HR', 'STUDENT'] as const;
export const FUTURE_USER_ROLES = ['SUPPORT_TEAM', 'RECRUITER', 'INTERVIEW_COACH', 'SALES_TEAM'] as const;
export const USER_STATUSES = ['PENDING', 'ACTIVE', 'DISABLED', 'REJECTED'] as const;

export type CanonicalUserRole = typeof CANONICAL_USER_ROLES[number];
export type LegacyUserRole = typeof LEGACY_USER_ROLES[number];
export type UserRole = CanonicalUserRole | LegacyUserRole;
export type UserStatus = typeof USER_STATUSES[number];

export interface AuthRequest extends Request {
  user?: any;
}
