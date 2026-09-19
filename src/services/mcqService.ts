import mongoose from 'mongoose';
import { QuestionBank } from '../models/questionBank';
import Assessment from '../models/assessment';
import CareerTwinMemory from '../models/careerTwinMemory';
import Profile from '../models/profile';
import User from '../models/user';
import StudentTopicProgress from '../models/learning/studentTopicProgress';
import { groqRequest } from './groqClient';
import { randomUUID } from 'crypto';
import { normalizeDomain } from './interviewSession';

export interface IMCQQuestion {
  questionId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  subtopic?: string;
  difficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
}

// In-memory active MCQ test cache keyed by sessionId (to securely keep correct answers server-side)
const activeMCQSessions = new Map<string, {
  studentId: string;
  careerDomain: string;
  career?: string;
  topic?: string;
  subtopic?: string;
  targetRole: string;
  questions: IMCQQuestion[];
  startedAt: Date;
}>();

export const mcqService = {
  // Start 10-15 question MCQ assessment with progressive difficulty
  // Searches QuestionBank; if < 10 questions exist, generates via AI, validates, saves to QuestionBank
  startMCQSession: async (payload: {
    studentId: string;
    domain?: string;
    careerDomain?: string;
    career?: string;
    topic?: string;
    subtopic?: string;
    targetRole?: string;
    questionCount?: number;
  }) => {
    const student = await User.findById(payload.studentId).lean();
    const profile = await Profile.findOne({ user: payload.studentId }).lean();
    const careerTwin = await CareerTwinMemory.findOne({
      $or: [{ userId: payload.studentId }, { user: payload.studentId }],
    }).lean();

    const rawDomain = payload.domain || payload.careerDomain || (profile as any)?.activeCurriculum?.domain || (student as any)?.careerDomain || (profile as any)?.domain || 'Computer Science';
    const domain = normalizeDomain(rawDomain);
    const career = payload.career || (profile as any)?.career || (profile as any)?.activeCurriculum?.career || 'Software Engineer';
    const topic = payload.topic || (profile as any)?.activeCurriculum?.topics?.[0]?.name || '';
    const subtopic = payload.subtopic || '';
    const targetRole = payload.targetRole || (student as any)?.targetRole || (profile as any)?.preferredRoles?.[0] || 'Specialist';
    const totalCount = Math.max(10, Math.min(15, payload.questionCount || 10));

    // 1. Search QuestionBank first
    const query: any = {
      status: 'Active',
    };

    if (topic && topic.trim()) {
      query.topic = new RegExp(topic.trim(), 'i');
    } else {
      query.field = new RegExp(domain.split(' ')[0], 'i');
    }

    if (subtopic && subtopic.trim()) {
      query.subtopic = new RegExp(subtopic.trim(), 'i');
    }

    let bankQuestions = await QuestionBank.find(query).lean();

    // Filter to questions that have valid mcqOptions (at least 4 options and valid answer)
    let validMCQs = bankQuestions.filter(
      (q: any) => Array.isArray(q.mcqOptions) && q.mcqOptions.length >= 4 && q.answer
    );

    // If fewer than 10 questions found for exact topic/subtopic, search broader domain
    if (validMCQs.length < 10 && topic) {
      const broaderMCQs = await QuestionBank.find({
        field: new RegExp(domain.split(' ')[0], 'i'),
        status: 'Active',
        mcqOptions: { $exists: true, $ne: [] },
      }).lean();

      const existingIds = new Set(validMCQs.map((q: any) => q._id.toString()));
      for (const bq of broaderMCQs) {
        if (!existingIds.has(bq._id.toString()) && Array.isArray((bq as any).mcqOptions) && (bq as any).mcqOptions.length >= 4) {
          validMCQs.push(bq);
          existingIds.add(bq._id.toString());
        }
      }
    }

    // 2. AI GENERATION FALLBACK: If still < 10 quality questions exist, generate with AI
    if (validMCQs.length < 10) {
      const neededCount = Math.max(10, 10 - validMCQs.length);
      try {
        const aiQuestions = await generateMCQsWithAI({
          career,
          domain,
          topic: topic || `${domain} Core`,
          subtopic: subtopic || 'General',
          count: neededCount,
        });

        for (const aiQ of aiQuestions) {
          try {
            // Check for duplicate in DB
            const existing = await QuestionBank.findOne({ question: aiQ.question });
            if (!existing) {
              const created = await QuestionBank.create({
                field: domain,
                topic: topic || `${domain} Core`,
                subtopic: subtopic || 'General',
                question: aiQ.question,
                answer: aiQ.correctAnswer,
                mcqOptions: aiQ.options,
                difficulty: aiQ.difficulty === 'ADVANCED' ? 'Hard' : aiQ.difficulty === 'INTERMEDIATE' ? 'Medium' : 'Easy',
                interviewType: 'MCQ',
                notes: aiQ.explanation,
                status: 'Active',
                approved: true,
                source: 'AI-Generated',
                tags: [career, domain, topic].filter(Boolean),
              });
              validMCQs.push(created.toObject());
            } else {
              validMCQs.push(existing.toObject());
            }
          } catch (createErr) {
            console.warn('Could not persist generated question to QuestionBank:', createErr);
          }
        }
      } catch (aiErr) {
        console.warn('AI Question generation failed, utilizing robust procedural fallback:', aiErr);
      }
    }

    // 3. Assemble the test set with Progressive Difficulty (Basic -> Intermediate -> Advanced)
    const questions: IMCQQuestion[] = [];
    const usedQuestions = new Set<string>();

    for (let i = 0; i < totalCount; i++) {
      let diff: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' = 'BASIC';
      if (i >= 3 && i < 7) diff = 'INTERMEDIATE';
      else if (i >= 7) diff = 'ADVANCED';

      // Pick from validMCQs or fallback to high quality generator
      const candidate = validMCQs.find((q: any) => !usedQuestions.has(q._id ? q._id.toString() : q.question));
      
      if (candidate && candidate.mcqOptions && candidate.mcqOptions.length >= 4) {
        const idStr = candidate._id ? candidate._id.toString() : `BANK-Q${i + 1}`;
        usedQuestions.add(idStr);
        questions.push({
          questionId: idStr,
          question: candidate.question,
          options: candidate.mcqOptions,
          correctAnswer: candidate.answer,
          explanation: candidate.notes || `This concept is foundational to ${candidate.topic || topic || domain}.`,
          topic: candidate.topic || topic || `${domain} Core`,
          subtopic: candidate.subtopic || subtopic || 'General',
          difficulty: diff,
        });
      } else {
        const generated = generateDomainMCQ(domain, topic || `${domain} Core`, diff, i + 1, subtopic);
        questions.push(generated);
      }
    }

    const sessionId = `MCQ-${randomUUID()}`;
    activeMCQSessions.set(sessionId, {
      studentId: String(payload.studentId),
      careerDomain: domain,
      career,
      topic,
      subtopic,
      targetRole,
      questions,
      startedAt: new Date(),
    });

    // Strip out correctAnswer and explanation before returning to the frontend
    const clientQuestions = questions.map((q, idx) => ({
      sequence: idx + 1,
      questionId: q.questionId,
      question: q.question,
      options: q.options,
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
    }));

    return {
      sessionId,
      careerDomain: domain,
      career,
      topic,
      subtopic,
      targetRole,
      totalQuestions: questions.length,
      passingScore: 75,
      questions: clientQuestions,
    };
  },

  // Submit student MCQ responses, verify answers server-side, calculate scores and feedback,
  // enforce strict 75% passing threshold, update topic progress and Career Twin remediations
  submitMCQSession: async (payload: {
    sessionId: string;
    studentId: string;
    answers: Array<{ questionId: string; selectedOption: string; timeTakenSeconds?: number }>;
  }) => {
    const session = activeMCQSessions.get(payload.sessionId);
    if (!session) {
      throw new Error('MCQ Session expired or not found. Please start a new assessment.');
    }

    if (String(session.studentId) !== String(payload.studentId)) {
      throw new Error('Unauthorized assessment submission.');
    }

    const userAnswersMap = new Map<string, string>();
    for (const ans of payload.answers) {
      userAnswersMap.set(ans.questionId, (ans.selectedOption || '').trim());
    }

    let correctCount = 0;
    const topicStats: Record<string, { total: number; correct: number }> = {};
    const detailedReview: any[] = [];

    for (const q of session.questions) {
      const selected = userAnswersMap.get(q.questionId) || '';
      const isCorrect = selected.toLowerCase() === q.correctAnswer.toLowerCase() ||
        (selected.length > 0 && q.correctAnswer.toLowerCase().includes(selected.toLowerCase()));

      if (isCorrect) {
        correctCount += 1;
      }

      const qTopic = q.topic || session.topic || 'General Knowledge';
      if (!topicStats[qTopic]) {
        topicStats[qTopic] = { total: 0, correct: 0 };
      }
      topicStats[qTopic].total += 1;
      if (isCorrect) topicStats[qTopic].correct += 1;

      detailedReview.push({
        questionId: q.questionId,
        question: q.question,
        topic: qTopic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        studentAnswer: selected || 'No Answer Submitted',
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation,
      });
    }

    const totalQuestions = session.questions.length || 1;
    const overallScore = Math.round((correctCount / totalQuestions) * 100);

    // 75% Passing Standard Rule (Strictly enforced on backend)
    const passStatus: 'PASS' | 'FAIL' = overallScore >= 75 ? 'PASS' : 'FAIL';

    // Topic breakdown analysis
    const topicBreakdown = Object.entries(topicStats).map(([tName, stat]) => {
      const topicScore = Math.round((stat.correct / stat.total) * 100);
      return {
        topic: tName,
        score: topicScore,
        questionsCount: stat.total,
        correctCount: stat.correct,
      };
    });

    const weakTopics = topicBreakdown.filter(t => t.score < 75).map(t => t.topic);
    const strongTopics = topicBreakdown.filter(t => t.score >= 75).map(t => t.topic);

    // If overall failed, ensure session topic is marked weak
    if (passStatus === 'FAIL' && session.topic && !weakTopics.includes(session.topic)) {
      weakTopics.push(session.topic);
    }

    // Create official Assessment record
    const assessment = await Assessment.create({
      studentId: new mongoose.Types.ObjectId(session.studentId),
      assessmentType: 'MCQ',
      careerDomain: session.careerDomain,
      targetRole: session.targetRole,
      overallScore,
      passStatus,
      passingScore: 75,
      competencies: {
        technicalKnowledge: overallScore,
        communication: 75,
        problemSolving: overallScore >= 75 ? 85 : 60,
        confidence: overallScore >= 75 ? 85 : 60,
        clarity: 80,
      },
      topicBreakdown,
      strengths: strongTopics,
      weakTopics,
      knowledgeGaps: weakTopics,
      recommendedLearning: weakTopics.map(wt => ({
        title: `Remedial Review: ${wt}`,
        reason: `Accuracy below 75% standard threshold in ${wt}`,
        priority: 'HIGH' as const,
        recommendedModule: wt,
      })),
      questionsAnswered: payload.answers.length,
      totalQuestions,
      answers: detailedReview,
      attemptNumber: (await Assessment.countDocuments({ studentId: session.studentId, assessmentType: 'MCQ' })) + 1,
      verified: true,
      certificateEligible: passStatus === 'PASS',
    });

    // 4. Update StudentTopicProgress
    if (session.topic) {
      const targetSubtopic = session.subtopic || 'General';
      const isMastered = passStatus === 'PASS';
      try {
        await StudentTopicProgress.findOneAndUpdate(
          {
            studentId: session.studentId,
            domain: session.careerDomain,
            topic: session.topic,
            subtopic: targetSubtopic,
          },
          {
            $set: {
              career: session.career || 'General',
              domain: session.careerDomain,
              topic: session.topic,
              subtopic: targetSubtopic,
              mcqScore: overallScore,
              status: isMastered ? 'PASSED' : 'NEEDS_REVISION',
              isMastered,
              lastAssessedAt: new Date(),
              ...(isMastered ? { passedAt: new Date() } : {}),
            },
            $max: { highestScore: overallScore },
            $inc: { attempts: 1 },
          },
          { upsert: true, new: true }
        );
      } catch (progErr) {
        console.warn('Failed to update StudentTopicProgress:', progErr);
      }
    }

    // 5. Build Weakness Remediation entries for Career Twin
    const newRemediations: any[] = [];
    if (passStatus === 'FAIL' || weakTopics.length > 0) {
      const topicsToRemediate = weakTopics.length > 0 ? weakTopics : (session.topic ? [session.topic] : ['Core Fundamentals']);
      for (const wt of topicsToRemediate) {
        newRemediations.push({
          concept: wt,
          topic: session.topic || wt,
          domain: session.careerDomain,
          score: topicStats[wt] ? Math.round((topicStats[wt].correct / topicStats[wt].total) * 100) : overallScore,
          diagnostic: `Accuracy was below the 75% passing threshold. Concept requires reinforcement in core fundamentals and practical syntax/architecture.`,
          personalizedNotes: `### Core Concept Review: ${wt}\nMastering ${wt} requires understanding:\n1. Underlying principles and runtime behavior.\n2. Common anti-patterns and performance trade-offs.\n3. Step-by-step problem-solving approach.\nReview the resources below and attempt practice problems before retaking your assessment.`,
          youtubeResources: [
            {
              title: `${wt} In-Depth Tutorial & Crash Course`,
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent(wt + ' tutorial programming in depth')}`,
              channel: 'FreeCodeCamp / Engineering Digest',
            },
            {
              title: `${wt} Common Mistakes & Interview Questions`,
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent(wt + ' interview questions and answers')}`,
              channel: 'Tech Lead / Dev Mastery',
            },
          ],
          externalResources: [
            {
              title: `${wt} Documentation & Architecture Guide`,
              url: `https://developer.mozilla.org/`,
              platform: 'Official Docs / Udemy',
            },
            {
              title: `${wt} Practice Problems on LeetCode / HackerRank`,
              url: `https://leetcode.com/problemset/all/?search=${encodeURIComponent(wt)}`,
              platform: 'LeetCode',
            },
          ],
          examples: `// Practical demonstration for ${wt}\n// Review standard implementations and avoid common traps.\n// Ensure thread-safety, proper memory management, and clean abstractions.`,
          practiceQuestions: [
            {
              question: `Explain the fundamental difference between abstract classes and interfaces in ${wt}.`,
              answer: `Interfaces define a contract of behavior (what), while abstract classes provide a base template and shared state (what and part of how).`,
            },
            {
              question: `What are the typical edge cases or performance bottlenecks encountered in ${wt}?`,
              answer: `Excessive object allocation, unhandled concurrency race conditions, and lack of index utilization or caching.`,
            },
          ],
          reassessmentAvailable: true,
          resolved: false,
          lastAssessedAt: new Date(),
        });
      }
    }

    // 6. Sync with Career Twin Memory
    try {
      const twinDoc = await CareerTwinMemory.findOne({
        $or: [{ userId: session.studentId }, { user: session.studentId }],
      });

      if (twinDoc) {
        twinDoc.overallScore = overallScore;
        twinDoc.technicalScore = overallScore;
        twinDoc.lastEvaluatedAt = new Date();

        // If passed, resolve any previous remediations matching this topic
        if (passStatus === 'PASS' && session.topic) {
          if (Array.isArray(twinDoc.weaknessRemediations)) {
            for (const rem of twinDoc.weaknessRemediations) {
              if (rem.topic === session.topic || rem.concept === session.topic) {
                rem.resolved = true;
                rem.reassessmentAvailable = true;
              }
            }
          }
        }

        // Add new remediations if failed
        if (newRemediations.length > 0) {
          if (!Array.isArray(twinDoc.weaknessRemediations)) {
            twinDoc.weaknessRemediations = [];
          }
          for (const rem of newRemediations) {
            const existingIdx = twinDoc.weaknessRemediations.findIndex(
              (r: any) => r.concept === rem.concept && r.topic === rem.topic
            );
            if (existingIdx >= 0) {
              twinDoc.weaknessRemediations[existingIdx] = rem;
            } else {
              twinDoc.weaknessRemediations.push(rem);
            }
          }
        }

        // Update weak areas and strengths
        const existingWeak = new Set(twinDoc.weakAreas || []);
        const existingStrengths = new Set(twinDoc.strengths || []);
        for (const wt of weakTopics) {
          existingWeak.add(wt);
          existingStrengths.delete(wt);
        }
        for (const st of strongTopics) {
          existingStrengths.add(st);
          if (overallScore >= 75) existingWeak.delete(st);
        }
        twinDoc.weakAreas = Array.from(existingWeak);
        twinDoc.weaknesses = Array.from(existingWeak);
        twinDoc.strengths = Array.from(existingStrengths);

        await twinDoc.save();
      } else {
        await CareerTwinMemory.create({
          userId: session.studentId,
          user: session.studentId,
          domain: session.careerDomain,
          targetRole: session.targetRole,
          overallScore,
          technicalScore: overallScore,
          weakAreas: weakTopics,
          weaknesses: weakTopics,
          strengths: strongTopics,
          weaknessRemediations: newRemediations,
          lastEvaluatedAt: new Date(),
        });
      }
    } catch (ctErr) {
      console.warn('Failed to sync CareerTwinMemory from MCQ:', ctErr);
    }

    // Clean up session from active memory
    activeMCQSessions.delete(payload.sessionId);

    return {
      assessmentId: assessment._id,
      sessionId: payload.sessionId,
      overallScore,
      passStatus,
      passingScore: 75,
      canRetake: passStatus === 'FAIL',
      correctCount,
      totalQuestions,
      topicBreakdown,
      weakTopics,
      strongTopics,
      remediations: newRemediations,
      detailedReview,
    };
  },
};

