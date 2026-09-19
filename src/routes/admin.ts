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
import { QuestionBank, QuestionInterviewSession, StudentAnswer } from '../models/questionBank';
import CareerTwinMemory from '../models/careerTwinMemory';
import Certificate from '../models/certificate';
import CertificateTemplate from '../models/certificateTemplate';
import { normalizeDomain } from '../services/interviewSession';
import generateToken from '../utils/generateToken';
import QRCode from 'qrcode';
import { resolveCurriculum } from '../data/curriculaData';
import { generateCertificateId } from './certificates';
import { env } from '../config/env';

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
    activeQuestions,
    totalSessions,
    completedSessions,
    totalCertificates,
    testUsersCount,
  ] = await Promise.all([
    User.countDocuments({ isTestUser: { $ne: true }, isPreProductionUser: { $ne: true } }),
    User.countDocuments({ ...userListQuery(studentRoles), isTestUser: { $ne: true }, isPreProductionUser: { $ne: true } }),
    User.countDocuments({ ...userListQuery(hrAccountRoles), isTestUser: { $ne: true }, isPreProductionUser: { $ne: true } }),
    User.countDocuments({ role: { $in: ['ADMIN', 'admin'] }, status: 'PENDING', isTestUser: { $ne: true }, isPreProductionUser: { $ne: true } }),
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
    QuestionBank.countDocuments({ status: 'Active' }),
    QuestionInterviewSession.countDocuments(),
    QuestionInterviewSession.countDocuments({ status: 'Completed' }),
    Certificate.countDocuments(),
    User.countDocuments({ $or: [{ isTestUser: true }, { isPreProductionUser: true }] }),
  ]);

  const questionsByDomain = await QuestionBank.aggregate([
    { $match: { status: 'Active' } },
    { $group: { _id: '$field', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
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
    interviews: completedSessions || interviews,
    totalSessions,
    completedSessions,
    activeQuestions: activeQuestions || 48,
    totalCertificates,
    testUsersCount,
    questionsByDomain,
    resumes,
    placementSuccessRate: applications ? Math.round((await Application.countDocuments({ status: 'offered' }) / applications) * 100) : 0,
    topSkills,
    weakTopics,
  });
}));

router.get('/students', asyncHandler(async (req, res) => {
  const students = await Profile.find().populate('user', 'name email emailVerified isTestUser isPreProductionUser testUserId').sort({ updatedAt: -1 }).limit(200);
  res.json(students);
}));

// GET /api/admin/students/list - Paginated and searchable student directory with profile & certificate counts
router.get('/students/list', asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const userQuery: any = {
    ...userListQuery(studentRoles),
    isTestUser: { $ne: true },
    isPreProductionUser: { $ne: true },
  };

  if (search && String(search).trim()) {
    const searchRegex = new RegExp(String(search).trim(), 'i');
    userQuery.$or = [
      { name: searchRegex },
      { full_name: searchRegex },
      { email: searchRegex },
      { careerDomain: searchRegex },
    ];
  }

  const [totalStudents, studentUsers] = await Promise.all([
    User.countDocuments(userQuery),
    User.find(userQuery).select('-password -otp.codeHash').sort({ createdAt: -1 }).skip(skip).limit(limitNum),
  ]);

  const userIds = studentUsers.map((u) => u._id);

  const [profiles, certCounts] = await Promise.all([
    Profile.find({ user: { $in: userIds } }),
    Certificate.aggregate([
      { $match: { studentId: { $in: userIds }, isActive: true } },
      { $group: { _id: '$studentId', count: { $sum: 1 } } },
    ]),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));
  const certCountMap = new Map(certCounts.map((c) => [c._id.toString(), c.count]));

  const data = studentUsers.map((student) => {
    const p = profileMap.get(student._id.toString());
    return {
      _id: student._id,
      name: student.name,
      email: student.email,
      role: student.role,
      status: student.status,
      mobile: student.mobile,
      careerDomain: student.careerDomain,
      requiresPasswordChange: student.requiresPasswordChange,
      createdAt: (student as any).createdAt,
      career: p?.career || student.careerDomain || 'Software Development',
      domain: p?.domain || student.careerDomain || 'Computer Science',
      college: p?.college || 'SkillDNA Partner Institute',
      degree: p?.degree || 'B.Tech',
      branch: p?.branch || 'Computer Science & Engineering',
      activeCurriculum: p?.activeCurriculum,
      certificateCount: certCountMap.get(student._id.toString()) || 0,
    };
  });

  res.json({
    students: data,
    total: totalStudents,
    page: pageNum,
    totalPages: Math.ceil(totalStudents / limitNum),
  });
}));

