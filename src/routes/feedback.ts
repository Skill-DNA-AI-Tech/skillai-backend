import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect, AuthRequest } from '../middleware/auth';
import Feedback from '../models/feedback';

const router = express.Router();

// POST /api/feedback - Submit user feedback (authenticated)
router.post('/', protect, asyncHandler(async (req: AuthRequest, res) => {
  const { category, message, rating } = req.body;

  if (!message) {
    res.status(400).json({ message: 'Feedback message is required' });
    return;
  }

  const feedback = await Feedback.create({
    user: req.user?._id,
    name: req.user?.full_name || req.user?.name,
    email: req.user?.email,
    category: category || 'suggestion',
    message,
    rating: rating ? Number(rating) : undefined,
    status: 'PENDING'
  });

  res.status(201).json(feedback);
}));

export default router;
