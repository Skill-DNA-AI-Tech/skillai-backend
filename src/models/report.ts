import mongoose, { Schema } from 'mongoose';

const shareTokenSchema = new Schema({
  token: { type: String, required: true },
  recruiterEmail: { type: String, required: true },
  company: { type: String, default: '' },
  expiresAt: { type: Date, required: true },
  viewedAt: { type: Date },
}, { _id: false });

const reportSchema = new Schema({
  profile: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User' },
  studentSnapshot: {
    name: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    college: { type: String, default: '' },
    field: { type: String, default: '' },
  },
  verified: { type: Boolean, default: true },
  badge: { type: String, enum: ['Bronze', 'Silver', 'Gold', 'Platinum'], default: 'Bronze' },
  salaryEstimate: { type: String, default: 'TBD' },
  skillDNAScore: { type: Number, default: 0 },
  interviewScore: { type: Number, default: 0 },
  communicationScore: { type: Number, default: 0 },
  confidenceScore: { type: Number, default: 0 },
  technicalScore: { type: Number, default: 0 },
  projectsScore: { type: Number, default: 0 },
  certificationScore: { type: Number, default: 0 },
  strengths: { type: [String], default: [] },
  weaknesses: { type: [String], default: [] },
  recommendedRoles: { type: [String], default: [] },
  aiRecommendationSummary: { type: String, default: '' },
  qrPayload: { type: String, default: '' },
  verificationId: { type: String, required: true, unique: true },
  publicUrl: { type: String, required: true },
  shareTokens: { type: [shareTokenSchema], default: [] },
  analytics: {
    totalViews: { type: Number, default: 0 },
    recruiterViews: { type: Number, default: 0 },
  },
}, { timestamps: true, collection: 'reports' });

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);
export default Report;
