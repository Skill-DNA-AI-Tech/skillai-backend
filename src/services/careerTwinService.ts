import { env } from '../config/env';
import CareerTwinMemory from '../models/careerTwinMemory';
import Profile from '../models/profile';
import { QuestionBank, StudentAnswer } from '../models/questionBank';

export interface CareerTwinTransientContext {
  question?: string;
  answer?: string;
  difficulty?: string;
  responseTime?: number;
}

interface CareerTwinPayload {
  profile: Record<string, unknown>;
  answers: Array<Record<string, unknown>>;
  memory: Record<string, unknown> | null;
  transient?: CareerTwinTransientContext;
}

const toPlainObject = (value: any): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  if (typeof value.toObject === 'function') {
    return value.toObject({ virtuals: true });
  }

  return value;
};

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function average(values: number[], fallback = 0): number {
  const clean = values.filter((val) => typeof val === "number" && !isNaN(val));
  return clean.length ? clean.reduce((sum, val) => sum + val, 0) / clean.length : fallback;
}

function uniqueItems(items: any[], limit = 8): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (!item) continue;
    const text = String(item).trim();
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      result.push(text);
    }
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}

function timedResponseScore(seconds: number): number {
  if (seconds <= 0) return 60;
  if (seconds <= 75) return 95;
  if (seconds <= 120) return 85;
  if (seconds <= 180) return 70;
  return 55;
}

