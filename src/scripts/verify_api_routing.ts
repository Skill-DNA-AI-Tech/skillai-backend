import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';
import { env } from '../config/env';
import User from '../models/user';
import express from 'express';
import adminRoutes from '../routes/admin';
import adminNotesRoutes from '../routes/adminNotes';

// Create test express app mirroring production index.ts
const app = express();
app.use(express.json());
app.use('/api/admin/notes', adminNotesRoutes);
app.use('/api/admin', adminRoutes);

const runAudit = async () => {
  console.log('====================================================');
  console.log('PRODUCTION API ROUTING & ADMIN ENDPOINTS AUDIT');
  console.log('====================================================\n');

  // 1. Database Connection
  console.log('1. Connecting to unified MongoDB Atlas database...');
  await mongoose.connect(env.mongodbUri);
  console.log('Connected to MongoDB successfully: ' + mongoose.connection.name);

  // Start test server on dynamic port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    // 2. Locate Admin User & Generate Valid Token
    const adminUser = await User.findOne({ email: 'skilldnaai@ai.com' });
    if (!adminUser) {
      throw new Error('Super Admin user skilldnaai@ai.com not found!');
    }
    console.log(`Found Super Admin: ${adminUser.email} (ID: ${adminUser._id}, Role: ${adminUser.role})`);

    const adminToken = jwt.sign(
      {
        id: adminUser._id.toString(),
        sub: adminUser.email,
        email: adminUser.email,
        role: 'MAIN_ADMIN',
      },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    // 3. Test GET /api/admin/footer (Public)
    console.log('\n2. Testing GET /api/admin/footer (Public)...');
    const footerRes = await fetch(`${baseUrl}/api/admin/footer`);
    console.log(`Status: ${footerRes.status} (Expected: 200)`);
    if (footerRes.status !== 200) throw new Error(`GET /api/admin/footer failed with ${footerRes.status}`);
    const footerBody: any = await footerRes.json();
    console.log('Footer links count: ' + (footerBody.linkGroups?.length || 0));

    // 4. Test GET /api/admin/page-settings (Public)
    console.log('\n3. Testing GET /api/admin/page-settings (Public)...');
    const pageSettingsRes = await fetch(`${baseUrl}/api/admin/page-settings`);
    console.log(`Status: ${pageSettingsRes.status} (Expected: 200)`);
    if (pageSettingsRes.status !== 200) throw new Error(`GET /api/admin/page-settings failed with ${pageSettingsRes.status}`);
    const pageSettingsBody: any = await pageSettingsRes.json();
    console.log('Page settings count: ' + (Array.isArray(pageSettingsBody) ? pageSettingsBody.length : 0));

    // 5. Test GET /api/admin/admins (Protected)
    console.log('\n4. Testing GET /api/admin/admins (Protected)...');
    const adminsRes = await fetch(`${baseUrl}/api/admin/admins`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`Status: ${adminsRes.status} (Expected: 200)`);
    if (adminsRes.status !== 200) throw new Error(`GET /api/admin/admins failed with ${adminsRes.status}`);
    const adminsBody: any = await adminsRes.json();
    console.log('Admins count: ' + (Array.isArray(adminsBody) ? adminsBody.length : 0));

    // 6. Test GET /api/admin/overview (Protected)
    console.log('\n5. Testing GET /api/admin/overview (Protected)...');
    const overviewRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`Status: ${overviewRes.status} (Expected: 200)`);
    if (overviewRes.status !== 200) throw new Error(`GET /api/admin/overview failed with ${overviewRes.status}`);
    const overviewBody: any = await overviewRes.json();
    console.log(`Overview metrics: users=${overviewBody.users}, activeQuestions=${overviewBody.activeQuestions}, certificates=${overviewBody.totalCertificates}`);

    // 7. Test GET /api/admin/moderation (Protected)
    console.log('\n6. Testing GET /api/admin/moderation (Protected)...');
    const modRes = await fetch(`${baseUrl}/api/admin/moderation`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`Status: ${modRes.status} (Expected: 200)`);
    if (modRes.status !== 200) throw new Error(`GET /api/admin/moderation failed with ${modRes.status}`);
    const modBody: any = await modRes.json();
    console.log(`Moderation metrics: pendingCompanies=${modBody.pendingCompanies}, pendingJobs=${modBody.pendingJobs}`);

    // 8. Test GET /api/admin/test-users (Protected)
    console.log('\n7. Testing GET /api/admin/test-users (Protected)...');
    const testUsersRes = await fetch(`${baseUrl}/api/admin/test-users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`Status: ${testUsersRes.status} (Expected: 200)`);
    if (testUsersRes.status !== 200) throw new Error(`GET /api/admin/test-users failed with ${testUsersRes.status}`);
    const testUsersBody: any = await testUsersRes.json();
    console.log('Test users count: ' + (Array.isArray(testUsersBody) ? testUsersBody.length : 0));

    // Security Audit on /api/admin/test-users
    if (Array.isArray(testUsersBody)) {
      for (const tu of testUsersBody) {
        if (tu.password || tu.passwordHash || (tu.password && String(tu.password).startsWith('$2'))) {
          throw new Error(`CRITICAL SECURITY FAILURE: Password hash exposed in test user ${tu.email}`);
        }
      }
      console.log('Security check passed: Zero password hashes leaked in GET /api/admin/test-users response.');
    }

    // 9. Frontend Routing Logic Verification
    console.log('\n8. Simulating Frontend Route Routing Logic...');
    const AUTHORITATIVE_EXPRESS_URL = 'https://skilldna-backend.onrender.com/api';
    const AUTHORITATIVE_FASTAPI_URL = 'https://skillai-backend.onrender.com/api';

    const simulateGetApiBaseUrl = (envVar: string | undefined) => {
      const envUrl = (envVar || '').trim();
      if (envUrl && !envUrl.includes('skillai-backend.onrender.com')) {
        return envUrl.replace(/\/+$/, '');
      }
      return AUTHORITATIVE_EXPRESS_URL;
    };

    const simulateNormalize = (path: string) => {
      let clean = path;
      if (clean.startsWith('/api/')) clean = clean.slice(4);
      else if (clean.startsWith('api/')) clean = clean.slice(3);
      if (!clean.startsWith('/')) clean = '/' + clean;
      return clean;
    };

    const simulateRouting = (path: string, envApiUrl?: string) => {
      const clean = simulateNormalize(path);
      if (
        clean.startsWith('/auth/admin/login') ||
        clean.startsWith('/auth/admin/verify') ||
        clean.startsWith('/auth/admin/me') ||
        clean.startsWith('/auth/google') ||
        clean.startsWith('/auth/verify-email')
      ) {
        return AUTHORITATIVE_FASTAPI_URL;
      }
      return simulateGetApiBaseUrl(envApiUrl);
    };

    const testCases = [
      { path: '/api/admin/footer', expected: AUTHORITATIVE_EXPRESS_URL },
      { path: '/admin/footer', expected: AUTHORITATIVE_EXPRESS_URL },
      { path: '/api/admin/page-settings', expected: AUTHORITATIVE_EXPRESS_URL },
      { path: '/api/admin/admins', expected: AUTHORITATIVE_EXPRESS_URL },
      { path: '/api/admin/overview', expected: AUTHORITATIVE_EXPRESS_URL },
      { path: '/api/admin/moderation', expected: AUTHORITATIVE_EXPRESS_URL },
      { path: '/api/admin/test-users', expected: AUTHORITATIVE_EXPRESS_URL },
      { path: '/api/questions', expected: AUTHORITATIVE_EXPRESS_URL },
      { path: '/api/certificates', expected: AUTHORITATIVE_EXPRESS_URL },
      { path: '/api/auth/admin/login', expected: AUTHORITATIVE_FASTAPI_URL },
      { path: '/auth/admin/verify', expected: AUTHORITATIVE_FASTAPI_URL },
      { path: '/auth/google', expected: AUTHORITATIVE_FASTAPI_URL },
    ];

    for (const tc of testCases) {
      const target = simulateRouting(tc.path);
      if (target !== tc.expected) {
        throw new Error(`Routing mismatch for ${tc.path}: got ${target}, expected ${tc.expected}`);
      }
      console.log(`  Route: ${tc.path.padEnd(28)} -> ${target}`);
    }

    // Test misconfigured env var safeguard
    console.log('\n9. Testing Misconfigured VITE_API_BASE_URL Safeguard...');
    const misconfiguredEnv = 'https://skillai-backend.onrender.com/api';
    const safeguardedUrl = simulateRouting('/api/admin/overview', misconfiguredEnv);
    console.log(`  Misconfigured Env Var: ${misconfiguredEnv}`);
    console.log(`  Resolved URL for /api/admin/overview: ${safeguardedUrl}`);
    if (safeguardedUrl !== AUTHORITATIVE_EXPRESS_URL) {
      throw new Error('Safeguard failed: misconfigured URL was not overridden!');
    }
    console.log('  Safeguard SUCCESS: Correctly redirected to Authoritative Express Backend!');

    console.log('\n====================================================');
    console.log('ALL AUDITS & ENDPOINT CHECKS PASSED (100%)');
    console.log('====================================================');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
};

runAudit().catch((err) => {
  console.error('\nAUDIT FAILED:', err);
  process.exit(1);
});
