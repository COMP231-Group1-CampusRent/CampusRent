import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
  type Types,
} from 'mongoose';

export interface IReview {
  reviewer: Types.ObjectId;
  reviewed_user: Types.ObjectId;
  listing?: Types.ObjectId | null;
  rental_request?: Types.ObjectId | null;
  rating: number;
  comment: string;
  created_at: Date;
  updated_at: Date;
}

export type ReviewDocument = HydratedDocument<IReview>;

const reviewSchema = new Schema<IReview>(
  {
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer is required'],
      index: true,
    },

    reviewed_user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewed user is required'],
      index: true,
    },

    listing: {
      type: Schema.Types.ObjectId,
      ref: 'Listing',
      default: null,
      index: true,
    },

    rental_request: {
      type: Schema.Types.ObjectId,
      ref: 'RentalRequest',
      default: null,
      index: true,
    },

    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot be greater than 5'],
      validate: {
        validator(value: number) {
          return Number.isInteger(value);
        },
        message: 'Rating must be a whole number',
      },
    },

    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: [
        2000,
        'Review comment cannot exceed 2000 characters',
      ],
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    versionKey: false,
    collection: 'reviews',
  }
);

reviewSchema.pre('validate', function () {
  if (
    this.reviewer &&
    this.reviewed_user &&
    this.reviewer.toString() ===
      this.reviewed_user.toString()
  ) {
    throw new Error(
      'A user cannot review themselves'
    );
  }
});

reviewSchema.index({
  reviewed_user: 1,
  created_at: -1,
});

reviewSchema.index({
  reviewer: 1,
  created_at: -1,
});

reviewSchema.index(
  {
    rental_request: 1,
    reviewer: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      rental_request: {
        $type: 'objectId',
      },
    },
  }
);

const Review: Model<IReview> =
  models.Review ||
  model<IReview>(
    'Review',
    reviewSchema
  );

export default Review;