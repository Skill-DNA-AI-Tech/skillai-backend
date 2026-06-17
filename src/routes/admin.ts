import express from 'express';
import asyncHandler from 'express-async-handler';
import User from '../models/user';
import Profile from '../models/profile';
import Job from '../models/job';
import Report from '../models/report';
import Company from '../models/company';
import ResumeAnalysis from '../models/resumeAnalysis';
import { Application } from '../models/career/application';
import { Lesson, Quiz, Webinar } from '../models/learning/content';
import { InterviewSession } from '../models/interview';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import Footer from '../models/footer';
import AuditLog from '../models/auditLog';
import { normalizeRole } from '../utils/rbac';
import { writeAuditLog } from '../utils/audit';
import PageSetting from '../models/pageSetting';
import Feedback from '../models/feedback';

const router = express.Router();

const adminAccountRoles = ['MAIN_ADMIN', 'ADMIN', 'admin', 'employee', 'staff'];
const hrAccountRoles = ['HR', 'recruiter'];
const studentRoles = ['STUDENT', 'student'];
const futureRoles = [
  { role: 'SUPPORT_TEAM', label: 'Support Team', status: 'Coming Soon' },
  { role: 'RECRUITER', label: 'Recruiter', status: 'Coming Soon' },
  { role: 'INTERVIEW_COACH', label: 'Interview Coach', status: 'Coming Soon' },
  { role: 'SALES_TEAM', label: 'Sales Team', status: 'Coming Soon' },
];

const isMainAdmin = (req: AuthRequest) => normalizeRole(req.user?.role, req.user?.email) === 'MAIN_ADMIN';

const requireMainAdmin = (req: AuthRequest, res: any) => {
  if (!isMainAdmin(req)) {
    res.status(403).json({ message: 'Access denied. Only Main Admin can perform this action.' });
    return false;
  }

  return true;
};

const serializeUserAccount = (user: any) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  full_name: user.full_name ?? user.name,
  email: user.email,
  role: normalizeRole(user.role, user.email),
  status: user.status ?? 'ACTIVE',
  approved_by: user.approved_by,
  approved_at: user.approved_at,
  disabled_at: user.disabled_at,
  mobile: user.mobile,
  avatarUrl: user.avatarUrl,
  emailVerified: user.emailVerified,
  requiresPasswordChange: user.requiresPasswordChange ?? false,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
});

const userListQuery = (roles: string[]) => ({ role: { $in: roles } });

// GET /api/admin/page-settings - Public/Student endpoint to retrieve page settings
router.get('/page-settings', asyncHandler(async (req, res) => {
  const settings = await PageSetting.find();
  res.json(settings);
}));

// GET /api/admin/footer - Public endpoint to retrieve footer
router.get('/footer', asyncHandler(async (req, res) => {
  let footer = await Footer.findOne();
  if (!footer) {
    footer = await Footer.create({
      linkGroups: [
        {
          title: 'Quick Links',
          links: [
            { label: 'Home', url: '/' },
            { label: 'Dashboard', url: '/dashboard' },
            { label: 'Jobs', url: '/jobs' },
            { label: 'Community', url: '/community' }
          ]
        },
        {
          title: 'Company',
          links: [
            { label: 'About Us', url: '/about' },
            { label: 'Careers', url: '/careers' }
          ]
        },
        {
          title: 'Support',
          links: [
            { label: 'Help Center', url: 'mailto:support@skilldna.com' },
            { label: 'Feedback', url: '/feedback' }
          ]
        }
      ]
    });
  }
  res.json(footer);
}));

// Helper middleware to allow ADMIN or SUPPORT_TEAM roles for feedback/support features
const supportOrAdminProtect = [
  protect,
  asyncHandler(async (req: AuthRequest, res, next) => {
    const role = normalizeRole(req.user?.role, req.user?.email);
    if (['MAIN_ADMIN', 'ADMIN', 'SUPPORT_TEAM'].includes(role)) {
      next();
    } else {
      res.status(403).json({ message: 'Access denied. Requires Admin or Support role.' });
    }
  })
];

// Feedback Backup route - support/admin accessible
router.get('/feedback/backup', supportOrAdminProtect, asyncHandler(async (req, res) => {
  const feedbacks = await Feedback.find().sort({ createdAt: -1 });
  res.setHeader('Content-disposition', 'attachment; filename=feedbacks_backup.json');
  res.setHeader('Content-type', 'application/json');
  res.send(JSON.stringify(feedbacks, null, 2));
}));

// Feedback GET route - support/admin accessible
router.get('/feedback', supportOrAdminProtect, asyncHandler(async (req, res) => {
  const feedbacks = await Feedback.find().sort({ createdAt: -1 });
  res.json(feedbacks);
}));

