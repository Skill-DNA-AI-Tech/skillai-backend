import mongoose, { Schema } from 'mongoose';

const scoreItemSchema = new Schema(
  {
    label: { type: String, default: '' },
    value: { type: Number, default: 0 },
  },
  { _id: false },
);

const interviewHistorySchema = new Schema(
  {
    label: { type: String, default: '' },
    sessionId: { type: String, default: '' },
    score: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    completedAt: { type: Date },
  },
  { _id: false },
);

const jobReadinessSchema = new Schema(
  {
    role: { type: String, default: '' },
    readiness: { type: Number, default: 0 },
    missing: { type: [String], default: [] },
    matchedStrengths: { type: [String], default: [] },
  },
  { _id: false },
);

const taskSchema = new Schema(
  {
    type: { type: String, default: '' },
    title: { type: String, default: '' },
    minutes: { type: Number, default: 0 },
  },
  { _id: false },
);

const dynamicInterviewSchema = new Schema(
  {
    currentDifficulty: { type: String, default: '' },
    nextDifficulty: { type: String, default: '' },
    followUpQuestion: { type: String, default: '' },
    personalizedQuestion: { type: String, default: '' },
    reason: { type: String, default: '' },
    latestQuestion: { type: String, default: '' },
    latestAnswerPreview: { type: String, default: '' },
  },
  { _id: false },
);

const careerTwinMemorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    overallScore: { type: Number, default: 0 },
    technicalScore: { type: Number, default: 0 },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    confidence: { type: Number, default: 0 },
    communicationQuality: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 },
    interviewHistory: { type: [interviewHistorySchema], default: [] },
    jobReadiness: { type: [jobReadinessSchema], default: [] },
    dailyTasks: { type: [taskSchema], default: [] },
    improvementTimeline: {
      items: { type: [interviewHistorySchema], default: [] },
      improvement: { type: Number, default: 0 },
    },
    mentorSuggestions: { type: [String], default: [] },
    skillGaps: { type: [String], default: [] },
    recommendations: { type: [taskSchema], default: [] },
    dynamicInterview: { type: dynamicInterviewSchema, default: () => ({}) },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'career_twin_memories' },
);

careerTwinMemorySchema.index({ overallScore: -1 });
careerTwinMemorySchema.index({ generatedAt: -1 });

const CareerTwinMemory =
  mongoose.models.CareerTwinMemory || mongoose.model('CareerTwinMemory', careerTwinMemorySchema);

export default CareerTwinMemory;
