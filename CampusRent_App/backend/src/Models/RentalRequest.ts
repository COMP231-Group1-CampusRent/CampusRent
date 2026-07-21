import mongoose, {
  Document,
  Schema,
  Types,
} from 'mongoose';

export type RentalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed';

export interface IRentalRequest {
  listing: Types.ObjectId;
  requester: Types.ObjectId;
  owner: Types.ObjectId;

  start_date: Date;
  end_date: Date;

  message: string;
  status: RentalRequestStatus;

  created_at: Date;
  updated_at: Date;
}

export type RentalRequestDocument =
  Document<unknown, {}, IRentalRequest> &
  IRentalRequest & {
    _id: Types.ObjectId;
  };

const rentalRequestSchema =
  new Schema<IRentalRequest>(
    {
      listing: {
        type: Schema.Types.ObjectId,
        ref: 'Listing',
        required: true,
      },

      requester: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },

      owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },

      start_date: {
        type: Date,
        required: true,
      },

      end_date: {
        type: Date,
        required: true,
      },

      message: {
        type: String,
        default: '',
        trim: true,
      },

      status: {
        type: String,
        enum: [
          'pending',
          'approved',
          'rejected',
          'cancelled',
          'completed',
        ],
        default: 'pending',
        required: true,
      },
    },
    {
      timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    }
  );

rentalRequestSchema.index({
  listing: 1,
  requester: 1,
  status: 1,
});

const RentalRequest =
  mongoose.models.RentalRequest ||
  mongoose.model<IRentalRequest>(
    'RentalRequest',
    rentalRequestSchema
  );

export default RentalRequest;