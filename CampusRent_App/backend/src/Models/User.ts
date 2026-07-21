import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
} from 'mongoose';

export type UserRole = 'student' | 'admin';

export type VerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected';

export type AccountStatus =
  | 'active'
  | 'suspended';

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

export type UserDocument =
  HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
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

    password_hash: {
      type: String,
      required: [
        true,
        'Password is required',
      ],
      select: false,
    },

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

    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: [
        30,
        'Phone number cannot exceed 30 characters',
      ],
    },

    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: [
        1000,
        'Bio cannot exceed 1000 characters',
      ],
    },

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
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },

    versionKey: false,

    collection: 'users',
  }
);

userSchema.index(
  { verification_status: 1 }
);

userSchema.index(
  { status: 1 }
);

userSchema.index(
  { role: 1 }
);

const User: Model<IUser> =
  models.User ||
  model<IUser>(
    'User',
    userSchema
  );

export default User;