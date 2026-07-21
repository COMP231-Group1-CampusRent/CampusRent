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

const uploadsDir = path.join(
  __dirname,
  '..',
  '..',
  'uploads'
);

fs.mkdirSync(uploadsDir, {
  recursive: true,
});

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

/**
 * GET /api/listings/categories
 */
router.get(
  '/categories',
  (_req, res) => {
    res.json(LISTING_CATEGORIES);
  }
);

/**
 * GET /api/listings
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

      if (isGuest || !isVerified) {
        filter.availability =
          'available';
      }

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

      if (
        typeof category === 'string' &&
        category.trim()
      ) {
        filter.category =
          category.trim();
      }

      if (
        typeof availability ===
          'string' &&
        isVerified &&
        [
          'available',
          'unavailable',
        ].includes(availability)
      ) {
        filter.availability =
          availability;
      }

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

/**
 * GET /api/listings/mine
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
        await Listing.findById(id).populate(
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

/**
 * POST /api/listings
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

      const listing =
        await Listing.create({
          owner: req.user!.id,

          title:
            String(title).trim(),

          category:
            String(category).trim(),

          description:
            String(description).trim(),

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
            files?.map((file) => ({
              filename:
                file.filename,

              url: `/uploads/${file.filename}`,
            })) ?? [],
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

/**
 * PUT /api/listings/:id
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

      listing.title =
        String(title).trim();

      listing.category =
        String(category).trim();

      listing.description =
        String(description).trim();

      listing.rental_terms =
        rental_terms
          ? String(
              rental_terms
            ).trim()
          : '';

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

      removeUploadedFiles(
        rejectedFiles
      );

      for (const file of acceptedFiles) {
        listing.images.push({
          filename: file.filename,
          url: `/uploads/${file.filename}`,
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

/**
 * PATCH /api/listings/:id/availability
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

/**
 * DELETE /api/listings/:id
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