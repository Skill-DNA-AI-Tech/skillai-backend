import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect } from '../middleware/auth';
import { QuestionBank, QuestionInterviewSession, StudentAnswer, AnswerAnalysis, GeneratedQuestion } from '../models/questionBank';
import { questionAnalysisService } from '../services/questionAnalysis';
import { interviewSessionService } from '../services/interviewSession';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { AuthRequest } from '../types/auth';
import { isAdminRole } from '../utils/rbac';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const canManageQuestions = (req: AuthRequest) => isAdminRole(req.user?.role, req.user?.email);
const uploadSourceByFormat: Record<string, string> = {
  csv: 'CSV',
  excel: 'Excel',
  json: 'JSON',
  manual: 'Manual',
};

// ===== ADMIN ROUTES =====

// POST /api/questions/admin/upload - Upload questions in bulk
router.post('/admin/upload', protect, upload.single('file'), asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Only admins can upload questions' });
    return;
  }

  const { uploadFormat, manualQuestions } = req.body;

  try {
    let questions: Array<Record<string, any>> = [];

    if (uploadFormat === 'manual' && manualQuestions) {
      questions = JSON.parse(manualQuestions);
    } else if (req.file) {
      if (uploadFormat === 'csv') {
        const parsed = parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true }) as Array<Record<string, any>>;
        questions = parsed;
      } else if (uploadFormat === 'json') {
        questions = JSON.parse(req.file.buffer.toString());
      } else if (uploadFormat === 'excel') {
        // For Excel, you'd need xlsx library
        res.status(501).json({ message: 'Excel upload coming soon' });
        return;
      }
    }

    // Analyze each question
    const analyzed = [];
    for (const q of questions) {
      const analysis = await questionAnalysisService.analyzeQuestion({
        question: q.question,
        answer: q.answer,
        topic: q.topic,
        field: q.field,
      });

      const saved = await QuestionBank.create({
        ...q,
        metadata: analysis || {},
        uploadedBy: req.user._id,
        source: uploadSourceByFormat[uploadFormat] || 'Manual',
        status: 'Review',
      });

      analyzed.push(saved);
    }

    res.json({
      message: `${analyzed.length} questions uploaded and analyzed`,
      questions: analyzed.map(q => ({ _id: q._id, question: q.question, status: q.status })),
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}));

// POST /api/questions/admin/generate - Generate questions with AI
router.post('/admin/generate', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Only admins can generate questions' });
    return;
  }

  const { field, topic, subtopic, difficulty, count, interviewTypes } = req.body;

  try {
    const generated = await questionAnalysisService.generateQuestions({
      field,
      topic,
      subtopic,
      difficulty,
      count: count || 10,
      interviewTypes,
    });

    // Save generated questions
    const saved = [];
    const batchId = `batch-${Date.now()}`;

    for (const q of generated) {
      const doc = await GeneratedQuestion.create({
        ...q,
        batchId,
        status: 'Draft',
        generatedBy: 'Groq-LLM',
        qualityScore: Math.random() * 50 + 50, // Mock quality score
      });
      saved.push(doc);
    }

    res.json({
      message: `Generated ${saved.length} questions`,
      batchId,
      questions: saved.map(q => ({ _id: q._id, question: q.question })),
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}));

// GET /api/questions/admin/pending-review - Get questions pending admin review
router.get('/admin/pending-review', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Unauthorized' });
    return;
  }

  const pending = await GeneratedQuestion.find({ status: 'Draft' })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('question modelAnswer field topic difficulty interviewType qualityScore batchId');

  res.json(pending);
}));

