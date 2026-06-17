import mongoose, { Schema } from 'mongoose';

const jobSchema = new Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
  type: {
    type: String,
    enum: ['Full-time', 'Internship', 'Remote', 'Freelance', 'Research', 'Campus'],
    default: 'Full-time',
  },
  domain: { type: String, required: true },
  field: { type: String, default: '' },
  description: { type: String, required: true },
  skills: { type: [String], default: [] },
  certifications: { type: [String], default: [] },
  minSkillDNAScore: { type: Number, default: 0 },
  minInterviewScore: { type: Number, default: 0 },
  location: { type: String, default: 'Remote' },
  salaryRange: { type: String, default: 'Negotiable' },
  experienceLevel: { type: String, default: 'Entry' },
  applicationDeadline: { type: Date },
  status: { type: String, enum: ['draft', 'open', 'closed'], default: 'open' },
  postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, collection: 'jobs' });

jobSchema.index({ title: 'text', company: 'text', domain: 'text', skills: 'text' });
jobSchema.index({ domain: 1, type: 1, status: 1 });

const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);
export default Job;
