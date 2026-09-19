import mongoose, { Schema, Document } from 'mongoose';

export interface IAssessmentCompetencies {
  technicalKnowledge: number;
  communication: number;
  problemSolving: number;
  confidence: number;
  clarity: number;
}

export interface IAssessmentTopicBreakdown {
  topic: string;
  score: number;
  questionsCount: number;
  correctCount: number;
}

export interface IAssessmentRecommendation {
  title: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedModule?: string;
}

export interface IAssessment extends Document {
  studentId: mongoose.Types.ObjectId;
  assessmentType: 'MCQ' | 'INTERVIEW';
  careerDomain: string;
  targetRole: string;
  overallScore: number;
  passStatus: 'PASS' | 'FAIL';
  passingScore: number;
  competencies: IAssessmentCompetencies;
  topicBreakdown: IAssessmentTopicBreakdown[];
  strengths: string[];
  weakTopics: string[];
  knowledgeGaps: string[];
  recommendedLearning: IAssessmentRecommendation[];
  questionsAnswered: number;
  totalQuestions: number;
  answers: any[];
  attemptNumber: number;
  verified: boolean;
  verifiedAt: Date;
  certificateEligible: boolean;
  certificateClaimed: boolean;
  certificateId?: string;
  visualAnalytics?: {
    faceDetectedPercent: number;
    cameraFacingPercent: number;
    lookingAwayPercent: number;
    multipleFaceEvents: number;
    behaviorStatus: string;
  };
  audioAnalytics?: {
    audioQualityStatus: string;
    averageConfidence: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const assessmentSchema = new Schema<IAssessment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assessmentType: { type: String, enum: ['MCQ', 'INTERVIEW'], required: true, index: true },
    careerDomain: { type: String, required: true, index: true },
    targetRole: { type: String, required: true },
    overallScore: { type: Number, required: true, min: 0, max: 100 },
    passStatus: { type: String, enum: ['PASS', 'FAIL'], required: true, index: true },
    passingScore: { type: Number, default: 75 },
    competencies: {
      technicalKnowledge: { type: Number, default: 0, min: 0, max: 100 },
      communication: { type: Number, default: 0, min: 0, max: 100 },
      problemSolving: { type: Number, default: 0, min: 0, max: 100 },
      confidence: { type: Number, default: 0, min: 0, max: 100 },
      clarity: { type: Number, default: 0, min: 0, max: 100 },
    },
    topicBreakdown: [
      {
        topic: { type: String, required: true },
        score: { type: Number, required: true },
        questionsCount: { type: Number, default: 1 },
        correctCount: { type: Number, default: 0 },
      },
    ],
    strengths: [{ type: String }],
    weakTopics: [{ type: String }],
    knowledgeGaps: [{ type: String }],
    recommendedLearning: [
      {
        title: { type: String, required: true },
        reason: { type: String, default: '' },
        priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
        recommendedModule: { type: String },
      },
    ],
    questionsAnswered: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    answers: [{ type: Schema.Types.Mixed }],
    attemptNumber: { type: Number, default: 1 },
    verified: { type: Boolean, default: true },
    verifiedAt: { type: Date, default: () => new Date() },
    certificateEligible: { type: Boolean, default: false },
    certificateClaimed: { type: Boolean, default: false },
    certificateId: { type: String },
    visualAnalytics: {
      faceDetectedPercent: { type: Number, default: 100 },
      cameraFacingPercent: { type: Number, default: 100 },
      lookingAwayPercent: { type: Number, default: 0 },
      multipleFaceEvents: { type: Number, default: 0 },
      behaviorStatus: { type: String, default: 'NORMAL' },
    },
    audioAnalytics: {
      audioQualityStatus: { type: String, default: 'ACCEPTABLE' },
      averageConfidence: { type: Number, default: 0.9 },
    },
  },
  { timestamps: true, collection: 'assessments' }
);

assessmentSchema.pre('save', function (next) {
  this.passStatus = this.overallScore >= 75 ? 'PASS' : 'FAIL';
  this.certificateEligible = this.overallScore >= 75;
  next();
});

export default mongoose.models.Assessment || mongoose.model<IAssessment>('Assessment', assessmentSchema);
