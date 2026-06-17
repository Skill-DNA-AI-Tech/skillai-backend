import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect, AuthRequest, authorize } from '../middleware/auth';
import { InterviewQuestion, InterviewScore, InterviewSession } from '../models/interview';
import { aiClient } from '../services/aiClient';

const router = express.Router();

router.get('/questions', asyncHandler(async (req, res) => {
  const query: Record<string, unknown> = {};
  if (req.query.domain) query.domain = req.query.domain;
  if (req.query.type) query.type = req.query.type;
  const questions = await InterviewQuestion.find(query).sort({ createdAt: -1 }).limit(50);
  res.json(questions);
}));

router.post('/questions', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req, res) => {
  const question = await InterviewQuestion.create(req.body);
  res.status(201).json(question);
}));

router.post('/sessions', protect, authorize('student'), asyncHandler(async (req: AuthRequest, res) => {
  const session = await InterviewSession.create({
    student: req.user._id,
    profile: req.body.profile,
    type: req.body.type,
    domain: req.body.domain,
    scheduledAt: req.body.scheduledAt,
    status: req.body.scheduledAt ? 'scheduled' : 'in-progress',
  });

  res.status(201).json(session);
}));

router.get('/sessions/me', protect, authorize('student'), asyncHandler(async (req: AuthRequest, res) => {
  const sessions = await InterviewSession.find({ student: req.user._id }).populate('score').sort({ createdAt: -1 });
  res.json(sessions);
}));

router.post('/sessions/:id/analyze', protect, asyncHandler(async (req, res) => {
  const session = await InterviewSession.findById(req.params.id);

  if (!session) {
    res.status(404).json({ message: 'Interview session not found' });
    return;
  }

  const analysis = await aiClient.interview({
    transcript: req.body.transcript ?? session.get('transcript'),
    durationSeconds: req.body.durationSeconds ?? session.get('durationSeconds'),
    confidenceLevel: req.body.confidenceLevel,
    eyeContactLevel: req.body.eyeContactLevel,
    wordsPerMinute: req.body.wordsPerMinute,
    domainKeywords: req.body.domainKeywords,
  });

  const score = await InterviewScore.create({
    ...analysis,
    technicalDepthScore: analysis.technicalDepthScore ?? analysis.technicalDepth,
    improvementRoadmap: [
      'Record one answer daily',
      'Practice two domain questions',
      'Review filler words and pacing',
      'Retake a mock interview after revision',
    ],
  });

  session.set({
    status: 'completed',
    transcript: req.body.transcript ?? session.get('transcript'),
    durationSeconds: req.body.durationSeconds ?? session.get('durationSeconds'),
    score: score._id,
    completedAt: new Date(),
    realtimeFeedback: analysis.tips,
  });
  await session.save();

  res.json({ session, score });
}));

export default router;
