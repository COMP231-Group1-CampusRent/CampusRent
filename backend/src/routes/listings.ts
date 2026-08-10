import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { isValidObjectId } from 'mongoose';

import Listing from '../Models/Listing';

import {
  authenticate,
  optionalAuth,
  requireVerifiedStudent,
} from '../middleware/auth';

import {
  isValidCategory,
  LISTING_CATEGORIES,
} from '../utils/validation';

const router = Router();

/**
 * CampusRent Listing Routes
 *
 * Responsibilities:
 * - Browse and search listings.
 * - Filter listings by category and availability.
 * - Create new listings.
 * - Edit listings.
 * - Remove listings.
 * - Change listing availability.
 * - Upload and manage listing images.
 * - Protect listing-owner contact information.
 */

// ---------------------------------------------------------
// Upload Directory
// ---------------------------------------------------------

const uploadsDir = path.join(
  __dirname,
  '..',
  '..',
  'uploads'
);

/**
 * Ensure that the uploads directory exists.
 */
fs.mkdirSync(uploadsDir, {
  recursive: true,
});

// ---------------------------------------------------------
// Multer Configuration
// ---------------------------------------------------------

/**
 * Store uploaded listing images on disk.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDir);
  },

  filename: (_req, file, callback) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}`;

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    callback(
      null,
      `${uniqueName}${extension}`
    );
  },
});

/**
 * Listing image upload rules.
 *
 * Maximum:
 * - 5 MB per image.
 *
 * Accepted formats:
 * - JPG
 * - JPEG
 * - PNG
 * - WEBP
 */
const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (
      allowedExtensions.includes(extension)
    ) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        'Only JPG, PNG, and WEBP images are allowed'
      )
    );
  },
});

// ---------------------------------------------------------
// File Cleanup Helpers
// ---------------------------------------------------------

/**
 * Remove newly uploaded files.
 *
 * This is used when validation fails or when an error occurs
 * after Multer has already stored files on disk.
 */
function removeUploadedFiles(
  files:
    | Express.Multer.File[]
    | undefined
): void {
  if (!files?.length) {
    return;
  }

  for (const file of files) {
    const filePath = path.join(
      uploadsDir,
      file.filename
    );

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(
        `Unable to remove uploaded file ${file.filename}:`,
        error
      );
    }
  }
}

/**
 * Remove images already associated with a listing.
 */
function removeStoredImages(
  images: Array<{
    filename?: string;
  }>
): void {
  for (const image of images) {
    if (!image.filename) {
      continue;
    }

    const filePath = path.join(
      uploadsDir,
      image.filename
    );

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(
        `Unable to remove listing image ${image.filename}:`,
        error
      );
    }
  }
}

// ---------------------------------------------------------
// Listing Response Formatter
// ---------------------------------------------------------

/**
 * Format a listing before returning it to the client.
 *
 * Guest users and unverified students receive limited owner
 * information.
 *
 * Verified students and administrators may receive the owner's
 * contact details.
 */
function formatListing(
  listing: any,
  isGuest: boolean,
  isVerified: boolean
) {
  const listingObject =
    typeof listing.toObject === 'function'
      ? listing.toObject()
      : listing;

  const owner = listingObject.owner;

  /**
   * Normalize listing images.
   *
   * Existing image URLs are kept when available.
   * If only a filename exists, a public /uploads URL is created.
   */
  const formattedImages = Array.isArray(
    listingObject.images
  )
    ? listingObject.images.map(
        (image: {
          filename?: string;
          url?: string;
        }) => ({
          filename: image.filename,

          url:
            image.url ||
            (image.filename
              ? `/uploads/${image.filename}`
              : ''),
        })
      )
    : [];

  const baseListing = {
    id:
      listingObject._id?.toString?.() ??
      listingObject.id,

    title: listingObject.title,

    category: listingObject.category,

    description:
      listingObject.description,

    rental_terms:
      listingObject.rental_terms,

    availability:
      listingObject.availability,

    images: formattedImages,

    created_at:
      listingObject.created_at,

    updated_at:
      listingObject.updated_at,
  };

  /**
   * US-10.4
   *
   * Hide private owner details from:
   * - guests
   * - unverified students
   */
  if (isGuest || !isVerified) {
    return {
      ...baseListing,

      owner: owner
        ? {
            id:
              owner._id?.toString?.() ??
              owner.id,

            first_name:
              owner.first_name,

            last_name: owner.last_name
              ? `${owner.last_name.charAt(
                  0
                )}.`
              : '',
          }
        : null,

      contact_hidden: true,
    };
  }

  /**
   * Verified users may receive the complete owner information.
   */
  return {
    ...baseListing,

    owner_id: owner
      ? owner._id?.toString?.() ??
        owner.id
      : listingObject.owner?.toString?.(),

    owner: owner
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

    contact_hidden: false,
  };
}

