import { QuestionInterviewSession, QuestionBank, QuestionVariant, StudentAnswer } from '../models/questionBank';
import { randomUUID } from 'crypto';

export const interviewSessionService = {
  // Create personalized interview session
  createSession: async (payload: {
    studentId: string;
    field: string;
    topic?: string;
    difficulty?: string;
    questionCount?: number;
    adaptiveDifficulty?: boolean;
    useVariations?: boolean;
  }): Promise<any> => {
    try {
      // 1. Query active domain/subject questions (non-HR)
      const domainQuery: any = { 
        field: payload.field, 
        status: 'Active', 
        interviewType: { $ne: 'HR' } 
      };
      if (payload.topic) domainQuery.topic = payload.topic;
      if (payload.difficulty) domainQuery.difficulty = payload.difficulty;

      let availableDomain = await QuestionBank.find(domainQuery).lean();

      // Fallback 1: If fewer than 10 questions, expand search to include all domain questions in this field (ignoring topic/difficulty)
      if (availableDomain.length < 10) {
        const fallbackQuery = { field: payload.field, status: 'Active', interviewType: { $ne: 'HR' } };
        const fallbackDomain = await QuestionBank.find(fallbackQuery).lean();
        const seenIds = new Set(availableDomain.map(q => q._id.toString()));
        for (const q of fallbackDomain) {
          if (!seenIds.has(q._id.toString())) {
            availableDomain.push(q);
            seenIds.add(q._id.toString());
          }
        }
      }

      // Fallback 2: If still fewer than 10, pull any active non-HR questions globally from database
      if (availableDomain.length < 10) {
        const globalDomain = await QuestionBank.find({ status: 'Active', interviewType: { $ne: 'HR' } }).lean();
        const seenIds = new Set(availableDomain.map(q => q._id.toString()));
        for (const q of globalDomain) {
          if (!seenIds.has(q._id.toString())) {
            availableDomain.push(q);
            seenIds.add(q._id.toString());
          }
        }
      }

      if (availableDomain.length === 0) {
        throw new Error('No domain questions available in the question bank.');
      }

      // Rotate and select exactly 10 domain questions
      const selectedDomain = await rotateQuestions(
        payload.studentId,
        availableDomain,
        10
      );

      // 2. Query active HR questions
      const hrQuery = { interviewType: 'HR', status: 'Active' };
      let availableHR = await QuestionBank.find(hrQuery).lean();

      if (availableHR.length === 0) {
        throw new Error('No HR questions available in the question bank.');
      }

      // Rotate and select exactly 4 HR questions
      const selectedHR = await rotateQuestions(
        payload.studentId,
        availableHR,
        4
      );

      // 3. Combine both lists (10 domain + 4 HR = 14 questions total)
      const rotatedQuestions = [...selectedDomain, ...selectedHR];

      // Get variations if enabled
      const questionSet = [];
      for (const q of rotatedQuestions) {
        if (payload.useVariations !== false) {
          await getQuestionVariant(q._id, payload.useVariations || false);
        }

        questionSet.push({
          questionId: q._id,
          sequence: questionSet.length + 1,
          asked: false,
        });
      }

      // Create session
      const session = await QuestionInterviewSession.create({
        studentId: payload.studentId,
        sessionId: randomUUID(),
        field: payload.field,
        topic: payload.topic,
        questionSet,
        totalQuestions: questionSet.length,
        useVariations: payload.useVariations !== false,
        adaptiveDifficulty: payload.adaptiveDifficulty !== false,
      });

      return {
        sessionId: session.sessionId,
        totalQuestions: session.totalQuestions,
        startedAt: session.startTime,
      };
    } catch (error) {
      console.error('Session creation failed:', error);
      throw error;
    }
  },

  // Get next question in session
  getNextQuestion: async (sessionId: string, studentId: string): Promise<any> => {
    const session = await QuestionInterviewSession.findOne({ sessionId, studentId });
    if (!session) throw new Error('Session not found');

    // Find next unanswered question
    const nextQuestion = session.questionSet.find((q: any) => !q.asked);
    if (!nextQuestion) {
      return { message: 'Interview completed', completed: true };
    }

    // Get question details
    const question = await QuestionBank.findById(nextQuestion.questionId);
    if (!question) throw new Error('Question not found');

    // Mark as asked
    await QuestionInterviewSession.updateOne(
      { sessionId, 'questionSet._id': (nextQuestion as any)._id },
      { $set: { 'questionSet.$.asked': true, 'questionSet.$.askedAt': new Date() } }
    );

    return {
      questionId: question._id,
      question: question.question,
      sequence: nextQuestion.sequence,
      totalQuestions: session.totalQuestions,
      expectedDuration: question.expectedDuration,
    };
  },

  // Submit answer
  submitAnswer: async (payload: {
    sessionId: string;
    studentId: string;
    questionId: string;
    answer: string;
    answerType: 'Text' | 'Voice' | 'Video';
    timeTaken: number;
  }): Promise<any> => {
    try {
      // Create answer record
      const studentAnswer = await StudentAnswer.create({
        studentId: payload.studentId,
        sessionId: payload.sessionId,
        questionId: payload.questionId,
        answer: payload.answer,
        answerType: payload.answerType,
        timeTaken: payload.timeTaken,
      });

      // Update session progress
      await QuestionInterviewSession.updateOne(
        { sessionId: payload.sessionId },
        { $inc: { questionsAnswered: 1 } }
      );

      return { answerId: studentAnswer._id, saved: true };
    } catch (error) {
      console.error('Answer submission failed:', error);
      throw error;
    }
  },

  // Complete session
  completeSession: async (sessionId: string, studentId: string): Promise<any> => {
    const session = await QuestionInterviewSession.findOneAndUpdate(
      { sessionId, studentId },
      {
        status: 'Completed',
        endTime: new Date(),
      },
      { new: true }
    );

    if (!session) {
      throw new Error('Session not found');
    }

    return {
      sessionId: session.sessionId,
      completedAt: session.endTime,
      totalQuestions: session.totalQuestions,
      questionsAnswered: session.questionsAnswered,
    };
  },
};

