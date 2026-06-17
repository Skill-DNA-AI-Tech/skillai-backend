import mongoose, { Schema } from 'mongoose';

const reportViewSchema = new Schema({
  report: { type: Schema.Types.ObjectId, ref: 'Report', required: true, index: true },
  verificationId: { type: String, required: true, index: true },
  recruiterEmail: { type: String, default: '' },
  company: { type: String, default: '' },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  token: { type: String, default: '' },
}, { timestamps: true, collection: 'report_views' });

const ReportView = mongoose.models.ReportView || mongoose.model('ReportView', reportViewSchema);
export default ReportView;
