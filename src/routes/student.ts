import express from 'express';
import asyncHandler from 'express-async-handler';
import Profile from '../models/profile';
import { QuestionInterviewSession } from '../models/questionBank';
import CareerTwinMemory from '../models/careerTwinMemory';
import Certificate from '../models/certificate';
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/student/profile
router.get('/profile', protect, asyncHandler(async (req: AuthRequest, res) => {
  const profile = await Profile.findOne({ user: req.user._id }).populate('user', 'name email mobile avatarUrl role careerDomain targetRole isTestUser testUserId');
  if (!profile) {
    res.status(404).json({ message: 'Student profile not found' });
    return;
  }
  res.json(profile);
}));

// PUT /api/student/profile
router.put('/profile', protect, asyncHandler(async (req: AuthRequest, res) => {
  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $set: req.body },
    { new: true, upsert: true }
  ).populate('user', 'name email mobile avatarUrl role');
  res.json(profile);
}));

// GET /api/student/dashboard
router.get('/dashboard', protect, asyncHandler(async (req: AuthRequest, res) => {
  const profile = await Profile.findOne({ user: req.user._id });
  const careerTwin = await CareerTwinMemory.findOne({ user: req.user._id });
  const recentSessions = await QuestionInterviewSession.find({ studentId: req.user._id }).sort({ createdAt: -1 }).limit(5);
  const totalCompleted = await QuestionInterviewSession.countDocuments({ studentId: req.user._id, status: 'Completed' });
  const certificates = await Certificate.find({ studentId: req.user._id, isActive: true }).sort({ createdAt: -1 });

  res.json({
    profile,
    careerTwin,
    recentSessions,
    totalCompleted,
    certificates,
    skillDNA: profile?.skillDNA || { score: 0 },
  });
}));

export default router;
