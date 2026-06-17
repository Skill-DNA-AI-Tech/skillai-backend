import { env } from '../config/env';
import { calculateJobMatch, calculateSkillDNA } from './scoring';
import { groqRequest } from './groqClient';

const callAi = async <T>(path: string, payload: unknown, fallback: () => T): Promise<T> => {
  if (!env.aiServiceUrl) {
    return fallback();
  }

  try {
    const response = await fetch(`${env.aiServiceUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`AI service responded with ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error: any) {
    console.warn(`[ai:fallback] ${path} - AI service offline or unreachable (${error?.message || error}). Using local fallback.`);
    return fallback();
  }
};

export const aiClient = {
  skillDNA: (payload: any): Promise<any> => callAi<any>('/skilldna', payload, () => calculateSkillDNA(payload)),
  learningPlan: (payload: any) =>
    callAi<any>('/learning/recommend', payload, () => ({
      nextLesson: 'Master the weakest topic with a 20-minute revision sprint',
      weakTopicRevision: payload.weakTopics ?? ['Communication', 'Aptitude'],
      dailyPractice: ['1 quiz', '1 flashcard round', '1 short explanation recording'],
      roadmap: ['Revise fundamentals', 'Practice applied questions', 'Attempt mock assessment', 'Update report card'],
      difficulty: payload.recentScore > 80 ? 'advanced' : payload.recentScore > 55 ? 'intermediate' : 'foundation',
    })),
  interview: (payload: any) => {
    const baseScore = 48 + (payload.confidenceLevel ?? 5) * 5;
    const eyeContactScore = Math.min(100, 45 + (payload.eyeContactLevel ?? 5) * 6);
    const speakingClarityScore = Math.min(100, 40 + (payload.wordsPerMinute ?? 110) / 2);
    const grammarScore = Math.min(100, 55 + (payload.confidenceLevel ?? 5) * 4);
    const hesitationScore = Math.min(100, 50 + (payload.confidenceLevel ?? 5) * 5);
    const bodyLanguageScore = Math.min(100, 45 + (payload.eyeContactLevel ?? 5) * 6);
    
    return callAi<any>('/interview', payload, () => ({
      interviewScore: Math.min(100, baseScore),
      communicationScore: speakingClarityScore,
      confidenceScore: Math.min(100, 38 + (payload.confidenceLevel ?? 5) * 6),
      technicalDepthScore: Math.min(100, 50 + (payload.domainKeywords?.length ?? 2) * 8),
      eyeContactScore,
      speakingClarityScore,
      grammarScore,
      hesitationScore,
      bodyLanguageScore,
      tips: ['Maintain eye contact', 'Reduce filler words', 'Use STAR structure', 'End answers with measurable impact'],
    }));
  },
  resume: (payload: any) =>
    callAi<any>('/resume/analyze', payload, () => ({
      atsScore: Math.min(100, 45 + (payload.keywords?.length ?? 4) * 6),
      formattingScore: 82,
      keywordRelevance: payload.keywords ?? [],
      projectQualityScore: 76,
      certificationQualityScore: 72,
      recruiterAttractivenessScore: 78,
      suggestions: ['Add role-specific keywords', 'Quantify project outcomes', 'Move strongest skills above fold'],
    })),
  jobMatch: (payload: any) =>
    callAi<any>('/jobs/match', payload, () => calculateJobMatch(payload.profileSkills, payload.jobSkills)),
  deepAnalysis: (payload: any) =>
    callAi<any>('/deep-analysis', payload, () => ({
      metrics: [
        { label: "SkillDNA Score", value: 70, suffix: "%", tone: "bg-violet-500" },
        { label: "Interview Readiness", value: 65, suffix: "%", tone: "bg-sky-500" },
        { label: "Communication", value: 75, "suffix": "%", tone: "bg-emerald-500" },
        { label: "Placement Ready", value: 68, suffix: "%", tone: "bg-amber-500" }
      ],
      weakAreas: [
        { topic: "Advanced Frameworks", score: 55, action: "Complete guided project" },
        { topic: "System Design", score: 40, action: "Read architectural patterns" }
      ],
      recommendedLessons: [
        { domain: payload.domain || "General", topic: "Introduction to " + (payload.preferredRole || "Role"), type: "Video", minutes: 20, level: "Foundation" }
      ]
    })),
  groq: (payload: any) => groqRequest(payload),
};
