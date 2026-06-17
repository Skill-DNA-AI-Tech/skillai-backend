import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const generateToken = (id: string) => {
  return jwt.sign({ id }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as any,
  });
};

export default generateToken;
