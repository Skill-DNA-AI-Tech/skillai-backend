import mongoose, { Schema } from 'mongoose';

const applicationSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  profile: { type: Schema.Types.ObjectId, ref: 'Profile' },
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  resumeUrl: { type: String, default: '' },
  report: { type: Schema.Types.ObjectId, ref: 'Report' },
  status: {
    type: String,
    enum: ['applied', 'viewed', 'shortlisted', 'interviewing', 'offered', 'rejected'],
    default: 'applied',
  },
  matchScore: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true, collection: 'applications' });

const shortlistSchema = new Schema({
  recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  company: { type: Schema.Types.ObjectId, ref: 'Company' },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  profile: { type: Schema.Types.ObjectId, ref: 'Profile' },
  job: { type: Schema.Types.ObjectId, ref: 'Job' },
  interviewAt: { type: Date },
  notes: { type: String, default: '' },
}, { timestamps: true, collection: 'shortlists' });

const jobMatchSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  profile: { type: Schema.Types.ObjectId, ref: 'Profile' },
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  matchScore: { type: Number, default: 0 },
  matchingSkills: { type: [String], default: [] },
  matchingCertifications: { type: [String], default: [] },
  communicationFit: { type: Number, default: 0 },
  interviewFit: { type: Number, default: 0 },
  missingSkills: { type: [String], default: [] },
  explanation: { type: [String], default: [] },
  improvementRoadmap: { type: [String], default: [] },
}, { timestamps: true, collection: 'job_matches' });

export const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);
export const Shortlist = mongoose.models.Shortlist || mongoose.model('Shortlist', shortlistSchema);
export const JobMatch = mongoose.models.JobMatch || mongoose.model('JobMatch', jobMatchSchema);
