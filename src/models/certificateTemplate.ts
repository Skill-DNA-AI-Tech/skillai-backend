import mongoose, { Schema, Document } from 'mongoose';

export interface ICertificateTemplate extends Document {
  templateId: string;
  name: string;
  description?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl?: string;
  orgName: string;
  signatureUrl?: string;
  signatoryName: string;
  signatoryTitle: string;
  layoutStyle: 'MODERN' | 'CLASSIC' | 'ELEGANT' | 'MINIMAL';
  numberingFormat: string;
  headerText: string;
  footerText: string;
  watermarkText?: string;
  showQrCode: boolean;
  showCompetencies: boolean;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const certificateTemplateSchema = new Schema<ICertificateTemplate>(
  {
    templateId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    primaryColor: { type: String, default: '#0f172a' },
    secondaryColor: { type: String, default: '#06b6d4' },
    accentColor: { type: String, default: '#f59e0b' },
    fontFamily: { type: String, default: 'Inter, sans-serif' },
    logoUrl: { type: String, default: '/brand/logo.svg' },
    orgName: { type: String, default: 'SkillDNA AI Global Certification Authority' },
    signatureUrl: { type: String, default: '' },
    signatoryName: { type: String, default: 'Dr. Evelyn Carter' },
    signatoryTitle: { type: String, default: 'Director of Skill Assessment & Verification' },
    layoutStyle: {
      type: String,
      enum: ['MODERN', 'CLASSIC', 'ELEGANT', 'MINIMAL'],
      default: 'MODERN',
    },
    numberingFormat: { type: String, default: 'SDNA-CERT-YYYY-XXXXXX' },
    headerText: { type: String, default: 'Certificate of Verified Competency' },
    footerText: { type: String, default: 'Officially verified and tamper-proof registered on SkillDNA AI Ledger' },
    watermarkText: { type: String, default: 'SKILLDNA VERIFIED' },
    showQrCode: { type: Boolean, default: true },
    showCompetencies: { type: Boolean, default: true },
    isActive: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'certificate_templates' }
);

export default mongoose.models.CertificateTemplate || mongoose.model<ICertificateTemplate>('CertificateTemplate', certificateTemplateSchema);
