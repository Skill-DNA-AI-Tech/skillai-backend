import { QuestionInterviewSession, QuestionBank, StudentAnswer } from '../models/questionBank';
import User from '../models/user';
import Profile from '../models/profile';
import CareerTwinMemory from '../models/careerTwinMemory';
import Assessment from '../models/assessment';
import StudentTopicProgress from '../models/learning/studentTopicProgress';
import { questionAnalysisService } from './questionAnalysis';
import { randomUUID } from 'crypto';

// Standard domain name normalizer
export function normalizeDomain(rawDomain?: string): string {
  if (!rawDomain) return 'Computer Science';
  const lower = rawDomain.toLowerCase().trim();
  if (lower.includes('mech') || lower.includes('automobile')) return 'Mechanical Engineering';
  if (lower.includes('civil') || lower.includes('construct') || lower.includes('structur')) return 'Civil Engineering';
  if (lower.includes('elect') || lower.includes('embed') || lower.includes('hardware') || lower.includes('vlsi') || lower.includes('iot')) return 'Electronics';
  if (lower.includes('comm') || lower.includes('account') || lower.includes('tax') || lower.includes('audit')) return 'Commerce';
  if (lower.includes('finan') || lower.includes('invest') || lower.includes('bank')) return 'Finance';
  if (lower.includes('manage') || lower.includes('business') || lower.includes('analyst') || lower.includes('consult')) return 'Management';
  if (lower.includes('market') || lower.includes('seo') || lower.includes('growth') || lower.includes('digital')) return 'Marketing';
  if (lower.includes('hr') || lower.includes('human') || lower.includes('talent') || lower.includes('recruit')) return 'HR';
  if (lower.includes('design') || lower.includes('ui') || lower.includes('ux') || lower.includes('graphic')) return 'Design';
  if (lower.includes('health') || lower.includes('medic') || lower.includes('clinic') || lower.includes('hospital')) return 'Healthcare';
  if (lower.includes('hospit') || lower.includes('hotel') || lower.includes('tourism')) return 'Hospitality';
  if (lower.includes('edu') || lower.includes('teach') || lower.includes('acad')) return 'Education';
  if (lower.includes('data') || lower.includes('ai') || lower.includes('ml') || lower.includes('python') || lower.includes('cs') || lower.includes('software') || lower.includes('it') || lower.includes('tech') || lower.includes('web')) return 'Computer Science';
  return rawDomain;
}

