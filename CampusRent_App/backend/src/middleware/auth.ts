import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'campusrent-dev-secret-change-in-production';

export interface AuthUser {
  id: number;
  email: string;
  role: 'student' | 'admin';
  verification_status: 'pending' | 'verified' | 'rejected';
  status: 'active' | 'suspended';
  first_name: string;
  last_name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: number; email: string; role: string }) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { id: number };
    const user = db
      .prepare(
        `SELECT id, email, role, verification_status, status, first_name, last_name
         FROM users WHERE id = ?`
      )
      .get(payload.id) as AuthUser | undefined;

    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { id: number };
    const user = db
      .prepare(
        `SELECT id, email, role, verification_status, status, first_name, last_name
         FROM users WHERE id = ?`
      )
      .get(payload.id) as AuthUser | undefined;
    if (user && user.status !== 'suspended') req.user = user;
  } catch {
    /* guest continues */
  }
  next();
}

export function requireVerifiedStudent(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role === 'admin') return next();
  if (req.user.verification_status !== 'verified') {
    return res.status(403).json({
      error: 'Account verification required',
      verification_status: req.user.verification_status,
    });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
