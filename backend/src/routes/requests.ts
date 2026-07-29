import {
  Router,
  type Request,
  type Response,
} from 'express';

import {
  isValidObjectId,
} from 'mongoose';

import Listing from '../Models/Listing';
import RentalRequest from '../Models/RentalRequest';

import {
  authenticate,
  requireVerifiedStudent,
} from '../middleware/auth';

const router = Router();

type RentalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed';

interface CreateRentalRequestBody {
  listing_id?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  message?: unknown;
}

/**
 * Populates all related MongoDB documents needed by the frontend.
 */
async function populateRequest(
  requestDocument: any
): Promise<any> {
  await requestDocument.populate([
    {
      path: 'listing',
      select:
        '_id title category owner availability',
    },
    {
      path: 'requester',
      select:
        '_id first_name last_name email phone',
    },
    {
      path: 'owner',
      select:
        '_id first_name last_name email phone',
    },
  ]);

  return requestDocument;
}

/**
 * Converts a MongoDB rental request into the response structure
 * expected by the CampusRent frontend.
 */
function formatRequest(
  requestDocument: any
) {
  const requestObject =
    typeof requestDocument.toObject ===
    'function'
      ? requestDocument.toObject()
      : requestDocument;

  const listing =
    requestObject.listing;

  const requester =
    requestObject.requester;

  const owner =
    requestObject.owner;

  return {
    _id:
      requestObject._id?.toString?.(),

    id:
      requestObject._id?.toString?.() ??
      requestObject.id,

    listing_id:
      listing?._id?.toString?.() ??
      listing?.toString?.() ??
      requestObject.listing?.toString?.(),

    renter_id:
      requester?._id?.toString?.() ??
      requester?.toString?.() ??
      requestObject.requester?.toString?.(),

    owner_id:
      owner?._id?.toString?.() ??
      owner?.toString?.() ??
      requestObject.owner?.toString?.(),

    start_date:
      requestObject.start_date,

    end_date:
      requestObject.end_date,

    message:
      requestObject.message ?? '',

    status:
      requestObject.status,

    created_at:
      requestObject.created_at,

    updated_at:
      requestObject.updated_at,

    listing:
      listing &&
      typeof listing === 'object'
        ? {
            _id:
              listing._id?.toString?.(),

            id:
              listing._id?.toString?.() ??
              listing.id,

            title:
              listing.title,

            category:
              listing.category,

            availability:
              listing.availability,

            owner_id:
              listing.owner?._id?.toString?.() ??
              listing.owner?.toString?.(),
          }
        : null,

    renter:
      requester &&
      typeof requester === 'object'
        ? {
            _id:
              requester._id?.toString?.(),

            id:
              requester._id?.toString?.() ??
              requester.id,

            first_name:
              requester.first_name,

            last_name:
              requester.last_name,

            email:
              requester.email,

            phone:
              requester.phone,
          }
        : null,

    owner:
      owner &&
      typeof owner === 'object'
        ? {
            _id:
              owner._id?.toString?.(),

            id:
              owner._id?.toString?.() ??
              owner.id,

            first_name:
              owner.first_name,

            last_name:
              owner.last_name,

            email:
              owner.email,

            phone:
              owner.phone,
          }
        : null,
  };
}

/**
 * Returns a valid string value or null.
 */
function getRequiredString(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue
    ? trimmedValue
    : null;
}

/**
 * GET /api/requests/outgoing
 */
router.get(
  '/outgoing',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const requests =
        await RentalRequest.find({
          requester: req.user!.id,
        })
          .populate(
            'listing',
            '_id title category owner availability'
          )
          .populate(
            'requester',
            '_id first_name last_name email phone'
          )
          .populate(
            'owner',
            '_id first_name last_name email phone'
          )
          .sort({
            created_at: -1,
          });

      return res.status(200).json(
        requests.map(formatRequest)
      );
    } catch (error) {
      console.error(
        'Get outgoing requests error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to retrieve outgoing requests',
      });
    }
  }
);

/**
 * GET /api/requests/incoming
 */
router.get(
  '/incoming',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const requests =
        await RentalRequest.find({
          owner: req.user!.id,
        })
          .populate(
            'listing',
            '_id title category owner availability'
          )
          .populate(
            'requester',
            '_id first_name last_name email phone'
          )
          .populate(
            'owner',
            '_id first_name last_name email phone'
          )
          .sort({
            created_at: -1,
          });

      return res.status(200).json(
        requests.map(formatRequest)
      );
    } catch (error) {
      console.error(
        'Get incoming requests error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to retrieve incoming requests',
      });
    }
  }
);

/**
 * POST /api/requests
 */
