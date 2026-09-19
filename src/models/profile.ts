import mongoose, { Schema } from 'mongoose';

const projectSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  domain: { type: String, default: '' },
  impact: { type: String, default: '' },
  url: { type: String, default: '' },
}, { _id: false });

const academicMarkSchema = new Schema({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  max: { type: Number, default: 100 },
}, { _id: false });

const skillEvidenceSchema = new Schema({
  skill: { type: String, required: true },
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
  evidence: { type: String, default: 'interview' },
  verifiedAt: { type: Date, default: Date.now },
  trend: { type: String, enum: ['improving', 'steady', 'declining'], default: 'steady' },
  attempts: { type: Number, default: 1 },
}, { _id: false });

const scoreSchema = new Schema({
  score: { type: Number, default: 0 },
  strengths: { type: [String], default: [] },
  weaknesses: { type: [String], default: [] },
  communicationScore: { type: Number, default: 0 },
  technicalScore: { type: Number, default: 0 },
  confidenceScore: { type: Number, default: 0 },
  aptitudeScore: { type: Number, default: 0 },
  projectsScore: { type: Number, default: 0 },
  certificationScore: { type: Number, default: 0 },
  placementReadinessScore: { type: Number, default: 0 },
  careerPathSuggestions: { type: [String], default: [] },
  salaryRangeEstimate: { type: String, default: 'TBD' },
  badge: { type: String, enum: ['Bronze', 'Silver', 'Gold', 'Platinum'], default: 'Bronze' },
  evidenceMatrix: { type: [skillEvidenceSchema], default: [] },
  lastAssessedAt: { type: Date },
}, { _id: false });

const profileSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  mobile: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  degree: { type: String, required: true },
  branch: { type: String, required: true },
  specialization: { type: String, default: '' },
  college: { type: String, required: true },
  semester: { type: String, required: true },
  academicMarks: { type: String, default: '' },
  academicBreakdown: { type: [academicMarkSchema], default: [] },
  certifications: { type: [String], default: [] },
  projects: { type: [projectSchema], default: [] },
  skills: { type: [String], default: [] },
  interests: { type: [String], default: [] },
  communicationLevel: { type: Number, default: 0 },
  aptitudeLevel: { type: Number, default: 0 },
  resumeUrl: { type: String, default: '' },
  domain: { type: String, default: '' },
  preferredRoles: { type: [String], default: [] },
  portfolioLinks: { type: [String], default: [] },
  location: { type: String, default: '' },
  bio: { type: String, default: '' },
  career: { type: String, default: '' },
  activeCurriculum: {
    curriculumId: { type: String, default: '' },
    title: { type: String, default: '' },
    domain: { type: String, default: '' },
    totalTopics: { type: Number, default: 0 },
    masteredTopics: { type: Number, default: 0 },
  },
  experienceLevel: { type: String, default: 'Fresher' },
  isProfileCompleted: { type: Boolean, default: false },
  skillDNA: { type: scoreSchema, default: () => ({}) },
}, { timestamps: true, collection: 'profiles' });

profileSchema.index({ degree: 1, branch: 1, college: 1 });
profileSchema.index({ skills: 1 });
profileSchema.index({ 'skillDNA.score': -1 });

const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);
export default Profile;
