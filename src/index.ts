import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import authRoutes from './routes/auth';
import feedbackRoutes from './routes/feedback';
import profileRoutes from './routes/profile';
import reportRoutes from './routes/reports';
import jobRoutes from './routes/jobs';
import learningRoutes from './routes/learning';
import interviewRoutes from './routes/interviews';
import resumeRoutes from './routes/resume';
import recruiterRoutes from './routes/recruiters';
import communityRoutes from './routes/community';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/notifications';
import aiRoutes from './routes/ai';
import questionRoutes from './routes/questions';
import careerTwinRoutes from './routes/careerTwin';
import certificateRoutes from './routes/certificates';
import studentRoutes from './routes/student';
import mcqRoutes from './routes/mcq';
import careerChangeRoutes from './routes/careerChange';
import adminNotesRoutes from './routes/adminNotes';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/error';
import { seedQuestions, seedPageSettings } from './utils/seeder';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.options('*', cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/recruiters', recruiterRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/admin/notes', adminNotesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/career-twin', careerTwinRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/mcq', mcqRoutes);
app.use('/api/career-change-requests', careerChangeRoutes);

// Public Certificate Verification Endpoint (No login required for QR scans)
app.get('/api/verify/:certificateId', async (req, res) => {
  try {
    const Certificate = mongoose.models.Certificate || mongoose.model('Certificate');
    const certificate = await Certificate.findOne({
      certificateId: req.params.certificateId,
      isActive: true,
    });

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found or has been revoked', valid: false, verified: false });
      return;
    }

    if (certificate.status !== 'APPROVED') {
      res.status(400).json({ error: 'This certificate is not officially approved yet.', valid: false, verified: false });
      return;
    }

    if (certificate.expiryDate && new Date() > new Date(certificate.expiryDate)) {
      res.status(410).json({ error: 'Certificate has expired', valid: false, verified: false, certificate });
      return;
    }

    res.json({
      message: 'Certificate is authentic and valid',
      valid: true,
      verified: true,
      certificate,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Verification failed', valid: false, verified: false });
  }
});

const healthPayload = () => ({
  status: 'healthy',
  service: 'SkillDNA Tech AI Authoritative Application Backend',
  version: '1.0.0',
  uptime: process.uptime(),
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  timestamp: new Date().toISOString(),
});

app.get('/health', (req, res) => res.json(healthPayload()));
app.get('/api/health', (req, res) => res.json(healthPayload()));

app.get('/', (req, res) => {
  res.json({
    message: 'SkillDNA AI backend is running',
    modules: [
      'auth',
      'profiles',
      'learning',
      'interviews',
      'resume',
      'reports',
      'jobs',
      'recruiters',
      'community',
      'admin',
      'notifications',
      'ai',
      'career-twin',
    ],
    realtime: '/ws',
  });
});

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'connected', message: 'SkillDNA realtime channel ready' }));

  socket.on('message', (raw) => {
    const message = raw.toString();
    socket.send(JSON.stringify({ type: 'echo', message }));
  });
});

app.use(notFound);
app.use(errorHandler);

mongoose
  .connect(env.mongodbUri)
  .then(async () => {
    console.log('MongoDB connected');
    await seedQuestions();
    await seedPageSettings();
    server.listen(env.port, () => console.log(`Server listening on http://localhost:${env.port}`));
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  });
