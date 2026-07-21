import { Router } from 'express';
import { isValidObjectId } from 'mongoose';

import User from '../Models/User';
import Review from '../Models/Review';

import {
  authenticate,
  requireVerifiedStudent,
} from '../middleware/auth';

const router = Router();

/**
 * GET /api/users/profile
 * Returns the authenticated user's profile.
 */
router.get(
  '/profile',
  authenticate,
  async (req, res) => {
    try {
      const user = await User.findById(
        req.user!.id
      ).select(
        '_id email first_name last_name phone bio role verification_status status created_at updated_at'
      );

      if (!user) {
        res.status(404).json({
          error: 'User not found',
        });

        return;
      }

      res.json({
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
      });
    } catch (error) {
      console.error(
        'Get profile error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to retrieve profile',
      });
    }
  }
);

/**
 * PUT /api/users/profile
 * Updates the authenticated user's profile.
 */
router.put(
  '/profile',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const {
        first_name,
        last_name,
        phone,
        bio,
      } = req.body;

      if (
        !first_name?.trim() ||
        !last_name?.trim()
      ) {
        res.status(400).json({
          error:
            'First and last name are required',
        });

        return;
      }

      const user =
        await User.findByIdAndUpdate(
          req.user!.id,
          {
            first_name:
              String(first_name).trim(),

            last_name:
              String(last_name).trim(),

            phone: phone
              ? String(phone).trim()
              : '',

            bio: bio
              ? String(bio).trim()
              : '',
          },
          {
            new: true,
            runValidators: true,
          }
        ).select(
          '_id email first_name last_name phone bio role verification_status status created_at updated_at'
        );

      if (!user) {
        res.status(404).json({
          error: 'User not found',
        });

        return;
      }

      res.json({
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
      });
    } catch (error) {
      console.error(
        'Update profile error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to update profile',
      });
    }
  }
);

/**
 * GET /api/users/:id/public
 * Returns public information about an active student.
 */
router.get(
  '/:id/public',
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        res.status(400).json({
          error: 'Invalid user ID',
        });

        return;
      }

      const user = await User.findOne({
        _id: id,
        role: 'student',
        status: 'active',
      }).select(
        '_id first_name last_name bio verification_status'
      );

      if (!user) {
        res.status(404).json({
          error: 'User not found',
        });

        return;
      }

      const reviewSummary =
        await Review.aggregate([
          {
            $match: {
              reviewed_user: user._id,
            },
          },
          {
            $group: {
              _id: '$reviewed_user',
              avg_rating: {
                $avg: '$rating',
              },
              review_count: {
                $sum: 1,
              },
            },
          },
        ]);

      const summary =
        reviewSummary[0];

      res.json({
        id: user._id.toString(),
        first_name: user.first_name,
        last_name: user.last_name,
        bio: user.bio,
        verification_status:
          user.verification_status,

        avg_rating: summary
          ? Number(
              summary.avg_rating.toFixed(
                1
              )
            )
          : null,

        review_count:
          summary?.review_count ?? 0,
      });
    } catch (error) {
      console.error(
        'Get public profile error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to retrieve public profile',
      });
    }
  }
);

export default router;