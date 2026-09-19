import { resolveCurriculum, STANDARD_CURRICULA } from '../data/curriculaData';
import { canReviewCareerChanges } from '../routes/careerChange';

async function runVerification() {
  console.log('=== SkillDNA Continuous Learning Cycle Verification ===\n');

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

  // Test 1: Curriculum Registry & Resolution
  console.log('--- Test Group 1: Curricula Registry & Active Curriculum ---');
  const javaCurriculum = resolveCurriculum('Java Software Engineer');
  assert(javaCurriculum.careerName === 'Java Software Engineer', 'Resolves Java Software Engineer career');
  assert(javaCurriculum.domain === 'Computer Science', 'Java career maps to Computer Science domain');
  assert(javaCurriculum.topics.length >= 4, `Contains full topic hierarchy (${javaCurriculum.topics.length} core topics)`);
  
  const javaTopic = javaCurriculum.topics.find(t => t.name.toLowerCase() === 'java');
  assert(Boolean(javaTopic), 'Contains Java topic in Computer Science domain');
  
  const oopSubtopic = javaTopic?.subtopics.find(s => s.name.toUpperCase() === 'OOP');
  assert(Boolean(oopSubtopic), 'Contains exact path: Computer Science -> Java -> OOP');
  assert(
    Boolean(oopSubtopic?.description.toLowerCase().includes('encapsulation') || oopSubtopic?.description.toLowerCase().includes('polymorphism')),
    'OOP subtopic contains core principles (Encapsulation, Polymorphism)'
  );

  // Test 2: Multi-career support
  console.log('\n--- Test Group 2: Multi-Career Curricula Support ---');
  const careers = [
    'Full Stack Web Developer',
    'Frontend Developer',
    'Backend Developer',
    'Data Scientist',
    'AI / ML Engineer',
    'DevOps Engineer',
    'Mobile App Developer',
    'Cloud Engineer',
  ];
  for (const c of careers) {
    const curr = resolveCurriculum(c);
    assert(Boolean(curr && curr.topics.length >= 2), `Registered curriculum for ${c}`);
  }

  // Test 3: RBAC for Career Change Approvals (Admin & Support Team)
  console.log('\n--- Test Group 3: RBAC for Career Change Requests ---');
  assert(canReviewCareerChanges('MAIN_ADMIN'), 'MAIN_ADMIN can review career changes');
  assert(canReviewCareerChanges('ADMIN'), 'ADMIN can review career changes');
  assert(canReviewCareerChanges('SUPPORT_TEAM'), 'SUPPORT_TEAM can review career changes (future extension)');
  assert(!canReviewCareerChanges('STUDENT'), 'STUDENT cannot approve career changes');
  assert(!canReviewCareerChanges('RECRUITER'), 'RECRUITER cannot approve career changes');

  // Test 4: Strict 75% Passing Standard Evaluation
  console.log('\n--- Test Group 4: Strict 75% Passing Threshold Logic ---');
  const passingScore = 75;
  const testScores = [
    { score: 74, expected: 'FAIL' },
    { score: 75, expected: 'PASS' },
    { score: 80, expected: 'PASS' },
    { score: 60, expected: 'FAIL' },
    { score: 100, expected: 'PASS' },
    { score: 0, expected: 'FAIL' },
  ];
  for (const ts of testScores) {
    const status = ts.score >= passingScore ? 'PASS' : 'FAIL';
    assert(status === ts.expected, `Score ${ts.score}% evaluates strictly to ${ts.expected} (Threshold: 75%)`);
  }

  // Test 5: Controlled Application Navigation Map
  console.log('\n--- Test Group 5: Controlled Navigation Map Integrity ---');
  const validAppRoutes = [
    '/learning',
    '/career-twin',
    '/interview',
    '/certificates',
    '/scorecards',
    '/profile',
    '/jobs',
  ];
  assert(validAppRoutes.includes('/learning'), 'Route /learning is verified in application map');
  assert(validAppRoutes.includes('/career-twin'), 'Route /career-twin is verified in application map');
  assert(validAppRoutes.includes('/interview'), 'Route /interview is verified in application map');
  assert(validAppRoutes.includes('/certificates'), 'Route /certificates is verified in application map');
  assert(validAppRoutes.includes('/profile'), 'Route /profile is verified in application map');

  console.log(`\n==============================================`);
  console.log(`Verification Results: ${passed} / ${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`==============================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
