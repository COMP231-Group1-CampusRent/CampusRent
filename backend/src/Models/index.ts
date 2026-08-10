/**
 * CampusRent Models
 *
 * Central export file for all Mongoose models and their
 * related TypeScript interfaces and types.
 *
 * Using this file allows other parts of the application
 * to import models and types from a single location.
 */

// ---------------------------------------------------------
// Mongoose Models
// ---------------------------------------------------------

export { default as User } from './User';
export { default as Listing } from './Listing';
export { default as RentalRequest } from './RentalRequest';
export { default as Conversation } from './Conversation';
export { default as Message } from './Message';
export { default as Review } from './Review';
export { default as Report } from './Report';

// ---------------------------------------------------------
// User Types
// ---------------------------------------------------------

export type {
  IUser,
  UserDocument,
  UserRole,
  VerificationStatus,
  AccountStatus,
} from './User';

// ---------------------------------------------------------
// Listing Types
// ---------------------------------------------------------

export type {
  IListing,
  IListingImage,
  ListingDocument,
  ListingAvailability,
} from './Listing';

// ---------------------------------------------------------
// Rental Request Types
// ---------------------------------------------------------

export type {
  IRentalRequest,
  RentalRequestDocument,
  RentalRequestStatus,
} from './RentalRequest';

// ---------------------------------------------------------
// Conversation Types
// ---------------------------------------------------------

export type {
  IConversation,
  ConversationDocument,
} from './Conversation';

// ---------------------------------------------------------
// Message Types
// ---------------------------------------------------------

export type {
  IMessage,
  MessageDocument,
} from './Message';

// ---------------------------------------------------------
// Review Types
// ---------------------------------------------------------

export type {
  IReview,
  ReviewDocument,
} from './Review';

// ---------------------------------------------------------
// Report Types
// ---------------------------------------------------------

export type {
  IReport,
  ReportDocument,
  ReportStatus,
  ReportTargetType,
  AdminAction,
} from './Report';