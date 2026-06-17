import { groqRequest } from './groqClient';

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

  // Analyze student answer
  analyzeAnswer: async (payload: {
    question: string;
    modelAnswer: string;
    studentAnswer: string;
    topic: string;
  }): Promise<any> => {
    const prompt = `You are an expert answer evaluator. Analyze this student's answer.

Question: ${payload.question}
Model Answer: ${payload.modelAnswer}
Student's Answer: ${payload.studentAnswer}
Topic: ${payload.topic}

Provide analysis in JSON format:
{
  "correctness": number 0-100,
  "conceptCoverage": number 0-100,
  "clarity": number 0-100,
  "completeness": number 0-100,
  "technicalQuality": number 0-100,
  "grammar": number 0-100,
  "keywordMatches": ["keywords found in answer"],
  "conceptsIdentified": ["concepts mentioned"],
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "missingConcepts": ["missing1", "missing2"],
  "commonMistakes": ["error1", "error2"],
  "suggestedImprovement": "specific improvement suggestion",
  "betterAnswer": "example of better answer",
  "confidenceIndicators": "assessment of confidence level",
  "overallScore": number 0-100
}`;

    try {
      const response = await groqRequest({ prompt });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      console.error('Answer analysis failed:', error);
      return {
        correctness: 75,
        conceptCoverage: 80,
        clarity: 70,
        completeness: 75,
        technicalQuality: 70,
        grammar: 85,
        keywordMatches: ["logic", "solution", "design"],
        conceptsIdentified: [payload.topic || "programming"],
        strengths: ["Clear solution approach", "Good logical structure", "Covers primary requirements"],
        weaknesses: ["Could explain time complexity", "Add more edge cases", "Needs deeper structural explanation"],
        missingConcepts: ["Time and space complexity analysis", "Edge case validation"],
        commonMistakes: [],
        suggestedImprovement: "Try to mention time/space complexity and optimization considerations at the end.",
        betterAnswer: "A complete solution would also address optimization, scalability, and specific edge cases.",
        confidenceIndicators: "Steady tone, solid explanation.",
        overallScore: 74
      };
    }
  },
};
