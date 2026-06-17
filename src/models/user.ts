import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { CANONICAL_USER_ROLES, LEGACY_USER_ROLES, USER_STATUSES, UserRole, UserStatus } from '../types/auth';
import { normalizeRole } from '../utils/rbac';

export interface IUser extends Document {
  name: string;
  full_name?: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  approved_by?: mongoose.Types.ObjectId;
  approved_at?: Date;
  disabled_at?: Date;
  mobile?: string;
  avatarUrl?: string;
  googleId?: string;
  microsoftId?: string;
  emailVerified: boolean;
  requiresPasswordChange?: boolean;
  otp?: {
    codeHash?: string;
    expiresAt?: Date;
  };
  signatureBase64?: string;
  matchPassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  full_name: { type: String, alias: 'fullName' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: {
    type: String,
    required: function requiredPassword(this: any) {
      return !this.googleId && !this.microsoftId;
    },
  },
  role: {
    type: String,
    enum: [...CANONICAL_USER_ROLES, ...LEGACY_USER_ROLES],
    default: 'STUDENT',
  },
  status: { type: String, enum: USER_STATUSES, default: 'ACTIVE', index: true },
  approved_by: { type: Schema.Types.ObjectId, ref: 'User', alias: 'approvedBy' },
  approved_at: { type: Date, alias: 'approvedAt' },
  disabled_at: { type: Date, alias: 'disabledAt' },
  mobile: { type: String },
  avatarUrl: { type: String },
  googleId: { type: String },
  microsoftId: { type: String },
  emailVerified: { type: Boolean, default: false },
  requiresPasswordChange: { type: Boolean, default: false },
  otp: {
    codeHash: { type: String },
    expiresAt: { type: Date },
  },
  signatureBase64: { type: String },
}, { timestamps: true, collection: 'users' });

userSchema.pre('validate', function (next) {
  this.email = this.email?.trim().toLowerCase();
  this.role = normalizeRole(this.role, this.email);

  if (!this.full_name && this.name) {
    this.full_name = this.name;
  }

  if (!this.name && this.full_name) {
    this.name = this.full_name;
  }

  if (this.role === 'MAIN_ADMIN') {
    this.status = 'ACTIVE';
  }

  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  if (this.password) {
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

userSchema.methods.matchPassword = async function (candidatePassword: string) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);
export default User;
