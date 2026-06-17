import { Request } from 'express';
import AuditLog from '../models/auditLog';
import { normalizeRole } from './rbac';

export const writeAuditLog = async (
  req: Request & { user?: any },
  action: string,
  entityType: string,
  entityId = '',
  metadata: Record<string, unknown> = {},
) => {
  try {
    await AuditLog.create({
      actor: req.user?._id,
      actorEmail: req.user?.email ?? '',
      actorRole: normalizeRole(req.user?.role, req.user?.email),
      action,
      entityType,
      entityId,
      metadata,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'] ?? '',
    });
  } catch (error) {
    console.error('[audit] Failed to write audit log:', error);
  }
};
