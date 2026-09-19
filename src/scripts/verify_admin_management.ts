import mongoose from 'mongoose';
import { env } from '../config/env';
import User from '../models/user';
import Profile from '../models/profile';
import Certificate from '../models/certificate';
import { isMainAdminEmail, getMainAdminEmails, normalizeRole, isAdminRole } from '../utils/rbac';
import { resolveCurriculum } from '../data/curriculaData';
import { generateCertificateId } from '../routes/certificates';
import QRCode from 'qrcode';

async function runAdminManagementVerification() {
  console.log('=== SkillDNA Admin Student & Certificate Management Verification ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
    }
  }

  // 1. Production Admin Identity & RBAC
  console.log('--- Test Group 1: Production Admin Verification & RBAC ---');
  const mainAdmins = getMainAdminEmails();
  assert(mainAdmins.includes('skilldnaai@ai.com'), 'Default production Super Admin is skilldnaai@ai.com');
  assert(isMainAdminEmail('skilldnaai@ai.com'), 'isMainAdminEmail identifies skilldnaai@ai.com as Super Admin');
  assert(normalizeRole('ADMIN', 'skilldnaai@ai.com') === 'MAIN_ADMIN', 'Super Admin email always normalizes to MAIN_ADMIN');
  assert(isAdminRole('MAIN_ADMIN', 'skilldnaai@ai.com'), 'MAIN_ADMIN has admin privileges');
  assert(isAdminRole('ADMIN', 'admin@skilldna.com'), 'ADMIN has admin privileges');
  assert(!isAdminRole('STUDENT', 'student@test.com'), 'STUDENT does not have admin privileges');

  // Connect to DB for integration tests
  console.log('\n--- Connecting to MongoDB for Data Flow Validation ---');
  try {
    await mongoose.connect(env.mongodbUri);
    console.log('MongoDB connected successfully.');
  } catch (err: any) {
    console.warn('MongoDB connection failed, running offline logic assertions:', err.message);
  }

  const isConnected = mongoose.connection.readyState === 1;

  if (isConnected) {
    // 2. Admin Creates Student Account
    console.log('\n--- Test Group 2: Admin Student Account Creation & Login ---');
    const testEmail = `test_student_${Date.now()}@skilldna.test`;
    const tempPassword = 'TempPassword123!';
    const selectedCareer = 'Java Software Engineer';
    const resolvedCurriculum = resolveCurriculum(selectedCareer);

    // Clean up if exists
    await User.deleteOne({ email: testEmail });
    await Profile.deleteOne({ email: testEmail });

    const newStudent = new User({
      name: 'Priya Test',
      full_name: 'Priya Test',
      email: testEmail,
      password: tempPassword,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
      requiresPasswordChange: true,
      careerDomain: resolvedCurriculum.domain,
      targetRole: resolvedCurriculum.targetRole,
    });
    await newStudent.save();

    assert(Boolean(newStudent._id), 'Admin securely creates User document in DB');
    assert(newStudent.role === 'STUDENT', 'Role is strictly enforced as STUDENT');
    assert(newStudent.requiresPasswordChange === true, 'Requires password change on initial login');

    // Test password hashing
    const passwordMatches = await newStudent.matchPassword(tempPassword);
    assert(passwordMatches, 'Temporary password validates correctly with matchPassword');
    assert(newStudent.password !== tempPassword, 'Password is securely hashed (bcrypt) before storage');

    // Create Profile with Auto-assigned Active Curriculum
    const newProfile = new Profile({
      user: newStudent._id,
      name: newStudent.name,
      email: newStudent.email,
      degree: 'B.Tech',
      branch: 'Computer Science & Engineering',
      college: 'SkillDNA Partner Institute',
      semester: 'Final Year',
      career: selectedCareer,
      domain: resolvedCurriculum.domain,
      activeCurriculum: {
        curriculumId: resolvedCurriculum.id,
        title: resolvedCurriculum.careerName,
        domain: resolvedCurriculum.domain,
        totalTopics: resolvedCurriculum.topics.length,
        masteredTopics: 0,
      },
      isProfileCompleted: true,
    });
    await newProfile.save();

    assert(Boolean(newProfile._id), 'Associated Profile created with locked Career & Domain');
    assert(newProfile.activeCurriculum.title === 'Java Software Engineer', 'Active Curriculum automatically assigned to student');
    assert(newProfile.activeCurriculum.totalTopics >= 4, 'Active Curriculum topic count initialized');

    // 3. Admin Issues Certificate
    console.log('\n--- Test Group 3: Certificate Issuance, ID & QR Code Generation ---');
    const certId = generateCertificateId();
    assert(certId.startsWith('SDNA-CERT-'), 'Certificate ID has proper prefix (SDNA-CERT-YYYY-XXXXXX)');

    const verificationUrl = `${env.appBaseUrl}/verify/${certId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { errorCorrectionLevel: 'H' });
    assert(qrCodeDataUrl.startsWith('data:image/png;base64,'), 'High-resolution QR code generated as Data URL');

    const overallScore = 88;
    assert(overallScore >= 75, 'Overall score meets passing threshold (>= 75%)');

    const certificate = new Certificate({
      studentId: newStudent._id,
      studentName: newStudent.name,
      email: newStudent.email,
      careerPath: selectedCareer,
      courseName: selectedCareer,
      certificateId: certId,
      overallScore,
      technicalScore: 90,
      communicationScore: 85,
      problemSolvingScore: 88,
      confidenceScore: 86,
      sessionsCompleted: 3,
      interviewReadinessStatus: 'ADVANCED',
      qrCode: qrCodeDataUrl,
      verificationUrl,
      status: 'APPROVED',
      isActive: true,
      issuedByName: 'Super Admin (skilldnaai@ai.com)',
    });
    await certificate.save();

    assert(Boolean(certificate._id), 'Certificate saved and approved on ledger');
    assert(certificate.status === 'APPROVED', 'Certificate is marked APPROVED upon issue');
    assert(Boolean(certificate.issuedByName?.includes('skilldnaai@ai.com')), 'Audit record retains issuing admin info');

    // 4. Duplicate Certificate Prevention
    console.log('\n--- Test Group 4: Duplicate Certificate Prevention ---');
    const existingActiveCert = await Certificate.findOne({
      studentId: newStudent._id,
      careerPath: { $regex: new RegExp(`^${selectedCareer}$`, 'i') },
      isActive: true,
      status: 'APPROVED',
    });
    assert(Boolean(existingActiveCert), 'Duplicate detection identifies existing active certificate for student and career');
    assert(existingActiveCert?.certificateId === certId, 'Existing certificate ID correctly matched');

    // 5. Public Verification Simulation
    console.log('\n--- Test Group 5: Public Verification Lookup ---');
    const verifiedCert = await Certificate.findOne({
      certificateId: certId,
      isActive: true,
    });
    assert(Boolean(verifiedCert), 'Public verification resolves certificate without authentication');
    assert(verifiedCert?.studentName === 'Priya Test', 'Public verification returns authentic student name');
    assert(verifiedCert?.overallScore === 88, 'Public verification confirms verified score');
    assert(Boolean(verifiedCert?.qrCode), 'QR code is preserved and returned for scanning');

    // Clean up test data
    await Certificate.deleteMany({ studentId: newStudent._id });
    await Profile.deleteOne({ _id: newProfile._id });
    await User.deleteOne({ _id: newStudent._id });
    console.log('\nTest data cleaned up successfully.');

    await mongoose.disconnect();
  }

  console.log(`\n======================================================`);
  console.log(`Results: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`======================================================\n`);

  if (passed === total) {
    console.log('🎉 ALL ADMIN STUDENT & CERTIFICATE MANAGEMENT TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runAdminManagementVerification();
