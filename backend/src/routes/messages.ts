import { Router } from 'express';
import { isValidObjectId } from 'mongoose';

import Conversation from '../Models/Conversation';
import Message from '../Models/Message';
import User from '../Models/User';
import Listing from '../Models/Listing';

import {
  authenticate,
  requireVerifiedStudent,
} from '../middleware/auth';

const router = Router();

/**
 * CampusRent Messaging Routes
 *
 * Responsibilities:
 * - Retrieve conversations for the authenticated student.
 * - Start new conversations.
 * - Retrieve messages from a conversation.
 * - Send messages.
 * - Mark messages as read.
 *
 * All messaging routes require an authenticated and
 * verified student.
 */

// ---------------------------------------------------------
// Response Types
// ---------------------------------------------------------

/**
 * Public participant information returned to the frontend.
 */
interface FormattedParticipant {
  id: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Listing summary displayed inside a conversation.
 */
interface FormattedListing {
  id: string;
  title?: string;
}

/**
 * Message representation returned to the frontend.
 */
interface FormattedMessage {
  id: string;

  conversation_id?: string;

  sender_id?: string;

  content: string;

  read_by: string[];

  first_name?: string;

  last_name?: string;

  sender: FormattedParticipant | null;

  created_at?: Date | string;

  updated_at?: Date | string;
}

/**
 * Conversation representation returned to the frontend.
 *
 * Explicitly defining created_at and updated_at prevents
 * TypeScript from incorrectly narrowing the result type
 * when conversations are sorted.
 */
interface FormattedConversation {
  id: string;

  listing_id: string | null;

  participants: FormattedParticipant[];

  last_message: FormattedMessage | null;

  listing: FormattedListing | null;

  other_participant:
    | FormattedParticipant
    | null;

  created_at?: Date | string;

  updated_at?: Date | string;
}

// ---------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------

/**
 * Convert a populated user document into the simplified
 * participant format expected by the frontend.
 */
function formatParticipant(
  user: any
): FormattedParticipant | null {
  if (
    !user ||
    typeof user !== 'object'
  ) {
    return null;
  }

  return {
    id:
      user._id?.toString?.() ??
      user.id,

    first_name:
      user.first_name,

    last_name:
      user.last_name,
  };
}

/**
 * Convert a Message document into the format returned
 * by the CampusRent API.
 */
function formatMessage(
  message: any
): FormattedMessage {
  const messageObject =
    typeof message.toObject ===
    'function'
      ? message.toObject()
      : message;

  const sender =
    messageObject.sender;

  return {
    id:
      messageObject._id?.toString?.() ??
      messageObject.id,

    conversation_id:
      messageObject.conversation
        ?._id?.toString?.() ??
      messageObject.conversation
        ?.toString?.(),

    sender_id:
      sender?._id?.toString?.() ??
      sender?.toString?.(),

    content:
      messageObject.content,

    read_by:
      Array.isArray(
        messageObject.read_by
      )
        ? messageObject.read_by.map(
            (userId: any) =>
              userId?._id
                ?.toString?.() ??
              userId?.toString?.()
          )
        : [],

    first_name:
      sender?.first_name,

    last_name:
      sender?.last_name,

    sender:
      sender &&
      typeof sender === 'object'
        ? {
            id:
              sender._id
                ?.toString?.() ??
              sender.id,

            first_name:
              sender.first_name,

            last_name:
              sender.last_name,
          }
        : null,

    created_at:
      messageObject.created_at,

    updated_at:
      messageObject.updated_at,
  };
}

/**
 * Retrieve a conversation together with:
 * - participants
 * - listing summary
 * - most recent message
 * - other participant
 *
 * The user must belong to the conversation.
 */
async function getConversationWithDetails(
  conversationId: string,
  userId: string
): Promise<FormattedConversation | null> {
  const conversation =
    await Conversation.findById(
      conversationId
    )
      .populate(
        'participants',
        '_id first_name last_name'
      )
      .populate(
        'listing',
        '_id title'
      );

  if (!conversation) {
    return null;
  }

  // -------------------------------------------------------
  // Verify Conversation Membership
  // -------------------------------------------------------

  const participantIds =
    conversation.participants.map(
      (participant: any) =>
        participant._id
          ?.toString?.() ??
        participant.toString()
    );

  if (
    !participantIds.includes(userId)
  ) {
    return null;
  }

  // -------------------------------------------------------
  // Retrieve Most Recent Message
  // -------------------------------------------------------

  const lastMessage =
    await Message.findOne({
      conversation:
        conversation._id,
    })
      .populate(
        'sender',
        '_id first_name last_name'
      )
      .sort({
        created_at: -1,
      });

  const conversationObject =
    conversation.toObject() as any;

  // -------------------------------------------------------
  // Format Participants
  // -------------------------------------------------------

  const participants:
    FormattedParticipant[] =
    conversationObject.participants
      .map(formatParticipant)
      .filter(
        (
          participant:
            FormattedParticipant | null
        ): participant is FormattedParticipant =>
          participant !== null
      );

  const otherParticipant =
    participants.find(
      (participant) =>
        participant.id !== userId
    ) ?? null;

  // -------------------------------------------------------
  // Format Listing
  // -------------------------------------------------------

  const listing:
    FormattedListing | null =
    conversationObject.listing &&
    typeof conversationObject.listing ===
      'object'
      ? {
          id:
            conversationObject.listing
              ._id?.toString?.() ??
            conversationObject.listing
              .id,

          title:
            conversationObject.listing
              .title,
        }
      : null;

  // -------------------------------------------------------
  // Build API Response
  // -------------------------------------------------------

  return {
    id:
      conversationObject._id
        .toString(),

    listing_id:
      listing?.id ?? null,

    participants,

    last_message:
      lastMessage
        ? formatMessage(
            lastMessage
          )
        : null,

    listing,

    other_participant:
      otherParticipant,

    created_at:
      conversationObject.created_at,

    updated_at:
      conversationObject.updated_at,
  };
}

// ---------------------------------------------------------
// GET Conversations
// ---------------------------------------------------------

/**
 * GET /api/messages
 *
 * Returns all conversations belonging to the
 * authenticated student.
 *
 * Conversations are ordered by their most recent
 * activity.
 */
router.get(
  '/',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const conversations =
        await Conversation.find({
          participants:
            req.user!.id,
        }).select('_id');

      const detailedConversations =
        await Promise.all(
          conversations.map(
            (conversation) =>
              getConversationWithDetails(
                conversation._id
                  .toString(),
                req.user!.id
              )
          )
        );

      /**
       * Remove inaccessible/null conversations.
       */
      const result:
        FormattedConversation[] =
        detailedConversations
          .filter(
            (
              conversation
            ): conversation is FormattedConversation =>
              conversation !== null
          )
          .sort((a, b) => {
            /**
             * Prefer the date of the most recent
             * message.
             *
             * If no message exists, fall back to the
             * conversation creation date.
             */
            const firstDate =
              a.last_message
                ?.created_at ??
              a.created_at ??
              0;

            const secondDate =
              b.last_message
                ?.created_at ??
              b.created_at ??
              0;

            return (
              new Date(
                secondDate
              ).getTime() -
              new Date(
                firstDate
              ).getTime()
            );
          });

      res.json(result);
    } catch (error) {
      console.error(
        'Get conversations error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to retrieve conversations',
      });
    }
  }
);

