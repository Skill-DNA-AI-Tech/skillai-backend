import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, index: true }, // Computer Science, MBA, Medical, etc.
    topic: { type: String, required: true, index: true }, // JavaScript, Marketing, Cardiology, etc.
    subtopic: { type: String, index: true }, // Closures, Digital Marketing, etc.
    question: { type: String, required: true, unique: true },
    answer: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Expert'], required: true, index: true },
    interviewType: { type: String, enum: ['Technical', 'HR', 'Behavioral', 'Scenario', 'Domain', 'MCQ', 'Descriptive', 'RapidFire'], default: 'Technical' },
    mcqOptions: [String],
    notes: String,
    tags: [String],
    keywords: [String],
    expectedDuration: { type: Number, default: 120 }, // seconds
    
    // Auto-generated metadata
    metadata: {
      concepts: [String],
      scoreWeight: { type: Number, min: 1, max: 10, default: 5 },
      estimatedAnswerTime: String, // "2 minutes"
      answerQuality: { type: Number, min: 0, max: 100 }, // AI-scored
      technicalDepth: { type: Number, min: 0, max: 100 },
      keywordCount: Number,
      conceptCount: Number,
      answerCompleteness: { type: Number, min: 0, max: 100 },
      duplicateScore: { type: Number, min: 0, max: 100, default: 0 },
      isOriginal: { type: Boolean, default: true }
    },
    
    // Follow-up questions
    followUpQuestions: [String],
    scenarioVariations: [String],
    
    // Source tracking
    uploadedBy: mongoose.Schema.Types.ObjectId,
    uploadDate: { type: Date, default: Date.now },
    source: { type: String, enum: ['Manual', 'CSV', 'Excel', 'PDF', 'JSON', 'AI-Generated'], default: 'Manual' },
    
    // Status
    status: { type: String, enum: ['Active', 'Draft', 'Archived', 'Review'], default: 'Active' },
    approved: { type: Boolean, default: true },
    approvedBy: mongoose.Schema.Types.ObjectId,
    approvalDate: Date,
    
    // Analytics
    timesAsked: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    commonMistakes: [String],
  },
  { timestamps: true }
);

export const QuestionBank = mongoose.model('QuestionBank', QuestionSchema);

// Question Variants - variations of same base question
const QuestionVariantSchema = new mongoose.Schema(
  {
    baseQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank', required: true, index: true },
    variant: { type: String, required: true },
    variantType: { type: String, enum: ['Rewording', 'Scenario', 'RealWorld', 'Conceptual', 'Practical', 'CaseStudy'], required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Expert'] },
  },
  { timestamps: true }
);

export const QuestionVariant = mongoose.model('QuestionVariant', QuestionVariantSchema);

// Generated Questions - AI-created questions
const GeneratedQuestionSchema = new mongoose.Schema(
  {
    field: String,
    topic: String,
    subtopic: String,
    question: { type: String, required: true },
    modelAnswer: String,
    difficulty: String,
    interviewType: String,
    followUpQuestions: [String],
    scenarioQuestions: [String],
    caseStudyQuestions: [String],
    mcqOptions: [String],
    
    // AI generation metadata
    generatedBy: { type: String, default: 'Groq-LLM' },
    generationPrompt: String,
    qualityScore: { type: Number, min: 0, max: 100 },
    requiresHumanReview: Boolean,
    
    status: { type: String, enum: ['Draft', 'Review', 'Approved', 'Published', 'Rejected'], default: 'Draft' },
    approvedBy: mongoose.Schema.Types.ObjectId,
    approvalDate: Date,
    
    // Batch generation tracking
    batchId: String,
    requestedCount: Number,
  },
  { timestamps: true }
);

export const GeneratedQuestion = mongoose.model('GeneratedQuestion', GeneratedQuestionSchema);

// Question Metadata - stores analysis results
const QuestionMetadataSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank', required: true, unique: true },
    concepts: [String],
    keywords: [String],
    difficulty: String,
    scoreWeight: Number,
    estimatedAnswerTime: String,
    answerQuality: Number,
    technicalDepth: Number,
    duplicateMatches: [
      {
        matchedQuestionId: mongoose.Schema.Types.ObjectId,
        similarityScore: Number,
      }
    ],
    relatedTopics: [String],
    learningPath: [String],
  },
  { timestamps: true }
);

export const QuestionMetadata = mongoose.model('QuestionMetadata', QuestionMetadataSchema);

