import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect } from '../middleware/auth';
import { QuestionBank, QuestionInterviewSession, StudentAnswer, AnswerAnalysis, GeneratedQuestion } from '../models/questionBank';
import { questionAnalysisService } from '../services/questionAnalysis';
import { interviewSessionService } from '../services/interviewSession';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
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

// Helper to escape CSV values
const escapeCsvCell = (val: any) => {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

// Helper for case-insensitive and flexible key lookup in imported data
const getRowValue = (row: any, ...keys: string[]) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
    const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, ''));
    if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
};

// ===== ADMIN QUESTION BANK ROUTES =====

// GET /api/questions/admin/list - Paginated and searchable list of active QuestionBank items
router.get('/admin/list', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Unauthorized' });
    return;
  }

  const { page = 1, limit = 25, search = '', field = '', topic = '', difficulty = '', status = '' } = req.query;

  const query: any = {};
  if (field && field !== 'ALL') {
    query.field = field;
  }
  if (difficulty && difficulty !== 'ALL') {
    query.difficulty = difficulty;
  }
  if (topic) {
    query.topic = new RegExp(String(topic).trim(), 'i');
  }
  if (status && status !== 'ALL') {
    query.status = status;
  }
  if (search) {
    const s = String(search).trim();
    query.$or = [
      { question: new RegExp(s, 'i') },
      { answer: new RegExp(s, 'i') },
      { topic: new RegExp(s, 'i') },
      { field: new RegExp(s, 'i') },
      { keywords: { $in: [new RegExp(s, 'i')] } }
    ];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [questions, total] = await Promise.all([
    QuestionBank.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    QuestionBank.countDocuments(query)
  ]);

  res.json({
    questions,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1
  });
}));

// POST /api/questions/admin/create-single - Admin manually adds a single question
router.post('/admin/create-single', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Only admins can create questions' });
    return;
  }

  const { field, topic, subtopic, question, answer, difficulty, interviewType, keywords } = req.body;
  if (!field || !topic || !question || !answer) {
    res.status(400).json({ message: 'Field, Topic, Question, and Answer are required.' });
    return;
  }

  const parsedKeywords = Array.isArray(keywords)
    ? keywords
    : typeof keywords === 'string'
    ? keywords.split(/[,;|]/).map((k: string) => k.trim()).filter(Boolean)
    : [];

  const saved = await QuestionBank.findOneAndUpdate(
    { question: question.trim() },
    {
      field: field.trim(),
      topic: topic.trim(),
      subtopic: subtopic?.trim() || '',
      question: question.trim(),
      answer: answer.trim(),
      difficulty: difficulty || 'Medium',
      interviewType: interviewType || 'Technical',
      keywords: parsedKeywords,
      source: 'Manual',
      status: 'Active',
      approved: true,
      approvedBy: req.user._id,
      approvalDate: new Date(),
    },
    { new: true, upsert: true }
  );

  res.json({ message: 'Question saved successfully into dataset', question: saved });
}));

// PUT /api/questions/admin/:id - Update an existing question
router.put('/admin/:id', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Unauthorized' });
    return;
  }

  const { field, topic, subtopic, question, answer, difficulty, interviewType, keywords, status } = req.body;
  const updateData: any = {};
  if (field) updateData.field = field.trim();
  if (topic) updateData.topic = topic.trim();
  if (subtopic !== undefined) updateData.subtopic = subtopic.trim();
  if (question) updateData.question = question.trim();
  if (answer) updateData.answer = answer.trim();
  if (difficulty) updateData.difficulty = difficulty;
  if (interviewType) updateData.interviewType = interviewType;
  if (status) updateData.status = status;
  if (keywords !== undefined) {
    updateData.keywords = Array.isArray(keywords)
      ? keywords
      : typeof keywords === 'string'
      ? keywords.split(/[,;|]/).map((k: string) => k.trim()).filter(Boolean)
      : [];
  }

  const updated = await QuestionBank.findByIdAndUpdate(req.params.id, updateData, { new: true });
  if (!updated) {
    res.status(404).json({ message: 'Question not found' });
    return;
  }

  res.json({ message: 'Question updated successfully', question: updated });
}));

// DELETE /api/questions/admin/:id - Delete a question
router.delete('/admin/:id', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Unauthorized' });
    return;
  }

  const deleted = await QuestionBank.findByIdAndDelete(req.params.id);
  if (!deleted) {
    res.status(404).json({ message: 'Question not found' });
    return;
  }

  res.json({ message: 'Question deleted successfully' });
}));