function buildCareerTwinFallback(payload: CareerTwinPayload) {
  const profile = payload.profile || {};
  const answers = payload.answers || [];
  const memory = payload.memory || {};
  const transient = payload.transient || {};
  const skill_dna = (profile as any).skillDNA || {};

  const technical_scores = answers.map((a: any) => a.technicalQualityScore || 0);
  const communication_scores = answers.map((a: any) => a.communicationScore || 0);
  const confidence_scores = answers.map((a: any) => a.confidenceScore || 0);
  const response_times = answers.map((a: any) => a.timeTaken || 0);

  const technical = Math.round(average(technical_scores, skill_dna.technicalScore || 0));
  const communication = Math.round(average(communication_scores, skill_dna.communicationScore || 0));
  const confidence = Math.round(average(confidence_scores, skill_dna.confidenceScore || 0));
  const avg_response_time = Math.round(average(response_times, (memory as any).responseTime || 0));
  const speed = timedResponseScore(avg_response_time);
  const overall = Math.round(clamp(technical * 0.4 + communication * 0.2 + confidence * 0.2 + speed * 0.2));

  const feedback_strengths: string[] = [];
  const feedback_weaknesses: string[] = [];
  const missing_concepts: string[] = [];
  
  for (const answer of answers as any[]) {
    const feedback = answer.feedback || {};
    feedback_strengths.push(...(feedback.strengths || []));
    feedback_weaknesses.push(...(feedback.weaknesses || []));
    missing_concepts.push(...(feedback.missingConcepts || []));
  }

  let strengths = uniqueItems([
    ...feedback_strengths,
    ...(skill_dna.strengths || []),
    ...((profile as any).skills || []),
    ...((memory as any).strengths || []),
  ]);
  
  let weaknesses = uniqueItems([
    ...feedback_weaknesses,
    ...missing_concepts,
    ...(skill_dna.weaknesses || []),
    ...((memory as any).weaknesses || []),
  ]);

  if (!strengths.length) {
    strengths = uniqueItems([
      ...((profile as any).skills || []),
      ...((profile as any).interests || []),
      "Consistent learning",
    ]);
  }
  if (!weaknesses.length) {
    weaknesses = uniqueItems(["Interview depth", "Answer structure", "Role-specific examples"]);
  }

  let roles = uniqueItems([
    ...((profile as any).preferredRoles || []),
    ...(skill_dna.careerPathSuggestions || []),
    (profile as any).domain,
    (profile as any).branch,
  ]);
  if (!roles.length) {
    roles = ["Career-ready role"];
  }

  const job_matches = roles.slice(0, 4).map((role, index) => {
    const role_score = Math.round(clamp(overall - index * 4 + strengths.length * 2 - weaknesses.length));
    return {
      role,
      readiness: role_score,
      missing: weaknesses.slice(0, 3),
      matchedStrengths: strengths.slice(0, 3),
    };
  });

  const sessions: Record<string, { sessionId: string; scores: number[]; responseTimes: number[]; completedAt: string }> = {};
  answers.forEach((answer: any, index) => {
    const sessionId = String(answer.sessionId || `session-${index + 1}`);
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        sessionId,
        scores: [],
        responseTimes: [],
        completedAt: answer.createdAt,
      };
    }
    sessions[sessionId].scores.push(answer.overallScore || 0);
    sessions[sessionId].responseTimes.push(answer.timeTaken || 0);
    sessions[sessionId].completedAt = answer.createdAt || sessions[sessionId].completedAt;
  });

  const timeline = Object.values(sessions).map((session, idx) => ({
    label: `Interview ${idx + 1}`,
    sessionId: session.sessionId,
    score: Math.round(average(session.scores, 0)),
    averageResponseTime: Math.round(average(session.responseTimes, 0)),
    completedAt: session.completedAt,
  }));

  const improvement = timeline.length > 1 ? timeline[timeline.length - 1].score - timeline[0].score : 0;

  const top_gap = weaknesses[0] || "role fundamentals";
  const top_strength = strengths[0] || "learning consistency";
  const recent_answer = transient.answer || (answers.length ? (answers[answers.length - 1] as any).answer : "");
  const current_question = transient.question || (answers.length ? (answers[answers.length - 1] as any).question : "");
  const difficulty = transient.difficulty || (overall >= 80 ? "Hard" : overall >= 60 ? "Medium" : "Easy");
  const next_difficulty = overall >= 80 ? "Hard" : overall >= 55 ? "Medium" : "Easy";

  const daily_tasks = [
    { type: "technical", title: `Practice one focused question on ${top_gap}`, minutes: 25 },
    { type: "interview", title: `Record two answers using ${top_strength} as proof`, minutes: 20 },
    { type: "communication", title: "Summarize one answer with situation, action, and result", minutes: 15 },
  ];

  const mentor_suggestions = [
    `Use a concrete project example when explaining ${top_strength}.`,
    `Close the current gap in ${top_gap} with one proof-of-work task.`,
    "Keep answers concise, then add depth only when the interviewer asks a follow-up.",
  ];
  if (avg_response_time > 150) {
    mentor_suggestions.push("Reduce response time by rehearsing a 30-second opening structure.");
  }

  const dynamic_interview = {
    currentDifficulty: difficulty,
    nextDifficulty: next_difficulty,
    followUpQuestion: `Can you connect ${top_gap} to the answer you just gave?`,
    personalizedQuestion: `Explain ${top_gap} for a ${roles[0]} interview using one real example.`,
    reason: `Generated from recent answer quality, response time, and repeated weakness: ${top_gap}.`,
    latestQuestion: current_question,
    latestAnswerPreview: String(recent_answer).slice(0, 180),
  };

  return {
    overallScore: overall,
    strengths,
    weaknesses,
    confidence,
    communicationQuality: communication,
    responseTime: avg_response_time,
    technicalScore: technical,
    interviewHistory: timeline,
    jobReadiness: job_matches,
    dailyTasks: daily_tasks,
    improvementTimeline: {
      items: timeline,
      improvement,
    },
    mentorSuggestions: mentor_suggestions,
    skillGaps: weaknesses,
    recommendations: [
      ...daily_tasks,
      ...mentor_suggestions.slice(0, 2).map((item) => ({ type: "mentor", title: item, minutes: 10 })),
    ],
    dynamicInterview: dynamic_interview,
  };
}

