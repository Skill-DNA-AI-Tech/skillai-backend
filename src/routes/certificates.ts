import { Router, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { randomUUID } from 'crypto';
import Certificate, { ICertificate } from '../models/certificate';
import User from '../models/user';
import { env } from '../config/env';
import { protect, AuthRequest } from '../middleware/auth';
import { QuestionInterviewSession } from '../models/questionBank';
import Profile from '../models/profile';
import { isAdminRole } from '../utils/rbac';

const router = Router();

// Generate unique certificate ID
const generateCertificateId = (): string => {
  return `SKILLDNA-${Date.now()}-${randomUUID().substring(0, 8).toUpperCase()}`;
};

// Create certificate for a student
router.post(
  '/create',
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const studentId = req.user.id;
    const student = await User.findById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Try to get student's real profile for dynamic scores
    const profile = await Profile.findOne({ user: studentId });

    // Fetch actual completed session count
    const actualSessions = await QuestionInterviewSession.countDocuments({ studentId, status: 'Completed' });

    if (actualSessions === 0) {
      res.status(400).json({ error: 'You must complete at least one mock interview practice session before generating a certificate.' });
      return;
    }

    let careerPath = req.body.careerPath;
    let technicalScore = req.body.technicalScore;
    let communicationScore = req.body.communicationScore;
    let problemSolvingScore = req.body.problemSolvingScore;
    let confidenceScore = req.body.confidenceScore;
    let sessionsCompleted = req.body.sessionsCompleted ?? actualSessions;
    let strengths = req.body.strengths;
    let improvements = req.body.improvements;

    if (profile) {
      if (!careerPath) {
        careerPath = profile.preferredRoles?.[0] || profile.branch || 'Software Engineering';
      }
      const skillDNA = profile.skillDNA || {};
      
      // Pull real-time scores if not provided in the request
      if (technicalScore === undefined || technicalScore === null || technicalScore === 0) {
        technicalScore = skillDNA.technicalScore ?? 70;
      }
      if (communicationScore === undefined || communicationScore === null || communicationScore === 0) {
        communicationScore = skillDNA.communicationScore ?? 75;
      }
      if (problemSolvingScore === undefined || problemSolvingScore === null || problemSolvingScore === 0) {
        problemSolvingScore = skillDNA.projectsScore ?? skillDNA.aptitudeScore ?? 72;
      }
      if (confidenceScore === undefined || confidenceScore === null || confidenceScore === 0) {
        confidenceScore = skillDNA.confidenceScore ?? 68;
      }
      if (!strengths || strengths.length === 0) {
        strengths = skillDNA.strengths && skillDNA.strengths.length > 0 ? skillDNA.strengths : ['Problem Solving', 'System Design'];
      }
      if (!improvements || improvements.length === 0) {
        improvements = skillDNA.weaknesses && skillDNA.weaknesses.length > 0 ? skillDNA.weaknesses : ['Communication Depth'];
      }
    } else {
      // Set baseline values if no profile is found and request body values are empty
      if (!careerPath) careerPath = 'Software Development';
      if (technicalScore === undefined || technicalScore === null) technicalScore = 70;
      if (communicationScore === undefined || communicationScore === null) communicationScore = 75;
      if (problemSolvingScore === undefined || problemSolvingScore === null) problemSolvingScore = 72;
      if (confidenceScore === undefined || confidenceScore === null) confidenceScore = 68;
      if (!strengths) strengths = ['Problem Solving', 'System Design'];
      if (!improvements) improvements = ['Communication Depth'];
    }

    // Ensure scores are numbers
    technicalScore = Number(technicalScore);
    communicationScore = Number(communicationScore);
    problemSolvingScore = Number(problemSolvingScore);
    confidenceScore = Number(confidenceScore);
    sessionsCompleted = Number(sessionsCompleted);

    // Validate scores
    const scores = [technicalScore, communicationScore, problemSolvingScore, confidenceScore];
    if (scores.some(s => typeof s !== 'number' || isNaN(s) || s < 0 || s > 100)) {
      res.status(400).json({ error: 'Invalid scores. Must be between 0 and 100.' });
      return;
    }

    const overallScore = Math.round((technicalScore + communicationScore + problemSolvingScore + confidenceScore) / 4);

    // Determine interview readiness status
    let interviewReadinessStatus: 'NOT_READY' | 'IN_PROGRESS' | 'READY' | 'ADVANCED';
    if (overallScore >= 85) {
      interviewReadinessStatus = 'ADVANCED';
    } else if (overallScore >= 70) {
      interviewReadinessStatus = 'READY';
    } else if (overallScore >= 50) {
      interviewReadinessStatus = 'IN_PROGRESS';
    } else {
      interviewReadinessStatus = 'NOT_READY';
    }

    // Certificate valid for 1 year
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const certificateId = generateCertificateId();

    const certificate = new Certificate({
      studentId,
      studentName: student.name,
      email: student.email,
      careerPath,
      certificateId,
      technicalScore,
      communicationScore,
      problemSolvingScore,
      confidenceScore,
      overallScore,
      sessionsCompleted,
      interviewReadinessStatus,
      strengths: strengths || [],
      improvements: improvements || [],
      expiryDate,
      isActive: true,
    });

    await certificate.save();

    res.status(201).json({
      message: 'Certificate created successfully',
      certificate,
      certificateId,
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

// Get specific certificate by ID
router.get(
  '/:certificateId',
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

    res.status(200).json(certificate);
  })
);

// Verify certificate
router.get(
  '/verify/:certificateId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { certificateId } = req.params;

    const certificate = await Certificate.findOne({
      certificateId,
      isActive: true,
    });

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found or has been revoked' });
      return;
    }

    if (certificate.status !== 'APPROVED') {
      res.status(400).json({ error: 'This certificate is not officially approved yet.' });
      return;
    }

    if (new Date() > certificate.expiryDate) {
      res.status(410).json({
        error: 'Certificate has expired',
        certificate,
      });
      return;
    }

    res.status(200).json({
      message: 'Certificate is valid',
      certificate,
      verified: true,
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

export default router;
