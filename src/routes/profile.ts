import express from 'express';
import asyncHandler from 'express-async-handler';
import multer from 'multer';
import path from 'path';
import Profile from '../models/profile';
import User from '../models/user';
import CareerTwinMemory from '../models/careerTwinMemory';
import { protect, AuthRequest } from '../middleware/auth';
import { aiClient } from '../services/aiClient';
import { calculateSkillDNA } from '../services/scoring';
import { resolveCurriculum } from '../data/curriculaData';
import { isAdminRole } from '../utils/rbac';

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'uploads'),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.get('/', asyncHandler(async (req, res) => {
  const { domain, college, minScore, skill } = req.query;
  const query: Record<string, unknown> = {};

  if (domain) query.domain = domain;
  if (college) query.college = college;
  if (skill) query.skills = skill;
  if (minScore) query['skillDNA.score'] = { $gte: Number(minScore) };

  const profiles = await Profile.find(query).populate('user', 'name email role avatarUrl').sort({ updatedAt: -1 });
  res.json(profiles);
}));

router.get('/me', protect, asyncHandler(async (req: AuthRequest, res) => {
  const profile = await Profile.findOne({ user: req.user._id }).populate('user', 'name email mobile avatarUrl role');

  if (!profile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  res.json(profile);
}));

router.get('/user/:userId', protect, asyncHandler(async (req: AuthRequest, res) => {
  const profile = await Profile.findOne({ user: req.params.userId }).populate('user', 'name email mobile avatarUrl role');

  if (!profile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  res.json(profile);
}));

router.post('/', protect, asyncHandler(async (req: AuthRequest, res) => {
  const existingProfile = await Profile.findOne({ user: req.user._id });
  const chosenCareer = req.body.career || req.body.domain || 'Java Software Engineer';
  const curriculum = resolveCurriculum(chosenCareer);

  const payload: any = {
    ...req.body,
    user: req.user._id,
    name: req.body.name ?? req.user.name,
    email: req.body.email ?? req.user.email,
    mobile: req.body.mobile ?? req.user.mobile,
  };

  // If first profile setup, bind career & active curriculum
  if (!existingProfile?.career) {
    payload.career = curriculum.careerName;
    payload.domain = curriculum.domain;
    payload.activeCurriculum = {
      curriculumId: curriculum.id,
      title: curriculum.careerName,
      domain: curriculum.domain,
      totalTopics: curriculum.topics.length,
      masteredTopics: 0,
    };
    payload.isProfileCompleted = true;

    // Sync User model
    await User.findByIdAndUpdate(req.user._id, {
      careerDomain: curriculum.domain,
      targetRole: req.body.targetRole || curriculum.targetRole,
      education: req.body.degree ? `${req.body.degree} in ${req.body.branch || ''}` : req.user.education,
      experienceLevel: req.body.experienceLevel || req.user.experienceLevel,
    });
  } else if (!isAdminRole(req.user?.role, req.user?.email)) {
    // Retain locked career and curriculum for students
    payload.career = existingProfile.career;
    payload.domain = existingProfile.domain;
    payload.activeCurriculum = existingProfile.activeCurriculum;
  }

  const skillDNA = calculateSkillDNA(payload);
  const profile = new Profile({ ...payload, skillDNA });
  const saved = await profile.save();
  res.status(201).json(saved);
}));

router.put('/me', protect, asyncHandler(async (req: AuthRequest, res) => {
  const existingProfile = await Profile.findOne({ user: req.user._id });
  const isAdmin = isAdminRole(req.user?.role, req.user?.email);

  const payload: any = {
    ...req.body,
    name: req.body.name ?? req.user.name,
    email: req.body.email ?? req.user.email,
  };

  // Initial setup: If profile does not have a career yet, assign active curriculum
  if (!existingProfile || !existingProfile.career) {
    const chosenCareer = req.body.career || req.body.domain || 'Java Software Engineer';
    const curriculum = resolveCurriculum(chosenCareer);
    payload.career = curriculum.careerName;
    payload.domain = curriculum.domain;
    payload.activeCurriculum = {
      curriculumId: curriculum.id,
      title: curriculum.careerName,
      domain: curriculum.domain,
      totalTopics: curriculum.topics.length,
      masteredTopics: 0,
    };
    payload.isProfileCompleted = true;

    // Update User model
    await User.findByIdAndUpdate(req.user._id, {
      careerDomain: curriculum.domain,
      targetRole: req.body.targetRole || curriculum.targetRole,
      education: req.body.degree ? `${req.body.degree} in ${req.body.branch || ''}` : req.user.education,
      experienceLevel: req.body.experienceLevel || req.user.experienceLevel,
    });
  } else if (!isAdmin) {
    // USER REQUIREMENT: Students can update normal profile info but CANNOT directly change Career or Curriculum
    // If student sends new career, ignore/lock and preserve existing career & curriculum
    payload.career = existingProfile.career;
    payload.domain = existingProfile.domain;
    payload.activeCurriculum = existingProfile.activeCurriculum;
  }

  // Update normal profile fields on User model if provided
  if (req.body.targetRole || req.body.experienceLevel || req.body.degree) {
    await User.findByIdAndUpdate(req.user._id, {
      ...(req.body.targetRole && { targetRole: req.body.targetRole }),
      ...(req.body.experienceLevel && { experienceLevel: req.body.experienceLevel }),
      ...(req.body.degree && { education: `${req.body.degree} in ${req.body.branch || ''}` }),
    });
  }

  const skillDNA = calculateSkillDNA({ ...existingProfile?.toObject(), ...payload });

  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id },
    { ...payload, skillDNA },
    { new: true, upsert: true, runValidators: true },
  );

  res.json(profile);
}));

router.post('/upload', protect, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'resume', maxCount: 1 }]), asyncHandler(async (req: AuthRequest, res) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const photo = files?.photo?.[0];
  const resume = files?.resume?.[0];

  const update: Record<string, string> = {};
  if (photo) update.photoUrl = `/uploads/${photo.filename}`;
  if (resume) update.resumeUrl = `/uploads/${resume.filename}`;

  const profile = await Profile.findOneAndUpdate({ user: req.user._id }, update, { new: true });
  res.json({ files: update, profile });
}));

router.post('/:id/score', protect, asyncHandler(async (req, res) => {
  const profile = await Profile.findById(req.params.id);

  if (!profile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const skillDNA = await aiClient.skillDNA(profile.toObject());
  profile.set('skillDNA', skillDNA);
  await profile.save();
  res.json(profile);
}));

export default router;
