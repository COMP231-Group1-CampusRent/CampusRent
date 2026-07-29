import { Router } from 'express';
import { Types } from 'mongoose';

import db from '../db';
import User from '../Models/User';

import {
  authenticate,
  requireAdmin,
} from '../middleware/auth';

const router = Router();

/*
 * Every route in this file requires:
 *
 * 1. A valid JWT token
 * 2. An authenticated administrator account
 */
router.use(
  authenticate,
  requireAdmin
);

/**
 * Converts an unknown MongoDB document ID into a valid string.
 */
function normalizeId(
  id: unknown
): string | null {
  if (typeof id !== 'string') {
    return null;
  }

  const trimmedId = id.trim();

  if (!Types.ObjectId.isValid(trimmedId)) {
    return null;
  }

  return trimmedId;
}

/**
 * Converts a MongoDB user document into the structure expected
 * by the frontend.
 */
function formatUser(user: {
  _id: unknown;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  bio?: string;
  role: string;
  verification_status: string;
  status: string;
  created_at?: Date;
  updated_at?: Date;
}) {
  return {
    _id: String(user._id),
    id: String(user._id),

    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,

    phone: user.phone ?? '',
    bio: user.bio ?? '',

    role: user.role,
    verification_status:
      user.verification_status,
    status: user.status,

    created_at:
      user.created_at?.toISOString() ??
      null,

    updated_at:
      user.updated_at?.toISOString() ??
      null,
  };
}

/**
 * GET /api/admin/stats
 *
 * Returns administrative statistics and recent platform activity.
 *
 * MongoDB is used for user statistics.
 * The temporary JSON compatibility database is still used for
 * listings, requests, reports, messages, and reviews.
 */
router.get(
  '/stats',
  async (_req, res) => {
    try {
      const [
        totalUsers,
        verifiedUsers,
        pendingVerifications,
        recentUsers,
      ] = await Promise.all([
        User.countDocuments({
          role: 'student',
        }),

        User.countDocuments({
          role: 'student',
          verification_status:
            'verified',
        }),

        User.countDocuments({
          role: 'student',
          verification_status:
            'pending',
        }),

        User.find({
          role: 'student',
        })
          .select(
            'email created_at'
          )
          .sort({
            created_at: -1,
          })
          .limit(20)
          .lean(),
      ]);

      const stats = {
        total_users: totalUsers,
        verified_users:
          verifiedUsers,
        pending_verifications:
          pendingVerifications,

        total_listings: (
          db
            .prepare(
              'SELECT COUNT(*) as c FROM listings'
            )
            .get() as {
            c: number;
          }
        ).c,

        active_listings: (
          db
            .prepare(
              "SELECT COUNT(*) as c FROM listings WHERE availability = 'available'"
            )
            .get() as {
            c: number;
          }
        ).c,

        total_requests: (
          db
            .prepare(
              'SELECT COUNT(*) as c FROM rental_requests'
            )
            .get() as {
            c: number;
          }
        ).c,

        pending_requests: (
          db
            .prepare(
              "SELECT COUNT(*) as c FROM rental_requests WHERE status = 'pending'"
            )
            .get() as {
            c: number;
          }
        ).c,

        completed_rentals: (
          db
            .prepare(
              "SELECT COUNT(*) as c FROM rental_requests WHERE status = 'completed'"
            )
            .get() as {
            c: number;
          }
        ).c,

        pending_reports: (
          db
            .prepare(
              "SELECT COUNT(*) as c FROM reports WHERE status = 'pending'"
            )
            .get() as {
            c: number;
          }
        ).c,

        total_messages: (
          db
            .prepare(
              'SELECT COUNT(*) as c FROM messages'
            )
            .get() as {
            c: number;
          }
        ).c,

        total_reviews: (
          db
            .prepare(
              'SELECT COUNT(*) as c FROM reviews'
            )
            .get() as {
            c: number;
          }
        ).c,
      };

      const userActivity =
        recentUsers.map((user) => ({
          type: 'registration',
          detail: user.email,
          created_at:
            user.created_at?.toISOString() ??
            new Date().toISOString(),
        }));

      const legacyActivity =
        db
          .prepare(
            `SELECT 'listing' as type, title as detail, created_at
             FROM listings

             UNION ALL

             SELECT 'request' as type, status as detail, created_at
             FROM rental_requests

             ORDER BY created_at DESC
             LIMIT 20`
          )
          .all() as {
          type: string;
          detail: string;
          created_at: string;
        }[];

      const recentActivity = [
        ...userActivity,
        ...legacyActivity,
      ]
        .sort((first, second) =>
          second.created_at.localeCompare(
            first.created_at
          )
        )
        .slice(0, 20);

      return res.status(200).json({
        stats,
        recent_activity:
          recentActivity,
      });
    } catch (error) {
      console.error(
        'Unable to load admin statistics:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to load admin statistics',
      });
    }
  }
);

/**
 * GET /api/admin/verifications
 *
 * Returns all pending student registrations from MongoDB.
 */
router.get(
  '/verifications',
  async (_req, res) => {
    try {
      const users = await User.find({
        role: 'student',
        verification_status:
          'pending',
      })
        .select(
          '+created_at'
        )
        .sort({
          created_at: 1,
        });

      const formattedUsers =
        users.map((user) =>
          formatUser({
            _id: user._id,
            email: user.email,
            first_name:
              user.first_name,
            last_name:
              user.last_name,
            phone: user.phone,
            bio: user.bio,
            role: user.role,
            verification_status:
              user.verification_status,
            status: user.status,
            created_at:
              user.created_at,
            updated_at:
              user.updated_at,
          })
        );

      return res.status(200).json(
        formattedUsers
      );
    } catch (error) {
      console.error(
        'Unable to load pending verifications:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to load pending verifications',
      });
    }
  }
);

