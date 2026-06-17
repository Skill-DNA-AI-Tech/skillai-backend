import { CanonicalUserRole, FUTURE_USER_ROLES, UserRole } from '../types/auth';

const defaultMainAdminEmail = 'skilldnaai@ai.com';

export const getMainAdminEmails = () =>
  (process.env.MAIN_ADMIN_EMAILS ?? defaultMainAdminEmail)
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const isMainAdminEmail = (email?: string) => {
  if (!email) return false;
  return getMainAdminEmails().includes(email.trim().toLowerCase());
};

export const normalizeRole = (role?: string | null, email?: string): CanonicalUserRole => {
  if (isMainAdminEmail(email)) {
    return 'MAIN_ADMIN';
  }

  const original = (role ?? '').trim();
  const upper = original.toUpperCase();

  if (original === 'student' || upper === 'STUDENT') return 'STUDENT';
  if (original === 'admin' || original === 'employee' || original === 'staff' || upper === 'ADMIN') return 'ADMIN';
  if (original === 'recruiter' || upper === 'HR') return 'HR';
  if (upper === 'MAIN_ADMIN') return 'MAIN_ADMIN';
  if (upper === 'SUPPORT_TEAM') return 'SUPPORT_TEAM';
  if (upper === 'RECRUITER') return 'RECRUITER';
  if (upper === 'INTERVIEW_COACH') return 'INTERVIEW_COACH';
  if (upper === 'SALES_TEAM') return 'SALES_TEAM';

  return 'STUDENT';
};

const expandAllowedRole = (role: UserRole | string): CanonicalUserRole[] => {
  const normalized = normalizeRole(String(role));

  if (normalized === 'ADMIN') {
    return ['MAIN_ADMIN', 'ADMIN'];
  }

  return [normalized];
};

export const roleIsAllowed = (actualRole: string | undefined, email: string | undefined, allowedRoles: Array<UserRole | string>) => {
  const actual = normalizeRole(actualRole, email);
  const allowed = new Set(allowedRoles.flatMap(expandAllowedRole));
  return allowed.has(actual);
};

export const isFutureRole = (role: string) => FUTURE_USER_ROLES.includes(normalizeRole(role) as any);

export const isAdminRole = (role: string | undefined, email?: string) =>
  ['MAIN_ADMIN', 'ADMIN'].includes(normalizeRole(role, email));

export const isHiringRole = (role: string | undefined, email?: string) =>
  ['MAIN_ADMIN', 'ADMIN', 'HR'].includes(normalizeRole(role, email));

export const displayRole = (role: string | undefined, email?: string) => {
  const normalized = normalizeRole(role, email);

  const labels: Record<CanonicalUserRole, string> = {
    MAIN_ADMIN: 'Main Admin',
    ADMIN: 'Admin',
    HR: 'HR',
    STUDENT: 'Student',
    SUPPORT_TEAM: 'Support Team',
    RECRUITER: 'Recruiter',
    INTERVIEW_COACH: 'Interview Coach',
    SALES_TEAM: 'Sales Team',
  };

  return labels[normalized];
};
