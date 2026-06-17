import express from 'express';
import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import Report from '../models/report';
import Profile from '../models/profile';
import ReportView from '../models/reportView';
import { protect, AuthRequest } from '../middleware/auth';
import { env } from '../config/env';
import { sendRecruiterShareEmail } from '../services/email';
import { isAdminRole, isHiringRole, normalizeRole } from '../utils/rbac';
import { writeAuditLog } from '../utils/audit';

const router = express.Router();

const createVerificationId = () => `SDNA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const createShareToken = () => crypto.randomBytes(24).toString('hex');
const escapePdfText = (value: unknown) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const buildScorecardPdf = (report: any) => {
  const lines = [
    'SkillDNA Scorecard Report',
    `Verification ID: ${report.verificationId}`,
    `Student: ${report.get('studentSnapshot.name') || 'Student'}`,
    `Overall Score: ${report.skillDNAScore ?? 0}%`,
    `Interview Score: ${report.interviewScore ?? 0}%`,
    `Communication / English Score: ${report.communicationScore ?? 0}%`,
    `Confidence Score: ${report.confidenceScore ?? 0}%`,
    `Technical Score: ${report.technicalScore ?? 0}%`,
    `Strengths: ${(report.strengths ?? []).join(', ') || 'Not available'}`,
    `Weaknesses: ${(report.weaknesses ?? []).join(', ') || 'Not available'}`,
    `AI Feedback: ${report.aiRecommendationSummary || 'Keep practicing and improving your SkillDNA profile.'}`,
  ];

  const content = [
    'BT',
    '/F1 18 Tf',
    '72 760 Td',
    `(${escapePdfText(lines[0])}) Tj`,
    '/F1 10 Tf',
    ...lines.slice(1).flatMap((line) => ['0 -24 Td', `(${escapePdfText(line)}) Tj`]),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

router.get('/', protect, asyncHandler(async (req: AuthRequest, res) => {
  const query = isAdminRole(req.user.role, req.user.email) ? {} : { student: req.user._id };
  const reports = await Report.find(query).populate('profile').sort({ createdAt: -1 });
  res.json(reports);
}));

router.get('/me/scorecards', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (normalizeRole(req.user.role, req.user.email) !== 'STUDENT') {
    res.status(403).json({ message: 'Only students can view their own scorecards' });
    return;
  }

  const reports = await Report.find({ student: req.user._id }).populate('profile').sort({ createdAt: -1 }).limit(24);
  const latest = reports[0] ?? null;

  const history = reports
    .slice()
    .reverse()
    .map((report: any, index) => ({
      label: `Report ${index + 1}`,
      reportId: report._id,
      createdAt: report.createdAt,
      interviewScore: report.interviewScore ?? 0,
      communicationScore: report.communicationScore ?? 0,
      englishScore: report.communicationScore ?? 0,
      confidenceScore: report.confidenceScore ?? 0,
      technicalScore: report.technicalScore ?? 0,
      overallScore: report.skillDNAScore ?? 0,
    }));

  res.json({
    latest,
    history,
    trend: history,
    feedback: latest?.aiRecommendationSummary ?? '',
    strengths: latest?.strengths ?? [],
    weaknesses: latest?.weaknesses ?? [],
    pdfReportUrl: latest ? `/reports/${latest._id}/pdf` : '',
  });
}));

router.post('/', protect, asyncHandler(async (req: AuthRequest, res) => {
  const { profileId, interviewScore = 0 } = req.body;
  const profile = await Profile.findById(profileId ?? req.body.profile).populate('user', 'name email');

  if (!profile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const skillDNA = profile.get('skillDNA') ?? {};
  const verificationId = createVerificationId();
  const publicUrl = `${env.appBaseUrl}/report/${verificationId}`;
  const report = new Report({
    profile: profile._id,
    student: profile.get('user')?._id ?? req.user._id,
    studentSnapshot: {
      name: profile.get('name'),
      photoUrl: profile.get('photoUrl'),
      college: profile.get('college'),
      field: profile.get('branch') || profile.get('domain'),
    },
    badge: skillDNA.badge ?? 'Bronze',
    salaryEstimate: skillDNA.salaryRangeEstimate ?? 'TBD',
    skillDNAScore: skillDNA.score ?? 0,
    interviewScore,
    communicationScore: skillDNA.communicationScore ?? 0,
    confidenceScore: skillDNA.confidenceScore ?? 0,
    technicalScore: skillDNA.technicalScore ?? 0,
    projectsScore: skillDNA.projectsScore ?? 0,
    certificationScore: skillDNA.certificationScore ?? 0,
    strengths: skillDNA.strengths ?? [],
    weaknesses: skillDNA.weaknesses ?? [],
    recommendedRoles: skillDNA.careerPathSuggestions ?? [],
    aiRecommendationSummary: 'AI recommends continued domain practice, interview rehearsal, and recruiter-ready profile completion.',
    verificationId,
    publicUrl,
    qrPayload: publicUrl,
  });
  const saved = await report.save();
  await writeAuditLog(req, 'REPORT_CREATED', 'Report', saved._id.toString(), { student: saved.get('student')?.toString() });
  res.status(201).json(saved);
}));

router.get('/public/:verificationId', asyncHandler(async (req, res) => {
  const report = await Report.findOne({ verificationId: req.params.verificationId }).populate('profile');

  if (!report) {
    res.status(404).json({ message: 'Report not found' });
    return;
  }

  await ReportView.create({
    report: report._id,
    verificationId: report.verificationId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  report.set('analytics.totalViews', (report.get('analytics.totalViews') ?? 0) + 1);
  await report.save();

  res.json(report);
}));

router.post('/:id/share', protect, asyncHandler(async (req: AuthRequest, res) => {
  const { recruiterEmail, company = '', expiryDays = 14 } = req.body;
  const report = await Report.findById(req.params.id);

  if (!report) {
    res.status(404).json({ message: 'Report not found' });
    return;
  }

  const ownsReport = report.get('student')?.toString() === req.user?._id?.toString();
  if (!ownsReport && !isAdminRole(req.user?.role, req.user?.email)) {
    res.status(403).json({ message: 'You can only share your own report' });
    return;
  }

  const token = createShareToken();
  const expiresAt = new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000);
  report.shareTokens.push({ token, recruiterEmail, company, expiresAt });
  await report.save();

  const link = `${env.appBaseUrl}/recruiter/report/${token}`;
  await sendRecruiterShareEmail(recruiterEmail, link, report.get('studentSnapshot.name') || 'A student');

  res.status(201).json({ token, link, expiresAt });
}));

router.get('/secure/:token', asyncHandler(async (req, res) => {
  const report = await Report.findOne({ 'shareTokens.token': req.params.token }).populate('profile');

  if (!report) {
    res.status(404).json({ message: 'Secure report link not found' });
    return;
  }

  const share = report.shareTokens.find((item: any) => item.token === req.params.token);
  if (!share || share.expiresAt.getTime() < Date.now()) {
    res.status(410).json({ message: 'Secure report link expired' });
    return;
  }

  share.viewedAt = new Date();
  report.set('analytics.totalViews', (report.get('analytics.totalViews') ?? 0) + 1);
  report.set('analytics.recruiterViews', (report.get('analytics.recruiterViews') ?? 0) + 1);
  await report.save();

  await ReportView.create({
    report: report._id,
    verificationId: report.verificationId,
    recruiterEmail: share.recruiterEmail,
    company: share.company,
    token: req.params.token,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(report);
}));

router.get('/:id/pdf', protect, asyncHandler(async (req: AuthRequest, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    res.status(404).json({ message: 'Report not found' });
    return;
  }

  const ownsReport = report.get('student')?.toString() === req.user?._id?.toString();
  if (!ownsReport && !isHiringRole(req.user?.role, req.user?.email)) {
    res.status(403).json({ message: 'You do not have access to this report' });
    return;
  }

  const pdf = buildScorecardPdf(report);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${report.verificationId}.pdf"`);
  res.send(pdf);
}));

router.get('/:id/views', protect, asyncHandler(async (req: AuthRequest, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    res.status(404).json({ message: 'Report not found' });
    return;
  }

  const ownsReport = report.get('student')?.toString() === req.user?._id?.toString();
  if (!ownsReport && !isAdminRole(req.user?.role, req.user?.email)) {
    res.status(403).json({ message: 'You do not have access to these report views' });
    return;
  }

  const views = await ReportView.find({ report: report._id }).sort({ createdAt: -1 });
  res.json(views);
}));

export default router;
