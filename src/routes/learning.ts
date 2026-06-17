import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { aiClient } from '../services/aiClient';
import { isAdminRole, normalizeRole } from '../utils/rbac';
import {
  Assignment,
  Course,
  Domain,
  Flashcard,
  Lesson,
  Note,
  Quiz,
  Subject,
  Video,
  Webinar,
} from '../models/learning/content';

const router = express.Router();

const contentMap = {
  domains: Domain,
  subjects: Subject,
  courses: Course,
  lessons: Lesson,
  notes: Note,
  videos: Video,
  quizzes: Quiz,
  assignments: Assignment,
  flashcards: Flashcard,
  webinars: Webinar,
};

router.get('/catalog', asyncHandler(async (req, res) => {
  const domains = await Domain.find({ active: true }).sort({ name: 1 });
  const subjects = await Subject.find({ active: true }).populate('domain', 'name slug').sort({ name: 1 });
  const featuredLessons = await Lesson.find({ published: true }).limit(12).sort({ updatedAt: -1 });

  res.json({ domains, subjects, featuredLessons });
}));

router.get('/domains', asyncHandler(async (req, res) => {
  const domains = await Domain.find().sort({ name: 1 });
  res.json(domains);
}));

router.post('/domains', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req, res) => {
  const domain = await Domain.create(req.body);
  res.status(201).json(domain);
}));

router.get('/subjects', asyncHandler(async (req, res) => {
  const query = req.query.domain ? { domain: req.query.domain } : {};
  const subjects = await Subject.find(query).populate('domain', 'name slug').sort({ name: 1 });
  res.json(subjects);
}));

router.post('/subjects', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req, res) => {
  const subject = await Subject.create(req.body);
  res.status(201).json(subject);
}));

router.get('/courses', asyncHandler(async (req, res) => {
  const query: Record<string, unknown> = {};
  if (req.query.domain) query.domain = req.query.domain;
  if (req.query.subject) query.subject = req.query.subject;
  const courses = await Course.find(query).populate('domain subject', 'name slug').sort({ updatedAt: -1 });
  res.json(courses);
}));

router.post('/courses', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req, res) => {
  const course = await Course.create(req.body);
  res.status(201).json(course);
}));

router.get('/lessons', asyncHandler(async (req, res) => {
  const query: Record<string, unknown> = {};
  if (req.query.course) query.course = req.query.course;
  if (req.query.lessonType) query.lessonType = req.query.lessonType;
  if (req.query.q) query.$text = { $search: String(req.query.q) };
  const lessons = await Lesson.find(query).populate('domain subject course', 'name title slug').sort({ order: 1 });
  res.json(lessons);
}));

router.post('/lessons', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req, res) => {
  const lesson = await Lesson.create(req.body);
  res.status(201).json(lesson);
}));

router.put('/lessons/:id', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req, res) => {
  const lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  res.json(lesson);
}));

router.post('/builder/:type', protect, asyncHandler(async (req: AuthRequest, res) => {
  const isNotes = req.params.type === 'notes';
  const hasAccess = isAdminRole(req.user?.role, req.user?.email) || (isNotes && normalizeRole(req.user?.role, req.user?.email) === 'STUDENT');

  if (!hasAccess) {
    res.status(403).json({ message: 'You do not have permission for this action' });
    return;
  }

  const Model = contentMap[req.params.type as keyof typeof contentMap];

  if (!Model) {
    res.status(400).json({ message: 'Unsupported CMS content type' });
    return;
  }

  const item = await Model.create(req.body);
  res.status(201).json(item);
}));

router.get('/builder/:type', protect, asyncHandler(async (req: AuthRequest, res) => {
  const isNotes = req.params.type === 'notes';
  const hasAccess = isAdminRole(req.user?.role, req.user?.email) || (isNotes && normalizeRole(req.user?.role, req.user?.email) === 'STUDENT');

  if (!hasAccess) {
    res.status(403).json({ message: 'You do not have permission for this action' });
    return;
  }

  const Model = contentMap[req.params.type as keyof typeof contentMap];

  if (!Model) {
    res.status(400).json({ message: 'Unsupported CMS content type' });
    return;
  }

  const items = await Model.find().sort({ updatedAt: -1 }).limit(100);
  res.json(items);
}));

router.post('/recommendations', protect, asyncHandler(async (req, res) => {
  const plan = await aiClient.learningPlan(req.body);
  res.json(plan);
}));

router.get('/analytics/overview', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req, res) => {
  const [domains, courses, lessons, quizzes, assignments, flashcards, webinars] = await Promise.all([
    Domain.countDocuments(),
    Course.countDocuments(),
    Lesson.countDocuments(),
    Quiz.countDocuments(),
    Assignment.countDocuments(),
    Flashcard.countDocuments(),
    Webinar.countDocuments(),
  ]);

  res.json({
    domains,
    courses,
    lessons,
    quizzes,
    assignments,
    flashcards,
    webinars,
    contentItems: lessons + quizzes + assignments + flashcards + webinars,
  });
}));

export default router;