// Question Interview Sessions - tracks unique interview experience per student for question bank
const QuestionInterviewSessionSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, unique: true, required: true },
    
    // Interview configuration
    field: String,
    topic: String,
    careerDomain: String,
    targetRole: String,
    experienceLevel: String,
    currentDifficulty: { type: String, enum: ['BASIC', 'INTERMEDIATE', 'ADVANCED'], default: 'BASIC' },
    
    questionSet: [
      {
        questionId: mongoose.Schema.Types.ObjectId,
        sequence: Number,
        difficulty: { type: String, enum: ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'Easy', 'Medium', 'Hard'] },
        topic: String,
        asked: { type: Boolean, default: false },
        askedAt: Date,
        answerSubmitted: Boolean,
      }
    ],
    
    // Session tracking
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    status: { type: String, enum: ['Active', 'Completed', 'Paused', 'Abandoned'], default: 'Active' },
    totalQuestions: { type: Number, default: 10 },
    minQuestions: { type: Number, default: 10 },
    maxQuestions: { type: Number, default: 15 },
    questionsAnswered: { type: Number, default: 0 },
    
    // Summary metrics & breakdown
    competencies: {
      technical: { type: Number, default: 0 },
      communication: { type: Number, default: 0 },
      problemSolving: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      clarity: { type: Number, default: 0 },
      overall: { type: Number, default: 0 },
    },
    answerCounts: {
      valid: { type: Number, default: 0 },
      empty: { type: Number, default: 0 },
      noAnswer: { type: Number, default: 0 },
      irrelevant: { type: Number, default: 0 },
      copySuspected: { type: Number, default: 0 },
    },
    strengths: [String],
    weaknesses: [String],
    stuckTopics: [String],
    difficultyProgression: [
      {
        sequence: Number,
        difficulty: String,
        topic: String,
        score: Number,
        status: String,
      }
    ],
    finalReport: { type: mongoose.Schema.Types.Mixed },
    passStatus: { type: String, enum: ['PASS', 'FAIL'], default: 'FAIL' },
    passingScore: { type: Number, default: 75 },
    visualAnalytics: {
      faceDetectedPercent: { type: Number, default: 100 },
      cameraFacingPercent: { type: Number, default: 100 },
      lookingAwayPercent: { type: Number, default: 0 },
      multipleFaceEvents: { type: Number, default: 0 },
      behaviorStatus: { type: String, default: 'NORMAL' },
    },
    audioAnalytics: {
      audioQualityStatus: { type: String, default: 'ACCEPTABLE' },
      averageConfidence: { type: Number, default: 0.9 },
    },
    
    // Generated variations
    useVariations: { type: Boolean, default: true },
    adaptiveDifficulty: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const QuestionInterviewSession = mongoose.model('QuestionInterviewSession', QuestionInterviewSessionSchema);

// Student Answers - stores all student responses
const StudentAnswerSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: String,
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank', required: true, index: true },
    
    answer: String, // text, transcribed speech, or video URL
    answerType: { type: String, enum: ['Text', 'Voice', 'Video'], default: 'Text' },
    answerStatus: { 
      type: String, 
      enum: [
        'EMPTY', 
        'NO_SPEECH', 
        'LOW_AUDIO_QUALITY', 
        'LOW_TRANSCRIPTION_CONFIDENCE', 
        'TOO_SHORT', 
        'I_DONT_KNOW', 
        'NO_ANSWER', 
        'IRRELEVANT', 
        'NONSENSE', 
        'COPY_SUSPECTED', 
        'PARTIALLY_VALID', 
        'VALID', 
        'STRONG'
      ], 
      default: 'VALID' 
    },
    transcriptionConfidence: { type: Number, default: 1.0 },
    audioQuality: { type: String, default: 'CLEAR' },
    visualMetrics: {
      faceDetected: { type: Boolean, default: true },
      cameraFacingRatio: { type: Number, default: 1.0 },
      lookingAwayRatio: { type: Number, default: 0.0 },
      multipleFacesDetected: { type: Boolean, default: false },
    },
    
    // 5 Core Competency Scores (0-100)
    technicalScore: { type: Number, min: 0, max: 100, default: 0 },
    communicationScore: { type: Number, min: 0, max: 100, default: 0 },
    problemSolvingScore: { type: Number, min: 0, max: 100, default: 0 },
    confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
    clarityScore: { type: Number, min: 0, max: 100, default: 0 },
    
    // Additional analysis metrics
    correctness: { type: Number, min: 0, max: 100, default: 0 },
    technicalQualityScore: { type: Number, min: 0, max: 100, default: 0 },
    completenessScore: { type: Number, min: 0, max: 100, default: 0 },
    grammarScore: { type: Number, min: 0, max: 100, default: 0 },
    
    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    
    // Feedback
    feedback: {
      strengths: [String],
      weaknesses: [String],
      missingConcepts: [String],
      suggestedImprovement: String,
      betterAnswer: String,
      relevanceScore: Number,
    },
    
    submitTime: { type: Date, default: Date.now },
    analysisCompletedAt: Date,
    timeTaken: Number, // seconds
  },
  { timestamps: true }
);

