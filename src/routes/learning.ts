import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { aiClient } from '../services/aiClient';
import { groqRequest } from '../services/groqClient';
import CareerTwinMemory from '../models/careerTwinMemory';
import TopicNote from '../models/learning/topicNote';
import ContentRequest from '../models/learning/contentRequest';
import StudentTopicProgress from '../models/learning/studentTopicProgress';
import Profile from '../models/profile';
import { resolveCurriculum } from '../data/curriculaData';
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

// GET /api/learning/active-curriculum - Returns only the student's active curriculum with domain -> topics -> subtopics & mastery status
router.get(
  '/active-curriculum',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    const profile = await Profile.findOne({ user: req.user._id });
    const career = profile?.career || (profile as any)?.domain || req.user.careerDomain || 'Java Software Engineer';
    const curriculum = resolveCurriculum(career);

    // Fetch student's progress for this curriculum's domain
    const progressList = await StudentTopicProgress.find({
      studentId: req.user._id,
      domain: curriculum.domain,
    }).lean();

    const progressMap: Record<string, any> = {};
    for (const p of progressList) {
      const key = `${p.topic.toLowerCase()}:${p.subtopic.toLowerCase()}`;
      progressMap[key] = {
        status: p.status,
        mcqScore: p.mcqScore,
        interviewScore: p.interviewScore,
        highestScore: p.highestScore,
        attempts: p.attempts,
        isMastered: p.isMastered,
        lastAssessedAt: p.lastAssessedAt,
      };
    }

    const topicsWithProgress = curriculum.topics.map(t => {
      const p = progressList.find(prog => prog.topic.toLowerCase() === t.name.toLowerCase());
      return {
        name: t.name,
        subtopics: t.subtopics,
        status: p ? p.status : 'NOT_STARTED',
        mcqScore: p ? p.mcqScore : 0,
        interviewScore: p ? p.interviewScore : 0,
        highestScore: p ? p.highestScore : 0,
        isMastered: p ? p.isMastered : false,
        attempts: p ? p.attempts : 0,
      };
    });

    const masteredCount = topicsWithProgress.filter(t => t.isMastered).length;
    const totalTopics = topicsWithProgress.length || 1;
    const completionPercentage = Math.round((masteredCount / totalTopics) * 100);

    // Fetch diagnosed weak areas from Career Twin
    const careerTwin = await CareerTwinMemory.findOne({
      $or: [{ userId: req.user._id }, { user: req.user._id }],
    }).lean();

    const weakAreas = (careerTwin as any)?.weaknesses || (careerTwin as any)?.weakAreas || [];

    res.json({
      career,
      domain: curriculum.domain,
      description: curriculum.description,
      topics: topicsWithProgress,
      totalTopics,
      masteredTopics: masteredCount,
      completionPercentage,
      curriculum,
      progressMap,
      weakAreas,
      careerTwinMemory: careerTwin ? {
        overallScore: (careerTwin as any).overallScore,
        technicalScore: (careerTwin as any).technicalScore,
        weaknesses: (careerTwin as any).weaknesses,
        strengths: (careerTwin as any).strengths,
      } : null,
    });
  })
);