// POST /api/admin/students - Admin securely creates a new student account
router.post('/students', asyncHandler(async (req: AuthRequest, res) => {
  const {
    name,
    email,
    password,
    career,
    domain,
    mobile,
    college,
    degree,
    branch,
    semester,
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ message: 'Student full name is required.' });
    return;
  }

  if (!email || !email.trim()) {
    res.status(400).json({ message: 'Student email address is required.' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizedEmail = email.trim().toLowerCase();
  if (!emailRegex.test(normalizedEmail)) {
    res.status(400).json({ message: 'Please provide a valid email address.' });
    return;
  }

  if (!password || password.trim().length < 6) {
    res.status(400).json({ message: 'Temporary password must be at least 6 characters long.' });
    return;
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    res.status(400).json({ message: `An account with email ${normalizedEmail} already exists on the platform.` });
    return;
  }

  // Resolve curriculum automatically from career selection
  const selectedCareer = (career || 'Software Development').trim();
  const resolvedCurriculum = resolveCurriculum(selectedCareer);
  const selectedDomain = (domain?.trim()) || resolvedCurriculum.domain || 'Computer Science';

  // 1. Create student User
  const user = new User({
    name: name.trim(),
    full_name: name.trim(),
    email: normalizedEmail,
    password: password.trim(), // Will be hashed by User pre-save hook
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    requiresPasswordChange: true,
    careerDomain: selectedDomain,
    targetRole: resolvedCurriculum.targetRole,
    mobile: mobile ? mobile.trim() : undefined,
    approved_by: req.user?._id,
    approved_at: new Date(),
  });

  await user.save();

  // 2. Create student Profile with auto-assigned active curriculum
  const profile = new Profile({
    user: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile || '',
    degree: (degree || 'B.Tech').trim(),
    branch: (branch || 'Computer Science & Engineering').trim(),
    college: (college || 'SkillDNA Partner Institute').trim(),
    semester: (semester || 'Final Year').trim(),
    career: selectedCareer,
    domain: selectedDomain,
    preferredRoles: [resolvedCurriculum.targetRole],
    activeCurriculum: {
      curriculumId: resolvedCurriculum.id,
      title: resolvedCurriculum.careerName,
      domain: resolvedCurriculum.domain,
      totalTopics: resolvedCurriculum.topics.length,
      masteredTopics: 0,
    },
    isProfileCompleted: true,
  });

  await profile.save();

  // 3. Write immutable audit log
  await writeAuditLog(req, 'ADMIN_STUDENT_CREATED', 'User', user._id.toString(), {
    email: user.email,
    career: selectedCareer,
    domain: selectedDomain,
    createdById: req.user?._id,
    createdByName: req.user?.name,
  });

  res.status(201).json({
    message: `Student account created successfully for ${user.name}.`,
    user: serializeUserAccount(user),
    profile,
    temporaryPassword: password.trim(),
  });
}));

// POST /api/admin/certificates/issue - Admin creates and issues verified certificate to student
router.post('/certificates/issue', asyncHandler(async (req: AuthRequest, res) => {
  const {
    studentId,
    careerPath,
    courseName,
    overallScore,
    technicalScore,
    communicationScore,
    problemSolvingScore,
    confidenceScore,
    sessionsCompleted,
    interviewReadinessStatus,
    issueDate,
    expiryDate,
    strengths,
    improvements,
  } = req.body;

  if (!studentId) {
    res.status(400).json({ message: 'Student ID is required.' });
    return;
  }

  const student = await User.findById(studentId);
  if (!student) {
    res.status(404).json({ message: 'Selected student not found.' });
    return;
  }

  const certCareerPath = (careerPath || courseName || student.careerDomain || 'Software Development').trim();
  if (!certCareerPath) {
    res.status(400).json({ message: 'Career path or course name is required.' });
    return;
  }

  // Server-side Score Validation (Must be >= 75%)
  const numericOverall = Number(overallScore);
  if (isNaN(numericOverall) || numericOverall < 75 || numericOverall > 100) {
    res.status(400).json({
      message: 'Certificate issuance requires a verified overall score of at least 75% (and maximum 100%).',
    });
    return;
  }

  const tech = typeof technicalScore === 'number' ? Math.max(0, Math.min(100, technicalScore)) : numericOverall;
  const comm = typeof communicationScore === 'number' ? Math.max(0, Math.min(100, communicationScore)) : 80;
  const prob = typeof problemSolvingScore === 'number' ? Math.max(0, Math.min(100, problemSolvingScore)) : numericOverall;
  const conf = typeof confidenceScore === 'number' ? Math.max(0, Math.min(100, confidenceScore)) : 80;

  // STRICT DUPLICATE PREVENTION:
  // Reject if an active certificate already exists for this student and career path
  const escapedCareer = certCareerPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingCert = await Certificate.findOne({
    studentId: student._id,
    careerPath: { $regex: new RegExp(`^${escapedCareer}$`, 'i') },
    isActive: true,
    status: { $in: ['APPROVED', 'PENDING'] },
  });

  if (existingCert) {
    res.status(400).json({
      message: `An active certificate (${existingCert.certificateId}) has already been issued to ${student.name} for '${certCareerPath}'. Duplicate certificates for the same career path are prohibited.`,
      existingCertificateId: existingCert.certificateId,
    });
    return;
  }

  // Generate unique Certificate ID
  const certificateId = generateCertificateId();

  // Public verification URL
  const baseUrl = env.appBaseUrl || 'https://skilldna.ai';
  const verificationUrl = `${baseUrl}/verify/${certificateId}`;

  // Generate high-resolution QR code data URL
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#0284c7',
        light: '#ffffff',
      },
    });
  } catch (qrErr) {
    console.warn('QR code generation failed, using API fallback:', qrErr);
    qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(verificationUrl)}`;
  }

  // Interview readiness status
  let readiness: 'NOT_READY' | 'IN_PROGRESS' | 'READY' | 'ADVANCED' = 'READY';
  if (interviewReadinessStatus && ['NOT_READY', 'IN_PROGRESS', 'READY', 'ADVANCED'].includes(interviewReadinessStatus)) {
    readiness = interviewReadinessStatus;
  } else if (numericOverall >= 85) {
    readiness = 'ADVANCED';
  } else {
    readiness = 'READY';
  }

  // Fetch issuing admin's digital signature if available
  const adminUser = await User.findById(req.user?._id);
  const signature = adminUser?.signatureBase64 || undefined;

  const activeTemplate = await CertificateTemplate.findOne({ isActive: true }) || await CertificateTemplate.findOne();
  const templateId = activeTemplate?.templateId || 'template-01';

  const certIssueDate = issueDate ? new Date(issueDate) : new Date();
  const certExpiryDate = expiryDate ? new Date(expiryDate) : new Date(certIssueDate.getTime() + 365 * 24 * 60 * 60 * 1000);

  const defaultStrengths = ['Technical Acumen', 'Problem Resolution', 'Professional Articulation'];
  const defaultImprovements = ['Continuous Domain Exploration', 'High-Scale System Architecture'];

  const certificate = new Certificate({
    studentId: student._id,
    studentName: student.name,
    email: student.email,
    careerPath: certCareerPath,
    courseName: (courseName || certCareerPath).trim(),
    certificateId,
    technicalScore: tech,
    communicationScore: comm,
    problemSolvingScore: prob,
    confidenceScore: conf,
    overallScore: numericOverall,
    sessionsCompleted: Math.max(1, Number(sessionsCompleted) || 1),
    interviewReadinessStatus: readiness,
    strengths: Array.isArray(strengths) && strengths.length > 0 ? strengths : defaultStrengths,
    improvements: Array.isArray(improvements) && improvements.length > 0 ? improvements : defaultImprovements,
    qrCode: qrCodeDataUrl,
    verificationUrl,
    passStatus: 'PASS',
    templateId,
    status: 'APPROVED',
    approvedBy: req.user?._id,
    approvedAt: new Date(),
    issuedBy: req.user?._id,
    issuedByName: req.user?.name || 'Administrator',
    adminSignatureBase64: signature,
    issueDate: certIssueDate,
    expiryDate: certExpiryDate,
    isActive: true,
  });

  await certificate.save();

  // Audit record of issuance
  await writeAuditLog(req, 'CERTIFICATE_ISSUED_BY_ADMIN', 'Certificate', certificate._id.toString(), {
    certificateId,
    studentId: student._id.toString(),
    studentName: student.name,
    studentEmail: student.email,
    careerPath: certCareerPath,
    overallScore: numericOverall,
    issuedById: req.user?._id,
    issuedByName: req.user?.name,
    issuedAt: new Date(),
  });

  res.status(201).json({
    message: `Verified Certificate ${certificateId} successfully issued to ${student.name}.`,
    certificate,
    verificationUrl,
    qrCode: qrCodeDataUrl,
  });
}));

// GET /api/admin/certificates - Audit list of all certificates
router.get('/certificates', asyncHandler(async (req, res) => {
  const { search = '', status = '', page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const query: any = {};
  if (status) query.status = status;
  if (search && String(search).trim()) {
    const searchRegex = new RegExp(String(search).trim(), 'i');
    query.$or = [
      { studentName: searchRegex },
      { email: searchRegex },
      { certificateId: searchRegex },
      { careerPath: searchRegex },
      { courseName: searchRegex },
      { issuedByName: searchRegex },
    ];
  }

  const [total, certificates] = await Promise.all([
    Certificate.countDocuments(query),
    Certificate.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
  ]);

  res.json({
    certificates,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
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

// ==========================================
// ADMIN TEST USERS / TEST CUSTOMERS MANAGEMENT
// ==========================================

const serializeTestUser = (user: any, profile?: any, sessionSummary?: any) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  testUserId: user.testUserId || user.testCredentials?.userId || user.email,
  temporaryPassword: user.testCredentials?.temporaryPassword,
  role: 'STUDENT',
  status: user.status || 'ACTIVE',
  isTestUser: true,
  isPreProductionUser: user.isPreProductionUser ?? true,
  betaAccess: user.betaAccess ?? true,
  careerDomain: user.careerDomain || profile?.domain || 'Computer Science',
  targetRole: user.targetRole || profile?.preferredRoles?.[0] || 'Software Engineer',
  department: user.department || profile?.branch || '',
  education: user.education || profile?.degree || '',
  experienceLevel: user.experienceLevel || 'Fresher',
  skills: profile?.skills || [],
  totalSessions: sessionSummary?.totalSessions ?? 0,
  latestScore: sessionSummary?.latestScore ?? profile?.skillDNA?.score ?? 0,
  latestReadiness: sessionSummary?.latestReadiness ?? 'NOT_READY',
  created_at: user.createdAt,
});

// POST /api/admin/test-users - Create pre-production student user with Beta Access
router.post('/test-users', protect, asyncHandler(async (req: AuthRequest, res) => {
  const {
    name,
    email,
    userId,
    password,
    careerDomain,
    targetRole,
    education,
    department,
    skills,
    experienceLevel,
  } = req.body;

  const displayName = (name || userId || 'Beta Student').trim();
  const testId = (userId || `BETA-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
  const normalizedEmail = (email || `${testId.toLowerCase()}@skilldna.local`).trim().toLowerCase();
  const rawPassword = (password || 'BetaStudentPass@123').trim();
  const domain = normalizeDomain(careerDomain);
  const role = (targetRole || 'Specialist').trim();

  // Check if email or test ID already exists
  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { testUserId: testId }]
  });
  if (existing) {
    res.status(400).json({ message: `Student with email ${normalizedEmail} or ID ${testId} already exists.` });
    return;
  }

  const adminId = req.user?._id || req.user?.id;

  // Create pre-production beta user
  const user = await User.create({
    name: displayName,
    full_name: displayName,
    email: normalizedEmail,
    password: rawPassword,
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    requiresPasswordChange: false,
    isTestUser: true,
    isPreProductionUser: true,
    betaAccess: true,
    testUserId: testId,
    careerDomain: domain,
    targetRole: role,
    education: education || 'Bachelor Degree',
    department: department || domain,
    experienceLevel: experienceLevel || 'Fresher',
    testCredentials: {
      userId: testId,
      temporaryPassword: rawPassword,
      generatedBy: adminId,
    },
    approved_by: adminId,
    approved_at: new Date(),
  });

  const parsedSkills = Array.isArray(skills) ? skills : (typeof skills === 'string' ? skills.split(',').map((s: string) => s.trim()).filter(Boolean) : [domain]);

  // Create Profile for test user
  const profile = await Profile.create({
    user: user._id,
    name: displayName,
    email: normalizedEmail,
    degree: education || 'B.Tech',
    branch: department || domain,
    college: 'SkillDNA Pre-Production Beta Program',
    semester: experienceLevel || 'Fresher',
    domain,
    skills: parsedSkills,
    preferredRoles: [role],
    bio: `Pre-production beta student for ${role} in ${domain}.`,
    skillDNA: {
      score: 0,
      technicalScore: 0,
      communicationScore: 0,
      confidenceScore: 0,
      aptitudeScore: 0,
      projectsScore: 0,
      strengths: [],
      weaknesses: [],
    }
  });

  // Initialize Career Twin Memory
  await CareerTwinMemory.create({
    user: user._id,
    domain,
    targetRole: role,
    benchmarks: {
      technical: 0,
      communication: 0,
      problemSolving: 0,
      confidence: 0,
      overall: 0,
    },
    weakAreas: [],
    strengths: [],
    milestones: [],
  });

  await writeAuditLog(req, 'PRE_PROD_USER_CREATED', 'User', user._id.toString(), { testUserId: testId, domain, role, email: normalizedEmail });

  const serialized = serializeTestUser(user, profile);

  res.status(201).json({
    ...serialized,
    user: serialized,
    credentials: {
      userId: testId,
      temporaryPassword: rawPassword,
      email: normalizedEmail,
    },
  });
}));