// Helper: Rotate questions to avoid repetition
async function rotateQuestions(
  studentId: string,
  availableQuestions: any[],
  count: number
): Promise<any[]> {
  // Get student's recent answer history
  const recentAnswers = await StudentAnswer.find({
    studentId,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
  }).select('questionId');

  const answeredIds = new Set(recentAnswers.map((a: any) => a.questionId.toString()));

  // Filter out recently answered questions
  let filtered = availableQuestions.filter(q => !answeredIds.has(q._id.toString()));

  // If not enough filtered questions, use all
  if (filtered.length < count) {
    filtered = availableQuestions;
  }

  // Shuffle and select
  const shuffled = filtered.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper: Get or create question variant
async function getQuestionVariant(questionId: string, create: boolean): Promise<any> {
  // Try to find existing variant
  const variant = await QuestionVariant.findOne({ baseQuestionId: questionId }).lean();
  if (variant) return variant;

  // If not found and create is true, variations should have been pre-generated
  return null;
}

// Adaptive difficulty: increase difficulty if student performs well
export const adaptiveDifficultyService = {
  adjustDifficulty: async (payload: {
    sessionId: string;
    studentId: string;
    lastScore: number;
    currentDifficulty: string;
  }): Promise<string> => {
    const threshold = 75; // If score > 75, increase difficulty
    
    if (payload.lastScore >= threshold) {
      const difficultyProgression = ['Easy', 'Medium', 'Hard', 'Expert'];
      const currentIdx = difficultyProgression.indexOf(payload.currentDifficulty);
      
      if (currentIdx < difficultyProgression.length - 1) {
        return difficultyProgression[currentIdx + 1];
      }
    }
    
    return payload.currentDifficulty;
  },
};
