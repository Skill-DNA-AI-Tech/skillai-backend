import { Router, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import Certificate, { ICertificate } from '../models/certificate';
import CertificateTemplate from '../models/certificateTemplate';
import Assessment from '../models/assessment';
import User from '../models/user';
import { env } from '../config/env';
import { protect, AuthRequest } from '../middleware/auth';
import { QuestionInterviewSession } from '../models/questionBank';
import Profile from '../models/profile';
import { isAdminRole } from '../utils/rbac';
import QRCode from 'qrcode';

const router = Router();

// Generate unique certificate ID in format SDNA-CERT-YYYY-XXXXXX
export const generateCertificateId = (): string => {
  const year = new Date().getFullYear();
  const hex = randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
  return `SDNA-CERT-${year}-${hex}`;
};

// Create / Claim certificate for a student (tamper-proof, server-side validated only)
router.post(
  '/create',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const studentId = req.user._id;
    const student = await User.findById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // 1. Fetch latest verified assessment or interview session strictly from server records
    const requestedSessionId = req.body?.sessionId;
    const requestedAssessmentId = req.body?.assessmentId;

    let verifiedAssessment = null;
    if (requestedAssessmentId && mongoose.Types.ObjectId.isValid(requestedAssessmentId)) {
      verifiedAssessment = await Assessment.findOne({
        _id: requestedAssessmentId,
        studentId: req.user._id,
        overallScore: { $gte: 75 }
      });
    } else {
      verifiedAssessment = await Assessment.findOne({
        studentId: req.user._id,
        overallScore: { $gte: 75 }
      }).sort({ createdAt: -1 });
    }

    let latestSession = null;
    if (requestedSessionId) {
      const sessionOrQueries: any[] = [{ sessionId: requestedSessionId }];
      if (mongoose.Types.ObjectId.isValid(requestedSessionId)) {
        sessionOrQueries.push({ _id: requestedSessionId });
      }
      latestSession = await QuestionInterviewSession.findOne({
        $or: sessionOrQueries,
        studentId,
        status: 'Completed'
      });
    } else {
      latestSession = await QuestionInterviewSession.findOne({ studentId, status: 'Completed' }).sort({ updatedAt: -1 });
    }

    let verifiedOverall = 0;
    let technicalScore = 0;
    let communicationScore = 0;
    let problemSolvingScore = 0;
    let confidenceScore = 0;
    let careerPath = '';
    let strengths: string[] = [];
    let improvements: string[] = [];
    let assessmentId: any = undefined;

    if (verifiedAssessment) {
      verifiedOverall = verifiedAssessment.overallScore;
      technicalScore = verifiedAssessment.competencies?.technicalKnowledge || verifiedOverall;
      communicationScore = verifiedAssessment.competencies?.communication || 75;
      problemSolvingScore = verifiedAssessment.competencies?.problemSolving || 75;
      confidenceScore = verifiedAssessment.competencies?.confidence || 75;
      careerPath = verifiedAssessment.careerDomain || verifiedAssessment.targetRole || 'Career Development';
      strengths = verifiedAssessment.strengths || [];
      improvements = verifiedAssessment.weakTopics || [];
      assessmentId = verifiedAssessment._id;
    } else if (latestSession && latestSession.finalReport) {
      const rep = latestSession.finalReport;
      verifiedOverall = rep.overallScore || 0;
      technicalScore = rep.competencies?.technical || latestSession.competencies?.technical || 0;
      communicationScore = rep.competencies?.communication || latestSession.competencies?.communication || 0;
      problemSolvingScore = rep.competencies?.problemSolving || latestSession.competencies?.problemSolving || 0;
      confidenceScore = rep.competencies?.confidence || latestSession.competencies?.confidence || 0;
      careerPath = latestSession.careerDomain || latestSession.field || 'Career Development';
      strengths = rep.strengths || [];
      improvements = rep.weaknesses || [];
    }

    // STRICT USER REQUIREMENT: Minimum 75% overall score required to generate certificate
    if (verifiedOverall < 75) {
      res.status(400).json({
        error: `Your verified assessment score is ${verifiedOverall}%. A minimum passing score of ${75}% is required to generate or claim a SkillDNA Verified Certificate. Please review your personalized study notes, practice weak topics, and retake the assessment.`,
      });
      return;
    }

    // DUPLICATE CHECK: Prevent duplicate active certificate for same student and career
    const escapedCareer = careerPath.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingActiveCert = await Certificate.findOne({
      studentId,
      careerPath: { $regex: new RegExp(`^${escapedCareer}$`, 'i') },
      isActive: true,
      status: 'APPROVED',
    });

    if (existingActiveCert) {
      res.status(400).json({
        error: `An active certificate (${existingActiveCert.certificateId}) has already been issued to you for '${careerPath}'. Duplicate certificates are not permitted.`,
        certificate: existingActiveCert,
        certificateId: existingActiveCert.certificateId,
      });
      return;
    }

    // Determine interview readiness status
    let interviewReadinessStatus: 'NOT_READY' | 'IN_PROGRESS' | 'READY' | 'ADVANCED';
    if (verifiedOverall >= 85) {
      interviewReadinessStatus = 'ADVANCED';
    } else if (verifiedOverall >= 75) {
      interviewReadinessStatus = 'READY';
    } else {
      interviewReadinessStatus = 'IN_PROGRESS';
    }

    // Fetch active template configuration
    const activeTemplate = await CertificateTemplate.findOne({ isActive: true }) || await CertificateTemplate.findOne();
    const templateId = activeTemplate?.templateId || 'template-01';

    // Count sessions
    const actualSessions = await QuestionInterviewSession.countDocuments({ studentId, status: 'Completed' });

    // Certificate valid for 1 year
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const certificateId = generateCertificateId();
    const baseUrl = env.appBaseUrl || 'http://localhost:4173';
    const verificationUrl = `${baseUrl}/verify/${certificateId}`;

    let qrCode = '';
    try {
      qrCode = await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 320,
        color: { dark: '#0284c7', light: '#ffffff' },
      });
    } catch {
      qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(verificationUrl)}`;
    }

    const certificate = new Certificate({
      studentId,
      studentName: student.name,
      email: student.email,
      careerPath,
      courseName: careerPath,
      certificateId,
      technicalScore,
      communicationScore,
      problemSolvingScore,
      confidenceScore,
      overallScore: verifiedOverall,
      passStatus: 'PASS',
      templateId,
      assessmentId,
      sessionsCompleted: actualSessions || 1,
      interviewReadinessStatus,
      strengths: strengths.length > 0 ? strengths : ['Technical Proficiency', 'Analytical Thinking'],
      improvements: improvements.length > 0 ? improvements : ['Continuous Domain Exploration'],
      status: 'APPROVED', // Auto-approved upon verified >= 75 assessment
      qrCode,
      verificationUrl,
      expiryDate,
      adminRemark: (req.body?.adminRemark || req.body?.officialRemark || '').trim(),
      officialRemark: (req.body?.officialRemark || req.body?.adminRemark || '').trim(),
      isActive: true,
    });

    await certificate.save();

    res.status(201).json({
      message: 'Certificate created successfully',
      certificate: {
        ...certificate.toObject(),
        certificateNumber: certificate.certificateId,
      },
      certificateId,
      certificateNumber: certificateId,
    });
  })
);

// Get student's certificates
router.get(
  '/my-certificates',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const certificates = await Certificate.find({
      studentId: req.user.id,
      isActive: true,
    }).sort({ issueDate: -1 });

    res.status(200).json(certificates);
  })
);

// Get a specific student's certificates by studentId
router.get(
  '/student/:studentId',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const certificates = await Certificate.find({
      studentId: req.params.studentId,
      isActive: true,
    }).sort({ issueDate: -1 });

    res.status(200).json(certificates);
  })
);

// GET /api/certificates/verify/:certificateId - Public verification endpoint (No auth required)
router.get(
  '/verify/:certificateId',
  asyncHandler(async (req: any, res: Response) => {
    const { certificateId } = req.params;

    const certificate = await Certificate.findOne({
      certificateId,
      isActive: true,
    });

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found or has been revoked.', valid: false, verified: false });
      return;
    }

    const isExpired = certificate.expiryDate && new Date() > new Date(certificate.expiryDate);
    if (isExpired) {
      res.status(410).json({ error: 'This certificate has expired.', valid: false, verified: false, certificate });
      return;
    }

    const template = await CertificateTemplate.findOne({ templateId: certificate.templateId }) ||
      await CertificateTemplate.findOne({ isActive: true });

    res.json({
      message: 'Certificate verified and authentic.',
      valid: true,
      verified: true,
      certificate: {
        certificateId: certificate.certificateId,
        studentName: certificate.studentName,
        email: certificate.email ? `${certificate.email.slice(0, 3)}***@${certificate.email.split('@')[1]}` : 'N/A',
        careerPath: certificate.careerPath,
        overallScore: certificate.overallScore,
        passStatus: certificate.overallScore >= 75 ? 'PASS' : 'FAIL',
        technicalScore: certificate.technicalScore,
        communicationScore: certificate.communicationScore,
        problemSolvingScore: certificate.problemSolvingScore,
        confidenceScore: certificate.confidenceScore,
        issueDate: certificate.issueDate,
        expiryDate: certificate.expiryDate,
        interviewReadinessStatus: certificate.interviewReadinessStatus,
        strengths: certificate.strengths,
        improvements: certificate.improvements,
        status: certificate.status,
        qrCode: certificate.qrCode,
        issuedByName: certificate.issuedByName || 'SkillDNA AI Certification Authority',
        adminSignatureBase64: certificate.adminSignatureBase64,
        adminRemark: certificate.adminRemark || certificate.officialRemark || '',
        officialRemark: certificate.officialRemark || certificate.adminRemark || '',
        template,
      },
    });
  })
);

// Share certificate with recruiter
router.post(
  '/:certificateId/share',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { certificateId } = req.params;
    const { recruiterEmail } = req.body;

    if (!recruiterEmail) {
      res.status(400).json({ error: 'Recruiter email is required' });
      return;
    }

    const certificate = await Certificate.findOne({
      certificateId,
      studentId: req.user.id,
      isActive: true,
    });

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    // Check if already shared with this recruiter
    const alreadyShared = certificate.sharedWith.some(
      (share) => share.recruiterEmail === recruiterEmail
    );

    if (!alreadyShared) {
      certificate.sharedWith.push({
        recruiterId: new (require('mongoose').Types.ObjectId)(),
        recruiterEmail,
        sharedAt: new Date(),
      });
      await certificate.save();
    }

    res.status(200).json({
      message: 'Certificate shared successfully',
      certificate,
    });
  })
);

// Update certificate (admin or student)
router.patch(
  '/:certificateId',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { certificateId } = req.params;
    const updateData = req.body;

    const certificate = await Certificate.findOne({
      certificateId,
      studentId: req.user.id,
      isActive: true,
    });

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    // Allow updating: strengths, improvements, interviewReadinessStatus
    const allowedFields = ['strengths', 'improvements', 'interviewReadinessStatus'];
    Object.keys(updateData).forEach((key) => {
      if (allowedFields.includes(key)) {
        (certificate as any)[key] = updateData[key];
      }
    });

    await certificate.save();

    res.status(200).json({
      message: 'Certificate updated',
      certificate,
    });
  })
);

// Revoke certificate (admin only)
router.delete(
  '/:certificateId',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Only admins and staff can revoke certificates' });
      return;
    }

    const { certificateId } = req.params;

    const certificate = await Certificate.findOneAndUpdate(
      { certificateId },
      { isActive: false },
      { new: true }
    );

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    res.status(200).json({
      message: 'Certificate revoked successfully',
      certificate,
    });
  })
);

// Download PDF certificate
router.get(
  '/:certificateId/pdf',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { certificateId } = req.params;

    const certificate = await Certificate.findOne({
      certificateId,
      isActive: true,
    });

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    if (certificate.status !== 'APPROVED') {
      res.status(400).json({ error: 'Certificate is pending official admin approval and signature.' });
      return;
    }

    // Call Python service to generate PDF
    const aiServiceUrl = env.aiServiceUrl;
    if (!aiServiceUrl) {
      res.status(503).json({ error: 'AI service URL is not configured' });
      return;
    }
    
    try {
      const pdfResponse = await fetch(`${aiServiceUrl}/api/certificate/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          certificate: certificate.toObject(),
          verifyUrl: `${env.appBaseUrl}/certificate`,
        }),
      });

      if (!pdfResponse.ok) {
        throw new Error('Failed to generate PDF from AI service');
      }

      const pdfBuffer = await pdfResponse.arrayBuffer();

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="SkillDNA-Certificate-${certificateId}.pdf"`
      );

      res.send(Buffer.from(pdfBuffer));
    } catch (err) {
      console.error('PDF generation error:', err);
      res.status(500).json({ error: 'Failed to generate PDF certificate' });
    }
  })
);

// GET all pending certificates (admin/employee/staff only)
router.get(
  '/admin/pending',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const pending = await Certificate.find({
      status: 'PENDING',
      isActive: true,
    }).sort({ createdAt: -1 });

    res.status(200).json(pending);
  })
);

// GET approving admin's signature (admin/employee/staff only)
router.get(
  '/admin/signature',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const adminUser = await User.findById(req.user.id);
    if (!adminUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ signatureBase64: adminUser.signatureBase64 || '' });
  })
);

// POST save signature (admin/employee/staff only)
router.post(
  '/admin/signature',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { signatureBase64 } = req.body;
    if (!signatureBase64) {
      res.status(400).json({ error: 'Signature data is required' });
      return;
    }

    await User.findByIdAndUpdate(req.user.id, { signatureBase64 });

    res.status(200).json({ message: 'Digital signature saved successfully' });
  })
);

// POST approve a certificate (admin/employee/staff only)
router.post(
  '/admin/approve/:certificateId',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { certificateId } = req.params;
    const {
      careerPath,
      technicalScore,
      communicationScore,
      problemSolvingScore,
      confidenceScore,
      strengths,
      improvements,
    } = req.body;

    const adminUser = await User.findById(req.user.id);
    if (!adminUser || !adminUser.signatureBase64) {
      res.status(400).json({ error: 'You must configure your digital signature in settings before approving certificates.' });
      return;
    }

    const certificate = await Certificate.findOne({
      certificateId,
      isActive: true,
    });

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    // Update fields if provided by admin/staff
    if (careerPath) certificate.careerPath = careerPath;
    if (typeof technicalScore === 'number') certificate.technicalScore = technicalScore;
    if (typeof communicationScore === 'number') certificate.communicationScore = communicationScore;
    if (typeof problemSolvingScore === 'number') certificate.problemSolvingScore = problemSolvingScore;
    if (typeof confidenceScore === 'number') certificate.confidenceScore = confidenceScore;
    if (strengths) certificate.strengths = strengths;
    if (improvements) certificate.improvements = improvements;

    // Recalculate overall score
    const total = certificate.technicalScore + certificate.communicationScore + certificate.problemSolvingScore + certificate.confidenceScore;
    certificate.overallScore = Math.round(total / 4);

    // Recalculate interview readiness
    if (certificate.overallScore >= 85) {
      certificate.interviewReadinessStatus = 'ADVANCED';
    } else if (certificate.overallScore >= 70) {
      certificate.interviewReadinessStatus = 'READY';
    } else if (certificate.overallScore >= 50) {
      certificate.interviewReadinessStatus = 'IN_PROGRESS';
    } else {
      certificate.interviewReadinessStatus = 'NOT_READY';
    }

    // Set approval status and digital signature
    certificate.status = 'APPROVED';
    certificate.approvedBy = adminUser._id as any;
    certificate.approvedAt = new Date();
    certificate.adminSignatureBase64 = adminUser.signatureBase64;

    await certificate.save();

    res.status(200).json({
      message: 'Certificate digitally signed and approved successfully',
      certificate,
    });
  })
);

// POST reject a certificate (admin/employee/staff only)
router.post(
  '/admin/reject/:certificateId',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { certificateId } = req.params;

    const certificate = await Certificate.findOneAndUpdate(
      { certificateId, isActive: true },
      { status: 'REJECTED' },
      { new: true }
    );

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    res.status(200).json({
      message: 'Certificate rejected successfully',
      certificate,
    });
  })
);

// ===== ADMIN CERTIFICATE TEMPLATE & DESIGN SYSTEM ROUTES =====

// GET /api/certificates/admin/templates - List all certificate design templates
router.get(
  '/admin/templates',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
      return;
    }

    let templates = await CertificateTemplate.find().sort({ createdAt: 1 });

    // Auto-seed standard templates if none exist
    if (templates.length === 0) {
      const defaultTemplates = [
        {
          templateId: 'template-01',
          name: 'Template 01 — Modern Cybernetic (Cyan)',
          description: 'Contemporary high-tech design with neon cyan accents, dark backdrop, and digital security badge.',
          primaryColor: '#0f172a',
          secondaryColor: '#06b6d4',
          accentColor: '#38bdf8',
          fontFamily: 'Inter, sans-serif',
          orgName: 'SkillDNA AI Global Certification Authority',
          signatoryName: 'Dr. Evelyn Carter',
          signatoryTitle: 'Head of AI Assessment & Verification',
          layoutStyle: 'MODERN',
          numberingFormat: 'SDNA-CERT-YYYY-XXXXXX',
          headerText: 'Verified Competency Credential',
          footerText: 'Officially verified and ledger-stamped by SkillDNA AI Autonomous Evaluator',
          watermarkText: 'SKILLDNA VERIFIED',
          showQrCode: true,
          showCompetencies: true,
          isActive: true,
        },
        {
          templateId: 'template-02',
          name: 'Template 02 — Executive Academic (Emerald)',
          description: 'Formal credential aesthetic featuring emerald borders, ornate seal, and prestigious typographic balance.',
          primaryColor: '#022c22',
          secondaryColor: '#10b981',
          accentColor: '#f59e0b',
          fontFamily: 'Georgia, serif',
          orgName: 'SkillDNA Institute of Professional Excellence',
          signatoryName: 'Prof. Marcus Vance',
          signatoryTitle: 'Dean of Industrial Employability',
          layoutStyle: 'CLASSIC',
          numberingFormat: 'SDNA-CERT-YYYY-XXXXXX',
          headerText: 'Certificate of Professional Achievement',
          footerText: 'Recognized by SkillDNA Partner Employers Worldwide',
          watermarkText: 'ACADEMIC MERIT',
          showQrCode: true,
          showCompetencies: true,
          isActive: false,
        },
        {
          templateId: 'template-03',
          name: 'Template 03 — Sovereign Gold (Luxury)',
          description: 'Luxurious gold-gilded frame design tailored for top-tier candidates scoring 85%+ honors.',
          primaryColor: '#18181b',
          secondaryColor: '#f59e0b',
          accentColor: '#fbbf24',
          fontFamily: 'Cinzel, serif',
          orgName: 'SkillDNA Global Honors Council',
          signatoryName: 'Dame Sarah Jenkins',
          signatoryTitle: 'Chief Examination Officer',
          layoutStyle: 'ELEGANT',
          numberingFormat: 'SDNA-CERT-YYYY-XXXXXX',
          headerText: 'Distinguished Certificate of Excellence',
          footerText: 'Awarded for exceptional performance exceeding top 90th percentile benchmarks',
          watermarkText: 'HONORS DISTINCTION',
          showQrCode: true,
          showCompetencies: true,
          isActive: false,
        },
        {
          templateId: 'custom',
          name: 'Custom Template — Bespoke Admin Layout',
          description: 'Fully customizable canvas with user-defined hex colors, branding, custom signatures, and layout formatting.',
          primaryColor: '#1e1b4b',
          secondaryColor: '#818cf8',
          accentColor: '#c084fc',
          fontFamily: 'Inter, sans-serif',
          orgName: 'SkillDNA Enterprise Academy',
          signatoryName: 'Admin Director',
          signatoryTitle: 'Director of Evaluation Operations',
          layoutStyle: 'MINIMAL',
          numberingFormat: 'SDNA-CERT-YYYY-XXXXXX',
          headerText: 'Certificate of Verified Mastery',
          footerText: 'Tamper-evident verification available via QR scan or URL lookup',
          watermarkText: 'OFFICIAL RECORD',
          showQrCode: true,
          showCompetencies: true,
          isActive: false,
        },
      ];

      await CertificateTemplate.insertMany(defaultTemplates);
      templates = await CertificateTemplate.find().sort({ createdAt: 1 });
    }

    res.json(templates);
  })
);

// POST /api/certificates/admin/templates - Create new certificate design template
router.post(
  '/admin/templates',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
      return;
    }

    const {
      templateId,
      name,
      description,
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily,
      logoUrl,
      orgName,
      signatureUrl,
      signatoryName,
      signatoryTitle,
      layoutStyle,
      numberingFormat,
      headerText,
      footerText,
      watermarkText,
      showQrCode,
      showCompetencies,
      isActive,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Template name is required.' });
      return;
    }

    const template = new CertificateTemplate({
      templateId: templateId || `custom-${Date.now()}`,
      name,
      description: description || '',
      primaryColor: primaryColor || '#0f172a',
      secondaryColor: secondaryColor || '#06b6d4',
      accentColor: accentColor || '#f59e0b',
      fontFamily: fontFamily || 'Inter, sans-serif',
      logoUrl: logoUrl || '/brand/logo.svg',
      orgName: orgName || 'SkillDNA AI Global Certification Authority',
      signatureUrl: signatureUrl || '',
      signatoryName: signatoryName || 'Dr. Evelyn Carter',
      signatoryTitle: signatoryTitle || 'Head of AI Assessment',
      layoutStyle: layoutStyle || 'MODERN',
      numberingFormat: numberingFormat || 'SDNA-CERT-YYYY-XXXXXX',
      headerText: headerText || 'Verified Competency Credential',
      footerText: footerText || 'Officially verified and registered on SkillDNA AI Ledger',
      watermarkText: watermarkText || 'SKILLDNA VERIFIED',
      showQrCode: showQrCode !== undefined ? showQrCode : true,
      showCompetencies: showCompetencies !== undefined ? showCompetencies : true,
      isActive: Boolean(isActive),
      createdBy: req.user._id,
    });

    if (isActive) {
      await CertificateTemplate.updateMany({}, { isActive: false });
    }

    await template.save();

    res.status(201).json({
      message: 'Certificate design template created successfully',
      template,
    });
  })
);

// PUT /api/certificates/admin/templates/:id - Update existing certificate template
router.put(
  '/admin/templates/:id',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
      return;
    }

    const template = await CertificateTemplate.findById(req.params.id);
    if (!template) {
      res.status(404).json({ error: 'Certificate template not found.' });
      return;
    }

    const updatable = [
      'name', 'description', 'primaryColor', 'secondaryColor', 'accentColor',
      'fontFamily', 'logoUrl', 'orgName', 'signatureUrl', 'signatoryName',
      'signatoryTitle', 'layoutStyle', 'numberingFormat', 'headerText',
      'footerText', 'watermarkText', 'showQrCode', 'showCompetencies', 'isActive',
    ];

    for (const key of updatable) {
      if (req.body[key] !== undefined) {
        (template as any)[key] = req.body[key];
      }
    }

    if (req.body.isActive) {
      await CertificateTemplate.updateMany({ _id: { $ne: template._id } }, { isActive: false });
    }

    await template.save();

    res.json({
      message: 'Certificate template updated successfully',
      template,
    });
  })
);

// POST or PATCH /api/certificates/admin/templates/:id/activate - Set template as active
const activateTemplateHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
    res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    return;
  }

  await CertificateTemplate.updateMany({}, { isActive: false });
  const template = await CertificateTemplate.findByIdAndUpdate(
    req.params.id,
    { isActive: true },
    { new: true }
  );

  if (!template) {
    res.status(404).json({ error: 'Certificate template not found.' });
    return;
  }

  res.json({
    message: `Template "${template.name}" activated as the platform default`,
    template,
  });
});

router.post('/admin/templates/:id/activate', protect, activateTemplateHandler);
router.patch('/admin/templates/:id/activate', protect, activateTemplateHandler);


// GET /api/certificates/admin/all - Search, filter, and audit all certificates
router.get(
  '/admin/all',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
      return;
    }

    const { search = '', status = '', page = 1, limit = 20 } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { studentName: new RegExp(String(search), 'i') },
        { email: new RegExp(String(search), 'i') },
        { certificateId: new RegExp(String(search), 'i') },
        { careerPath: new RegExp(String(search), 'i') },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const certificates = await Certificate.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    const total = await Certificate.countDocuments(query);

    res.json({
      certificates,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  })
);

// POST /api/certificates/admin/regenerate/:certificateId - Regenerate certificate with current active template
router.post(
  '/admin/regenerate/:certificateId',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role, req.user.email)) {
      res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
      return;
    }

    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId });
    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found.' });
      return;
    }

    const activeTemplate = await CertificateTemplate.findOne({ isActive: true }) || await CertificateTemplate.findOne();
    if (activeTemplate) {
      certificate.templateId = activeTemplate.templateId;
    }

    // Refresh expiry
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    certificate.expiryDate = expiry;
    certificate.status = 'APPROVED';

    await certificate.save();

    res.json({
      message: 'Certificate regenerated and updated with active template successfully',
      certificate,
    });
  })
);

// GET specific certificate by ID (mounted at the bottom to avoid shadowing literal routes)
router.get(
  '/:certificateId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { certificateId } = req.params;

    const query: any = { isActive: true };
    if (certificateId.match(/^[0-9a-fA-F]{24}$/)) {
      query.$or = [{ certificateId }, { _id: certificateId }];
    } else {
      query.certificateId = certificateId;
    }

    const certificate = await Certificate.findOne(query);

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    res.status(200).json(certificate);
  })
);

export default router;

