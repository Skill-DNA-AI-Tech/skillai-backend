import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedback extends Document {
  user?: mongoose.Types.ObjectId;
  name: string;
  email: string;
  category: string;
  message: string;
  rating?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  email: { type: String, required: true },
  category: { type: String, required: true, default: 'suggestion' },
  message: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
  status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED'], default: 'PENDING' }
}, {
  timestamps: true,
  collection: 'feedbacks'
});

const Feedback = mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', FeedbackSchema);
export default Feedback;
