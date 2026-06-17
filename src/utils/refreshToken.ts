import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import RefreshToken from '../models/refreshToken';
import { env } from '../config/env';

type RefreshPayload = {
  id: string;
  type: 'refresh';
};

const refreshSecret = () => process.env.JWT_REFRESH_SECRET ?? `${env.jwtSecret}:refresh`;
const refreshTtlDays = () => Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 30);

export const hashRefreshToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const createRefreshToken = async (userId: string, ip = '') => {
  const expiresInDays = refreshTtlDays();
  const token = jwt.sign(
    { id: userId, type: 'refresh', nonce: crypto.randomBytes(16).toString('hex') },
    refreshSecret(),
    { expiresIn: `${expiresInDays}d` }
  );
  await RefreshToken.create({
    user: userId,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    createdByIp: ip,
  });

  return token;
};

export const verifyRefreshToken = async (token: string) => {
  const decoded = jwt.verify(token, refreshSecret()) as RefreshPayload;
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }

  const tokenRecord = await RefreshToken.findOne({ tokenHash: hashRefreshToken(token), revokedAt: { $exists: false } });
  if (!tokenRecord || tokenRecord.expiresAt.getTime() < Date.now()) {
    throw new Error('Refresh token expired or revoked');
  }

  return { userId: decoded.id, tokenRecord };
};

export const revokeRefreshToken = async (token: string) => {
  await RefreshToken.findOneAndUpdate(
    { tokenHash: hashRefreshToken(token), revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  );
};
