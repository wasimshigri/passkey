import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
    },
    env.jwtSecret,
    {
      expiresIn: '7d',
    },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
