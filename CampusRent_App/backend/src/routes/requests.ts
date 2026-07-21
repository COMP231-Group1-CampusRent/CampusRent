import { Router } from 'express';
import { isValidObjectId } from 'mongoose';

import Listing from '../Models/Listing';
import RentalRequest from '../Models/RentalRequest';

import {
  authenticate,
  requireVerifiedStudent,
} from '../middleware/auth';

const router = Router();

async function populateRequest(request: any) {
  await request.populate([
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

  return request;
}

function formatRequest(request: any) {
  const requestObject =
    typeof request.toObject === 'function'
      ? request.toObject()
      : request;

  const listing = requestObject.listing;
  const requester = requestObject.requester;
  const owner = requestObject.owner;

  return {
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

    start_date: requestObject.start_date,
    end_date: requestObject.end_date,
    message: requestObject.message,
    status: requestObject.status,
    created_at: requestObject.created_at,
    updated_at: requestObject.updated_at,

    listing:
      listing &&
      typeof listing === 'object'
        ? {
            id:
              listing._id?.toString?.() ??
              listing.id,

            title: listing.title,
            category: listing.category,
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
            id:
              requester._id?.toString?.() ??
              requester.id,

            first_name:
              requester.first_name,

            last_name:
              requester.last_name,

            email: requester.email,
            phone: requester.phone,
          }
        : null,

    owner:
      owner &&
      typeof owner === 'object'
        ? {
            id:
              owner._id?.toString?.() ??
              owner.id,

            first_name:
              owner.first_name,

            last_name:
              owner.last_name,

            email: owner.email,
            phone: owner.phone,
          }
        : null,
  };
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

      res.json(
        requests.map(formatRequest)
      );
    } catch (error) {
      console.error(
        'Get outgoing requests error:',
        error
      );

      res.status(500).json({
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

      res.json(
        requests.map(formatRequest)
      );
    } catch (error) {
      console.error(
        'Get incoming requests error:',
        error
      );

      res.status(500).json({
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
  async (req, res) => {
    try {
      const {
        listing_id,
        start_date,
        end_date,
        message,
      } = req.body;

      if (
        !listing_id ||
        !start_date ||
        !end_date
      ) {
        res.status(400).json({
          error:
            'Listing and rental dates are required',
        });

        return;
      }

      if (!isValidObjectId(listing_id)) {
        res.status(400).json({
          error: 'Invalid listing ID',
        });

        return;
      }

      const startDate =
        new Date(start_date);

      const endDate =
        new Date(end_date);

      if (
        Number.isNaN(
          startDate.getTime()
        ) ||
        Number.isNaN(
          endDate.getTime()
        )
      ) {
        res.status(400).json({
          error:
            'Valid rental dates are required',
        });

        return;
      }

      if (endDate < startDate) {
        res.status(400).json({
          error:
            'End date must be after start date',
        });

        return;
      }

      const listing =
        await Listing.findById(
          listing_id
        );

      if (!listing) {
        res.status(404).json({
          error: 'Listing not found',
        });

        return;
      }

      if (
        listing.availability !==
        'available'
      ) {
        res.status(400).json({
          error:
            'This item is not available for rental',
        });

        return;
      }

      if (
        listing.owner.toString() ===
        req.user!.id
      ) {
        res.status(400).json({
          error:
            'You cannot request your own listing',
        });

        return;
      }

      const existingRequest =
        await RentalRequest.findOne({
          listing: listing._id,
          requester: req.user!.id,
          status: 'pending',
        });

      if (existingRequest) {
        res.status(409).json({
          error:
            'You already have a pending request for this listing',
        });

        return;
      }

      const rentalRequest =
        await RentalRequest.create({
          listing: listing._id,
          requester: req.user!.id,
          owner: listing.owner,

          start_date: startDate,
          end_date: endDate,

          message:
            typeof message === 'string'
              ? message.trim()
              : '',

          status: 'pending',
        });

      await populateRequest(
        rentalRequest
      );

      res.status(201).json(
        formatRequest(rentalRequest)
      );
    } catch (error) {
      console.error(
        'Create rental request error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to create rental request',
      });
    }
  }
);

/**
 * PATCH /api/requests/:id/approve
 */
router.patch(
  '/:id/approve',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        res.status(400).json({
          error: 'Invalid request ID',
        });

        return;
      }

      const rentalRequest =
        await RentalRequest.findById(id);

      if (!rentalRequest) {
        res.status(404).json({
          error: 'Request not found',
        });

        return;
      }

      if (
        rentalRequest.status !==
        'pending'
      ) {
        res.status(400).json({
          error:
            'Only pending requests can be approved',
        });

        return;
      }

      if (
        rentalRequest.owner.toString() !==
        req.user!.id
      ) {
        res.status(403).json({
          error:
            'Only listing owners may approve requests',
        });

        return;
      }

      rentalRequest.status =
        'approved';

      await rentalRequest.save();

      await populateRequest(
        rentalRequest
      );

      res.json(
        formatRequest(rentalRequest)
      );
    } catch (error) {
      console.error(
        'Approve rental request error:',
        error
      );

      res.status(500).json({
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
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        res.status(400).json({
          error: 'Invalid request ID',
        });

        return;
      }

      const rentalRequest =
        await RentalRequest.findById(id);

      if (!rentalRequest) {
        res.status(404).json({
          error: 'Request not found',
        });

        return;
      }

      if (
        rentalRequest.status !==
        'pending'
      ) {
        res.status(400).json({
          error:
            'Only pending requests can be declined',
        });

        return;
      }

      if (
        rentalRequest.owner.toString() !==
        req.user!.id
      ) {
        res.status(403).json({
          error:
            'Only listing owners may decline requests',
        });

        return;
      }

      rentalRequest.status =
        'rejected';

      await rentalRequest.save();

      await populateRequest(
        rentalRequest
      );

      res.json(
        formatRequest(rentalRequest)
      );
    } catch (error) {
      console.error(
        'Decline rental request error:',
        error
      );

      res.status(500).json({
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
        res.status(400).json({
          error: 'Invalid request ID',
        });

        return;
      }

      const rentalRequest =
        await RentalRequest.findById(id);

      if (!rentalRequest) {
        res.status(404).json({
          error: 'Request not found',
        });

        return;
      }

      if (
        rentalRequest.requester.toString() !==
        req.user!.id
      ) {
        res.status(403).json({
          error:
            'Only the renter may cancel this request',
        });

        return;
      }

      if (
        rentalRequest.status !==
        'pending'
      ) {
        res.status(400).json({
          error:
            'Only pending requests can be cancelled',
        });

        return;
      }

      rentalRequest.status =
        'cancelled';

      await rentalRequest.save();

      await populateRequest(
        rentalRequest
      );

      res.json(
        formatRequest(rentalRequest)
      );
    } catch (error) {
      console.error(
        'Cancel rental request error:',
        error
      );

      res.status(500).json({
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
        res.status(400).json({
          error: 'Invalid request ID',
        });

        return;
      }

      const rentalRequest =
        await RentalRequest.findById(id);

      if (!rentalRequest) {
        res.status(404).json({
          error: 'Request not found',
        });

        return;
      }

      if (
        rentalRequest.status !==
        'approved'
      ) {
        res.status(400).json({
          error:
            'Only approved requests can be completed',
        });

        return;
      }

      const isOwner =
        rentalRequest.owner.toString() ===
        req.user!.id;

      const isRenter =
        rentalRequest.requester.toString() ===
        req.user!.id;

      if (!isOwner && !isRenter) {
        res.status(403).json({
          error: 'Access denied',
        });

        return;
      }

      rentalRequest.status =
        'completed';

      await rentalRequest.save();

      await populateRequest(
        rentalRequest
      );

      res.json(
        formatRequest(rentalRequest)
      );
    } catch (error) {
      console.error(
        'Complete rental request error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to complete rental request',
      });
    }
  }
);

export default router;