/**
 * PATCH /api/admin/verifications/:id
 *
 * Approves or rejects a pending student account.
 *
 * Expected request body:
 *
 * {
 *   "action": "approve"
 * }
 *
 * or:
 *
 * {
 *   "action": "reject"
 * }
 */
router.patch(
  '/verifications/:id',
  async (req, res) => {
    try {
      const {
        action,
      } = req.body as {
        action?: unknown;
      };

      if (
        action !== 'approve' &&
        action !== 'reject'
      ) {
        return res.status(400).json({
          error:
            'Action must be approve or reject',
        });
      }

      const userId = normalizeId(
        req.params.id
      );

      if (!userId) {
        return res.status(400).json({
          error:
            'Invalid MongoDB user ID',
        });
      }

      const user =
        await User.findOne({
          _id: userId,
          role: 'student',
        });

      if (!user) {
        return res.status(404).json({
          error:
            'Student not found',
        });
      }

      user.verification_status =
        action === 'approve'
          ? 'verified'
          : 'rejected';

      await user.save();

      return res.status(200).json(
        formatUser({
          _id: user._id,
          email: user.email,
          first_name:
            user.first_name,
          last_name:
            user.last_name,
          phone: user.phone,
          bio: user.bio,
          role: user.role,
          verification_status:
            user.verification_status,
          status: user.status,
          created_at:
            user.created_at,
          updated_at:
            user.updated_at,
        })
      );
    } catch (error) {
      console.error(
        'Unable to update verification status:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to update verification status',
      });
    }
  }
);

/**
 * GET /api/admin/reports
 *
 * Returns reports from the temporary JSON compatibility database.
 */
router.get(
  '/reports',
  (_req, res) => {
    try {
      const reports = db
        .prepare(
          `SELECT r.*,
            reporter.first_name || ' ' || reporter.last_name as reporter_name,
            reported.first_name || ' ' || reported.last_name as reported_user_name,
            l.title as reported_listing_title

           FROM reports r

           JOIN users reporter
             ON reporter.id = r.reporter_id

           LEFT JOIN users reported
             ON reported.id = r.reported_user_id

           LEFT JOIN listings l
             ON l.id = r.reported_listing_id

           ORDER BY r.created_at DESC`
        )
        .all();

      return res.status(200).json(
        reports
      );
    } catch (error) {
      console.error(
        'Unable to load reports:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to load reports',
      });
    }
  }
);

/**
 * PATCH /api/admin/reports/:id
 *
 * Resolves a report using the temporary JSON compatibility database.
 */
router.patch(
  '/reports/:id',
  (req, res) => {
    try {
      const {
        action,
        admin_action:
          adminAction,
      } = req.body as {
        action?: string;
        admin_action?: string;
      };

      const report = db
        .prepare(
          'SELECT * FROM reports WHERE id = ?'
        )
        .get(
          req.params.id
        ) as
        | {
            id: number;
            reported_user_id:
              number | null;
            reported_listing_id:
              number | null;
            status: string;
          }
        | undefined;

      if (!report) {
        return res.status(404).json({
          error:
            'Report not found',
        });
      }

      if (
        report.status ===
        'resolved'
      ) {
        return res.status(400).json({
          error:
            'Report already resolved',
        });
      }

      if (
        action ===
          'remove_listing' &&
        report.reported_listing_id
      ) {
        db.prepare(
          'DELETE FROM listings WHERE id = ?'
        ).run(
          report.reported_listing_id
        );
      }

      if (
        action ===
          'suspend_user' &&
        report.reported_user_id
      ) {
        db.prepare(
          "UPDATE users SET status = 'suspended' WHERE id = ?"
        ).run(
          report.reported_user_id
        );
      }

      db.prepare(
        `UPDATE reports
         SET status = 'resolved',
             admin_action = ?,
             resolved_at = datetime('now')
         WHERE id = ?`
      ).run(
        adminAction ??
          action ??
          'resolved',
        report.id
      );

      const updated = db
        .prepare(
          'SELECT * FROM reports WHERE id = ?'
        )
        .get(report.id);

      return res.status(200).json(
        updated
      );
    } catch (error) {
      console.error(
        'Unable to resolve report:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to resolve report',
      });
    }
  }
);

/**
 * GET /api/admin/users
 *
 * Returns all student users from MongoDB.
 */
router.get(
  '/users',
  async (_req, res) => {
    try {
      const users = await User.find({
        role: 'student',
      }).sort({
        created_at: -1,
      });

      const formattedUsers =
        users.map((user) =>
          formatUser({
            _id: user._id,
            email: user.email,
            first_name:
              user.first_name,
            last_name:
              user.last_name,
            phone: user.phone,
            bio: user.bio,
            role: user.role,
            verification_status:
              user.verification_status,
            status: user.status,
            created_at:
              user.created_at,
            updated_at:
              user.updated_at,
          })
        );

      return res.status(200).json(
        formattedUsers
      );
    } catch (error) {
      console.error(
        'Unable to load users:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to load users',
      });
    }
  }
);

export default router;