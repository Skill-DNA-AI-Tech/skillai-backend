import express from 'express';
import asyncHandler from 'express-async-handler';
import { aiClient } from '../services/aiClient';
import { groqRequest } from '../services/groqClient';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/skilldna', protect, asyncHandler(async (req, res) => {
  res.json(await aiClient.skillDNA(req.body));
}));

router.post('/learning/recommend', protect, asyncHandler(async (req, res) => {
  res.json(await aiClient.learningPlan(req.body));
}));

router.post('/interview', protect, asyncHandler(async (req, res) => {
  res.json(await aiClient.interview(req.body));
}));

router.post('/resume', protect, asyncHandler(async (req, res) => {
  res.json(await aiClient.resume(req.body));
}));

router.post('/jobs/match', protect, asyncHandler(async (req, res) => {
  res.json(await aiClient.jobMatch(req.body));
}));

router.post('/deep-analysis', protect, asyncHandler(async (req, res) => {
  res.json(await aiClient.deepAnalysis(req.body));
}));

export default router;
