import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
  type Types,
} from 'mongoose';

export type ReportTargetType =
  | 'user'
  | 'listing'
  | 'message'
  | 'review';

export type ReportStatus =
  | 'open'
  | 'under_review'
  | 'resolved'
  | 'dismissed';

export interface IReport {
  reporter: Types.ObjectId;
  target_type: ReportTargetType;
  target_id: Types.ObjectId;
  reason: string;
  details: string;
  status: ReportStatus;
  reviewed_by?: Types.ObjectId | null;
  resolution_notes: string;
  created_at: Date;
  updated_at: Date;
}

export type ReportDocument =
  HydratedDocument<IReport>;

const reportSchema = new Schema<IReport>(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required'],
      index: true,
    },

    target_type: {
      type: String,
      enum: {
        values: [
          'user',
          'listing',
          'message',
          'review',
        ],
        message: 'Invalid report target type',
      },
      required: [
        true,
        'Report target type is required',
      ],
      index: true,
    },

    target_id: {
      type: Schema.Types.ObjectId,
      required: [
        true,
        'Report target ID is required',
      ],
      index: true,
    },

    reason: {
      type: String,
      required: [
        true,
        'Report reason is required',
      ],
      trim: true,
      maxlength: [
        200,
        'Report reason cannot exceed 200 characters',
      ],
    },

    details: {
      type: String,
      trim: true,
      default: '',
      maxlength: [
        3000,
        'Report details cannot exceed 3000 characters',
      ],
    },

    status: {
      type: String,
      enum: {
        values: [
          'open',
          'under_review',
          'resolved',
          'dismissed',
        ],
        message: 'Invalid report status',
      },
      default: 'open',
      index: true,
    },

    reviewed_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    resolution_notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [
        3000,
        'Resolution notes cannot exceed 3000 characters',
      ],
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    versionKey: false,
    collection: 'reports',
  }
);

reportSchema.index({
  status: 1,
  created_at: -1,
});

reportSchema.index({
  reporter: 1,
  created_at: -1,
});

reportSchema.index({
  target_type: 1,
  target_id: 1,
});

const Report: Model<IReport> =
  models.Report ||
  model<IReport>(
    'Report',
    reportSchema
  );

export default Report;