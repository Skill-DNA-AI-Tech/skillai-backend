import mongoose, { Schema } from 'mongoose';

const companySchema = new Schema({
  name: { type: String, required: true },
  website: { type: String, default: '' },
  industry: { type: String, default: '' },
  size: { type: String, default: '' },
  location: { type: String, default: '' },
  description: { type: String, default: '' },
  recruiters: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  verified: { type: Boolean, default: false },
}, { timestamps: true, collection: 'companies' });

companySchema.index({ name: 'text', industry: 'text' });

const Company = mongoose.models.Company || mongoose.model('Company', companySchema);
export default Company;
