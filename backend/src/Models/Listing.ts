import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
  type Types,
} from 'mongoose';

export type ListingAvailability =
  | 'available'
  | 'unavailable';

export interface IListingImage {
  filename: string;
  url: string;
}

export interface IListing {
  owner: Types.ObjectId;
  title: string;
  category: string;
  description: string;
  rental_terms: string;
  availability: ListingAvailability;
  images: IListingImage[];
  created_at: Date;
  updated_at: Date;
}

export type ListingDocument =
  HydratedDocument<IListing>;

const listingImageSchema =
  new Schema<IListingImage>(
    {
      filename: {
        type: String,
        required: true,
        trim: true,
      },

      url: {
        type: String,
        required: true,
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const listingSchema =
  new Schema<IListing>(
    {
      owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [
          true,
          'Listing owner is required',
        ],
        index: true,
      },

      title: {
        type: String,
        required: [
          true,
          'Title is required',
        ],
        trim: true,
        maxlength: [
          150,
          'Title cannot exceed 150 characters',
        ],
      },

      category: {
        type: String,
        required: [
          true,
          'Category is required',
        ],
        trim: true,
        index: true,
      },

      description: {
        type: String,
        required: [
          true,
          'Description is required',
        ],
        trim: true,
        maxlength: [
          3000,
          'Description cannot exceed 3000 characters',
        ],
      },

      rental_terms: {
        type: String,
        trim: true,
        default: '',
        maxlength: [
          2000,
          'Rental terms cannot exceed 2000 characters',
        ],
      },

      availability: {
        type: String,
        enum: {
          values: [
            'available',
            'unavailable',
          ],
          message:
            'Availability must be available or unavailable',
        },
        default: 'available',
        index: true,
      },

      images: {
        type: [listingImageSchema],
        default: [],
        validate: {
          validator(
            images: IListingImage[]
          ) {
            return images.length <= 5;
          },
          message:
            'A listing can contain a maximum of 5 images',
        },
      },
    },
    {
      timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },

      versionKey: false,

      collection: 'listings',
    }
  );

listingSchema.index({
  title: 'text',
  description: 'text',
});

listingSchema.index({
  owner: 1,
  created_at: -1,
});

listingSchema.index({
  category: 1,
  availability: 1,
  created_at: -1,
});

const Listing: Model<IListing> =
  models.Listing ||
  model<IListing>(
    'Listing',
    listingSchema
  );

export default Listing;