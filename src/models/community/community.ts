import mongoose, { Schema } from 'mongoose';

const mentorSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  domain: { type: String, required: true },
  expertise: { type: [String], default: [] },
  bio: { type: String, default: '' },
  hourlyRate: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  availableSlots: { type: [Date], default: [] },
}, { timestamps: true, collection: 'mentors' });

const bookingSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mentor: { type: Schema.Types.ObjectId, ref: 'Mentor', required: true },
  startsAt: { type: Date, required: true },
  status: { type: String, enum: ['requested', 'confirmed', 'completed', 'cancelled'], default: 'requested' },
  meetingUrl: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true, collection: 'bookings' });

const communitySchema = new Schema({
  name: { type: String, required: true },
  domain: { type: String, required: true },
  description: { type: String, default: '' },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  moderators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true, collection: 'communities' });

const postSchema = new Schema({
  community: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  tags: { type: [String], default: [] },
  upvotes: { type: Number, default: 0 },
}, { timestamps: true, collection: 'posts' });

const commentSchema = new Schema({
  post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true },
}, { timestamps: true, collection: 'comments' });

mentorSchema.index({ name: 'text', domain: 'text', expertise: 'text' });
postSchema.index({ title: 'text', body: 'text', tags: 'text' });

export const Mentor = mongoose.models.Mentor || mongoose.model('Mentor', mentorSchema);
export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
export const Community = mongoose.models.Community || mongoose.model('Community', communitySchema);
export const Post = mongoose.models.Post || mongoose.model('Post', postSchema);
export const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