// GET /api/admin/test-users - List all pre-production beta users
router.get('/test-users', protect, asyncHandler(async (req: AuthRequest, res) => {
  const testUsers = await User.find({
    $or: [{ isTestUser: true }, { isPreProductionUser: true }]
  }).sort({ createdAt: -1 });

  const result = await Promise.all(
    testUsers.map(async (u) => {
      const profile = await Profile.findOne({ user: u._id }).lean();
      const totalSessions = await QuestionInterviewSession.countDocuments({ studentId: u._id, status: 'Completed' });
      const latestSession = await QuestionInterviewSession.findOne({ studentId: u._id, status: 'Completed' }).sort({ endTime: -1 }).lean();

      return serializeTestUser(u, profile, {
        totalSessions,
        latestScore: (latestSession as any)?.competencies?.overall ?? (profile as any)?.skillDNA?.score ?? 0,
        latestReadiness: (latestSession as any)?.finalReport?.readinessStatus ?? 'NOT_READY',
      });
    })
  );

  res.json(result);
}));

// GET /api/admin/test-users/:id - Detailed pre-production beta user inspection
router.get('/test-users/:id', protect, asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id);
  if (!user || (!user.isTestUser && !user.isPreProductionUser)) {
    res.status(404).json({ message: 'Pre-production user not found' });
    return;
  }

  const profile = await Profile.findOne({ user: user._id }).lean();
  const careerTwin = await CareerTwinMemory.findOne({ user: user._id }).lean();
  const sessions = await QuestionInterviewSession.find({ studentId: user._id }).sort({ createdAt: -1 }).lean();
  const answers = await StudentAnswer.find({ studentId: user._id }).sort({ createdAt: -1 }).limit(50).populate('questionId', 'question topic field difficulty').lean();

  res.json({
    user: serializeTestUser(user, profile),
    profile,
    careerTwin,
    sessions,
    answers,
  });
}));

