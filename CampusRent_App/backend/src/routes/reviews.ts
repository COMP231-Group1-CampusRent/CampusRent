import { Router } from 'express';
import { isValidObjectId } from 'mongoose';

import RentalRequest from '../Models/RentalRequest';
import Review from '../Models/Review';

import {
  authenticate,
  requireVerifiedStudent,
} from '../middleware/auth';

const router = Router();

function formatReview(review: any) {
  const reviewObject =
    typeof review.toObject === 'function'
      ? review.toObject()
      : review;

  const reviewer =
    reviewObject.reviewer;

  const reviewedUser =
    reviewObject.reviewed_user;

  const rentalRequest =
    reviewObject.rental_request;

  return {
    id:
      reviewObject._id?.toString?.() ??
      reviewObject.id,

    rental_request_id:
      rentalRequest?._id?.toString?.() ??
      rentalRequest?.toString?.(),

    reviewer_id:
      reviewer?._id?.toString?.() ??
      reviewer?.toString?.(),

    reviewee_id:
      reviewedUser?._id?.toString?.() ??
      reviewedUser?.toString?.(),

    reviewed_user_id:
      reviewedUser?._id?.toString?.() ??
      reviewedUser?.toString?.(),

    rating:
      reviewObject.rating,

    comment:
      reviewObject.comment,

    first_name:
      reviewer?.first_name,

    last_name:
      reviewer?.last_name,

    reviewer:
      reviewer &&
      typeof reviewer === 'object'
        ? {
            id:
              reviewer._id?.toString?.() ??
              reviewer.id,

            first_name:
              reviewer.first_name,

            last_name:
              reviewer.last_name,
          }
        : null,

    created_at:
      reviewObject.created_at,

    updated_at:
      reviewObject.updated_at,
  };
}

/**
 * POST /api/reviews
 *
 * Creates a review after a completed rental.
 */
router.post(
  '/',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const {
        rental_request_id,
        rating,
        comment,
      } = req.body;

      if (
        !rental_request_id ||
        rating === undefined ||
        rating === null
      ) {
        res.status(400).json({
          error:
            'Rental request and rating are required',
        });

        return;
      }

      if (
        !isValidObjectId(
          rental_request_id
        )
      ) {
        res.status(400).json({
          error:
            'Invalid rental request ID',
        });

        return;
      }

      const numericRating =
        Number(rating);

      if (
        !Number.isInteger(
          numericRating
        ) ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        res.status(400).json({
          error:
            'Rating must be an integer between 1 and 5',
        });

        return;
      }

      const rentalRequest =
        await RentalRequest.findById(
          rental_request_id
        );

      if (!rentalRequest) {
        res.status(404).json({
          error:
            'Rental request not found',
        });

        return;
      }

      if (
        rentalRequest.status !==
        'completed'
      ) {
        res.status(400).json({
          error:
            'Reviews can only be submitted after completed rentals',
        });

        return;
      }

      const currentUserId =
        req.user!.id;

      const renterId =
        rentalRequest.requester.toString();

      const ownerId =
        rentalRequest.owner.toString();

      const isRenter =
        renterId === currentUserId;

      const isOwner =
        ownerId === currentUserId;

      if (!isRenter && !isOwner) {
        res.status(403).json({
          error: 'Access denied',
        });

        return;
      }

      const reviewedUserId =
        isRenter
          ? ownerId
          : renterId;

      const existingReview =
        await Review.findOne({
          rental_request:
            rentalRequest._id,

          reviewer:
            currentUserId,
        });

      if (existingReview) {
        res.status(409).json({
          error:
            'You have already reviewed this rental',
        });

        return;
      }

      const review =
        await Review.create({
          rental_request:
            rentalRequest._id,

          reviewer:
            currentUserId,

          reviewed_user:
            reviewedUserId,

          rating:
            numericRating,

          comment:
            typeof comment === 'string'
              ? comment.trim()
              : '',
        });

      await review.populate(
        'reviewer',
        '_id first_name last_name'
      );

      res.status(201).json(
        formatReview(review)
      );
    } catch (error) {
      console.error(
        'Create review error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to create review',
      });
    }
  }
);

/**
 * GET /api/reviews/user/:userId
 *
 * Returns reviews received by a user.
 */
router.get(
  '/user/:userId',
  async (req, res) => {
    try {
      const { userId } =
        req.params;

      if (
        !isValidObjectId(userId)
      ) {
        res.status(400).json({
          error:
            'Invalid user ID',
        });

        return;
      }

      const reviews =
        await Review.find({
          reviewed_user: userId,
        })
          .populate(
            'reviewer',
            '_id first_name last_name'
          )
          .sort({
            created_at: -1,
          });

      res.json(
        reviews.map(formatReview)
      );
    } catch (error) {
      console.error(
        'Get user reviews error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to retrieve reviews',
      });
    }
  }
);

export default router;