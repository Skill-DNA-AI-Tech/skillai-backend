import mongoose, { Schema } from 'mongoose';

const resumeAnalysisSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  profile: { type: Schema.Types.ObjectId, ref: 'Profile' },
  resumeUrl: { type: String, default: '' },
  rawText: { type: String, default: '' },
  atsScore: { type: Number, default: 0 },
  formattingScore: { type: Number, default: 0 },
  keywordRelevance: { type: [String], default: [] },
  projectQualityScore: { type: Number, default: 0 },
  certificationQualityScore: { type: Number, default: 0 },
  skillAlignmentScore: { type: Number, default: 0 },
  recruiterAttractivenessScore: { type: Number, default: 0 },
  suggestions: { type: [String], default: [] },
}, { timestamps: true, collection: 'resume_analysis' });

const ResumeAnalysis = mongoose.models.ResumeAnalysis || mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
export default ResumeAnalysis;
