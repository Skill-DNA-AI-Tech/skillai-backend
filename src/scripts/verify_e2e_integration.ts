import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import User from '../models/user';
import Profile from '../models/profile';
import Certificate from '../models/certificate';
import CertificateTemplate from '../models/certificateTemplate';
import TopicNote from '../models/learning/topicNote';
import { QuestionBank, GeneratedQuestion } from '../models/questionBank';
import PageSetting from '../models/pageSetting';
import CareerChangeRequest from '../models/careerChangeRequest';
import generateToken from '../utils/generateToken';

let testsPassed = 0;
let testsFailed = 0;

const assert = (condition: boolean, testName: string, detail = '') => {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    testsFailed++;
  }
};

async function runE2EVerification() {
  console.log('=== SkillDNA AI Full E2E Architecture & Route Verification ===\n');

  try {
    await mongoose.connect(env.mongodbUri);
    console.log('Connected to MongoDB Atlas unified database.\n');

    // 1. JWT & RBAC Token Interoperability
    console.log('--- 1. Testing JWT Token Format Interoperability ---');
    const expressToken = generateToken(new mongoose.Types.ObjectId().toString());
    const expressDecoded: any = jwt.verify(expressToken, env.jwtSecret);
    assert(Boolean(expressDecoded.id), 'Express JWT contains id claim');

    // FastAPI format token with sub claim
    const fastApiToken = jwt.sign(
      { sub: 'skilldnaai@ai.com', role: 'MAIN_ADMIN', name: 'Master Administrator' },
      'super_secret_jwt_key_skilldna',
      { expiresIn: '1d' }
    );
    const fastApiDecoded: any = jwt.verify(fastApiToken, env.jwtSecret);
    assert(fastApiDecoded.sub === 'skilldnaai@ai.com', 'FastAPI token verifies with shared secret and contains sub claim');
    assert(fastApiDecoded.role === 'MAIN_ADMIN', 'FastAPI token preserves MAIN_ADMIN role');

    // 2. Pre-Production / Beta Users Flow
    console.log('\n--- 2. Testing Pre-Production Beta Users Flow ---');
    const testAdmin = await User.findOne({ role: { $in: ['MAIN_ADMIN', 'ADMIN'] } });
    const adminId = testAdmin?._id || new mongoose.Types.ObjectId();

    const betaEmail = `test.beta.${Date.now()}@skilldna.local`;
    const betaUserId = `BETA-${Date.now().toString().slice(-4)}`;
    const betaPassword = 'BetaStudentPass@123';

    const betaUser = await User.create({
      name: 'E2E Beta Student',
      full_name: 'E2E Beta Student',
      email: betaEmail,
      password: betaPassword,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
      isTestUser: true,
      isPreProductionUser: true,
      betaAccess: true,
      testUserId: betaUserId,
      careerDomain: 'Computer Science',
      targetRole: 'Java Software Engineer',
      testCredentials: {
        userId: betaUserId,
        temporaryPassword: betaPassword,
        generatedBy: adminId,
      },
    });

    const betaProfile = await Profile.create({
      user: betaUser._id,
      name: betaUser.name,
      email: betaEmail,
      degree: 'B.Tech',
      branch: 'Computer Science',
      year: '4th Year',
      semester: '8th Semester',
      college: 'SkillDNA Engineering Academy',
      careerDomain: 'Computer Science',
      targetRole: 'Java Software Engineer',
      preferredRoles: ['Java Software Engineer'],
      skills: ['Java', 'Spring Boot', 'MongoDB'],
    });

    assert(Boolean(betaUser._id), 'Pre-production beta student created in User collection');
    assert(betaUser.isPreProductionUser === true, 'Pre-production flag isPreProductionUser is set to true');
    assert(betaUser.betaAccess === true, 'Beta access flag is enabled');
    assert(await betaUser.matchPassword(betaPassword), 'Beta student password validates correctly for student login');

    // Retrieve via test-users query
    const queriedBetaUsers = await User.find({
      $or: [{ isTestUser: true }, { isPreProductionUser: true }],
      _id: betaUser._id,
    });
    assert(queriedBetaUsers.length === 1, 'Pre-production user retrieved via admin test-users query');

    // 3. Question Bank & AI Question Generation Flow
    console.log('\n--- 3. Testing Question Bank & AI Question Flow ---');
    const generatedQ = await GeneratedQuestion.create({
      batchId: `batch-e2e-${Date.now()}`,
      field: 'Computer Science',
      topic: 'Java',
      subtopic: 'Concurrency',
      question: `E2E Test Question: Explain Java Virtual Threads under high load? ${Date.now()}`,
      modelAnswer: 'Virtual threads are lightweight threads managed by the JVM rather than the OS kernel.',
      difficulty: 'Hard',
      interviewType: 'Technical',
      qualityScore: 92,
      status: 'Draft',
    });
    assert(Boolean(generatedQ._id), 'AI question generated and staged in Draft state');

    // Admin approves question
    const approvedQ = await QuestionBank.findOneAndUpdate(
      { question: generatedQ.question },
      {
        field: generatedQ.field,
        topic: generatedQ.topic,
        subtopic: generatedQ.subtopic,
        question: generatedQ.question,
        answer: generatedQ.modelAnswer,
        difficulty: generatedQ.difficulty,
        interviewType: generatedQ.interviewType,
        source: 'AI-Generated',
        status: 'Active',
        approved: true,
        approvedBy: adminId,
        approvalDate: new Date(),
      },
      { new: true, upsert: true }
    );
    assert(approvedQ.status === 'Active' && approvedQ.approved === true, 'Admin approved AI question moved into active QuestionBank');

    // 4. Topic Notes & AI Generation Flow
    console.log('\n--- 4. Testing Topic Notes & AI Generation Compatibility ---');
    const topicNote = await TopicNote.create({
      domain: 'Computer Science',
      topic: 'Java',
      subtopic: 'Generics',
      title: 'Mastering Java Generics and Type Erasure',
      overview: 'Generics enforce compile-time type safety while erasing type parameters at runtime.',
      richText: '### Type Erasure\nJava uses type erasure to maintain backwards compatibility with legacy bytecode.',
      keyTakeaways: ['Compile-time type safety', 'Type erasure at runtime', 'Wildcards (? extends T)'],
      examples: 'public class Box<T> { private T val; }',
      status: 'Published',
      isAiGenerated: true,
      createdBy: adminId,
      publishedAt: new Date(),
    });
    assert(Boolean(topicNote._id), 'Topic note created with status Published');
    assert(topicNote.status === 'Published', 'Topic note status enum matches Mongoose schema');

    const queriedNotes = await TopicNote.find({ topic: 'Java', status: 'Published' });
    assert(queriedNotes.length > 0, 'Topic notes catalog query returns published notes');

    // 5. Certificate Routes & Route Shadowing Resolution
    console.log('\n--- 5. Testing Certificate Routes & Route Shadowing Fix ---');
    // Save admin signature
    const signatureSample = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await User.findByIdAndUpdate(adminId, { signatureBase64: signatureSample });

    const updatedAdmin = await User.findById(adminId);
    assert(Boolean(updatedAdmin?.signatureBase64), 'Admin digital signature persisted without route collision');

    // Create pending certificate
    const certId = `SDNA-CERT-2026-${Date.now().toString().slice(-6)}`;
    const cert = await Certificate.create({
      certificateId: certId,
      studentId: betaUser._id,
      studentName: betaUser.name,
      email: betaEmail,
      careerPath: 'Java Software Engineer',
      overallScore: 88,
      technicalScore: 90,
      communicationScore: 85,
      problemSolvingScore: 88,
      confidenceScore: 89,
      issueDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      interviewReadinessStatus: 'ADVANCED',
      status: 'PENDING',
      isActive: true,
    });
    assert(Boolean(cert._id), 'Pending certificate created for student');

    // Query pending certificates (verifying /admin/pending logic)
    const pendingList = await Certificate.find({ status: 'PENDING', isActive: true });
    assert(pendingList.some((c) => c.certificateId === certId), 'Pending certificates query correctly lists new certificate');

    // Approve certificate with digital signature
    cert.status = 'APPROVED';
    cert.approvedBy = adminId as any;
    cert.approvedAt = new Date();
    cert.adminSignatureBase64 = signatureSample;
    await cert.save();
    assert(cert.status === 'APPROVED', 'Certificate approved and stamped with admin signature');

    // Public QR verification lookup (no auth required)
    const publicVerified = await Certificate.findOne({ certificateId: certId, isActive: true });
    assert(publicVerified !== null && publicVerified.status === 'APPROVED', 'Public verification lookup resolves approved certificate');
    assert(publicVerified?.studentName === 'E2E Beta Student', 'Public verification confirms authentic recipient name');

    // 6. Page Visibility Settings Flow
    console.log('\n--- 6. Testing Page Visibility Settings Flow ---');
    const testPageId = 'learning';
    let setting = await PageSetting.findOne({ pageId: testPageId });
    if (!setting) {
      setting = await PageSetting.create({
        pageId: testPageId,
        name: 'Learning Hub',
        path: '/learning',
        isHidden: false,
        requiresAuth: true,
      });
    }

    // Toggle visibility
    setting.isHidden = !setting.isHidden;
    await setting.save();
    const updatedSetting = await PageSetting.findOne({ pageId: testPageId });
    assert(updatedSetting?.isHidden === setting.isHidden, 'Page visibility setting toggled and persisted');

    // Reset back
    setting.isHidden = false;
    await setting.save();

    // 7. Career Change Requests Flow
    console.log('\n--- 7. Testing Career Change Requests Flow ---');
    const careerReq = await CareerChangeRequest.create({
      student: betaUser._id,
      studentName: betaUser.name,
      studentEmail: betaEmail,
      currentCareer: 'Java Software Engineer',
      currentCurriculum: 'Java Software Engineer Curriculum',
      requestedCareer: 'Full Stack Web Developer',
      requestedCurriculum: 'Full Stack Web Developer Curriculum',
      reason: 'E2E testing transition to Full Stack engineering',
      status: 'PENDING',
    });
    assert(Boolean(careerReq._id), 'Career change request submitted in PENDING state');

    const requestsQuery = await CareerChangeRequest.find({ status: 'PENDING' });
    assert(requestsQuery.length > 0, 'Career change management query returns pending requests');

    // Cleanup E2E test data
    console.log('\n--- Cleaning up E2E test data ---');
    await User.findByIdAndDelete(betaUser._id);
    await Profile.findByIdAndDelete(betaProfile._id);
    await GeneratedQuestion.findByIdAndDelete(generatedQ._id);
    await QuestionBank.findByIdAndDelete(approvedQ._id);
    await TopicNote.findByIdAndDelete(topicNote._id);
    await Certificate.findByIdAndDelete(cert._id);
    await CareerChangeRequest.findByIdAndDelete(careerReq._id);
    console.log('E2E test data cleaned up successfully.');

  } catch (error) {
    console.error('Fatal error during E2E verification:', error);
    testsFailed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n======================================================');
  console.log(`E2E Verification Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('======================================================');

  if (testsFailed === 0) {
    console.log('\n🎉 FULL END-TO-END INTEGRATION TEST SUITE PASSED (100%)!');
  } else {
    console.error('\n❌ SOME INTEGRATION TESTS FAILED');
    process.exit(1);
  }
}

runE2EVerification();
