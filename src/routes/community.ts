import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect, AuthRequest, authorize } from '../middleware/auth';
import { Booking, Comment, Community, Mentor, Post } from '../models/community/community';
import { Webinar } from '../models/learning/content';

const router = express.Router();

router.get('/mentors', asyncHandler(async (req, res) => {
  const query = req.query.domain ? { domain: req.query.domain } : {};
  const mentors = await Mentor.find(query).sort({ rating: -1 });
  res.json(mentors);
}));

router.post('/mentors', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req, res) => {
  const mentor = await Mentor.create(req.body);
  res.status(201).json(mentor);
}));

router.post('/bookings', protect, authorize('student'), asyncHandler(async (req: AuthRequest, res) => {
  const booking = await Booking.create({ ...req.body, student: req.user._id });
  res.status(201).json(booking);
}));

router.get('/bookings/me', protect, asyncHandler(async (req: AuthRequest, res) => {
  const bookings = await Booking.find({ student: req.user._id }).populate('mentor').sort({ startsAt: -1 });
  res.json(bookings);
}));

router.get('/communities', asyncHandler(async (req, res) => {
  const communities = await Community.find().sort({ createdAt: -1 });
  res.json(communities);
}));

router.post('/communities', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req, res) => {
  const community = await Community.create(req.body);
  res.status(201).json(community);
}));

router.get('/posts', asyncHandler(async (req, res) => {
  const query = req.query.community ? { community: req.query.community } : {};
  const posts = await Post.find(query).populate('author', 'name avatarUrl').sort({ createdAt: -1 }).limit(50);
  res.json(posts);
}));

router.post('/posts', protect, asyncHandler(async (req: AuthRequest, res) => {
  const post = await Post.create({ ...req.body, author: req.user._id });
  res.status(201).json(post);
}));

router.get('/posts/:id/comments', asyncHandler(async (req, res) => {
  const comments = await Comment.find({ post: req.params.id }).populate('author', 'name avatarUrl').sort({ createdAt: 1 });
  res.json(comments);
}));

router.post('/posts/:id/comments', protect, asyncHandler(async (req: AuthRequest, res) => {
  const comment = await Comment.create({ post: req.params.id, author: req.user._id, body: req.body.body });
  res.status(201).json(comment);
}));

router.get('/webinars', asyncHandler(async (req, res) => {
  const webinars = await Webinar.find().sort({ startsAt: 1 }).limit(20);
  res.json(webinars);
}));

export default router;