// Feedback PUT route - support/admin accessible
router.put('/feedback/:id', supportOrAdminProtect, asyncHandler(async (req: AuthRequest, res) => {
  const { status } = req.body;
  if (!['PENDING', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
    res.status(400).json({ message: 'Invalid feedback status' });
    return;
  }
  const feedback = await Feedback.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );
  if (!feedback) {
    res.status(404).json({ message: 'Feedback not found' });
    return;
  }
  await writeAuditLog(req, 'FEEDBACK_STATUS_UPDATED', 'Feedback', feedback._id.toString(), { status });
  res.json(feedback);
}));

// Page visibility toggle - Admin/Main Admin only
router.put('/page-settings/:pageId', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req: AuthRequest, res) => {
  const { isHidden } = req.body;
  const setting = await PageSetting.findOneAndUpdate(
    { pageId: req.params.pageId },
    { isHidden: !!isHidden },
    { new: true }
  );
  if (!setting) {
    res.status(404).json({ message: 'Page setting not found' });
    return;
  }
  await writeAuditLog(req, 'PAGE_SETTINGS_UPDATED', 'PageSetting', setting._id.toString(), { pageId: setting.pageId, isHidden: setting.isHidden });
  res.json(setting);
}));

router.use(protect, authorize('admin', 'employee', 'staff'));

