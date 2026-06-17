import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect, AuthRequest, authorize } from '../middleware/auth';
import { careerTwinService } from '../services/careerTwinService';

const router = express.Router();

router.get('/me', protect, asyncHandler(async (req: AuthRequest, res) => {
  const memory = await careerTwinService.getMemory(req.user._id);

  if (!memory) {
    res.status(404).json({ message: 'Career Twin memory has not been generated yet.' });
    return;
  }

  res.json(memory);
}));

router.post('/me/refresh', protect, asyncHandler(async (req: AuthRequest, res) => {
  const memory = await careerTwinService.refreshMemory(req.user._id, req.body?.transient);
  res.json(memory);
}));

router.post('/interview/next', protect, asyncHandler(async (req: AuthRequest, res) => {
  const dynamicInterview = await careerTwinService.nextInterviewPrompt(req.user._id, {
    question: req.body?.question,
    answer: req.body?.answer,
    difficulty: req.body?.difficulty,
    responseTime: req.body?.responseTime,
  });

  res.json(dynamicInterview);
}));

router.get('/questions/suggested', protect, asyncHandler(async (req: AuthRequest, res) => {
  const questions = await careerTwinService.suggestQuestionsFromMemory(req.user._id);
  res.json(questions);
}));

router.get('/:userId', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req, res) => {
  const memory = await careerTwinService.getMemory(req.params.userId);

  if (!memory) {
    res.status(404).json({ message: 'Career Twin memory has not been generated for this user.' });
    return;
  }

  res.json(memory);
}));

export default router;
