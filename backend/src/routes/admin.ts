import {
  Router,
} from 'express';

import {
  isValidObjectId,
} from 'mongoose';

import User from '../Models/User';
import Listing from '../Models/Listing';
import RentalRequest from '../Models/RentalRequest';
import Message from '../Models/Message';
import Review from '../Models/Review';
import Report from '../Models/Report';

import {
  authenticate,
  requireAdmin,
} from '../middleware/auth';

const router = Router();

router.use(
  authenticate,
  requireAdmin
);

function formatUser(user: any) {
  return {
    _id:
      user._id.toString(),

    id:
      user._id.toString(),

    email:
      user.email,

    first_name:
      user.first_name,

    last_name:
      user.last_name,

    phone:
      user.phone ?? '',

    bio:
      user.bio ?? '',

    role:
      user.role,

    verification_status:
      user.verification_status,

    status:
      user.status,

    created_at:
      user.created_at,

    updated_at:
      user.updated_at,
  };
}

function formatReport(report: any) {
  const reportObject =
    typeof report.toObject ===
    'function'
      ? report.toObject()
      : report;

  const reporter =
    reportObject.reporter;

  const reportedUser =
    reportObject.reported_user;

  const reportedListing =
    reportObject.reported_listing;

  return {
    _id:
      reportObject._id.toString(),

    id:
      reportObject._id.toString(),

    reason:
      reportObject.reason,

    details:
      reportObject.details,

    status:
      reportObject.status,

    admin_action:
      reportObject.admin_action,

    reporter_name:
      reporter &&
      typeof reporter === 'object'
        ? `${reporter.first_name} ${reporter.last_name}`
        : undefined,

    reported_user_name:
      reportedUser &&
      typeof reportedUser === 'object'
        ? `${reportedUser.first_name} ${reportedUser.last_name}`
        : undefined,

    reported_listing_title:
      reportedListing &&
      typeof reportedListing ===
        'object'
        ? reportedListing.title
        : undefined,

    created_at:
      reportObject.created_at,

    resolved_at:
      reportObject.resolved_at,
  };
}

/**
 * GET /api/admin/stats
 */
