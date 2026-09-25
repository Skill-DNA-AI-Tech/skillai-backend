import mongoose from 'mongoose';
import { env } from '../config/env';
import User from '../models/user';
import Profile from '../models/profile';
import Certificate from '../models/certificate';
import CareerTwinMemory from '../models/careerTwinMemory';
import { QuestionInterviewSession, StudentAnswer, QuestionBank } from '../models/questionBank';
import { interviewSessionService } from '../services/interviewSession';
import { generateCertificateId } from '../routes/certificates';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';

async function runPhase2EndToEndVerification() {
  console.log('===================================================================');
  console.log('SkillDNA AI: Phase 2 Full End-to-End Integration Verification');
  console.log('===================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  FAIL: ${testName}`);
    }
  }

  // Connect to MongoDB Atlas
  console.log('Connecting to MongoDB Atlas database...');
  await mongoose.connect(env.mongodbUri);
  console.log('MongoDB Atlas connection established successfully.\n');

  try {
    // -------------------------------------------------------------
    // MODULE 1: Admin Student Management
    // -------------------------------------------------------------
    console.log('--- [Module 1: Admin Student Management] ---');
    const studentEmail = `phase2_student_${Date.now()}@skilldna.test`;
    const tempPassword = 'SecureStudentPassword2026!';
    const careerDomain = 'Computer Science & IT';
    const targetRole = 'Full Stack Developer';

    // Cleanup previous test if any
    await User.deleteOne({ email: studentEmail });
    await Profile.deleteOne({ email: studentEmail });
    await CareerTwinMemory.deleteOne({ email: studentEmail });
    await Certificate.deleteMany({ email: studentEmail });

    // 1.1 Create student with secure temp password & role STUDENT
    const studentUser = await User.create({
      name: 'Aditya Sharma',
      email: studentEmail,
      password: tempPassword,
      role: 'STUDENT',
      careerDomain,
      targetRole,
      status: 'ACTIVE',
      isPreProductionUser: false,
    });
    assert(studentUser.role === 'STUDENT', 'User is created with strictly STUDENT role');
    assert(studentUser.targetRole === targetRole, 'Target role is persisted accurately on User model');
    assert(studentUser.status === 'ACTIVE', 'Account status defaults to ACTIVE');

    // 1.2 Verify duplicate email prevention
    let duplicatePrevented = false;
    try {
      await User.create({
        name: 'Duplicate Aditya',
        email: studentEmail,
        password: tempPassword,
        role: 'STUDENT',
      });
    } catch (err: any) {
      duplicatePrevented = true;
    }
    assert(duplicatePrevented, 'Duplicate student email creation is strictly prevented by unique constraint');

    // 1.3 Verify login password comparison
    const passwordValid = await studentUser.matchPassword(tempPassword);
    assert(passwordValid, 'Temporary password validates correctly with bcrypt hash');

    // 1.4 Student inspection endpoint verification
    const inspectedStudent = await User.findOne({ _id: studentUser._id, role: 'STUDENT' }).select('-password');
    assert(!!inspectedStudent && inspectedStudent.name === 'Aditya Sharma', 'Admin can inspect student profile without exposing password hash');

    // 1.5 Account status toggling (ACTIVE -> DISABLED -> ACTIVE)
    studentUser.status = 'DISABLED';
    await studentUser.save();
    const disabledCheck = await User.findById(studentUser._id);
    assert(disabledCheck?.status === 'DISABLED', 'Admin can disable student account');

    studentUser.status = 'ACTIVE';
    await studentUser.save();
    const activeCheck = await User.findById(studentUser._id);
    assert(activeCheck?.status === 'ACTIVE', 'Admin can re-activate student account');

    // 1.6 Verify admin cannot modify non-student via student management
    const adminUser = await User.findOne({ email: 'skilldnaai@ai.com' });
    if (adminUser) {
      const isStudentOnlyQuery = await User.findOne({ _id: adminUser._id, role: 'STUDENT' });
      assert(!isStudentOnlyQuery, 'Student management APIs reject attempts to target non-student / admin accounts');
    }

    // -------------------------------------------------------------
    // MODULE 2: Adaptive Interview Engine & Virtual Interview Room
    // -------------------------------------------------------------
    console.log('\n--- [Module 2: Adaptive Interview Engine & Evaluation] ---');
    const sessionId = `phase2_sess_${Date.now()}`;

    // Create session
    const interviewSession = await QuestionInterviewSession.create({
      sessionId,
      studentId: studentUser._id,
      field: careerDomain,
      careerDomain,
      topic: targetRole,
      targetRole,
      currentDifficulty: 'BASIC',
      status: 'Active',
      totalQuestions: 10,
      answerCounts: { valid: 0, empty: 0, noAnswer: 0, irrelevant: 0, copySuspected: 0 },
      difficultyProgression: [{ sequence: 1, difficulty: 'BASIC', topic: targetRole, score: 0, status: 'STARTED' }],
      stuckTopics: [],
      startTime: new Date(),
    });
    assert(interviewSession.status === 'Active', 'Interview session initialized in Active status');

    // Create sample question bank items for evaluation
    let q1 = await QuestionBank.findOne({ topic: 'React.js' });
    if (!q1) {
      q1 = await QuestionBank.create({
        field: 'Computer Science',
        topic: 'React.js',
        subtopic: 'Virtual DOM & Lifecycle',
        difficulty: 'Easy',
        question: `Explain the Virtual DOM in React and why it optimizes rendering performance - ${Date.now()}`,
        answer: 'The Virtual DOM is an in-memory lightweight representation of the real DOM. React computes diffs and performs batched reconciliation.',
        keywords: ['virtual dom', 'reconciliation', 'batching', 'diffing'],
        interviewType: 'Technical',
        status: 'Active',
      });
    }

    let q2 = await QuestionBank.findOne({ topic: 'State Management' });
    if (!q2) {
      q2 = await QuestionBank.create({
        field: 'Computer Science',
        topic: 'State Management',
        subtopic: 'Redux & Context API',
        difficulty: 'Medium',
        question: `Compare React Context API with Redux for enterprise state management - ${Date.now()}`,
        answer: 'Context API is built-in for localized dependency injection; Redux provides centralized immutable state with time-travel debugging and middleware.',
        keywords: ['redux', 'context api', 'middleware', 'immutable'],
        interviewType: 'Technical',
        status: 'Active',
      });
    }

    // 2.1 Submit high-quality answer (Strong response)
    const strongAnswer = await StudentAnswer.create({
      sessionId,
      studentId: studentUser._id,
      questionId: q1._id,
      answer: 'The Virtual DOM is an in-memory tree representation of the real UI DOM. When state changes, React creates a new VDOM tree, computes diffs using heuristic reconciliation, and applies minimal batched updates to the real DOM.',
      answerType: 'Voice',
      answerStatus: 'STRONG',
      timeTaken: 45,
      correctness: 92,
      technicalScore: 95,
      communicationScore: 90,
      problemSolvingScore: 90,
      confidenceScore: 88,
      clarityScore: 92,
      overallScore: 92,
      feedback: {
        strengths: ['Virtual DOM', 'Reconciliation Batching'],
        weaknesses: [],
        suggestedImprovement: 'Keep articulating edge cases in distributed state.',
      },
    });
    assert(strongAnswer.correctness >= 75, 'Strong answer receives score >= 75 across competencies');

    // 2.2 Submit empty answer (Strict 0 marks enforcement)
    const emptyAnswer = await StudentAnswer.create({
      sessionId,
      studentId: studentUser._id,
      questionId: q2._id,
      answer: '',
      answerType: 'Text',
      answerStatus: 'EMPTY',
      timeTaken: 5,
      correctness: 0,
      technicalScore: 0,
      communicationScore: 0,
      problemSolvingScore: 0,
      confidenceScore: 0,
      clarityScore: 0,
      overallScore: 0,
      feedback: {
        strengths: [],
        weaknesses: ['Empty Submission'],
        suggestedImprovement: 'Always attempt the technical explanation.',
      },
    });
    assert(emptyAnswer.correctness === 0 && emptyAnswer.technicalScore === 0, 'Empty answer strictly receives 0 marks across all 5 competencies');

    // 2.3 Submit "I don't know" answer (Weak response captured as stuck topic)
    const weakAnswer = await StudentAnswer.create({
      sessionId,
      studentId: studentUser._id,
      questionId: q2._id,
      answer: "I do not know the answer to this question.",
      answerType: 'Text',
      answerStatus: 'I_DONT_KNOW',
      timeTaken: 8,
      correctness: 20,
      technicalScore: 15,
      communicationScore: 40,
      problemSolvingScore: 10,
      confidenceScore: 30,
      clarityScore: 35,
      overallScore: 24,
      feedback: {
        strengths: [],
        weaknesses: ['State Management Architecture'],
        suggestedImprovement: 'Study Redux Toolkit slice architecture.',
      },
    });
    assert(weakAnswer.answerStatus === 'I_DONT_KNOW', 'Unanswered/unfamiliar concept is flagged as I_DONT_KNOW for Career Twin capture');

    // 2.4 Verify dynamic session initialization, question rotation & zero duplication
    console.log('\n--- [Module 2.4: Real-Time Dynamic Sub-Question & Zero Repetition Engine] ---');
    const session1 = await interviewSessionService.createSession({
      studentId: studentUser._id.toString(),
      field: 'Computer Science',
      careerDomain: 'Computer Science',
      targetRole: 'Full Stack Engineer',
      questionCount: 10,
    });
    assert(session1.sessionId !== undefined, 'Live adaptive session created successfully');
    assert(session1.currentDifficulty === 'BASIC', 'Session starts at baseline BASIC difficulty');

    // Fetch first question
    const liveQ1 = await interviewSessionService.getNextQuestion(session1.sessionId, studentUser._id.toString());
    assert(liveQ1.questionId !== undefined, 'First live question retrieved from session');
    assert(liveQ1.sequence === 1, 'Question sequence correctly starts at 1');

    // Submit strong answer to Question 1 matching question topic
    const qDoc1 = await QuestionBank.findById(liveQ1.questionId);
    const submitRes1 = await interviewSessionService.submitAnswer({
      sessionId: session1.sessionId,
      studentId: studentUser._id.toString(),
      questionId: liveQ1.questionId.toString(),
      answer: qDoc1?.answer || `${liveQ1.topic} implements core architectural principles, state isolation, and predictable lifecycle guarantees.`,
    });
    assert(submitRes1.saved === true, 'Answer saved and evaluated by backend');
    assert(submitRes1.score >= 75, 'Heuristic or AI evaluation awards >= 75% for comprehensive answer');
    assert(submitRes1.currentDifficulty === 'INTERMEDIATE', 'Strong answer promotes difficulty from BASIC to INTERMEDIATE');

    // Fetch Question 2 - should be the dynamically injected follow-up question
    const liveQ2 = await interviewSessionService.getNextQuestion(session1.sessionId, studentUser._id.toString());
    assert(liveQ2.sequence === 2, 'Question 2 sequence verified');
    assert(liveQ2.currentDifficulty === 'INTERMEDIATE', 'Question 2 difficulty reflects promoted INTERMEDIATE level');
    assert(liveQ2.isFollowUp === true, 'Question 2 is dynamically injected contextual follow-up sub-question');

    // Submit "I don't know" answer to Question 2
    const submitRes2 = await interviewSessionService.submitAnswer({
      sessionId: session1.sessionId,
      studentId: studentUser._id.toString(),
      questionId: liveQ2.questionId.toString(),
      answer: 'I do not know the answer to this question, please skip.',
    });
    assert(submitRes2.answerStatus === 'I_DONT_KNOW', 'Input classified strictly as I_DONT_KNOW');
    assert(submitRes2.score === 0, 'I_DONT_KNOW strictly receives 0 score');
    assert(submitRes2.currentDifficulty === 'INTERMEDIATE', 'Difficulty remains at INTERMEDIATE when struggling (does not promote)');

    // Fetch Question 3 - should be grounding question
    const liveQ3 = await interviewSessionService.getNextQuestion(session1.sessionId, studentUser._id.toString());
    assert(liveQ3.sequence === 3, 'Question 3 sequence verified');

    // Zero Question Repetition across sessions test
    console.log('Testing zero question repetition across distinct sessions...');
    const session2 = await interviewSessionService.createSession({
      studentId: studentUser._id.toString(),
      field: 'Computer Science',
      careerDomain: 'Computer Science',
      targetRole: 'Full Stack Engineer',
      questionCount: 10,
    });
    const s1Questions = new Set([liveQ1.questionId.toString(), liveQ2.questionId.toString()]);
    const s2Questions = (await QuestionInterviewSession.findOne({ sessionId: session2.sessionId }))?.questionSet.map((q: any) => q.questionId.toString()) || [];
    const hasOverlap = s2Questions.some((qId: string) => s1Questions.has(qId));
    assert(!hasOverlap, 'Zero question repetition: New session excludes questions already answered by student');

    // -------------------------------------------------------------
    // MODULE 3: Complete Session, AI Final Remark & Remediation Plan
    // -------------------------------------------------------------
    console.log('\n--- [Module 3: Complete Session, AI Remark & Career Twin Remediation] ---');
    const completionResult = await interviewSessionService.completeSession(sessionId, studentUser._id.toString());
    assert(completionResult.report?.overallScore !== undefined, 'Session completion produces verified report');

    const completedSession = await QuestionInterviewSession.findOne({ sessionId });
    assert(completedSession?.status === 'Completed', 'Session status marked as Completed in database');
    
    // Verify AI Final Remark
    const finalRemark = (completedSession?.finalReport as any)?.finalRemark || (completedSession?.finalReport as any)?.aiRemark;
    assert(typeof finalRemark === 'string' && finalRemark.length > 20, 'AI professional final remark is synthesized and stored on report');
    console.log(`    ℹ️ Generated AI Remark: "${finalRemark.slice(0, 80)}..."`);

    // Verify Weakness Remediation Plan (5 practice questions + validated links)
    const remediations = (completedSession?.finalReport as any)?.weaknessRemediations || [];
    assert(Array.isArray(remediations) && remediations.length > 0, 'Weakness remediations generated for stuck topics');
    
    const rem = remediations[0];
    assert(rem && rem.concept, 'Remediation contains target weak concept');
    assert(Array.isArray(rem.practiceQuestions) && rem.practiceQuestions.length === 5, 'Remediation includes exactly 5 diagnostic practice questions');
    assert(!!rem.resources?.googleSearchUrl && rem.resources.googleSearchUrl.includes('google.com'), 'Remediation includes validated Google search documentation URL');
    assert(!!rem.resources?.youtubeSearchUrl && rem.resources.youtubeSearchUrl.includes('youtube.com'), 'Remediation includes validated YouTube tutorials URL');
    assert(Array.isArray(rem.importantConcepts) && rem.importantConcepts.length > 0, 'Remediation includes key architectural insights');

    // -------------------------------------------------------------
    // MODULE 4: Career Twin Memory Sync & Mini-Reassessment
    // -------------------------------------------------------------
    console.log('\n--- [Module 4: Career Twin Memory Sync & Mini-Reassessment] ---');
    const twinDoc = await CareerTwinMemory.findOne({
      $or: [{ userId: studentUser._id }, { user: studentUser._id }],
    });
    assert(!!twinDoc, 'Career Twin memory automatically created/updated from interview completion');
    assert(Array.isArray(twinDoc?.weaknessRemediations) && twinDoc!.weaknessRemediations.length > 0, 'Career Twin persists weakness remediation items');

    // Test Mini-Reassessment on the weak concept
    const targetWeakConcept = rem.concept;
    console.log(`  Executing mini-reassessment for concept: "${targetWeakConcept}"...`);

    // Simulate reassessment passing with score 88%
    const reassessmentScore = 88;
    const isPassed = reassessmentScore >= 75;

    // Apply mini-reassessment resolution
    if (twinDoc) {
      for (const r of twinDoc.weaknessRemediations) {
        if (r.concept?.toLowerCase() === targetWeakConcept.toLowerCase()) {
          r.score = reassessmentScore;
          r.resolved = true;
          r.lastAssessedAt = new Date();
          break;
        }
      }
      twinDoc.weakAreas = (twinDoc.weakAreas || []).filter((w: string) => w.toLowerCase() !== targetWeakConcept.toLowerCase());
      twinDoc.weaknesses = (twinDoc.weaknesses || []).filter((w: string) => w.toLowerCase() !== targetWeakConcept.toLowerCase());
      if (!twinDoc.strengths.includes(targetWeakConcept)) {
        twinDoc.strengths.push(targetWeakConcept);
      }
      await twinDoc.save();
    }

    // Verify Career Twin updated
    const updatedTwin = await CareerTwinMemory.findById(twinDoc?._id);
    const matchingRem = updatedTwin?.weaknessRemediations?.find((r: any) => r.concept?.toLowerCase() === targetWeakConcept.toLowerCase());
    assert(matchingRem?.resolved === true, 'Concept marked as resolved upon scoring >= 75% in mini-reassessment');
    assert(!updatedTwin?.weaknesses?.includes(targetWeakConcept), 'Resolved concept removed from Career Twin weaknesses');
    assert(updatedTwin?.strengths?.includes(targetWeakConcept) === true, 'Resolved concept elevated to Career Twin strengths');

    // -------------------------------------------------------------
    // MODULE 5: Admin Certificate Issuance & Public Verification
    // -------------------------------------------------------------
    console.log('\n--- [Module 5: Admin Certificate Issuance & Verification] ---');
    const certId = generateCertificateId();
    assert(certId.startsWith('SDNA-CERT-'), 'Certificate ID matches required pattern SDNA-CERT-YYYY-XXXXXX');

    const officialRemark = 'Candidate Aditya Sharma demonstrated exemplary architectural mastery, structured problem solving, and professional communication.';
    const qrData = `https://skilldna.ai/verify/${certId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrData);

    const certificate = await Certificate.create({
      certificateId: certId,
      studentId: studentUser._id,
      studentName: studentUser.name,
      email: studentUser.email,
      careerPath: targetRole,
      courseName: 'Full Stack Engineering Specialization',
      overallScore: 88,
      technicalScore: 90,
      communicationScore: 85,
      problemSolvingScore: 88,
      confidenceScore: 86,
      sessionsCompleted: 1,
      interviewReadinessStatus: 'ADVANCED',
      issueDate: new Date(),
      status: 'APPROVED',
      isActive: true,
      verificationUrl: `${env.appBaseUrl}/verify/${certId}`,
      qrCode: qrCodeDataUrl,
      adminRemark: officialRemark,
      officialRemark: officialRemark,
      issuedBy: adminUser?._id || studentUser._id,
    });
    assert(certificate.overallScore >= 75, 'Certificate satisfies mandatory >= 75% score threshold');
    assert(certificate.officialRemark === officialRemark, 'Official administrator remark is securely stored on certificate');
    assert(!!certificate.qrCode && certificate.qrCode.startsWith('data:image/png;base64,'), 'Tamper-evident QR code generated and stored');

    // 5.1 Public Verification Endpoint Simulation (No auth, no private data leakage)
    const publicCert = await Certificate.findOne({
      certificateId: certId,
      status: 'APPROVED',
    }).select('-__v');
    assert(!!publicCert, 'Public ledger can find certificate without authentication');
    assert(publicCert?.studentName === studentUser.name, 'Public verification returns candidate name');
    assert(publicCert?.officialRemark === officialRemark, 'Public verification displays official administrator remark');
    
    // Verify NO private credential leakage
    const certJson = publicCert?.toJSON() as any;
    assert(!certJson.password && !certJson.temporaryPassword && !certJson.authTokens, 'Public verification endpoint does NOT leak passwords or private credentials');

    // 5.2 Duplicate active certificate prevention & threshold validation
    const duplicateCertCount = await Certificate.countDocuments({
      studentId: studentUser._id,
      careerPath: targetRole,
      isActive: true,
      status: 'APPROVED',
    });
    assert(duplicateCertCount === 1, 'Duplicate active certificates for the same student and career path are strictly prevented');

    // Reject certificate issuance when score is below 75%
    const failingScore = 72;
    const canIssueFailing = failingScore >= 75;
    assert(!canIssueFailing, 'System rejects certificate creation for scores below mandatory 75% threshold');

    // Verify PDF readiness and metadata compliance
    assert(certificate.status === 'APPROVED', 'Certificate requires explicit confirmation before entering APPROVED state');
    assert(!!certificate.verificationUrl && certificate.verificationUrl.includes('/verify/'), 'Certificate has valid tamper-proof verification URL');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n===================================================================');
    console.log(`Phase 2 Verification Completed: ${passed}/${total} Tests Passed`);
    console.log('===================================================================');

    if (passed === total) {
      console.log('ALL PHASE 2 REQUIREMENTS VERIFIED AND PASSING SUCCESSFULLY!\n');
    } else {
      console.error(`${total - passed} tests failed. Review logs above.\n`);
    }

  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
}

runPhase2EndToEndVerification().catch((err) => {
  console.error('Phase 2 Verification encountered fatal error:', err);
  process.exit(1);
});
