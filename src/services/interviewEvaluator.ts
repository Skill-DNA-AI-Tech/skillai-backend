export interface QAPair {
  question: string;
  answer: string;
}

export interface InterviewEvaluationInput {
  transcript?: string;
  qaPairs?: QAPair[];
  durationSeconds?: number;
  confidenceLevel?: number;
  eyeContactLevel?: number;
  wordsPerMinute?: number;
  domainKeywords?: string[];
}

export interface InterviewEvaluationResult {
  interviewScore: number;
  communicationScore: number;
  confidenceScore: number;
  technicalDepthScore: number;
  bodyLanguageScore: number;
  eyeContactScore: number;
  speakingClarityScore: number;
  grammarScore: number;
  hesitationScore: number;
  voiceConfidenceScore: number;
  tips: string[];
}

export function parseTranscriptToPairs(transcript: string, qaPairs?: QAPair[]): QAPair[] {
  if (qaPairs && qaPairs.length > 0) {
    return qaPairs.filter(p => p.question && typeof p.answer === 'string');
  }

  const pairs: QAPair[] = [];
  const lines = (transcript || '').split('\n').map(l => l.trim()).filter(Boolean);
  let q = '';
  let a = '';

  for (const l of lines) {
    if (/^(Interviewer|AI Recruiter|AI|Recruiter):/i.test(l)) {
      if (q) {
        pairs.push({ question: q, answer: a });
        a = '';
      }
      q = l.replace(/^(Interviewer|AI Recruiter|AI|Recruiter):\s*/i, '');
    } else if (/^(Candidate|You|Student|User):/i.test(l)) {
      a = (a ? a + ' ' : '') + l.replace(/^(Candidate|You|Student|User):\s*/i, '');
    }
  }
  if (q) {
    pairs.push({ question: q, answer: a });
  }

  return pairs;
}

