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

import CareerTwinMemory from '../models/careerTwinMemory';
import Profile from '../models/profile';

router.post('/reassess/:concept', protect, asyncHandler(async (req: AuthRequest, res) => {
  const { concept } = req.params;
  const { score = 85, answers } = req.body;

  const targetScore = Math.max(0, Math.min(100, Number(score) || 85));
  const isPassed = targetScore >= 75;

  const twinDoc = await CareerTwinMemory.findOne({
    $or: [{ userId: req.user._id }, { user: req.user._id }],
  });

  if (!twinDoc) {
    res.status(404).json({ message: 'Career Twin memory not found for this student.' });
    return;
  }

  let matchedRem: any = null;
  if (Array.isArray(twinDoc.weaknessRemediations)) {
    for (const rem of twinDoc.weaknessRemediations) {
      if (
        rem.concept?.toLowerCase() === concept.toLowerCase() ||
        rem.topic?.toLowerCase() === concept.toLowerCase()
      ) {
        matchedRem = rem;
        rem.score = Math.max(rem.score || 0, targetScore);
        rem.lastAssessedAt = new Date();
        if (isPassed) {
          rem.resolved = true;
          rem.reassessmentAvailable = true;
        }
        break;
      }
    }
  }

  if (isPassed) {
    // Remove from weakAreas & add to strengths
    twinDoc.weakAreas = (twinDoc.weakAreas || []).filter(
      (w: string) => w.toLowerCase() !== concept.toLowerCase()
    );
    twinDoc.weaknesses = (twinDoc.weaknesses || []).filter(
      (w: string) => w.toLowerCase() !== concept.toLowerCase()
    );

    if (!twinDoc.strengths.includes(concept)) {
      twinDoc.strengths.push(concept);
    }

    // Boost overall benchmark score
    twinDoc.overallScore = Math.min(100, Math.max(twinDoc.overallScore || 70, targetScore));
    if (twinDoc.benchmarks) {
      twinDoc.benchmarks.overall = Math.min(100, Math.max(twinDoc.benchmarks.overall || 70, targetScore));
      twinDoc.benchmarks.technical = Math.min(100, Math.max(twinDoc.benchmarks.technical || 70, targetScore));
    }

    // Sync with student Profile & Skill DNA
    await Profile.findOneAndUpdate(
      { user: req.user._id },
      {
        $pull: { 'skillDNA.weaknesses': concept },
        $addToSet: { 'skillDNA.strengths': concept },
        $set: {
          'skillDNA.lastAssessedAt': new Date(),
        },
        $max: {
          'skillDNA.score': targetScore,
          'skillDNA.technicalScore': targetScore,
        },
      }
    );
  }

  await twinDoc.save();

  res.json({
    message: isPassed
      ? `Topic '${concept}' successfully mastered via mini-reassessment! Skill DNA and Career Twin updated.`
      : `Mini-reassessment completed with score ${targetScore}%. A minimum 75% score is required to mark as resolved.`,
    resolved: isPassed,
    score: targetScore,
    remediation: matchedRem,
    careerTwin: twinDoc,
  });
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