// ---------------------------------------------------------
// GET Listing Categories
// ---------------------------------------------------------

/**
 * GET /api/listings/categories
 *
 * Returns all supported listing categories.
 */
router.get(
  '/categories',
  (_req, res) => {
    res.json(LISTING_CATEGORIES);
  }
);

// ---------------------------------------------------------
// GET All Listings
// ---------------------------------------------------------

/**
 * GET /api/listings
 *
 * US-08.4:
 * Filter catalog by availability.
 *
 * US-09.4:
 * Filter catalog by category and availability.
 *
 * US-10.4:
 * Protect owner contact information.
 */
router.get(
  '/',
  optionalAuth,
  async (req, res) => {
    try {
      const {
        q,
        category,
        availability,
        page = '1',
        limit = '12',
      } = req.query;

      const isGuest = !req.user;

      const isVerified =
        req.user?.role === 'admin' ||
        req.user
          ?.verification_status ===
          'verified';

      const filter: Record<
        string,
        unknown
      > = {};

      /**
       * Guests and unverified students may only
       * see available listings.
       */
      if (isGuest || !isVerified) {
        filter.availability =
          'available';
      }

      // -----------------------------------------------------
      // Search
      // -----------------------------------------------------

      if (
        typeof q === 'string' &&
        q.trim()
      ) {
        const escapedSearch =
          q
            .trim()
            .replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&'
            );

        filter.$or = [
          {
            title: {
              $regex: escapedSearch,
              $options: 'i',
            },
          },
          {
            description: {
              $regex: escapedSearch,
              $options: 'i',
            },
          },
        ];
      }

      // -----------------------------------------------------
      // Category Filter
      // -----------------------------------------------------

      if (
        typeof category === 'string' &&
        category.trim()
      ) {
        const normalizedCategory =
          category.trim();

        if (
          !isValidCategory(
            normalizedCategory
          )
        ) {
          res.status(400).json({
            error:
              'Invalid listing category',
          });

          return;
        }

        filter.category =
          normalizedCategory;
      }

      // -----------------------------------------------------
      // Availability Filter
      // -----------------------------------------------------

      if (
        typeof availability ===
          'string' &&
        availability.trim()
      ) {
        const normalizedAvailability =
          availability
            .trim()
            .toLowerCase();

        if (
          ![
            'available',
            'unavailable',
          ].includes(
            normalizedAvailability
          )
        ) {
          res.status(400).json({
            error:
              'Availability must be available or unavailable',
          });

          return;
        }

        /**
         * Guests and unverified users remain restricted
         * to available listings.
         *
         * Verified users may filter using either valid status.
         */
        if (isVerified) {
          filter.availability =
            normalizedAvailability;
        }
      }

      // -----------------------------------------------------
      // Pagination
      // -----------------------------------------------------

      const pageNumber = Math.max(
        1,
        Number.parseInt(
          String(page),
          10
        ) || 1
      );

      const limitNumber = Math.min(
        50,
        Math.max(
          1,
          Number.parseInt(
            String(limit),
            10
          ) || 12
        )
      );

      const skip =
        (pageNumber - 1) *
        limitNumber;

      // -----------------------------------------------------
      // Database Query
      // -----------------------------------------------------

      const [total, listings] =
        await Promise.all([
          Listing.countDocuments(
            filter
          ),

          Listing.find(filter)
            .populate(
              'owner',
              '_id first_name last_name email phone'
            )
            .sort({
              created_at: -1,
            })
            .skip(skip)
            .limit(limitNumber),
        ]);

      res.json({
        listings: listings.map(
          (listing) =>
            formatListing(
              listing,
              isGuest,
              isVerified
            )
        ),

        pagination: {
          page: pageNumber,

          limit: limitNumber,

          total,

          pages: Math.ceil(
            total / limitNumber
          ),
        },

        guest_preview:
          isGuest || !isVerified,
      });
    } catch (error) {
      console.error(
        'Get listings error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to retrieve listings',
      });
    }
  }
);

// ---------------------------------------------------------
// GET Current User Listings
// ---------------------------------------------------------

