import mongoose, { Schema, Document } from 'mongoose';

export interface ICareerChangeRequest extends Document {
  student: mongoose.Types.ObjectId;
  studentName: string;
  studentEmail: string;
  currentCareer: string;
  currentCurriculum: string;
  requestedCareer: string;
  requestedCurriculum: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedByName?: string;
  reviewedByRole?: string;
  reviewNotes?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const careerChangeRequestSchema = new Schema<ICareerChangeRequest>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true, lowercase: true, trim: true },
    currentCareer: { type: String, required: true },
    currentCurriculum: { type: String, required: true },
    requestedCareer: { type: String, required: true },
    requestedCurriculum: { type: String, required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedByName: { type: String },
    reviewedByRole: { type: String },
    reviewNotes: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true, collection: 'career_change_requests' }
);

careerChangeRequestSchema.index({ student: 1, status: 1 });
careerChangeRequestSchema.index({ createdAt: -1 });

const CareerChangeRequest =
  mongoose.models.CareerChangeRequest ||
  mongoose.model<ICareerChangeRequest>('CareerChangeRequest', careerChangeRequestSchema);

export default CareerChangeRequest;