// GET /api/learning/topic-content - Get notes, resources, code examples, and assessment readiness for a topic
router.get(
  '/topic-content',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    const { domain, topic, subtopic } = req.query;

    const domainStr = String(domain || '').trim();
    const topicStr = String(topic || '').trim();
    const subtopicStr = String(subtopic || '').trim();

    if (!domainStr || !topicStr) {
      res.status(400).json({ message: 'Domain and Topic are required parameters.' });
      return;
    }

    // 1. Fetch official published topic notes
    const noteQuery: any = {
      domain: new RegExp(`^${domainStr}$`, 'i'),
      topic: new RegExp(`^${topicStr}$`, 'i'),
      status: { $in: ['Published', 'PUBLISHED'] },
    };
    if (subtopicStr && subtopicStr !== 'General') {
      noteQuery.subtopic = new RegExp(`^${subtopicStr}$`, 'i');
    }

    let note = await TopicNote.findOne(noteQuery).lean();
    if (!note && subtopicStr) {
      delete noteQuery.subtopic;
      note = await TopicNote.findOne(noteQuery).lean();
    }

    // 2. Fetch student's progress for this topic
    const progress = await StudentTopicProgress.findOne({
      studentId: req.user._id,
      domain: new RegExp(`^${domainStr}$`, 'i'),
      topic: new RegExp(`^${topicStr}$`, 'i'),
    }).lean();

    // 3. Check for pending student content request if note doesn't exist
    const pendingRequest = await ContentRequest.findOne({
      studentId: req.user._id,
      domain: new RegExp(`^${domainStr}$`, 'i'),
      topic: new RegExp(`^${topicStr}$`, 'i'),
      status: 'PENDING',
    }).lean();

    // 4. Fetch Career Twin weakness remediation for this topic if available
    const careerTwin = await CareerTwinMemory.findOne({
      $or: [{ userId: req.user._id }, { user: req.user._id }],
    }).lean();

    const weaknessRemediations = (careerTwin as any)?.weaknessRemediations || [];
    const matchedRemediations = weaknessRemediations.filter(
      (r: any) =>
        (r.concept && (r.concept.toLowerCase().includes(topicStr.toLowerCase()) || (subtopicStr && r.concept.toLowerCase().includes(subtopicStr.toLowerCase())))) ||
        (r.topic && r.topic.toLowerCase().includes(topicStr.toLowerCase()))
    );

    res.json({
      domain: domainStr,
      topic: topicStr,
      subtopic: subtopicStr,
      hasContent: Boolean(note),
      hasNotes: Boolean(note),
      note: note || null,
      progress: progress || {
        status: 'NOT_STARTED',
        highestScore: 0,
        attempts: 0,
        isMastered: false,
      },
      hasPendingContentRequest: Boolean(pendingRequest),
      contentRequest: pendingRequest || null,
      remediations: matchedRemediations,
      weaknessRemediation: matchedRemediations[0] || null,
    });
  })
);

// POST /api/learning/request-content - Student requests Admin to add notes when a topic has no content
router.post(
  '/request-content',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    const { domain, topic, subtopic, notes } = req.body;

    if (!domain || !topic || !subtopic) {
      res.status(400).json({ message: 'Domain, Topic, and Subtopic are required.' });
      return;
    }

    const domainStr = String(domain).trim();
    const topicStr = String(topic).trim();
    const subtopicStr = String(subtopic).trim();

    // Check if an identical pending request exists
    const existing = await ContentRequest.findOne({
      studentId: req.user._id,
      domain: domainStr,
      topic: topicStr,
      subtopic: subtopicStr,
      status: 'PENDING',
    });

    if (existing) {
      res.json({
        message: 'Your request for this topic has already been submitted to Admin.',
        request: existing,
      });
      return;
    }

    const profile = await Profile.findOne({ user: req.user._id });

    const request = await ContentRequest.create({
      studentId: req.user._id,
      studentName: req.user.name || profile?.name || 'Student',
      studentEmail: req.user.email,
      career: profile?.career || req.user.careerDomain || '',
      domain: domainStr,
      topic: topicStr,
      subtopic: subtopicStr,
      notes: notes?.trim() || '',
      status: 'PENDING',
    });

    res.status(201).json({
      message: 'Request submitted successfully! Admins have been notified to add notes for this topic.',
      request,
    });
  })
);

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