export const interviewSessionService = {
  // Create personalized adaptive interview session (10-15 questions)
  createSession: async (payload: {
    studentId: string;
    field?: string;
    careerDomain?: string;
    targetRole?: string;
    topic?: string;
    difficulty?: string;
    questionCount?: number;
    experienceLevel?: string;
    adaptiveDifficulty?: boolean;
    useVariations?: boolean;
  }): Promise<any> => {
    try {
      // 1. Resolve student profile and career domain
      const student = await User.findById(payload.studentId).lean();
      const profile = await Profile.findOne({ user: payload.studentId }).lean();

      const rawField = payload.field || payload.careerDomain || (student as any)?.careerDomain || (profile as any)?.domain || 'Computer Science';
      const targetDomain = normalizeDomain(rawField);
      const targetRole = payload.targetRole || (student as any)?.targetRole || (profile as any)?.preferredRoles?.[0] || (profile as any)?.branch || 'Specialist';
      const experienceLevel = payload.experienceLevel || (student as any)?.experienceLevel || 'Fresher';

      // Determine starting difficulty based on experience
      let startingDifficulty = 'BASIC';
      const expLower = String(experienceLevel).toLowerCase();
      if (expLower.includes('experienced') || expLower.includes('senior') || expLower.includes('3') || expLower.includes('4') || expLower.includes('5')) {
        startingDifficulty = 'ADVANCED';
      } else if (expLower.includes('1') || expLower.includes('2') || expLower.includes('intermediate') || expLower.includes('mid')) {
        startingDifficulty = 'INTERMEDIATE';
      } else if (payload.difficulty) {
        const d = payload.difficulty.toUpperCase();
        if (['BASIC', 'INTERMEDIATE', 'ADVANCED'].includes(d)) startingDifficulty = d;
        else if (d === 'EASY') startingDifficulty = 'BASIC';
        else if (d === 'MEDIUM') startingDifficulty = 'INTERMEDIATE';
        else if (d === 'HARD') startingDifficulty = 'ADVANCED';
      }

      // 2. Query domain-specific questions for this career path
      const domainQuery: any = {
        field: targetDomain,
        status: 'Active',
        interviewType: { $ne: 'HR' },
      };

      let availableDomain = await QuestionBank.find(domainQuery).lean();

      // Fallback: If fewer than 10 questions in this specific domain, query case-insensitively or generate
      if (availableDomain.length < 10) {
        const regexQuery = { field: new RegExp(targetDomain.split(' ')[0], 'i'), status: 'Active', interviewType: { $ne: 'HR' } };
        const extraDomain = await QuestionBank.find(regexQuery).lean();
        const seenIds = new Set(availableDomain.map((q: any) => q._id.toString()));
        for (const q of extraDomain) {
          if (!seenIds.has(q._id.toString())) {
            availableDomain.push(q);
            seenIds.add(q._id.toString());
          }
        }
      }

      // If still fewer than 10 questions, dynamically generate domain-specific questions
      if (availableDomain.length < 10) {
        try {
          const generated = await questionAnalysisService.generateQuestions({
            field: targetDomain,
            topic: payload.topic || `${targetDomain} Fundamentals`,
            difficulty: startingDifficulty === 'ADVANCED' ? 'Hard' : startingDifficulty === 'INTERMEDIATE' ? 'Medium' : 'Easy',
            count: 10 - availableDomain.length,
            interviewTypes: ['Technical'],
          });

          for (const g of generated) {
            const created = await QuestionBank.create({
              ...g,
              field: targetDomain,
              topic: payload.topic || `${targetDomain} Core`,
              status: 'Active',
              approved: true,
              source: 'Adaptive-Generator',
            });
            availableDomain.push(created.toObject());
          }
        } catch (genErr) {
          console.warn('Could not auto-generate domain questions, utilizing available questions:', genErr);
        }
      }

      if (availableDomain.length === 0) {
        throw new Error(`No questions available for domain ${targetDomain}. Please ensure questions are seeded.`);
      }

      // 3. Rotate questions to avoid repetition (Select 8 domain questions)
      const selectedDomain = await rotateQuestions(payload.studentId, availableDomain, 8);

      // 4. Query active HR/Behavioral questions
      const hrQuery = { interviewType: 'HR', status: 'Active' };
      let availableHR = await QuestionBank.find(hrQuery).lean();
      if (availableHR.length === 0) {
        availableHR = availableDomain.slice(0, 2);
      }
      const selectedHR = await rotateQuestions(payload.studentId, availableHR, 2);

      // 5. Combine for an initial set of 10 questions with progressive difficulty:
      // Questions 1-3: BASIC, Questions 4-7: INTERMEDIATE, Questions 8-10+: ADVANCED
      const initialPool = [...selectedDomain, ...selectedHR];
      const questionSet = initialPool.map((q: any, idx: number) => {
        let diff = 'BASIC';
        if (idx >= 3 && idx < 7) diff = 'INTERMEDIATE';
        else if (idx >= 7) diff = 'ADVANCED';
        return {
          questionId: q._id,
          sequence: idx + 1,
          difficulty: diff,
          topic: q.topic || targetDomain,
          asked: false,
        };
      });

      // 6. Create session record
      const session = await QuestionInterviewSession.create({
        studentId: payload.studentId,
        sessionId: randomUUID(),
        field: targetDomain,
        careerDomain: targetDomain,
        targetRole,
        experienceLevel,
        topic: payload.topic || 'Comprehensive Evaluation',
        currentDifficulty: startingDifficulty,
        questionSet,
        totalQuestions: questionSet.length,
        minQuestions: 10,
        maxQuestions: 15,
        questionsAnswered: 0,
        competencies: {
          technical: 0,
          communication: 0,
          problemSolving: 0,
          confidence: 0,
          clarity: 0,
          overall: 0,
        },
        answerCounts: {
          valid: 0,
          empty: 0,
          noAnswer: 0,
          irrelevant: 0,
          copySuspected: 0,
        },
        strengths: [],
        weaknesses: [],
        stuckTopics: [],
        difficultyProgression: [],
        status: 'Active',
      });

      return {
        sessionId: session.sessionId,
        careerDomain: session.careerDomain,
        targetRole: session.targetRole,
        currentDifficulty: session.currentDifficulty,
        totalQuestions: session.totalQuestions,
        minQuestions: session.minQuestions,
        maxQuestions: session.maxQuestions,
        startedAt: session.startTime,
      };
    } catch (error) {
      console.error('Session creation failed:', error);
      throw error;
    }
  },

  // Get next question with real-time adaptive difficulty & dynamic question scaling (10-15 questions)
  getNextQuestion: async (sessionId: string, studentId: string): Promise<any> => {
    const session = await QuestionInterviewSession.findOne({ sessionId, studentId });
    if (!session) throw new Error('Session not found');

    if (session.status === 'Completed') {
      return { message: 'Interview completed', completed: true };
    }

    // Find next unasked question in current questionSet
    let nextQuestionItem = session.questionSet.find((q: any) => !q.asked);

    // DYNAMIC 10-15 EVALUATION CHECK
    // If all initial questions have been asked, check if dynamic extension is required (up to 15)
    if (!nextQuestionItem) {
      const answeredCount = session.questionsAnswered || 0;

      // Determine if we need additional questions (11 to 15)
      // Criteria:
      // A) Student is stuck in basic/intermediate topics and needs targeted follow-up
      // B) Student is high-performing (overall >= 75) and can receive advanced evaluation
      const hasStuckTopics = (session.stuckTopics && session.stuckTopics.length > 0);
      const isHighPerforming = (session.competencies?.overall || 0) >= 75;
      const canExtend = answeredCount < (session.maxQuestions || 15);

      if (canExtend && (hasStuckTopics || isHighPerforming) && answeredCount < 13) {
        // Dynamically add a follow-up question
        const difficultyToAsk = hasStuckTopics ? session.currentDifficulty : 'ADVANCED';
        const topicToAsk = hasStuckTopics ? session.stuckTopics[session.stuckTopics.length - 1] : session.field;

        // Query an unasked question matching this criteria
        const askedIds = session.questionSet.map((q: any) => q.questionId.toString());
        const candidateQ = await QuestionBank.findOne({
          field: session.field,
          _id: { $nin: askedIds },
          status: 'Active',
        }).lean();

        if (candidateQ) {
          const newSequence = session.questionSet.length + 1;
          session.questionSet.push({
            questionId: candidateQ._id as any,
            sequence: newSequence,
            difficulty: difficultyToAsk,
            topic: topicToAsk,
            asked: false,
          } as any);
          session.totalQuestions = session.questionSet.length;
          await session.save();

          nextQuestionItem = session.questionSet[session.questionSet.length - 1];
        }
      }
    }

    // If still no question item, interview is truly complete
    if (!nextQuestionItem) {
      await interviewSessionService.completeSession(sessionId, studentId);
      return { message: 'Interview completed', completed: true };
    }

    // Get question details
    const questionDoc = await QuestionBank.findById(nextQuestionItem.questionId);
    if (!questionDoc) throw new Error('Question not found');

    // Mark as asked
    await QuestionInterviewSession.updateOne(
      { sessionId, 'questionSet._id': (nextQuestionItem as any)._id },
      { $set: { 'questionSet.$.asked': true, 'questionSet.$.askedAt': new Date() } }
    );

    return {
      questionId: questionDoc._id,
      question: questionDoc.question,
      sequence: nextQuestionItem.sequence,
      totalQuestions: Math.max(session.totalQuestions, 10),
      currentDifficulty: session.currentDifficulty,
      careerDomain: session.careerDomain || session.field,
      topic: questionDoc.topic,
      expectedDuration: questionDoc.expectedDuration || 120,
    };
  },

  // Submit student answer, validate at backend level, evaluate 5 competencies, and update difficulty
  submitAnswer: async (payload: {
    sessionId: string;
    studentId: string;
    questionId: string;
    answer: string;
    answerType?: 'Text' | 'Voice' | 'Video';
    timeTaken?: number;
    transcriptionConfidence?: number;
    audioQuality?: string;
    isSilent?: boolean;
    visualMetrics?: {
      faceDetected: boolean;
      cameraFacingRatio: number;
      lookingAwayRatio: number;
      multipleFacesDetected: boolean;
    };
  }): Promise<any> => {
    try {
      const session = await QuestionInterviewSession.findOne({
        sessionId: payload.sessionId,
        studentId: payload.studentId,
      });
      if (!session) throw new Error('Session not found');

      const questionDoc = await QuestionBank.findById(payload.questionId);
      if (!questionDoc) throw new Error('Question not found');

      // Execute strict backend answer validation pipeline
      const analysis = await questionAnalysisService.analyzeAnswer({
        question: questionDoc.question,
        modelAnswer: questionDoc.answer,
        studentAnswer: payload.answer,
        topic: questionDoc.topic,
        field: session.field || session.careerDomain,
        transcriptionConfidence: payload.transcriptionConfidence,
        audioQuality: payload.audioQuality,
        isSilent: payload.isSilent,
      });

      // Create StudentAnswer record with 5 competency metrics
      const studentAnswer = await StudentAnswer.create({
        studentId: payload.studentId,
        sessionId: payload.sessionId,
        questionId: payload.questionId,
        answer: payload.answer,
        answerType: payload.answerType || 'Text',
        answerStatus: analysis.answerStatus,
        transcriptionConfidence: payload.transcriptionConfidence ?? 1.0,
        audioQuality: payload.audioQuality ?? 'CLEAR',
        visualMetrics: payload.visualMetrics,
        technicalScore: analysis.technicalScore,
        communicationScore: analysis.communicationScore,
        problemSolvingScore: analysis.problemSolvingScore,
        confidenceScore: analysis.confidenceScore,
        clarityScore: analysis.clarityScore,
        correctness: analysis.correctness,
        technicalQualityScore: analysis.technicalQuality,
        completenessScore: analysis.completeness,
        grammarScore: analysis.grammar,
        overallScore: analysis.overallScore,
        feedback: {
          strengths: analysis.strengths || [],
          weaknesses: analysis.weaknesses || [],
          missingConcepts: analysis.missingConcepts || [],
          suggestedImprovement: analysis.suggestedImprovement || '',
          betterAnswer: analysis.betterAnswer || '',
          relevanceScore: analysis.relevance,
        },
        timeTaken: payload.timeTaken || 90,
        analysisCompletedAt: new Date(),
      });

      // Update session visual analytics if visual metrics provided
      if (payload.visualMetrics) {
        if (!session.visualAnalytics) {
          session.visualAnalytics = {
            faceDetectedPercent: 100,
            cameraFacingPercent: 100,
            lookingAwayPercent: 0,
            multipleFaceEvents: 0,
            behaviorStatus: 'NORMAL',
          };
        }
        const vm = payload.visualMetrics;
        const totalAnswers = (session.questionsAnswered || 0) + 1;
        session.visualAnalytics.cameraFacingPercent = Math.round(
          (session.visualAnalytics.cameraFacingPercent * (totalAnswers - 1) + (vm.cameraFacingRatio * 100)) / totalAnswers
        );
        session.visualAnalytics.lookingAwayPercent = Math.round(
          (session.visualAnalytics.lookingAwayPercent * (totalAnswers - 1) + (vm.lookingAwayRatio * 100)) / totalAnswers
        );
        if (vm.multipleFacesDetected) {
          session.visualAnalytics.multipleFaceEvents += 1;
        }
        if (session.visualAnalytics.lookingAwayPercent > 45) {
          session.visualAnalytics.behaviorStatus = 'EXCESSIVE_LOOK_AWAY';
        } else if (!vm.faceDetected) {
          session.visualAnalytics.behaviorStatus = 'NO_FACE_DETECTED';
        } else if (session.visualAnalytics.multipleFaceEvents > 1) {
          session.visualAnalytics.behaviorStatus = 'MULTIPLE_FACES_DETECTED';
        } else {
          session.visualAnalytics.behaviorStatus = 'NORMAL';
        }
      }

      // Update questionBank stats
      await QuestionBank.findByIdAndUpdate(payload.questionId, {
        $inc: { timesAsked: 1 },
      });

      // 7. Update Session Metrics & Adaptive Difficulty Progression
      const score = analysis.overallScore || 0;
      const statusKey = analysis.answerStatus;

      // Update answer counts
      if (!session.answerCounts) {
        session.answerCounts = { valid: 0, empty: 0, noAnswer: 0, irrelevant: 0, copySuspected: 0 };
      }
      if (statusKey === 'EMPTY') session.answerCounts.empty += 1;
      else if (statusKey === 'NO_ANSWER') session.answerCounts.noAnswer += 1;
      else if (statusKey === 'IRRELEVANT') session.answerCounts.irrelevant += 1;
      else if (statusKey === 'COPY_SUSPECTED') session.answerCounts.copySuspected += 1;
      else session.answerCounts.valid += 1;

      // Track strengths and weaknesses
      if (score >= 75) {
        if (analysis.strengths) session.strengths.push(...analysis.strengths);
      } else {
        if (analysis.weaknesses) session.weaknesses.push(...analysis.weaknesses);
      }

      // USER REQUIREMENT: "if user have stacj in INTERMEDIATE, basic then not go other ask that lev only and Career Twin add that part"
      let newDifficulty = session.currentDifficulty || 'BASIC';
      const isStruggling = score < 50 || statusKey === 'EMPTY' || statusKey === 'NO_ANSWER' || statusKey === 'IRRELEVANT';

      if (isStruggling) {
        // Record stuck topic for Career Twin diagnosis
        const stuckTopicName: string = String(questionDoc.topic || session.field || 'General');
        if (!session.stuckTopics.includes(stuckTopicName)) {
          session.stuckTopics.push(stuckTopicName);
        }

        // If struggling at INTERMEDIATE or BASIC, do NOT upgrade!
        // If at ADVANCED, step down to INTERMEDIATE. If at INTERMEDIATE/BASIC, keep at that exact level!
        if (session.currentDifficulty === 'ADVANCED') {
          newDifficulty = 'INTERMEDIATE';
        }
        // If at INTERMEDIATE or BASIC, stay at currentDifficulty
      } else if (score >= 75 && !isStruggling) {
        // Student answered strongly: progressive advancement
        if (session.currentDifficulty === 'BASIC') {
          newDifficulty = 'INTERMEDIATE';
        } else if (session.currentDifficulty === 'INTERMEDIATE') {
          newDifficulty = 'ADVANCED';
        }
      }

      session.currentDifficulty = newDifficulty;
      session.questionsAnswered = (session.questionsAnswered || 0) + 1;

      // Track difficulty progression
      session.difficultyProgression.push({
        sequence: session.questionsAnswered,
        difficulty: session.currentDifficulty,
        topic: questionDoc.topic,
        score,
        status: statusKey,
      });

      await session.save();

      return {
        answerId: studentAnswer._id,
        saved: true,
        answerStatus: analysis.answerStatus,
        score: analysis.overallScore,
        feedback: analysis.feedback || analysis.suggestedImprovement || (analysis.weaknesses && analysis.weaknesses[0]) || 'Answer evaluated.',
        scores: {
          technical: analysis.technicalScore,
          communication: analysis.communicationScore,
          problemSolving: analysis.problemSolvingScore,
          confidence: analysis.confidenceScore,
          clarity: analysis.clarityScore,
          overall: analysis.overallScore,
        },
        competencies: {
          technical: analysis.technicalScore,
          communication: analysis.communicationScore,
          problemSolving: analysis.problemSolvingScore,
          confidence: analysis.confidenceScore,
          clarity: analysis.clarityScore,
          overall: analysis.overallScore,
        },
        currentDifficulty: session.currentDifficulty,
        questionsAnswered: session.questionsAnswered,
        totalQuestions: session.totalQuestions,
      };
    } catch (error) {
      console.error('Answer submission failed:', error);
      throw error;
    }
  },

  // Complete session, calculate final 5-competency report, and sync with Career Twin
  completeSession: async (sessionId: string, studentId: string): Promise<any> => {
    const session = await QuestionInterviewSession.findOne({ sessionId, studentId });
    if (!session) throw new Error('Session not found');

    const answers = await StudentAnswer.find({ sessionId });

    // Compute composite competency averages
    const count = answers.length || 1;
    const avgTech = Math.round(answers.reduce((acc, a) => acc + (a.technicalScore || 0), 0) / count);
    const avgComm = Math.round(answers.reduce((acc, a) => acc + (a.communicationScore || 0), 0) / count);
    const avgPS = Math.round(answers.reduce((acc, a) => acc + (a.problemSolvingScore || 0), 0) / count);
    const avgConf = Math.round(answers.reduce((acc, a) => acc + (a.confidenceScore || 0), 0) / count);
    const avgClar = Math.round(answers.reduce((acc, a) => acc + (a.clarityScore || 0), 0) / count);
    const avgOverall = Math.round(avgTech * 0.4 + avgComm * 0.2 + avgPS * 0.2 + avgConf * 0.1 + avgClar * 0.1);

    // Readiness status
    let readinessStatus = 'NOT_READY';
    if (avgOverall >= 85) readinessStatus = 'ADVANCED';
    else if (avgOverall >= 75) readinessStatus = 'READY';
    else if (avgOverall >= 50) readinessStatus = 'IN_PROGRESS';

    // Distinct strengths & weaknesses
    const distinctStrengths = Array.from(new Set(answers.flatMap(a => a.feedback?.strengths || []))).slice(0, 6);
    const distinctWeaknesses = Array.from(new Set([
      ...(session.stuckTopics || []),
      ...answers.flatMap(a => a.feedback?.weaknesses || [])
    ])).slice(0, 6);

    // 75% Passing Standard Rule (Backend Enforced)
    const passStatus: 'PASS' | 'FAIL' = avgOverall >= 75 ? 'PASS' : 'FAIL';

    const reportData = {
      overallScore: avgOverall,
      passStatus,
      passingScore: 75,
      competencies: {
        technical: avgTech,
        communication: avgComm,
        problemSolving: avgPS,
        confidence: avgConf,
        clarity: avgClar,
        overall: avgOverall,
      },
      readinessStatus,
      careerDomain: session.careerDomain || session.field,
      targetRole: session.targetRole || 'Specialist',
      questionsAttempted: answers.length,
      answerCounts: session.answerCounts,
      stuckTopics: session.stuckTopics || [],
      difficultyProgression: session.difficultyProgression || [],
      strengths: distinctStrengths,
      weaknesses: distinctWeaknesses,
      recommendations: distinctWeaknesses.map(w => `Focus practice on ${w} using structured problems and targeted domain tutorials.`),
      completedAt: new Date(),
    };

    session.status = 'Completed';
    session.endTime = new Date();
    session.passStatus = passStatus;
    session.passingScore = 75;
    session.competencies = reportData.competencies;
    session.finalReport = reportData;
    await session.save();

    // Record verified Assessment entry
    try {
      await Assessment.create({
        studentId,
        assessmentType: 'INTERVIEW',
        careerDomain: session.careerDomain || session.field,
        targetRole: session.targetRole || 'Specialist',
        overallScore: avgOverall,
        passStatus,
        passingScore: 75,
        competencies: {
          technicalKnowledge: avgTech,
          communication: avgComm,
          problemSolving: avgPS,
          confidence: avgConf,
          clarity: avgClar,
        },
        topicBreakdown: (session.stuckTopics || []).map(topic => ({
          topic,
          score: 45,
          questionsCount: 1,
          correctCount: 0,
        })),
        strengths: distinctStrengths,
        weakTopics: distinctWeaknesses,
        knowledgeGaps: distinctWeaknesses,
        recommendedLearning: distinctWeaknesses.map(w => ({
          title: `Mastery Module: ${w}`,
          reason: `Targeted concept reinforcement identified during interview`,
          priority: 'HIGH',
          recommendedModule: w,
        })),
        questionsAnswered: answers.length,
        totalQuestions: session.totalQuestions,
        answers: answers.map(a => ({
          questionId: a.questionId,
          score: a.overallScore,
          status: a.answerStatus,
        })),
        attemptNumber: (await Assessment.countDocuments({ studentId, assessmentType: 'INTERVIEW' })) + 1,
        verified: true,
        certificateEligible: passStatus === 'PASS',
        visualAnalytics: session.visualAnalytics,
        audioAnalytics: session.audioAnalytics,
      });
    } catch (assessErr) {
      console.warn('Failed to record Assessment entry:', assessErr);
    }

    // 8. Sync with Profile & Skill DNA
    try {
      const assessedSkill = session.topic || session.field || 'Core Technical';
      const evidenceEntry = {
        skill: assessedSkill,
        score: avgOverall,
        confidence: avgConf,
        evidence: 'interview',
        verifiedAt: new Date(),
        trend: avgOverall >= 70 ? 'improving' : 'steady',
        attempts: 1,
      };

      await Profile.findOneAndUpdate(
        { user: studentId },
        {
          $set: {
            'skillDNA.technicalScore': avgTech,
            'skillDNA.communicationScore': avgComm,
            'skillDNA.projectsScore': avgPS,
            'skillDNA.confidenceScore': avgConf,
            'skillDNA.score': avgOverall,
            'skillDNA.strengths': distinctStrengths,
            'skillDNA.weaknesses': distinctWeaknesses,
            'skillDNA.lastAssessedAt': new Date(),
          },
          $push: {
            'skillDNA.evidenceMatrix': {
              $each: [evidenceEntry],
              $slice: -50,
            },
          },
        },
        { upsert: true }
      );
    } catch (profErr) {
      console.warn('Profile skillDNA update failed:', profErr);
    }

    // 8.5. Sync with StudentTopicProgress if topic or field is available
    if (session.topic || session.field) {
      const topicToUpdate = session.topic || session.field;
      const isMastered = passStatus === 'PASS';
      try {
        await StudentTopicProgress.findOneAndUpdate(
          {
            studentId,
            domain: session.careerDomain || session.field,
            topic: topicToUpdate,
            subtopic: 'General',
          },
          {
            $set: {
              career: (session as any).career || 'General',
              domain: session.careerDomain || session.field,
              topic: topicToUpdate,
              subtopic: 'General',
              interviewScore: avgOverall,
              status: isMastered ? 'PASSED' : 'NEEDS_REVISION',
              isMastered,
              lastAssessedAt: new Date(),
              ...(isMastered ? { passedAt: new Date() } : {}),
            },
            $max: { highestScore: avgOverall },
            $inc: { attempts: 1 },
          },
          { upsert: true, new: true }
        );
      } catch (progErr) {
        console.warn('StudentTopicProgress update from interview failed:', progErr);
      }
    }

    // 9. Sync with Career Twin Memory & Weakness Remediation
    try {
      const twinDoc = await CareerTwinMemory.findOne({
        $or: [{ userId: studentId }, { user: studentId }]
      });

      const interviewRemediations = distinctWeaknesses.map(weakConcept => ({
        concept: weakConcept,
        topic: session.topic || weakConcept,
        domain: session.careerDomain || session.field,
        score: avgOverall,
        diagnostic: `Identified as a critical weak point during technical mock interview evaluation (overall score: ${avgOverall}%).`,
        personalizedNotes: `### Interview Concept Mastery: ${weakConcept}\nTo confidently articulate ${weakConcept} in technical interviews:\n1. Clearly state the core definition and system architecture role.\n2. Detail trade-offs, edge cases, and typical implementation challenges.\n3. Practice explaining the concept out loud using concise technical terminology.`,
        youtubeResources: [
          {
            title: `${weakConcept} Technical Interview Questions & Answers`,
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(weakConcept + ' interview questions deep dive')}`,
            channel: 'Tech Primers / Engineering Digest',
          },
        ],
        externalResources: [
          {
            title: `${weakConcept} Architecture Guide & Documentation`,
            url: `https://www.google.com/search?q=${encodeURIComponent(weakConcept + ' architecture documentation guide')}`,
            platform: 'System Design / Official Guide',
          },
        ],
        examples: `// Key architectural pattern and syntax for ${weakConcept}\n// Ensure fault tolerance and correct exception handling.`,
        practiceQuestions: [
          {
            question: `How would you explain the internal mechanism of ${weakConcept} to a hiring manager?`,
            answer: `Focus on how data flows, memory allocation, and concurrency guarantees.`,
          },
        ],
        reassessmentAvailable: true,
        resolved: false,
        lastAssessedAt: new Date(),
      }));

      if (twinDoc) {
        twinDoc.domain = session.careerDomain || session.field;
        twinDoc.targetRole = session.targetRole;
        twinDoc.benchmarks = {
          technical: avgTech,
          communication: avgComm,
          problemSolving: avgPS,
          confidence: avgConf,
          overall: avgOverall,
        };
        twinDoc.overallScore = avgOverall;
        twinDoc.technicalScore = avgTech;
        twinDoc.confidence = avgConf;
        twinDoc.communicationQuality = avgComm;
        twinDoc.lastEvaluatedAt = new Date();
        twinDoc.generatedAt = new Date();

        if (passStatus === 'PASS' && (session.topic || session.field)) {
          const resolvedTopic = session.topic || session.field;
          if (Array.isArray(twinDoc.weaknessRemediations)) {
            for (const rem of twinDoc.weaknessRemediations) {
              if (rem.topic === resolvedTopic || rem.concept === resolvedTopic) {
                rem.resolved = true;
                rem.reassessmentAvailable = true;
              }
            }
          }
        }

        if (interviewRemediations.length > 0) {
          if (!Array.isArray(twinDoc.weaknessRemediations)) {
            twinDoc.weaknessRemediations = [];
          }
          for (const rem of interviewRemediations) {
            const idx = twinDoc.weaknessRemediations.findIndex(
              (r: any) => r.concept === rem.concept
            );
            if (idx >= 0) {
              twinDoc.weaknessRemediations[idx] = rem;
            } else {
              twinDoc.weaknessRemediations.push(rem);
            }
          }
        }

        const existingWeak = new Set(twinDoc.weakAreas || []);
        const existingStrengths = new Set(twinDoc.strengths || []);
        for (const wt of distinctWeaknesses) {
          existingWeak.add(wt);
          existingStrengths.delete(wt);
        }
        for (const st of distinctStrengths) {
          existingStrengths.add(st);
          if (avgOverall >= 75) existingWeak.delete(st);
        }
        twinDoc.weakAreas = Array.from(existingWeak);
        twinDoc.weaknesses = Array.from(existingWeak);
        twinDoc.strengths = Array.from(existingStrengths);

        await twinDoc.save();
      } else {
        await CareerTwinMemory.create({
          userId: studentId,
          user: studentId,
          domain: session.careerDomain || session.field,
          targetRole: session.targetRole,
          benchmarks: {
            technical: avgTech,
            communication: avgComm,
            problemSolving: avgPS,
            confidence: avgConf,
            overall: avgOverall,
          },
          overallScore: avgOverall,
          technicalScore: avgTech,
          confidence: avgConf,
          communicationQuality: avgComm,
          weakAreas: distinctWeaknesses,
          strengths: distinctStrengths,
          weaknesses: distinctWeaknesses,
          weaknessRemediations: interviewRemediations,
          lastEvaluatedAt: new Date(),
        });
      }
    } catch (ctErr) {
      console.warn('CareerTwinMemory update failed:', ctErr);
    }

    return {
      sessionId: session.sessionId,
      report: reportData,
    };
  },
};

// Helper: Rotate questions to avoid repetition
async function rotateQuestions(studentId: string, availableQuestions: any[], count: number): Promise<any[]> {
  const recentAnswers = await StudentAnswer.find({
    studentId,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }).select('questionId');

  const answeredIds = new Set(recentAnswers.map((a: any) => a.questionId?.toString()));
  let filtered = availableQuestions.filter(q => !answeredIds.has(q._id.toString()));

  if (filtered.length < count) {
    filtered = availableQuestions;
  }

  const shuffled = [...filtered].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