router.post(
  '/',
  authenticate,
  requireVerifiedStudent,
  async (
    req: Request<
      Record<string, never>,
      unknown,
      CreateRentalRequestBody
    >,
    res: Response
  ) => {
    try {
      const listingId =
        getRequiredString(
          req.body.listing_id
        );

      const startDateValue =
        getRequiredString(
          req.body.start_date
        );

      const endDateValue =
        getRequiredString(
          req.body.end_date
        );

      const messageValue =
        typeof req.body.message ===
        'string'
          ? req.body.message.trim()
          : '';

      if (
        !listingId ||
        !startDateValue ||
        !endDateValue
      ) {
        return res.status(400).json({
          error:
            'Listing and rental dates are required',
        });
      }

      if (
        !isValidObjectId(listingId)
      ) {
        return res.status(400).json({
          error:
            'Invalid listing ID',
        });
      }

      const startDate =
        new Date(
          `${startDateValue}T00:00:00.000Z`
        );

      const endDate =
        new Date(
          `${endDateValue}T00:00:00.000Z`
        );

      if (
        Number.isNaN(
          startDate.getTime()
        ) ||
        Number.isNaN(
          endDate.getTime()
        )
      ) {
        return res.status(400).json({
          error:
            'Valid rental dates are required',
        });
      }

      if (endDate < startDate) {
        return res.status(400).json({
          error:
            'End date must be on or after the start date',
        });
      }

      const listing =
        await Listing.findById(
          listingId
        );

      if (!listing) {
        return res.status(404).json({
          error:
            'Listing not found',
        });
      }

      if (
        listing.availability !==
        'available'
      ) {
        return res.status(400).json({
          error:
            'This item is not available for rental',
        });
      }

      if (
        listing.owner.toString() ===
        req.user!.id
      ) {
        return res.status(400).json({
          error:
            'You cannot request your own listing',
        });
      }

      const existingRequest =
        await RentalRequest.findOne({
          listing: listing._id,
          requester:
            req.user!.id,
          status: 'pending',
        });

      if (existingRequest) {
        return res.status(409).json({
          error:
            'You already have a pending request for this listing',
        });
      }

      const rentalRequest =
        await RentalRequest.create({
          listing:
            listing._id,

          requester:
            req.user!.id,

          owner:
            listing.owner,

          start_date:
            startDate,

          end_date:
            endDate,

          message:
            messageValue,

          status:
            'pending' satisfies RentalRequestStatus,
        });

      await populateRequest(
        rentalRequest
      );

      return res.status(201).json(
        formatRequest(
          rentalRequest
        )
      );
    } catch (error) {
      console.error(
        'Create rental request error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to create rental request',
      });
    }
  }
);

/**
 * Updates a rental request status after validating ownership
 * and its current state.
 */
async function updateOwnerRequest(
  req: Request,
  res: Response,
  newStatus:
    | 'approved'
    | 'rejected'
): Promise<Response> {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      error:
        'Invalid request ID',
    });
  }

  const rentalRequest =
    await RentalRequest.findById(id);

  if (!rentalRequest) {
    return res.status(404).json({
      error:
        'Request not found',
    });
  }

  if (
    rentalRequest.status !==
    'pending'
  ) {
    return res.status(400).json({
      error:
        'Only pending requests can be updated',
    });
  }

  if (
    rentalRequest.owner.toString() !==
    req.user!.id
  ) {
    return res.status(403).json({
      error:
        'Only the listing owner may update this request',
    });
  }

  rentalRequest.status =
    newStatus;

  await rentalRequest.save();

  await populateRequest(
    rentalRequest
  );

  return res.status(200).json(
    formatRequest(
      rentalRequest
    )
  );
}

/**
 * PATCH /api/requests/:id/approve
 */
router.patch(
  '/:id/approve',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      return await updateOwnerRequest(
        req,
        res,
        'approved'
      );
    } catch (error) {
      console.error(
        'Approve rental request error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to approve rental request',
      });
    }
  }
);

/**
 * PATCH /api/requests/:id/decline
 */
router.patch(
  '/:id/decline',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      return await updateOwnerRequest(
        req,
        res,
        'rejected'
      );
    } catch (error) {
      console.error(
        'Decline rental request error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to decline rental request',
      });
    }
  }
);

/**
 * PATCH /api/requests/:id/cancel
 */
router.patch(
  '/:id/cancel',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          error:
            'Invalid request ID',
        });
      }

      const rentalRequest =
        await RentalRequest.findById(
          id
        );

      if (!rentalRequest) {
        return res.status(404).json({
          error:
            'Request not found',
        });
      }

      if (
        rentalRequest.requester.toString() !==
        req.user!.id
      ) {
        return res.status(403).json({
          error:
            'Only the renter may cancel this request',
        });
      }

      if (
        rentalRequest.status !==
        'pending'
      ) {
        return res.status(400).json({
          error:
            'Only pending requests can be cancelled',
        });
      }

      rentalRequest.status =
        'cancelled';

      await rentalRequest.save();

      await populateRequest(
        rentalRequest
      );

      return res.status(200).json(
        formatRequest(
          rentalRequest
        )
      );
    } catch (error) {
      console.error(
        'Cancel rental request error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to cancel rental request',
      });
    }
  }
);

/**
 * PATCH /api/requests/:id/complete
 */
router.patch(
  '/:id/complete',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          error:
            'Invalid request ID',
        });
      }

      const rentalRequest =
        await RentalRequest.findById(
          id
        );

      if (!rentalRequest) {
        return res.status(404).json({
          error:
            'Request not found',
        });
      }

      if (
        rentalRequest.status !==
        'approved'
      ) {
        return res.status(400).json({
          error:
            'Only approved requests can be completed',
        });
      }

      const isOwner =
        rentalRequest.owner.toString() ===
        req.user!.id;

      const isRenter =
        rentalRequest.requester.toString() ===
        req.user!.id;

      if (!isOwner && !isRenter) {
        return res.status(403).json({
          error:
            'Access denied',
        });
      }

      rentalRequest.status =
        'completed';

      await rentalRequest.save();

      await populateRequest(
        rentalRequest
      );

      return res.status(200).json(
        formatRequest(
          rentalRequest
        )
      );
    } catch (error) {
      console.error(
        'Complete rental request error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to complete rental request',
      });
    }
  }
);

export default router;