// ---------------------------------------------------------
// CREATE Conversation
// ---------------------------------------------------------

/**
 * POST /api/messages
 *
 * Starts a new conversation or adds an initial
 * message to an existing conversation.
 */
router.post(
  '/',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const {
        recipient_id,
        listing_id,
        initial_message,
      } = req.body;

      // -----------------------------------------------------
      // Validate Recipient
      // -----------------------------------------------------

      if (
        !recipient_id ||
        !isValidObjectId(
          recipient_id
        )
      ) {
        res.status(400).json({
          error:
            'Valid recipient is required',
        });

        return;
      }

      /**
       * Prevent users from starting conversations
       * with themselves.
       */
      if (
        recipient_id ===
        req.user!.id
      ) {
        res.status(400).json({
          error:
            'Cannot start conversation with yourself',
        });

        return;
      }

      // -----------------------------------------------------
      // Validate Initial Message
      // -----------------------------------------------------

      if (
        typeof initial_message !==
          'string' ||
        !initial_message.trim()
      ) {
        res.status(400).json({
          error:
            'Initial message is required',
        });

        return;
      }

      // -----------------------------------------------------
      // Validate Listing ID
      // -----------------------------------------------------

      if (
        listing_id &&
        !isValidObjectId(
          listing_id
        )
      ) {
        res.status(400).json({
          error:
            'Invalid listing ID',
        });

        return;
      }

      // -----------------------------------------------------
      // Verify Recipient
      // -----------------------------------------------------

      const recipient =
        await User.findOne({
          _id: recipient_id,

          verification_status:
            'verified',

          status: 'active',
        }).select('_id');

      if (!recipient) {
        res.status(400).json({
          error:
            'Recipient not found or not verified',
        });

        return;
      }

      // -----------------------------------------------------
      // Verify Listing
      // -----------------------------------------------------

      let listing = null;

      if (listing_id) {
        listing =
          await Listing.findById(
            listing_id
          ).select('_id');

        if (!listing) {
          res.status(404).json({
            error:
              'Listing not found',
          });

          return;
        }
      }

      // -----------------------------------------------------
      // Search for Existing Conversation
      // -----------------------------------------------------

      const conversationFilter: {
        participants: {
          $all: string[];
          $size: number;
        };

        listing?: string | null;
      } = {
        participants: {
          $all: [
            req.user!.id,
            recipient_id,
          ],

          $size: 2,
        },
      };

      if (listing_id) {
        conversationFilter.listing =
          listing_id;
      } else {
        conversationFilter.listing =
          null;
      }

      let conversation =
        await Conversation.findOne(
          conversationFilter
        );

      let wasCreated = false;

      // -----------------------------------------------------
      // Create Conversation if Necessary
      // -----------------------------------------------------

      if (!conversation) {
        conversation =
          await Conversation.create({
            listing:
              listing?._id ??
              null,

            participants: [
              req.user!.id,
              recipient_id,
            ],
          });

        wasCreated = true;
      }

      // -----------------------------------------------------
      // Create Initial Message
      // -----------------------------------------------------

      await Message.create({
        conversation:
          conversation._id,

        sender:
          req.user!.id,

        content:
          initial_message.trim(),

        read_by: [
          req.user!.id,
        ],
      });

      const result =
        await getConversationWithDetails(
          conversation._id
            .toString(),
          req.user!.id
        );

      res
        .status(
          wasCreated
            ? 201
            : 200
        )
        .json(result);
    } catch (error) {
      console.error(
        'Create conversation error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to create conversation',
      });
    }
  }
);