// POST /api/questions/admin/approve/:id - Approve generated question
router.post('/admin/approve/:id', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Only admins and employees can approve questions' });
    return;
  }

  const generatedQ = await GeneratedQuestion.findById(req.params.id);
  if (!generatedQ) {
    res.status(404).json({ message: 'Question not found' });
    return;
  }

  const question = await QuestionBank.findOneAndUpdate(
    { question: generatedQ.question },
    {
      field: generatedQ.field,
      topic: generatedQ.topic,
      subtopic: generatedQ.subtopic,
      question: generatedQ.question,
      answer: generatedQ.modelAnswer || '',
      difficulty: generatedQ.difficulty || 'Medium',
      interviewType: generatedQ.interviewType || 'Technical',
      followUpQuestions: generatedQ.followUpQuestions || [],
      scenarioVariations: generatedQ.scenarioQuestions || [],
      source: 'AI-Generated',
      status: 'Active',
      approved: true,
      approvedBy: req.user._id,
      approvalDate: new Date(),
      metadata: {
        answerQuality: generatedQ.qualityScore,
      },
    },
    { new: true, upsert: true },
  );

  generatedQ.status = 'Published';
  generatedQ.approvedBy = req.user._id;
  generatedQ.approvalDate = new Date();
  await generatedQ.save();

  res.json({ message: 'Question approved and published', question });
}));

// POST /api/questions/admin/reject/:id - Reject generated question
router.post('/admin/reject/:id', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Only admins and employees can reject questions' });
    return;
  }

  const generatedQ = await GeneratedQuestion.findById(req.params.id);
  if (!generatedQ) {
    res.status(404).json({ message: 'Question not found' });
    return;
  }

  await GeneratedQuestion.updateOne({ _id: req.params.id }, { status: 'Rejected' });

  res.json({ message: 'Question rejected' });
}));

// POST /api/questions/admin/check-duplicates - Check for duplicate questions
router.post('/admin/check-duplicates', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Unauthorized' });
    return;
  }

  const { questions } = req.body;

  try {
    // Get existing questions for comparison
    const existingQuestions = await QuestionBank.find({ status: 'Active' })
      .limit(1000)
      .select('question field topic');

    const duplicates = await questionAnalysisService.checkDuplicates(
      questions,
      existingQuestions
    );

    res.json({ duplicates });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}));

// GET /api/questions/stats - Admin analytics dashboard
router.get('/admin/stats', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Unauthorized' });
    return;
  }

  const totalQuestions = await QuestionBank.countDocuments({ status: 'Active' });
  const byDifficulty = await QuestionBank.aggregate([
    { $match: { status: 'Active' } },
    { $group: { _id: '$difficulty', count: { $sum: 1 } } },
  ]);
  const byField = await QuestionBank.aggregate([
    { $match: { status: 'Active' } },
    { $group: { _id: '$field', count: { $sum: 1 } } },
  ]);
  const pendingReview = await QuestionBank.countDocuments({ status: 'Review' });
  const mostAsked = await QuestionBank.find({ status: 'Active' }).sort({ timesAsked: -1 }).limit(5);

  res.json({
    totalQuestions,
    byDifficulty,
    byField,
    pendingReview,
    mostAsked: mostAsked.map(q => ({ question: q.question, timesAsked: q.timesAsked })),
  });
}));

// ===== STUDENT INTERVIEW ROUTES =====

// POST /api/questions/interview/start - Create interview session
router.post('/interview/start', protect, asyncHandler(async (req: AuthRequest, res) => {
  const { field, topic, difficulty, questionCount } = req.body;

  const session = await interviewSessionService.createSession({
    studentId: req.user._id,
    field,
    topic,
    difficulty,
    questionCount: questionCount || 5,
    useVariations: true,
    adaptiveDifficulty: true,
  });

  res.json(session);
}));

// GET /api/questions/interview/next/:sessionId - Get next question
router.get('/interview/next/:sessionId', protect, asyncHandler(async (req: AuthRequest, res) => {
  const question = await interviewSessionService.getNextQuestion(
    req.params.sessionId,
    req.user._id
  );
  res.json(question);
}));

