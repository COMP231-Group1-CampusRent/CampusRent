import type {
  NextFunction,
  Request,
  Response,
} from 'express';

import jwt from 'jsonwebtoken';

import User from '../Models/User';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  verification_status: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

interface TokenPayload {
  id: string;
}

export function signToken(
  userId: string
): string {
  const jwtSecret =
    process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error(
      'JWT_SECRET is not configured'
    );
  }

  return jwt.sign(
    {
      id: userId,
    },
    jwtSecret,
    {
      expiresIn: '7d',
    }
  );
}

async function getUserFromToken(
  token: string
): Promise<AuthUser | null> {
  const jwtSecret =
    process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error(
      'JWT_SECRET is not configured'
    );
  }

  const decoded = jwt.verify(
    token,
    jwtSecret
  ) as TokenPayload;

  const user = await User.findById(
    decoded.id
  ).select(
    '_id email role first_name last_name verification_status status'
  );

  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    verification_status:
      user.verification_status,
    status: user.status,
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorization =
      req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith(
        'Bearer '
      )
    ) {
      res.status(401).json({
        message:
          'Authentication token is required',
      });

      return;
    }

    const token =
      authorization.split(' ')[1];

    const user =
      await getUserFromToken(token);

    if (!user) {
      res.status(401).json({
        message: 'User not found',
      });

      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({
        message:
          'This account is not active',
      });

      return;
    }

    req.user = user;

    next();
  } catch (error) {
    if (
      error instanceof
      jwt.TokenExpiredError
    ) {
      res.status(401).json({
        message:
          'Authentication token has expired',
      });

      return;
    }

    if (
      error instanceof
      jwt.JsonWebTokenError
    ) {
      res.status(401).json({
        message:
          'Invalid authentication token',
      });

      return;
    }

    console.error(
      'Authentication error:',
      error
    );

    res.status(500).json({
      message:
        'Unable to authenticate user',
    });
  }
}

export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorization =
      req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith(
        'Bearer '
      )
    ) {
      next();
      return;
    }

    const token =
      authorization.split(' ')[1];

    const user =
      await getUserFromToken(token);

    if (
      user &&
      user.status === 'active'
    ) {
      req.user = user;
    }

    next();
  } catch {
    next();
  }
}

export function requireVerifiedStudent(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      message:
        'Authentication is required',
    });

    return;
  }

  if (req.user.role === 'admin') {
    next();
    return;
  }

  if (
    req.user.role !== 'student' ||
    req.user.verification_status !==
      'verified'
  ) {
    res.status(403).json({
      message:
        'A verified student account is required',
    });

    return;
  }

  next();
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      message:
        'Authentication is required',
    });

    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      message:
        'Administrator access is required',
    });

    return;
  }

  next();
}

export function requireRole(
  ...allowedRoles: string[]
) {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        message:
          'Authentication is required',
      });

      return;
    }

    if (
      !allowedRoles.includes(
        req.user.role
      )
    ) {
      res.status(403).json({
        message:
          'You do not have permission to perform this action',
      });

      return;
    }

    next();
  };
}