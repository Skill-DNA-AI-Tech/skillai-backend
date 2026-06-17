import express from 'express';
import asyncHandler from 'express-async-handler';
import Job from '../models/job';
import Profile from '../models/profile';
import { Application, JobMatch } from '../models/career/application';
import { protect, AuthRequest, authorize } from '../middleware/auth';
import { aiClient } from '../services/aiClient';
import { isHiringRole } from '../utils/rbac';
import { writeAuditLog } from '../utils/audit';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { domain, type, q, status = 'open' } = req.query;
  const query: Record<string, unknown> = { status };

  if (domain) query.domain = domain;
  if (type) query.type = type;
  if (q) query.$text = { $search: String(q) };

  const jobs = await Job.find(query).sort({ createdAt: -1 });
  res.json(jobs);
}));

router.post('/', protect, authorize('HR', 'admin'), asyncHandler(async (req: AuthRequest, res) => {
  const job = new Job({ ...req.body, postedBy: req.user._id });
  const saved = await job.save();
  await writeAuditLog(req, 'JOB_CREATED', 'Job', saved._id.toString(), { title: saved.get('title') });
  res.status(201).json(saved);
}));

router.get('/me/applications', protect, authorize('student'), asyncHandler(async (req: AuthRequest, res) => {
  const applications = await Application.find({ student: req.user._id }).populate('job').sort({ createdAt: -1 });
  res.json(applications);
}));

router.get('/me/matches', protect, authorize('student'), asyncHandler(async (req: AuthRequest, res) => {
  const matches = await JobMatch.find({ student: req.user._id }).populate('job').sort({ matchScore: -1 });
  res.json(matches);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  res.json(job);
}));

router.patch('/:id/status', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!isHiringRole(req.user.role, req.user.email)) {
    res.status(403).json({ message: 'Only HR or Admin users can manage job status' });
    return;
  }

  const job = await Job.findById(req.params.id);
  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  const status = req.body.status;
  if (!['draft', 'open', 'closed'].includes(status)) {
    res.status(400).json({ message: 'Invalid job status' });
    return;
  }

  const ownsJob = job.get('postedBy')?.toString() === req.user._id.toString();
  if (!ownsJob && req.user.role === 'HR') {
    res.status(403).json({ message: 'HR users can only update their own job postings' });
    return;
  }

  job.set('status', status);
  await job.save();
  await writeAuditLog(req, 'JOB_STATUS_UPDATED', 'Job', job._id.toString(), { status });
  res.json(job);
}));

router.post('/:id/apply', protect, authorize('student'), asyncHandler(async (req: AuthRequest, res) => {
  const job = await Job.findById(req.params.id);
  const profile = await Profile.findOne({ user: req.user._id });

  if (!job || !profile) {
    res.status(404).json({ message: 'Job or profile not found' });
    return;
  }

  const match = await aiClient.jobMatch({
    profileSkills: profile.get('skills'),
    jobSkills: job.get('skills'),
  });

  const application = await Application.create({
    student: req.user._id,
    profile: profile._id,
    job: job._id,
    resumeUrl: req.body.resumeUrl ?? profile.get('resumeUrl'),
    report: req.body.report,
    matchScore: match.matchScore,
  });

  await JobMatch.findOneAndUpdate(
    { student: req.user._id, job: job._id },
    {
      student: req.user._id,
      profile: profile._id,
      job: job._id,
      matchScore: match.matchScore,
      matchingSkills: match.matchingSkills,
      missingSkills: match.missingSkills,
      explanation: match.explanation,
      improvementRoadmap: match.roadmap ?? match.improvementRoadmap,
    },
    { upsert: true, new: true },
  );

  res.status(201).json({ application, match });
}));

router.post('/:id/match', protect, asyncHandler(async (req: AuthRequest, res) => {
  const job = await Job.findById(req.params.id);
  const profile = await Profile.findOne({ user: req.user._id });

  if (!job || !profile) {
    res.status(404).json({ message: 'Job or profile not found' });
    return;
  }

  const match = await aiClient.jobMatch({
    profileSkills: profile.get('skills'),
    profileCertifications: profile.get('certifications'),
    communicationScore: profile.get('skillDNA.communicationScore'),
    interviewScore: req.body.interviewScore,
    jobSkills: job.get('skills'),
    jobCertifications: job.get('certifications'),
  });

  const saved = await JobMatch.findOneAndUpdate(
    { student: req.user._id, job: job._id },
    {
      student: req.user._id,
      profile: profile._id,
      job: job._id,
      matchScore: match.matchScore,
      matchingSkills: match.matchingSkills,
      matchingCertifications: match.matchingCertifications ?? [],
      communicationFit: match.communicationFit ?? profile.get('skillDNA.communicationScore') ?? 0,
      interviewFit: match.interviewFit ?? req.body.interviewScore ?? 0,
      missingSkills: match.missingSkills,
      explanation: match.explanation,
      improvementRoadmap: match.roadmap ?? match.improvementRoadmap,
    },
    { upsert: true, new: true },
  );

  res.json(saved);
}));

export default router;
