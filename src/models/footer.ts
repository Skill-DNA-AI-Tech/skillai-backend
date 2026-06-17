import mongoose, { Document, Schema } from 'mongoose';

export interface IFooter extends Document {
  text: string;
  linkGroups: Array<{
    title: string;
    links: Array<{ label: string; url: string }>;
  }>;
  copyright: string;
  updatedAt: Date;
}

const FooterSchema: Schema = new Schema({
  text: { type: String, default: 'Empowering careers through AI-driven skill assessment and personalized learning paths.' },
  linkGroups: [{
    title: { type: String, required: true },
    links: [{
      label: { type: String, required: true },
      url: { type: String, required: true }
    }]
  }],
  copyright: { type: String, default: '© 2024 SkillDNA AI. All rights reserved.' },
}, {
  timestamps: true,
});

export default mongoose.model<IFooter>('Footer', FooterSchema);