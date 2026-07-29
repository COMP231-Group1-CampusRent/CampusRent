import {
  Router,
  type Request,
  type Response,
} from 'express';

import {
  isValidObjectId,
} from 'mongoose';

import Report from '../Models/Report';
import User from '../Models/User';
import Listing from '../Models/Listing';

import {
  authenticate,
  requireVerifiedStudent,
} from '../middleware/auth';

const router = Router();

interface CreateReportBody {
  reported_user_id?: unknown;
  reported_listing_id?: unknown;
  reason?: unknown;
  details?: unknown;
}

function getOptionalId(
  value: unknown
): string | null {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return null;
  }

  return value.trim();
}

function getRequiredText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

/**
 * POST /api/reports
 *
 * Creates a new user or listing report in MongoDB.
 */
router.post(
  '/',
  authenticate,
  requireVerifiedStudent,
  async (
    req: Request<
      Record<string, never>,
      unknown,
      CreateReportBody
    >,
    res: Response
  ) => {
    try {
      const reportedUserId =
        getOptionalId(
          req.body.reported_user_id
        );

      const reportedListingId =
        getOptionalId(
          req.body.reported_listing_id
        );

      const reason =
        getRequiredText(
          req.body.reason
        );

      const details =
        getRequiredText(
          req.body.details
        );

      if (!reason || !details) {
        return res.status(400).json({
          error:
            'Reason and details are required',
        });
      }

      if (
        !reportedUserId &&
        !reportedListingId
      ) {
        return res.status(400).json({
          error:
            'Must report a user or listing',
        });
      }

      if (
        reportedUserId &&
        !isValidObjectId(reportedUserId)
      ) {
        return res.status(400).json({
          error:
            'Invalid reported user ID',
        });
      }

      if (
        reportedListingId &&
        !isValidObjectId(
          reportedListingId
        )
      ) {
        return res.status(400).json({
          error:
            'Invalid reported listing ID',
        });
      }

      if (
        reportedUserId ===
        req.user!.id
      ) {
        return res.status(400).json({
          error:
            'You cannot report your own account',
        });
      }

      if (reportedUserId) {
        const reportedUser =
          await User.findById(
            reportedUserId
          ).select('_id');

        if (!reportedUser) {
          return res.status(404).json({
            error:
              'Reported user not found',
          });
        }
      }

      if (reportedListingId) {
        const reportedListing =
          await Listing.findById(
            reportedListingId
          ).select('_id owner');

        if (!reportedListing) {
          return res.status(404).json({
            error:
              'Reported listing not found',
          });
        }

        if (
          reportedListing.owner.toString() ===
          req.user!.id
        ) {
          return res.status(400).json({
            error:
              'You cannot report your own listing',
          });
        }
      }

      const report =
        await Report.create({
          reporter:
            req.user!.id,

          reported_user:
            reportedUserId,

          reported_listing:
            reportedListingId,

          reason,
          details,

          status: 'pending',
          admin_action: null,
          resolved_at: null,
        });

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

      const reportObject =
        report.toObject() as any;

      return res.status(201).json({
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

        reporter_name:
          reportObject.reporter
            ? `${reportObject.reporter.first_name} ${reportObject.reporter.last_name}`
            : undefined,

        reported_user_name:
          reportObject.reported_user
            ? `${reportObject.reported_user.first_name} ${reportObject.reported_user.last_name}`
            : undefined,

        reported_listing_title:
          reportObject.reported_listing
            ?.title,

        created_at:
          reportObject.created_at,

        resolved_at:
          reportObject.resolved_at,
      });
    } catch (error) {
      console.error(
        'Create report error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to submit report',
      });
    }
  }
);

export default router;