import mongoose, { Schema } from 'mongoose';

const analyticsSchema = new Schema({
  views: { type: Number, default: 0 },
  completions: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
}, { _id: false });

const domainSchema = new Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'GraduationCap' },
  active: { type: Boolean, default: true },
}, { timestamps: true, collection: 'domains' });

const subjectSchema = new Schema({
  domain: { type: Schema.Types.ObjectId, ref: 'Domain', required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, { timestamps: true, collection: 'subjects' });

const courseSchema = new Schema({
  domain: { type: Schema.Types.ObjectId, ref: 'Domain', required: true },
  subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  title: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String, default: '' },
  level: { type: String, enum: ['foundation', 'intermediate', 'advanced'], default: 'foundation' },
  estimatedHours: { type: Number, default: 1 },
  tags: { type: [String], default: [] },
  published: { type: Boolean, default: false },
  analytics: { type: analyticsSchema, default: () => ({}) },
}, { timestamps: true, collection: 'courses' });

const lessonSchema = new Schema({
  domain: { type: Schema.Types.ObjectId, ref: 'Domain', required: true },
  subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  topic: { type: String, required: true },
  title: { type: String, required: true },
  lessonType: {
    type: String,
    enum: ['note', 'pdf', 'video', 'quiz', 'assignment', 'flashcard', 'interview-prep', 'career-guide', 'webinar'],
    default: 'note',
  },
  richText: { type: String, default: '' },
  mediaUrl: { type: String, default: '' },
  pdfUrl: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  durationMinutes: { type: Number, default: 10 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
  order: { type: Number, default: 0 },
  tags: { type: [String], default: [] },
  published: { type: Boolean, default: false },
  analytics: { type: analyticsSchema, default: () => ({}) },
}, { timestamps: true, collection: 'lessons' });

const questionSchema = new Schema({
  prompt: { type: String, required: true },
  options: { type: [String], default: [] },
  answer: { type: String, default: '' },
  explanation: { type: String, default: '' },
}, { _id: false });

const quizSchema = new Schema({
  lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
  title: { type: String, required: true },
  domain: { type: String, default: '' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
  questions: { type: [questionSchema], default: [] },
  timeLimitMinutes: { type: Number, default: 15 },
  published: { type: Boolean, default: false },
  analytics: { type: analyticsSchema, default: () => ({}) },
}, { timestamps: true, collection: 'quizzes' });

const assignmentSchema = new Schema({
  lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
  title: { type: String, required: true },
  instructions: { type: String, default: '' },
  rubric: { type: [String], default: [] },
  dueDays: { type: Number, default: 7 },
  published: { type: Boolean, default: false },
}, { timestamps: true, collection: 'assignments' });

const flashcardSchema = new Schema({
  lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
  front: { type: String, required: true },
  back: { type: String, required: true },
  tags: { type: [String], default: [] },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
}, { timestamps: true, collection: 'flashcards' });

const videoSchema = new Schema({
  lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
  title: { type: String, required: true },
  url: { type: String, required: true },
  durationSeconds: { type: Number, default: 0 },
  transcript: { type: String, default: '' },
}, { timestamps: true, collection: 'videos' });

const noteSchema = new Schema({
  lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
  title: { type: String, required: true },
  richText: { type: String, default: '' },
  attachments: { type: [String], default: [] },
}, { timestamps: true, collection: 'notes' });

const webinarSchema = new Schema({
  title: { type: String, required: true },
  domain: { type: String, default: '' },
  speaker: { type: String, default: '' },
  startsAt: { type: Date, required: true },
  meetingUrl: { type: String, default: '' },
  recordingUrl: { type: String, default: '' },
  capacity: { type: Number, default: 100 },
}, { timestamps: true, collection: 'webinars' });

subjectSchema.index({ domain: 1, slug: 1 }, { unique: true });
courseSchema.index({ subject: 1, slug: 1 }, { unique: true });
lessonSchema.index({ title: 'text', topic: 'text', tags: 'text' });

export const Domain = mongoose.models.Domain || mongoose.model('Domain', domainSchema);
export const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema);
export const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);
export const Lesson = mongoose.models.Lesson || mongoose.model('Lesson', lessonSchema);
export const Video = mongoose.models.Video || mongoose.model('Video', videoSchema);
export const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
export const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
export const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);
export const Flashcard = mongoose.models.Flashcard || mongoose.model('Flashcard', flashcardSchema);
export const Webinar = mongoose.models.Webinar || mongoose.model('Webinar', webinarSchema);
