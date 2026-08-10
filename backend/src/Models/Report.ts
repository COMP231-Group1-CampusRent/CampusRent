import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
  type Types,
} from 'mongoose';

/**
 * Possible statuses for a report.
 */
export type ReportStatus =
  | 'pending'
  | 'resolved';

/**
 * Actions that an administrator can take
 * after reviewing a report.
 */
export type AdminAction =
  | 'warning'
  | 'remove_listing'
  | 'suspend_user'
  | 'dismissed'
  | null;

/**
 * Defines the type of entity being reported.
 *
 * A report can target either:
 * - a user
 * - a listing
 */
export type ReportTargetType =
  | 'user'
  | 'listing';

/**
 * TypeScript representation of a CampusRent report.
 */
export interface IReport {
  /**
   * User who created the report.
   */
  reporter: Types.ObjectId;

  /**
   * User being reported.
   *
   * This field is used when the report targets a user.
   */
  reported_user?: Types.ObjectId | null;

  /**
   * Listing being reported.
   *
   * This field is used when the report targets a listing.
   */
  reported_listing?: Types.ObjectId | null;

  /**
   * Short reason describing why the report was created.
   */
  reason: string;

  /**
   * Additional information provided by the reporter.
   */
  details: string;

  /**
   * Current report status.
   */
  status: ReportStatus;

  /**
   * Administrative action taken after reviewing the report.
   */
  admin_action: AdminAction;

  /**
   * Date when the report was resolved.
   */
  resolved_at?: Date | null;

  /**
   * Automatically generated creation timestamp.
   */
  created_at: Date;

  /**
   * Automatically generated update timestamp.
   */
  updated_at: Date;
}

/**
 * Mongoose document type for a report.
 */
export type ReportDocument =
  HydratedDocument<IReport>;

/**
 * MongoDB schema for CampusRent reports.
 */
const reportSchema = new Schema<IReport>(
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
    /**
     * Automatically creates:
     *
     * created_at
     * updated_at
     */
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },

    versionKey: false,

    collection: 'reports',
  }
);

/**
 * Validate that the report targets at least
 * one CampusRent resource.
 *
 * A report must contain either:
 *
 * reported_user
 *
 * OR
 *
 * reported_listing
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

/**
 * Index reports by status and creation date.
 *
 * This improves administrative queries such as
 * retrieving the newest pending reports.
 */
reportSchema.index({
  status: 1,
  created_at: -1,
});

/**
 * Reuse the existing model when available.
 *
 * This avoids Mongoose model recompilation errors
 * during development or application reloads.
 */
const Report: Model<IReport> =
  (models.Report as Model<IReport>) ||
  model<IReport>(
    'Report',
    reportSchema
  );

export default Report;