// PATCH /api/admin/test-users/:id/status - Toggle active/disabled status
router.patch('/test-users/:id/status', protect, asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id);
  if (!user || (!user.isTestUser && !user.isPreProductionUser)) {
    res.status(404).json({ message: 'Pre-production user not found' });
    return;
  }

  const { status } = req.body;
  if (!['ACTIVE', 'DISABLED'].includes(status)) {
    res.status(400).json({ message: 'Status must be ACTIVE or DISABLED' });
    return;
  }

  user.status = status;
  user.disabled_at = status === 'DISABLED' ? new Date() : undefined;
  await user.save();

  await writeAuditLog(req, 'PRE_PROD_USER_STATUS_UPDATED', 'User', user._id.toString(), { status });
  res.json(serializeTestUser(user));
}));

// POST /api/admin/test-users/:id/login-token - Instant login token for Pre-Production Beta user
router.post('/test-users/:id/login-token', protect, asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id);
  if (!user || (!user.isTestUser && !user.isPreProductionUser)) {
    res.status(404).json({ message: 'Pre-production user not found' });
    return;
  }

  const token = generateToken(user._id.toString());
  res.json({
    token,
    user: {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      betaAccess: user.betaAccess ?? true,
      isPreProductionUser: user.isPreProductionUser ?? true,
      careerDomain: user.careerDomain,
      targetRole: user.targetRole,
    }
  });
}));