/**
 * GET /api/listings/mine
 *
 * Returns listings owned by the authenticated student.
 */
router.get(
  '/mine',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const listings =
        await Listing.find({
          owner: req.user!.id,
        })
          .populate(
            'owner',
            '_id first_name last_name email phone'
          )
          .sort({
            created_at: -1,
          });

      res.json(
        listings.map((listing) =>
          formatListing(
            listing,
            false,
            true
          )
        )
      );
    } catch (error) {
      console.error(
        'Get my listings error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to retrieve your listings',
      });
    }
  }
);

// ---------------------------------------------------------
// GET Listing by ID
// ---------------------------------------------------------

/**
 * GET /api/listings/:id
 */
router.get(
  '/:id',
  optionalAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        res.status(400).json({
          error:
            'Invalid listing ID',
        });

        return;
      }

      const listing =
        await Listing.findById(
          id
        ).populate(
          'owner',
          '_id first_name last_name email phone'
        );

      if (!listing) {
        res.status(404).json({
          error:
            'Listing not found',
        });

        return;
      }

      const isGuest = !req.user;

      const isVerified =
        req.user?.role === 'admin' ||
        req.user
          ?.verification_status ===
          'verified';

      res.json(
        formatListing(
          listing,
          isGuest,
          isVerified
        )
      );
    } catch (error) {
      console.error(
        'Get listing error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to retrieve listing',
      });
    }
  }
);

// ---------------------------------------------------------
// CREATE Listing
// ---------------------------------------------------------

/**
 * POST /api/listings
 *
 * US-04.3:
 * Create and persist a new listing and automatically
 * assign the authenticated user as its owner.
 */
router.post(
  '/',
  authenticate,
  requireVerifiedStudent,
  upload.array('images', 5),
  async (req, res) => {
    const files = req.files as
      | Express.Multer.File[]
      | undefined;

    try {
      const {
        title,
        category,
        description,
        rental_terms,
        availability,
      } = req.body;

      // -----------------------------------------------------
      // Validate Title
      // -----------------------------------------------------

      if (!title?.trim()) {
        removeUploadedFiles(files);

        res.status(400).json({
          error:
            'Title is required',
        });

        return;
      }

      // -----------------------------------------------------
      // Validate Category
      // -----------------------------------------------------

      if (
        !category ||
        !isValidCategory(category)
      ) {
        removeUploadedFiles(files);

        res.status(400).json({
          error:
            'Valid category is required',
        });

        return;
      }

      // -----------------------------------------------------
      // Validate Description
      // -----------------------------------------------------

      if (!description?.trim()) {
        removeUploadedFiles(files);

        res.status(400).json({
          error:
            'Description is required',
        });

        return;
      }

      // -----------------------------------------------------
      // Create Listing
      // -----------------------------------------------------

      const listing =
        await Listing.create({
          owner: req.user!.id,

          title:
            String(title).trim(),

          category:
            String(category).trim(),

          description:
            String(
              description
            ).trim(),

          rental_terms:
            rental_terms
              ? String(
                  rental_terms
                ).trim()
              : '',

          availability:
            availability ===
            'unavailable'
              ? 'unavailable'
              : 'available',

          images:
            files?.map(
              (file) => ({
                filename:
                  file.filename,

                url:
                  `/uploads/${file.filename}`,
              })
            ) ?? [],
        });

      await listing.populate(
        'owner',
        '_id first_name last_name email phone'
      );

      res.status(201).json(
        formatListing(
          listing,
          false,
          true
        )
      );
    } catch (error) {
      removeUploadedFiles(files);

      console.error(
        'Create listing error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to create listing',
      });
    }
  }
);

// ---------------------------------------------------------
// UPDATE Listing
// ---------------------------------------------------------

/**
 * PUT /api/listings/:id
 *
 * US-05.5:
 * Only the owner of a listing may edit it.
 */
