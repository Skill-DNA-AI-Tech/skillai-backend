import express from 'express';
import asyncHandler from 'express-async-handler';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { protect, AuthRequest } from '../middleware/auth';
import TopicNote from '../models/learning/topicNote';
import ContentRequest from '../models/learning/contentRequest';
import { isAdminRole } from '../utils/rbac';
import { groqRequest } from '../services/groqClient';
import { writeAuditLog } from '../utils/audit';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const canManageNotes = (req: AuthRequest) => isAdminRole(req.user?.role, req.user?.email);

// Helper to escape CSV cells
const escapeCsv = (val: any) => {
  if (val === undefined || val === null) return '""';
  return `"${String(val).replace(/"/g, '""')}"`;
};

// Helper for flexible column matching in uploaded files
const getVal = (row: any, ...keys: string[]) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
    const found = Object.keys(row).find(
      (rk) => rk.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, '')
    );
    if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
};

// GET /api/admin/notes - List notes with filtering
router.get(
  '/',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!canManageNotes(req)) {
      res.status(403).json({ message: 'Unauthorized. Admin permission required.' });
      return;
    }

    const { domain, topic, subtopic, status, search, page = 1, limit = 50 } = req.query;
    const query: any = {};

    if (domain && domain !== 'ALL') query.domain = domain;
    if (topic && topic !== 'ALL') query.topic = new RegExp(String(topic).trim(), 'i');
    if (subtopic && subtopic !== 'ALL') query.subtopic = new RegExp(String(subtopic).trim(), 'i');
    if (status && status !== 'ALL') query.status = status;

    if (search) {
      const s = String(search).trim();
      query.$or = [
        { title: new RegExp(s, 'i') },
        { topic: new RegExp(s, 'i') },
        { subtopic: new RegExp(s, 'i') },
        { domain: new RegExp(s, 'i') },
        { overview: new RegExp(s, 'i') },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [notes, total] = await Promise.all([
      TopicNote.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limitNum).lean(),
      TopicNote.countDocuments(query),
    ]);

    res.json({
      notes,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  })
);

// POST /api/admin/notes - Manually create topic note
router.post(
  '/',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!canManageNotes(req)) {
      res.status(403).json({ message: 'Unauthorized. Admin permission required.' });
      return;
    }

    const {
      domain = 'Computer Science',
      topic,
      subtopic = 'General',
      title,
      overview,
      richText,
      content,
      keyTakeaways,
      examples,
      resources,
      status,
      career,
    } = req.body;

    if (!topic || !String(topic).trim()) {
      res.status(400).json({ message: 'Topic is a required field.' });
      return;
    }

    const trimmedTopic = String(topic).trim();
    const trimmedSubtopic = String(subtopic || 'General').trim();
    const effectiveTitle = (title || `${trimmedTopic} - ${trimmedSubtopic}`).trim();
    const effectiveText = (richText || content || overview || '').trim();

    let normalizedStatus: 'Draft' | 'Published' | 'Archived' = 'Published';
    if (typeof status === 'string') {
      const s = status.trim().toUpperCase();
      if (s === 'DRAFT') normalizedStatus = 'Draft';
      else if (s === 'ARCHIVED') normalizedStatus = 'Archived';
      else normalizedStatus = 'Published';
    }

    const note = await TopicNote.create({
      career: career || '',
      domain: String(domain).trim(),
      topic: trimmedTopic,
      subtopic: trimmedSubtopic,
      title: effectiveTitle,
      overview: overview || effectiveText.slice(0, 300),
      richText: effectiveText,
      keyTakeaways: Array.isArray(keyTakeaways)
        ? keyTakeaways
        : typeof keyTakeaways === 'string'
        ? keyTakeaways.split('\n').map((k: string) => k.trim()).filter(Boolean)
        : [],
      examples: examples || '',
      resources: Array.isArray(resources) ? resources : [],
      status: normalizedStatus,
      isAiGenerated: false,
      createdBy: req.user._id,
      publishedAt: normalizedStatus === 'Published' ? new Date() : undefined,
    });

    await writeAuditLog(req, 'TOPIC_NOTE_CREATED', 'TopicNote', note._id.toString(), {
      topic: note.topic,
      subtopic: note.subtopic,
      title: note.title,
    });

    res.status(201).json({ message: 'Topic note created successfully.', note });
  })
);

