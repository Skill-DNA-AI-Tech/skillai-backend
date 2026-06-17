import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  aiServiceUrl: process.env.AI_SERVICE_URL ?? '',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:4173',
  backendBaseUrl: process.env.BACKEND_BASE_URL ?? 'http://localhost:5000',
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqApiUrl: process.env.GROQ_API_URL ?? 'https://api.groq.com/openai/v1',
  groqMaxRetries: numberFromEnv(process.env.GROQ_MAX_RETRIES, 2),
  groqModel: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
  jwtSecret: process.env.JWT_SECRET ?? 'skilldna-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/skilldna',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: numberFromEnv(process.env.PORT, 5000),
};