// POST /api/learning/notes/generate - Admin-only note generation endpoint (Students cannot freely generate customized notes themselves)
router.post('/notes/generate', protect, authorize('admin', 'employee', 'staff'), asyncHandler(async (req: AuthRequest, res) => {
  const { topic, subtopic, domain, careerDomain, level = 'Intermediate' } = req.body;
  if (!topic) {
    res.status(400).json({ message: 'Topic is required to generate notes.' });
    return;
  }

  const prompt = `You are a world-class technical educator and instructional designer.
Generate structured, pedagogical study notes for:
Topic: ${topic}
Subtopic: ${subtopic || 'General'}
Domain: ${domain || careerDomain || 'Computer Science'}
Target Knowledge Level: ${level}

Return ONLY a valid JSON object strictly matching this schema:
{
  "topic": "${topic}",
  "subtopic": "${subtopic || 'General'}",
  "level": "${level}",
  "commonMistakes": ["Common mistake 1 and why it happens", "Common mistake 2 and how to avoid it"],
  "keyTakeaways": ["Key point 1", "Key point 2", "Key point 3"],
  "miniAssessment": [
    {
      "question": "Question 1 testing core intuition",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A",
      "explanation": "Why Option A is correct"
    },
    {
      "question": "Question 2 testing practical application",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option B",
      "explanation": "Why Option B is correct"
    }
  ]
}`;

  try {
    const aiResponse = await groqRequest({ prompt });
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      res.json(parsed);
      return;
    }
  } catch (err) {
    console.warn('AI notes generation failed, using structured template fallback:', err);
  }

  // Structured fallback
  res.json({
    topic,
    level,
    overview: `${topic} is a critical core concept in ${careerDomain || 'the field'}. Mastery of this topic requires understanding foundational principles, execution mechanisms, and common operational edge cases.`,
    importantConcepts: [
      `Foundational Theory: Core mathematical and conceptual definition of ${topic}.`,
      `Implementation Architecture: How ${topic} is integrated into real-world pipelines.`,
      `Performance & Trade-offs: Resource efficiency, latency, and boundary limits.`,
    ],
    simpleExplanation: `Think of ${topic} like a well-organized workflow coordinator that ensures resources are routed efficiently without collisions or bottlenecks.`,
    concreteExamples: `// Practical Example for ${topic}\nfunction demonstrate${topic.replace(/[^a-zA-Z]/g, '')}() {\n  // 1. Initialize configuration\n  const context = { ready: true, domain: "${careerDomain || 'Engineering'}" };\n  // 2. Execute process\n  return context;\n}`,
    practicalApplication: `In real-world engineering teams, ${topic} is used to optimize reliability and prevent regressions in production deployments.`,
    commonMistakes: [
      `Neglecting edge cases and boundary validation before executing core logic.`,
      `Assuming uniform performance across varying load conditions without benchmarking.`,
    ],
    keyTakeaways: [
      `Always understand the fundamental first principles before optimizing.`,
      `Test edge cases and validate state transitions under stress.`,
      `Document assumptions clearly for cross-functional collaborators.`,
    ],
    miniAssessment: [
      {
        question: `What is the primary objective of studying ${topic}?`,
        options: [
          `To build scalable and resilient domain solutions`,
          `To bypass architectural requirements`,
          `To eliminate the need for testing`,
          `To increase system latency`,
        ],
        answer: `To build scalable and resilient domain solutions`,
        explanation: `Understanding ${topic} ensures high-standard implementation and robust system design.`,
      },
    ],
  });
}));

// CONTROLLED APPLICATION NAVIGATION MAP
const CONTROLLED_APP_NAVIGATION_MAP = {
  'Learning Hub & Topics (e.g. Java, OOP)': '/learning',
  'Topic MCQ Practice': '/learning',
  'Topic Mock Interview Practice': '/learning',
  'AI Career Twin & Weakness Analysis': '/career-twin',
  'Adaptive AI Mock Interview Center': '/interview',
  'Scorecards & Performance Reports': '/scorecards',
  'Verified Certificates & Public Verification': '/certificates',
  'Public Certificate Verification Engine': '/certificate/verify/:id',
  'Student Profile & Career Change Requests': '/profile',
  'Job Board & Recruiter Opportunities': '/jobs',
  'Community Hub': '/community',
  'Feedback & Support': '/feedback',
};

