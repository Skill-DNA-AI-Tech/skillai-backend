import mongoose, { Schema, Document } from 'mongoose';

export interface IContentRequest extends Document {
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  studentEmail: string;
  career?: string;
  domain: string;
  topic: string;
  subtopic: string;
  notes?: string;
  status: 'PENDING' | 'FULFILLED' | 'REJECTED';
  fulfilledByNoteId?: mongoose.Types.ObjectId;
  adminRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contentRequestSchema = new Schema<IContentRequest>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true, lowercase: true, trim: true },
    career: { type: String, default: '' },
    domain: { type: String, required: true, index: true },
    topic: { type: String, required: true, index: true },
    subtopic: { type: String, required: true, index: true },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'FULFILLED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    fulfilledByNoteId: { type: Schema.Types.ObjectId, ref: 'TopicNote' },
    adminRemarks: { type: String, default: '' },
  },
  { timestamps: true, collection: 'content_requests' }
);

contentRequestSchema.index({ domain: 1, topic: 1, subtopic: 1, status: 1 });
contentRequestSchema.index({ createdAt: -1 });

const ContentRequest =
  mongoose.models.ContentRequest ||
  mongoose.model<IContentRequest>('ContentRequest', contentRequestSchema);

export default ContentRequest;