export const StudentAnswer = mongoose.model('StudentAnswer', StudentAnswerSchema);

// Answer Analysis - detailed AI analysis
const AnswerAnalysisSchema = new mongoose.Schema(
  {
    answerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentAnswer', required: true, unique: true },
    questionId: mongoose.Schema.Types.ObjectId,
    studentId: mongoose.Schema.Types.ObjectId,
    
    analysisType: { type: String, enum: ['Text', 'Voice', 'Video'], default: 'Text' },
    
    // Extracted information
    extractedConcepts: [String],
    mentionedKeywords: [String],
    keywordMatches: { type: Number, default: 0 },
    conceptCoverage: { type: Number, min: 0, max: 100, default: 0 },
    
    // Quality metrics
    answerStructure: { type: String, enum: ['Poor', 'Fair', 'Good', 'Excellent'], default: 'Fair' },
    logicalFlow: { type: Number, min: 0, max: 100, default: 0 },
    relevance: { type: Number, min: 0, max: 100, default: 0 },
    originalThinking: { type: Number, min: 0, max: 100, default: 0 },
    
    // Common mistakes detected
    errors: [String],
    misconceptions: [String],
    missingInfo: [String],
    
    // Recommendations
    learningResources: [{
      topic: String,
      type: String, // Video, Article, Quiz, etc.
      link: String,
    }],
    
    analysisModel: { type: String, default: 'Groq-LLM' },
  },
  { timestamps: true }
);

export const AnswerAnalysis = mongoose.model('AnswerAnalysis', AnswerAnalysisSchema);

// Question Generation Logs - tracks AI generation activities
const QuestionGenerationLogSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Generation parameters
    parameters: {
      field: String,
      topic: String,
      subtopic: String,
      difficulty: String,
      count: Number,
      interviewTypes: [String],
    },
    
    // Results
    generatedCount: { type: Number, default: 0 },
    approvedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    
    // AI model info
    modelUsed: { type: String, default: 'Groq-LLM' },
    promptTokens: Number,
    completionTokens: Number,
    totalTokens: Number,
    
    // Status and timing
    status: { type: String, enum: ['InProgress', 'Completed', 'Failed'], default: 'InProgress' },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    durationMs: Number,
    
    // Error tracking
    error: String,
  },
  { timestamps: true }
);

export const QuestionGenerationLog = mongoose.model('QuestionGenerationLog', QuestionGenerationLogSchema);

// Admin Upload Logs - tracks bulk upload activities
const AdminUploadLogSchema = new mongoose.Schema(
  {
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // Upload details
    uploadFormat: { type: String, enum: ['csv', 'excel', 'json', 'pdf', 'manual'], required: true },
    fileName: String,
    fileSize: Number, // bytes
    
    // Processing results
    totalRecords: { type: Number, default: 0 },
    processedRecords: { type: Number, default: 0 },
    successfulUploads: { type: Number, default: 0 },
    failedUploads: { type: Number, default: 0 },
    duplicateDetected: { type: Number, default: 0 },
    
    // AI analysis results
    aiAnalysisCount: { type: Number, default: 0 },
    averageQualityScore: Number,
    
    // Status and timing
    status: { type: String, enum: ['Processing', 'Completed', 'Failed'], default: 'Processing' },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    durationMs: Number,
    
    // Error tracking
    errors: [{
      recordIndex: Number,
      error: String,
      recordData: mongoose.Schema.Types.Mixed,
    }],
    
    // Generated question IDs
    generatedQuestionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' }],
  },
  { timestamps: true }
);

export const AdminUploadLog = mongoose.model('AdminUploadLog', AdminUploadLogSchema);
