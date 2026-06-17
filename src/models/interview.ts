import mongoose, { Schema } from 'mongoose';

const interviewQuestionSchema = new Schema({
  domain: { type: String, required: true },
  type: {
    type: String,
    enum: ['HR', 'Technical', 'Behavioral', 'Domain', 'Aptitude', 'Group Discussion'],
    required: true,
  },
  prompt: { type: String, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  expectedKeywords: { type: [String], default: [] },
}, { timestamps: true, collection: 'interview_questions' });

const interviewScoreSchema = new Schema({
  interviewScore: { type: Number, default: 0 },
  communicationScore: { type: Number, default: 0 },
  confidenceScore: { type: Number, default: 0 },
  technicalDepthScore: { type: Number, default: 0 },
  bodyLanguageScore: { type: Number, default: 0 },
  eyeContactScore: { type: Number, default: 0 },
  speakingClarityScore: { type: Number, default: 0 },
  grammarScore: { type: Number, default: 0 },
  hesitationScore: { type: Number, default: 0 },
  voiceConfidenceScore: { type: Number, default: 0 },
  tips: { type: [String], default: [] },
  improvementRoadmap: { type: [String], default: [] },
}, { timestamps: true, collection: 'interview_scores' });

const interviewSessionSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  profile: { type: Schema.Types.ObjectId, ref: 'Profile' },
  type: {
    type: String,
    enum: ['HR', 'Technical', 'Behavioral', 'Domain', 'Aptitude', 'Group Discussion'],
    required: true,
  },
  domain: { type: String, default: '' },
  status: { type: String, enum: ['scheduled', 'in-progress', 'completed'], default: 'scheduled' },
  transcript: { type: String, default: '' },
  durationSeconds: { type: Number, default: 0 },
  mediaUrl: { type: String, default: '' },
  realtimeFeedback: { type: [String], default: [] },
  score: { type: Schema.Types.ObjectId, ref: 'InterviewScore' },
  scheduledAt: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true, collection: 'interview_sessions' });

interviewQuestionSchema.index({ domain: 1, type: 1 });

export const InterviewQuestion = mongoose.models.InterviewQuestion || mongoose.model('InterviewQuestion', interviewQuestionSchema);
export const InterviewScore = mongoose.models.InterviewScore || mongoose.model('InterviewScore', interviewScoreSchema);
export const InterviewSession = mongoose.models.InterviewSession || mongoose.model('InterviewSession', interviewSessionSchema);