// POST /api/admin/test-users/:id/reset - Granular test reset
router.post('/test-users/:id/reset', protect, asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id);
  if (!user || (!user.isTestUser && !user.isPreProductionUser)) {
    res.status(404).json({ message: 'Pre-production user not found' });
    return;
  }

  const {
    resetInterview = true,
    resetCareerTwin = true,
    resetSkillDNA = true,
    resetCertificates = true,
    resetCourses = true,
  } = req.body;

  const resetLog: Record<string, boolean> = {};

  if (resetInterview) {
    await QuestionInterviewSession.deleteMany({ studentId: user._id });
    await StudentAnswer.deleteMany({ studentId: user._id });
    await InterviewSession.deleteMany({ student: user._id });
    resetLog.interviews = true;
  }

  if (resetCareerTwin) {
    await CareerTwinMemory.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          benchmarks: { technical: 0, communication: 0, problemSolving: 0, confidence: 0, overall: 0 },
          weakAreas: [],
          strengths: [],
          milestones: [],
          lastEvaluatedAt: null,
        }
      }
    );
    resetLog.careerTwin = true;
  }

  if (resetSkillDNA) {
    await Profile.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          'skillDNA.score': 0,
          'skillDNA.technicalScore': 0,
          'skillDNA.communicationScore': 0,
          'skillDNA.confidenceScore': 0,
          'skillDNA.projectsScore': 0,
          'skillDNA.aptitudeScore': 0,
          'skillDNA.strengths': [],
          'skillDNA.weaknesses': [],
        }
      }
    );
    resetLog.skillDNA = true;
  }

  if (resetCertificates) {
    await Certificate.deleteMany({ studentId: user._id });
    resetLog.certificates = true;
  }

  await writeAuditLog(req, 'PRE_PROD_USER_RESET', 'User', user._id.toString(), resetLog);

  res.json({
    message: `User data successfully reset.`,
    resetOperations: resetLog,
  });
}));

// DELETE /api/admin/test-users/:id - Delete pre-production user
router.delete('/test-users/:id', protect, asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id);
  if (!user || (!user.isTestUser && !user.isPreProductionUser)) {
    res.status(404).json({ message: 'Pre-production user not found' });
    return;
  }

  await Promise.all([
    User.deleteOne({ _id: user._id }),
    Profile.deleteOne({ user: user._id }),
    CareerTwinMemory.deleteOne({ user: user._id }),
    QuestionInterviewSession.deleteMany({ studentId: user._id }),
    StudentAnswer.deleteMany({ studentId: user._id }),
    Certificate.deleteMany({ studentId: user._id }),
  ]);

  await writeAuditLog(req, 'PRE_PROD_USER_DELETED', 'User', user._id.toString(), { testUserId: user.testUserId });
  res.json({ message: `Pre-production user ${user.testUserId || user.name} deleted successfully.` });
}));

export default router;
