import { groqRequest } from './groqClient';
import { normalizeTechnicalTranscript } from '../utils/technicalDictionary';

export const questionAnalysisService = {
  // Analyze uploaded question + answer pair
  analyzeQuestion: async (payload: {
    question: string;
    answer: string;
    topic?: string;
    field?: string;
  }): Promise<any> => {
    const prompt = `You are an expert question quality analyst. Analyze the following interview question and answer.

Question: ${payload.question}
Answer: ${payload.answer}
${payload.topic ? `Topic: ${payload.topic}` : ''}
${payload.field ? `Field: ${payload.field}` : ''}

Provide analysis in JSON format with:
{
  "difficulty": "Easy/Medium/Hard/Expert",
  "concepts": ["list", "of", "key", "concepts"],
  "keywords": ["extracted", "keywords"],
  "scoreWeight": number 1-10,
  "estimatedAnswerTime": "X minutes",
  "answerQuality": number 0-100,
  "technicalDepth": number 0-100,
  "answerCompleteness": number 0-100,
  "isOriginal": boolean,
  "suggestedFollowUps": ["followup1", "followup2"],
  "commonMistakes": ["mistake1", "mistake2"]
}`;

    try {
      const response = await groqRequest({ prompt });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      console.error('Question analysis failed:', error);
      return {
        difficulty: "Medium",
        concepts: ["fundamental logic", payload.topic || "programming"],
        keywords: ["logic", "code"],
        scoreWeight: 5,
        estimatedAnswerTime: "2 minutes",
        answerQuality: 80,
        technicalDepth: 75,
        answerCompleteness: 80,
        isOriginal: true,
        suggestedFollowUps: ["Can you optimize this?", "What is the time complexity?"],
        commonMistakes: ["Off-by-one errors", "Not handling null inputs"]
      };
    }
  },

  // Generate new interview questions
  generateQuestions: async (payload: {
    field: string;
    topic: string;
    subtopic?: string;
    difficulty: string;
    count: number;
    interviewTypes?: string[];
  }): Promise<any[]> => {
    const interviewTypes = payload.interviewTypes?.join(', ') || 'Technical';
    
    const prompt = `You are an expert interview question creator. Generate ${payload.count} unique, high-quality interview questions.

Requirements:
- Field: ${payload.field}
- Topic: ${payload.topic}
${payload.subtopic ? `- Subtopic: ${payload.subtopic}` : ''}
- Difficulty Level: ${payload.difficulty}
- Interview Types: ${interviewTypes}

For each question provide (as JSON array):
[
  {
    "question": "the interview question",
    "modelAnswer": "detailed model answer",
    "difficulty": "${payload.difficulty}",
    "keywords": ["key", "words"],
    "concepts": ["concepts", "covered"],
    "followUpQuestions": ["followup1", "followup2"],
    "scenarioVariations": ["scenario1", "scenario2"],
    "estimatedTime": "X minutes",
    "interviewType": "Technical/HR/Behavioral/etc"
  },
  ...
]

Make sure questions are:
- Unique and not commonly asked
- Practical and relevant
- Follow industry standards
- Include real-world scenarios`;

    try {
      const response = await groqRequest({ prompt });
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error('Question generation failed:', error);
      const generated = [];
      for (let i = 1; i <= (payload.count || 5); i++) {
        generated.push({
          question: `Explain critical concept #${i} inside ${payload.field} / ${payload.topic || 'general'} development.`,
          modelAnswer: `Model answer for ${payload.topic} concept #${i}: This covers essential practices, edge case management, optimization, and scalable logic design.`,
          difficulty: payload.difficulty || "Medium",
          keywords: ["scaling", "optimization", "clean code", "logic"],
          concepts: [payload.topic || "software development", "best practices"],
          followUpQuestions: [`How do you optimize concept #${i}?`, `Describe a scenario where concept #${i} fails.`],
          scenarioQuestions: [`Explain concept #${i} using a real-world project example.`],
          caseStudyQuestions: [],
          mcqOptions: [],
          estimatedTime: "3 minutes",
          interviewType: "Technical"
        });
      }
      return generated;
    }
  },

  // Generate question variations
  generateVariations: async (baseQuestion: string, topic: string): Promise<string[]> => {
    const prompt = `Generate 5 different variations of this interview question. Each variation should ask about the same concept but in a different way.

Base Question: "${baseQuestion}"
Topic: ${topic}

Requirements:
- Keep the same technical difficulty
- Cover the same core concept
- Change the wording/framing
- Include different perspectives

Return as JSON array of strings:
["variation1", "variation2", ...]`;

    try {
      const response = await groqRequest({ prompt });
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error('Variation generation failed:', error);
      return [
        `Can you elaborate on: ${baseQuestion}?`,
        `How would you explain the core concepts of: "${baseQuestion}" to a beginner?`,
        `Describe a real-world scenario where: "${baseQuestion}" is highly relevant.`,
        `What are the most common performance considerations related to: "${baseQuestion}"?`,
        `Under what conditions does the logic in: "${baseQuestion}" break?`
      ];
    }
  },

  // Detect duplicate questions
  checkDuplicates: async (questions: string[], existingQuestions: any[]): Promise<any> => {
    if (existingQuestions.length === 0) return [];

    const existingText = existingQuestions.map(q => q.question).join('\n');
    const prompt = `Compare these new questions with existing questions and identify duplicates or very similar ones.

NEW QUESTIONS:
${questions.join('\n')}

EXISTING QUESTIONS:
${existingText}

Return JSON array with similarity analysis:
[
  {
    "newQuestion": "the new question",
    "duplicateOf": "similar existing question or null",
    "similarityScore": number 0-100,
    "isDuplicate": boolean
  }
]`;

    try {
      const response = await groqRequest({ prompt });
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error('Duplicate detection failed:', error);
      return [];
    }
  },

  // Analyze student answer with strict backend-level validation pipeline
  analyzeAnswer: async (payload: {
    question: string;
    modelAnswer: string;
    studentAnswer: string;
    topic: string;
    field?: string;
    transcriptionConfidence?: number;
    audioQuality?: string;
    isSilent?: boolean;
  }): Promise<any> => {
    // 0. Speech & Audio Quality Validation
    if (payload.isSilent) {
      return {
        answerStatus: 'NO_SPEECH',
        relevance: 0,
        technicalKnowledge: 0,
        technicalScore: 0,
        communication: 0,
        communicationScore: 0,
        problemSolving: 0,
        problemSolvingScore: 0,
        confidence: 0,
        confidenceScore: 0,
        clarity: 0,
        clarityScore: 0,
        correctness: 0,
        overallScore: 0,
        conceptCoverage: 0,
        completeness: 0,
        technicalQuality: 0,
        grammar: 0,
        keywordMatches: [],
        conceptsIdentified: [],
        strengths: [],
        weaknesses: ['No speech detected from microphone during this question.'],
        missingConcepts: ['Verbal explanation required.'],
        commonMistakes: ['Microphone muted or silent response.'],
        suggestedImprovement: 'Please unmute your microphone and speak clearly.',
        feedback: 'No voice detected. Please unmute your microphone and try again.',
        betterAnswer: payload.modelAnswer,
        confidenceIndicators: 'Silence (No speech)',
      };
    }

    if (payload.audioQuality === 'LOW_QUALITY' || payload.audioQuality === 'GARBLED') {
      return {
        answerStatus: 'LOW_AUDIO_QUALITY',
        relevance: 0,
        technicalKnowledge: 0,
        technicalScore: 0,
        communication: 0,
        communicationScore: 0,
        problemSolving: 0,
        problemSolvingScore: 0,
        confidence: 0,
        confidenceScore: 0,
        clarity: 0,
        clarityScore: 0,
        correctness: 0,
        overallScore: 0,
        conceptCoverage: 0,
        completeness: 0,
        technicalQuality: 0,
        grammar: 0,
        keywordMatches: [],
        conceptsIdentified: [],
        strengths: [],
        weaknesses: ['Audio quality was too low or muffled to assess accurately.'],
        missingConcepts: ['Clear audio signal required for fair scoring.'],
        commonMistakes: ['Microphone distortion or excessive background noise.'],
        suggestedImprovement: 'Speak closer to the microphone and minimize background interference.',
        feedback: 'Audio was muffled or distorted. Please repeat your answer clearly.',
        betterAnswer: payload.modelAnswer,
        confidenceIndicators: 'Audio unclear',
      };
    }

    if (payload.transcriptionConfidence !== undefined && payload.transcriptionConfidence < 0.45) {
      return {
        answerStatus: 'LOW_TRANSCRIPTION_CONFIDENCE',
        relevance: 0,
        technicalKnowledge: 0,
        technicalScore: 0,
        communication: 0,
        communicationScore: 0,
        problemSolving: 0,
        problemSolvingScore: 0,
        confidence: 0,
        confidenceScore: 0,
        clarity: 0,
        clarityScore: 0,
        correctness: 0,
        overallScore: 0,
        conceptCoverage: 0,
        completeness: 0,
        technicalQuality: 0,
        grammar: 0,
        keywordMatches: [],
        conceptsIdentified: [],
        strengths: [],
        weaknesses: ['Speech-to-text confidence too low for reliable evaluation.'],
        missingConcepts: ['Articulate pronunciation required.'],
        commonMistakes: ['Mumbling or speaking too fast for recognition engine.'],
        suggestedImprovement: 'Speak with clear articulation at a steady pace.',
        feedback: 'Transcription confidence was low. To protect your score, please repeat clearly.',
        betterAnswer: payload.modelAnswer,
        confidenceIndicators: 'Low transcription confidence',
      };
    }

    const rawAnswer = payload.studentAnswer || '';
    const normalizedRaw = normalizeTechnicalTranscript(rawAnswer, payload.field);
    const cleaned = normalizedRaw.trim();

    // 1. EMPTY ANSWER ENFORCEMENT (Backend level, strictly 0 marks, no LLM)
    if (!cleaned) {
      return {
        answerStatus: 'EMPTY',
        relevance: 0,
        technicalKnowledge: 0,
        technicalScore: 0,
        communication: 0,
        communicationScore: 0,
        problemSolving: 0,
        problemSolvingScore: 0,
        confidence: 0,
        confidenceScore: 0,
        clarity: 0,
        clarityScore: 0,
        correctness: 0,
        overallScore: 0,
        conceptCoverage: 0,
        completeness: 0,
        technicalQuality: 0,
        grammar: 0,
        keywordMatches: [],
        conceptsIdentified: [],
        strengths: [],
        weaknesses: ['No answer submitted. The question was left completely blank.'],
        missingConcepts: ['All required technical concepts were omitted.'],
        commonMistakes: ['Blank submission without attempt'],
        suggestedImprovement: 'Always attempt to formulate a structured response, breaking down the problem step-by-step.',
        feedback: 'No answer submitted. The question was left completely blank.',
        betterAnswer: payload.modelAnswer,
        confidenceIndicators: 'None (Unanswered)',
      };
    }

    // 2. NONSENSE / GIBBERISH DETECTION
    const isRepeatedChar = /(.)\1{5,}/i.test(cleaned);
    const isKeyboardSmash = /^[asdfghjklqwertyuiopzxcvbnm\s]{12,}$/i.test(cleaned) && !cleaned.includes(' ');
    const isRepetitiveGibberish = /^(bla|blah|na|la|ha|test|qwerty|asdf)(\s+(bla|blah|na|la|ha|test|qwerty|asdf))+$/i.test(cleaned);
    
    if (isRepeatedChar || isKeyboardSmash || isRepetitiveGibberish) {
      return {
        answerStatus: 'NONSENSE',
        relevance: 0,
        technicalKnowledge: 0,
        technicalScore: 0,
        communication: 0,
        communicationScore: 0,
        problemSolving: 0,
        problemSolvingScore: 0,
        confidence: 0,
        confidenceScore: 0,
        clarity: 0,
        clarityScore: 0,
        correctness: 0,
        overallScore: 0,
        conceptCoverage: 0,
        completeness: 0,
        technicalQuality: 0,
        grammar: 0,
        keywordMatches: [],
        conceptsIdentified: [],
        strengths: [],
        weaknesses: ['Submitted text contains non-meaningful repetitive characters or gibberish.'],
        missingConcepts: ['Legitimate technical terminology and coherent English explanation.'],
        commonMistakes: ['Submitting gibberish or test text'],
        suggestedImprovement: 'Provide real technical reasoning relevant to the question.',
        feedback: 'Submission does not contain meaningful words or concepts.',
        betterAnswer: payload.modelAnswer,
        confidenceIndicators: 'Nonsense submission',
      };
    }

    // 3. "I DON'T KNOW" / SKIP ENFORCEMENT
    const normalizedLower = cleaned.toLowerCase().replace(/['"`]/g, '');
    const isNoAnswerRegex = /^(i\s+dont\s+know|dont\s+know|no\s+idea|i\s+have\s+no\s+idea|cant\s+answer|cannot\s+answer|skip|not\s+sure|pass|idk|no\s+clue|i\s+am\s+not\s+sure|i\s+do\s+not\s+know)[.!]?$/i;
    const noAnswerPhrases = [
      'dont know',
      'do not know',
      'no idea',
      'cant answer',
      'cannot answer',
      'cant remember',
      'cannot remember',
      'havent studied',
      'have not studied',
      'not sure',
      'no clue',
      'skip',
      'pass',
      'idk',
      'not familiar',
      'didnt study',
      'did not study',
      'no knowledge'
    ];
    const hasNoAnswerPhrase = noAnswerPhrases.some(phrase => normalizedLower.includes(phrase));
    const isShortAdmission = cleaned.length < 150 && hasNoAnswerPhrase;

    if (isNoAnswerRegex.test(normalizedLower) || isShortAdmission) {
      return {
        answerStatus: 'I_DONT_KNOW',
        relevance: 0,
        technicalKnowledge: 0,
        technicalScore: 0,
        communication: 0,
        communicationScore: 0,
        problemSolving: 0,
        problemSolvingScore: 0,
        confidence: 0,
        confidenceScore: 0,
        clarity: 0,
        clarityScore: 0,
        correctness: 0,
        overallScore: 0,
        conceptCoverage: 0,
        completeness: 0,
        technicalQuality: 0,
        grammar: 10,
        keywordMatches: [],
        conceptsIdentified: [],
        strengths: ['Honest acknowledgment of current knowledge gap'],
        weaknesses: [`Unfamiliarity with core concepts of ${payload.topic || 'the question'}`],
        missingConcepts: [`Foundational principles of ${payload.topic || 'the assigned topic'}`],
        commonMistakes: ['Skipping question without applying fundamental first-principles reasoning'],
        suggestedImprovement: `Review foundational study modules on ${payload.topic || 'this subject'} and practice conceptual recall.`,
        feedback: `Knowledge gap acknowledged on ${payload.topic || 'this subject'}. Added to personalized study path.`,
        betterAnswer: payload.modelAnswer,
        confidenceIndicators: 'Uncertain / Skipped',
      };
    }

    // 4. TOO SHORT / SINGLE WORD CHECK
    const wordList = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (wordList.length < 3 && cleaned.length < 20) {
      return {
        answerStatus: 'TOO_SHORT',
        relevance: 10,
        technicalKnowledge: 5,
        technicalScore: 5,
        communication: 5,
        communicationScore: 5,
        problemSolving: 0,
        problemSolvingScore: 0,
        confidence: 5,
        confidenceScore: 5,
        clarity: 10,
        clarityScore: 10,
        correctness: 0,
        overallScore: 5,
        conceptCoverage: 5,
        completeness: 5,
        technicalQuality: 5,
        grammar: 20,
        keywordMatches: [],
        conceptsIdentified: [],
        strengths: [],
        weaknesses: ['Answer was too brief to explain the concept.'],
        missingConcepts: ['Comprehensive explanation, mechanism, and reasoning.'],
        commonMistakes: ['Answering with only 1 or 2 words'],
        suggestedImprovement: 'Provide full sentences explaining how and why the concept works.',
        feedback: 'Answer was too brief to evaluate. Provide a complete, structured explanation.',
        betterAnswer: payload.modelAnswer,
        confidenceIndicators: 'Too short',
      };
    }

    // 5. QUESTION COPYING DETECTION (Similarity analysis against prompt)
    const cleanTokens = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const qTokens = new Set(cleanTokens(payload.question));
    const aTokens = cleanTokens(cleaned);

    let overlapCount = 0;
    for (const token of aTokens) {
      if (qTokens.has(token)) overlapCount++;
    }

    const tokenOverlapRatio = aTokens.length > 0 ? overlapCount / aTokens.length : 0;
    const isExactSubstr = payload.question.toLowerCase().includes(normalizedLower) || normalizedLower.includes(payload.question.toLowerCase());

    if ((tokenOverlapRatio > 0.75 && aTokens.length >= 4) || (isExactSubstr && cleaned.length > 25)) {
      return {
        answerStatus: 'COPY_SUSPECTED',
        relevance: 15,
        technicalKnowledge: 5,
        technicalScore: 5,
        communication: 10,
        communicationScore: 10,
        problemSolving: 0,
        problemSolvingScore: 0,
        confidence: 5,
        confidenceScore: 5,
        clarity: 10,
        clarityScore: 10,
        correctness: 0,
        overallScore: 5,
        conceptCoverage: 5,
        completeness: 5,
        technicalQuality: 5,
        grammar: 40,
        keywordMatches: [],
        conceptsIdentified: [],
        strengths: [],
        weaknesses: ['Submission closely mirrors or repeats the interview prompt rather than explaining concepts independently.'],
        missingConcepts: ['Original technical explanation, personal reasoning, and illustrative examples.'],
        commonMistakes: ['Repeating question text instead of answering'],
        suggestedImprovement: 'Provide an authentic, independently formulated response with concrete examples.',
        feedback: 'Submission closely mirrors the question prompt rather than demonstrating independent explanation.',
        betterAnswer: payload.modelAnswer,
        confidenceIndicators: 'Suspicious (Echoing prompt)',
      };
    }

    // 6. CALL AI / GROQ FOR STRUCTURED EVALUATION
    const prompt = `You are a strict, professional technical interviewer and assessor evaluating a student's answer.
Context:
Career Field: ${payload.field || 'Engineering / Professional'}
Topic: ${payload.topic}
Question: ${payload.question}
Model Answer: ${payload.modelAnswer}
Student's Submitted Answer: ${cleaned}

Evaluate the student's answer objectively.
Rules:
1. If the answer is completely off-topic or irrelevant (e.g. answering about a totally different field or nonsense), set "answerStatus": "IRRELEVANT" and give very low marks (below 15).
2. For a genuine, valid answer, evaluate:
   - technicalKnowledge (0-100): Depth, accuracy, and grasp of technical concepts.
   - communication (0-100): Structure, conciseness, and articulation.
   - problemSolving (0-100): Logical thinking, application of principles, and edge case handling.
   - confidence (0-100): Decisiveness, tone, and conviction.
   - clarity (0-100): Precision and absence of ambiguity.
   - relevance (0-100): Direct alignment with the specific question asked.

Return ONLY a valid JSON object strictly matching this schema:
{
  "answerStatus": "VALID" or "IRRELEVANT",
  "relevance": number (0-100),
  "technicalKnowledge": number (0-100),
  "communication": number (0-100),
  "problemSolving": number (0-100),
  "confidence": number (0-100),
  "clarity": number (0-100),
  "overallScore": number (0-100),
  "conceptCoverage": number (0-100),
  "completeness": number (0-100),
  "grammar": number (0-100),
  "keywordMatches": ["keyword1", "keyword2"],
  "conceptsIdentified": ["concept1", "concept2"],
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"],
  "missingConcepts": ["missing concept 1"],
  "commonMistakes": ["mistake identified if any"],
  "suggestedImprovement": "actionable guidance",
  "betterAnswer": "example of a superior answer"
}`;

    try {
      const response = await groqRequest({ prompt });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and clamp all scores
        const clamp = (val: any, fallback = 50) => {
          const n = Number(val);
          return isNaN(n) ? fallback : Math.max(0, Math.min(100, Math.round(n)));
        };

        const relevance = clamp(parsed.relevance, 70);
        let status = parsed.answerStatus === 'IRRELEVANT' || relevance < 25 ? 'IRRELEVANT' : 'VALID';

        let tech = clamp(parsed.technicalKnowledge || parsed.technicalQuality, 60);
        let comm = clamp(parsed.communication || parsed.clarity, 65);
        let ps = clamp(parsed.problemSolving || parsed.conceptCoverage, 60);
        let conf = clamp(parsed.confidence, 65);
        let clar = clamp(parsed.clarity, 65);

        if (status === 'IRRELEVANT') {
          tech = Math.min(tech, 15);
          ps = Math.min(ps, 10);
        }

        const overall = clamp(parsed.overallScore, Math.round(tech * 0.4 + comm * 0.2 + ps * 0.2 + conf * 0.1 + clar * 0.1));

        if (status !== 'IRRELEVANT') {
          if (overall >= 85) status = 'STRONG';
          else if (overall >= 70) status = 'VALID';
          else status = 'PARTIALLY_VALID';
        }

        return {
          answerStatus: status,
          relevance,
          technicalKnowledge: tech,
          technicalScore: tech,
          technicalQuality: tech,
          communication: comm,
          communicationScore: comm,
          problemSolving: ps,
          problemSolvingScore: ps,
          confidence: conf,
          confidenceScore: conf,
          clarity: clar,
          clarityScore: clar,
          correctness: tech,
          overallScore: overall,
          conceptCoverage: clamp(parsed.conceptCoverage, tech),
          completeness: clamp(parsed.completeness, tech),
          grammar: clamp(parsed.grammar, 80),
          keywordMatches: Array.isArray(parsed.keywordMatches) ? parsed.keywordMatches : [],
          conceptsIdentified: Array.isArray(parsed.conceptsIdentified) ? parsed.conceptsIdentified : [payload.topic],
          strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : ['Demonstrated fundamental knowledge'],
          weaknesses: Array.isArray(parsed.weaknesses) && parsed.weaknesses.length > 0 ? parsed.weaknesses : ['Could deepen technical rigor'],
          missingConcepts: Array.isArray(parsed.missingConcepts) ? parsed.missingConcepts : [],
          commonMistakes: Array.isArray(parsed.commonMistakes) ? parsed.commonMistakes : [],
          suggestedImprovement: parsed.suggestedImprovement || 'Continue developing structured technical explanations.',
          feedback: parsed.suggestedImprovement || 'Structured technical response evaluated.',
          betterAnswer: parsed.betterAnswer || payload.modelAnswer,
          confidenceIndicators: `${conf >= 75 ? 'Strong' : conf >= 50 ? 'Moderate' : 'Developing'} presence`,
        };
      }
      throw new Error('Could not parse AI response JSON');
    } catch (error) {
      console.warn('AI Answer evaluation fallback activated:', error);

      // Heuristic fallback matching model answer & question keywords
      const modelTokens = cleanTokens(payload.modelAnswer);
      const questionTokens = cleanTokens(payload.question);
      const topicTokens = cleanTokens(payload.topic);
      const fieldTokens = cleanTokens(payload.field || '');
      const refTokens = new Set([...modelTokens, ...questionTokens, ...topicTokens, ...fieldTokens]);

      const studentTokens = cleanTokens(cleaned);
      const matched = studentTokens.filter(t => refTokens.has(t));
      const matchRatio = studentTokens.length > 0 ? matched.length / studentTokens.length : 0;

      // An answer is off-topic/irrelevant if it shares virtually no relevant domain/question tokens
      const isOffTopic = matchRatio < 0.12 || (studentTokens.length >= 4 && matched.length === 0);

      const baseTech = isOffTopic ? 5 : Math.min(95, Math.max(25, Math.round(matchRatio * 100 + (cleaned.length > 80 ? 25 : 10))));
      const baseComm = isOffTopic ? 15 : Math.min(90, Math.max(30, Math.round(50 + (cleaned.length > 60 ? 25 : 10))));
      const basePS = isOffTopic ? 0 : Math.min(90, Math.max(25, Math.round(baseTech * 0.9)));
      const baseConf = isOffTopic ? 15 : Math.min(85, Math.max(35, Math.round(baseComm * 0.9)));
      const baseClar = isOffTopic ? 15 : Math.min(90, Math.max(30, Math.round(baseComm * 0.95)));
      const baseOverall = Math.round(baseTech * 0.4 + baseComm * 0.2 + basePS * 0.2 + baseConf * 0.1 + baseClar * 0.1);
      let fallbackStatus: 'IRRELEVANT' | 'PARTIALLY_VALID' | 'VALID' | 'STRONG' = 'VALID';
      if (isOffTopic) {
        fallbackStatus = 'IRRELEVANT';
      } else if (baseOverall >= 85) {
        fallbackStatus = 'STRONG';
      } else if (baseOverall >= 70) {
        fallbackStatus = 'VALID';
      } else {
        fallbackStatus = 'PARTIALLY_VALID';
      }

      return {
        answerStatus: fallbackStatus,
        relevance: isOffTopic ? 15 : 75,
        technicalKnowledge: baseTech,
        technicalScore: baseTech,
        technicalQuality: baseTech,
        communication: baseComm,
        communicationScore: baseComm,
        problemSolving: basePS,
        problemSolvingScore: basePS,
        confidence: baseConf,
        confidenceScore: baseConf,
        clarity: baseClar,
        clarityScore: baseClar,
        correctness: baseTech,
        overallScore: baseOverall,
        conceptCoverage: baseTech,
        completeness: baseTech,
        grammar: 75,
        keywordMatches: matched.slice(0, 5),
        conceptsIdentified: [payload.topic || 'Domain concept'],
        strengths: isOffTopic ? [] : ['Structured attempt', 'Foundational vocabulary applied'],
        weaknesses: isOffTopic ? ['Answer appears disconnected from the question topic'] : ['Expand on practical implementations and edge cases'],
        missingConcepts: ['Comprehensive edge-case and architectural elaboration'],
        commonMistakes: isOffTopic ? ['Off-topic answer'] : [],
        suggestedImprovement: 'Include concrete technical details, real-world examples, and trade-offs in your explanation.',
        feedback: isOffTopic ? 'Answer appears disconnected from the question topic.' : 'Include concrete technical details and trade-offs in your explanation.',
        betterAnswer: payload.modelAnswer,
        confidenceIndicators: 'Evaluated via benchmark heuristic',
      };
    }
  },
};
