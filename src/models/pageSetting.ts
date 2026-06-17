import mongoose, { Schema, Document } from 'mongoose';

export interface IPageSetting extends Document {
  pageId: string;
  label: string;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PageSettingSchema = new Schema<IPageSetting>({
  pageId: { type: String, required: true, unique: true, index: true },
  label: { type: String, required: true },
  isHidden: { type: Boolean, default: false }
}, {
  timestamps: true,
  collection: 'page_settings'
});

const PageSetting = mongoose.models.PageSetting || mongoose.model<IPageSetting>('PageSetting', PageSettingSchema);
export default PageSetting;
