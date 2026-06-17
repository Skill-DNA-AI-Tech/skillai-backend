import express from 'express';
import asyncHandler from 'express-async-handler';
import Company from '../models/company';
import Profile from '../models/profile';
import Job from '../models/job';
import { Application, Shortlist } from '../models/career/application';
import { protect, AuthRequest, authorize } from '../middleware/auth';
import { isAdminRole } from '../utils/rbac';
import { writeAuditLog } from '../utils/audit';

const router = express.Router();

router.post('/companies', protect, authorize('HR', 'admin'), asyncHandler(async (req: AuthRequest, res) => {
  const company = await Company.create({
    ...req.body,
    recruiters: [req.user._id],
  });
  await writeAuditLog(req, 'COMPANY_CREATED', 'Company', company._id.toString(), { name: company.get('name') });
  res.status(201).json(company);
}));

router.get('/companies/me', protect, authorize('HR', 'admin'), asyncHandler(async (req: AuthRequest, res) => {
  const companies = await Company.find({ recruiters: req.user._id }).sort({ createdAt: -1 });
  res.json(companies);
}));

router.get('/students/search', protect, authorize('HR', 'admin'), asyncHandler(async (req, res) => {
  const query: Record<string, unknown> = {};
  if (req.query.field) query.$or = [{ branch: req.query.field }, { domain: req.query.field }, { degree: req.query.field }];
  if (req.query.college) query.college = req.query.college;
  if (req.query.certification) query.certifications = req.query.certification;
  if (req.query.skill) query.skills = req.query.skill;
  if (req.query.minScore) query['skillDNA.score'] = { $gte: Number(req.query.minScore) };
  if (req.query.minInterviewScore) query['skillDNA.confidenceScore'] = { $gte: Number(req.query.minInterviewScore) };
  if (req.query.minCommunication) query['skillDNA.communicationScore'] = { $gte: Number(req.query.minCommunication) };

  const students = await Profile.find(query).populate('user', 'name email avatarUrl').sort({ 'skillDNA.score': -1 }).limit(100);
  res.json(students);
}));

router.get('/jobs/me', protect, authorize('HR', 'admin'), asyncHandler(async (req: AuthRequest, res) => {
  const query = isAdminRole(req.user.role, req.user.email) ? {} : { postedBy: req.user._id };
  const jobs = await Job.find(query).sort({ createdAt: -1 });
  res.json(jobs);
}));

router.get('/applications', protect, authorize('HR', 'admin'), asyncHandler(async (req: AuthRequest, res) => {
  const jobs = isAdminRole(req.user.role, req.user.email)
    ? await Job.find().select('_id')
    : await Job.find({ postedBy: req.user._id }).select('_id');
  const applications = await Application.find({ job: { $in: jobs.map((job) => job._id) } })
    .populate('student', 'name email')
    .populate('profile')
    .populate('job')
    .sort({ createdAt: -1 });
  res.json(applications);
}));

router.patch('/applications/:id/status', protect, authorize('HR', 'admin'), asyncHandler(async (req: AuthRequest, res) => {
  const { status, notes } = req.body;
  if (!['viewed', 'shortlisted', 'interviewing', 'offered', 'rejected'].includes(status)) {
    res.status(400).json({ message: 'Invalid application status' });
    return;
  }

  const application = await Application.findById(req.params.id).populate('job');
  if (!application) {
    res.status(404).json({ message: 'Application not found' });
    return;
  }

  const job = application.get('job') as any;
  const ownsJob = job?.postedBy?.toString() === req.user._id.toString();
  if (!ownsJob && !isAdminRole(req.user.role, req.user.email)) {
    res.status(403).json({ message: 'HR users can only update applications for their own jobs' });
    return;
  }

  application.set('status', status);
  if (notes !== undefined) application.set('notes', notes);
  await application.save();
  await writeAuditLog(req, 'APPLICATION_STATUS_UPDATED', 'Application', application._id.toString(), { status });
  res.json(application);
}));

router.post('/shortlists', protect, authorize('HR', 'admin'), asyncHandler(async (req: AuthRequest, res) => {
  const shortlist = await Shortlist.create({
    recruiter: req.user._id,
    company: req.body.company,
    student: req.body.student,
    profile: req.body.profile,
    job: req.body.job,
    interviewAt: req.body.interviewAt,
    notes: req.body.notes,
  });

  await writeAuditLog(req, 'CANDIDATE_SHORTLISTED', 'Shortlist', shortlist._id.toString(), { student: req.body.student, job: req.body.job });
  res.status(201).json(shortlist);
}));

router.get('/shortlists', protect, authorize('HR', 'admin'), asyncHandler(async (req: AuthRequest, res) => {
  const query = isAdminRole(req.user.role, req.user.email) ? {} : { recruiter: req.user._id };
  const shortlists = await Shortlist.find(query)
    .populate('student', 'name email')
    .populate('profile')
    .populate('job')
    .sort({ createdAt: -1 });
  res.json(shortlists);
}));

export default router;
