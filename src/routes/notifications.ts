import express from 'express';
import asyncHandler from 'express-async-handler';
import Notification from '../models/notification';
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', protect, asyncHandler(async (req: AuthRequest, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json(notifications);
}));

router.post('/', protect, asyncHandler(async (req: AuthRequest, res) => {
  const notification = await Notification.create({ ...req.body, user: req.body.user ?? req.user._id });
  res.status(201).json(notification);
}));

router.patch('/:id/read', protect, asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
  res.json(notification);
}));

export default router;
