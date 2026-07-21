import { Router } from 'express';
import bcrypt from 'bcryptjs';

import User from '../Models/User';

import {
  authenticate,
  signToken,
  type AuthRequest,
} from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/register
 * Creates a new user account.
 */
router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      phone,
    } = req.body;

    if (
      !email ||
      !password ||
      !first_name ||
      !last_name
    ) {
      res.status(400).json({
        message:
          'Email, password, first name and last name are required',
      });

      return;
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(409).json({
        message:
          'An account with this email already exists',
      });

      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({
        message:
          'Password must contain at least 6 characters',
      });

      return;
    }

    const passwordHash = await bcrypt.hash(
      String(password),
      10
    );

    const user = await User.create({
      email: normalizedEmail,
      password_hash: passwordHash,
      first_name: String(first_name).trim(),
      last_name: String(last_name).trim(),
      phone: phone
        ? String(phone).trim()
        : '',
      bio: '',
      role: 'student',
      verification_status: 'pending',
      status: 'active',
    });

    const token = signToken(
      user._id.toString()
    );

    res.status(201).json({
      message:
        'Account created successfully',
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        bio: user.bio,
        role: user.role,
        verification_status:
          user.verification_status,
        status: user.status,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error(
      'Registration error:',
      error
    );

    res.status(500).json({
      message:
        'Unable to create account',
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticates an existing user.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        message:
          'Email and password are required',
      });

      return;
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select('+password_hash');

    if (!user) {
      res.status(401).json({
        message:
          'Invalid email or password',
      });

      return;
    }

    const passwordMatches =
      await bcrypt.compare(
        String(password),
        user.password_hash
      );

    if (!passwordMatches) {
      res.status(401).json({
        message:
          'Invalid email or password',
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

    const token = signToken(
      user._id.toString()
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        bio: user.bio,
        role: user.role,
        verification_status:
          user.verification_status,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    res.status(500).json({
      message: 'Unable to log in',
    });
  }
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */
router.get(
  '/me',
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const user = await User.findById(
        req.user!.id
      ).select('-password_hash');

      if (!user) {
        res.status(404).json({
          message: 'User not found',
        });

        return;
      }

      res.status(200).json({
        user: {
          id: user._id.toString(),
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          bio: user.bio,
          role: user.role,
          verification_status:
            user.verification_status,
          status: user.status,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      });
    } catch (error) {
      console.error(
        'Get current user error:',
        error
      );

      res.status(500).json({
        message:
          'Unable to retrieve user information',
      });
    }
  }
);

export default router;