import mongoose, { Schema } from 'mongoose';

const adminAuditSchema = new Schema({
  admin: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entity: { type: String, default: '' },
  entityId: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: 'admins' });

const AdminAudit = mongoose.models.AdminAudit || mongoose.model('AdminAudit', adminAuditSchema);
export default AdminAudit;
