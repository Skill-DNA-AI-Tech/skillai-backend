import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect, AuthRequest } from '../middleware/auth';
import CareerChangeRequest from '../models/careerChangeRequest';
import Profile from '../models/profile';
import User from '../models/user';
import CareerTwinMemory from '../models/careerTwinMemory';
import { resolveCurriculum } from '../data/curriculaData';
import { normalizeRole } from '../utils/rbac';
import { writeAuditLog } from '../utils/audit';

const router = express.Router();

// Helper to verify if user has Admin or Support Team authorization
export const canReviewCareerChanges = (role?: string, email?: string): boolean => {
  const norm = normalizeRole(role, email);
  return ['MAIN_ADMIN', 'ADMIN', 'SUPPORT_TEAM', 'EMPLOYEE', 'STAFF'].includes(norm);
};

// POST /api/career-change-requests - Student submits a new career change request
router.post(
  '/',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    const { requestedCareer, reason } = req.body;

    if (!requestedCareer || !String(requestedCareer).trim()) {
      res.status(400).json({ message: 'Requested career is required.' });
      return;
    }

    if (!reason || !String(reason).trim() || String(reason).trim().length < 10) {
      res.status(400).json({ message: 'Please provide a clear reason for requesting a career change (minimum 10 characters).' });
      return;
    }

    // Fetch current profile
    const profile = await Profile.findOne({ user: req.user._id });
    const currentCareer = profile?.career || (profile as any)?.domain || req.user.careerDomain || 'Java Software Engineer';
    const currentCurriculum = profile?.activeCurriculum?.title || currentCareer;

    const targetCurriculum = resolveCurriculum(requestedCareer);

    if (currentCareer.toLowerCase().trim() === requestedCareer.toLowerCase().trim()) {
      res.status(400).json({ message: 'You are already enrolled in this career path.' });
      return;
    }

    // Check for existing pending request
    const existingPending = await CareerChangeRequest.findOne({
      student: req.user._id,
      status: 'PENDING',
    });

    if (existingPending) {
      res.status(400).json({
        message: 'You already have a pending Career Change Request under review. Please wait for an Admin decision before submitting another.',
        pendingRequest: existingPending,
      });
      return;
    }

    const request = await CareerChangeRequest.create({
      student: req.user._id,
      studentName: req.user.name || profile?.name || 'Student',
      studentEmail: req.user.email,
      currentCareer,
      currentCurriculum,
      requestedCareer: targetCurriculum.careerName,
      requestedCurriculum: targetCurriculum.careerName,
      reason: String(reason).trim(),
      status: 'PENDING',
    });

    res.status(201).json({
      message: 'Career Change Request submitted successfully. An Admin or Support reviewer will evaluate your request.',
      request,
    });
  })
);

// GET /api/career-change-requests/my - Student views their request history
router.get(
  '/my',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    const requests = await CareerChangeRequest.find({ student: req.user._id }).sort({ createdAt: -1 });
    res.json(requests);
  })
);

// GET /api/career-change-requests - Admin or Support Team lists all requests
router.get(
  '/',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!canReviewCareerChanges(req.user?.role, req.user?.email)) {
      res.status(403).json({ message: 'Access denied. Requires Admin or Support Team permission.' });
      return;
    }

    const { status } = req.query;
    const filter: any = {};
    if (status && status !== 'ALL') {
      filter.status = status;
    }

    const requests = await CareerChangeRequest.find(filter)
      .populate('student', 'name email avatarUrl college branch semester mobile')
      .sort({ createdAt: -1 })
      .limit(200);

    const pendingCount = await CareerChangeRequest.countDocuments({ status: 'PENDING' });
    const approvedCount = await CareerChangeRequest.countDocuments({ status: 'APPROVED' });
    const rejectedCount = await CareerChangeRequest.countDocuments({ status: 'REJECTED' });

    res.json({
      requests,
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount,
      },
    });
  })
);

// PUT /api/career-change-requests/:id/review - Admin / Support Team reviews request
router.put(
  '/:id/review',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!canReviewCareerChanges(req.user?.role, req.user?.email)) {
      res.status(403).json({ message: 'Access denied. Requires Admin or Support Team permission.' });
      return;
    }

    const { status, reviewNotes } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ message: "Status must be either 'APPROVED' or 'REJECTED'." });
      return;
    }

    const request = await CareerChangeRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({ message: 'Career Change Request not found.' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ message: `This request has already been ${request.status.toLowerCase()}.` });
      return;
    }

    const reviewerRole = normalizeRole(req.user?.role, req.user?.email);

    request.status = status;
    request.reviewedBy = req.user._id;
    request.reviewedByName = req.user.name || 'Administrator';
    request.reviewedByRole = reviewerRole;
    request.reviewNotes = reviewNotes?.trim() || '';
    request.reviewedAt = new Date();
    await request.save();

    // If APPROVED, apply the career change across User, Profile, and Career Twin!
    if (status === 'APPROVED') {
      const targetCurriculum = resolveCurriculum(request.requestedCareer);

      // 1. Update Profile
      await Profile.findOneAndUpdate(
        { user: request.student },
        {
          $set: {
            career: targetCurriculum.careerName,
            domain: targetCurriculum.domain,
            activeCurriculum: {
              curriculumId: targetCurriculum.id,
              title: targetCurriculum.careerName,
              domain: targetCurriculum.domain,
              totalTopics: targetCurriculum.topics.length,
              masteredTopics: 0,
            },
            preferredRoles: [targetCurriculum.targetRole],
          },
        },
        { upsert: true }
      );

      // 2. Update User model
      await User.findByIdAndUpdate(request.student, {
        careerDomain: targetCurriculum.domain,
        targetRole: targetCurriculum.targetRole,
      });

      // 3. Update Career Twin Memory
      await CareerTwinMemory.findOneAndUpdate(
        { $or: [{ userId: request.student }, { user: request.student }] },
        {
          $set: {
            domain: targetCurriculum.domain,
            targetRole: targetCurriculum.targetRole,
          },
        }
      );

      // 4. Audit Log
      await writeAuditLog(req, 'CAREER_CHANGE_APPROVED', 'CareerChangeRequest', request._id.toString(), {
        studentId: request.student.toString(),
        fromCareer: request.currentCareer,
        toCareer: targetCurriculum.careerName,
        reviewedBy: req.user.email,
      });
    } else {
      // Audit log rejection
      await writeAuditLog(req, 'CAREER_CHANGE_REJECTED', 'CareerChangeRequest', request._id.toString(), {
        studentId: request.student.toString(),
        requestedCareer: request.requestedCareer,
        reason: request.reviewNotes,
        reviewedBy: req.user.email,
      });
    }

    res.json({
      message: `Career Change Request ${status === 'APPROVED' ? 'approved and applied' : 'rejected'}.`,
      request,
    });
  })
);

export default router;