router.put(
  '/:id',
  authenticate,
  requireVerifiedStudent,
  upload.array('images', 5),
  async (req, res) => {
    const files = req.files as
      | Express.Multer.File[]
      | undefined;

    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        removeUploadedFiles(files);

        res.status(400).json({
          error:
            'Invalid listing ID',
        });

        return;
      }

      const listing =
        await Listing.findById(id);

      if (!listing) {
        removeUploadedFiles(files);

        res.status(404).json({
          error:
            'Listing not found',
        });

        return;
      }

      /**
       * Owner-only authorization.
       */
      if (
        listing.owner.toString() !==
        req.user!.id
      ) {
        removeUploadedFiles(files);

        res.status(403).json({
          error:
            'Only listing owners may edit listings',
        });

        return;
      }

      const {
        title,
        category,
        description,
        rental_terms,
      } = req.body;

      // -----------------------------------------------------
      // Validation
      // -----------------------------------------------------

      if (!title?.trim()) {
        removeUploadedFiles(files);

        res.status(400).json({
          error:
            'Title is required',
        });

        return;
      }

      if (
        !category ||
        !isValidCategory(category)
      ) {
        removeUploadedFiles(files);

        res.status(400).json({
          error:
            'Valid category is required',
        });

        return;
      }

      if (!description?.trim()) {
        removeUploadedFiles(files);

        res.status(400).json({
          error:
            'Description is required',
        });

        return;
      }

      // -----------------------------------------------------
      // Update Fields
      // -----------------------------------------------------

      listing.title =
        String(title).trim();

      listing.category =
        String(category).trim();

      listing.description =
        String(
          description
        ).trim();

      listing.rental_terms =
        rental_terms
          ? String(
              rental_terms
            ).trim()
          : '';

      // -----------------------------------------------------
      // Add New Images
      // -----------------------------------------------------

      const remainingImageSlots =
        Math.max(
          0,
          5 - listing.images.length
        );

      const acceptedFiles =
        files?.slice(
          0,
          remainingImageSlots
        ) ?? [];

      const rejectedFiles =
        files?.slice(
          remainingImageSlots
        ) ?? [];

      /**
       * Remove images exceeding the five-image limit.
       */
      removeUploadedFiles(
        rejectedFiles
      );

      for (const file of acceptedFiles) {
        listing.images.push({
          filename:
            file.filename,

          url:
            `/uploads/${file.filename}`,
        });
      }

      await listing.save();

      await listing.populate(
        'owner',
        '_id first_name last_name email phone'
      );

      res.json(
        formatListing(
          listing,
          false,
          true
        )
      );
    } catch (error) {
      removeUploadedFiles(files);

      console.error(
        'Update listing error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to update listing',
      });
    }
  }
);

// ---------------------------------------------------------
// UPDATE Listing Availability
// ---------------------------------------------------------

/**
 * PATCH /api/listings/:id/availability
 *
 * US-07.3:
 * Only a listing owner may change its availability.
 */
router.patch(
  '/:id/availability',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        res.status(400).json({
          error:
            'Invalid listing ID',
        });

        return;
      }

      const listing =
        await Listing.findById(id);

      if (!listing) {
        res.status(404).json({
          error:
            'Listing not found',
        });

        return;
      }

      if (
        listing.owner.toString() !==
        req.user!.id
      ) {
        res.status(403).json({
          error:
            'Only listing owners may update availability',
        });

        return;
      }

      const { availability } =
        req.body;

      if (
        ![
          'available',
          'unavailable',
        ].includes(availability)
      ) {
        res.status(400).json({
          error:
            'Availability must be available or unavailable',
        });

        return;
      }

      listing.availability =
        availability;

      await listing.save();

      await listing.populate(
        'owner',
        '_id first_name last_name email phone'
      );

      res.json(
        formatListing(
          listing,
          false,
          true
        )
      );
    } catch (error) {
      console.error(
        'Update availability error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to update listing availability',
      });
    }
  }
);

// ---------------------------------------------------------
// DELETE Listing
// ---------------------------------------------------------

/**
 * DELETE /api/listings/:id
 *
 * US-06.3:
 * Only the listing owner may remove a listing.
 *
 * Associated image files are also deleted.
 */
router.delete(
  '/:id',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        res.status(400).json({
          error:
            'Invalid listing ID',
        });

        return;
      }

      const listing =
        await Listing.findById(id);

      if (!listing) {
        res.status(404).json({
          error:
            'Listing not found',
        });

        return;
      }

      /**
       * Owner-only authorization.
       */
      if (
        listing.owner.toString() !==
        req.user!.id
      ) {
        res.status(403).json({
          error:
            'Only listing owners may remove listings',
        });

        return;
      }

      /**
       * Remove associated image files before deleting
       * the database record.
       */
      removeStoredImages(
        listing.images
      );

      await listing.deleteOne();

      res.json({
        message:
          'Listing removed successfully',
      });
    } catch (error) {
      console.error(
        'Delete listing error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to remove listing',
      });
    }
  }
);

export default router;