// POST /api/questions/interview/submit-answer - Submit student answer
router.post('/interview/submit-answer', protect, asyncHandler(async (req: AuthRequest, res) => {
  const { sessionId, questionId, answer, answerType, timeTaken } = req.body;

  const submission = await interviewSessionService.submitAnswer({
    sessionId,
    studentId: req.user._id,
    questionId,
    answer,
    answerType,
    timeTaken,
  });

  // Analyze answer asynchronously
  const question = await QuestionBank.findById(questionId);
  if (question) {
    const analysis = await questionAnalysisService.analyzeAnswer({
      question: question.question,
      modelAnswer: question.answer,
      studentAnswer: answer,
      topic: question.topic,
    });

    if (analysis) {
      await StudentAnswer.findByIdAndUpdate(submission.answerId, {
        correctness: analysis.correctness || 0,
        confidenceScore: analysis.overallScore || 0,
        communicationScore: analysis.clarity || 0,
        technicalQualityScore: analysis.technicalQuality || 0,
        completenessScore: analysis.completeness || 0,
        grammarScore: analysis.grammar || 0,
        clarityScore: analysis.clarity || 0,
        overallScore: analysis.overallScore || 0,
        feedback: {
          strengths: analysis.strengths || [],
          weaknesses: analysis.weaknesses || [],
          missingConcepts: analysis.missingConcepts || [],
          suggestedImprovement: analysis.suggestedImprovement || '',
          betterAnswer: analysis.betterAnswer || '',
        },
        analysisCompletedAt: new Date(),
      });

      await AnswerAnalysis.create({
        answerId: submission.answerId,
        questionId,
        studentId: req.user._id,
        extractedConcepts: analysis.conceptsIdentified || [],
        mentionedKeywords: Array.isArray(analysis.keywordMatches) ? analysis.keywordMatches : [],
        keywordMatches: Array.isArray(analysis.keywordMatches) ? analysis.keywordMatches.length : 0,
        conceptCoverage: analysis.conceptCoverage || 0,
        logicalFlow: analysis.clarity || 0,
        relevance: analysis.correctness || 0,
        originalThinking: analysis.overallScore || 0,
        errors: analysis.commonMistakes || [],
        misconceptions: analysis.missingConcepts || [],
        missingInfo: analysis.missingConcepts || [],
      });
    }
  }

  res.json(submission);
}));

// GET /api/questions/interview/complete/:sessionId - Complete interview
router.post('/interview/complete/:sessionId', protect, asyncHandler(async (req: AuthRequest, res) => {
  const completed = await interviewSessionService.completeSession(
    req.params.sessionId,
    req.user._id
  );
  res.json(completed);
}));

// GET /api/questions/interview/report/:sessionId - Get interview report
router.get('/interview/report/:sessionId', protect, asyncHandler(async (req: AuthRequest, res) => {
  const session = await QuestionInterviewSession.findOne({
    sessionId: req.params.sessionId,
    studentId: req.user._id,
  });

  const answers = await StudentAnswer.find({ sessionId: req.params.sessionId });

  const scores = {
    averageCorrectness: answers.reduce((a, b) => a + (b.correctness || 0), 0) / answers.length || 0,
    averageCommunication: answers.reduce((a, b) => a + (b.communicationScore || 0), 0) / answers.length || 0,
    averageTechnical: answers.reduce((a, b) => a + (b.technicalQualityScore || 0), 0) / answers.length || 0,
  };

  res.json({
    session,
    questionsAsked: answers.length,
    averageScores: scores,
    strengthAreas: answers.flatMap((answer: any) => answer.feedback?.strengths || []).slice(0, 5),
    weakAreas: answers.flatMap((answer: any) => answer.feedback?.weaknesses || []).slice(0, 5),
  });
}));

// GET /api/questions/by-topic/:topic - Get all questions in a topic
router.get('/by-topic/:topic', asyncHandler(async (req, res) => {
  const questions = await QuestionBank.find({
    topic: req.params.topic,
    status: 'Active',
  }).select('question difficulty interviewType');

  res.json(questions);
}));

// GET /api/questions/history - Student's question history
router.get('/history', protect, asyncHandler(async (req: AuthRequest, res) => {
  const history = await StudentAnswer.find({ studentId: req.user._id })
    .populate('questionId', 'question topic field')
    .sort({ createdAt: -1 })
    .limit(20);

  res.json(history);
}));

export default router;
