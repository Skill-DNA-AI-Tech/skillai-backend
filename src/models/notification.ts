import mongoose, { Schema } from 'mongoose';

const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['system', 'learning', 'job', 'report', 'interview', 'community'],
    default: 'system',
  },
  read: { type: Boolean, default: false },
  actionUrl: { type: String, default: '' },
}, { timestamps: true, collection: 'notifications' });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
