import mongoose, { Schema } from 'mongoose';

const auditLogSchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  actorEmail: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  action: { type: String, required: true, index: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
}, { timestamps: true, collection: 'audit_logs' });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