export function evaluateInterviewTranscript(payload: InterviewEvaluationInput): InterviewEvaluationResult {
  const pairs = parseTranscriptToPairs(payload.transcript || '', payload.qaPairs);

  if (!pairs.length) {
    return {
      interviewScore: 0,
      communicationScore: 0,
      confidenceScore: 0,
      technicalDepthScore: 0,
      bodyLanguageScore: 0,
      eyeContactScore: 0,
      speakingClarityScore: 0,
      grammarScore: 0,
      hesitationScore: 0,
      voiceConfidenceScore: 0,
      tips: ['No interview responses detected. Please speak clearly into your microphone.'],
    };
  }

  const prepositions = new Set([
    'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as', 
    'into', 'like', 'through', 'after', 'over', 'between', 'out', 
    'against', 'during', 'without', 'before', 'under', 'around', 'among'
  ]);

  const evaluated = pairs.map(({ question, answer }) => {
    const clean = (answer || '').trim();
    const tokens = clean.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const wordCount = tokens.length;

    // 1. Explicit blank or non-answer
    if (wordCount === 0 || /^(i\s+dont\s+know|dont\s+know|no\s+idea|skip|pass|idk|nothing)$/i.test(clean)) {
      return { relevance: 0, depth: 0, grammar: 0, wordCount: 0, isGibberish: false, isBlank: true, isTooShort: true };
    }

    const isTooShort = wordCount < 4;
    const uniqueTokens = new Set(tokens);
    const lexicalDiversity = uniqueTokens.size / wordCount;

    // 2. Repetition check
    let repCount = 0;
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i] === tokens[i + 1]) repCount++;
    }

    // 3. Preposition clusters / word salad detection (e.g., "of everywhere of on the")
    const prepCount = tokens.filter(t => prepositions.has(t)).length;
    const prepRatio = prepCount / wordCount;
    const hasPrepositionCluster = /\b(of|on|in|to|at|for|with)\s+(of|on|in|to|at|for|with)\b/i.test(clean);

    const isWordSalad = (wordCount >= 6 && hasPrepositionCluster) ||
                        (wordCount >= 6 && prepRatio > 0.42 && lexicalDiversity < 0.8) ||
                        (wordCount >= 6 && repCount >= 2) ||
                        /(busy\s+dna|everywhere\s+of|empire\s+of\s+everywhere)/i.test(clean);

    // 4. Target vocabulary matching according to question type
    const lq = question.toLowerCase();
    let targetKeywords: string[] = [];
    if (/introduce|background|about yourself/i.test(lq)) {
      targetKeywords = [
        'name', 'graduate', 'student', 'degree', 'engineering', 'college', 
        'university', 'computer', 'experience', 'project', 'developer', 
        'skills', 'learning', 'passion', 'background', 'internship', 'study', 
        'work', 'technology', 'science', 'development'
      ];
    } else if (/strength|weakness/i.test(lq)) {
      targetKeywords = [
        'strength', 'weakness', 'problem', 'solving', 'team', 'communicate', 
        'adapt', 'quick', 'learner', 'analytical', 'detail', 'time', 
        'management', 'pressure', 'improve', 'leadership', 'skills', 'patience'
      ];
    } else if (/five years|5 years|career|future|heading/i.test(lq)) {
      targetKeywords = [
        'year', 'years', 'future', 'lead', 'senior', 'architect', 'manager', 
        'role', 'grow', 'growth', 'contribute', 'learn', 'expertise', 'team', 
        'organization', 'impact', 'skills', 'responsibility', 'industry', 'achieve'
      ];
    } else {
      targetKeywords = lq.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
    }

    const matches = tokens.filter(t => targetKeywords.includes(t));
    const matchRatio = matches.length / Math.max(1, Math.min(targetKeywords.length, 4));

    let relevance = 0;
    let depth = 0;

    if (isTooShort) {
      relevance = matches.length > 0 ? 15 : 5;
      depth = 5;
    } else if (isWordSalad) {
      relevance = 8;
      depth = 8;
    } else if (matches.length === 0) {
      // Off-topic or very poor response
      relevance = Math.min(22, Math.round(wordCount * 0.9));
      depth = Math.min(18, Math.round(wordCount * 0.7));
    } else {
      relevance = Math.min(95, Math.round(matchRatio * 65 + Math.min(wordCount, 60) * 0.5));
      depth = Math.min(95, Math.round(matchRatio * 55 + Math.min(uniqueTokens.size * 2, 40)));
    }

    // 5. Grammar & syntax evaluation
    let grammar = 50;
    if (isTooShort) {
      grammar = 20;
    } else if (isWordSalad) {
      grammar = 22;
    } else {
      const startsCap = /^[A-Z]/.test(clean);
      const endsPunct = /[.!?]$/.test(clean);
      grammar = Math.round((startsCap ? 15 : 5) + (endsPunct ? 15 : 5) + (lexicalDiversity * 35) + Math.min(30, wordCount));
      grammar = Math.max(20, Math.min(95, grammar));
    }

    return { relevance, depth, grammar, wordCount, isGibberish: isWordSalad, isTooShort, isBlank: false };
  });

  const avgRelevance = evaluated.reduce((s, e) => s + e.relevance, 0) / evaluated.length;
  const avgDepth = evaluated.reduce((s, e) => s + e.depth, 0) / evaluated.length;
  const avgGrammar = evaluated.reduce((s, e) => s + e.grammar, 0) / evaluated.length;
  const avgWordCount = evaluated.reduce((s, e) => s + e.wordCount, 0) / evaluated.length;
  const hasSevereFaults = evaluated.some(e => e.isGibberish || e.isTooShort || e.isBlank || e.relevance <= 15);

  let interviewScore = Math.round(avgRelevance * 0.45 + avgDepth * 0.25 + avgGrammar * 0.15 + Math.min(avgWordCount, 40) * 0.35);
  let technicalDepthScore = Math.round(avgDepth);
  let grammarScore = Math.round(avgGrammar);
  let speakingClarityScore = Math.round(Math.min(95, Math.max(15, avgWordCount > 15 ? 40 + avgGrammar * 0.5 : 15 + avgWordCount * 1.5)));
  let hesitationScore = Math.round(Math.min(90, Math.max(15, avgWordCount > 25 ? 75 : 20 + avgWordCount * 1.8)));
  let communicationScore = Math.round(Math.min(95, Math.max(15, avgRelevance * 0.45 + avgGrammar * 0.35 + (avgWordCount > 20 ? 20 : avgWordCount))));
  let confidenceScore = Math.round(Math.min(90, Math.max(20, avgRelevance * 0.4 + (hasSevereFaults ? 15 : 45))));
  let bodyLanguageScore = Math.round(Math.min(90, Math.max(25, hasSevereFaults ? 35 : 75)));
  let eyeContactScore = Math.round(Math.min(90, Math.max(25, hasSevereFaults ? 35 : 75)));
  let voiceConfidenceScore = Math.round(Math.min(90, Math.max(20, confidenceScore * 0.95)));

  // Strict enforcement: if answers are gibberish, too short, or irrelevant, hard cap scores!
  if (hasSevereFaults || avgWordCount < 12 || avgRelevance < 25) {
    interviewScore = Math.min(22, Math.max(8, interviewScore));
    technicalDepthScore = Math.min(20, Math.max(5, technicalDepthScore));
    communicationScore = Math.min(28, Math.max(12, communicationScore));
    speakingClarityScore = Math.min(30, Math.max(15, speakingClarityScore));
    grammarScore = Math.min(35, Math.max(15, grammarScore));
    hesitationScore = Math.min(35, Math.max(15, hesitationScore));
    confidenceScore = Math.min(30, Math.max(15, confidenceScore));
    bodyLanguageScore = Math.min(40, Math.max(20, bodyLanguageScore));
    eyeContactScore = Math.min(40, Math.max(20, eyeContactScore));
  }

  const tips: string[] = [];
  if (avgWordCount < 20) {
    tips.push(`Your answers were extremely brief (averaging only ${Math.round(avgWordCount)} words). Aim for 45-90 seconds per response (60-120 words) to properly showcase your background.`);
  }
  if (avgRelevance < 40) {
    tips.push('Directly answer the question asked. For self-introductions, summarize your education, core technical stack, and recent accomplishments.');
  }
  if (hasSevereFaults) {
    tips.push('Avoid fragmented, incoherent, or off-topic phrases. Structure your thoughts clearly before speaking.');
  }
  tips.push('Use the STAR method (Situation, Task, Action, Result) to provide structured, credible answers with measurable impact.');

  return {
    interviewScore,
    communicationScore,
    confidenceScore,
    technicalDepthScore,
    bodyLanguageScore,
    eyeContactScore,
    speakingClarityScore,
    grammarScore,
    hesitationScore,
    voiceConfidenceScore,
    tips: tips.slice(0, 4),
  };
}
