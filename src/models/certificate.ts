import mongoose, { Schema, Document } from 'mongoose';

export interface ICertificate extends Document {
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  email: string;
  careerPath: string;
  certificateId: string;
  issueDate: Date;
  expiryDate: Date;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  confidenceScore: number;
  overallScore: number;
  sessionsCompleted: number;
  interviewReadinessStatus: 'NOT_READY' | 'IN_PROGRESS' | 'READY' | 'ADVANCED';
  strengths: string[];
  improvements: string[];
  qrCode?: string;
  pdfUrl?: string;
  verificationUrl?: string;
  courseName?: string;
  sharedWith: Array<{
    recruiterId: mongoose.Types.ObjectId;
    recruiterEmail: string;
    sharedAt: Date;
  }>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  passStatus?: 'PASS' | 'FAIL';
  templateId?: string;
  assessmentId?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  issuedBy?: mongoose.Types.ObjectId;
  issuedByName?: string;
  adminSignatureBase64?: string;
  isActive: boolean;
}

const certificateSchema = new Schema<ICertificate>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: { type: String, required: true },
    email: { type: String, required: true },
    careerPath: { type: String, required: true },
    certificateId: { type: String, required: true, unique: true, index: true },
    issueDate: { type: Date, default: () => new Date() },
    expiryDate: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    technicalScore: { type: Number, required: true, min: 0, max: 100 },
    communicationScore: { type: Number, required: true, min: 0, max: 100 },
    problemSolvingScore: { type: Number, required: true, min: 0, max: 100 },
    confidenceScore: { type: Number, required: true, min: 0, max: 100 },
    overallScore: { type: Number, required: true, min: 0, max: 100 },
    sessionsCompleted: { type: Number, required: true, default: 0 },
    interviewReadinessStatus: {
      type: String,
      enum: ['NOT_READY', 'IN_PROGRESS', 'READY', 'ADVANCED'],
      default: 'IN_PROGRESS',
    },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
    qrCode: { type: String },
    pdfUrl: { type: String },
    verificationUrl: { type: String },
    courseName: { type: String },
    sharedWith: [
      {
        recruiterId: { type: Schema.Types.ObjectId, ref: 'User' },
        recruiterEmail: { type: String },
        sharedAt: { type: Date, default: () => new Date() },
      },
    ],
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    passStatus: {
      type: String,
      enum: ['PASS', 'FAIL'],
      default: 'PASS',
    },
    templateId: { type: String, default: 'template-01' },
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    issuedByName: { type: String },
    adminSignatureBase64: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'certificates' }
);

export default mongoose.model<ICertificate>('Certificate', certificateSchema);