// AI Question Generator calling Groq with prompt validation
async function generateMCQsWithAI(params: {
  career: string;
  domain: string;
  topic: string;
  subtopic: string;
  count: number;
}): Promise<IMCQQuestion[]> {
  const prompt = `You are a strict technical assessment question generator.
Generate ${params.count} high quality multiple-choice questions (MCQ) for:
Career: ${params.career}
Domain: ${params.domain}
Topic: ${params.topic}
Subtopic: ${params.subtopic || 'General'}

Requirements:
1. Each question must test real technical/conceptual understanding.
2. Must have exactly 4 options.
3. One option must be the exact correct answer.
4. Provide a clear technical explanation of why the correct answer is right.
5. Difficulty must be one of: BASIC, INTERMEDIATE, ADVANCED.

Respond ONLY with a valid JSON array of objects in this exact structure:
[
  {
    "question": "Clear technical question string",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Detailed explanation of the concept and reasoning.",
    "difficulty": "BASIC",
    "topic": "${params.topic}"
  }
]
`;

  const responseText = await groqRequest({ prompt });
  const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array');
  }

  const validQuestions: IMCQQuestion[] = [];
  for (let idx = 0; idx < parsed.length; idx++) {
    const item = parsed[idx];
    if (
      item.question &&
      Array.isArray(item.options) &&
      item.options.length >= 4 &&
      item.correctAnswer &&
      item.options.includes(item.correctAnswer)
    ) {
      let diff: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' = 'BASIC';
      const d = String(item.difficulty || '').toUpperCase();
      if (d === 'ADVANCED' || d === 'HARD') diff = 'ADVANCED';
      else if (d === 'INTERMEDIATE' || d === 'MEDIUM') diff = 'INTERMEDIATE';

      validQuestions.push({
        questionId: `AI-Q${idx + 1}-${Date.now()}`,
        question: item.question.trim(),
        options: item.options.slice(0, 4).map((o: any) => String(o).trim()),
        correctAnswer: String(item.correctAnswer).trim(),
        explanation: item.explanation ? String(item.explanation).trim() : `Foundational concept in ${params.topic}.`,
        topic: item.topic || params.topic,
        subtopic: params.subtopic || 'General',
        difficulty: diff,
      });
    }
  }

  return validQuestions;
}