// GET /api/questions/admin/export - Download full Question Bank dataset as Excel or CSV
router.get('/admin/export', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Unauthorized' });
    return;
  }

  const { format = 'xlsx', field, difficulty } = req.query;
  const filter: any = {};
  if (field && field !== 'ALL') filter.field = field;
  if (difficulty && difficulty !== 'ALL') filter.difficulty = difficulty;

  const questions = await QuestionBank.find(filter).sort({ field: 1, topic: 1 }).lean();

  if (format === 'csv') {
    let csvContent = '\uFEFF'; // UTF-8 BOM for flawless Excel opening
    csvContent += ['Field', 'Topic', 'Subtopic', 'Difficulty', 'Interview Type', 'Question', 'Answer', 'Keywords', 'Source', 'Status'].map(escapeCsvCell).join(',') + '\n';
    
    for (const q of questions) {
      csvContent += [
        q.field || '',
        q.topic || '',
        q.subtopic || '',
        q.difficulty || 'Medium',
        q.interviewType || 'Technical',
        q.question || '',
        q.answer || '',
        Array.isArray(q.keywords) ? q.keywords.join('; ') : (q.keywords || ''),
        q.source || 'Manual',
        q.status || 'Active',
      ].map(escapeCsvCell).join(',') + '\n';
    }

    res.setHeader('Content-Disposition', 'attachment; filename="skilldna_question_bank.csv"');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.status(200).send(csvContent);
    return;
  }

  // Default: generate Excel workbook (.xlsx)
  const worksheetData = [
    ['Field', 'Topic', 'Subtopic', 'Difficulty', 'Interview Type', 'Question', 'Answer', 'Keywords', 'Source', 'Status'],
    ...questions.map(q => [
      q.field || '',
      q.topic || '',
      q.subtopic || '',
      q.difficulty || 'Medium',
      q.interviewType || 'Technical',
      q.question || '',
      q.answer || '',
      Array.isArray(q.keywords) ? q.keywords.join('; ') : (q.keywords || ''),
      q.source || 'Manual',
      q.status || 'Active',
    ])
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Set generous column widths
  ws['!cols'] = [
    { wch: 22 }, // Field
    { wch: 20 }, // Topic
    { wch: 18 }, // Subtopic
    { wch: 12 }, // Difficulty
    { wch: 16 }, // Interview Type
    { wch: 45 }, // Question
    { wch: 60 }, // Answer
    { wch: 30 }, // Keywords
    { wch: 14 }, // Source
    { wch: 12 }, // Status
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'QuestionBank');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="skilldna_question_bank.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.status(200).send(buffer);
}));

// GET /api/questions/admin/template - Download starter template for Excel or CSV
router.get('/admin/template', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Unauthorized' });
    return;
  }

  const { format = 'xlsx' } = req.query;

  const sampleRows = [
    [
      'Computer Science',
      'JavaScript',
      'Event Loop',
      'Medium',
      'Technical',
      'How does the Node.js event loop handle microtasks vs macrotasks?',
      'Microtasks (Promise callbacks, process.nextTick) are executed immediately after the current operation finishes and before the event loop advances to the next phase (timers, I/O polling, check).',
      'event loop; microtasks; async; nodejs'
    ],
    [
      'Mechanical Engineering',
      'Thermodynamics',
      'Rankine Cycle',
      'Hard',
      'Technical',
      'Explain the four stages of the ideal Rankine cycle and how reheating improves plant efficiency.',
      'The cycle includes isentropic compression in the pump, isobaric heat supply in the boiler, isentropic expansion in the turbine, and isobaric heat rejection in the condenser. Reheating raises average temperature of heat addition.',
      'Rankine cycle; thermodynamics; steam turbine; efficiency'
    ],
    [
      'Commerce',
      'Financial Accounting',
      'Depreciation',
      'Easy',
      'Technical',
      'What is the fundamental difference between the Straight-Line Method and Written Down Value method of depreciation?',
      'Straight-line charges a uniform depreciation amount each year based on original cost, while WDV calculates depreciation on the reducing book value at a fixed percentage.',
      'accounting; depreciation; SLM; WDV'
    ],
    [
      'Healthcare',
      'Clinical Diagnostics',
      'Cardiology',
      'Hard',
      'Technical',
      'What are the key electrocardiographic indicators of an acute ST-elevation myocardial infarction (STEMI)?',
      'Hallmarks include new ST-segment elevation at the J-point in at least two contiguous leads, reciprocal ST depression in opposite leads, and progressive pathological Q waves.',
      'STEMI; ECG; myocardial infarction; cardiology'
    ],
    [
      'Finance',
      'Valuation',
      'Cost of Capital',
      'Medium',
      'Technical',
      'How is Weighted Average Cost of Capital (WACC) calculated and when is it applied as the discount rate?',
      'WACC weights cost of equity and after-tax cost of debt by their market proportions. It is used as the discount rate for cash flows generated by the entire enterprise (FCFF).',
      'WACC; CAPM; valuation; DCF'
    ]
  ];

  if (format === 'csv') {
    let csv = '\uFEFF';
    csv += ['Field', 'Topic', 'Subtopic', 'Difficulty', 'Interview Type', 'Question', 'Answer', 'Keywords'].map(escapeCsvCell).join(',') + '\n';
    for (const r of sampleRows) {
      csv += r.map(escapeCsvCell).join(',') + '\n';
    }
    res.setHeader('Content-Disposition', 'attachment; filename="skilldna_question_template.csv"');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.status(200).send(csv);
    return;
  }

  const worksheetData = [
    ['Field', 'Topic', 'Subtopic', 'Difficulty', 'Interview Type', 'Question', 'Answer', 'Keywords'],
    ...sampleRows
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  ws['!cols'] = [
    { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 45 }, { wch: 60 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'QuestionTemplate');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="skilldna_question_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.status(200).send(buffer);
}));