router.get(
  '/stats',
  async (_req, res) => {
    try {
      const [
        totalUsers,
        verifiedUsers,
        pendingVerifications,
        totalListings,
        activeListings,
        totalRequests,
        pendingRequests,
        completedRentals,
        pendingReports,
        totalMessages,
        totalReviews,
        recentUsers,
        recentListings,
        recentRequests,
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

        Listing.countDocuments(),

        Listing.countDocuments({
          availability:
            'available',
        }),

        RentalRequest.countDocuments(),

        RentalRequest.countDocuments({
          status: 'pending',
        }),

        RentalRequest.countDocuments({
          status: 'completed',
        }),

        Report.countDocuments({
          status: 'pending',
        }),

        Message.countDocuments(),

        Review.countDocuments(),

        User.find({
          role: 'student',
        })
          .select(
            'email created_at'
          )
          .sort({
            created_at: -1,
          })
          .limit(10)
          .lean(),

        Listing.find()
          .select(
            'title created_at'
          )
          .sort({
            created_at: -1,
          })
          .limit(10)
          .lean(),

        RentalRequest.find()
          .select(
            'status created_at'
          )
          .sort({
            created_at: -1,
          })
          .limit(10)
          .lean(),
      ]);

      const recentActivity = [
        ...recentUsers.map(
          (user: any) => ({
            type:
              'registration',

            detail:
              user.email,

            created_at:
              user.created_at,
          })
        ),

        ...recentListings.map(
          (listing: any) => ({
            type:
              'listing',

            detail:
              listing.title,

            created_at:
              listing.created_at,
          })
        ),

        ...recentRequests.map(
          (request: any) => ({
            type:
              'request',

            detail:
              request.status,

            created_at:
              request.created_at,
          })
        ),
      ]
        .sort(
          (
            first,
            second
          ) =>
            new Date(
              second.created_at
            ).getTime() -
            new Date(
              first.created_at
            ).getTime()
        )
        .slice(0, 20);

      return res.status(200).json({
        stats: {
          total_users:
            totalUsers,

          verified_users:
            verifiedUsers,

          pending_verifications:
            pendingVerifications,

          total_listings:
            totalListings,

          active_listings:
            activeListings,

          total_requests:
            totalRequests,

          pending_requests:
            pendingRequests,

          completed_rentals:
            completedRentals,

          pending_reports:
            pendingReports,

          total_messages:
            totalMessages,

          total_reviews:
            totalReviews,
        },

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
 */
router.get(
  '/verifications',
  async (_req, res) => {
    try {
      const users =
        await User.find({
          role: 'student',
          verification_status:
            'pending',
        }).sort({
          created_at: 1,
        });

      return res.status(200).json(
        users.map(formatUser)
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
 */
router.patch(
  '/verifications/:id',
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const { action } =
        req.body as {
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

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          error:
            'Invalid user ID',
        });
      }

      const user =
        await User.findOne({
          _id: id,
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
        formatUser(user)
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
 */
router.get(
  '/reports',
  async (_req, res) => {
    try {
      const reports =
        await Report.find()
          .populate(
            'reporter',
            '_id first_name last_name email'
          )
          .populate(
            'reported_user',
            '_id first_name last_name email'
          )
          .populate(
            'reported_listing',
            '_id title'
          )
          .sort({
            created_at: -1,
          });

      return res.status(200).json(
        reports.map(
          formatReport
        )
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
 */
router.patch(
  '/reports/:id',
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const {
        action,
        admin_action:
          adminAction,
      } = req.body as {
        action?: unknown;
        admin_action?: unknown;
      };

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          error:
            'Invalid report ID',
        });
      }

      const allowedActions = [
        'warning',
        'remove_listing',
        'suspend_user',
        'dismissed',
      ] as const;

      const selectedAction =
        typeof adminAction ===
          'string'
          ? adminAction
          : action;

      if (
        typeof selectedAction !==
          'string' ||
        !allowedActions.includes(
          selectedAction as
            typeof allowedActions[number]
        )
      ) {
        return res.status(400).json({
          error:
            'Invalid moderation action',
        });
      }

      const report =
        await Report.findById(id);

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
        selectedAction ===
          'remove_listing' &&
        report.reported_listing
      ) {
        await Listing.findByIdAndDelete(
          report.reported_listing
        );
      }

if (selectedAction === 'suspend_user') {
  let userIdToSuspend:
    | string
    | null = null;

  /*
   * A report may directly target a user.
   */
  if (report.reported_user) {
    userIdToSuspend =
      report.reported_user.toString();
  }

  /*
   * A listing report normally has no reported_user value.
   * In that case, suspend the owner of the reported listing.
   */
  if (
    !userIdToSuspend &&
    report.reported_listing
  ) {
    const reportedListing =
      await Listing.findById(
        report.reported_listing
      ).select('owner');

    if (!reportedListing) {
      return res.status(404).json({
        error:
          'Reported listing not found',
      });
    }

    userIdToSuspend =
      reportedListing.owner.toString();
  }

  if (!userIdToSuspend) {
    return res.status(400).json({
      error:
        'Unable to determine which user should be suspended',
    });
  }

  const suspendedUser =
    await User.findByIdAndUpdate(
      userIdToSuspend,
      {
        status: 'suspended',
      },
      {
        new: true,
        runValidators: true,
      }
    );

  if (!suspendedUser) {
    return res.status(404).json({
      error:
        'Reported user not found',
    });
  }
}

      report.status =
        'resolved';

      report.admin_action =
        selectedAction as
          | 'warning'
          | 'remove_listing'
          | 'suspend_user'
          | 'dismissed';

      report.resolved_at =
        new Date();

      await report.save();

      await report.populate([
        {
          path: 'reporter',
          select:
            '_id first_name last_name email',
        },
        {
          path: 'reported_user',
          select:
            '_id first_name last_name email',
        },
        {
          path: 'reported_listing',
          select:
            '_id title',
        },
      ]);

      return res.status(200).json(
        formatReport(report)
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
 */
router.get(
  '/users',
  async (_req, res) => {
    try {
      const users =
        await User.find({
          role: 'student',
        }).sort({
          created_at: -1,
        });

      return res.status(200).json(
        users.map(formatUser)
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