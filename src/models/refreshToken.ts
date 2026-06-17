import mongoose, { Schema } from 'mongoose';

const refreshTokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date },
  createdByIp: { type: String, default: '' },
}, { timestamps: true, collection: 'refresh_tokens' });

const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