// Procedural domain MCQ synthesis helper covering common careers & topics
function generateDomainMCQ(
  domain: string,
  topic: string,
  difficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED',
  index: number,
  subtopic?: string
): IMCQQuestion {
  const d = domain.toLowerCase();
  const t = topic.toLowerCase();
  const s = (subtopic || '').toLowerCase();

  // Java & OOP specific questions
  if (t.includes('java') || t.includes('oop') || s.includes('oop') || t.includes('spring')) {
    if (difficulty === 'BASIC') {
      return {
        questionId: `JAVA-Q${index}`,
        question: 'Which OOP principle is primarily demonstrated by making fields private and providing public getters and setters?',
        options: ['Encapsulation', 'Polymorphism', 'Inheritance', 'Abstraction'],
        correctAnswer: 'Encapsulation',
        explanation: 'Encapsulation bundles data and methods that operate on that data within a single unit and restricts direct access to internal state.',
        topic: 'OOP Concepts',
        subtopic: 'Encapsulation',
        difficulty,
      };
    } else if (difficulty === 'INTERMEDIATE') {
      return {
        questionId: `JAVA-Q${index}`,
        question: 'In Java, how does the JVM handle String literals created without the "new" keyword?',
        options: [
          'Stores them in the String Constant Pool in Heap memory',
          'Allocates fresh memory on the Thread Call Stack',
          'Converts them to mutable character arrays automatically',
          'Writes them directly to the JVM Metaspace permanently',
        ],
        correctAnswer: 'Stores them in the String Constant Pool in Heap memory',
        explanation: 'The String Constant Pool optimizes memory by reusing existing immutable string literals rather than allocating new objects.',
        topic: 'Java Core',
        subtopic: 'String Memory Model',
        difficulty,
      };
    } else {
      return {
        questionId: `JAVA-Q${index}`,
        question: 'What is the primary difference between a ConcurrentHashMap and Collections.synchronizedMap in Java multithreading?',
        options: [
          'ConcurrentHashMap uses bucket-level locking / CAS, whereas synchronizedMap locks the entire map',
          'ConcurrentHashMap allows null keys and values, whereas synchronizedMap does not',
          'synchronizedMap performs faster for heavy concurrent write throughput',
          'ConcurrentHashMap is only available for distributed network clusters',
        ],
        correctAnswer: 'ConcurrentHashMap uses bucket-level locking / CAS, whereas synchronizedMap locks the entire map',
        explanation: 'ConcurrentHashMap provides segmented/bucket concurrency using lock-free CAS operations for reads and bucket locks for writes, avoiding whole-table lock contention.',
        topic: 'Java Concurrency',
        subtopic: 'Concurrent Collections',
        difficulty,
      };
    }
  }

  // Mechanical Engineering
  if (d.includes('mech')) {
    if (difficulty === 'BASIC') {
      return {
        questionId: `MECH-Q${index}`,
        question: 'Which law of thermodynamics defines the concept of temperature and thermal equilibrium?',
        options: ['Zeroth Law', 'First Law', 'Second Law', 'Third Law'],
        correctAnswer: 'Zeroth Law',
        explanation: 'The Zeroth Law states that if two thermodynamic systems are each in thermal equilibrium with a third, they are in equilibrium with each other.',
        topic: 'Thermodynamics',
        difficulty,
      };
    } else if (difficulty === 'INTERMEDIATE') {
      return {
        questionId: `MECH-Q${index}`,
        question: 'In Geometric Dimensioning and Tolerancing (GD&T), what symbol represents Position tolerance?',
        options: ['Crosshair circle ⌖', 'Perpendicularity ⟂', 'Concentricity ◎', 'Runout ↗'],
        correctAnswer: 'Crosshair circle ⌖',
        explanation: 'The crosshair circle symbol designates true position tolerance, controlling location relative to datums.',
        topic: 'GD&T & CAD',
        difficulty,
      };
    } else {
      return {
        questionId: `MECH-Q${index}`,
        question: 'In Finite Element Analysis (FEA), what is the primary indicator of mesh convergence during stress analysis?',
        options: [
          'Peak stress stabilizes as element density increases',
          'Calculation time decreases with element count',
          'Mesh distortion angle exceeds 90 degrees',
          'All principal stresses become zero',
        ],
        correctAnswer: 'Peak stress stabilizes as element density increases',
        explanation: 'Mesh convergence is achieved when further mesh refinement produces negligible change in localized stress results.',
        topic: 'FEA & Machine Design',
        difficulty,
      };
    }
  }

  // Civil Engineering
  if (d.includes('civil')) {
    if (difficulty === 'BASIC') {
      return {
        questionId: `CIVIL-Q${index}`,
        question: 'What is the standard curing period for ordinary Portland cement concrete to achieve nominal compressive strength?',
        options: ['28 Days', '7 Days', '14 Days', '45 Days'],
        correctAnswer: '28 Days',
        explanation: 'Standard concrete achieves approximately 99% of its specified characteristic compressive strength after 28 days of water curing.',
        topic: 'Concrete Technology',
        difficulty,
      };
    } else if (difficulty === 'INTERMEDIATE') {
      return {
        questionId: `CIVIL-Q${index}`,
        question: 'In structural analysis, what type of beam has more supports than needed to maintain static equilibrium?',
        options: ['Statically Indeterminate Beam', 'Cantilever Beam', 'Simply Supported Beam', 'Overhanging Beam'],
        correctAnswer: 'Statically Indeterminate Beam',
        explanation: 'Statically indeterminate structures cannot be fully analyzed using standard equilibrium equations alone.',
        topic: 'Structural Analysis',
        difficulty,
      };
    } else {
      return {
        questionId: `CIVIL-Q${index}`,
        question: 'In Building Information Modeling (BIM), what dimension represents 4D project integration?',
        options: ['Time and scheduling', 'Cost estimation (5D)', 'Facility management (7D)', 'Sustainability (6D)'],
        correctAnswer: 'Time and scheduling',
        explanation: '4D BIM links 3D geometric model components directly with construction scheduling timelines.',
        topic: 'BIM & Construction Management',
        difficulty,
      };
    }
  }

  // Finance / Commerce
  if (d.includes('comm') || d.includes('finan')) {
    if (difficulty === 'BASIC') {
      return {
        questionId: `FIN-Q${index}`,
        question: 'Under standard double-entry bookkeeping, what is the fundamental balance sheet equation?',
        options: ['Assets = Liabilities + Equity', 'Assets = Revenues - Expenses', 'Liabilities = Assets + Capital', 'Equity = Cash + Debt'],
        correctAnswer: 'Assets = Liabilities + Equity',
        explanation: 'The accounting equation states that a company\'s total assets equal the sum of its external liabilities and shareholders\' equity.',
        topic: 'Accounting Principles',
        difficulty,
      };
    } else if (difficulty === 'INTERMEDIATE') {
      return {
        questionId: `FIN-Q${index}`,
        question: 'Which financial metric measures operating profitability before financing costs, tax expenses, and non-cash depreciation?',
        options: ['EBITDA', 'Gross Margin', 'Net Profit Margin', 'Return on Equity (ROE)'],
        correctAnswer: 'EBITDA',
        explanation: 'EBITDA isolates operational cash earnings before capital structure decisions and non-cash accounting charges.',
        topic: 'Financial Analysis',
        difficulty,
      };
    } else {
      return {
        questionId: `FIN-Q${index}`,
        question: 'In a Discounted Cash Flow (DCF) model, what rate is typically used to discount future Unlevered Free Cash Flows?',
        options: ['Weighted Average Cost of Capital (WACC)', 'Cost of Debt', 'Risk-Free Rate', 'Inflation Index Rate'],
        correctAnswer: 'Weighted Average Cost of Capital (WACC)',
        explanation: 'Unlevered free cash flow belongs to all capital providers, so it is discounted by the blended WACC rate.',
        topic: 'Valuation & DCF',
        difficulty,
      };
    }
  }

  // Default: Computer Science & IT
  if (difficulty === 'BASIC') {
    return {
      questionId: `CS-Q${index}`,
      question: 'What is the worst-case time complexity of searching for an element in a balanced Binary Search Tree (BST)?',
      options: ['O(log n)', 'O(1)', 'O(n)', 'O(n log n)'],
      correctAnswer: 'O(log n)',
      explanation: 'In a balanced BST, tree height is log(n), halving search space at each level.',
      topic: 'Data Structures',
      difficulty,
    };
  } else if (difficulty === 'INTERMEDIATE') {
    return {
      questionId: `CS-Q${index}`,
      question: 'In relational database theory, which normal form (NF) eliminates transitive functional dependencies?',
      options: ['Third Normal Form (3NF)', 'First Normal Form (1NF)', 'Second Normal Form (2NF)', 'BCNF'],
      correctAnswer: 'Third Normal Form (3NF)',
      explanation: '3NF requires that the table is in 2NF and non-prime attributes are non-transitively dependent on primary keys.',
      topic: 'DBMS & Normalization',
      difficulty,
    };
  } else {
    return {
      questionId: `CS-Q${index}`,
      question: 'According to the CAP theorem for distributed data stores, what property must be sacrificed during a network partition (P)?',
      options: [
        'Consistency (C) or Availability (A)',
        'Durability or Atomicity',
        'Performance or Latency',
        'Security or Redundancy',
      ],
      correctAnswer: 'Consistency (C) or Availability (A)',
      explanation: 'When network partition occurs in a distributed system, you can either return stale data (Availability) or reject requests (Consistency).',
      topic: 'Distributed Systems & System Design',
      difficulty,
    };
  }
}
