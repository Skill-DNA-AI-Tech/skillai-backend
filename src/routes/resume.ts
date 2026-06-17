import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect, AuthRequest, authorize } from '../middleware/auth';
import Profile from '../models/profile';
import ResumeAnalysis from '../models/resumeAnalysis';
import { aiClient } from '../services/aiClient';

const router = express.Router();

router.get('/me', protect, authorize('student'), asyncHandler(async (req: AuthRequest, res) => {
  const analyses = await ResumeAnalysis.find({ student: req.user._id }).sort({ createdAt: -1 });
  res.json(analyses);
}));

router.post('/analyze', protect, authorize('student'), asyncHandler(async (req: AuthRequest, res) => {
  const profile = await Profile.findOne({ user: req.user._id });
  const analysis = await aiClient.resume({
    resumeUrl: req.body.resumeUrl ?? profile?.get('resumeUrl'),
    rawText: req.body.rawText,
    keywords: req.body.keywords ?? profile?.get('skills'),
    projects: profile?.get('projects'),
    certifications: profile?.get('certifications'),
  });

  const saved = await ResumeAnalysis.create({
    student: req.user._id,
    profile: profile?._id,
    resumeUrl: req.body.resumeUrl ?? profile?.get('resumeUrl'),
    rawText: req.body.rawText,
    ...analysis,
  });

  res.status(201).json(saved);
}));

export default router;