// POST /api/questions/admin/generate-and-add - AI creates questions and automatically adds them to the active dataset
router.post('/admin/generate-and-add', protect, asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Only admins can generate questions' });
    return;
  }

  const { field, topic, subtopic, difficulty = 'Medium', count = 5 } = req.body;

  if (!field || !topic) {
    res.status(400).json({ message: 'Field/Domain and Topic are required for AI generation.' });
    return;
  }

  const requestedCount = Math.min(Math.max(1, Number(count) || 5), 25);

  try {
    const generated = await questionAnalysisService.generateQuestions({
      field,
      topic,
      subtopic,
      difficulty,
      count: requestedCount,
      interviewTypes: ['Technical', 'Scenario'],
    });

    const savedQuestions = [];
    for (const item of generated) {
      const qText = item.question?.trim();
      const aText = (item.modelAnswer || item.answer || '').trim();
      if (!qText) continue;

      const keywords = Array.isArray(item.keywords) && item.keywords.length > 0
        ? item.keywords
        : [topic, field].filter(Boolean);

      const saved = await QuestionBank.findOneAndUpdate(
        { question: qText },
        {
          field: field || item.field || 'General',
          topic: topic || item.topic || 'Core',
          subtopic: subtopic || item.subtopic || '',
          question: qText,
          answer: aText || `Comprehensive model answer for ${topic}: Explains core mechanisms, real-world application, edge case analysis, and industry standards.`,
          difficulty: difficulty || item.difficulty || 'Medium',
          interviewType: item.interviewType || 'Technical',
          keywords,
          followUpQuestions: item.followUpQuestions || [],
          scenarioVariations: item.scenarioQuestions || [],
          source: 'AI-Generated',
          status: 'Active',
          approved: true,
          approvedBy: req.user._id,
          approvalDate: new Date(),
        },
        { new: true, upsert: true }
      );

      savedQuestions.push(saved);
    }

    res.json({
      message: `Successfully generated and added ${savedQuestions.length} questions to the active Question Bank dataset!`,
      count: savedQuestions.length,
      questions: savedQuestions,
    });
  } catch (err: any) {
    console.error('AI question generation and add error:', err);
    res.status(500).json({ message: 'Failed to generate questions: ' + (err.message || 'Unknown error') });
  }
}));