const callCareerTwinAi = async (payload: CareerTwinPayload): Promise<any> => {
  if (!env.aiServiceUrl) {
    console.warn('AI_SERVICE_URL is not configured. Falling back to local career twin calculation.');
    return buildCareerTwinFallback(payload);
  }

  try {
    const response = await fetch(`${env.aiServiceUrl}/career-twin/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`Career Twin AI responded with status ${response.status}: ${body}. Falling back to local calculation.`);
      return buildCareerTwinFallback(payload);
    }

    return await response.json();
  } catch (err: any) {
    console.error(`Failed to connect to Career Twin AI at ${env.aiServiceUrl}: ${err.message}. Falling back to local calculation.`);
    return buildCareerTwinFallback(payload);
  }
};

const collectCareerTwinPayload = async (
  userId: string,
  transient?: CareerTwinTransientContext,
): Promise<CareerTwinPayload> => {
  const [profile, memory, answers] = await Promise.all([
    Profile.findOne({ user: userId }).lean(),
    CareerTwinMemory.findOne({ userId }).lean(),
    StudentAnswer.find({ studentId: userId })
      .sort({ createdAt: 1 })
      .limit(80)
      .populate('questionId', 'question field topic difficulty tags')
      .lean(),
  ]);

  const normalizedAnswers = answers.map((answer: any) => {
    const question = answer.questionId ? toPlainObject(answer.questionId) : {};
    return {
      _id: answer._id?.toString(),
      sessionId: answer.sessionId,
      answer: answer.answer,
      answerType: answer.answerType,
      correctness: answer.correctness,
      confidenceScore: answer.confidenceScore,
      communicationScore: answer.communicationScore,
      technicalQualityScore: answer.technicalQualityScore,
      completenessScore: answer.completenessScore,
      grammarScore: answer.grammarScore,
      clarityScore: answer.clarityScore,
      overallScore: answer.overallScore,
      feedback: answer.feedback,
      timeTaken: answer.timeTaken,
      createdAt: answer.createdAt,
      question: question.question,
      field: question.field,
      topic: question.topic,
      difficulty: question.difficulty,
      tags: question.tags,
    };
  });

  return {
    profile: (profile ?? {}) as Record<string, unknown>,
    answers: normalizedAnswers,
    memory: memory ? (memory as Record<string, unknown>) : null,
    transient,
  };
};

const persistCareerTwinMemory = async (userId: string, analysis: any) => {
  const update = {
    overallScore: analysis.overallScore ?? 0,
    technicalScore: analysis.technicalScore ?? 0,
    strengths: analysis.strengths ?? [],
    weaknesses: analysis.weaknesses ?? [],
    confidence: analysis.confidence ?? 0,
    communicationQuality: analysis.communicationQuality ?? 0,
    responseTime: analysis.responseTime ?? 0,
    interviewHistory: analysis.interviewHistory ?? [],
    jobReadiness: analysis.jobReadiness ?? [],
    dailyTasks: analysis.dailyTasks ?? [],
    improvementTimeline: analysis.improvementTimeline ?? { items: [], improvement: 0 },
    mentorSuggestions: analysis.mentorSuggestions ?? [],
    skillGaps: analysis.skillGaps ?? [],
    recommendations: analysis.recommendations ?? [],
    dynamicInterview: analysis.dynamicInterview ?? {},
    generatedAt: new Date(),
  };

  return CareerTwinMemory.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

export const careerTwinService = {
  getMemory: async (userId: string) => CareerTwinMemory.findOne({ userId }),

  refreshMemory: async (userId: string, transient?: CareerTwinTransientContext) => {
    const payload = await collectCareerTwinPayload(userId, transient);
    const analysis = await callCareerTwinAi(payload);
    return persistCareerTwinMemory(userId, analysis);
  },

  nextInterviewPrompt: async (userId: string, transient: CareerTwinTransientContext) => {
    const payload = await collectCareerTwinPayload(userId, transient);
    const analysis = await callCareerTwinAi(payload);
    await persistCareerTwinMemory(userId, analysis);
    return analysis.dynamicInterview;
  },

  suggestQuestionsFromMemory: async (userId: string) => {
    const memory = await CareerTwinMemory.findOne({ userId }).lean() as any | null;
    const gaps: string[] = memory?.skillGaps ?? memory?.weaknesses ?? [];

    if (!gaps.length) {
      return [];
    }

    return QuestionBank.find({
      status: 'Active',
      $or: [
        { topic: { $in: gaps } },
        { tags: { $in: gaps } },
        { keywords: { $in: gaps } },
      ],
    })
      .limit(10)
      .select('question topic field difficulty interviewType');
  },
};
