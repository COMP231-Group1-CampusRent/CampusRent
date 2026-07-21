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

function formatParticipant(user: any) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  return {
    id:
      user._id?.toString?.() ??
      user.id,

    first_name: user.first_name,
    last_name: user.last_name,
  };
}

function formatMessage(message: any) {
  const messageObject =
    typeof message.toObject === 'function'
      ? message.toObject()
      : message;

  const sender =
    messageObject.sender;

  return {
    id:
      messageObject._id?.toString?.() ??
      messageObject.id,

    conversation_id:
      messageObject.conversation?._id?.toString?.() ??
      messageObject.conversation?.toString?.(),

    sender_id:
      sender?._id?.toString?.() ??
      sender?.toString?.(),

    content: messageObject.content,

    read_by:
      Array.isArray(messageObject.read_by)
        ? messageObject.read_by.map(
            (userId: any) =>
              userId?._id?.toString?.() ??
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
              sender._id?.toString?.() ??
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

async function getConversationWithDetails(
  conversationId: string,
  userId: string
) {
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

  const participantIds =
    conversation.participants.map(
      (participant: any) =>
        participant._id?.toString?.() ??
        participant.toString()
    );

  if (!participantIds.includes(userId)) {
    return null;
  }

  const lastMessage =
    await Message.findOne({
      conversation: conversation._id,
    })
      .populate(
        'sender',
        '_id first_name last_name'
      )
      .sort({
        created_at: -1,
      });

  const conversationObject =
    conversation.toObject();

  const participants =
    conversationObject.participants
      .map(formatParticipant)
      .filter(Boolean);

  const otherParticipant =
    participants.find(
      (participant: any) =>
        participant.id !== userId
    );

  const listing =
    conversationObject.listing &&
    typeof conversationObject.listing ===
      'object'
      ? {
          id:
            (
              conversationObject.listing as any
            )._id?.toString?.() ??
            (
              conversationObject.listing as any
            ).id,

          title: (
            conversationObject.listing as any
          ).title,
        }
      : null;

  return {
    id:
      conversationObject._id.toString(),

    listing_id:
      listing?.id ?? null,

    participants,

    last_message: lastMessage
      ? formatMessage(lastMessage)
      : null,

    listing,

    other_participant:
      otherParticipant ?? null,

    created_at:
      conversationObject.created_at,

    updated_at:
      conversationObject.updated_at,
  };
}

/**
 * GET /api/messages
 *
 * Returns all conversations belonging
 * to the authenticated student.
 */
router.get(
  '/',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const conversations =
        await Conversation.find({
          participants: req.user!.id,
        }).select('_id');

      const detailedConversations =
        await Promise.all(
          conversations.map(
            (conversation) =>
              getConversationWithDetails(
                conversation._id.toString(),
                req.user!.id
              )
          )
        );

      const result =
        detailedConversations
          .filter(
            (
              conversation
            ): conversation is NonNullable<
              typeof conversation
            > => conversation !== null
          )
          .sort((a, b) => {
            const firstDate =
              a.last_message?.created_at ??
              a.created_at;

            const secondDate =
              b.last_message?.created_at ??
              b.created_at;

            return (
              new Date(
                secondDate
              ).getTime() -
              new Date(firstDate).getTime()
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

/**
 * POST /api/messages
 *
 * Starts a new conversation or adds
 * a message to an existing conversation.
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

      if (
        !recipient_id ||
        !isValidObjectId(recipient_id)
      ) {
        res.status(400).json({
          error:
            'Valid recipient is required',
        });

        return;
      }

      if (
        recipient_id === req.user!.id
      ) {
        res.status(400).json({
          error:
            'Cannot start conversation with yourself',
        });

        return;
      }

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

      if (
        listing_id &&
        !isValidObjectId(listing_id)
      ) {
        res.status(400).json({
          error:
            'Invalid listing ID',
        });

        return;
      }

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

      if (!conversation) {
        conversation =
          await Conversation.create({
            listing:
              listing?._id ?? null,

            participants: [
              req.user!.id,
              recipient_id,
            ],
          });

        wasCreated = true;
      }

      await Message.create({
        conversation:
          conversation._id,

        sender: req.user!.id,

        content:
          initial_message.trim(),

        read_by: [req.user!.id],
      });

      const result =
        await getConversationWithDetails(
          conversation._id.toString(),
          req.user!.id
        );

      res
        .status(wasCreated ? 201 : 200)
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

/**
 * GET /api/messages/:id/messages
 *
 * Returns all messages in a conversation.
 */
router.get(
  '/:id/messages',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        res.status(400).json({
          error:
            'Invalid conversation ID',
        });

        return;
      }

      const conversation =
        await Conversation.findOne({
          _id: id,
          participants: req.user!.id,
        });

      if (!conversation) {
        res.status(403).json({
          error: 'Access denied',
        });

        return;
      }

      await Message.updateMany(
        {
          conversation:
            conversation._id,

          read_by: {
            $ne: req.user!.id,
          },
        },
        {
          $addToSet: {
            read_by: req.user!.id,
          },
        }
      );

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
        messages.map(formatMessage)
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

/**
 * POST /api/messages/:id/messages
 *
 * Sends a new message in a conversation.
 */
router.post(
  '/:id/messages',
  authenticate,
  requireVerifiedStudent,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;

      if (!isValidObjectId(id)) {
        res.status(400).json({
          error:
            'Invalid conversation ID',
        });

        return;
      }

      if (
        typeof content !== 'string' ||
        !content.trim()
      ) {
        res.status(400).json({
          error:
            'Message content is required',
        });

        return;
      }

      const conversation =
        await Conversation.findOne({
          _id: id,
          participants: req.user!.id,
        });

      if (!conversation) {
        res.status(403).json({
          error: 'Access denied',
        });

        return;
      }

      const message =
        await Message.create({
          conversation:
            conversation._id,

          sender: req.user!.id,

          content: content.trim(),

          read_by: [req.user!.id],
        });

      await message.populate(
        'sender',
        '_id first_name last_name'
      );

      res
        .status(201)
        .json(
          formatMessage(message)
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