router.get('/overview', asyncHandler(async (req, res) => {
  const [
    users,
    students,
    hrs,
    pendingAdmins,
    companies,
    profiles,
    jobs,
    applications,
    reports,
    lessons,
    quizzes,
    webinars,
    interviews,
    resumes,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments(userListQuery(studentRoles)),
    User.countDocuments(userListQuery(hrAccountRoles)),
    User.countDocuments({ role: { $in: ['ADMIN', 'admin'] }, status: 'PENDING' }),
    Company.countDocuments(),
    Profile.countDocuments(),
    Job.countDocuments(),
    Application.countDocuments(),
    Report.countDocuments(),
    Lesson.countDocuments(),
    Quiz.countDocuments(),
    Webinar.countDocuments(),
    InterviewSession.countDocuments(),
    ResumeAnalysis.countDocuments(),
  ]);

  const topSkills = await Profile.aggregate([
    { $unwind: '$skills' },
    { $group: { _id: '$skills', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);

  const weakTopics = await Profile.aggregate([
    { $unwind: '$skillDNA.weaknesses' },
    { $group: { _id: '$skillDNA.weaknesses', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);

  res.json({
    users,
    students,
    hrs,
    recruiters: hrs,
    pendingAdmins,
    companies,
    profiles,
    jobs,
    applications,
    reports,
    lessons,
    quizzes,
    webinars,
    interviews,
    resumes,
    placementSuccessRate: applications ? Math.round((await Application.countDocuments({ status: 'offered' }) / applications) * 100) : 0,
    topSkills,
    weakTopics,
  });
}));

router.get('/students', asyncHandler(async (req, res) => {
  const students = await Profile.find().populate('user', 'name email emailVerified').sort({ updatedAt: -1 }).limit(200);
  res.json(students);
}));

router.get('/recruiters', asyncHandler(async (req, res) => {
  const recruiters = await User.find(userListQuery(hrAccountRoles)).select('-password -otp.codeHash').sort({ createdAt: -1 });
  res.json(recruiters);
}));

router.get('/future-roles', asyncHandler(async (req, res) => {
  res.json(futureRoles.map((role) => ({ ...role, assignable: false })));
}));

router.get('/audit-logs', asyncHandler(async (req: AuthRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200);
  res.json(logs);
}));

router.get('/moderation', asyncHandler(async (req, res) => {
  res.json({
    pendingReports: 0,
    flaggedPosts: 0,
    pendingCompanies: await Company.countDocuments({ verified: false }),
    pendingJobs: await Job.countDocuments({ status: 'draft' }),
  });
}));

router.put('/footer', asyncHandler(async (req, res) => {
  const { text, linkGroups, copyright } = req.body;
  let footer = await Footer.findOne();
  if (!footer) {
    footer = new Footer();
  }
  if (text !== undefined) footer.text = text;
  if (linkGroups !== undefined) footer.linkGroups = linkGroups;
  if (copyright !== undefined) footer.copyright = copyright;
  await footer.save();
  res.json(footer);
}));

// GET /api/admin/admins/pending - Main Admin approval queue
router.get('/admins/pending', asyncHandler(async (req: AuthRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const pendingAdmins = await User.find({
    role: { $in: ['ADMIN', 'admin'] },
    status: 'PENDING',
  }).select('-password -otp.codeHash').sort({ createdAt: -1 });

  res.json(pendingAdmins.map(serializeUserAccount));
}));

// GET /api/admin/admins - Retrieve all Admin accounts (Main Admin only)
router.get('/admins', asyncHandler(async (req: AuthRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const admins = await User.find({
    role: { $in: adminAccountRoles },
    email: { $nin: ['skilldnaai@ai.com'] },
  }).select('-password -otp.codeHash').sort({ createdAt: -1 });

  res.json(admins.map(serializeUserAccount));
}));

// POST /api/admin/admins - Create a new Admin (Main Admin only)
router.post('/admins', asyncHandler(async (req: AuthRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const { name, full_name, email, password } = req.body;
  const displayName = name || full_name;

  if (!displayName || !email || !password) {
    res.status(400).json({ message: 'Full name, email, and password are required' });
    return;
  }

  const existing = await User.findOne({ email: email.trim().toLowerCase() });
  if (existing) {
    res.status(400).json({ message: 'Email already registered' });
    return;
  }

  const newAdmin = await User.create({
    name: displayName,
    full_name: displayName,
    email: email.trim().toLowerCase(),
    password,
    role: 'ADMIN',
    status: 'ACTIVE',
    approved_by: req.user._id,
    approved_at: new Date(),
    requiresPasswordChange: true,
    emailVerified: true,
  });

  await writeAuditLog(req, 'ADMIN_CREATED', 'User', newAdmin._id.toString(), { email: newAdmin.email });
  res.status(201).json(serializeUserAccount(newAdmin));
}));

router.post('/admins/:id/approve', asyncHandler(async (req: AuthRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const user = await User.findById(req.params.id);
  if (!user || normalizeRole(user.role, user.email) !== 'ADMIN') {
    res.status(404).json({ message: 'Pending Admin account not found' });
    return;
  }

  user.status = 'ACTIVE';
  user.approved_by = req.user._id;
  user.approved_at = new Date();
  await user.save();

  await writeAuditLog(req, 'ADMIN_APPROVED', 'User', user._id.toString(), { email: user.email });
  res.json(serializeUserAccount(user));
}));

router.post('/admins/:id/reject', asyncHandler(async (req: AuthRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const user = await User.findById(req.params.id);
  if (!user || normalizeRole(user.role, user.email) !== 'ADMIN') {
    res.status(404).json({ message: 'Admin account not found' });
    return;
  }

  user.status = 'REJECTED';
  await user.save();

  await writeAuditLog(req, 'ADMIN_REJECTED', 'User', user._id.toString(), { email: user.email, reason: req.body?.reason ?? '' });
  res.json(serializeUserAccount(user));
}));

router.post('/admins/:id/disable', asyncHandler(async (req: AuthRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const user = await User.findById(req.params.id);
  if (!user || normalizeRole(user.role, user.email) !== 'ADMIN') {
    res.status(404).json({ message: 'Admin account not found' });
    return;
  }

  user.status = 'DISABLED';
  user.disabled_at = new Date();
  await user.save();

  await writeAuditLog(req, 'ADMIN_DISABLED', 'User', user._id.toString(), { email: user.email });
  res.json(serializeUserAccount(user));
}));

router.post('/admins/:id/enable', asyncHandler(async (req: AuthRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const user = await User.findById(req.params.id);
  if (!user || normalizeRole(user.role, user.email) !== 'ADMIN') {
    res.status(404).json({ message: 'Admin account not found' });
    return;
  }

  user.status = 'ACTIVE';
  user.disabled_at = undefined;
  await user.save();

  await writeAuditLog(req, 'ADMIN_ENABLED', 'User', user._id.toString(), { email: user.email });
  res.json(serializeUserAccount(user));
}));

// PUT /api/admin/admins/:id - Update Admin (Main Admin only)
router.put('/admins/:id', asyncHandler(async (req: AuthRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const { name, full_name, password, status } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (normalizeRole(user.role, user.email) === 'MAIN_ADMIN') {
    res.status(403).json({ message: 'Cannot modify main Super Admin account' });
    return;
  }

  if (normalizeRole(user.role, user.email) !== 'ADMIN') {
    res.status(400).json({ message: 'This endpoint only manages Admin accounts' });
    return;
  }

  const displayName = name ?? full_name;
  if (displayName !== undefined) {
    user.name = displayName;
    user.full_name = displayName;
  }

  if (status !== undefined) {
    if (!['PENDING', 'ACTIVE', 'DISABLED', 'REJECTED'].includes(status)) {
      res.status(400).json({ message: 'Invalid account status' });
      return;
    }
    user.status = status;
  }
  
  if (password) {
    user.password = password;
    user.requiresPasswordChange = true;
  }

  await user.save();

  await writeAuditLog(req, 'ADMIN_UPDATED', 'User', user._id.toString(), { email: user.email, status: user.status });
  res.json(serializeUserAccount(user));
}));

// DELETE /api/admin/admins/:id - Delete Admin (Main Admin only)
router.delete('/admins/:id', asyncHandler(async (req: AuthRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (normalizeRole(user.role, user.email) === 'MAIN_ADMIN') {
    res.status(403).json({ message: 'Cannot delete main Super Admin account' });
    return;
  }

  if (normalizeRole(user.role, user.email) !== 'ADMIN') {
    res.status(400).json({ message: 'This endpoint only deletes Admin accounts' });
    return;
  }

  await User.deleteOne({ _id: req.params.id });
  await writeAuditLog(req, 'ADMIN_DELETED', 'User', req.params.id, { email: user.email });
  res.json({ message: 'User deleted successfully' });
}));

router.get('/hrs', asyncHandler(async (req: AuthRequest, res) => {
  const hrs = await User.find(userListQuery(hrAccountRoles)).select('-password -otp.codeHash').sort({ createdAt: -1 });
  res.json(hrs.map(serializeUserAccount));
}));

router.post('/hrs', asyncHandler(async (req: AuthRequest, res) => {
  const actorRole = normalizeRole(req.user?.role, req.user?.email);
  if (!['MAIN_ADMIN', 'ADMIN'].includes(actorRole)) {
    res.status(403).json({ message: 'Only Admin or Main Admin can create HR accounts' });
    return;
  }

  const { name, full_name, email, password, mobile } = req.body;
  const displayName = name || full_name;
  if (!displayName || !email || !password) {
    res.status(400).json({ message: 'Full name, email, and password are required' });
    return;
  }

  const existing = await User.findOne({ email: email.trim().toLowerCase() });
  if (existing) {
    res.status(400).json({ message: 'Email already registered' });
    return;
  }

  const hr = await User.create({
    name: displayName,
    full_name: displayName,
    email: email.trim().toLowerCase(),
    password,
    role: 'HR',
    status: 'ACTIVE',
    mobile,
    approved_by: req.user._id,
    approved_at: new Date(),
    requiresPasswordChange: true,
    emailVerified: true,
  });

  await writeAuditLog(req, 'HR_CREATED', 'User', hr._id.toString(), { email: hr.email });
  res.status(201).json(serializeUserAccount(hr));
}));

router.put('/hrs/:id', asyncHandler(async (req: AuthRequest, res) => {
  const actorRole = normalizeRole(req.user?.role, req.user?.email);
  if (!['MAIN_ADMIN', 'ADMIN'].includes(actorRole)) {
    res.status(403).json({ message: 'Only Admin or Main Admin can update HR accounts' });
    return;
  }

  const { name, full_name, password, status, mobile } = req.body;
  const user = await User.findById(req.params.id);
  if (!user || normalizeRole(user.role, user.email) !== 'HR') {
    res.status(404).json({ message: 'HR account not found' });
    return;
  }

  const displayName = name ?? full_name;
  if (displayName !== undefined) {
    user.name = displayName;
    user.full_name = displayName;
  }
  if (mobile !== undefined) user.mobile = mobile;
  if (password) {
    user.password = password;
    user.requiresPasswordChange = true;
  }
  if (status !== undefined) {
    if (!['ACTIVE', 'DISABLED'].includes(status)) {
      res.status(400).json({ message: 'HR accounts can be ACTIVE or DISABLED' });
      return;
    }
    user.status = status;
    user.disabled_at = status === 'DISABLED' ? new Date() : undefined;
  }

  await user.save();
  await writeAuditLog(req, 'HR_UPDATED', 'User', user._id.toString(), { email: user.email, status: user.status });
  res.json(serializeUserAccount(user));
}));

router.post('/hrs/:id/disable', asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id);
  if (!user || normalizeRole(user.role, user.email) !== 'HR') {
    res.status(404).json({ message: 'HR account not found' });
    return;
  }

  user.status = 'DISABLED';
  user.disabled_at = new Date();
  await user.save();

  await writeAuditLog(req, 'HR_DISABLED', 'User', user._id.toString(), { email: user.email });
  res.json(serializeUserAccount(user));
}));

router.delete('/hrs/:id', asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id);
  if (!user || normalizeRole(user.role, user.email) !== 'HR') {
    res.status(404).json({ message: 'HR account not found' });
    return;
  }

  await User.deleteOne({ _id: user._id });
  await writeAuditLog(req, 'HR_DELETED', 'User', req.params.id, { email: user.email });
  res.json({ message: 'HR account deleted successfully' });
}));

export default router;
