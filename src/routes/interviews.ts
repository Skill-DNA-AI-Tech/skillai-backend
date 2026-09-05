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

// ==========================================
// INTERVIEW ROUTE ALIASES (Requirement 28)
// ==========================================
import { interviewSessionService } from '../services/interviewSession';
import { QuestionInterviewSession, StudentAnswer } from '../models/questionBank';

// POST /api/interviews/start or /api/interview/start
router.post('/start', protect, asyncHandler(async (req: AuthRequest, res) => {
  const { field, careerDomain, targetRole, topic, difficulty, questionCount, experienceLevel } = req.body;
  const session = await interviewSessionService.createSession({
    studentId: req.user._id,
    field: field || careerDomain,
    careerDomain,
    targetRole,
    topic,
    difficulty,
    questionCount: questionCount || 10,
    experienceLevel,
    useVariations: true,
    adaptiveDifficulty: true,
  });
  res.json(session);
}));

// POST /api/interviews/:sessionId/answer
router.post('/:sessionId/answer', protect, asyncHandler(async (req: AuthRequest, res) => {
  const { questionId, answer, answerType, timeTaken } = req.body;
  const submission = await interviewSessionService.submitAnswer({
    sessionId: req.params.sessionId,
    studentId: req.user._id,
    questionId,
    answer,
    answerType: answerType || 'Text',
    timeTaken: timeTaken || 90,
  });
  res.json(submission);
}));

// POST /api/interviews/:sessionId/complete
router.post('/:sessionId/complete', protect, asyncHandler(async (req: AuthRequest, res) => {
  const completed = await interviewSessionService.completeSession(req.params.sessionId, req.user._id);
  res.json(completed);
}));

// GET /api/interviews/history
router.get('/history', protect, asyncHandler(async (req: AuthRequest, res) => {
  const sessions = await QuestionInterviewSession.find({ studentId: req.user._id }).sort({ createdAt: -1 });
  res.json(sessions);
}));

// GET /api/interviews/:sessionId
router.get('/:sessionId', protect, asyncHandler(async (req: AuthRequest, res) => {
  const session = await QuestionInterviewSession.findOne({ sessionId: req.params.sessionId, studentId: req.user._id });
  if (!session) {
    res.status(404).json({ message: 'Interview session not found' });
    return;
  }
  const answers = await StudentAnswer.find({ sessionId: req.params.sessionId }).populate('questionId', 'question topic field difficulty');
  res.json({ session, answers });
}));

// GET /api/interviews/:sessionId/report
router.get('/:sessionId/report', protect, asyncHandler(async (req: AuthRequest, res) => {
  let session = await QuestionInterviewSession.findOne({ sessionId: req.params.sessionId, studentId: req.user._id });
  if (!session) {
    res.status(404).json({ message: 'Interview session not found' });
    return;
  }
  if (session.status !== 'Completed') {
    await interviewSessionService.completeSession(req.params.sessionId, req.user._id);
    session = await QuestionInterviewSession.findOne({ sessionId: req.params.sessionId });
  }
  const answers = await StudentAnswer.find({ sessionId: req.params.sessionId }).populate('questionId', 'question topic field difficulty');
  res.json({
    session,
    finalReport: session?.finalReport,
    answers,
    questionsAsked: answers.length,
    averageScores: session?.competencies,
    answerCounts: session?.answerCounts,
    stuckTopics: session?.stuckTopics || [],
    difficultyProgression: session?.difficultyProgression || [],
  });
}));

export default router;