// POST /api/admin/notes/ai-generate and /generate-ai - Admin triggers LLM to generate note draft
const handleAiGenerate = asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageNotes(req)) {
    res.status(403).json({ message: 'Unauthorized. Admin permission required.' });
    return;
  }

  const { domain, topic, subtopic = 'General', careerDomain, level = 'Intermediate' } = req.body;

  if (!topic || !String(topic).trim()) {
    res.status(400).json({ message: 'Topic is required for AI generation.' });
    return;
  }

  const trimmedTopic = String(topic).trim();
  const trimmedSubtopic = String(subtopic).trim();

  const prompt = `You are a world-class technical instructional designer writing official curriculum notes for SkillDNA AI.
Generate comprehensive, pedagogical, and industry-grade notes for:
- Domain: ${domain || 'Computer Science'}
- Topic: ${trimmedTopic}
- Subtopic: ${trimmedSubtopic}
- Target Level: ${level}

Return ONLY a valid JSON object matching this schema:
{
  "title": "Mastering ${trimmedSubtopic} in ${trimmedTopic}",
  "overview": "Clear 2-3 paragraph foundational and mechanical breakdown of ${trimmedSubtopic}.",
  "richText": "Detailed explanatory lesson text including architecture, mechanisms, and production best practices.",
  "keyTakeaways": ["Point 1", "Point 2", "Point 3", "Point 4"],
  "examples": "Working practical code snippet or design example demonstrating ${trimmedSubtopic}.",
  "resources": [
    {
      "title": "${trimmedSubtopic} Full Tutorial",
      "type": "youtube",
      "url": "https://www.youtube.com/results?search_query=${encodeURIComponent(trimmedTopic + ' ' + trimmedSubtopic + ' tutorial')}",
      "description": "Comprehensive video breakdown of ${trimmedSubtopic} with live implementation."
    }
  ]
}`;

  let parsed: any = null;
  try {
    const aiResponse = await groqRequest({ prompt });
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('AI note generation failed, using structured template fallback:', err);
  }

  if (!parsed) {
    parsed = {
      title: `Mastery Guide: ${trimmedSubtopic} in ${trimmedTopic}`,
      overview: `${trimmedSubtopic} is an indispensable core concept within ${trimmedTopic}. Understanding its foundational mechanisms, performance characteristics, and industry patterns enables resilient system implementation.`,
      richText: `### 1. Conceptual Foundation\n${trimmedSubtopic} establishes the core structural rules governing this module.\n\n### 2. Architectural Mechanisms\nWhen executed in production environments, ${trimmedSubtopic} ensures predictable resource utilization and prevents runtime anti-patterns.\n\n### 3. Industry Best Practices\n- Verify boundary cases and null safety.\n- Profile memory and CPU allocations under simulated peak loads.\n- Follow clean design principles to maintain modularity.`,
      keyTakeaways: [
        `Master fundamental principles before applying optimizations.`,
        `Recognize common edge cases and implement graceful fallbacks.`,
        `Maintain modular separation of concerns.`,
        `Write automated unit tests verifying contract invariants.`,
      ],
      examples: `// Practical demonstration for ${trimmedSubtopic}\npublic class ${trimmedSubtopic.replace(/[^a-zA-Z]/g, '')}Example {\n    public static void main(String[] args) {\n        System.out.println("Executing verified pattern for: ${trimmedSubtopic}");\n    }\n}`,
      resources: [
        {
          title: `${trimmedSubtopic} Complete Video Walkthrough`,
          type: 'youtube',
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmedTopic + ' ' + trimmedSubtopic + ' tutorial')}`,
          description: `Detailed video guide explaining ${trimmedSubtopic} step-by-step.`,
        },
      ],
    };
  }

  const responsePayload = {
    domain: domain || 'Computer Science',
    topic: trimmedTopic,
    subtopic: trimmedSubtopic,
    title: parsed.title || `Mastery Guide: ${trimmedSubtopic} in ${trimmedTopic}`,
    overview: parsed.overview || '',
    richText: parsed.richText || '',
    keyTakeaways: parsed.keyTakeaways || [],
    examples: parsed.examples || '',
    resources: parsed.resources || [],
    notes: {
      title: parsed.title || `Mastery Guide: ${trimmedSubtopic} in ${trimmedTopic}`,
      content: parsed.richText || parsed.overview || '',
      keyTakeaways: parsed.keyTakeaways || [],
      codeExamples: parsed.examples ? [parsed.examples] : [],
      resources: parsed.resources || [],
    },
  };

  res.json(responsePayload);
});

router.post('/ai-generate', protect, handleAiGenerate);
router.post('/generate-ai', protect, handleAiGenerate);

// POST /api/admin/notes/upload and /bulk-upload - Bulk import topic notes via Excel or CSV
const handleUpload = asyncHandler(async (req: AuthRequest, res) => {
  if (!canManageNotes(req)) {
    res.status(403).json({ message: 'Unauthorized. Admin permission required.' });
    return;
  }

    if (!req.file) {
      res.status(400).json({ message: 'Please upload an Excel (.xlsx, .xls) or CSV file.' });
      return;
    }

    try {
      const originalName = req.file.originalname?.toLowerCase() || '';
      let rawRows: Array<Record<string, any>> = [];

      if (originalName.endsWith('.csv')) {
        rawRows = parse(req.file.buffer.toString(), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Array<Record<string, any>>;
      } else {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, any>>;
      }

      if (!rawRows || rawRows.length === 0) {
        res.status(400).json({ message: 'No rows found in uploaded file.' });
        return;
      }

      const createdNotes = [];
      for (const row of rawRows) {
        const domain = getVal(row, 'domain', 'field', 'careerDomain') || 'Computer Science';
        const topic = getVal(row, 'topic', 'subject', 'module') || 'Core';
        const subtopic = getVal(row, 'subtopic', 'sub_topic', 'concept') || 'General';
        const title = getVal(row, 'title', 'note_title') || `${subtopic} Overview`;
        const overview = getVal(row, 'overview', 'summary', 'description');
        const richText = getVal(row, 'content', 'notes', 'richText', 'body');
        const takeawaysRaw = getVal(row, 'keyTakeaways', 'takeaways', 'points');
        const examples = getVal(row, 'examples', 'code', 'sample');
        const resourcesRaw = getVal(row, 'resources', 'links', 'urls');

        const keyTakeaways = takeawaysRaw
          ? takeawaysRaw.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean)
          : [];

        const resources: any[] = [];
        if (resourcesRaw) {
          const links = resourcesRaw.split(/[,;\n]/).map((l) => l.trim()).filter(Boolean);
          for (const link of links) {
            const isYt = link.includes('youtube.com') || link.includes('youtu.be');
            const isUdemy = link.includes('udemy.com');
            resources.push({
              title: isYt ? 'Video Tutorial' : isUdemy ? 'Online Course' : 'Reference Document',
              type: isYt ? 'youtube' : isUdemy ? 'udemy' : 'doc',
              url: link,
            });
          }
        }

        const note = await TopicNote.findOneAndUpdate(
          { domain, topic, subtopic },
          {
            domain,
            topic,
            subtopic,
            title,
            overview: overview || `${title} covering key mechanisms and patterns.`,
            richText: richText || overview || '',
            keyTakeaways,
            examples: examples || '',
            resources,
            status: 'Published',
            isAiGenerated: false,
            createdBy: req.user._id,
            publishedAt: new Date(),
          },
          { new: true, upsert: true }
        );

        createdNotes.push(note);
      }

      await writeAuditLog(req, 'TOPIC_NOTES_BULK_UPLOAD', 'TopicNote', 'bulk', {
        count: createdNotes.length,
        filename: req.file.originalname,
      });

      res.json({
        message: `Successfully processed and published ${createdNotes.length} topic notes into dataset!`,
        count: createdNotes.length,
      });
    } catch (err: any) {
      console.error('Notes upload error:', err);
      res.status(400).json({ message: err.message || 'Failed to process notes file.' });
    }
});

router.post('/upload', protect, upload.single('file'), handleUpload);
router.post('/bulk-upload', protect, upload.single('file'), handleUpload);

// GET /api/admin/notes/template - Download starter template for Excel or CSV
router.get(
  '/template',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!canManageNotes(req)) {
      res.status(403).json({ message: 'Unauthorized.' });
      return;
    }

    const { format = 'xlsx' } = req.query;

    const sampleRows = [
      [
        'Computer Science',
        'Java',
        'OOP',
        'Object-Oriented Programming in Java',
        'OOP models real-world entities through Encapsulation, Inheritance, Polymorphism, and Abstraction.',
        'Encapsulation bundles data and methods while restricting direct access. Inheritance enables code reuse via extends. Polymorphism allows methods to take multiple forms through overloading and overriding. Abstraction hides implementation details using interfaces and abstract classes.',
        'Encapsulation uses private fields with getters/setters; Polymorphism enables dynamic method dispatch; Prefer composition over inheritance.',
        'public class Animal {\n    public void speak() {\n        System.out.println("Animal sound");\n    }\n}\npublic class Dog extends Animal {\n    @Override\n    public void speak() {\n        System.out.println("Bark");\n    }\n}',
        'https://www.youtube.com/watch?v=sample_oop; https://docs.oracle.com/en/java/'
      ],
      [
        'Computer Science',
        'Java',
        'Collections Framework',
        'Java Collections Framework Deep Dive',
        'The collections framework provides high-performance data structures including List, Set, Map, and Queue.',
        'ArrayList provides O(1) indexed access but O(n) worst-case insertions. HashMap uses array buckets with LinkedLists and Treeify threshold of 8 using red-black trees.',
        'HashMap is not thread-safe; use ConcurrentHashMap in multi-threaded code; Override equals and hashCode together.',
        'Map<String, Integer> map = new HashMap<>();\nmap.put("Key", 100);',
        'https://www.youtube.com/watch?v=sample_collections'
      ],
      [
        'Mechanical Engineering',
        'CAD & GD&T',
        'GD&T Feature Control Frames',
        'Geometric Dimensioning and Tolerancing Standards',
        'GD&T communicates design intent using feature control frames according to ASME Y14.5.',
        'Datums serve as reference geometry. Position tolerance establishes cylindrical tolerance zones for holes and pins.',
        'Datums must follow order of precedence; MMC allows bonus tolerance.',
        'Feature control frame: [Pos | ⌀0.25 (M) | A | B | C]',
        'https://www.youtube.com/watch?v=sample_gdt'
      ]
    ];

    if (format === 'csv') {
      let csv = '\uFEFF';
      csv += ['Domain', 'Topic', 'Subtopic', 'Title', 'Overview', 'Content', 'KeyTakeaways', 'Examples', 'Resources'].map(escapeCsv).join(',') + '\n';
      for (const r of sampleRows) {
        csv += r.map(escapeCsv).join(',') + '\n';
      }
      res.setHeader('Content-Disposition', 'attachment; filename="skilldna_topic_notes_template.csv"');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.status(200).send(csv);
      return;
    }

    const worksheetData = [
      ['Domain', 'Topic', 'Subtopic', 'Title', 'Overview', 'Content', 'KeyTakeaways', 'Examples', 'Resources'],
      ...sampleRows,
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    ws['!cols'] = [
      { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 35 }, { wch: 45 }, { wch: 60 }, { wch: 40 }, { wch: 40 }, { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'TopicNotesTemplate');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="skilldna_topic_notes_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.status(200).send(buffer);
  })
);

// PUT /api/admin/notes/:id - Edit and publish/unpublish note
router.put(
  '/:id',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!canManageNotes(req)) {
      res.status(403).json({ message: 'Unauthorized.' });
      return;
    }

    const updated = await TopicNote.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      res.status(404).json({ message: 'Topic note not found.' });
      return;
    }

    res.json({ message: 'Topic note updated successfully.', note: updated });
  })
);

// DELETE /api/admin/notes/:id - Delete note
router.delete(
  '/:id',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!canManageNotes(req)) {
      res.status(403).json({ message: 'Unauthorized.' });
      return;
    }

    const deleted = await TopicNote.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: 'Topic note not found.' });
      return;
    }

    res.json({ message: 'Topic note deleted successfully.' });
  })
);

// GET /api/admin/notes/requests - Retrieve student content requests
router.get(
  '/requests',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!canManageNotes(req)) {
      res.status(403).json({ message: 'Unauthorized.' });
      return;
    }

    const { status } = req.query;
    const filter: any = {};
    if (status && status !== 'ALL') filter.status = status;

    const requests = await ContentRequest.find(filter)
      .populate('fulfilledByNoteId', 'title')
      .sort({ createdAt: -1 })
      .limit(100);

    const pendingCount = await ContentRequest.countDocuments({ status: 'PENDING' });

    res.json({ requests, pendingCount });
  })
);

// POST /api/admin/notes/requests/:id/fulfill - Fulfill student content request
router.post(
  '/requests/:id/fulfill',
  protect,
  asyncHandler(async (req: AuthRequest, res) => {
    if (!canManageNotes(req)) {
      res.status(403).json({ message: 'Unauthorized.' });
      return;
    }

    const { noteId, adminRemarks } = req.body;
    const request = await ContentRequest.findById(req.params.id);

    if (!request) {
      res.status(404).json({ message: 'Content request not found.' });
      return;
    }

    request.status = 'FULFILLED';
    if (noteId) request.fulfilledByNoteId = noteId;
    if (adminRemarks) request.adminRemarks = adminRemarks;
    await request.save();

    res.json({ message: 'Content request marked as fulfilled.', request });
  })
);

export default router;
