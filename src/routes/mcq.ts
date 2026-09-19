import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect, AuthRequest } from '../middleware/auth';
import { mcqService } from '../services/mcqService';
import Assessment from '../models/assessment';

const router = express.Router();

// POST /api/mcq/start - Start a new 10-15 question MCQ assessment
router.post(
  '/start',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    const { domain, careerDomain, career, topic, subtopic, targetRole, questionCount } = req.body;
    const session = await mcqService.startMCQSession({
      studentId: req.user._id,
      domain,
      careerDomain,
      career,
      topic,
      subtopic,
      targetRole,
      questionCount,
    });
    res.json(session);
  })
);

// POST /api/mcq/submit - Submit answers, grade server-side, enforce 75% pass rule
router.post(
  '/submit',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    const { sessionId, answers } = req.body;
    if (!sessionId || !Array.isArray(answers)) {
      res.status(400).json({ message: 'Invalid submission payload. sessionId and answers array required.' });
      return;
    }

    const result = await mcqService.submitMCQSession({
      sessionId,
      studentId: req.user._id,
      answers,
    });

    res.json(result);
  })
);

// GET /api/mcq/history - Get student's previous MCQ assessments
router.get(
  '/history',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    const assessments = await Assessment.find({
      studentId: req.user._id,
      assessmentType: 'MCQ',
    }).sort({ createdAt: -1 });

    res.json(assessments);
  })
);

// GET /api/mcq/:assessmentId - Get specific assessment detail
router.get(
  '/:assessmentId',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    const assessment = await Assessment.findOne({
      _id: req.params.assessmentId,
      studentId: req.user._id,
    });

    if (!assessment) {
      res.status(404).json({ message: 'Assessment not found.' });
      return;
    }

    res.json(assessment);
  })
);

export default router;
