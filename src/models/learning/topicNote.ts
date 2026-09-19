import mongoose, { Schema, Document } from 'mongoose';

export interface INoteResource {
  title: string;
  type: 'youtube' | 'udemy' | 'doc' | 'article' | 'external';
  url: string;
  description?: string;
}

export interface ITopicNote extends Document {
  career?: string;
  domain: string;
  topic: string;
  subtopic: string;
  title: string;
  overview: string;
  richText: string;
  keyTakeaways: string[];
  examples: string;
  resources: INoteResource[];
  status: 'Draft' | 'Published' | 'Archived';
  isAiGenerated: boolean;
  createdBy?: mongoose.Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const noteResourceSchema = new Schema<INoteResource>(
  {
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ['youtube', 'udemy', 'doc', 'article', 'external'],
      default: 'external',
    },
    url: { type: String, required: true },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const topicNoteSchema = new Schema<ITopicNote>(
  {
    career: { type: String, default: '' },
    domain: { type: String, required: true, index: true },
    topic: { type: String, required: true, index: true },
    subtopic: { type: String, required: true, index: true },
    title: { type: String, required: true },
    overview: { type: String, default: '' },
    richText: { type: String, default: '' },
    keyTakeaways: { type: [String], default: [] },
    examples: { type: String, default: '' },
    resources: { type: [noteResourceSchema], default: [] },
    status: {
      type: String,
      enum: ['Draft', 'Published', 'Archived'],
      default: 'Published',
      index: true,
    },
    isAiGenerated: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'topic_notes' }
);

topicNoteSchema.index({ domain: 1, topic: 1, subtopic: 1, status: 1 });
topicNoteSchema.index({ topic: 1, subtopic: 1 });

const TopicNote =
  mongoose.models.TopicNote || mongoose.model<ITopicNote>('TopicNote', topicNoteSchema);

export default TopicNote;
