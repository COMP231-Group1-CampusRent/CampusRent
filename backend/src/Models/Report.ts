import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
  type Types,
} from 'mongoose';

export type ReportStatus =
  | 'pending'
  | 'resolved';

export type AdminAction =
  | 'warning'
  | 'remove_listing'
  | 'suspend_user'
  | 'dismissed'
  | null;

export interface IReport {
  reporter: Types.ObjectId;

  reported_user?: Types.ObjectId | null;
  reported_listing?: Types.ObjectId | null;

  reason: string;
  details: string;

  status: ReportStatus;
  admin_action: AdminAction;

  resolved_at?: Date | null;

  created_at: Date;
  updated_at: Date;
}

export type ReportDocument =
  HydratedDocument<IReport>;

const reportSchema =
  new Schema<IReport>(
    {
      reporter: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [
          true,
          'Reporter is required',
        ],
        index: true,
      },

      reported_user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true,
      },

      reported_listing: {
        type: Schema.Types.ObjectId,
        ref: 'Listing',
        default: null,
        index: true,
      },

      reason: {
        type: String,
        required: [
          true,
          'Reason is required',
        ],
        trim: true,
        maxlength: [
          200,
          'Reason cannot exceed 200 characters',
        ],
      },

      details: {
        type: String,
        required: [
          true,
          'Details are required',
        ],
        trim: true,
        maxlength: [
          2000,
          'Details cannot exceed 2000 characters',
        ],
      },

      status: {
        type: String,
        enum: {
          values: [
            'pending',
            'resolved',
          ],
          message:
            'Invalid report status',
        },
        default: 'pending',
        index: true,
      },

      admin_action: {
        type: String,
        enum: {
          values: [
            'warning',
            'remove_listing',
            'suspend_user',
            'dismissed',
            null,
          ],
          message:
            'Invalid administrator action',
        },
        default: null,
      },

      resolved_at: {
        type: Date,
        default: null,
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

/**
 * A report must target at least one user or listing.
 *
 * This is synchronous validation. Throwing the error is the
 * correct approach here; the older next() callback caused:
 * TypeError: next is not a function
 */
reportSchema.pre(
  'validate',
  function validateReportTarget() {
    if (
      !this.reported_user &&
      !this.reported_listing
    ) {
      throw new Error(
        'A report must target a user or listing'
      );
    }
  }
);

reportSchema.index({
  status: 1,
  created_at: -1,
});

const Report: Model<IReport> =
  models.Report ||
  model<IReport>(
    'Report',
    reportSchema
  );

export default Report;