// ---------------------------------------------------------
// GET Conversation Messages
// ---------------------------------------------------------

/**
 * GET /api/messages/:id/messages
 *
 * Returns all messages belonging to a conversation.
 *
 * Messages are also marked as read by the authenticated
 * student.
 */
router.get(
  '/:id/messages',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !isValidObjectId(id)
      ) {
        res.status(400).json({
          error:
            'Invalid conversation ID',
        });

        return;
      }

      // -----------------------------------------------------
      // Verify Conversation Access
      // -----------------------------------------------------

      const conversation =
        await Conversation.findOne({
          _id: id,

          participants:
            req.user!.id,
        });

      if (!conversation) {
        res.status(403).json({
          error:
            'Access denied',
        });

        return;
      }

      // -----------------------------------------------------
      // Mark Messages as Read
      // -----------------------------------------------------

      await Message.updateMany(
        {
          conversation:
            conversation._id,

          read_by: {
            $ne:
              req.user!.id,
          },
        },
        {
          $addToSet: {
            read_by:
              req.user!.id,
          },
        }
      );

      // -----------------------------------------------------
      // Retrieve Messages
      // -----------------------------------------------------

      const messages =
        await Message.find({
          conversation:
            conversation._id,
        })
          .populate(
            'sender',
            '_id first_name last_name'
          )
          .sort({
            created_at: 1,
          });

      res.json(
        messages.map(
          formatMessage
        )
      );
    } catch (error) {
      console.error(
        'Get conversation messages error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to retrieve messages',
      });
    }
  }
);

// ---------------------------------------------------------
// SEND Message
// ---------------------------------------------------------

/**
 * POST /api/messages/:id/messages
 *
 * Sends a new message to an existing conversation.
 *
 * Only conversation participants may send messages.
 */
router.post(
  '/:id/messages',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const { content } =
        req.body;

      // -----------------------------------------------------
      // Validate Conversation ID
      // -----------------------------------------------------

      if (
        !isValidObjectId(id)
      ) {
        res.status(400).json({
          error:
            'Invalid conversation ID',
        });

        return;
      }

      // -----------------------------------------------------
      // Validate Message
      // -----------------------------------------------------

      if (
        typeof content !==
          'string' ||
        !content.trim()
      ) {
        res.status(400).json({
          error:
            'Message content is required',
        });

        return;
      }

      // -----------------------------------------------------
      // Verify Conversation Access
      // -----------------------------------------------------

      const conversation =
        await Conversation.findOne({
          _id: id,

          participants:
            req.user!.id,
        });

      if (!conversation) {
        res.status(403).json({
          error:
            'Access denied',
        });

        return;
      }

      // -----------------------------------------------------
      // Create Message
      // -----------------------------------------------------

      const message =
        await Message.create({
          conversation:
            conversation._id,

          sender:
            req.user!.id,

          content:
            content.trim(),

          read_by: [
            req.user!.id,
          ],
        });

      await message.populate(
        'sender',
        '_id first_name last_name'
      );

      res
        .status(201)
        .json(
          formatMessage(
            message
          )
        );
    } catch (error) {
      console.error(
        'Send message error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to send message',
      });
    }
  }
);

export default router;