// POST /api/questions/admin/upload - Upload questions in bulk via Excel (.xlsx, .xls) or CSV
router.post('/admin/upload', protect, upload.single('file'), asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageQuestions(req)) {
    res.status(403).json({ message: 'Only admins can upload questions' });
    return;
  }

  const { uploadFormat, manualQuestions } = req.body;

  try {
    let rawRows: Array<Record<string, any>> = [];

    if (uploadFormat === 'manual' && manualQuestions) {
      rawRows = typeof manualQuestions === 'string' ? JSON.parse(manualQuestions) : manualQuestions;
    } else if (req.file) {
      const originalName = req.file.originalname?.toLowerCase() || '';
      if (uploadFormat === 'excel' || originalName.endsWith('.xlsx') || originalName.endsWith('.xls')) {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        rawRows = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, any>>;
      } else if (uploadFormat === 'csv' || originalName.endsWith('.csv')) {
        rawRows = parse(req.file.buffer.toString(), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Array<Record<string, any>>;
      } else if (uploadFormat === 'json' || originalName.endsWith('.json')) {
        rawRows = JSON.parse(req.file.buffer.toString());
      } else {
        // Fallback try reading with XLSX (which handles both excel and csv)
        try {
          const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          rawRows = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, any>>;
        } catch {
          rawRows = parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string, any>>;
        }
      }
    }

    if (!rawRows || rawRows.length === 0) {
      res.status(400).json({ message: 'No questions found in uploaded data.' });
      return;
    }

    const savedQuestions = [];
    for (const row of rawRows) {
      const question = getRowValue(row, 'question', 'question_text', 'prompt');
      const answer = getRowValue(row, 'answer', 'modelAnswer', 'solution', 'expected_answer');
      const field = getRowValue(row, 'field', 'domain', 'careerDomain') || 'General';
      const topic = getRowValue(row, 'topic', 'subject') || 'Core';
      const subtopic = getRowValue(row, 'subtopic', 'sub_topic', 'category');
      const difficulty = getRowValue(row, 'difficulty', 'level') || 'Medium';
      const interviewType = getRowValue(row, 'interviewType', 'interview_type', 'type') || 'Technical';
      const rawKeywords = getRowValue(row, 'keywords', 'tags');
      const keywords = rawKeywords ? rawKeywords.split(/[,;|]/).map(s => s.trim()).filter(Boolean) : [];

      if (!question || !answer) {
        continue; // Skip invalid rows missing question or answer
      }

      const saved = await QuestionBank.findOneAndUpdate(
        { question },
        {
          field,
          topic,
          subtopic,
          question,
          answer,
          difficulty,
          interviewType,
          keywords: keywords.length > 0 ? keywords : [topic, field].filter(Boolean),
          uploadedBy: req.user._id,
          source: req.file?.originalname?.endsWith('.xlsx') ? 'Excel' : (uploadSourceByFormat[uploadFormat] || 'CSV'),
          status: 'Active',
          approved: true,
          approvedBy: req.user._id,
          approvalDate: new Date(),
        },
        { new: true, upsert: true }
      );

      savedQuestions.push(saved);
    }

    res.json({
      message: `Successfully processed and activated ${savedQuestions.length} questions in dataset!`,
      questions: savedQuestions.map(q => ({ _id: q._id, question: q.question, field: q.field, status: q.status })),
    });
  } catch (error: any) {
    console.error('Upload processing error:', error);
    res.status(400).json({ message: error.message || 'Failed to process question file.' });
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
    answerType: answerType || 'Text',
    timeTaken: timeTaken || 90,
  });

  res.json(submission);
}));

// POST /api/questions/interview/complete/:sessionId - Complete interview
router.post('/interview/complete/:sessionId', protect, asyncHandler(async (req: AuthRequest, res) => {
  const completed = await interviewSessionService.completeSession(
    req.params.sessionId,
    req.user._id
  );
  res.json(completed);
}));

// GET /api/questions/interview/report/:sessionId - Get interview report
router.get('/interview/report/:sessionId', protect, asyncHandler(async (req: AuthRequest, res) => {
  let session = await QuestionInterviewSession.findOne({
    sessionId: req.params.sessionId,
    studentId: req.user._id,
  });

  if (!session) {
    res.status(404).json({ message: 'Interview session not found' });
    return;
  }

  if (session.status !== 'Completed') {
    await interviewSessionService.completeSession(req.params.sessionId, req.user._id);
    session = await QuestionInterviewSession.findOne({ sessionId: req.params.sessionId });
  }

  if (!session) {
    res.status(404).json({ message: 'Interview session could not be completed' });
    return;
  }

  const answers = await StudentAnswer.find({ sessionId: req.params.sessionId }).populate('questionId', 'question topic field difficulty');

  res.json({
    session,
    finalReport: session.finalReport || {
      overallScore: session.competencies?.overall || 0,
      competencies: session.competencies,
      strengths: session.strengths || [],
      weaknesses: session.weaknesses || [],
    },
    answers,
    questionsAsked: answers.length,
    averageScores: {
      averageCorrectness: session.competencies?.technical || 0,
      averageTechnical: session.competencies?.technical || 0,
      averageCommunication: session.competencies?.communication || 0,
      averageProblemSolving: session.competencies?.problemSolving || 0,
      averageConfidence: session.competencies?.confidence || 0,
      averageClarity: session.competencies?.clarity || 0,
      overall: session.competencies?.overall || 0,
    },
    answerCounts: session.answerCounts,
    stuckTopics: session.stuckTopics || [],
    difficultyProgression: session.difficultyProgression || [],
    strengthAreas: session.strengths?.slice(0, 6) || [],
    weakAreas: session.weaknesses?.slice(0, 6) || [],
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
