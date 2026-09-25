import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import User from '../models/user';

// List of common candidate / seed passwords across the platform to test against bcrypt hashes
const CANDIDATE_PASSWORDS = [
  'Admin@12345',
  'Admin@123',
  'Admin123!',
  'Admin123',
  'admin@123',
  'admin123',
  'SkillDNA2026!',
  'Skilldna@2026',
  'Skilldna123!',
  'Skilldna@123',
  'skilldna@123',
  'skilldna123',
  'skilldna',
  'skilldnaai',
  'skilldnaai@123',
  'skilldnaai@ai.com',
  'Ajay@1711',
  'ajay@1711',
  'Ajay1711',
  'ajay1711',
  'Ajay@17',
  'ajay@17',
  'Ajay@123',
  'ajay@123',
  'SecureStudentPassword2026!',
  'BetaStudentPass@123',
  'BetaStudentPassword@2026',
  'Student@123',
  'Student123!',
  'Password123!',
  'password123',
  'password',
  '123456',
  '12345678',
  'TestUser@123',
  'TestPass123!',
  'Recruiter@123',
  'Support@123',
  'admin',
  'superadmin',
  'masteradmin',
  'morepatil@gmail.com',
];

async function checkAllUsers() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(env.mongodbUri);
  console.log('Connected to MongoDB.\n');

  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  console.log(`Total users found in database: ${users.length}\n`);
  console.log('========================================================================================');
  console.log('USER AUDIT & PASSWORD INTEGRITY REPORT');
  console.log('========================================================================================\n');

  const results = [];

  for (const u of users) {
    const hash = u.password || '';
    const hasValidBcrypt = hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
    let recoveredPassword = u.testCredentials?.temporaryPassword || null;

    if (!recoveredPassword && hasValidBcrypt) {
      for (const candidate of CANDIDATE_PASSWORDS) {
        try {
          if (bcrypt.compareSync(candidate, hash)) {
            recoveredPassword = candidate;
            break;
          }
        } catch {
          // ignore error
        }
      }
    }

    results.push({
      id: u._id.toString(),
      name: u.name || u.full_name || 'N/A',
      email: u.email,
      role: u.role,
      status: u.status,
      isTestUser: !!(u.isTestUser || u.isPreProductionUser),
      hasPassword: !!u.password,
      passwordType: hasValidBcrypt ? 'Bcrypt Hash (Secure)' : (hash ? 'Non-Bcrypt / Plain' : 'No Password (OAuth)'),
      recoveredOrTempPassword: recoveredPassword || (hasValidBcrypt ? '[Secure Bcrypt Hash - Not in common dictionary]' : '[None]'),
      passwordHashPreview: hash ? `${hash.slice(0, 15)}...${hash.slice(-8)}` : 'None',
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : 'Unknown',
    });
  }

  // Group by Role
  const byRole: Record<string, typeof results> = {};
  for (const r of results) {
    if (!byRole[r.role]) byRole[r.role] = [];
    byRole[r.role].push(r);
  }

  for (const [role, list] of Object.entries(byRole)) {
    console.log(`\n### ROLE: ${role} (${list.length} accounts)`);
    console.log('----------------------------------------------------------------------------------------');
    for (const item of list) {
      console.log(`- Email: ${item.email}`);
      console.log(`  Name: ${item.name}`);
      console.log(`  Status: ${item.status} | Test/Pre-prod: ${item.isTestUser}`);
      console.log(`  Password Type: ${item.passwordType}`);
      console.log(`  Password / Temp Password: ${item.recoveredOrTempPassword}`);
      console.log(`  Hash Preview: ${item.passwordHashPreview}`);
      console.log(`  Created: ${item.createdAt}`);
      console.log('');
    }
  }

  console.log('========================================================================================');
  console.log('AUDIT SUMMARY');
  console.log('========================================================================================');
  console.log(`Total Accounts: ${results.length}`);
  for (const [role, list] of Object.entries(byRole)) {
    console.log(`  - ${role}: ${list.length}`);
  }
  const secureBcryptCount = results.filter(r => r.passwordType.includes('Bcrypt')).length;
  console.log(`Secure Bcrypt Hashed Passwords: ${secureBcryptCount} / ${results.length}`);
  console.log(`OAuth / No Password Accounts: ${results.filter(r => !r.hasPassword).length}`);

  await mongoose.disconnect();
}

checkAllUsers().catch(err => {
  console.error('Check users failed:', err);
  process.exit(1);
});
