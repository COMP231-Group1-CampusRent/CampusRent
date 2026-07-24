import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
} from 'mongoose';

/**
 * Defines the roles supported by the CampusRent application.
 *
 * student:
 * Standard user who can register, create listings, and request rentals.
 *
 * admin:
 * Administrative user with access to moderation and management features.
 */
export type UserRole = 'student' | 'admin';

/**
 * Represents the institutional-email verification process.
 *
 * pending:
 * The user registered successfully but has not yet been verified.
 *
 * verified:
 * The institutional email or student identity was successfully verified.
 *
 * rejected:
 * The verification request was rejected.
 */
export type VerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected';

/**
 * Represents the operational status of a user account.
 *
 * active:
 * The user can access the application normally.
 *
 * suspended:
 * The account has been temporarily disabled.
 */
export type AccountStatus =
  | 'active'
  | 'suspended';

/**
 * Defines the structure of a CampusRent user document.
 */
export interface IUser {
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string;
  bio: string;
  role: UserRole;
  verification_status: VerificationStatus;
  status: AccountStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * Hydrated Mongoose document type.
 *
 * Includes both IUser properties and Mongoose document methods.
 */
export type UserDocument =
  HydratedDocument<IUser>;

/**
 * Mongoose schema used to store CampusRent users.
 *
 * Related requirement:
 * Task US-03.4 – Institutional-email and verification-status validation.
 */
const userSchema = new Schema<IUser>(
  {
    /**
     * User's institutional email address.
     *
     * This field is normalized to lowercase and trimmed before storage.
     * Domain validation should also be performed in the registration route
     * before the user is created.
     */
    email: {
      type: String,
      required: [
        true,
        'Email is required',
      ],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    /**
     * Securely hashed password.
     *
     * The original password must never be stored directly.
     * select: false prevents the hash from being returned by default.
     */
    password_hash: {
      type: String,
      required: [
        true,
        'Password is required',
      ],
      select: false,
    },

    /**
     * User's first name.
     */
    first_name: {
      type: String,
      required: [
        true,
        'First name is required',
      ],
      trim: true,
      maxlength: [
        100,
        'First name cannot exceed 100 characters',
      ],
    },

    /**
     * User's last name.
     */
    last_name: {
      type: String,
      required: [
        true,
        'Last name is required',
      ],
      trim: true,
      maxlength: [
        100,
        'Last name cannot exceed 100 characters',
      ],
    },

    /**
     * Optional user phone number.
     */
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: [
        30,
        'Phone number cannot exceed 30 characters',
      ],
    },

    /**
     * Optional profile description.
     */
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: [
        1000,
        'Bio cannot exceed 1000 characters',
      ],
    },

    /**
     * Determines the user's application permissions.
     *
     * New registrations receive the student role by default.
     */
    role: {
      type: String,
      enum: {
        values: [
          'student',
          'admin',
        ],
        message:
          'Role must be student or admin',
      },
      default: 'student',
    },

    /**
     * Tracks the institutional-email verification process.
     *
     * Task US-03.4 requirement:
     * Every new registration must begin with a pending verification status.
     */
    verification_status: {
      type: String,
      enum: {
        values: [
          'pending',
          'verified',
          'rejected',
        ],
        message:
          'Invalid verification status',
      },
      default: 'pending',
    },

    /**
     * Determines whether the user account can access the system.
     */
    status: {
      type: String,
      enum: {
        values: [
          'active',
          'suspended',
        ],
        message:
          'Status must be active or suspended',
      },
      default: 'active',
    },
  },
  {
    /**
     * Automatically creates and updates:
     *
     * created_at
     * updated_at
     */
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },

    /**
     * Removes the default Mongoose __v property.
     */
    versionKey: false,

    /**
     * Explicit MongoDB collection name.
     */
    collection: 'users',
  }
);

/**
 * Indexes improve queries that filter users by verification status,
 * account status, or role.
 */
userSchema.index(
  { verification_status: 1 }
);

userSchema.index(
  { status: 1 }
);

userSchema.index(
  { role: 1 }
);

/**
 * Reuses an existing model during development reloads.
 *
 * This avoids the Mongoose OverwriteModelError when using tsx watch.
 */
const User: Model<IUser> =
  models.User ||
  model<IUser>(
    'User',
    userSchema
  );

export default User;