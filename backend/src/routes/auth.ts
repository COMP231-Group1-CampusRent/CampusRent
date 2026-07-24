import { Router } from 'express';
import bcrypt from 'bcryptjs';

import User from '../Models/User';
import { isInstitutionalEmail } from '../utils/validation';

import {
  authenticate,
  signToken,
  type AuthRequest,
} from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/register
 *
 * Creates a new CampusRent user account.
 *
 * Related requirement:
 * Task US-03.4 – Implement institutional-email and
 * verification-status validation.
 *
 * Validation rules:
 * - Email, password, first name, and last name are required.
 * - Only institutional email addresses are accepted.
 * - Duplicate email addresses are rejected.
 * - Passwords must contain at least six characters.
 * - New accounts begin with pending verification status.
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

    /**
     * Validate required registration data.
     */
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

    /**
     * Normalize the email before validation and storage.
     *
     * This prevents duplicate records caused by differences
     * in capitalization or surrounding spaces.
     */
    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    /**
     * Reject personal or unsupported email addresses.
     *
     * Examples rejected:
     * - gmail.com
     * - outlook.com
     * - yahoo.com
     *
     * Examples accepted:
     * - my.centennialcollege.ca
     * - educational .edu domains
     * - supported academic domains
     */
    if (!isInstitutionalEmail(normalizedEmail)) {
      res.status(400).json({
        message:
          'A valid institutional email address is required',
      });

      return;
    }

    /**
     * Prevent multiple accounts from using the same email.
     */
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

    /**
     * Validate the minimum password length.
     */
    if (String(password).length < 6) {
      res.status(400).json({
        message:
          'Password must contain at least 6 characters',
      });

      return;
    }

    /**
     * Hash the password before saving it.
     *
     * The original password must never be stored directly.
     */
    const passwordHash = await bcrypt.hash(
      String(password),
      10
    );

    /**
     * Create the new student account.
     *
     * Task US-03.4 requirement:
     * Every new registration starts with
     * verification_status set to pending.
     */
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

    /**
     * Generate an authentication token for the new user.
     */
    const token = signToken(
      user._id.toString()
    );

    res.status(201).json({
      message:
        'Account created successfully. Institutional verification is pending.',
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
 *
 * Authenticates an existing CampusRent user.
 *
 * Validation rules:
 * - Email and password are required.
 * - Credentials must be valid.
 * - Suspended accounts cannot log in.
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

    /**
     * Normalize the email before searching MongoDB.
     */
    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    /**
     * password_hash is excluded by default in the User model.
     * It must be explicitly selected for password comparison.
     */
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

    /**
     * Compare the submitted password against the stored hash.
     */
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

    /**
     * Prevent suspended accounts from accessing the application.
     */
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
 *
 * Returns the profile of the currently authenticated user.
 *
 * This route requires a valid authentication token.
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