// POST /api/learning/chatbot/message - Quick AI Learning & Platform Assistant inside Learning Module
router.post('/chatbot/message', protect, asyncHandler(async (req: AuthRequest, res) => {
  const { message, topic, subtopic, domain, careerDomain, history } = req.body;
  if (!message) {
    res.status(400).json({ message: 'Message cannot be empty.' });
    return;
  }

  // 1. Fetch student profile, career, active curriculum, and Skill DNA
  const profile = await Profile.findOne({ user: req.user._id }).lean();
  const studentCareer = (profile as any)?.career || req.user.careerDomain || 'Java Software Engineer';
  const activeCurriculumTitle = (profile as any)?.activeCurriculum?.title || studentCareer;
  const skillDNA = (profile as any)?.skillDNA || {};

  // 2. Fetch Career Twin context
  const careerTwin = await CareerTwinMemory.findOne({
    $or: [{ userId: req.user._id }, { user: req.user._id }],
  }).lean();

  const weakTopics = (careerTwin as any)?.weaknesses || (careerTwin as any)?.weakAreas || [];
  const strongTopics = (careerTwin as any)?.strengths || [];
  const overallScore = (careerTwin as any)?.overallScore ?? skillDNA.score ?? 0;
  const technicalScore = (careerTwin as any)?.technicalScore ?? skillDNA.technicalScore ?? 0;
  const targetRole = (careerTwin as any)?.targetRole || req.user.targetRole || 'Specialist';

  const formattedHistory = Array.isArray(history)
    ? history.slice(-4).map((h: any) => `${h.sender === 'user' ? 'Student' : 'Assistant'}: ${h.text}`).join('\n')
    : '';

  const currentTopicDisplay = subtopic ? `${topic} (${subtopic})` : topic || 'General Topic';

  const systemContext = `You are the SkillDNA Quick AI Learning & Platform Assistant embedded directly in the Learning Hub.

STUDENT PROFILE CONTEXT:
- Student Name: ${req.user.name || 'Learner'}
- Enrolled Career: ${studentCareer}
- Active Curriculum: ${activeCurriculumTitle}
- Target Role: ${targetRole}
- Current Active Topic: ${currentTopicDisplay} in ${domain || careerDomain || 'the curriculum'}
- Current Readiness Score: ${overallScore}%
- Technical Depth Score: ${technicalScore}%
- Diagnosed Weak Topics (from assessments): ${weakTopics.length ? weakTopics.slice(0, 5).join(', ') : 'None currently flagged'}
- Confirmed Strengths: ${strongTopics.length ? strongTopics.slice(0, 4).join(', ') : 'Developing'}

CONTROLLED APPLICATION NAVIGATION MAP:
${Object.entries(CONTROLLED_APP_NAVIGATION_MAP)
  .map(([name, path]) => `- ${name}: "${path}"`)
  .join('\n')}

OPERATING RULES & GUARDRAILS:
1. TOPIC TUTORING: If the student asks about a concept (e.g. Java OOP, Polymorphism, Collections, etc.), explain it simply using intuitive mental models, practical code/syntax examples, and actionable guidance.
2. CAREER & ROADMAP GUIDANCE: Use the student's actual Career Twin weaknesses, strengths, and Skill DNA score to give targeted advice (e.g. "Since your score in ${weakTopics[0] || 'core topics'} was below 75%, prioritize practicing edge cases in OOP before advancing").
3. APPLICATION NAVIGATION: If the student asks where to find any feature (e.g. where to find Java, where to find Career Twin, where to take assessments, where to view certificates, or how to change career), direct them ONLY to the exact paths in the CONTROLLED APPLICATION NAVIGATION MAP. NEVER invent URLs, pages, or tools that do not exist.
4. STRICT SECURITY GUARDRAIL: You are an educational and navigation tutor only. You have ZERO authority or technical permission to directly modify Career, Curriculum, Skill DNA scores, assessment scores, certificates, or user roles. If requested to change a grade, certificate, or career, politely explain:
   - "To change your Career or Curriculum, visit your Profile page (/profile) and click 'Request Career Change' to submit an official request to Admin."
   - "Scores and certificates are issued automatically when you achieve 75%+ on official assessments."
5. Tone: Concise, supportive, professional, accurate, and encouraging.`;

  const prompt = `${systemContext}

${formattedHistory ? `RECENT CONVERSATION:\n${formattedHistory}\n` : ''}
Student Question: "${message}"

Helpful, Pedagogical & Accurate Response:`;

  try {
    const aiResponse = await groqRequest({ prompt });
    const cleanText = aiResponse.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();
    res.json({
      reply: cleanText,
      topic: currentTopicDisplay,
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn('Chatbot LLM call failed, using heuristic fallback:', err);
    res.json({
      reply: `Regarding **${currentTopicDisplay}**: Remember the core principle: start from foundational definitions, understand the mechanical reason behind it, and test boundary conditions. You can review your diagnosed weak concepts in your Career Twin (/career-twin), or practice with topic MCQs and Mock Interviews right here in the Learning Hub (/learning)! How can I help explain this further?`,
      topic: currentTopicDisplay,
      timestamp: new Date(),
    });
  }
}));

export default router;
