import mongoose, { Schema, Document } from 'mongoose';

export interface IStudentTopicProgress extends Document {
  studentId: mongoose.Types.ObjectId;
  career: string;
  domain: string;
  topic: string;
  subtopic: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'NEEDS_REVISION' | 'PASSED';
  mcqScore?: number;
  interviewScore?: number;
  highestScore: number;
  attempts: number;
  isMastered: boolean;
  lastAssessedAt?: Date;
  passedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const studentTopicProgressSchema = new Schema<IStudentTopicProgress>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    career: { type: String, required: true },
    domain: { type: String, required: true },
    topic: { type: String, required: true },
    subtopic: { type: String, required: true },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'NEEDS_REVISION', 'PASSED'],
      default: 'NOT_STARTED',
      index: true,
    },
    mcqScore: { type: Number, default: 0 },
    interviewScore: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    isMastered: { type: Boolean, default: false, index: true },
    lastAssessedAt: { type: Date },
    passedAt: { type: Date },
  },
  { timestamps: true, collection: 'student_topic_progress' }
);

studentTopicProgressSchema.index(
  { studentId: 1, domain: 1, topic: 1, subtopic: 1 },
  { unique: true }
);

const StudentTopicProgress =
  mongoose.models.StudentTopicProgress ||
  mongoose.model<IStudentTopicProgress>('StudentTopicProgress', studentTopicProgressSchema);

export default StudentTopicProgress;
